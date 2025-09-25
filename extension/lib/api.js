// ResearchVault API Client for Chrome Extension
console.log('Loading api.js...');

class API {
    constructor() {
        // Chrome拡張機能環境では本番URLを使用
        // 開発時にローカルを使用したい場合はここを変更
        this.baseURL = this.isLocalDevelopment() 
            ? 'http://localhost:3000/api'
            : 'https://research-vault.vercel.app/api';
            
        this.supabaseUrl = 'https://pzplwtvnxikhykqsvcfs.supabase.co'; // ここにSupabaseのURLを設定
        this.supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6cGx3dHZueGlraHlrcXN2Y2ZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3NTg3NzQsImV4cCI6MjA3NDMzNDc3NH0.k8h6E0QlW2549ILvrR5NeMdzJMmhmekj6O_GZ3C43V0'; // ここにSupabaseの匿名キーを設定
        
        this.authToken = null;
        this.supabaseClient = null;
        this.connectionStatus = 'unknown' // unknown, online, offline
        this.requestQueue = [] // オフライン時のリクエストキュー
        this.retryConfig = {
            maxRetries: 3,
            delay: 1000,
            backoff: 2
        }
        
        this.initSupabase();
        // 接続チェックは必要に応じて後で実行
        // this.checkConnection();
    }

    /**
     * 開発環境かどうかを判定（サービスワーカー対応）
     */
    isLocalDevelopment() {
        // 開発時はここをtrueに変更してください
        const DEV_MODE = false;
        
        // または拡張機能IDで判定（より高度な方法）
        try {
            const extensionId = chrome.runtime.id;
            // 開発時の拡張機能IDは通常長い文字列
            const isDevelopmentExtension = extensionId && extensionId.length > 20;
            return DEV_MODE || isDevelopmentExtension;
        } catch (error) {
            return DEV_MODE;
        }
    }

    async initSupabase() {
        try {
            // Supabaseクライアントの初期化
            // 本来はSupabaseのJSクライアントを使用するが、拡張機能では簡単なfetch APIを使用
            console.log('Supabase client initialized');
        } catch (error) {
            console.error('Failed to initialize Supabase:', error);
        }
    }

    async setAuthToken(token) {
        this.authToken = token;
    }

