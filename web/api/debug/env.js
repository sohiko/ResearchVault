// 環境変数デバッグエンドポイント
export default async function handler(req, res) {
  console.log('=== DEBUG ENDPOINT CALLED ===');
  console.log('Debug endpoint - Request info:', {
    method: req.method,
    url: req.url,
    headers: {
      'user-agent': req.headers['user-agent'],
      'x-client-info': req.headers['x-client-info'],
      'x-extension-version': req.headers['x-extension-version']
    },
    timestamp: new Date().toISOString()
  });

  // CORS設定
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Client-Info')

  if (req.method === 'OPTIONS') {
    console.log('Debug endpoint - OPTIONS request handled');
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    console.log('Debug endpoint - Invalid method:', req.method);
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // 環境変数の詳細情報を収集
    const envInfo = {
      timestamp: new Date().toISOString(),
      platform: {
        NODE_ENV: process.env.NODE_ENV,
        VERCEL: process.env.VERCEL,
        VERCEL_ENV: process.env.VERCEL_ENV,
        VERCEL_REGION: process.env.VERCEL_REGION
      },
      supabase: {
        VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL ? {
          set: true,
          value: process.env.VITE_SUPABASE_URL,
          length: process.env.VITE_SUPABASE_URL.length
        } : { set: false },
        SUPABASE_URL: process.env.SUPABASE_URL ? {
          set: true,
          value: process.env.SUPABASE_URL,
          length: process.env.SUPABASE_URL.length
        } : { set: false },
        VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY ? {
          set: true,
          preview: `${process.env.VITE_SUPABASE_ANON_KEY.substring(0, 20)}...`,
          length: process.env.VITE_SUPABASE_ANON_KEY.length
        } : { set: false },
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? {
          set: true,
          preview: `${process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 20)}...`,
          length: process.env.SUPABASE_SERVICE_ROLE_KEY.length
        } : { set: false }
      },
      allSupabaseKeys: Object.keys(process.env).filter(key => key.includes('SUPABASE')),
      processEnvKeys: Object.keys(process.env).length
    }

    console.log('=== COMPLETE ENVIRONMENT DEBUG INFO ===');
    console.log('Environment debug info:', envInfo);
    console.log('=== END COMPLETE ENVIRONMENT DEBUG INFO ===');

    return res.status(200).json({
      success: true,
      data: envInfo
    })

  } catch (error) {
    console.error('Environment debug error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to get environment info',
      details: error.message
    })
  }
}
