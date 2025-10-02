// プロジェクト管理APIエンドポイント
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://pzplwtvnxikhykqsvcfs.supabase.co'
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6cGx3dHZueGlraHlrcXN2Y2ZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3NTg3NzQsImV4cCI6MjA3NDMzNDc3NH0.k8h6E0QlW2549ILvrR5NeMdzJMmhmekj6O_GZ3C43V0'



export default async function handler(req, res) {
  // 環境変数デバッグ出力（最初に実行）
  console.log('=== PROJECTS API ENVIRONMENT DEBUG ===');
  console.log('Projects API - Environment variables check:', {
    NODE_ENV: process.env.NODE_ENV,
    VERCEL: process.env.VERCEL,
    VERCEL_ENV: process.env.VERCEL_ENV,
    VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL ? `SET (${process.env.VITE_SUPABASE_URL})` : 'NOT_SET',
    SUPABASE_URL: process.env.SUPABASE_URL ? `SET (${process.env.SUPABASE_URL})` : 'NOT_SET',
    VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY ? `SET (${process.env.VITE_SUPABASE_ANON_KEY.substring(0, 20)}...)` : 'NOT_SET',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? `SET (${process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 20)}...)` : 'NOT_SET',
    finalUrl: supabaseUrl,
    finalAnonKey: supabaseAnonKey ? `${supabaseAnonKey.substring(0, 20)}...` : 'null',
    allEnvKeys: Object.keys(process.env).filter(key => key.includes('SUPABASE')),
    timestamp: new Date().toISOString()
  });
  console.log('=== END PROJECTS API ENVIRONMENT DEBUG ===');

  // CORS設定
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Client-Info')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  try {
    // 認証チェック
    const authHeader = req.headers.authorization
    console.log('Projects API - Auth header:', authHeader ? `Bearer ${authHeader.substring(7, 27)}...` : 'null')
    console.log('Projects API - All headers:', {
      authorization: req.headers.authorization ? 'present' : 'missing',
      'x-client-info': req.headers['x-client-info'],
      'user-agent': req.headers['user-agent'],
      'content-type': req.headers['content-type']
    })

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('Projects API - No auth header or invalid format')
      return res.status(401).json({ error: '認証が必要です' })
    }

    const token = authHeader.split(' ')[1]
    console.log('Projects API - Token info:', {
      hasToken: !!token,
      tokenLength: token ? token.length : 0,
      tokenStart: token ? token.substring(0, 20) : 'null',
      tokenEnd: token ? `...${token.substring(token.length - 10)}` : 'null'
    })

    // 認証されたユーザーのSupabaseクライアントを作成
    let userId, userSupabase
    try {
      console.log('Projects API - Creating user Supabase client with:', {
        url: supabaseUrl,
        anonKey: supabaseAnonKey ? `${supabaseAnonKey.substring(0, 20)}...` : 'null',
        tokenLength: token ? token.length : 0,
        timestamp: new Date().toISOString()
      })

      // ユーザーのトークンでSupabaseクライアントを作成
      userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      })

      console.log('Projects API - Supabase client created successfully')
      console.log('Projects API - Setting session with token')

      // トークンを設定
      const sessionResult = await userSupabase.auth.setSession({
        access_token: token,
        refresh_token: '' // リフレッシュトークンは不要
      })

      console.log('Projects API - Session set result:', {
        success: !sessionResult.error,
        error: sessionResult.error?.message,
        errorCode: sessionResult.error?.status,
        hasUser: !!sessionResult.data?.user,
        hasSession: !!sessionResult.data?.session,
        sessionData: sessionResult.data?.session ? {
          access_token: sessionResult.data.session.access_token ? 'present' : 'missing',
          expires_at: sessionResult.data.session.expires_at,
          user_id: sessionResult.data.session.user?.id
        } : null
      })

      // ユーザー情報を取得して認証を確認
      const { data: { user }, error: authError } = await userSupabase.auth.getUser()

      console.log('Projects API - Auth verification:', {
        user: user ? { id: user.id, email: user.email, role: user.role } : null,
        error: authError?.message,
        errorCode: authError?.status
      })

      if (authError || !user) {
        console.log('Projects API - Auth failed:', authError?.message || 'No user')
        return res.status(401).json({
          error: '無効な認証トークンです',
          details: authError?.message || 'ユーザーが見つかりません'
        })
      }

      userId = user.id
      console.log('Projects API - Auth successful, user ID:', userId)
    } catch (error) {
      console.log('Projects API - Auth verification error:', error.message, error.stack)
      return res.status(401).json({ error: '認証の検証に失敗しました' })
    }

    switch (req.method) {
      case 'GET':
        return handleGetProjects(req, res, userId, userSupabase)
      case 'POST':
        return handleCreateProject(req, res, userId, userSupabase)
      default:
        return res.status(405).json({ error: 'Method not allowed' })
    }

  } catch (error) {
    console.error('Projects API error:', error)
    return res.status(500).json({
      error: '内部サーバーエラーが発生しました'
    })
  }
}

