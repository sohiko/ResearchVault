// プロジェクト管理APIエンドポイント
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://pzplwtvnxikhykqsvcfs.supabase.co'
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6cGx3dHZueGlraHlrcXN2Y2ZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3NTg3NzQsImV4cCI6MjA3NDMzNDc3NH0.k8h6E0QlW2549ILvrR5NeMdzJMmhmekj6O_GZ3C43V0'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey

// 認証用クライアント（匿名キー使用）
const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey)
// 管理用クライアント（サービスロールキー使用、RLSバイパス）
const supabase = createClient(supabaseUrl, supabaseServiceKey)

export default async function handler(req, res) {
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
    console.log('Projects API - Auth header:', authHeader)
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('Projects API - No auth header or invalid format')
      return res.status(401).json({ error: '認証が必要です' })
    }

    const token = authHeader.split(' ')[1]
    console.log('Projects API - Token:', token ? `${token.substring(0, 20)}...` : 'null')
    
    // Supabaseの正しい認証方法を使用
    let userId
    try {
      // Supabaseクライアントでトークンを検証
      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token)
      
      console.log('Projects API - Auth verification:', { 
        user: user ? { id: user.id, email: user.email } : null, 
        error: authError?.message 
      })
      
      if (authError || !user) {
        console.log('Projects API - Auth failed:', authError?.message || 'No user')
        return res.status(401).json({ error: '無効な認証トークンです' })
      }
      
      userId = user.id
      console.log('Projects API - Auth successful, user ID:', userId)
    } catch (error) {
      console.log('Projects API - Auth verification error:', error)
      return res.status(401).json({ error: '認証の検証に失敗しました' })
    }

    switch (req.method) {
      case 'GET':
        return handleGetProjects(req, res, userId)
      case 'POST':
        return handleCreateProject(req, res, userId)
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

async function handleGetProjects(req, res, userId) {
  try {
    // 所有プロジェクトを取得
    const { data: ownedProjects, error: ownedError } = await supabase
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
    const { data: memberProjects, error: memberError } = await supabase
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

async function handleCreateProject(req, res, userId) {
  try {
    const { name, description, color, isPublic } = req.body

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'プロジェクト名は必須です' })
    }

    if (name.length > 100) {
      return res.status(400).json({ error: 'プロジェクト名は100文字以内で入力してください' })
    }

    const { data: project, error } = await supabase
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
    const { error: memberError } = await supabase
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
