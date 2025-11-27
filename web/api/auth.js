import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://pzplwtvnxikhykqsvcfs.supabase.co'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6cGx3dHZueGlraHlrcXN2Y2ZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3NTg3NzQsImV4cCI6MjA3NDMzNDc3NH0.k8h6E0QlW2549ILvrR5NeMdzJMmhmekj6O_GZ3C43V0'

if (!supabaseUrl || !supabaseServiceKey) {
    console.warn('Using fallback Supabase configuration. Please set environment variables for production.')
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

    const { action } = req.query

    try {
        if (action === 'login') {
            return handleLogin(req, res)
        } else if (action === 'signup') {
            return handleSignup(req, res)
        } else {
            return res.status(400).json({ error: 'Invalid action' })
        }
    } catch (error) {
        console.error('Auth API error:', error)
        return res.status(500).json({ error: 'Internal server error' })
    }
}

async function handleLogin(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    const { email, password } = req.body

    if (!email || !password) {
        return res.status(400).json({
            error: 'メールアドレスとパスワードが必要です'
        })
    }

    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    })

    if (error) {
        console.error('Login error:', error)
        return res.status(401).json({
            error: getLoginErrorMessage(error.message)
        })
    }

    const user = data.user
    const session = data.session

    if (!user || !session) {
        return res.status(401).json({
            error: 'ログインに失敗しました'
        })
    }

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
}

async function handleSignup(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

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
            error: getSignupErrorMessage(error.message)
        })
    }

    const user = data.user
    const session = data.session

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
}

function getLoginErrorMessage(errorMessage) {
    const errorMessages = {
        'Invalid login credentials': 'メールアドレスまたはパスワードが正しくありません',
        'Email not confirmed': 'メールアドレスが確認されていません。確認メールをご確認ください',
        'Too many requests': 'ログイン試行回数が上限に達しました。しばらく待ってから再試行してください',
        'User not found': 'ユーザーが見つかりません',
        'Invalid email': '無効なメールアドレスです'
    }

    return errorMessages[errorMessage] || 'ログインに失敗しました'
}

function getSignupErrorMessage(errorMessage) {
    const errorMessages = {
        'User already registered': 'このメールアドレスは既に登録されています',
        'Password should be at least 6 characters': 'パスワードは6文字以上である必要があります',
        'Unable to validate email address: invalid format': 'メールアドレスの形式が正しくありません',
        'signup is disabled': 'アカウント作成は現在無効になっています',
        'Email rate limit exceeded': 'メール送信の制限に達しました。しばらく待ってから再試行してください'
    }

    return errorMessages[errorMessage] || 'サインアップに失敗しました'
}
