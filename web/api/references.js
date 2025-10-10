// 参照管理APIエンドポイント
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
        return handleGetReferences(req, res, userId, userSupabase)
      case 'POST':
        return handleCreateReference(req, res, userId, userSupabase)
      default:
        return res.status(405).json({ error: 'Method not allowed' })
    }

  } catch (error) {
    console.error('References API error:', error)
    return res.status(500).json({
      error: '内部サーバーエラーが発生しました',
      details: error.message,
      stack: error.stack
    })
  }
}

async function handleGetReferences(req, res, userId, userSupabase) {
  try {
    const { project_id, limit = 50, offset = 0 } = req.query

    let query = userSupabase
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

async function handleCreateReference(req, res, userId, userSupabase) {
  try {
    
    const {
      title,
      url,
      description,
      memo, // 拡張機能からのフィールド
      favicon,
      metadata,
      projectId,
      tags,
      savedAt // 拡張機能からのフィールド
    } = req.body

    // 拡張機能からのデータ形式に対応
    const finalDescription = description || memo || ''
    const finalSavedAt = savedAt || new Date().toISOString()

    // バリデーション
    if (!title || title.trim().length === 0) {
      return res.status(400).json({ error: 'タイトルは必須です' })
    }
    // URL検証を緩和（空でないことのみ）
    if (!url || url.trim().length === 0) {
      return res.status(400).json({ error: '有効なURLが必要です' })
    }

    // プロジェクトの存在と権限チェック
    if (projectId) {
      const { data: project, error: projectError } = await userSupabase
        .from('projects')
        .select('id, owner_id')
        .eq('id', projectId)
        .single()

      if (projectError || !project) {
        return res.status(400).json({ error: '指定されたプロジェクトが存在しないか、アクセス権限がありません' })
      }
    }

    // プロジェクトごとの重複チェック
    const { data: existing, error: duplicateError } = await userSupabase
      .from('references')
      .select('id, project_id')
      .eq('url', url)
      .eq('saved_by', userId)
      .eq('project_id', projectId || null)
      .single()

    if (!duplicateError && existing) {
      if (projectId) {
        return res.status(409).json({ error: 'この参照は既にこのプロジェクトに保存されています' })
      } else {
        return res.status(409).json({ error: 'この参照は既にプロジェクトなしで保存されています' })
      }
    }

    // 参照を作成
    const insertData = {
      title: title.trim(),
      url: url.trim(),
      favicon: favicon || null,
      metadata: { ...(metadata || {}), memo: (finalDescription || '').trim() },
      project_id: projectId || null,
      saved_by: userId,
      saved_at: finalSavedAt,
      updated_at: new Date().toISOString()
    }
    
    const { data: reference, error } = await userSupabase
      .from('references')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      // データベース制約エラーの詳細を返す
      if (error.code === '23505') {
        if (projectId) {
          return res.status(409).json({ error: 'この参照は既にこのプロジェクトに保存されています' })
        } else {
          return res.status(409).json({ error: 'この参照は既にプロジェクトなしで保存されています' })
        }
      } else if (error.code === '23503') {
        return res.status(400).json({ error: '指定されたプロジェクトが存在しません' })
      } else if (error.code === '23514') {
        return res.status(400).json({ error: 'データの形式が正しくありません' })
      }
      
      return res.status(500).json({ 
        error: '参照の保存に失敗しました',
        details: error.message,
        code: error.code
      })
    }

    // タグがある場合は追加
    if (tags && Array.isArray(tags) && tags.length > 0) {
      try {
        await addTagsToReference(reference.id, tags, userId, userSupabase)
      } catch (tagError) {
        console.warn('Failed to add tags:', tagError)
        // タグの追加に失敗してもエラーにはしない
      }
    }

    const formattedReference = {
      id: reference.id,
      title: reference.title,
      url: reference.url,
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

async function addTagsToReference(referenceId, tags, userId, userSupabase) {
  for (const tagName of tags) {
    if (!tagName || tagName.trim().length === 0) {
      continue
    }

    try {
      // タグを取得または作成
      const { data: tag, error: tagError } = await userSupabase
        .from('tags')
        .select('id')
        .eq('name', tagName.trim())
        .eq('created_by', userId)
        .single()

      if (tagError && tagError.code === 'PGRST116') {
        // タグが存在しない場合は作成
        const { data: newTag, error: createError } = await userSupabase
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

        // 新しく作成されたタグを使用
        if (newTag) {
          await userSupabase
            .from('reference_tags')
            .insert({
              reference_id: referenceId,
              tag_id: newTag.id
            })
        }
      } else if (tagError) {
        console.warn('Tag query error:', tagError)
        continue
      }

      // 既存のタグと参照を関連付け
      if (tag) {
        await userSupabase
          .from('reference_tags')
          .insert({
            reference_id: referenceId,
            tag_id: tag.id
          })
      }

    } catch (error) {
      console.warn('Failed to process tag:', tagName, error)
    }
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
