// ResearchVault Popup JavaScript

class PopupManager {
    constructor() {
        this.api = null;
        this.errorHandler = null;
        this.handleExtensionError = null;
        this.currentUser = null;
        this.currentTab = null;
        this.projects = [];
        this.isLoading = false;
        this.retryCount = 0;
        this.maxRetries = 3;
        this.geminiKeyCached = null;
        this.init();
    }

    async init() {
        try {
            this.showLoading(true);
            
            await this.loadModules();
            await this.getCurrentTab();
            await this.checkAuthState();
            await this.loadGeminiKeyStatus();
            this.bindEvents();
            this.updatePageInfo();
        } catch (error) {
            if (this.handleExtensionError) {
                await this.handleExtensionError(error, {
                    method: 'init',
                    component: 'PopupManager'
                });
            } else {
                console.error('Init error:', error);
            }
            this.showError('初期化に失敗しました');
        } finally {
            this.showLoading(false);
        }
    }

    async loadModules() {
        try {
            // グローバルスコープからクラスを取得
            this.api = new API();
            this.errorHandler = extensionErrorHandler;
            this.handleExtensionError = handleExtensionError;
        } catch (error) {
            console.error('Failed to initialize classes:', error);
            throw new Error('クラスの初期化に失敗しました');
        }
    }

