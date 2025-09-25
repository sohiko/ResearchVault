// Chrome拡張機能用サインアップAPIエンドポイント
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

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
    const { email, password, name } = req.body

    if (!email || !password) {
      return res.status(400).json({
        error: 'メールアドレスとパスワードが必要です'
      })
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: 'パスワードは6文字以上である必要があります'
      })
    }

    // Supabaseでサインアップ
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name || email.split('@')[0]
        }
      }
    })

    if (error) {
      console.error('Signup error:', error)
      return res.status(400).json({
        error: getErrorMessage(error.message)
      })
    }

    const user = data.user
    const session = data.session

    // メール確認が必要な場合
    if (user && !session) {
      return res.status(200).json({
        message: '確認メールを送信しました。メールを確認してアカウントを有効化してください。',
        user: {
          id: user.id,
          email: user.email,
          emailConfirmed: false
        }
      })
    }

    // 即座にサインアップが完了した場合
    if (user && session) {
      return res.status(201).json({
        token: session.access_token,
        user: {
          id: user.id,
          email: user.email,
          name: user.user_metadata?.name || name || email.split('@')[0],
          metadata: user.user_metadata
        },
        session: {
          expires_at: session.expires_at,
          refresh_token: session.refresh_token
        }
      })
    }

    return res.status(400).json({
      error: 'サインアップに失敗しました'
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
    'User already registered': 'このメールアドレスは既に登録されています',
    'Password should be at least 6 characters': 'パスワードは6文字以上である必要があります',
    'Unable to validate email address: invalid format': 'メールアドレスの形式が正しくありません',
    'signup is disabled': 'アカウント作成は現在無効になっています',
    'Email rate limit exceeded': 'メール送信の制限に達しました。しばらく待ってから再試行してください'
  }

  return errorMessages[errorMessage] || 'サインアップに失敗しました'
}
