/**
 * PDF抽出ユーティリティ
 * Gemini API、pdf.js、Tesseract.jsを使用してPDFから参照情報を抽出
 */

// pdf.js workerのCDN URL（pdfjs-dist v5.x用）
// unpkgとjsdelivrの両方をフォールバックとして用意
const WORKER_CDN_URLS = [
  'https://unpkg.com/pdfjs-dist@5.4.296/build/pdf.worker.min.mjs',
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.296/build/pdf.worker.min.mjs'
]

let pdfjsLibInstance = null
let workerConfigured = false

/**
 * pdf.jsを読み込んでworkerを設定
 */
async function loadPdfJs() {
  if (pdfjsLibInstance && workerConfigured) {
    return pdfjsLibInstance
  }

  try {
    // pdf.jsをインポート
    const pdfjsLib = await import('pdfjs-dist')
    
    // workerを明示的にCDNから設定（インポート直後に設定）
    if (pdfjsLib.GlobalWorkerOptions && !workerConfigured) {
      // CDN URLを使用（Viteのインポートに依存しない）
      pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER_CDN_URLS[0]
      workerConfigured = true
      console.log('pdf.js worker configured:', pdfjsLib.GlobalWorkerOptions.workerSrc)
    }
    
    pdfjsLibInstance = pdfjsLib
    return pdfjsLib
  } catch (error) {
    console.error('Failed to load pdf.js:', error)
    throw error
  }
}

/**
 * PDFをダウンロード
 * @param {string} url - PDFのURL
 * @returns {Promise<ArrayBuffer>} PDFデータ
 */