    async getCurrentTab() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            this.currentTab = tab;
        } catch (error) {
            console.error('Failed to get current tab:', error);
        }
    }

    async checkAuthState() {
        try {
            const { authToken, userInfo, sessionInfo } = await chrome.storage.sync.get(['authToken', 'userInfo', 'sessionInfo']);
            
            if (authToken && userInfo) {
                let tokenToUse = authToken;

                // トークン有効期限を確認し、切れそうならリフレッシュ
                const expiry = this.getTokenExpiry(authToken);
                if (expiry && (expiry.isExpired || expiry.timeUntilExpiry < 60)) {
                    const refreshed = await this.refreshToken();
                    if (refreshed.success && refreshed.token) {
                        tokenToUse = refreshed.token;
                    } else {
                        await this.handleLogout();
                        this.showAuthSection();
                        return;
                    }
                }

                await this.api.setAuthToken(tokenToUse);
                this.currentUser = userInfo;
                await this.loadProjects();
                this.showMainSection();
                return;
            }
        } catch (error) {
            console.error('Auth check failed:', error);
        }
        this.showAuthSection();
    }

    async loadProjects() {
        try {
            this.projects = await this.api.getProjects();
            this.updateProjectSelect();
        } catch (error) {
            console.error('Failed to load projects:', error);
            this.projects = [];
        }
    }

    async updateProjectSelect() {
        const searchInput = document.getElementById('projectSearch');
        const dropdown = document.getElementById('projectDropdown');
        const hiddenSelect = document.getElementById('projectSelect');
        
        if (!searchInput || !dropdown || !hiddenSelect) {
            console.error('Project select elements not found');
            return;
        }

        // 前回選択したプロジェクトを取得
        const { lastSelectedProject } = await chrome.storage.sync.get(['lastSelectedProject']);
        let defaultProject = null;
        
        if (lastSelectedProject) {
            defaultProject = this.projects.find(p => p.id === lastSelectedProject);
        }

        // デフォルトプロジェクトを設定
        if (defaultProject) {
            searchInput.value = `${defaultProject.icon || '📁'} ${defaultProject.name}`;
            hiddenSelect.value = defaultProject.id;
        } else {
            searchInput.value = '';
            hiddenSelect.value = '';
        }

        // 検索機能を追加
        searchInput.addEventListener('input', (e) => {
            dropdown.classList.remove('hidden');
            const query = e.target.value.toLowerCase();
            this.filterProjects(query);
        });

        // フォーカス時の動作
        searchInput.addEventListener('focus', () => {
            dropdown.classList.remove('hidden');
            // フォーカス時は常に全件表示
            this.filterProjects('');
            // クリック／フォーカスでテキストを全選択
            searchInput.select();
        });

        // クリック時の動作（テキストを全選択し、候補を表示）
        searchInput.addEventListener('click', () => {
            searchInput.select();
            dropdown.classList.remove('hidden');
            // クリック時も全件表示（入力変更までは絞り込まない）
            this.filterProjects('');
        });

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.searchable-select')) {
                dropdown.classList.add('hidden');
            }
        });

        // 初期表示
        this.filterProjects('');
    }

    filterProjects(query) {
        const dropdown = document.getElementById('projectDropdown');
        dropdown.innerHTML = '';

        // クエリが空の場合は全プロジェクトを表示
        let filtered = this.projects;
        
        if (query) {
            // アイコン記号を除外して検索
            const cleanQuery = query.replace(/[📁📂]/g, '').trim().toLowerCase();
            filtered = this.projects.filter(p => 
                p.name.toLowerCase().includes(cleanQuery)
            );
        }

        if (filtered.length === 0) {
            dropdown.innerHTML = '<div class="dropdown-item">プロジェクトが見つかりません</div>';
            return;
        }

        filtered.forEach(project => {
            const item = document.createElement('div');
            item.className = 'dropdown-item';
            item.textContent = `${project.icon || '📁'} ${project.name}`;
            item.addEventListener('click', () => {
                const searchInput = document.getElementById('projectSearch');
                const hiddenSelect = document.getElementById('projectSelect');
                
                searchInput.value = `${project.icon || '📁'} ${project.name}`;
                hiddenSelect.value = project.id;
                dropdown.classList.add('hidden');
                
                // 選択したプロジェクトを保存
                chrome.storage.sync.set({ lastSelectedProject: project.id });
            });
            dropdown.appendChild(item);
        });
    }

    updatePageInfo() {
        if (!this.currentTab) return;

        const titleElement = document.getElementById('pageTitle');
        const urlElement = document.getElementById('pageUrl');

        if (titleElement) {
            titleElement.textContent = this.currentTab.title || 'タイトルなし';
        }
        if (urlElement) {
            urlElement.textContent = this.currentTab.url || '';
        }
    }

    showAuthSection() {
        document.getElementById('authSection').classList.remove('hidden');
        document.getElementById('mainSection').classList.add('hidden');
    }

    showMainSection() {
        document.getElementById('authSection').classList.add('hidden');
        document.getElementById('mainSection').classList.remove('hidden');
        
        if (this.currentUser) {
            const userEmailElement = document.getElementById('userEmail');
            if (userEmailElement) {
                userEmailElement.textContent = this.currentUser.email;
            }
        }
    }

    showLoading(show = true) {
        const loading = document.getElementById('loading');
        if (show) {
            loading.classList.remove('hidden');
        } else {
            loading.classList.add('hidden');
        }
    }

    bindEvents() {
        // ログインボタン
        document.getElementById('loginBtn')?.addEventListener('click', () => this.handleLogin());
        
        // サインアップボタン
        document.getElementById('signupBtn')?.addEventListener('click', () => this.handleSignup());
        
        // 保存ボタン
        document.getElementById('saveBtn')?.addEventListener('click', () => this.handleSave());
        
        // ダッシュボードボタン
        document.getElementById('openDashboardBtn')?.addEventListener('click', () => this.openDashboard());
        
        // クイックアクションボタン
        document.getElementById('saveTextBtn')?.addEventListener('click', () => this.handleSaveSelectedText());
        document.getElementById('generateCitationBtn')?.addEventListener('click', () => this.handleGenerateCitation());
        
        // ログアウトボタン
        document.getElementById('logoutBtn')?.addEventListener('click', () => this.handleLogout());

        // Geminiキーの保存/クリア
        document.getElementById('saveGeminiKeyBtn')?.addEventListener('click', () => this.handleSaveGeminiKey());
        document.getElementById('clearGeminiKeyBtn')?.addEventListener('click', () => this.handleClearGeminiKey());

        // プロジェクト選択の保存は updateProjectSelect で処理

        // Enterキーでログイン
        document.getElementById('email')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleLogin();
        });
        document.getElementById('password')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleLogin();
        });
    }

    async loadGeminiKeyStatus() {
        try {
            const { geminiApiKey } = await chrome.storage.sync.get(['geminiApiKey']);
            this.geminiKeyCached = geminiApiKey || null;
            const status = document.getElementById('geminiStatus');
            const input = document.getElementById('geminiKeyInput');
            if (status) {
                status.textContent = geminiApiKey ? '設定済み' : '未設定';
                status.style.color = geminiApiKey ? '#16a34a' : '#6b7280';
            }
            if (input) {
                input.value = '';
                input.placeholder = geminiApiKey ? 'キーを再入力して上書き' : 'APIキーを入力';
            }
        } catch (error) {
            console.error('Failed to load Gemini key status:', error);
        }
    }

    async handleSaveGeminiKey() {
        try {
            const input = document.getElementById('geminiKeyInput');
            const key = input?.value.trim();
            if (!key) {
                this.showWarning('APIキーを入力してください');
                return;
            }
            await chrome.storage.sync.set({ geminiApiKey: key });
            this.geminiKeyCached = key;
            this.showSuccess('Gemini APIキーを保存しました');
            await this.loadGeminiKeyStatus();
            if (input) input.value = '';
        } catch (error) {
            console.error('Failed to save Gemini key:', error);
            this.showError('APIキーの保存に失敗しました');
        }
    }

    async handleClearGeminiKey() {
        try {
            await chrome.storage.sync.remove(['geminiApiKey']);
            this.geminiKeyCached = null;
            this.showInfo('Gemini APIキーを無効化しました');
            await this.loadGeminiKeyStatus();
        } catch (error) {
            console.error('Failed to clear Gemini key:', error);
            this.showError('APIキーの削除に失敗しました');
        }
    }

    async handleLogin() {
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;

        if (!email || !password) {
            this.showError('メールアドレスとパスワードを入力してください');
            return;
        }

        try {
            this.showLoading(true);
            
            const result = await this.api.login(email, password);
            
            if (result.success) {
                await chrome.storage.sync.set({ authToken: result.token });
                await this.api.setAuthToken(result.token);
                this.currentUser = result.user;
                
                await this.loadProjects();
                this.showMainSection();
                this.showSuccess('ログインしました');
            } else {
                this.showError(result.error || 'ログインに失敗しました');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showError('ログインエラーが発生しました');
        } finally {
            this.showLoading(false);
        }
    }

    async handleSignup() {
        // ダッシュボードのサインアップページを開く
        chrome.tabs.create({ url: 'https://research-vault-eight.vercel.app/signup' });
    }

    async handleSave() {
        if (!this.currentTab) {
            this.showError('ページ情報を取得できません');
            return;
        }

        const projectId = document.getElementById('projectSelect').value;
        const tags = document.getElementById('tagsInput').value.split(',').map(tag => tag.trim()).filter(Boolean);
        const memo = document.getElementById('memoInput').value.trim();

        try {
            this.showLoading(true);
            this.showInfo('保存処理を開始しました。ポップアップを閉じても処理は継続します。', { duration: 4000 });

            // 認証トークン存在チェックだけ実施（実処理はバックグラウンドで）
            const { authToken } = await chrome.storage.sync.get(['authToken']);
            if (!authToken) {
                this.showError('認証が必要です。ログインしてください');
                await this.handleLogout();
                return;
            }

            const currentUrl = this.currentTab.url;
            if (currentUrl.startsWith('chrome://') || 
                currentUrl.startsWith('moz-extension://') || 
                currentUrl.startsWith('chrome-extension://') ||
                currentUrl.startsWith('about:') ||
                currentUrl.startsWith('data:')) {
                this.showError('このページは保存できません');
                return;
            }

            // バックグラウンドで保存処理を実行し、ポップアップは即時閉じる
            const payload = {
                tabId: this.currentTab.id,
                url: currentUrl,
                title: this.currentTab.title,
                favicon: this.currentTab.favIconUrl,
                projectId: projectId || null,
                memo: memo,
                tags: tags
            };

            const result = await chrome.runtime.sendMessage({
                action: 'saveReferenceAsync',
                data: payload
            });

            if (result?.success) {
                this.showSuccess('バックグラウンドで保存を開始しました。このまま閉じても処理は続きます。');
                this.clearForm();
                try { window.close(); } catch (e) { /* ignore */ }
            } else {
                this.showError(result?.error || '保存に失敗しました');
            }
        } catch (error) {
            console.error('Save error:', error);
            this.showError('保存エラーが発生しました');
        } finally {
            this.showLoading(false);
        }
    }

    async extractPageMetadata() {
        try {
            // Manifest V3対応: chrome.scripting.executeScript を使用
            if (!this.currentTab?.id) {
                console.log('No valid tab found, returning empty metadata');
                return {};
            }

            // 権限チェック
            if (!chrome.scripting || !chrome.scripting.executeScript) {
                console.log('chrome.scripting not available, returning empty metadata');
                return {};
            }

            const results = await chrome.scripting.executeScript({
                target: { tabId: this.currentTab.id },
                func: () => {
                    try {
                        const getMetaContent = (name) => {
                            const meta = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
                            return meta ? meta.content : null;
                        };
                        
                        return {
                            author: getMetaContent('author') || getMetaContent('og:author'),
                            publishedDate: getMetaContent('article:published_time') || getMetaContent('date'),
                            description: getMetaContent('description') || getMetaContent('og:description'),
                            siteName: getMetaContent('og:site_name'),
                            type: getMetaContent('og:type'),
                            canonical: getMetaContent('og:url') || document.querySelector('link[rel="canonical"]')?.href
                        };
                    } catch (scriptError) {
                        console.log('Script execution error:', scriptError);
                        return {};
                    }
                }
            });
            
            const metadata = results[0]?.result || {};
            console.log('Extracted metadata:', metadata);
            return metadata;
        } catch (error) {
            console.log('Extract metadata error:', error.message || error);
            return {};
        }
    }

    /**
     * PDF判定（拡張子 + Content-Type）
     */
    async checkIfPDF(url) {
        // 拡張子で判定
        if (url.toLowerCase().endsWith('.pdf')) {
            return true;
        }
        
        // Content-Typeで判定
        try {
            const response = await fetch(url, { method: 'HEAD' });
            const contentType = response.headers.get('content-type');
            return contentType?.includes('application/pdf') || false;
        } catch {
            return false;
        }
    }

    /**
     * GeminiでPDFから情報を抽出（ポップアップ版）
     * Webアプリと同一の判定基準で処理
     */
    async extractPDFInfoWithGemini(url) {
        try {
            const { geminiApiKey } = await chrome.storage.sync.get(['geminiApiKey']);
            if (!geminiApiKey) {
                throw new Error('Gemini APIキーが未設定です（設定画面で追加してください）');
            }
            if (!window?.PDFExtractor?.extractReferenceFromPDF) {
                throw new Error('PDF抽出モジュールが読み込まれていません');
            }
            const result = await window.PDFExtractor.extractReferenceFromPDF(url, geminiApiKey);
            return result || null;
        } catch (error) {
            console.error('Gemini PDF extraction failed:', error);
            throw error;
        }
    }

    async handleSaveSelectedText() {
        try {
            const selectedText = await this.getSelectedText();
            
            if (!selectedText || selectedText.trim().length === 0) {
                this.showError('テキストが選択されていません');
                return;
            }

            this.showLoading(true);

            // コンテキストを取得
            const context = await this.getSelectionContext();

            const textData = {
                text: selectedText.trim(),
                url: this.currentTab.url,
                title: this.currentTab.title,
                context: context
            };

            // バックグラウンドスクリプトを通じて保存
            const response = await chrome.runtime.sendMessage({
                action: 'saveSelectedText',
                data: textData
            });

            if (response && response.success) {
                this.showSuccess('選択テキストを保存しました');
            } else {
                this.showError(response?.error || '保存に失敗しました');
            }
        } catch (error) {
            console.error('Save selected text error:', error);
            this.showError('選択テキストの保存に失敗しました');
        } finally {
            this.showLoading(false);
        }
    }

    async getSelectedText() {
        try {
            if (!this.currentTab?.id) {
                throw new Error('有効なタブが見つかりません');
            }

            const results = await chrome.scripting.executeScript({
                target: { tabId: this.currentTab.id },
                func: () => {
                    return window.getSelection().toString();
                }
            });
            
            return results[0]?.result || null;
        } catch (error) {
            if (this.handleExtensionError) {
                await this.handleExtensionError(error, {
                    method: 'getSelectedText',
                    component: 'PopupManager',
                    tabId: this.currentTab?.id
                });
            } else {
                console.error('Get selected text error:', error);
            }
            return null;
        }
    }

    async getSelectionContext() {
        try {
            if (!this.currentTab?.id) {
                return null;
            }

            const results = await chrome.scripting.executeScript({
                target: { tabId: this.currentTab.id },
                func: () => {
                    const selection = window.getSelection();
                    if (selection.rangeCount === 0) return null;
                    
                    const range = selection.getRangeAt(0);
                    const startContainer = range.startContainer;
                    const endContainer = range.endContainer;
                    
                    // XPath取得
                    function getXPath(element) {
                        if (element.nodeType === Node.TEXT_NODE) {
                            element = element.parentNode;
                        }
                        const components = [];
                        let child = element;
                        
                        for (; child && child.nodeType === Node.ELEMENT_NODE; child = child.parentNode) {
                            let currentComponent = child.tagName.toLowerCase();
                            if (child.id) {
                                currentComponent += `[@id="${child.id}"]`;
                                components.unshift(currentComponent);
                                break;
                            }
                            const siblings = Array.from(child.parentNode?.children || [])
                                .filter(sibling => sibling.tagName === child.tagName);
                            if (siblings.length > 1) {
                                const index = siblings.indexOf(child) + 1;
                                currentComponent += `[${index}]`;
                            }
                            components.unshift(currentComponent);
                        }
                        return `/${components.join('/')}`;
                    }
                    
                    return {
                        xpath: getXPath(range.commonAncestorContainer),
                        before: startContainer.textContent.substring(
                            Math.max(0, range.startOffset - 50), 
                            range.startOffset
                        ),
                        after: endContainer.textContent.substring(
                            range.endOffset,
                            Math.min(endContainer.textContent.length, range.endOffset + 50)
                        )
                    };
                }
            });
            
            return results[0]?.result || null;
        } catch (error) {
            console.error('Get selection context error:', error);
            return null;
        }
    }

    // ブックマーク機能は削除

    async handleGenerateCitation() {
        try {
            if (!this.currentTab) {
                this.showError('ページ情報を取得できません');
                return;
            }

            this.showLoading(true);

            // メタデータを取得
            const metadata = await this.extractPageMetadata();
            
            // 簡易的なAPA形式の引用を生成
            const now = new Date();
            const accessDate = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
            
            let citation = '';
            
            // 著者がいれば表示
            if (metadata.author) {
                citation += `${metadata.author}. `;
            }
            
            // タイトル
            citation += `${this.currentTab.title}. `;
            
            // 公開日
            if (metadata.publishDate) {
                const pubDate = new Date(metadata.publishDate);
                citation += `(${pubDate.getFullYear()}). `;
            }
            
            // URL
            citation += `Retrieved ${accessDate}, from ${this.currentTab.url}`;

            await navigator.clipboard.writeText(citation);
            this.showSuccess('引用をクリップボードにコピーしました');
        } catch (error) {
            console.error('Citation generation error:', error);
            this.showError('引用生成エラーが発生しました: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    openDashboard() {
        chrome.tabs.create({ url: 'https://research-vault-eight.vercel.app' });
    }

    async refreshToken() {
        try {
            const { sessionInfo } = await chrome.storage.sync.get(['sessionInfo']);
            
            if (!sessionInfo || !sessionInfo.refresh_token) {
                return { success: false, error: 'リフレッシュトークンがありません' };
            }

            const refreshUrl = 'https://research-vault-eight.vercel.app/api/extension/refresh';
            const response = await fetch(refreshUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Extension-Version': '1.0.0',
                    'X-Client-Info': 'chrome-extension'
                },
                body: JSON.stringify({ 
                    refresh_token: sessionInfo.refresh_token 
                })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success && data.token) {
                    // 新しいトークンとセッション情報を保存
                    await chrome.storage.sync.set({
                        authToken: data.token,
                        sessionInfo: data.session,
                        lastLoginTime: new Date().toISOString()
                    });
                    
                    return { success: true, token: data.token };
                }
            }
            
            return { success: false, error: 'トークンのリフレッシュに失敗しました' };
        } catch (error) {
            console.error('Token refresh error:', error);
            return { success: false, error: error.message };
        }
    }

    async handleLogout() {
        try {
            await chrome.storage.sync.remove(['authToken', 'userInfo', 'sessionInfo', 'lastSelectedProject', 'lastLoginTime']);
            this.currentUser = null;
            this.projects = [];
            this.clearForm();
            this.showAuthSection();
            this.showSuccess('ログアウトしました');
        } catch (error) {
            console.error('Logout error:', error);
        }
    }

    clearForm() {
        // タグとメモのみクリア、プロジェクト選択は保持
        document.getElementById('tagsInput').value = '';
        document.getElementById('memoInput').value = '';
    }

    showError(message, options = {}) {
        this.showMessage(message, 'error', options);
    }

    showSuccess(message, options = {}) {
        this.showMessage(message, 'success', options);
    }

    showWarning(message, options = {}) {
        this.showMessage(message, 'warning', options);
    }

    showInfo(message, options = {}) {
        this.showMessage(message, 'info', options);
    }



    getTokenExpiry(token) {
        try {
            if (!token) return null;
            
            // JWTトークンをデコード（Base64）
            const parts = token.split('.');
            if (parts.length !== 3) return null;
            
            const payload = JSON.parse(atob(parts[1]));
            const now = Math.floor(Date.now() / 1000);
            
            return {
                exp: payload.exp,
                iat: payload.iat,
                currentTime: now,
                isExpired: payload.exp < now,
                timeUntilExpiry: payload.exp - now,
                expiryDate: new Date(payload.exp * 1000).toISOString()
            };
        } catch (error) {
            console.log('Failed to decode JWT token:', error);
            return null;
        }
    }

    showMessage(message, type = 'info', options = {}) {
        const {
            duration = 3000,
            persistent = false,
            actionButton = null,
            onAction = null
        } = options;

        // 既存のメッセージを削除
        const existingMessage = document.querySelector('.rv-message');
        if (existingMessage) {
            existingMessage.remove();
        }

        // メッセージタイプ別の設定
        const messageConfig = {
            error: {
                bg: '#fef2f2',
                color: '#dc2626',
                border: '#fecaca',
                icon: '❌'
            },
            success: {
                bg: '#f0fdf4',
                color: '#16a34a',
                border: '#bbf7d0',
                icon: '✅'
            },
            warning: {
                bg: '#fffbeb',
                color: '#d97706',
                border: '#fed7aa',
                icon: '⚠️'
            },
            info: {
                bg: '#eff6ff',
                color: '#2563eb',
                border: '#dbeafe',
                icon: 'ℹ️'
            }
        };

        const config = messageConfig[type] || messageConfig.info;

        // 新しいメッセージを作成
        const messageElement = document.createElement('div');
        messageElement.className = 'rv-message';
        
        let innerHTML = `
            <div style="display: flex; align-items: flex-start; gap: 8px;">
                <span style="font-size: 14px;">${config.icon}</span>
                <div style="flex: 1;">
                    <div style="font-weight: 500; margin-bottom: 2px;">${message}</div>
                </div>
        `;

        if (actionButton && onAction) {
            innerHTML += `
                <button class="rv-message-action" style="
                    padding: 4px 8px;
                    background: ${config.color};
                    color: white;
                    border: none;
                    border-radius: 4px;
                    font-size: 11px;
                    cursor: pointer;
                    margin-left: 8px;
                ">${actionButton}</button>
            `;
        }

        if (!persistent) {
            innerHTML += `
                <button class="rv-message-close" style="
                    background: none;
                    border: none;
                    cursor: pointer;
                    padding: 0;
                    margin-left: 8px;
                    color: ${config.color};
                    font-size: 16px;
                    line-height: 1;
                ">×</button>
            `;
        }

        innerHTML += '</div></div>';
        messageElement.innerHTML = innerHTML;

        messageElement.style.cssText = `
            position: fixed;
            top: 10px;
            left: 10px;
            right: 10px;
            padding: 12px;
            border-radius: 8px;
            font-size: 12px;
            z-index: 10000;
            background: ${config.bg};
            color: ${config.color};
            border: 1px solid ${config.border};
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            animation: slideIn 0.3s ease;
        `;

        // イベントリスナー
        if (actionButton && onAction) {
            messageElement.querySelector('.rv-message-action')?.addEventListener('click', () => {
                onAction();
                messageElement.remove();
            });
        }

        messageElement.querySelector('.rv-message-close')?.addEventListener('click', () => {
            messageElement.remove();
        });

        document.body.appendChild(messageElement);

        // 自動削除（persistentでない場合）
        if (!persistent && duration > 0) {
            setTimeout(() => {
                if (messageElement.parentNode) {
                    messageElement.style.animation = 'slideOut 0.3s ease forwards';
                    setTimeout(() => messageElement.remove(), 300);
                }
            }, duration);
        }

        return messageElement;
    }

    /**
     * 再試行可能なエラーの表示
     */
    showRetryableError(message, retryAction) {
        this.showError(message, {
            actionButton: '再試行',
            onAction: retryAction,
            duration: 5000
        });
    }

    /**
     * 永続的な警告の表示
     */
    showPersistentWarning(message) {
        return this.showWarning(message, {
            persistent: true
        });
    }
}

// ポップアップが読み込まれたときに初期化
document.addEventListener('DOMContentLoaded', () => {
    new PopupManager();
});

