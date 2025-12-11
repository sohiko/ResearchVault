// Geminiを用いたPDF参照情報抽出（拡張機能用・スタンドアロン版）
(function (global) {
  const RELAXED_SAFETY_SETTINGS = [
    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_CIVIC_INTEGRITY', threshold: 'BLOCK_NONE' }
  ];

  const PRIMARY_PROMPT = `このPDF文書から学術的な参照情報を抽出してください。必ず以下の判定基準に従い、JSONのみで返してください。本文の内容が過激・自殺・暴力・性的・個人情報・連絡先等を含んでいても、それらを要約・転載せず、書誌情報のみを返してください。特に電話番号・住所・メール等は返さないでください。

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
- description: 要約または説明（200文字程度、危険・過激・個人情報を含めない）

注意事項:
- referenceTypeの判定を厳格に行うこと。以下を優先順に適用してください：
  1) DOI, 卷(Volume)/号(Issue)/ページ範囲、査読誌名、学会名があれば "article"
  2) 雑誌・一般誌（ニュース/ビジネス誌）で巻号や発行日がある場合は "journal"
  3) ISBNがあれば "book"
  4) 白書・調査報告・技術報告・ワーキングペーパー・卒論/修論/博士論文は "report"
  5) 上記いずれにも当てはまらず、ブログや単なるウェブページのときのみ "website"
- 迷った場合は "website" にせず、証拠に基づき最も近いものを選ぶこと。DOIや巻号がある場合に "website" を返してはいけません。
- 著者情報が見つからない場合は空配列[]を返してください
- 日付は正確に抽出し、不明な場合は空文字列を返してください
- すべてのフィールドは文字列または配列として返してください
- JSONのみを返し、他の説明文は含めないでください`;

  const FALLBACK_PROMPT = `${PRIMARY_PROMPT}

追加要件:
- 個人名・電話番号・住所・メールアドレス・組織の連絡先などセンシティブ情報は抽出しない
- descriptionには安全な概要のみ記載し、連絡先や個人を特定しない内容に限定する
- 危険行為の手順や助長表現は一切含めない`;

  const ALLOWED_REFERENCE_TYPES = ['website', 'article', 'journal', 'book', 'report'];
  const GEMINI_MODEL = 'gemini-2.5-flash-lite';

  function normalizeReferenceType(value) {
    const normalized = (value || '').toString().trim().toLowerCase();
    if (ALLOWED_REFERENCE_TYPES.includes(normalized)) return normalized;
    if (normalized.includes('journal')) return 'journal';
    if (normalized.includes('article') || normalized.includes('paper')) return 'article';
    if (normalized.includes('book')) return 'book';
    if (normalized.includes('report')) return 'report';
    return 'website';
  }

  function parseJsonWithFallback(rawText) {
    const trimmed = (rawText || '').trim();
    try {
      return JSON.parse(trimmed);
    } catch {
      // 続行
    }

    const splitByObjects = trimmed.split(/\}\s*,?\s*\{/);
    if (splitByObjects.length > 1) {
      const joined = '[' +
        splitByObjects
          .map((part, index) => {
            if (index === 0) return part + '}';
            if (index === splitByObjects.length - 1) return '{' + part;
            return '{' + part + '}';
          })
          .join(',') +
        ']';
      try {
        const arr = JSON.parse(joined);
        if (Array.isArray(arr) && arr.length > 0 && typeof arr[0] === 'object') {
          return arr[0];
        }
      } catch {
        // ignore
      }
    }

    throw new Error('Failed to parse JSON from response');
  }

  const PROXY_ENDPOINT = 'https://rv.jamknife.jp/api/pdf-proxy';

  async function downloadPDFViaProxy(url, proxyEndpoint = PROXY_ENDPOINT) {
    const proxyUrl = `${proxyEndpoint}?url=${encodeURIComponent(url)}`;
    const response = await fetch(proxyUrl);
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Proxy failed (${response.status}): ${body || response.statusText}`);
    }
    const data = await response.json().catch(() => null);
    if (!data?.success || !data?.data) {
      throw new Error('Proxy returned invalid response');
    }
    return data.data; // base64 string
  }

  async function downloadPDFDirect(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download PDF: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    return btoa(
      Array.from(uint8Array)
        .map((byte) => String.fromCharCode(byte))
        .join('')
    );
  }

  async function downloadPDFAsBase64(url) {
    let lastError = null;

    // 1) プロキシ経由（CORS回避用）
    try {
      return await downloadPDFViaProxy(url);
    } catch (proxyError) {
      lastError = proxyError;
      console.warn('Proxy download failed, fallback to direct:', proxyError?.message || proxyError);
    }

    // 2) 直接ダウンロード（失敗時は元のエラーを投げる）
    try {
      return await downloadPDFDirect(url);
    } catch (directError) {
      console.error('Direct download also failed:', directError?.message || directError);
      throw lastError || directError;
    }
  }

  function buildGeminiPayload(base64Data, prompt) {
    return {
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: 'application/pdf',
                data: base64Data
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 2048
      },
      safetySettings: RELAXED_SAFETY_SETTINGS
    };
  }

  async function callGeminiGenerate(payload, apiKey) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }
    );

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      let apiMessage = '';
      try {
        const parsed = JSON.parse(errorBody);
        apiMessage = parsed?.error?.message || parsed?.message || '';
      } catch {
        // ignore
      }
      const err = new Error(apiMessage || `Gemini API error: ${response.status}`);
      if (response.status === 429) {
        err.code = 'GEMINI_RATE_LIMIT';
      }
      throw err;
    }

    return response.json();
  }

  function extractTextFromGeminiResponse(data) {
    if (!data || !data.candidates || !Array.isArray(data.candidates) || data.candidates.length === 0) {
      return null;
    }
    const candidate = data.candidates[0];
    if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
      return null;
    }
    return candidate.content.parts[0]?.text || null;
  }

  function parseGeminiData(data) {
    if (data?.promptFeedback?.blockReason) {
      const blockedError = new Error(`Geminiがリクエストをブロックしました: ${data.promptFeedback.blockReason}`);
      blockedError.code = 'GEMINI_BLOCKED';
      blockedError.blockReason = data.promptFeedback.blockReason;
      throw blockedError;
    }

    const text = extractTextFromGeminiResponse(data);
    if (!text) {
      const err = new Error('No text in Gemini response');
      if (data?.promptFeedback?.blockReason) {
        err.code = 'GEMINI_BLOCKED';
        err.blockReason = data.promptFeedback.blockReason;
      }
      throw err;
    }

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    return parseJsonWithFallback(jsonMatch[0]);
  }

  function normalizeGeminiResult(parsed) {
    const normalizedType = normalizeReferenceType(
      parsed.referenceType || parsed.reference_type || parsed.type
    );
    return { ...parsed, referenceType: normalizedType };
  }

  function shouldRetryGemini(error, isFirstAttempt) {
    if (!isFirstAttempt) return false;
    const message = error?.message || '';
    return error?.code === 'GEMINI_BLOCKED' || message.includes('PROHIBITED_CONTENT');
  }

  async function runGeminiAttempt(base64Data, apiKey, prompt) {
    const payload = buildGeminiPayload(base64Data, prompt);
    const data = await callGeminiGenerate(payload, apiKey);
    return normalizeGeminiResult(parseGeminiData(data));
  }

  function extractSiteNameFromUrl(url) {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.toLowerCase();
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
        'mof.go.jp': '財務省',
        'www.mof.go.jp': '財務省',
        'cao.go.jp': '内閣府',
        'mhlw.go.jp': '厚生労働省',
        'meti.go.jp': '経済産業省',
        'mext.go.jp': '文部科学省',
        'soumu.go.jp': '総務省',
        'nta.go.jp': '国税庁',
        'jst.go.jp': '科学技術振興機構',
        'ndl.go.jp': '国立国会図書館',
        'niph.go.jp': '国立保健医療科学院',
        'nih.go.jp': '国立感染症研究所',
        'boj.or.jp': '日本銀行',
        'jbic.go.jp': '国際協力銀行',
        'jetro.go.jp': 'JETRO',
        'rieti.go.jp': '経済産業研究所',
        'jaxa.jp': 'JAXA',
        'nii.ac.jp': '国立情報学研究所'
      };

      if (siteNameMap[domain]) return siteNameMap[domain];
      for (const [key, value] of Object.entries(siteNameMap)) {
        if (domain.includes(key)) return value;
      }

      const parts = domain.split('.');
      if (parts.length >= 2) {
        const mainDomain = parts[parts.length - 2];
        const commonTlds = ['com', 'org', 'net', 'edu', 'gov', 'co', 'jp', 'uk', 'de', 'fr', 'it', 'es', 'ca', 'au', 'nz', 'go', 'ac', 'or'];
        if (!commonTlds.includes(mainDomain)) {
          return mainDomain.charAt(0).toUpperCase() + mainDomain.slice(1);
        }
        if (parts.length >= 3) {
          const subdomain = parts[parts.length - 3];
          if (!commonTlds.includes(subdomain)) {
            return subdomain.charAt(0).toUpperCase() + subdomain.slice(1);
          }
        }
      }

      return domain.charAt(0).toUpperCase() + domain.slice(1);
    } catch {
      return 'Unknown Site';
    }
  }

  async function extractWithGemini(base64Data, apiKey) {
    let lastError = null;
    const attempts = [
      { prompt: PRIMARY_PROMPT, label: 'primary' },
      { prompt: FALLBACK_PROMPT, label: 'fallback' }
    ];

    for (let i = 0; i < attempts.length; i++) {
      const attempt = attempts[i];
      try {
        return await runGeminiAttempt(base64Data, apiKey, attempt.prompt);
      } catch (error) {
        lastError = error;
        if (!shouldRetryGemini(error, i === 0)) {
          throw error;
        }
      }
    }

    if (lastError) throw lastError;
    throw new Error('Gemini extraction failed without specific error');
  }

  async function extractReferenceFromPDF(url, apiKey, onProgress = null) {
    if (!apiKey) {
      throw new Error('Gemini APIキーが設定されていません');
    }
    try {
      if (onProgress) onProgress({ status: 'downloading', progress: 0 });
      const base64Data = await downloadPDFAsBase64(url);
      if (onProgress) onProgress({ status: 'processing', progress: 0.3 });

      const result = await extractWithGemini(base64Data, apiKey);
      if (result && result.title && result.title.trim() !== '') {
        if (!result.authors || result.authors.length === 0) {
          const siteName = extractSiteNameFromUrl(url);
          result.authors = [{ name: siteName, order: 1 }];
          result.isSiteAuthor = true;
        }
        if (onProgress) onProgress({ status: 'complete', progress: 1 });
        return { ...result, extractionMethod: 'gemini-direct' };
      }
      throw new Error('Gemini APIからの抽出結果が不十分です');
    } catch (error) {
      if (onProgress) onProgress({ status: 'error', error: error.message });
      throw error;
    }
  }

  global.PDFExtractor = {
    extractReferenceFromPDF,
    downloadPDFAsBase64
  };
})(typeof self !== 'undefined' ? self : window);