async function downloadPDF(url) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download PDF: ${response.status}`)
  }
  return await response.arrayBuffer()
}

/**
 * pdf.jsを使用してテキストを抽出
 * @param {ArrayBuffer} pdfData - PDFデータ
 * @returns {Promise<string>} 抽出されたテキスト
 */
async function extractTextWithPdfJs(pdfData) {
  try {
    // ArrayBufferのdetached問題を回避するため、データをコピー
    const pdfDataCopy = pdfData.slice()
    
    // pdf.jsライブラリを動的に読み込み
    const pdfjsLib = await loadPdfJs()
    
    const pdf = await pdfjsLib.getDocument({ data: pdfDataCopy }).promise
    let fullText = ''
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const textContent = await page.getTextContent()
      const pageText = textContent.items.map(item => item.str).join(' ')
      fullText += pageText + '\n'
    }
    
    return fullText
  } catch (error) {
    console.error('pdf.js extraction failed:', error)
    return ''
  }
}

/**
 * Tesseract.jsを使用してOCRを実行
 * @param {ArrayBuffer} pdfData - PDFデータ
 * @returns {Promise<string>} OCRで抽出されたテキスト
 */
async function extractTextWithOCR(pdfData) {
  try {
    // ArrayBufferのdetached問題を回避するため、データをコピー
    const pdfDataCopy = pdfData.slice()
    
    // Tesseract.jsライブラリを動的に読み込み
    const Tesseract = await import('tesseract.js')
    
    // PDFを画像に変換（簡略化のため、最初のページのみ）
    const pdfjsLib = await loadPdfJs()
    
    const pdf = await pdfjsLib.getDocument({ data: pdfDataCopy }).promise
    const page = await pdf.getPage(1)
    
    const viewport = page.getViewport({ scale: 2.0 })
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    canvas.height = viewport.height
    canvas.width = viewport.width
    
    await page.render({ canvasContext: context, viewport }).promise
    
    // OCRを実行
    const { data: { text } } = await Tesseract.recognize(canvas, 'jpn+eng')
    return text
  } catch (error) {
    console.error('OCR extraction failed:', error)
    return ''
  }
}

/**
 * PDFから特定のページのみをテキスト抽出してBase64エンコード
 * @param {ArrayBuffer} pdfData - PDFデータ
 * @param {Array<number>} pageNumbers - 抽出するページ番号の配列
 * @returns {Promise<string>} 抽出したテキストを含むBase64エンコードされたデータ
 */
async function extractPagesFromPDF(pdfData, pageNumbers) {
  try {
    // ArrayBufferのdetached問題を回避するため、データをコピー
    const pdfDataCopy = pdfData.slice()
    
    const pdfjsLib = await loadPdfJs()
    
    const pdf = await pdfjsLib.getDocument({ data: pdfDataCopy }).promise
    const totalPages = pdf.numPages
    
    // ページ番号を有効な範囲に調整
    const validPages = pageNumbers.filter(pageNum => pageNum >= 1 && pageNum <= totalPages)
    
    if (validPages.length === 0) {
      throw new Error('有効なページ番号がありません')
    }
    
    console.log(`Extracting text from ${validPages.length} pages: ${validPages.join(', ')}`)
    
    // 各ページからテキストを抽出
    let fullText = ''
    for (const pageNum of validPages) {
      const page = await pdf.getPage(pageNum)
      const textContent = await page.getTextContent()
      const pageText = textContent.items.map(item => item.str).join(' ')
      fullText += `\n=== Page ${pageNum} ===\n${pageText}\n`
    }
    
    // テキストをUTF-8でエンコード
    const encoder = new TextEncoder()
    const uint8Array = encoder.encode(fullText)
    
    // Base64エンコード
    return btoa(
      Array.from(uint8Array)
        .map(byte => String.fromCharCode(byte))
        .join('')
    )
  } catch (error) {
    console.error('PDFページ抽出失敗:', error)
    throw error
  }
}

/**
 * Gemini APIレスポンスからテキストを安全に抽出
 * @param {Object} data - APIレスポンス
 * @returns {string|null} 抽出されたテキスト、またはnull
 */
function extractTextFromGeminiResponse(data) {
  if (!data || !data.candidates || !Array.isArray(data.candidates) || data.candidates.length === 0) {
    console.error('Gemini API response has no candidates:', data)
    return null
  }
  
  const candidate = data.candidates[0]
  if (!candidate || !candidate.content || !candidate.content.parts || !Array.isArray(candidate.content.parts) || candidate.content.parts.length === 0) {
    console.error('Gemini API response has invalid structure:', candidate)
    return null
  }
  
  return candidate.content.parts[0]?.text || null
}

/**
 * GeminiでPDFを直接読み取り（部分読み取り版）
 * @param {ArrayBuffer} pdfData - PDFデータ
 * @param {string} apiKey - Gemini APIキー
 * @param {boolean} usePartialRead - 部分読み取りを使用するか
 * @returns {Promise<Object>} 抽出された情報
 */
async function extractWithGemini(pdfData, apiKey, usePartialRead = true) {
  try {
    // ArrayBufferのdetached問題を回避するため、データをコピー
    const pdfDataCopy = pdfData.slice()
    
    if (usePartialRead) {
      // 部分読み取り: 最初の5ページと最後の5ページ
      const pdfjsLib = await loadPdfJs()
      
      const pdf = await pdfjsLib.getDocument({ data: pdfDataCopy }).promise
      const totalPages = pdf.numPages
      
      // 最初の5ページと最後の5ページを抽出
      const pagesToExtract = []
      for (let i = 1; i <= Math.min(5, totalPages); i++) {
        pagesToExtract.push(i)
      }
      for (let i = Math.max(1, totalPages - 4); i <= totalPages; i++) {
        if (!pagesToExtract.includes(i)) {
          pagesToExtract.push(i)
        }
      }
      
      console.log(`PDF部分読み取り: 全${totalPages}ページ中、${pagesToExtract.length}ページを抽出 (ページ: ${pagesToExtract.join(', ')})`)
      
      // 部分的なテキストを抽出してGeminiに送信
      const textBase64 = await extractPagesFromPDF(pdfDataCopy, pagesToExtract)
      
      // テキストベースの分析用プロンプト
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `以下のPDF文書（最初の5ページと最後の5ページのみ抽出）から学術的な参照情報を抽出してください。以下の情報をJSON形式で返してください：

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
- description: 要約または説明

注意事項:
- この文書は部分的な読み取りです（最初5ページ+最後5ページ）
- タイトルや著者情報は通常最初の数ページに記載されています
- 参考文献リストは最後のページに記載されていることが多いです
- 著者情報が見つからない場合は空配列[]を返してください
- 日付は正確に抽出し、不明な場合は空文字列を返してください
- すべてのフィールドは文字列または配列として返してください
- JSONのみを返し、他の説明文は含めないでください

PDFテキスト内容:
${atob(textBase64)}`
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
        throw new Error(`Gemini API error: ${response.status} ${errorBody}`)
      }
      
      const data = await response.json()
      const text = extractTextFromGeminiResponse(data)
      
      if (!text) {
        throw new Error('No text in Gemini response')
      }
      
      // JSONを抽出
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('No JSON found in response')
      }
      
      return JSON.parse(jsonMatch[0])
    }
    
    // 全文読み取り: PDF全体をBase64エンコード
    const uint8Array = new Uint8Array(pdfDataCopy)
    const base64 = btoa(
      Array.from(uint8Array)
        .map(byte => String.fromCharCode(byte))
        .join('')
    )
    console.log('PDF全文読み取りを実行')
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `以下のPDF文書（全文）から学術的な参照情報を抽出してください。以下の情報をJSON形式で返してください：

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
- description: 要約または説明

