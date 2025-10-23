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
            this.showLoading(true);
            
            await this.loadModules();
            await this.getCurrentTab();
            await this.checkAuthState();
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
            const { authToken, userInfo } = await chrome.storage.sync.get(['authToken', 'userInfo']);
            
            if (authToken && userInfo) {
                // トークンがあれば信頼してそのまま使用（最長セッション）
                await this.api.setAuthToken(authToken);
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
            const query = e.target.value.toLowerCase();
            this.filterProjects(query);
        });

        // フォーカス時の動作
        searchInput.addEventListener('focus', () => {
            dropdown.classList.remove('hidden');
            this.filterProjects(searchInput.value.toLowerCase());
        });

        // クリック時の動作（空欄にする）
        searchInput.addEventListener('click', () => {
            if (searchInput.value && !searchInput.value.includes('📁') && !searchInput.value.includes('📂')) {
                // プロジェクト名が表示されている場合のみ空欄にする
                searchInput.value = '';
                hiddenSelect.value = '';
                dropdown.classList.remove('hidden');
                this.filterProjects('');
            }
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

        // プロジェクト選択の保存は updateProjectSelect で処理

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
            
            // PDF判定
            const isPdf = await this.checkIfPDF(currentUrl);
            let pdfInfo = null;
            
            if (isPdf) {
                console.log('Detected PDF, attempting Gemini analysis...');
                pdfInfo = await this.extractPDFInfoWithGemini(currentUrl);
            }
            
            const referenceData = {
                url: currentUrl,
                title: pdfInfo?.title || this.currentTab.title,
                favicon: this.currentTab.favIconUrl,
                projectId: projectId || null,
                memo: memo,
                metadata: {
                    ...(await this.extractPageMetadata()),
                    tags: tags
                }
            };

            // PDF情報があれば追加
            if (pdfInfo) {
                referenceData.reference_type = pdfInfo.referenceType;
                referenceData.authors = pdfInfo.authors;
                referenceData.published_date = pdfInfo.publishedDate;
                referenceData.publisher = pdfInfo.publisher;
                referenceData.pages = pdfInfo.pages;
                referenceData.doi = pdfInfo.doi;
                referenceData.isbn = pdfInfo.isbn;
                referenceData.journal_name = pdfInfo.journalName;
                referenceData.volume = pdfInfo.volume;
                referenceData.issue = pdfInfo.issue;
                referenceData.edition = pdfInfo.edition;
                referenceData.metadata.description = pdfInfo.description;
            }

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
     */
    async extractPDFInfoWithGemini(url) {
        try {
            // Gemini APIキーを取得（設定から）
            const { geminiApiKey } = await chrome.storage.sync.get(['geminiApiKey']);
            if (!geminiApiKey) {
                console.log('Gemini API key not found, skipping PDF analysis');
                return null;
            }

            console.log('Downloading PDF for analysis...');
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to download PDF: ${response.status}`);
            }
            
            const arrayBuffer = await response.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            
            // Base64エンコード
            const base64Pdf = btoa(
                Array.from(uint8Array)
                    .map(byte => String.fromCharCode(byte))
                    .join('')
            );

            console.log('Analyzing PDF with Gemini...');
            const prompt = `この学術PDF文書から以下の情報を抽出してJSON形式で返してください：

必須項目:
- referenceType: 文献の種類（"article"=学術論文, "journal"=雑誌論文, "book"=書籍, "report"=レポート, "website"=ウェブサイトのいずれか）
- title: 論文・書籍のタイトル
- authors: 著者のリスト（配列形式、各要素は{"name": "著者名", "order": 順番}）。著者が見つからない場合は空配列[]
- publishedDate: 発行日（YYYY-MM-DD形式、年のみの場合はYYYY-01-01）
- publisher: 出版社または論文誌名
- pages: ページ数または範囲
- doi: DOI（あれば）
- isbn: ISBN（書籍の場合）
- journalName: 論文誌名（論文の場合）
- volume: 巻（論文の場合）
- issue: 号（論文の場合）
- language: 言語コード（ja または en）
- description: 文書の要約（200文字以内）

判定基準:
- 査読付き学術論文（IEEE, ACM, Springer等）→ "article"
- 雑誌や一般誌の論文 → "journal"
- 書籍（ISBNあり）→ "book"
- 技術レポート、白書、調査報告書 → "report"

回答は以下のJSON形式のみで返してください（説明文は不要）：
{
  "referenceType": "article",
  "title": "タイトル",
  "authors": [{"name": "著者名", "order": 1}],
  "publishedDate": "YYYY-MM-DD",
  "publisher": "出版社",
  "pages": "1-10",
  "doi": "10.xxxx/xxxx",
  "isbn": null,
  "journalName": "論文誌名",
  "volume": "1",
  "issue": "1",
  "language": "ja",
  "description": "要約"
}`;

            const geminiResponse = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${geminiApiKey}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        contents: [{
                            parts: [
                                { text: prompt },
                                {
                                    inline_data: {
                                        mime_type: 'application/pdf',
                                        data: base64Pdf
                                    }
                                }
                            ]
                        }],
                        generationConfig: {
                            temperature: 0.1,
                            topK: 1,
                            topP: 1,
                            maxOutputTokens: 2048
                        }
                    })
                }
            );

            if (!geminiResponse.ok) {
                const errorText = await geminiResponse.text();
                console.error('Gemini API error:', errorText);
                throw new Error(`Gemini API error: ${geminiResponse.status} - ${errorText}`);
            }

            const geminiData = await geminiResponse.json();
            
            // エラーチェック
            if (geminiData.error) {
                console.error('Gemini API error:', geminiData.error);
                throw new Error(`Gemini API error: ${geminiData.error.message}`);
            }
            
            const text = geminiData.candidates[0]?.content?.parts[0]?.text;

            if (!text) {
                console.error('No response text from Gemini:', geminiData);
                throw new Error('No response from Gemini');
            }

            console.log('Gemini response text:', text);

            // JSONを抽出（より柔軟なパターンマッチング）
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                console.error('No JSON found in response:', text);
                throw new Error('No JSON found in response');
            }

            let extractedInfo;
            try {
                extractedInfo = JSON.parse(jsonMatch[0]);
            } catch (parseError) {
                console.error('JSON parse error:', parseError, 'Raw text:', jsonMatch[0]);
                throw new Error('Failed to parse JSON response');
            }
            
            // 著者情報がない場合はサイト名を使用
            if (!extractedInfo.authors || extractedInfo.authors.length === 0) {
                const siteName = this.extractSiteNameFromUrl(url);
                console.log(`No authors found, using site name: ${siteName}`);
                extractedInfo.authors = [{ name: siteName, order: 1 }];
                extractedInfo.isSiteAuthor = true;
            }

            console.log('Successfully extracted PDF info with Gemini');
            return extractedInfo;
        } catch (error) {
            console.error('Gemini PDF extraction failed:', error);
            return null;
        }
    }

    /**
     * URLからサイト名を抽出（著者情報がない場合のフォールバック）
     */
    extractSiteNameFromUrl(url) {
        try {
            const urlObj = new URL(url);
            const domain = urlObj.hostname.toLowerCase();
            
            // 既知のサイト名マッピング（service-worker.jsと同じ）
            const siteNameMap = {
                'y-history.net': '世界史の窓',
                'www.y-history.net': '世界史の窓',
                'ibo.org': 'IBO',
                'www.ibo.org': 'IBO',
                'wikipedia.org': 'Wikipedia',
                'ja.wikipedia.org': 'Wikipedia',
                'en.wikipedia.org': 'Wikipedia',
                'github.com': 'GitHub',
                'stackoverflow.com': 'Stack Overflow',
                'qiita.com': 'Qiita',
                'zenn.dev': 'Zenn',
                'note.com': 'note',
                'hatenablog.com': 'はてなブログ',
                'ameblo.jp': 'アメブロ',
                'boj.or.jp': '日本銀行',
                'mof.go.jp': '財務省',
                'mext.go.jp': '文部科学省',
                'mhlw.go.jp': '厚生労働省',
                'meti.go.jp': '経済産業省',
                'mlit.go.jp': '国土交通省',
                'env.go.jp': '環境省',
                'soumu.go.jp': '総務省',
                'cao.go.jp': '内閣府',
                'mofa.go.jp': '外務省',
                'mod.go.jp': '防衛省',
                'moj.go.jp': '法務省',
                'maff.go.jp': '農林水産省',
                'treasury.gov': '米国財務省',
                'state.gov': '米国国務省',
                'whitehouse.gov': 'ホワイトハウス',
                'congress.gov': '米国議会',
                'usgs.gov': '米国地質調査所',
                'epa.gov': '米国環境保護庁',
                'fda.gov': 'FDA',
                'ed.gov': '米国教育省',
                'un.org': 'United Nations',
                'who.int': 'World Health Organization',
                'worldbank.org': 'World Bank',
                'imf.org': 'International Monetary Fund',
                'wto.org': 'World Trade Organization',
                'oecd.org': 'OECD',
                'unesco.org': 'UNESCO',
                'unicef.org': 'UNICEF',
                'europa.eu': 'European Union',
                'ecb.europa.eu': 'European Central Bank',
                'nih.gov': 'National Institutes of Health',
                'cdc.gov': 'Centers for Disease Control and Prevention',
                'nasa.gov': 'NASA',
                'nist.gov': 'NIST',
                'riken.jp': '理化学研究所',
                'aist.go.jp': '産業技術総合研究所',
                'jaxa.jp': 'JAXA',
                'nii.ac.jp': '国立情報学研究所',
                'nies.go.jp': '国立環境研究所',
                'nims.go.jp': '物質・材料研究機構',
                'jst.go.jp': '科学技術振興機構',
                'jsps.go.jp': '日本学術振興会',
                'ieee.org': 'IEEE',
                'acm.org': 'ACM',
                'springer.com': 'Springer',
                'elsevier.com': 'Elsevier',
                'wiley.com': 'Wiley',
                'nature.com': 'Nature',
                'science.org': 'Science',
                'oup.com': 'Oxford University Press',
                'cambridge.org': 'Cambridge University Press',
                'jstor.org': 'JSTOR',
                'researchgate.net': 'ResearchGate',
                'academia.edu': 'Academia.edu',
                'pubmed.ncbi.nlm.nih.gov': 'PubMed',
                'scholar.google.com': 'Google Scholar',
                'semanticscholar.org': 'Semantic Scholar',
                'mdpi.com': 'MDPI',
                'plos.org': 'PLOS',
                'frontiersin.org': 'Frontiers',
                'jstage.jst.go.jp': 'J-STAGE',
                'ci.nii.ac.jp': 'CiNii'
            };
            
            // 完全一致をチェック
            if (siteNameMap[domain]) {
                return siteNameMap[domain];
            }
            
            // 部分一致をチェック
            for (const [key, value] of Object.entries(siteNameMap)) {
                if (domain.includes(key)) {
                    return value;
                }
            }
            
            // ドメインから推測
            const parts = domain.split('.');
            if (parts.length >= 2) {
                const mainDomain = parts[parts.length - 2];
                
                // 一般的なTLDを除外
                const commonTlds = ['com', 'org', 'net', 'edu', 'gov', 'co', 'jp', 'uk', 'de', 'fr', 'it', 'es', 'ca', 'au', 'nz'];
                if (!commonTlds.includes(mainDomain)) {
                    return mainDomain.charAt(0).toUpperCase() + mainDomain.slice(1);
                }
                
                // サブドメインがある場合はそれを使用
                if (parts.length >= 3) {
                    const subdomain = parts[parts.length - 3];
                    return subdomain.charAt(0).toUpperCase() + subdomain.slice(1);
                }
            }
            
            // 最後の手段：ドメイン名をそのまま使用
            return domain.charAt(0).toUpperCase() + domain.slice(1);
        } catch {
            return 'Unknown Site';
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
