// プロジェクト管理APIエンドポイント
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://pzplwtvnxikhykqsvcfs.supabase.co'
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6cGx3dHZueGlraHlrcXN2Y2ZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3NTg3NzQsImV4cCI6MjA3NDMzNDc3NH0.k8h6E0QlW2549ILvrR5NeMdzJMmhmekj6O_GZ3C43V0'



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

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '認証が必要です' })
    }

    const token = authHeader.split(' ')[1]

    // 認証されたユーザーのSupabaseクライアントを作成
    let userId, userSupabase
    try {
      // ユーザーのトークンでSupabaseクライアントを作成
      userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      })

      // トークンを設定
      await userSupabase.auth.setSession({
        access_token: token,
        refresh_token: '' // リフレッシュトークンは不要
      })

      // ユーザー情報を取得して認証を確認
      const { data: { user }, error: authError } = await userSupabase.auth.getUser()

      if (authError || !user) {
        return res.status(401).json({
          error: '無効な認証トークンです',
          details: authError?.message || 'ユーザーが見つかりません'
        })
      }

      userId = user.id
    } catch (error) {
      return res.status(401).json({ error: '認証の検証に失敗しました' })
    }

    switch (req.method) {
      case 'GET':
        return handleGetProjects(req, res, userId, userSupabase)
      case 'POST':
        return handleCreateProject(req, res, userId, userSupabase)
      case 'DELETE':
        return handleDeleteProject(req, res, userId, userSupabase)
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
    // 所有プロジェクトを取得（削除されていないもののみ）
    const { data: ownedProjects, error: ownedError } = await userSupabase
      .from('projects')
      .select(`
        *,
        references(id)
      `)
      .eq('owner_id', userId)
      .is('deleted_at', null)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })

    if (ownedError) {
      console.error('Get owned projects error:', ownedError)
      return res.status(500).json({ error: 'プロジェクトの取得に失敗しました' })
    }

    // メンバープロジェクトを取得（削除されていないもののみ）
    const { data: memberProjects, error: memberError } = await userSupabase
      .from('project_members')
      .select(`
        role,
        projects!inner(
          *,
          references(id)
        )
      `)
      .eq('user_id', userId)
      .is('projects.deleted_at', null)

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

    // 各プロジェクトの削除されていない参照数を正確に計算
    const formattedProjects = await Promise.all(
      projects.map(async project => {
        const { count } = await userSupabase
          .from('references')
          .select('id', { count: 'exact' })
          .eq('project_id', project.id)
          .is('deleted_at', null)
        
        return {
          id: project.id,
          name: project.name,
          description: project.description,
          color: project.color,
          isPublic: project.is_public,
          ownerId: project.owner_id,
          createdAt: project.created_at,
          updatedAt: project.updated_at,
          referenceCount: count || 0,
          role: project.role
        }
      })
    )

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

async function handleDeleteProject(req, res, userId, userSupabase) {
  try {
    const { projectId } = req.query

    if (!projectId) {
      return res.status(400).json({ error: 'プロジェクトIDが必要です' })
    }

    // プロジェクトの存在確認と権限チェック
    const { data: project, error: fetchError } = await userSupabase
      .from('projects')
      .select('id, owner_id, name')
      .eq('id', projectId)
      .is('deleted_at', null)
      .single()

    if (fetchError || !project) {
      return res.status(404).json({ error: 'プロジェクトが見つかりません' })
    }

    // オーナーまたは管理者権限チェック
    if (project.owner_id !== userId) {
      const { data: member, error: memberError } = await userSupabase
        .from('project_members')
        .select('role')
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .single()

      if (memberError || !member || member.role !== 'admin') {
        return res.status(403).json({ error: 'プロジェクトを削除する権限がありません' })
      }
    }

    // ソフト削除を実行
    const { error: deleteError } = await userSupabase
      .from('projects')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: userId,
        updated_at: new Date().toISOString()
      })
      .eq('id', projectId)

    if (deleteError) {
      console.error('Delete project error:', deleteError)
      return res.status(500).json({ error: 'プロジェクトの削除に失敗しました' })
    }

    return res.status(200).json({
      message: 'プロジェクトをゴミ箱に移動しました',
      projectId
    })

  } catch (error) {
    console.error('Delete project unexpected error:', error)
    return res.status(500).json({ error: 'プロジェクトの削除に失敗しました' })
  }
}
