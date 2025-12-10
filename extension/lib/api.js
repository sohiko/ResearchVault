// ResearchVault API Client for Chrome Extension
console.log('Loading api.js...');

class API {
    constructor() {
        // Chrome拡張機能環境では本番URLを使用
        // 開発時にローカルを使用したい場合はここを変更
        // 本番環境のAPIエンドポイント
        this.baseURL = this.isLocalDevelopment() 
            ? 'http://localhost:3000/api'
            : 'https://rv.jamknife.jp/api';
            

            
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
        // 本番環境では常にfalseを返す
        return false;
    }

    async initSupabase() {
        try {
            // Supabaseクライアントの初期化
            // 本来はSupabaseのJSクライアントを使用するが、拡張機能では簡単なfetch APIを使用

        } catch (error) {
            console.error('Failed to initialize Supabase:', error);
        }
    }

    async setAuthToken(token) {
        this.authToken = token;
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                'X-Client-Info': 'chrome-extension',
                'X-Extension-Version': '1.0.0',
                'User-Agent': 'ResearchVault-Extension/1.0.0',
                ...options.headers
            },
            ...options
        };

        if (this.authToken) {
            config.headers['Authorization'] = `Bearer ${this.authToken}`;
        }

        try {
            const response = await fetch(url, config);

            if (!response.ok) {
                // 401の場合は1回だけリフレッシュを試みる
                if (response.status === 401 && !options._retry) {
                    const refreshed = await this.refreshAuthToken();
                    if (refreshed.success) {
                        // 新しいトークンでリトライ
                        return await this.request(endpoint, { ...options, _retry: true });
                    }
                }

                let errorMessage = '';
                let errorDetails = null;
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || `HTTP ${response.status}: ${response.statusText}`;
                    errorDetails = errorData.details;
                } catch (parseError) {
                    switch (response.status) {
                        case 401:
                            errorMessage = '認証が必要です。ログインしてください';
                            break;
                        case 403:
                            errorMessage = 'アクセスが拒否されました';
                            break;
                        case 404:
                            errorMessage = 'リクエストされたリソースが見つかりません';
                            break;
                        case 500:
                            errorMessage = 'サーバーエラーが発生しました';
                            break;
                        default:
                            errorMessage = `リクエストに失敗しました (エラーコード: ${response.status})`;
                    }
                }
                console.error('API Error:', errorMessage);
                return { success: false, error: errorMessage, details: errorDetails };
            }

            const data = await response.json();
            this.updateConnectionStatus('online');

            return { success: true, data };
        } catch (error) {
            console.error('API request failed:', error.message);
            this.updateConnectionStatus('offline');
            return { 
                success: false, 
                error: error.message || 'Request failed'
            };
        }
    }

    /**
     * Supabaseトークンのリフレッシュ
     */
    async refreshAuthToken() {
        try {
            const { sessionInfo } = await chrome.storage.sync.get(['sessionInfo']);
            if (!sessionInfo?.refresh_token) {
                return { success: false, error: 'refresh token not found' };
            }

            const response = await fetch(`${this.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
                method: 'POST',
                headers: {
                    'apikey': this.supabaseAnonKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    refresh_token: sessionInfo.refresh_token
                })
            });

            if (!response.ok) {
                const text = await response.text();
                return { success: false, error: text || 'failed to refresh token' };
            }

            const data = await response.json();
            if (!data.access_token) {
                return { success: false, error: 'no access token returned' };
            }

            // 新しいセッション情報を保存
            const newSession = {
                ...sessionInfo,
                access_token: data.access_token,
                refresh_token: data.refresh_token || sessionInfo.refresh_token,
                expires_in: data.expires_in,
                expires_at: Math.floor(Date.now() / 1000) + (data.expires_in || 0),
                token_type: data.token_type
            };

            await chrome.storage.sync.set({
                authToken: data.access_token,
                sessionInfo: newSession,
                lastLoginTime: new Date().toISOString()
            });

            this.authToken = data.access_token;
            return { success: true, token: data.access_token };
        } catch (error) {
            console.error('Token refresh failed:', error);
            return { success: false, error: error.message };
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

            const authUrl = 'https://research-vault-eight.vercel.app/api/extension/auth';
            
            const response = await fetch(authUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Extension-Version': '1.0.0',
                    'X-Client-Info': 'chrome-extension',
                    'User-Agent': 'ResearchVault-Extension/1.0.0'
                },
                body: JSON.stringify({ email, password })
            });

            if (response.ok) {
                const data = await response.json();
                
                if (data.success && data.token) {
                    this.authToken = data.token;
                    
                    // トークンとセッション情報をストレージに保存
                    await chrome.storage.sync.set({ 
                        authToken: data.token,
                        userInfo: data.user,
                        sessionInfo: data.session,
                        lastLoginTime: new Date().toISOString()
                    });
                    
                    return {
                        success: true,
                        token: data.token,
                        user: data.user
                    };
                } else {
                    return {
                        success: false,
                        error: data.error || 'ログインに失敗しました'
                    };
                }
            } else {
                const errorText = await response.text();
                
                let errorMessage = '';
                try {
                    const errorData = JSON.parse(errorText);
                    errorMessage = errorData.error || 'ログインに失敗しました';
                } catch (parseError) {
                    switch (response.status) {
                        case 401:
                            errorMessage = 'メールアドレスまたはパスワードが正しくありません';
                            break;
                        case 403:
                            errorMessage = 'アクセスが拒否されました';
                            break;
                        case 404:
                            errorMessage = 'ログインサービスが見つかりません';
                            break;
                        case 500:
                            errorMessage = 'サーバーエラーが発生しました';
                            break;
                        default:
                            errorMessage = `ログインに失敗しました (エラーコード: ${response.status})`;
                    }
                }
                
                return {
                    success: false,
                    error: errorMessage
                };
            }
            
        } catch (error) {
            console.error('Login error:', error);
            return { 
                success: false, 
                error: error.message || 'ネットワークエラーが発生しました'
            };
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
        
        // ストレージからユーザー情報を取得
        try {
            const { userInfo } = await chrome.storage.sync.get(['userInfo']);
            return userInfo || null;
        } catch (error) {
            return null;
        }
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
        try {
            // ストレージキャッシュをまず確認
            const { projects } = await chrome.storage.local.get(['projects']);
            if (projects && projects.length > 0) {
                return projects;
            }

            if (!this.authToken) {
                return [];
            }

            // 共通request経由で現在のベースURLを使用
            const response = await this.request('/projects', {
                method: 'GET'
            });

            if (response.success && Array.isArray(response.data)) {
                await chrome.storage.local.set({ projects: response.data });
                return response.data;
            }

            return [];
        } catch (error) {
            console.error('Failed to load projects:', error);
            return [];
        }
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
        if (!this.authToken) {
            return {
                success: false,
                error: '認証が必要です。ログインしてください'
            };
        }

        const requestData = {
            ...data,
            savedAt: new Date().toISOString()
        };

        const response = await this.request('/references', {
            method: 'POST',
            body: JSON.stringify(requestData)
        });

        return response;
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

    // 記録漏れ候補管理
    async getCandidates(limit = 20, dismissed = false) {
        const params = new URLSearchParams({
            limit: limit.toString(),
            dismissed: dismissed.toString()
        });
        return this.request(`/candidates?${params}`);
    }

    async createCandidate(data) {
        return this.request('/candidates', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async dismissCandidate(candidateId) {
        return this.request('/candidates', {
            method: 'PUT',
            body: JSON.stringify({
                id: candidateId,
                action: 'dismiss'
            })
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
            
            const response = await fetch('https://research-vault-eight.vercel.app/api/extension/health', {
                method: 'GET',
                headers: {
                    'X-Extension-Version': '1.0.0',
                    'X-Client-Info': 'chrome-extension',
                    'User-Agent': 'ResearchVault-Extension/1.0.0'
                },
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            const isOnline = response.ok;
            this.updateConnectionStatus(isOnline ? 'online' : 'offline');
            return isOnline;
        } catch (error) {
            // ネットワークエラーは正常な動作として扱う（オフライン状態）
            this.updateConnectionStatus('offline');
            return false;
        }
    }

    // 分かりやすいエラーメッセージ取得
    handleError(error) {
        if (!error) return '不明なエラーが発生しました';
        
        // ネットワークエラーの場合
        if (error.message && error.message.includes('fetch')) {
            return 'ネットワーク接続を確認してください';
        }
        
        // タイムアウトエラーの場合
        if (error.name === 'AbortError') {
            return 'リクエストがタイムアウトしました';
        }
        
        // その他のエラー
        return error.message || '不明なエラーが発生しました';
    }

    /**
     * 健康状態のチェック（詳細）
     */
    async getHealthStatus() {
        try {
            const response = await fetch('https://research-vault-eight.vercel.app/api/extension/health', {
                method: 'GET',
                headers: {
                    'X-Extension-Version': '1.0.0',
                    'X-Client-Info': 'chrome-extension',
                    'User-Agent': 'ResearchVault-Extension/1.0.0'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                return {
                    api: true,
                    database: data.database ?? false,
                    timestamp: new Date().toISOString()
                };
            } else {
                let errorMessage = '';
                switch (response.status) {
                    case 401:
                        errorMessage = '認証が必要です';
                        break;
                    case 403:
                        errorMessage = 'アクセスが拒否されました';
                        break;
                    case 404:
                        errorMessage = 'ヘルスチェックサービスが見つかりません';
                        break;
                    case 500:
                        errorMessage = 'サーバーエラーが発生しました';
                        break;
                    default:
                        errorMessage = `ヘルスチェックに失敗しました (エラーコード: ${response.status})`;
                }
                
                return {
                    api: false,
                    database: false,
                    timestamp: new Date().toISOString(),
                    error: errorMessage
                };
            }
        } catch (error) {
            return {
                api: false,
                database: false,
                timestamp: new Date().toISOString(),
                error: error.message || 'Health check failed'
            };
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
