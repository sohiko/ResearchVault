// ResearchVault Background Service Worker

// 依存スクリプトを読み込み
try {
    importScripts('../lib/errorHandler.js');
    importScripts('../lib/storage.js');
    importScripts('../lib/api.js');
    console.log('Dependencies loaded successfully');
} catch (error) {
    console.error('Failed to load dependencies:', error);
}

class BackgroundManager {
    constructor() {
        this.api = null;
        this.storage = null;
        this.contextMenuCreated = false;
        this.init();
    }

    async init() {
        console.log('ResearchVault service worker starting...');
        
        try {
            // API と StorageManager をグローバルスコープから取得
            this.api = new API();
            this.storage = new StorageManager();
            
            console.log('API and Storage classes initialized successfully');
        } catch (error) {
            console.error('Failed to initialize classes:', error);
            // 初期化に失敗した場合の基本的な機能のみ有効化
        }
        
        // イベントリスナーの設定
        this.setupEventListeners();
        
        // コンテキストメニューの作成
        await this.createContextMenus();
        
        // 定期的な同期の設定
        this.setupPeriodicSync();
        
        console.log('ResearchVault service worker initialized');
    }

    setupEventListeners() {
        // 拡張機能インストール時
        chrome.runtime.onInstalled.addListener((details) => {
            this.handleInstall(details);
        });

        // メッセージ受信
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
            return true; // 非同期レスポンス用
        });

        // コンテキストメニュークリック
        chrome.contextMenus.onClicked.addListener((info, tab) => {
            this.handleContextMenuClick(info, tab);
        });

        // タブ更新時
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            this.handleTabUpdate(tabId, changeInfo, tab);
        });

        // アラーム（定期実行）
        chrome.alarms.onAlarm.addListener((alarm) => {
            this.handleAlarm(alarm);
        });
    }

    async handleInstall(details) {
        console.log('Extension installed:', details.reason);
        
        if (details.reason === 'install') {
            // 初回インストール時の処理
            await this.setupDefaultSettings();
            
            // ウェルカムページを開く（オプション）
            // chrome.tabs.create({ url: 'https://research-vault.vercel.app/welcome' });
        } else if (details.reason === 'update') {
            // アップデート時の処理
            await this.handleUpdate(details.previousVersion);
        }
    }

    async setupDefaultSettings() {
        if (!this.storage) {
            console.warn('Storage not available, skipping default settings setup');
            return;
        }
        
        const defaultSettings = {
            theme: 'light',
            citationFormat: 'APA',
            autoSave: true,
            notifications: true,
            language: 'ja',
            dashboardUrl: 'https://research-vault.vercel.app'
        };
        
        await this.storage.setSettings(defaultSettings);
    }

    async handleUpdate(previousVersion) {
        console.log(`Updated from version ${previousVersion}`);
        // マイグレーション処理があればここに実装
    }

    async createContextMenus() {
        if (this.contextMenuCreated) return;
        
        try {
            // 既存のコンテキストメニューを削除
            await chrome.contextMenus.removeAll();
            
            // メインメニュー
            chrome.contextMenus.create({
                id: 'researchvault-main',
                title: 'ResearchVault',
                contexts: ['page', 'selection', 'link']
            });

            // サブメニュー
            chrome.contextMenus.create({
                id: 'save-page',
                parentId: 'researchvault-main',
                title: 'ページを保存',
                contexts: ['page']
            });

            chrome.contextMenus.create({
                id: 'save-selection',
                parentId: 'researchvault-main',
                title: '選択テキストを保存',
                contexts: ['selection']
            });

            chrome.contextMenus.create({
                id: 'create-bookmark',
                parentId: 'researchvault-main',
                title: 'ページ内ブックマークを作成',
                contexts: ['page']
            });

            chrome.contextMenus.create({
                id: 'generate-citation',
                parentId: 'researchvault-main',
                title: '引用を生成',
                contexts: ['page']
            });

            chrome.contextMenus.create({
                id: 'separator',
                parentId: 'researchvault-main',
                type: 'separator',
                contexts: ['page', 'selection']
            });

            chrome.contextMenus.create({
                id: 'open-dashboard',
                parentId: 'researchvault-main',
                title: 'ダッシュボードを開く',
                contexts: ['page', 'selection']
            });

            this.contextMenuCreated = true;
            console.log('Context menus created');
        } catch (error) {
            console.error('Failed to create context menus:', error);
        }
    }

    async handleContextMenuClick(info, tab) {
        console.log('Context menu clicked:', info.menuItemId);
        
        switch (info.menuItemId) {
            case 'save-page':
                await this.saveCurrentPage(tab);
                break;
            case 'save-selection':
                await this.saveSelectedText(info, tab);
                break;
            case 'create-bookmark':
                await this.createBookmark(tab);
                break;
            case 'generate-citation':
                await this.generateCitation(tab);
                break;
            case 'open-dashboard':
                await this.openDashboard();
                break;
        }
    }

    async saveCurrentPage(tab) {
        try {
            if (!this.storage || !this.api) {
                this.showNotification('エラー', 'システムが初期化されていません');
                return;
            }
            
            const authToken = await this.storage.getAuthToken();
            if (!authToken) {
                this.showNotification('ログインが必要です', 'ダッシュボードでログインしてください');
                return;
            }

            this.api.setAuthToken(authToken);
            
            // ページのメタデータを取得
            const metadata = await this.extractPageMetadata(tab.id);
            
            const referenceData = {
                url: tab.url,
                title: tab.title,
                favicon: tab.favIconUrl,
                metadata: metadata,
                savedAt: new Date().toISOString()
            };

            // オフライン対応：まずローカルに保存
            await this.storage.addReference(referenceData);
            
            // オンラインの場合はAPIに送信
            if (navigator.onLine) {
                const result = await this.api.saveReference(referenceData);
                if (result.success) {
                    await this.storage.markAsSynced('reference', referenceData.id);
                    this.showNotification('ページを保存しました', tab.title);
                } else {
                    this.showNotification('保存に失敗しました', result.error);
                }
            } else {
                this.showNotification('オフラインで保存しました', 'オンライン時に同期されます');
            }
        } catch (error) {
            console.error('Failed to save page:', error);
            this.showNotification('エラーが発生しました', error.message);
        }
    }

    async saveSelectedText(info, tab) {
        try {
            if (!this.storage) {
                this.showNotification('エラー', 'システムが初期化されていません');
                return;
            }
            
            const authToken = await this.storage.getAuthToken();
            if (!authToken) {
                this.showNotification('ログインが必要です', 'ダッシュボードでログインしてください');
                return;
            }

            if (!info.selectionText) {
                this.showNotification('テキストが選択されていません');
                return;
            }

            // 選択テキストのコンテキストを取得
            const context = await this.getSelectionContext(tab.id);
            
            const textData = {
                text: info.selectionText,
                url: tab.url,
                title: tab.title,
                xpath: context.xpath,
                contextBefore: context.before,
                contextAfter: context.after,
                createdAt: new Date().toISOString()
            };

            await this.storage.addSelectedText(textData);
            this.showNotification('選択テキストを保存しました', info.selectionText.substring(0, 50) + '...');
        } catch (error) {
            console.error('Failed to save selected text:', error);
            this.showNotification('テキスト保存に失敗しました', error.message);
        }
    }

    async createBookmark(tab) {
        try {
            if (!this.storage) {
                this.showNotification('エラー', 'システムが初期化されていません');
                return;
            }
            
            // スクロール位置と要素情報を取得
            const bookmarkData = await this.getBookmarkData(tab.id);
            
            bookmarkData.url = tab.url;
            bookmarkData.title = tab.title;
            bookmarkData.createdAt = new Date().toISOString();

            await this.storage.addBookmark(bookmarkData);
            this.showNotification('ブックマークを作成しました', tab.title);
        } catch (error) {
            console.error('Failed to create bookmark:', error);
            this.showNotification('ブックマーク作成に失敗しました', error.message);
        }
    }

    async generateCitation(tab) {
        try {
            if (!this.storage || !this.api) {
                this.showNotification('エラー', 'システムが初期化されていません');
                return;
            }
            
            const authToken = await this.storage.getAuthToken();
            if (!authToken) {
                this.showNotification('ログインが必要です');
                return;
            }

            this.api.setAuthToken(authToken);
            
            const metadata = await this.extractPageMetadata(tab.id);
            const settings = await this.storage.getSettings();
            
            const citationData = {
                url: tab.url,
                title: tab.title,
                metadata: metadata,
                format: settings.citationFormat || 'APA',
                accessDate: new Date().toISOString()
            };

            const result = await this.api.generateCitation(citationData);
            
            if (result.success) {
                // クリップボードにコピー
                await this.copyToClipboard(result.data.citation);
                this.showNotification('引用をクリップボードにコピーしました', result.data.citation);
            } else {
                this.showNotification('引用生成に失敗しました', result.error);
            }
        } catch (error) {
            console.error('Failed to generate citation:', error);
            this.showNotification('引用生成エラー', error.message);
        }
    }

    async openDashboard() {
        try {
            const dashboardUrl = this.storage 
                ? (await this.storage.getSettings()).dashboardUrl || 'https://research-vault.vercel.app'
                : 'https://research-vault.vercel.app';
            chrome.tabs.create({ url: dashboardUrl });
        } catch (error) {
            console.error('Failed to open dashboard:', error);
            chrome.tabs.create({ url: 'https://research-vault.vercel.app' });
        }
    }

    async handleMessage(message, sender, sendResponse) {
        try {
            switch (message.action) {
                case 'saveReference':
                    const result = await this.saveReference(message.data);
                    sendResponse(result);
                    break;
                    
                case 'getProjects':
                    const projects = await this.getProjects();
                    sendResponse(projects);
                    break;
                    
                case 'syncData':
                    await this.syncPendingData();
                    sendResponse({ success: true });
                    break;
                    
                case 'referenceSaved':
                    // ポップアップからの保存完了通知
                    this.showNotification('参照を保存しました', message.data.title);
                    break;
                    
                case 'syncAuthFromWebpage':
                    // WebページからのAuth同期
                    await this.handleAuthSync(message.data);
                    sendResponse({ success: true });
                    break;
                    
                default:
                    sendResponse({ error: 'Unknown action' });
            }
        } catch (error) {
            console.error('Message handling error:', error);
            sendResponse({ error: error.message });
        }
    }

    async handleTabUpdate(tabId, changeInfo, tab) {
        // ページの読み込み完了時に履歴候補をチェック
        if (changeInfo.status === 'complete' && tab.url) {
            await this.checkForUnrecordedSites(tab);
        }
    }

    async checkForUnrecordedSites(tab) {
        try {
            // 学術サイトの判定ロジック
            const academicDomains = [
                'scholar.google.com',
                'pubmed.ncbi.nlm.nih.gov',
                'jstor.org',
                'doi.org',
                'arxiv.org',
                'researchgate.net',
                'academia.edu'
            ];

            const isAcademicSite = academicDomains.some(domain => 
                tab.url.includes(domain)
            );

            if (isAcademicSite) {
                // 既に保存済みかチェック
                const references = await this.storage.getReferences();
                const isAlreadySaved = references.some(ref => ref.url === tab.url);

                if (!isAlreadySaved) {
                    // 保存候補として通知
                    this.showNotification(
                        '研究資料の可能性があります',
                        'このページを保存しますか？',
                        [{
                            title: '保存',
                            iconUrl: '/icons/icon16.png'
                        }]
                    );
                }
            }
        } catch (error) {
            console.error('Failed to check unrecorded sites:', error);
        }
    }

    async collectHistoryCandidates() {
        try {
            if (!this.storage || !this.api) {
                console.warn('Storage or API not available, skipping history collection');
                return;
            }
            
            const authToken = await this.storage.getAuthToken();
            if (!authToken || !navigator.onLine) return;

            this.api.setAuthToken(authToken);

            // 過去24時間の履歴を取得
            const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
            
            chrome.history.search({
                text: '',
                startTime: oneDayAgo,
                maxResults: 100
            }, async (historyItems) => {
                for (const item of historyItems) {
                    await this.processHistoryItem(item);
                }
            });

        } catch (error) {
            console.error('Failed to collect history candidates:', error);
        }
    }

    async processHistoryItem(historyItem) {
        try {
            const url = historyItem.url;
            const title = historyItem.title;
            
            // 内部ページや不要なURLをフィルタリング
            if (this.shouldSkipUrl(url)) {
                return;
            }

            const domain = new URL(url).hostname;
            
            // 学術サイトまたは研究関連サイトかチェック
            const isRelevant = this.isRelevantForResearch(url, title, domain);
            
            if (isRelevant) {
                // favicon取得を試行
                let favicon = null;
                try {
                    favicon = `https://www.google.com/s2/favicons?domain=${domain}`;
                } catch (e) {
                    // favicon取得失敗は無視
                }

                // 候補として送信
                const result = await this.api.createCandidate({
                    url: url,
                    title: title,
                    favicon: favicon,
                    visitedAt: new Date(historyItem.lastVisitTime).toISOString(),
                    domain: domain
                });

                if (!result.success && !result.skipped) {
                    console.warn('Failed to create candidate:', result.error);
                }
            }

        } catch (error) {
            console.error('Failed to process history item:', error);
        }
    }

    shouldSkipUrl(url) {
        // スキップすべきURLのパターン
        const skipPatterns = [
            /^chrome(-extension)?:\/\//,
            /^moz-extension:\/\//,
            /^about:/,
            /^file:\/\//,
            /localhost/,
            /127\.0\.0\.1/,
            /facebook\.com/,
            /twitter\.com/,
            /instagram\.com/,
            /youtube\.com\/watch/,
            /netflix\.com/,
            /amazon\.com\/(?!.*books)/,
            /google\.com\/search/
        ];

        return skipPatterns.some(pattern => pattern.test(url));
    }

    isRelevantForResearch(url, title, domain) {
        // 学術ドメインリスト
        const academicDomains = [
            'scholar.google.com',
            'pubmed.ncbi.nlm.nih.gov',
            'arxiv.org',
            'researchgate.net',
            'nature.com',
            'science.org',
            'ieee.org',
            'springer.com',
            'wiley.com',
            'sciencedirect.com',
            'jstor.org',
            'nih.gov',
            'who.int',
            'un.org',
            'ipcc.ch',
            'academia.edu'
        ];

        // 明確な学術ドメインの場合
        if (academicDomains.includes(domain) || domain.match(/\.(edu|ac\.|gov)$/)) {
            return true;
        }

        // タイトルや URL に研究関連キーワードが含まれる場合
        const researchKeywords = [
            'research', 'study', 'analysis', 'paper', 'journal', 'article',
            'thesis', 'dissertation', 'conference', 'proceedings', 'academic',
            'scientific', 'scholar', 'publication', 'bibliography', 'citation'
        ];

        const textToCheck = `${title || ''} ${url}`.toLowerCase();
        return researchKeywords.some(keyword => textToCheck.includes(keyword));
    }

    setupPeriodicSync() {
        // 5分ごとに同期チェック
        chrome.alarms.create('periodicSync', { periodInMinutes: 5 });
        
        // 1時間ごとに履歴候補チェック
        chrome.alarms.create('historyCheck', { periodInMinutes: 60 });
        
        // 1日1回のクリーンアップ
        chrome.alarms.create('dailyCleanup', { periodInMinutes: 24 * 60 });
    }

    async handleAlarm(alarm) {
        switch (alarm.name) {
            case 'periodicSync':
                await this.syncPendingData();
                break;
            case 'historyCheck':
                await this.collectHistoryCandidates();
                break;
            case 'dailyCleanup':
                await this.performDailyCleanup();
                break;
        }
    }

    async syncPendingData() {
        try {
            if (!this.storage || !this.api) {
                console.warn('Storage or API not available, skipping sync');
                return;
            }
            
            const authToken = await this.storage.getAuthToken();
            if (!authToken || !navigator.onLine) return;

            this.api.setAuthToken(authToken);
            const pendingItems = await this.storage.getPendingSyncItems();

            // 参照の同期
            for (const reference of pendingItems.references) {
                const result = await this.api.saveReference(reference);
                if (result.success) {
                    await this.storage.markAsSynced('reference', reference.id);
                }
            }

            // 選択テキストの同期
            for (const text of pendingItems.texts) {
                const result = await this.api.saveSelectedText(text.referenceId, text);
                if (result.success) {
                    await this.storage.markAsSynced('text', text.id);
                }
            }

            // ブックマークの同期
            for (const bookmark of pendingItems.bookmarks) {
                const result = await this.api.createBookmark(bookmark.referenceId, bookmark);
                if (result.success) {
                    await this.storage.markAsSynced('bookmark', bookmark.id);
                }
            }

            console.log('Sync completed');
        } catch (error) {
            console.error('Sync failed:', error);
        }
    }

    async performDailyCleanup() {
        try {
            if (!this.storage) {
                console.warn('Storage not available, skipping cleanup');
                return;
            }
            
            const result = await this.storage.cleanupOldData(30);
            console.log('Daily cleanup completed:', result);
        } catch (error) {
            console.error('Daily cleanup failed:', error);
        }
    }

    // ユーティリティメソッド
    async extractPageMetadata(tabId) {
        try {
            const [result] = await chrome.scripting.executeScript({
                target: { tabId },
                func: () => {
                    const getMetaContent = (name) => {
                        const meta = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
                        return meta ? meta.content : null;
                    };
                    
                    return {
                        author: getMetaContent('author') || getMetaContent('og:author'),
                        publishedDate: getMetaContent('article:published_time') || getMetaContent('date'),
                        description: getMetaContent('description') || getMetaContent('og:description'),
                        siteName: getMetaContent('og:site_name'),
                        type: getMetaContent('og:type')
                    };
                }
            });
            return result.result;
        } catch (error) {
            console.error('Failed to extract metadata:', error);
            return {};
        }
    }

    async getSelectionContext(tabId) {
        try {
            const [result] = await chrome.scripting.executeScript({
                target: { tabId },
                func: () => {
                    const selection = window.getSelection();
                    if (selection.rangeCount === 0) return null;

                    const range = selection.getRangeAt(0);
                    const container = range.commonAncestorContainer;
                    
                    // XPathを生成（簡単な実装）
                    const getXPath = (element) => {
                        const components = [];
                        let child = element.nodeType === Node.TEXT_NODE ? element.parentNode : element;
                        
                        for (; child && child.nodeType === Node.ELEMENT_NODE; child = child.parentNode) {
                            let currentComponent = child.tagName.toLowerCase();
                            if (child.id) {
                                currentComponent += `[@id="${child.id}"]`;
                            }
                            components.unshift(currentComponent);
                        }
                        
                        return `/${components.join('/')}`;
                    };

                    return {
                        xpath: getXPath(container),
                        before: range.startContainer.textContent.substring(Math.max(0, range.startOffset - 50), range.startOffset),
                        after: range.endContainer.textContent.substring(range.endOffset, Math.min(range.endContainer.textContent.length, range.endOffset + 50))
                    };
                }
            });
            return result.result || {};
        } catch (error) {
            console.error('Failed to get selection context:', error);
            return {};
        }
    }

    async getBookmarkData(tabId) {
        try {
            const [result] = await chrome.scripting.executeScript({
                target: { tabId },
                func: () => {
                    return {
                        scrollPosition: window.scrollY,
                        windowHeight: window.innerHeight,
                        documentHeight: document.documentElement.scrollHeight,
                        timestamp: Date.now()
                    };
                }
            });
            return result.result;
        } catch (error) {
            console.error('Failed to get bookmark data:', error);
            return { scrollPosition: 0 };
        }
    }

    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
        } catch (error) {
            console.error('Failed to copy to clipboard:', error);
        }
    }

    async handleAuthSync(authData) {
        try {
            if (!this.storage) {
                console.warn('Storage not available for auth sync');
                return;
            }

            // 認証トークンをChromeストレージに保存
            await this.storage.setAuthToken(authData.token);
            await this.storage.setUserInfo(authData.user);

            // APIクライアントに認証トークンを設定
            if (this.api) {
                this.api.setAuthToken(authData.token);
            }

            console.log('Auth synced from webpage:', authData.user.email);
            this.showNotification('認証を同期しました', `${authData.user.email} としてログインしました`);
        } catch (error) {
            console.error('Auth sync failed:', error);
            this.showNotification('認証同期に失敗しました', 'Webページでもう一度ログインしてください');
        }
    }

    showNotification(title, message = '', buttons = []) {
        const notificationOptions = {
            type: 'basic',
            iconUrl: '/icons/icon48.png',
            title: title,
            message: message
        };

        if (buttons.length > 0) {
            notificationOptions.buttons = buttons;
        }

        chrome.notifications.create(notificationOptions);
    }
}

// Service Worker の初期化
const backgroundManager = new BackgroundManager();
