// 単一プロジェクト管理APIエンドポイント
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

  const { id } = req.query

  if (!id) {
    return res.status(400).json({ error: 'プロジェクトIDが必要です' })
  }

  try {
    // 認証チェック
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '認証が必要です' })
    }

    const token = authHeader.split(' ')[1]
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return res.status(401).json({ error: '無効な認証トークンです' })
    }

    switch (req.method) {
      case 'GET':
        return handleGetProject(req, res, id, user.id)
      case 'PUT':
        return handleUpdateProject(req, res, id, user.id)
      case 'DELETE':
        return handleDeleteProject(req, res, id, user.id)
      default:
        return res.status(405).json({ error: 'Method not allowed' })
    }

  } catch (error) {
    console.error('Project API error:', error)
    return res.status(500).json({
      error: '内部サーバーエラーが発生しました'
    })
  }
}

async function handleGetProject(req, res, projectId, userId) {
  try {
    const { data: project, error } = await supabase
      .from('projects')
      .select(`
        *,
        project_members!inner(role),
        references(id, title, url, saved_at)
      `)
      .eq('id', projectId)
      .or(`owner_id.eq.${userId},project_members.user_id.eq.${userId}`)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'プロジェクトが見つかりません' })
      }
      console.error('Get project error:', error)
      return res.status(500).json({ error: 'プロジェクトの取得に失敗しました' })
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
      references: project.references || [],
      referenceCount: project.references?.length || 0,
      role: project.project_members?.[0]?.role || 'owner'
    }

    return res.status(200).json(formattedProject)

  } catch (error) {
    console.error('Get project unexpected error:', error)
    return res.status(500).json({ error: 'プロジェクトの取得に失敗しました' })
  }
}

async function handleUpdateProject(req, res, projectId, userId) {
  try {
    const { name, description, color, isPublic } = req.body

    // 権限チェック
    const { data: project, error: checkError } = await supabase
      .from('projects')
      .select('owner_id')
      .eq('id', projectId)
      .single()

    if (checkError || !project) {
      return res.status(404).json({ error: 'プロジェクトが見つかりません' })
    }

    if (project.owner_id !== userId) {
      return res.status(403).json({ error: 'プロジェクトを更新する権限がありません' })
    }

    // バリデーション
    if (name && name.trim().length === 0) {
      return res.status(400).json({ error: 'プロジェクト名は必須です' })
    }

    if (name && name.length > 100) {
      return res.status(400).json({ error: 'プロジェクト名は100文字以内で入力してください' })
    }

    const updateData = {
      updated_at: new Date().toISOString()
    }

    if (name !== undefined) updateData.name = name.trim()
    if (description !== undefined) updateData.description = description.trim()
    if (color !== undefined) updateData.color = color
    if (isPublic !== undefined) updateData.is_public = isPublic

    const { data: updatedProject, error } = await supabase
      .from('projects')
      .update(updateData)
      .eq('id', projectId)
      .select()
      .single()

    if (error) {
      console.error('Update project error:', error)
      return res.status(500).json({ error: 'プロジェクトの更新に失敗しました' })
    }

    const formattedProject = {
      id: updatedProject.id,
      name: updatedProject.name,
      description: updatedProject.description,
      color: updatedProject.color,
      isPublic: updatedProject.is_public,
      ownerId: updatedProject.owner_id,
      createdAt: updatedProject.created_at,
      updatedAt: updatedProject.updated_at,
      role: 'owner'
    }

    return res.status(200).json(formattedProject)

  } catch (error) {
    console.error('Update project unexpected error:', error)
    return res.status(500).json({ error: 'プロジェクトの更新に失敗しました' })
  }
}

async function handleDeleteProject(req, res, projectId, userId) {
  try {
    // 権限チェック
    const { data: project, error: checkError } = await supabase
      .from('projects')
      .select('owner_id')
      .eq('id', projectId)
      .single()

    if (checkError || !project) {
      return res.status(404).json({ error: 'プロジェクトが見つかりません' })
    }

    if (project.owner_id !== userId) {
      return res.status(403).json({ error: 'プロジェクトを削除する権限がありません' })
    }

    // プロジェクトを削除（カスケード削除で関連データも削除される）
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId)

    if (error) {
      console.error('Delete project error:', error)
      return res.status(500).json({ error: 'プロジェクトの削除に失敗しました' })
    }

    return res.status(200).json({ message: 'プロジェクトが削除されました' })

  } catch (error) {
    console.error('Delete project unexpected error:', error)
    return res.status(500).json({ error: 'プロジェクトの削除に失敗しました' })
  }
}