async function handleGetProjects(req, res, userId, userSupabase) {
  try {
    // 所有プロジェクトを取得
    const { data: ownedProjects, error: ownedError } = await userSupabase
      .from('projects')
      .select(`
        *,
        references(id)
      `)
      .eq('owner_id', userId)
      .order('updated_at', { ascending: false })

    if (ownedError) {
      console.error('Get owned projects error:', ownedError)
      return res.status(500).json({ error: 'プロジェクトの取得に失敗しました' })
    }

    // メンバープロジェクトを取得
    const { data: memberProjects, error: memberError } = await userSupabase
      .from('project_members')
      .select(`
        role,
        projects(
          *,
          references(id)
        )
      `)
      .eq('user_id', userId)

    if (memberError) {
      console.error('Get member projects error:', memberError)
      return res.status(500).json({ error: 'プロジェクトの取得に失敗しました' })
    }

    // データを統合
    const allProjects = [
      ...(ownedProjects || []).map(project => ({
        ...project,
        role: 'admin'
      })),
      ...(memberProjects || []).map(member => ({
        ...member.projects,
        role: member.role
      }))
    ]

    // 重複を排除
    const projects = allProjects.filter((project, index, self) =>
      index === self.findIndex(p => p.id === project.id)
    )

    // 参照数を計算してレスポンス用に整形
    const formattedProjects = projects.map(project => ({
      id: project.id,
      name: project.name,
      description: project.description,
      color: project.color,
      isPublic: project.is_public,
      ownerId: project.owner_id,
      createdAt: project.created_at,
      updatedAt: project.updated_at,
      referenceCount: project.references?.length || 0,
      role: project.role
    }))

    return res.status(200).json(formattedProjects)

  } catch (error) {
    console.error('Get projects unexpected error:', error)
    return res.status(500).json({ error: 'プロジェクトの取得に失敗しました' })
  }
}

async function handleCreateProject(req, res, userId, userSupabase) {
  try {
    const { name, description, color, isPublic } = req.body

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'プロジェクト名は必須です' })
    }

    if (name.length > 100) {
      return res.status(400).json({ error: 'プロジェクト名は100文字以内で入力してください' })
    }

    const { data: project, error } = await userSupabase
      .from('projects')
      .insert({
        name: name.trim(),
        description: description?.trim() || '',
        color: color || '#3B82F6',
        is_public: isPublic || false,
        owner_id: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      console.error('Create project error:', error)
      return res.status(500).json({ error: 'プロジェクトの作成に失敗しました' })
    }

    // プロジェクトメンバーとしてオーナーを追加
    const { error: memberError } = await userSupabase
      .from('project_members')
      .insert({
        project_id: project.id,
        user_id: userId,
        role: 'admin',  // 制約で許可されている値
        joined_at: new Date().toISOString()
      })

    if (memberError) {
      console.warn('Failed to add project member:', memberError)
    }

    const formattedProject = {
      id: project.id,
      name: project.name,
      description: project.description,
      color: project.color,
      isPublic: project.is_public,
      ownerId: project.owner_id,
      createdAt: project.created_at,
      updatedAt: project.updated_at,
      referenceCount: 0,
      role: 'admin'
    }

    return res.status(201).json(formattedProject)

  } catch (error) {
    console.error('Create project unexpected error:', error)
    return res.status(500).json({ error: 'プロジェクトの作成に失敗しました' })
  }
}
