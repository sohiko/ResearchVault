確かに、高度な学術文献や英語文献、PDFファイルを扱う場合は、AIを積極的に活用した方が効果的です。以下、PDFタイトル抽出とAI分類を組み合わせたシステムを提案します。

## 1. PDFタイトル抽出システム

```jsx
class PDFAnalyzer {
  constructor() {
    this.pdfjs = null;
    this.loadPDFJS();
  }
  
  async loadPDFJS() {
    // PDF.jsのロード
    if (typeof pdfjsLib !== 'undefined') {
      this.pdfjs = pdfjsLib;
      this.pdfjs.GlobalWorkerOptions.workerSrc = 
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
  }
  
  async extractPDFMetadata(url) {
    try {
      // PDFをロード
      const loadingTask = this.pdfjs.getDocument({
        url: url,
        withCredentials: false,
        disableAutoFetch: false,
        disableStream: false
      });
      
      const pdf = await loadingTask.promise;
      const metadata = await pdf.getMetadata();
      
      // メタデータからタイトルを取得
      let title = null;
      if (metadata.info && metadata.info.Title) {
        title = metadata.info.Title;
      }
      
      // メタデータにタイトルがない場合、最初のページから抽出
      if (!title || title.trim() === '') {
        title = await this.extractTitleFromFirstPage(pdf);
      }
      
      // その他の有用な情報も取得
      const info = {
        title: title,
        author: metadata.info?.Author || null,
        subject: metadata.info?.Subject || null,
        keywords: metadata.info?.Keywords || null,
        creator: metadata.info?.Creator || null,
        producer: metadata.info?.Producer || null,
        creationDate: metadata.info?.CreationDate || null,
        pageCount: pdf.numPages,
        language: await this.detectLanguage(pdf)
      };
      
      return info;
    } catch (error) {
      console.error('PDF analysis failed:', error);
      return null;
    }
  }
  
  async extractTitleFromFirstPage(pdf) {
    try {
      const page = await pdf.getPage(1);
      const textContent = await page.getTextContent();
      
      // テキストアイテムを抽出
      const items = textContent.items;
      if (!items || items.length === 0) return null;
      
      // フォントサイズでソート（タイトルは通常大きい）
      const sortedItems = items.sort((a, b) => {
        const sizeA = a.transform ? Math.abs(a.transform[0]) : 0;
        const sizeB = b.transform ? Math.abs(b.transform[0]) : 0;
        return sizeB - sizeA;
      });
      
      // 上位のテキストからタイトル候補を抽出
      const titleCandidates = [];
      const largestFontSize = Math.abs(sortedItems[0].transform[0]);
      
      for (const item of sortedItems) {
        const fontSize = item.transform ? Math.abs(item.transform[0]) : 0;
        
        // 最大フォントサイズの80%以上のものをタイトル候補とする
        if (fontSize >= largestFontSize * 0.8) {
          titleCandidates.push({
            text: item.str,
            y: item.transform ? item.transform[5] : 0,
            fontSize: fontSize
          });
        }
      }
      
      // Y座標でソート（ページ上部にあるものを優先）
      titleCandidates.sort((a, b) => b.y - a.y);
      
      // 上部のテキストを結合してタイトルとする
      const title = titleCandidates
        .slice(0, 3)
        .map(item => item.text)
        .join(' ')
        .trim();
      
      return title || null;
    } catch (error) {
      console.error('Title extraction from page failed:', error);
      return null;
    }
  }
  
  async detectLanguage(pdf) {
    try {
      const page = await pdf.getPage(1);
      const textContent = await page.getTextContent();
      const text = textContent.items.map(item => item.str).join(' ');
      
      // 簡易的な言語検出
      const japanesePattern = /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/;
      const hasJapanese = japanesePattern.test(text);
      
      return hasJapanese ? 'ja' : 'en';
    } catch (error) {
      return 'unknown';
    }
  }
}
```

## 2. 高度なAI分類システム（Gemini API活用）