    async request(endpoint, options = {}) {
        try {
            const url = `${this.baseURL}${endpoint}`;
            const config = {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Client-Info': 'researchvault-extension@1.0.0',
                    ...options.headers
                },
                ...options
            };

            if (this.authToken) {
                config.headers['Authorization'] = `Bearer ${this.authToken}`;
            }

            const response = await fetch(url, config);
            
            if (!response.ok) {
                const errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                throw new Error(errorMessage);
            }
            
            const data = await response.json();
            this.updateConnectionStatus('online');
            
            return { success: true, data };
        } catch (error) {
            console.log('API request failed, falling back to offline mode');
            this.updateConnectionStatus('offline');
            return { 
                success: false, 
                error: error.message || 'Request failed'
            };
        }
    }

    /**
     * リクエストエラーの処理
     */
    async handleRequestError(error, context) {
        console.error('Request error:', error, context);
        
        // 接続状態の更新
        if (error.name === 'AbortError') {
            this.updateConnectionStatus('offline')
        } else if (error.message.includes('fetch')) {
            this.updateConnectionStatus('offline')
        }

        // 認証エラーの場合はトークンをクリア
        if (error.status === 401) {
            this.authToken = null
            await chrome.storage.sync.remove(['authToken'])
        }
    }

    /**
     * 接続状態の更新
     */
    updateConnectionStatus(status) {
        if (this.connectionStatus !== status) {
            this.connectionStatus = status
            console.log(`Connection status changed to: ${status}`)
            
            // バックグラウンドスクリプトに通知
            chrome.runtime.sendMessage({
                action: 'connectionStatusChanged',
                status: status
            }).catch(() => {
                // バックグラウンドスクリプトが利用できない場合は無視
            })
        }
    }

    // 認証関連
    async login(email, password) {
        try {
            if (!email || !password) {
                throw new Error('メールアドレスとパスワードが必要です')
            }

            // 本番APIが利用できない場合のモック認証
            if (!this.isAPIAvailable()) {
                return await this.mockLogin(email, password);
            }

            const response = await this.request('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email, password })
            });

            if (response.success && response.data?.token) {
                this.authToken = response.data.token;
                
                // 成功時にはトークンをストレージに保存
                await chrome.storage.sync.set({ 
                    authToken: response.data.token,
                    lastLoginTime: new Date().toISOString()
                })
                
                return {
                    success: true,
                    token: response.data.token,
                    user: response.data.user
                };
            }
            
            return response;
        } catch (error) {
            console.error('Login error:', error);
            // APIエラーの場合もモック認証を試行
            if (error.message.includes('Failed to fetch') || error.message.includes('404')) {
                console.log('API unavailable, falling back to mock login');
                return await this.mockLogin(email, password);
            }
            return { 
                success: false, 
                error: error.message || 'Login failed'
            };
        }
    }

    // モック認証機能
    async mockLogin(email, password) {
        console.log('Using mock authentication');
        
        // 簡単なバリデーション
        if (!email.includes('@') || password.length < 3) {
            return {
                success: false,
                error: '有効なメールアドレスとパスワードを入力してください'
            };
        }

        // モックトークンの生成
        const mockToken = `mock_token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const mockUser = {
            id: `mock_user_${Date.now()}`,
            email: email,
            name: email.split('@')[0]
        };

        this.authToken = mockToken;

        // ストレージに保存
        await chrome.storage.sync.set({
            authToken: mockToken,
            lastLoginTime: new Date().toISOString(),
            userInfo: mockUser,
            isMockAuth: true
        });

        return {
            success: true,
            token: mockToken,
            user: mockUser,
            isMock: true
        };
    }

    // API利用可能性チェック
    async isAPIAvailable() {
        try {
            // ヘルスチェックエンドポイントを試行
            const response = await fetch(`${this.baseURL}/health`, {
                method: 'GET',
                timeout: 3000
            });
            return response.ok;
        } catch (error) {
            console.log('API not available, using mock mode');
            return false;
        }
    }

    async signup(email, password, name) {
        return this.request('/auth/signup', {
            method: 'POST',
            body: JSON.stringify({ email, password, name })
        });
    }

    async getCurrentUser() {
        if (!this.authToken) return null;
        
        const response = await this.request('/auth/me');
        return response.success ? response.data : null;
    }

    async logout() {
        const response = await this.request('/auth/logout', {
            method: 'POST'
        });
        
        if (response.success) {
            this.authToken = null;
        }
        
        return response;
    }

    // プロジェクト関連
    async getProjects() {
        const response = await this.request('/projects');
        return response.success ? response.data : [];
    }

    async getProject(id) {
        const response = await this.request(`/projects/${id}`);
        return response.success ? response.data : null;
    }

    async createProject(data) {
        return this.request('/projects', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async updateProject(id, data) {
        return this.request(`/projects/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    async deleteProject(id) {
        return this.request(`/projects/${id}`, {
            method: 'DELETE'
        });
    }

    // 参照関連
    async getReferences(filters = {}) {
        const params = new URLSearchParams(filters);
        const response = await this.request(`/references?${params}`);
        return response.success ? response.data : [];
    }

    async getReference(id) {
        const response = await this.request(`/references/${id}`);
        return response.success ? response.data : null;
    }

    async saveReference(data) {
        return this.request('/references', {
            method: 'POST',
            body: JSON.stringify({
                ...data,
                savedAt: new Date().toISOString()
            })
        });
    }

    async updateReference(id, data) {
        return this.request(`/references/${id}`, {
            method: 'PUT',
            body: JSON.stringify({
                ...data,
                updatedAt: new Date().toISOString()
            })
        });
    }

    async deleteReference(id) {
        return this.request(`/references/${id}`, {
            method: 'DELETE'
        });
    }

    // 選択テキスト関連
    async getSelectedTexts(referenceId) {
        const response = await this.request(`/references/${referenceId}/texts`);
        return response.success ? response.data : [];
    }

    async saveSelectedText(referenceId, data) {
        return this.request(`/references/${referenceId}/texts`, {
            method: 'POST',
            body: JSON.stringify({
                ...data,
                createdAt: new Date().toISOString()
            })
        });
    }

    async deleteSelectedText(textId) {
        return this.request(`/texts/${textId}`, {
            method: 'DELETE'
        });
    }

    // ブックマーク関連
    async getBookmarks(referenceId) {
        const response = await this.request(`/references/${referenceId}/bookmarks`);
        return response.success ? response.data : [];
    }

    async createBookmark(referenceId, data) {
        return this.request(`/references/${referenceId}/bookmarks`, {
            method: 'POST',
            body: JSON.stringify({
                ...data,
                createdAt: new Date().toISOString()
            })
        });
    }

    async deleteBookmark(bookmarkId) {
        return this.request(`/bookmarks/${bookmarkId}`, {
            method: 'DELETE'
        });
    }

    // 引用生成
    async generateCitation(data) {
        return this.request('/citations/generate', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async generateMultipleCitations(referenceIds, format = 'APA') {
        return this.request('/citations/generate-multiple', {
            method: 'POST',
            body: JSON.stringify({
                referenceIds,
                format
            })
        });
    }

    // タグ関連
    async getTags() {
        const response = await this.request('/tags');
        return response.success ? response.data : [];
    }

    async createTag(data) {
        return this.request('/tags', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    // 検索
    async searchReferences(query, filters = {}) {
        const params = new URLSearchParams({
            q: query,
            ...filters
        });
        const response = await this.request(`/search?${params}`);
        return response.success ? response.data : [];
    }

    // ユーティリティメソッド
    async checkConnection() {
        try {
            // サービスワーカー対応のシンプルな接続チェック
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
            const response = await fetch(`${this.baseURL}/health`, {
                method: 'GET',
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            const isOnline = response.ok;
            this.updateConnectionStatus(isOnline ? 'online' : 'offline');
            return isOnline;
        } catch (error) {
            // ネットワークエラーは正常な動作として扱う（オフライン状態）
            console.log('Network offline or API unavailable');
            this.updateConnectionStatus('offline');
            return false;
        }
    }

    // 簡単なエラーメッセージ取得
    handleError(error) {
        return error.message || 'Unknown error occurred';
    }

    /**
     * 健康状態のチェック（詳細）
     */
    async getHealthStatus() {
        try {
            const response = await this.request('/health')
            return {
                api: response.success,
                database: response.data?.database ?? false,
                timestamp: new Date().toISOString()
            }
        } catch (error) {
            return {
                api: false,
                database: false,
                timestamp: new Date().toISOString(),
                error: error.message || 'Health check failed'
            }
        }
    }

    /**
     * 接続復旧の試行
     */
    async attemptReconnection() {
        try {
            const isOnline = await this.checkConnection()
            if (isOnline && this.requestQueue.length > 0) {
                // キューされたリクエストを処理
                await this.processRequestQueue()
            }
            return isOnline
        } catch (error) {
            console.error('Reconnection failed:', error);
            return false
        }
    }

    /**
     * リクエストキューの処理
     */
    async processRequestQueue() {
        const queue = [...this.requestQueue]
        this.requestQueue = []

        for (const queuedRequest of queue) {
            try {
                await queuedRequest.retry()
            } catch (error) {
                console.error('Failed to process queued request:', error);
            }
        }
    }

    // バッチ処理
    async batchRequest(requests) {
        return this.request('/batch', {
            method: 'POST',
            body: JSON.stringify({ requests })
        });
    }

    // オフライン対応用のキャッシュ機能
    async getCachedData(key) {
        try {
            const { [key]: data } = await chrome.storage.local.get([key]);
            return data;
        } catch (error) {
            console.error('Failed to get cached data:', error);
            return null;
        }
    }

    async setCachedData(key, data) {
        try {
            await chrome.storage.local.set({ [key]: data });
        } catch (error) {
            console.error('Failed to set cached data:', error);
        }
    }

    async clearCache() {
        try {
            await chrome.storage.local.clear();
        } catch (error) {
            console.error('Failed to clear cache:', error);
        }
    }
}
