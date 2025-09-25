// Chrome拡張機能用認証APIエンドポイント
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables')
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

export default async function handler(req, res) {
  // CORS設定
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Client-Info')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({
        error: 'メールアドレスとパスワードが必要です'
      })
    }

    // Supabaseで認証
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      console.error('Login error:', error)
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
    return res.status(200).json({
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
      }
    })

  } catch (error) {
    console.error('Unexpected error:', error)
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
