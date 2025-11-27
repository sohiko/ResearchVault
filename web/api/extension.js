import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://pzplwtvnxikhykqsvcfs.supabase.co'
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6cGx3dHZueGlraHlrcXN2Y2ZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3NTg3NzQsImV4cCI6MjA3NDMzNDc3NH0.k8h6E0QlW2549ILvrR5NeMdzJMmhmekj6O_GZ3C43V0'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey)

export default async function handler(req, res) {
    // CORS設定
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Client-Info, X-Extension-Version')
    res.setHeader('Access-Control-Allow-Credentials', 'true')

    if (req.method === 'OPTIONS') {
        return res.status(200).end()
    }

    const { action } = req.query

    try {
        if (action === 'health') {
            return handleHealth(req, res)
        } else if (action === 'auth') {
            return handleAuth(req, res)
        } else if (action === 'refresh') {
            return handleRefresh(req, res)
        } else {
            return res.status(400).json({ error: 'Invalid action' })
        }
    } catch (error) {
        console.error('Extension API error:', error)
        return res.status(500).json({ error: 'Internal server error' })
    }
}

async function handleHealth(req, res) {
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

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
            userAgent
        },
        api: {
            version: '1.0.0',
            endpoints: {
                auth: '/api/extension/auth',
                health: '/api/extension/health'
            }
        }
    }

    return res.status(200).json(response)
}

async function handleAuth(req, res) {
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
            detected: true,
            version: req.headers['x-extension-version'] || 'unknown'
        }
    }

    return res.status(200).json(response)
}

async function handleRefresh(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    const { refresh_token } = req.body

    if (!refresh_token) {
        return res.status(400).json({
            error: 'リフレッシュトークンが必要です'
        })
    }

    const { data, error } = await supabase.auth.refreshSession({
        refresh_token
    })

    if (error) {
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

    return res.status(200).json(response)
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