```jsx
class AcademicAIClassifier {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.cache = new Map();
    
    // IB科目に対応した高度な分類
    this.ibSubjects = {
      // Group 1: 言語と文学
      'Language_A': ['Literature', 'Language and Literature'],
      
      // Group 2: 言語習得
      'Language_B': ['Second Language', 'Foreign Language'],
      
      // Group 3: 個人と社会
      'History': ['World History', 'Regional History'],
      'Geography': ['Physical Geography', 'Human Geography'],
      'Economics': ['Microeconomics', 'Macroeconomics'],
      'Psychology': ['Cognitive', 'Behavioral'],
      
      // Group 4: 科学
      'Physics': ['Mechanics', 'Quantum', 'Thermodynamics'],
      'Chemistry': ['Organic', 'Inorganic', 'Physical Chemistry'],
      'Biology': ['Molecular', 'Ecology', 'Genetics'],
      
      // Group 5: 数学
      'Mathematics': ['Analysis', 'Applications', 'Statistics'],
      
      // Group 6: 芸術
      'Arts': ['Visual Arts', 'Music', 'Theatre']
    };
  }
  
  async classifyDocument(document) {
    const { url, title, pdfInfo, content } = document;
    
    // キャッシュチェック
    const cacheKey = `${url}_${title}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }
    
    // AI分類用のプロンプト作成
    const prompt = this.createClassificationPrompt(document);
    
    try {
      const result = await this.callGeminiAPI(prompt);
      const classification = this.parseClassificationResult(result);
      
      // キャッシュに保存
      this.cache.set(cacheKey, classification);
      
      return classification;
    } catch (error) {
      console.error('AI classification failed:', error);
      // フォールバック
      return this.fallbackClassification(document);
    }
  }
  
  createClassificationPrompt(document) {
    const { title, pdfInfo, url, excerpt } = document;
    
    return `
Classify this academic document into appropriate subjects for IB (International Baccalaureate) students.

Document Information:
- Title: ${title || 'Unknown'}
- URL: ${url}
- Author: ${pdfInfo?.author || 'Unknown'}
- Keywords: ${pdfInfo?.keywords || 'None'}
- Language: ${pdfInfo?.language || 'Unknown'}
- Page Count: ${pdfInfo?.pageCount || 'Unknown'}
- Excerpt: ${excerpt ? excerpt.substring(0, 500) : 'Not available'}

Please classify into:
1. Primary Subject (from: 国語, 数学, 歴史, 物理, 化学, 生物, 地理, 英語, 音楽, 美術, 技術, 家庭科, その他)
2. IB Group (1-6)
3. Academic Level (Introductory, Intermediate, Advanced, Research)
4. Document Type (Textbook, Research Paper, Review Article, Technical Report, Thesis, Other)
5. Key Topics (up to 5)
6. Relevance Score for IB students (0-100)

Format your response as JSON:
{
  "primary_subject": "",
  "secondary_subject": "",
  "ib_group": "",
  "academic_level": "",
  "document_type": "",
  "key_topics": [],
  "relevance_score": 0,
  "reasoning": ""
}`;
  }
  
  async callGeminiAPI(prompt) {
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${this.apiKey}`;
    
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.2,
          topK: 1,
          topP: 1,
          maxOutputTokens: 1024,
        }
      })
    });
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  }
  
  parseClassificationResult(aiResponse) {
    try {
      // JSONを抽出（AIの応答に説明文が含まれる場合があるため）
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      
      const result = JSON.parse(jsonMatch[0]);
      
      // 日本語の教科名にマッピング
      const subjectMap = {
        'japanese': '国語',
        'mathematics': '数学',
        'history': '歴史',
        'physics': '物理',
        'chemistry': '化学',
        'biology': '生物',
        'geography': '地理',
        'english': '英語',
        'music': '音楽',
        'art': '美術',
        'technology': '技術',
        'home_economics': '家庭科',
        'other': 'その他'
      };
      
      // 英語の応答を日本語に変換
      if (result.primary_subject && subjectMap[result.primary_subject.toLowerCase()]) {
        result.primary_subject = subjectMap[result.primary_subject.toLowerCase()];
      }
      
      return {
        ...result,
        confidence: result.relevance_score / 100,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      return null;
    }
  }
  
  fallbackClassification(document) {
    // AI分類が失敗した場合の簡易分類
    const { title = '', url = '' } = document;
    const titleLower = title.toLowerCase();
    
    // 基本的なパターンマッチング
    if (/math|algebra|calculus|geometry/i.test(titleLower)) {
      return { primary_subject: '数学', confidence: 0.6 };
    }
    if (/physics|mechanics|quantum/i.test(titleLower)) {
      return { primary_subject: '物理', confidence: 0.6 };
    }
    if (/chemistry|chemical|molecule/i.test(titleLower)) {
      return { primary_subject: '化学', confidence: 0.6 };
    }
    if (/biology|biological|cell|dna/i.test(titleLower)) {
      return { primary_subject: '生物', confidence: 0.6 };
    }
    
    return { primary_subject: 'その他', confidence: 0.3 };
  }
}
```

## 3. 統合実装

```jsx
// Chrome拡張機能での実装
class EnhancedReferenceExtractor {
  constructor(geminiApiKey) {
    this.pdfAnalyzer = new PDFAnalyzer();
    this.aiClassifier = new AcademicAIClassifier(geminiApiKey);
    this.batchQueue = [];
    this.processing = false;
  }
  
  async processHistoryItem(historyItem) {
    const { url, title } = historyItem;
    
    let documentInfo = {
      url,
      title,
      originalTitle: title,
      isPDF: false,
      pdfInfo: null
    };
    
    // PDFファイルの場合
    if (url.endsWith('.pdf') || url.includes('/pdf/')) {
      documentInfo.isPDF = true;
      
      // PDFメタデータを抽出
      const pdfInfo = await this.pdfAnalyzer.extractPDFMetadata(url);
      
      if (pdfInfo) {
        documentInfo.pdfInfo = pdfInfo;
        // PDFから抽出したタイトルを優先
        documentInfo.title = pdfInfo.title || title;
        documentInfo.author = pdfInfo.author;
        documentInfo.pageCount = pdfInfo.pageCount;
        documentInfo.language = pdfInfo.language;
      }
    }
    
    // AI分類を実行
    const classification = await this.aiClassifier.classifyDocument(documentInfo);
    
    return {
      ...historyItem,
      ...documentInfo,
      classification,
      processedAt: new Date().toISOString()
    };
  }
  
  async processBatch(historyItems) {
    const results = [];
    const BATCH_SIZE = 5; // Gemini APIのレート制限を考慮
    
    for (let i = 0; i < historyItems.length; i += BATCH_SIZE) {
      const batch = historyItems.slice(i, i + BATCH_SIZE);
      
      // 並列処理
      const batchResults = await Promise.all(
        batch.map(item => this.processHistoryItem(item))
      );
      
      results.push(...batchResults);
      
      // レート制限対策
      if (i + BATCH_SIZE < historyItems.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      // 進捗をUIに通知
      this.notifyProgress({
        processed: i + batch.length,
        total: historyItems.length
      });
    }
    
    return results;
  }
  
  notifyProgress(progress) {
    // Chrome拡張機能のメッセージング
    chrome.runtime.sendMessage({
      type: 'CLASSIFICATION_PROGRESS',
      data: progress
    });
  }
}
```

## 4. React UIコンポーネント

```jsx
const AdvancedReferenceManager = () => {
  const [references, setReferences] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ processed: 0, total: 0 });
  const [filters, setFilters] = useState({
    subject: null,
    documentType: null,
    language: null,
    academicLevel: null,
    dateRange: 30
  });
  
  const processReferences = async () => {
    setProcessing(true);
    
    try {
      // Chrome履歴を取得
      const history = await getRecentHistory(filters.dateRange);
      
      // AI分類を含む処理
      const extractor = new EnhancedReferenceExtractor(GEMINI_API_KEY);
      const processed = await extractor.processBatch(history);
      
      setReferences(processed);
      
      // データベースに保存
      await saveReferences(processed);
    } catch (error) {
      console.error('Processing failed:', error);
    } finally {
      setProcessing(false);
    }
  };
  
  const filteredReferences = references.filter(ref => {
    if (filters.subject && ref.classification?.primary_subject !== filters.subject) {
      return false;
    }
    if (filters.documentType && ref.classification?.document_type !== filters.documentType) {
      return false;
    }
    if (filters.language && ref.pdfInfo?.language !== filters.language) {
      return false;
    }
    if (filters.academicLevel && ref.classification?.academic_level !== filters.academicLevel) {
      return false;
    }
    return true;
  });
  
  return (
    <div className="advanced-reference-manager">
      <div className="header">
        <h2>学術文献管理システム</h2>
        <button 
          onClick={processReferences}
          disabled={processing}
          className="process-button"
        >
          {processing ? '処理中...' : '文献を分析'}
        </button>
      </div>
      
      {processing && (
        <div className="progress-bar">
          <div className="progress-info">
            処理中: {progress.processed} / {progress.total}
          </div>
          <div className="progress-fill" 
               style={{ width: `${(progress.processed / progress.total) * 100}%` }} />
        </div>
      )}
      
      <div className="filters">
        <select 
          value={filters.subject || ''}
          onChange={e => setFilters({...filters, subject: e.target.value || null})}
        >
          <option value="">すべての教科</option>
          <option value="数学">数学</option>
          <option value="物理">物理</option>
          <option value="化学">化学</option>
          <option value="生物">生物</option>
          {/* 他の教科オプション */}
        </select>
        
        <select 
          value={filters.documentType || ''}
          onChange={e => setFilters({...filters, documentType: e.target.value || null})}
        >
          <option value="">すべての文書タイプ</option>
          <option value="Research Paper">研究論文</option>
          <option value="Textbook">教科書</option>
          <option value="Review Article">レビュー論文</option>
          <option value="Technical Report">技術報告書</option>
        </select>
        
        <select 
          value={filters.language || ''}
          onChange={e => setFilters({...filters, language: e.target.value || null})}
        >
          <option value="">すべての言語</option>
          <option value="en">英語</option>
          <option value="ja">日本語</option>
        </select>
      </div>
      
      <div className="reference-grid">
        {filteredReferences.map(ref => (
          <ReferenceCard key={ref.url} reference={ref} />
        ))}
      </div>
    </div>
  );
};

const ReferenceCard = ({ reference }) => {
  const { title, url, isPDF, pdfInfo, classification } = reference;
  
  return (
    <div className="reference-card enhanced">
      <div className="card-header">
        {isPDF && <span className="pdf-badge">PDF</span>}
        {pdfInfo?.language && (
          <span className="language-badge">{pdfInfo.language.toUpperCase()}</span>
        )}
      </div>
      
      <h3 className="title">{title}</h3>
      
      {pdfInfo?.author && (
        <p className="author">著者: {pdfInfo.author}</p>
      )}
      
      {pdfInfo?.pageCount && (
        <p className="pages">{pdfInfo.pageCount} ページ</p>
      )}
      
      {classification && (
        <div className="classification">
          <div className="subject-tags">
            <span className="primary-subject">{classification.primary_subject}</span>
            {classification.secondary_subject && (
              <span className="secondary-subject">{classification.secondary_subject}</span>
            )}
          </div>
          
          <div className="classification-details">
            <span className="academic-level">{classification.academic_level}</span>
            <span className="document-type">{classification.document_type}</span>
            <span className="relevance">
              関連度: {classification.relevance_score}%
            </span>
          </div>
          
          {classification.key_topics && (
            <div className="topics">
              {classification.key_topics.map((topic, i) => (
                <span key={i} className="topic-tag">{topic}</span>
              ))}
            </div>
          )}
        </div>
      )}
      
      <a href={url} target="_blank" rel="noopener noreferrer" className="view-link">
        文献を表示
      </a>
    </div>
  );
};
```

## 主な機能

1. **PDF解析**
   - メタデータからタイトル・著者情報を自動抽出
   - 最初のページからタイトルを推定
   - 言語自動検出

2. **高度なAI分類**
   - IB科目に対応した詳細な分類
   - 学術レベルの判定
   - 文書タイプの識別
   - 関連キーワードの抽出

3. **多言語対応**
   - 英語・日本語の文献を適切に処理
   - 言語別のフィルタリング

4. **効率的な処理**
   - バッチ処理でAPI呼び出しを最適化
   - キャッシング機能
   - 進捗表示

この実装により、IB生が扱うような高度な学術文献を効率的に管理・分類できるようになります。

