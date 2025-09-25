// ResearchVault API Client for Chrome Extension

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
        
        this.initSupabase();
    }

    initSupabase() {
        // Supabaseクライアントの初期化
        // 本来はSupabaseのJSクライアントを使用するが、拡張機能では簡単なfetch APIを使用
        console.log('Supabase client initialized');
    }

    async setAuthToken(token) {
        this.authToken = token;
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        if (this.authToken) {
            config.headers['Authorization'] = `Bearer ${this.authToken}`;
        }

        try {
            const response = await fetch(url, config);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error?.message || 'API request failed');
            }
            
            return { success: true, data };
        } catch (error) {
            console.error('API request error:', error);
            return { success: false, error: error.message };
        }
    }

    // 認証関連
    async login(email, password) {
        try {
            const response = await this.request('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email, password })
            });

            if (response.success) {
                this.authToken = response.data.token;
                return {
                    success: true,
                    token: response.data.token,
                    user: response.data.user
                };
            }
            
            return response;
        } catch (error) {
            return { success: false, error: error.message };
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
            const response = await fetch(`${this.baseURL}/health`);
            return response.ok;
        } catch (error) {
            console.error('Connection check failed:', error);
            return false;
        }
    }

    // エラーハンドリング
    handleError(error) {
        console.error('API Error:', error);
        
        // よくあるエラーメッセージの日本語化
        const errorMessages = {
            'Unauthorized': '認証が必要です',
            'Forbidden': 'アクセス権限がありません',
            'Not Found': 'リソースが見つかりません',
            'Internal Server Error': 'サーバーエラーが発生しました',
            'Network Error': 'ネットワークエラーが発生しました'
        };

        return errorMessages[error.message] || error.message || '不明なエラーが発生しました';
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
