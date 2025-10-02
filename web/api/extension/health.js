// Chrome拡張機能専用ヘルスチェックAPIエンドポイント
export default async function handler(req, res) {
  // デバッグログ
  console.log('Extension Health API called:', {
    method: req.method,
    url: req.url,
    headers: req.headers,
    userAgent: req.headers['user-agent']
  })

  // CORS設定（拡張機能用）
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Client-Info, X-Extension-Version')
  res.setHeader('Access-Control-Allow-Credentials', 'true')

  if (req.method === 'OPTIONS') {
    console.log('OPTIONS request handled for extension health')
    return res.status(200).end()
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    console.log('Method not allowed for extension health:', req.method)
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // 拡張機能からのリクエストかどうかを確認
    const userAgent = req.headers['user-agent'] || ''
    const isExtension = userAgent.includes('chrome-extension') || 
                       req.headers['x-extension-version'] ||
                       req.headers['x-client-info']?.includes('extension')

    const response = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      extension: {
        detected: isExtension,
        version: req.headers['x-extension-version'] || 'unknown',
        userAgent: userAgent
      },
      api: {
        version: '1.0.0',
        endpoints: {
          auth: '/api/extension/auth',
          health: '/api/extension/health'
        }
      }
    }

    console.log('Extension health check success:', {
      isExtension,
      extensionVersion: req.headers['x-extension-version']
    })

    return res.status(200).json(response)

  } catch (error) {
    console.error('Extension health check error:', error)
    return res.status(500).json({
      error: 'ヘルスチェックに失敗しました'
    })
  }
}
