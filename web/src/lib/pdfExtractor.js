/**
 * PDF抽出ユーティリティ
 * Gemini APIを使用してPDFから参照情報を抽出
 * （pdf.jsのworker問題を回避するため、Gemini APIに直接PDFを送信）
 */

/**
 * PDFをダウンロードしてBase64エンコード
 * @param {string} url - PDFのURL
 * @returns {Promise<string>} Base64エンコードされたPDFデータ
 */
async function downloadPDFAsBase64(url) {
  console.log('Downloading PDF from:', url)
  
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download PDF: ${response.status}`)
  }
  
  const arrayBuffer = await response.arrayBuffer()
  const uint8Array = new Uint8Array(arrayBuffer)
  
  // Base64エンコード
  const base64 = btoa(
    Array.from(uint8Array)
      .map(byte => String.fromCharCode(byte))
      .join('')
  )
  
  console.log(`PDF downloaded and encoded: ${Math.round(base64.length / 1024)} KB`)
  return base64
}

/**
 * Gemini APIレスポンスからテキストを安全に抽出
 * @param {Object} data - APIレスポンス
 * @returns {string|null} 抽出されたテキスト、またはnull
 */
function extractTextFromGeminiResponse(data) {
  if (!data) {
    console.error('Gemini API response is null or undefined')
    return null
  }
  
  // エラーレスポンスをチェック
  if (data.error) {
    console.error('Gemini API returned error:', data.error)
    return null
  }
  
  if (!data.candidates || !Array.isArray(data.candidates) || data.candidates.length === 0) {
    console.error('Gemini API response has no candidates:', JSON.stringify(data).substring(0, 500))
    return null
  }
  
  const candidate = data.candidates[0]
  
  // finishReasonをチェック
  if (candidate.finishReason && candidate.finishReason !== 'STOP') {
    console.warn('Gemini API candidate has unexpected finishReason:', candidate.finishReason)
  }
  
  if (!candidate.content || !candidate.content.parts || !Array.isArray(candidate.content.parts) || candidate.content.parts.length === 0) {
    console.error('Gemini API response has invalid structure:', JSON.stringify(candidate).substring(0, 500))
    return null
  }
  
  const text = candidate.content.parts[0]?.text
  if (!text) {
    console.error('Gemini API response has no text in parts')
    return null
  }
  
  return text
}

/**
 * GeminiでPDFを直接読み取り
 * @param {string} base64Data - Base64エンコードされたPDFデータ
 * @param {string} apiKey - Gemini APIキー
 * @returns {Promise<Object>} 抽出された情報
 */
async function extractWithGemini(base64Data, apiKey) {
  console.log('Sending PDF to Gemini API for extraction...')
  
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: `このPDF文書から学術的な参照情報を抽出してください。以下の情報をJSON形式で返してください：

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
- description: 要約または説明（200文字程度）

注意事項:
- 著者情報が見つからない場合は空配列[]を返してください
- 日付は正確に抽出し、不明な場合は空文字列を返してください
- すべてのフィールドは文字列または配列として返してください
- JSONのみを返し、他の説明文は含めないでください`
        }, {
          inline_data: {
            mime_type: 'application/pdf',
            data: base64Data
          }
        }]
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 2048
      }
    })
  })
  
  if (!response.ok) {
    const errorBody = await response.text().catch(() => '')
    console.error('Gemini API HTTP error:', response.status, errorBody.substring(0, 500))
    throw new Error(`Gemini API error: ${response.status}`)
  }
  
  const data = await response.json()
  const text = extractTextFromGeminiResponse(data)
  
  if (!text) {
    throw new Error('No text in Gemini response')
  }
  
  console.log('Gemini response received, parsing JSON...')
  
  // JSONを抽出
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    console.error('No JSON found in response:', text.substring(0, 500))
    throw new Error('No JSON found in response')
  }
  
  try {
    return JSON.parse(jsonMatch[0])
  } catch (parseError) {
    console.error('JSON parse error:', parseError, 'Raw text:', jsonMatch[0].substring(0, 500))
    throw new Error('Failed to parse JSON from response')
  }
}

/**
 * URLからサイト名を抽出（著者情報がない場合のフォールバック）
 */
function extractSiteNameFromUrl(url) {
  try {
    const urlObj = new URL(url)
    const domain = urlObj.hostname.toLowerCase()
    
    // 既知のサイト名マッピング
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
    }
    
    // 完全一致をチェック
    if (siteNameMap[domain]) {
      return siteNameMap[domain]
    }
    
    // 部分一致をチェック
    for (const [key, value] of Object.entries(siteNameMap)) {
      if (domain.includes(key)) {
        return value
      }
    }
    
    // ドメインから推測
    const parts = domain.split('.')
    if (parts.length >= 2) {
      const mainDomain = parts[parts.length - 2]
      
      // 一般的なTLDを除外
      const commonTlds = ['com', 'org', 'net', 'edu', 'gov', 'co', 'jp', 'uk', 'de', 'fr', 'it', 'es', 'ca', 'au', 'nz', 'go', 'ac', 'or']
      if (!commonTlds.includes(mainDomain)) {
        return mainDomain.charAt(0).toUpperCase() + mainDomain.slice(1)
      }
      
      // サブドメインがある場合はそれを使用
      if (parts.length >= 3) {
        const subdomain = parts[parts.length - 3]
        if (!commonTlds.includes(subdomain)) {
          return subdomain.charAt(0).toUpperCase() + subdomain.slice(1)
        }
      }
    }
    
    // 最後の手段：ドメイン名をそのまま使用
    return domain.charAt(0).toUpperCase() + domain.slice(1)
  } catch {
    return 'Unknown Site'
  }
}

/**
 * PDFから参照情報を自動抽出（メイン関数）
 * @param {string} url - PDFのURL
 * @param {string} apiKey - Gemini APIキー
 * @param {function} onProgress - 進捗コールバック
 */
export async function extractReferenceFromPDF(url, apiKey, onProgress = null) {
  if (!apiKey) {
    throw new Error('Gemini APIキーが設定されていません')
  }
  
  try {
    if (onProgress) {
      onProgress({ status: 'downloading', progress: 0 })
    }
    
    // PDFをダウンロードしてBase64エンコード
    const base64Data = await downloadPDFAsBase64(url)
    
    if (onProgress) {
      onProgress({ status: 'processing', progress: 0.3 })
    }
    
    // Gemini APIでPDFを直接分析
    console.log('Extracting reference information with Gemini API...')
    const result = await extractWithGemini(base64Data, apiKey)
    
    if (result && result.title && result.title.trim() !== '') {
      // 著者情報がない場合はサイト名を使用
      if (!result.authors || result.authors.length === 0) {
        const siteName = extractSiteNameFromUrl(url)
        console.log(`No authors found, using site name: ${siteName}`)
        result.authors = [{ name: siteName, order: 1 }]
        result.isSiteAuthor = true
      }
      
      console.log('Successfully extracted reference information')
      if (onProgress) {
        onProgress({ status: 'complete', progress: 1 })
      }
      return { ...result, extractionMethod: 'gemini-direct' }
    }
    
    throw new Error('Gemini APIからの抽出結果が不十分です')
  } catch (error) {
    console.error('PDF extraction failed:', error)
    if (onProgress) {
      onProgress({ status: 'error', error: error.message })
    }
    throw error
  }
}
