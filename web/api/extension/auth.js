// Chrome拡張機能専用認証APIエンドポイント
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://pzplwtvnxikhykqsvcfs.supabase.co'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6cGx3dHZueGlraHlrcXN2Y2ZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3NTg3NzQsImV4cCI6MjA3NDMzNDc3NH0.k8h6E0QlW2549ILvrR5NeMdzJMmhmekj6O_GZ3C43V0'

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('Using fallback Supabase configuration. Please set environment variables for production.')
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

export default async function handler(req, res) {
  // デバッグログ
  console.log('Extension Auth API called:', {
    method: req.method,
    url: req.url,
    headers: req.headers,
    body: req.body ? 'Body present' : 'No body',
    userAgent: req.headers['user-agent']
  })

  // CORS設定（拡張機能用）
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Client-Info, X-Extension-Version')
  res.setHeader('Access-Control-Allow-Credentials', 'true')

  if (req.method === 'OPTIONS') {
    console.log('OPTIONS request handled for extension')
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    console.log('Method not allowed for extension:', req.method)
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { email, password, action } = req.body

    if (!email || !password) {
      return res.status(400).json({
        error: 'メールアドレスとパスワードが必要です'
      })
    }

    // 拡張機能からのリクエストかどうかを確認
    const userAgent = req.headers['user-agent'] || ''
    const isExtension = userAgent.includes('chrome-extension') || 
                       req.headers['x-extension-version'] ||
                       req.headers['x-client-info']?.includes('extension')

    console.log('Extension detection:', {
      userAgent,
      isExtension,
      extensionHeaders: {
        'x-extension-version': req.headers['x-extension-version'],
        'x-client-info': req.headers['x-client-info']
      }
    })

    // Supabaseで認証
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      console.error('Extension login error:', error)
      return res.status(401).json({
        error: getErrorMessage(error.message)
      })
    }

    const user = data.user
    const session = data.session

    if (!user || !session) {
      return res.status(401).json({
        error: 'ログインに失敗しました'
      })
    }

    // Chrome拡張機能用にトークンとユーザー情報を返す
    const response = {
      success: true,
      token: session.access_token,
      user: {
        id: user.id,
        email: user.email,
        name: user.user_metadata?.name || user.email.split('@')[0],
        metadata: user.user_metadata
      },
      session: {
        expires_at: session.expires_at,
        refresh_token: session.refresh_token
      },
      extension: {
        detected: isExtension,
        version: req.headers['x-extension-version'] || 'unknown'
      }
    }

    console.log('Extension login success:', {
      userId: user.id,
      email: user.email,
      isExtension
    })

    return res.status(200).json(response)

  } catch (error) {
    console.error('Extension auth unexpected error:', error)
    return res.status(500).json({
      error: '内部サーバーエラーが発生しました'
    })
  }
}

function getErrorMessage(errorMessage) {
  const errorMessages = {
    'Invalid login credentials': 'メールアドレスまたはパスワードが正しくありません',
    'Email not confirmed': 'メールアドレスが確認されていません。確認メールをご確認ください',
    'Too many requests': 'ログイン試行回数が上限に達しました。しばらく待ってから再試行してください',
    'User not found': 'ユーザーが見つかりません',
    'Invalid email': '無効なメールアドレスです'
  }

  return errorMessages[errorMessage] || 'ログインに失敗しました'
}
