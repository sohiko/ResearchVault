/**
 * PDFプロキシAPI
 * CORS制限を回避するため、サーバーサイドでPDFをダウンロードしてBase64で返す
 */

export const config = {
  maxDuration: 60, // 最大60秒（大きなPDF対応）
}

export default async function handler(req, res) {
  // CORSヘッダーを設定
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  // OPTIONSリクエストに対応
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // URLを取得（GETの場合はクエリパラメータ、POSTの場合はボディから）
    const pdfUrl = req.method === 'GET' 
      ? req.query.url 
      : req.body?.url

    if (!pdfUrl) {
      return res.status(400).json({ error: 'URL is required' })
    }

    // URLの検証
    let parsedUrl
    try {
      parsedUrl = new URL(pdfUrl)
    } catch {
      return res.status(400).json({ error: 'Invalid URL' })
    }

    // HTTPSまたはHTTPのみ許可
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return res.status(400).json({ error: 'Only HTTP and HTTPS URLs are allowed' })
    }

    console.log(`[pdf-proxy] Fetching PDF from: ${pdfUrl}`)

    // PDFをダウンロード
    const response = await fetch(pdfUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/pdf,*/*',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
      },
      redirect: 'follow',
    })

    if (!response.ok) {
      console.error(`[pdf-proxy] Failed to fetch PDF: ${response.status} ${response.statusText}`)
      return res.status(response.status).json({ 
        error: `Failed to fetch PDF: ${response.status} ${response.statusText}` 
      })
    }

    // Content-Typeを確認
    const contentType = response.headers.get('content-type') || ''
    console.log(`[pdf-proxy] Content-Type: ${contentType}`)

    // PDFデータを取得
    const arrayBuffer = await response.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)
    
    // Base64エンコード
    const base64 = Buffer.from(uint8Array).toString('base64')
    
    console.log(`[pdf-proxy] PDF fetched successfully: ${Math.round(base64.length / 1024)} KB (base64)`)

    // Base64データを返す
    return res.status(200).json({
      success: true,
      data: base64,
      contentType: contentType,
      size: arrayBuffer.byteLength,
    })
  } catch (error) {
    console.error('[pdf-proxy] Error:', error)
    return res.status(500).json({ 
      error: 'Failed to fetch PDF',
      message: error.message 
    })
  }
}