注意事項:
- この文書は全文を読み取っています
- 著者情報が見つからない場合は空配列[]を返してください
- 日付は正確に抽出し、不明な場合は空文字列を返してください
- すべてのフィールドは文字列または配列として返してください
- JSONのみを返し、他の説明文は含めないでください`
          }, {
            inline_data: {
              mime_type: 'application/pdf',
              data: base64
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
      throw new Error(`Gemini API error: ${response.status} ${errorBody}`)
    }
    
    const data = await response.json()
    const text = extractTextFromGeminiResponse(data)
    
    if (!text) {
      throw new Error('No text in Gemini response')
    }
    
    // JSONを抽出
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in response')
    }
    
    return JSON.parse(jsonMatch[0])
  } catch (error) {
    console.error('Gemini extraction failed:', error)
    return null
  }
}

/**
 * Geminiでテキストから情報を構造化
 */
async function structureTextWithGemini(text, apiKey) {
  try {
    const prompt = `以下のテキストは学術PDF文書から抽出したものです。以下の情報を抽出してJSON形式で返してください：

テキスト:
${text.substring(0, 4000)}

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
- description: 要約または説明

注意事項:
- 著者情報が見つからない場合は空配列[]を返してください
- 日付は正確に抽出し、不明な場合は空文字列を返してください
- すべてのフィールドは文字列または配列として返してください
- JSONのみを返し、他の説明文は含めないでください`

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2048
        }
      })
    })
    
    if (!response.ok) {
      const errorBody = await response.text().catch(() => '')
      throw new Error(`Gemini API error: ${response.status} ${errorBody}`)
    }
    
    const data = await response.json()
    const responseText = extractTextFromGeminiResponse(data)
    
    if (!responseText) {
      throw new Error('No text in Gemini response')
    }
    
    // JSONを抽出
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in response')
    }
    
    return JSON.parse(jsonMatch[0])
  } catch (error) {
    console.error('Gemini text structuring failed:', error)
    return null
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
      'hatenablog.com': 'はてなブログ',
      'ameblo.jp': 'アメブロ',
      'fc2.com': 'FC2ブログ',
      'livedoor.com': 'livedoor',
      'goo.ne.jp': 'goo',
      'yahoo.co.jp': 'Yahoo!',
      'google.com': 'Google',
      'microsoft.com': 'Microsoft',
      'apple.com': 'Apple',
      'amazon.co.jp': 'Amazon',
      'amazon.com': 'Amazon',
      'rakuten.co.jp': '楽天',
      'mercari.com': 'メルカリ',
      'paypay.ne.jp': 'PayPay',
      'line.me': 'LINE',
      'twitter.com': 'Twitter',
      'facebook.com': 'Facebook',
      'instagram.com': 'Instagram',
      'youtube.com': 'YouTube',
      'tiktok.com': 'TikTok',
      'linkedin.com': 'LinkedIn',
      'reddit.com': 'Reddit',
      'medium.com': 'Medium',
      'dev.to': 'DEV Community',
      'codepen.io': 'CodePen',
      'jsfiddle.net': 'JSFiddle',
      'repl.it': 'Replit',
      'codesandbox.io': 'CodeSandbox',
      'npmjs.com': 'npm',
      'pypi.org': 'PyPI',
      'rubygems.org': 'RubyGems',
      'packagist.org': 'Packagist',
      'crates.io': 'Crates.io',
      'nuget.org': 'NuGet',
      'maven.org': 'Maven Central',
      'gradle.org': 'Gradle',
      'docker.com': 'Docker Hub',
      'kubernetes.io': 'Kubernetes',
      'terraform.io': 'Terraform',
      'ansible.com': 'Ansible',
      'jenkins.io': 'Jenkins',
      'gitlab.com': 'GitLab',
      'bitbucket.org': 'Bitbucket',
      'atlassian.com': 'Atlassian',
      'slack.com': 'Slack',
      'discord.com': 'Discord',
      'zoom.us': 'Zoom',
      'teams.microsoft.com': 'Microsoft Teams',
      'meet.google.com': 'Google Meet',
      'webex.com': 'Webex',
      'dropbox.com': 'Dropbox',
      'drive.google.com': 'Google Drive',
      'onedrive.live.com': 'OneDrive',
      'icloud.com': 'iCloud',
      'box.com': 'Box',
      'mega.nz': 'MEGA',
      'wetransfer.com': 'WeTransfer',
      'sendspace.com': 'SendSpace',
      'mediafire.com': 'MediaFire',
      '4shared.com': '4shared',
      'rapidshare.com': 'RapidShare'
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
      const commonTlds = ['com', 'org', 'net', 'edu', 'gov', 'co', 'jp', 'uk', 'de', 'fr', 'it', 'es', 'ca', 'au', 'nz']
      if (!commonTlds.includes(mainDomain)) {
        return mainDomain.charAt(0).toUpperCase() + mainDomain.slice(1)
      }
      
      // サブドメインがある場合はそれを使用
      if (parts.length >= 3) {
        const subdomain = parts[parts.length - 3]
        return subdomain.charAt(0).toUpperCase() + subdomain.slice(1)
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
    
    // PDFをダウンロード
    const pdfData = await downloadPDF(url)
    
    if (onProgress) {
      onProgress({ status: 'processing', progress: 0.2 })
    }
    
    // 1. Geminiで部分PDF読み取り試行（最初5ページ+最後5ページ）
    console.log('Attempting partial Gemini PDF extraction (first 5 + last 5 pages)...')
    let result = await extractWithGemini(pdfData, apiKey, true) // usePartialRead = true
    
    if (result && result.title && result.title.trim() !== '') {
      // 著者情報がない場合はサイト名を使用
      if (!result.authors || result.authors.length === 0) {
        const siteName = extractSiteNameFromUrl(url)
        console.log(`No authors found, using site name: ${siteName}`)
        result.authors = [{ name: siteName, order: 1 }]
        result.isSiteAuthor = true
      }
      
      console.log('Successfully extracted with Gemini partial method')
      if (onProgress) {
        onProgress({ status: 'complete', progress: 1 })
      }
      return { ...result, extractionMethod: 'gemini-partial' }
    }
    
    // 2. 部分読み取りで情報が不十分な場合、全文読み取りを試行
    console.log('Partial extraction insufficient, attempting full PDF extraction...')
    if (onProgress) {
      onProgress({ status: 'processing', progress: 0.3 })
    }
    
    result = await extractWithGemini(pdfData, apiKey, false) // usePartialRead = false
    
    if (result && result.title && result.title.trim() !== '') {
      // 著者情報がない場合はサイト名を使用
      if (!result.authors || result.authors.length === 0) {
        const siteName = extractSiteNameFromUrl(url)
        console.log(`No authors found, using site name: ${siteName}`)
        result.authors = [{ name: siteName, order: 1 }]
        result.isSiteAuthor = true
      }
      
      console.log('Successfully extracted with Gemini full method')
      if (onProgress) {
        onProgress({ status: 'complete', progress: 1 })
      }
      return { ...result, extractionMethod: 'gemini-full' }
    }
    
    // 3. pdf.jsでテキスト抽出 → Geminiで構造化
    if (onProgress) {
      onProgress({ status: 'processing', progress: 0.5 })
    }
    
    console.log('Attempting pdf.js text extraction...')
    const text = await extractTextWithPdfJs(pdfData)
    
    if (text && text.length > 100) {
      if (onProgress) {
        onProgress({ status: 'processing', progress: 0.7 })
      }
      
      console.log('Structuring extracted text with Gemini...')
      result = await structureTextWithGemini(text, apiKey)
      
      if (result && result.title && result.title.trim() !== '') {
        // 著者情報がない場合はサイト名を使用
        if (!result.authors || result.authors.length === 0) {
          const siteName = extractSiteNameFromUrl(url)
          console.log(`No authors found, using site name: ${siteName}`)
          result.authors = [{ name: siteName, order: 1 }]
          result.isSiteAuthor = true
        }
        
        console.log('Successfully extracted with pdf.js + Gemini method')
        if (onProgress) {
          onProgress({ status: 'complete', progress: 1 })
        }
        return { ...result, extractionMethod: 'pdfjs-gemini' }
      }
    }
    
    // 4. OCRでテキスト抽出 → Geminiで構造化
    if (onProgress) {
      onProgress({ status: 'ocr', progress: 0.8 })
    }
    
    console.log('Attempting OCR text extraction...')
    const ocrText = await extractTextWithOCR(pdfData)
    
    if (ocrText && ocrText.length > 100) {
      if (onProgress) {
        onProgress({ status: 'processing', progress: 0.9 })
      }
      
      console.log('Structuring OCR text with Gemini...')
      result = await structureTextWithGemini(ocrText, apiKey)
      
      if (result && result.title && result.title.trim() !== '') {
        // 著者情報がない場合はサイト名を使用
        if (!result.authors || result.authors.length === 0) {
          const siteName = extractSiteNameFromUrl(url)
          console.log(`No authors found, using site name: ${siteName}`)
          result.authors = [{ name: siteName, order: 1 }]
          result.isSiteAuthor = true
        }
        
        console.log('Successfully extracted with OCR + Gemini method')
        if (onProgress) {
          onProgress({ status: 'complete', progress: 1 })
        }
        return { ...result, extractionMethod: 'ocr-gemini' }
      }
    }
    
    // すべての方法で失敗
    throw new Error('すべての抽出方法が失敗しました')
  } catch (error) {
    console.error('PDF extraction failed:', error)
    if (onProgress) {
      onProgress({ status: 'error', error: error.message })
    }
    throw error
  }
}
