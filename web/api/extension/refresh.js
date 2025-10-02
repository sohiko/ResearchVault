// Chrome拡張機能専用トークンリフレッシュAPIエンドポイント
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://pzplwtvnxikhykqsvcfs.supabase.co'
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6cGx3dHZueGlraHlrcXN2Y2ZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3NTg3NzQsImV4cCI6MjA3NDMzNDc3NH0.k8h6E0QlW2549ILvrR5NeMdzJMmhmekj6O_GZ3C43V0'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

export default async function handler(req, res) {
  // CORS設定
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Client-Info, X-Extension-Version')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { refresh_token } = req.body

    if (!refresh_token) {
      return res.status(400).json({
        error: 'リフレッシュトークンが必要です'
      })
    }

    console.log('Refreshing token for extension')

    // Supabaseでトークンをリフレッシュ
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token
    })

    if (error) {
      console.error('Token refresh error:', error)
      return res.status(401).json({
        error: 'トークンのリフレッシュに失敗しました'
      })
    }

    const user = data.user
    const session = data.session

    if (!user || !session) {
      return res.status(401).json({
        error: 'セッションの更新に失敗しました'
      })
    }

    // 新しいトークンとセッション情報を返す
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
      }
    }

    console.log('Token refresh success for user:', user.id)

    return res.status(200).json(response)

  } catch (error) {
    console.error('Token refresh unexpected error:', error)
    return res.status(500).json({
      error: '内部サーバーエラーが発生しました'
    })
  }
}
