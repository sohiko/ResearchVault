// ResearchVault API Client for Chrome Extension

import { extensionErrorHandler, handleExtensionError, withExtensionRetry } from './errorHandler.js'

export class API {
    constructor() {
        // 本番環境とローカル環境を自動判定
        this.baseURL = window.location.hostname === 'localhost' 
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
        this.checkConnection();
    }

    async initSupabase() {
        try {
            // Supabaseクライアントの初期化
            // 本来はSupabaseのJSクライアントを使用するが、拡張機能では簡単なfetch APIを使用
            console.log('Supabase client initialized');
            
            // 接続テスト
            await this.checkConnection()
        } catch (error) {
            await handleExtensionError(error, {
                method: 'initSupabase',
                component: 'API'
            })
        }
    }

    async setAuthToken(token) {
        this.authToken = token;
    }

    async request(endpoint, options = {}) {
        const requestContext = {
            method: 'request',
            endpoint,
            component: 'API',
            options: { ...options, headers: undefined } // ヘッダーは機密情報を含む可能性があるため除外
        }

        return await withExtensionRetry(async () => {
            const url = `${this.baseURL}${endpoint}`;
            const config = {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Client-Info': 'researchvault-extension@1.0.0',
                    ...options.headers
                },
                timeout: options.timeout || 10000, // 10秒タイムアウト
                ...options
            };

            if (this.authToken) {
                config.headers['Authorization'] = `Bearer ${this.authToken}`;
            }

            try {
                // AbortController for timeout
                const controller = new AbortController()
                const timeoutId = setTimeout(() => controller.abort(), config.timeout)
                config.signal = controller.signal

                const response = await fetch(url, config);
                clearTimeout(timeoutId)
                
                // レスポンスの検証
                if (!response.ok) {
                    const errorData = await this.safeJsonParse(response)
                    const errorMessage = errorData?.error?.message || 
                                       errorData?.message || 
                                       `HTTP ${response.status}: ${response.statusText}`
                    
                    const error = new Error(errorMessage)
                    error.status = response.status
                    error.response = response
                    throw error
                }
                
                const data = await this.safeJsonParse(response)
                
                // 接続状態を更新
                this.updateConnectionStatus('online')
                
                return { success: true, data };
            } catch (error) {
                await this.handleRequestError(error, requestContext)
                throw error
            }
        }, this.retryConfig).catch(async (error) => {
            const errorDetails = await handleExtensionError(error, requestContext)
            return { 
                success: false, 
                error: extensionErrorHandler.getUserMessage(error),
                details: errorDetails
            }
        })
    }

    /**
     * 安全なJSON解析
     */
    async safeJsonParse(response) {
        try {
            return await response.json()
        } catch (parseError) {
            console.warn('Failed to parse response as JSON:', parseError)
            return { message: await response.text() }
        }
    }

    /**
     * リクエストエラーの処理
     */
    async handleRequestError(error, context) {
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

        // エラーをログに記録
        await handleExtensionError(error, context)
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
            await handleExtensionError(error, {
                method: 'login',
                component: 'API',
                email: email // パスワードは記録しない
            })
            return { 
                success: false, 
                error: extensionErrorHandler.getUserMessage(error)
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
            const response = await fetch(`${this.baseURL}/health`, {
                method: 'GET',
                timeout: 5000,
                signal: AbortSignal.timeout(5000)
            });
            
            const isOnline = response.ok
            this.updateConnectionStatus(isOnline ? 'online' : 'offline')
            return isOnline
        } catch (error) {
            await handleExtensionError(error, {
                method: 'checkConnection',
                component: 'API'
            })
            this.updateConnectionStatus('offline')
            return false;
        }
    }

    // 非推奨メソッド - 統一エラーハンドラーを使用してください
    handleError(error) {
        console.warn('handleError is deprecated. Use extensionErrorHandler instead.')
        return extensionErrorHandler.getUserMessage(error)
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
                error: extensionErrorHandler.getUserMessage(error)
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
            await handleExtensionError(error, {
                method: 'attemptReconnection',
                component: 'API'
            })
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
                await handleExtensionError(error, {
                    method: 'processRequestQueue',
                    component: 'API'
                })
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
