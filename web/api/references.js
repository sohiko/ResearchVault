// 参照管理APIエンドポイント
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://pzplwtvnxikhykqsvcfs.supabase.co'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6cGx3dHZueGlraHlrcXN2Y2ZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3NTg3NzQsImV4cCI6MjA3NDMzNDc3NH0.k8h6E0QlW2549ILvrR5NeMdzJMmhmekj6O_GZ3C43V0'

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
        return handleGetReferences(req, res, user.id)
      case 'POST':
        return handleCreateReference(req, res, user.id)
      default:
        return res.status(405).json({ error: 'Method not allowed' })
    }

  } catch (error) {
    console.error('References API error:', error)
    return res.status(500).json({
      error: '内部サーバーエラーが発生しました'
    })
  }
}

async function handleGetReferences(req, res, userId) {
  try {
    const { project_id, limit = 50, offset = 0 } = req.query

    let query = supabase
      .from('references')
      .select(`
        *,
        projects(name),
        reference_tags(tags(name, color))
      `)
      .eq('saved_by', userId)
      .order('saved_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1)

    if (project_id) {
      query = query.eq('project_id', project_id)
    }

    const { data: references, error } = await query

    if (error) {
      console.error('Get references error:', error)
      return res.status(500).json({ error: '参照の取得に失敗しました' })
    }

    // レスポンス用に整形
    const formattedReferences = references.map(ref => ({
      id: ref.id,
      title: ref.title,
      url: ref.url,
      description: ref.description,
      favicon: ref.favicon,
      metadata: ref.metadata || {},
      projectId: ref.project_id,
      projectName: ref.projects?.name,
      tags: ref.reference_tags?.map(rt => rt.tags) || [],
      savedAt: ref.saved_at,
      savedBy: ref.saved_by,
      updatedAt: ref.updated_at
    }))

    return res.status(200).json(formattedReferences)

  } catch (error) {
    console.error('Get references unexpected error:', error)
    return res.status(500).json({ error: '参照の取得に失敗しました' })
  }
}

async function handleCreateReference(req, res, userId) {
  try {
    const {
      title,
      url,
      description,
      favicon,
      metadata,
      projectId,
      tags
    } = req.body

    // バリデーション
    if (!title || title.trim().length === 0) {
      return res.status(400).json({ error: 'タイトルは必須です' })
    }

    if (!url || !isValidUrl(url)) {
      return res.status(400).json({ error: '有効なURLが必要です' })
    }

    // プロジェクトの存在と権限チェック
    if (projectId) {
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('id, owner_id, project_members!inner(user_id)')
        .eq('id', projectId)
        .or(`owner_id.eq.${userId},project_members.user_id.eq.${userId}`)
        .single()

      if (projectError || !project) {
        return res.status(400).json({ error: '指定されたプロジェクトが存在しないか、アクセス権限がありません' })
      }
    }

    // 重複チェック
    const { data: existing, error: duplicateError } = await supabase
      .from('references')
      .select('id')
      .eq('url', url)
      .eq('saved_by', userId)
      .single()

    if (!duplicateError && existing) {
      return res.status(409).json({ error: 'この参照は既に保存されています' })
    }

    // 参照を作成
    const { data: reference, error } = await supabase
      .from('references')
      .insert({
        title: title.trim(),
        url: url.trim(),
        description: description?.trim() || '',
        favicon: favicon || null,
        metadata: metadata || {},
        project_id: projectId || null,
        saved_by: userId,
        saved_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      console.error('Create reference error:', error)
      return res.status(500).json({ error: '参照の保存に失敗しました' })
    }

    // タグがある場合は追加
    if (tags && Array.isArray(tags) && tags.length > 0) {
      try {
        await addTagsToReference(reference.id, tags, userId)
      } catch (tagError) {
        console.warn('Failed to add tags:', tagError)
        // タグの追加に失敗してもエラーにはしない
      }
    }

    const formattedReference = {
      id: reference.id,
      title: reference.title,
      url: reference.url,
      description: reference.description,
      favicon: reference.favicon,
      metadata: reference.metadata || {},
      projectId: reference.project_id,
      tags: tags || [],
      savedAt: reference.saved_at,
      savedBy: reference.saved_by,
      updatedAt: reference.updated_at
    }

    return res.status(201).json(formattedReference)

  } catch (error) {
    console.error('Create reference unexpected error:', error)
    return res.status(500).json({ error: '参照の保存に失敗しました' })
  }
}

async function addTagsToReference(referenceId, tags, userId) {
  for (const tagName of tags) {
    if (!tagName || tagName.trim().length === 0) {
      continue
    }

    try {
      // タグを取得または作成
      const { data: tag, error: tagError } = await supabase
        .from('tags')
        .select('id')
        .eq('name', tagName.trim())
        .eq('created_by', userId)
        .single()

      if (tagError && tagError.code === 'PGRST116') {
        // タグが存在しない場合は作成
        const { data: _newTag, error: createError } = await supabase
          .from('tags')
          .insert({
            name: tagName.trim(),
            color: getRandomTagColor(),
            created_by: userId,
            created_at: new Date().toISOString()
          })
          .select('id')
          .single()

        if (createError) {
          console.warn('Failed to create tag:', createError)
          continue
        }

        // const tag = newTag // タグIDは後で使用される
      } else if (tagError) {
        console.warn('Tag query error:', tagError)
        continue
      }

      // 参照とタグを関連付け
      await supabase
        .from('reference_tags')
        .insert({
          reference_id: referenceId,
          tag_id: tag.id
        })

    } catch (error) {
      console.warn('Failed to process tag:', tagName, error)
    }
  }
}

function isValidUrl(string) {
  try {
    new URL(string)
    return true
  } catch (_) {
    return false
  }
}

function getRandomTagColor() {
  const colors = [
    '#EF4444', '#F97316', '#F59E0B', '#EAB308', '#84CC16',
    '#22C55E', '#10B981', '#14B8A6', '#06B6D4', '#0EA5E9',
    '#3B82F6', '#6366F1', '#8B5CF6', '#A855F7', '#D946EF',
    '#EC4899', '#F43F5E'
  ]
  return colors[Math.floor(Math.random() * colors.length)]
}
