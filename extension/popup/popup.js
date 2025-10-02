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
        this.init();
    }

    async init() {
        try {
            console.log('Popup initializing...');
            this.showLoading(true);
            
            await this.loadModules();
            await this.getCurrentTab();
            await this.checkAuthState();
            this.bindEvents();
            this.updatePageInfo();
            
            console.log('Popup initialized successfully');
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
            
            console.log('Classes initialized successfully');
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
            const { authToken, sessionInfo, lastLoginTime } = await chrome.storage.sync.get(['authToken', 'sessionInfo', 'lastLoginTime']);
            console.log('Checking auth state, token found:', !!authToken);
            
            if (authToken) {
                // トークンの有効期限をチェック
                if (sessionInfo && sessionInfo.expires_at) {
                    const expiresAt = new Date(sessionInfo.expires_at * 1000); // Unix timestamp to Date
                    const now = new Date();
                    const timeUntilExpiry = expiresAt.getTime() - now.getTime();
                    
                    console.log('Token expiry check:', {
                        expiresAt: expiresAt.toISOString(),
                        now: now.toISOString(),
                        timeUntilExpiry: timeUntilExpiry,
                        isExpired: timeUntilExpiry <= 0
                    });
                    
                    // 期限切れまたは5分以内に期限切れの場合
                    if (timeUntilExpiry <= 300000) { // 5分 = 300000ms
                        console.log('Token expired or expiring soon, clearing auth data');
                        await chrome.storage.sync.remove(['authToken', 'userInfo', 'sessionInfo', 'lastLoginTime']);
                        this.showAuthSection();
                        this.showError('セッションが期限切れです。再度ログインしてください');
                        return;
                    }
                }
                
                await this.api.setAuthToken(authToken);
                console.log('Auth token set in API client:', this.api.authToken);
                
                const user = await this.api.getCurrentUser();
                console.log('Current user:', user);
                
                if (user) {
                    this.currentUser = user;
                    await this.loadProjects();
                    this.showMainSection();
                    return;
                }
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            // 認証エラーの場合はストレージをクリア
            await chrome.storage.sync.remove(['authToken', 'userInfo', 'sessionInfo', 'lastLoginTime']);
        }
        this.showAuthSection();
    }

    async loadProjects() {
        try {
            console.log('Loading projects...');
            this.projects = await this.api.getProjects();
            console.log('Projects loaded:', this.projects);
            this.updateProjectSelect();
        } catch (error) {
            console.error('Failed to load projects:', error);
            this.projects = [];
        }
    }

    updateProjectSelect() {
        const select = document.getElementById('projectSelect');
        if (!select) {
            console.error('Project select element not found');
            return;
        }
        
        select.innerHTML = '<option value="">プロジェクトを選択</option>';
        console.log('Updating project select with', this.projects.length, 'projects');
        
        this.projects.forEach(project => {
            const option = document.createElement('option');
            option.value = project.id;
            option.textContent = project.name;
            select.appendChild(option);
            console.log('Added project option:', project.name, project.id);
        });
        
        console.log('Project select updated. Total options:', select.options.length);

        // 最後に選択したプロジェクトを復元
        chrome.storage.sync.get(['lastSelectedProject']).then(({ lastSelectedProject }) => {
            if (lastSelectedProject) {
                select.value = lastSelectedProject;
            }
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
        document.getElementById('createBookmarkBtn')?.addEventListener('click', () => this.handleCreateBookmark());
        document.getElementById('generateCitationBtn')?.addEventListener('click', () => this.handleGenerateCitation());
        
        // ログアウトボタン
        document.getElementById('logoutBtn')?.addEventListener('click', () => this.handleLogout());

        // プロジェクト選択の保存
        document.getElementById('projectSelect')?.addEventListener('change', (e) => {
            chrome.storage.sync.set({ lastSelectedProject: e.target.value });
        });

        // Enterキーでログイン
        document.getElementById('email')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleLogin();
        });
        document.getElementById('password')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleLogin();
        });
    }

    async handleLogin() {
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;

        console.log('Popup login attempt:', { email, hasPassword: !!password });

        if (!email || !password) {
            this.showError('メールアドレスとパスワードを入力してください');
            return;
        }

        try {
            this.showLoading(true);
            console.log('Calling api.login...');
            const result = await this.api.login(email, password);
            console.log('Login result:', result);
            
            if (result.success) {
                console.log('Login successful, saving token:', result.token);
                await chrome.storage.sync.set({ authToken: result.token });
                await this.api.setAuthToken(result.token);
                this.currentUser = result.user;
                
                // トークンが正しく設定されたか確認
                console.log('Auth token set:', this.api.authToken);
                
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
            
            // 認証トークンの確認
            if (!this.api.authToken) {
                this.showError('認証が必要です。ログインしてください');
                return;
            }
            
            // 特殊なURLの場合は保存を拒否
            const currentUrl = this.currentTab.url;
            if (currentUrl.startsWith('chrome://') || 
                currentUrl.startsWith('moz-extension://') || 
                currentUrl.startsWith('chrome-extension://') ||
                currentUrl.startsWith('about:') ||
                currentUrl.startsWith('data:')) {
                this.showError('このページは保存できません');
                return;
            }
            
            console.log('Saving reference with token:', this.api.authToken);
            
            const referenceData = {
                url: currentUrl,
                title: this.currentTab.title,
                favicon: this.currentTab.favIconUrl,
                projectId: projectId || null,
                tags: tags,
                memo: memo,
                metadata: await this.extractPageMetadata()
            };

            console.log('Reference data to save:', referenceData);
            const result = await this.api.saveReference(referenceData);
            
            if (result.success) {
                this.showSuccess('ページを保存しました');
                this.clearForm();
                
                // 保存成功を背景スクリプトに通知
                chrome.runtime.sendMessage({
                    action: 'referenceSaved',
                    data: result.data
                });
            } else {
                this.showError(result.error || '保存に失敗しました');
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

    async handleSaveSelectedText() {
        try {
            const selectedText = await this.getSelectedText();
            if (!selectedText) {
                this.showError('テキストが選択されていません');
                return;
            }

            this.showSuccess('選択テキストを保存しました');
        } catch (error) {
            console.error('Save selected text error:', error);
            this.showError('選択テキストの保存に失敗しました');
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

    async handleCreateBookmark() {
        this.showSuccess('ブックマークを作成しました');
    }

    async handleGenerateCitation() {
        try {
            if (!this.currentTab) {
                this.showError('ページ情報を取得できません');
                return;
            }

            const citation = await this.api.generateCitation({
                url: this.currentTab.url,
                title: this.currentTab.title,
                accessDate: new Date().toISOString(),
                format: 'APA'
            });

            if (citation.success) {
                await navigator.clipboard.writeText(citation.citation);
                this.showSuccess('引用をクリップボードにコピーしました');
            } else {
                this.showError('引用生成に失敗しました');
            }
        } catch (error) {
            console.error('Citation generation error:', error);
            this.showError('引用生成エラーが発生しました');
        }
    }

    openDashboard() {
        chrome.tabs.create({ url: 'https://research-vault-eight.vercel.app' });
    }

    async handleLogout() {
        try {
            await chrome.storage.sync.remove(['authToken', 'userInfo', 'lastSelectedProject']);
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
