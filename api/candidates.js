// 記録漏れ候補管理APIエンドポイント
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
        return handleGetCandidates(req, res, user.id)
      case 'POST':
        return handleCreateCandidate(req, res, user.id)
      case 'PUT':
        return handleUpdateCandidate(req, res, user.id)
      default:
        return res.status(405).json({ error: 'Method not allowed' })
    }

  } catch (error) {
    console.error('Candidates API error:', error)
    return res.status(500).json({
      error: '内部サーバーエラーが発生しました'
    })
  }
}

async function handleGetCandidates(req, res, userId) {
  try {
    const { limit = 20, dismissed = false } = req.query

    const { data, error } = await supabase
      .from('browsing_history_candidates')
      .select('*')
      .eq('user_id', userId)
      .eq('dismissed', dismissed === 'true')
      .order('visited_at', { ascending: false })
      .limit(parseInt(limit))

    if (error) {
      throw error
    }

    return res.status(200).json({
      success: true,
      data: data || []
    })

  } catch (error) {
    console.error('Failed to get candidates:', error)
    return res.status(500).json({
      error: '候補の取得に失敗しました'
    })
  }
}

async function handleCreateCandidate(req, res, userId) {
  try {
    const { url, title, favicon, visitedAt, domain } = req.body

    if (!url || !visitedAt) {
      return res.status(400).json({
        error: 'URLと訪問日時が必要です'
      })
    }

    // 既に保存済みの参照かチェック
    const { data: existingRef } = await supabase
      .from('references')
      .select('id')
      .eq('saved_by', userId)
      .eq('url', url)
      .single()

    if (existingRef) {
      return res.status(200).json({
        success: true,
        message: '既に保存済みの参照です',
        skipped: true
      })
    }

    // 既存の候補をチェック
    const { data: existingCandidate } = await supabase
      .from('browsing_history_candidates')
      .select('id, visit_count')
      .eq('user_id', userId)
      .eq('url', url)
      .single()

    const extractedDomain = domain || new URL(url).hostname
    
    // 学術ドメインかチェック
    const isAcademic = await checkAcademicDomain(extractedDomain)
    
    // 信頼度スコアを計算
    const visitCount = existingCandidate ? existingCandidate.visit_count + 1 : 1
    const confidenceScore = calculateConfidenceScore(url, title, visitCount, extractedDomain, isAcademic)
    
    // 推奨理由を生成
    const suggestedReason = generateSuggestedReason(extractedDomain, title, isAcademic, visitCount)

    if (existingCandidate) {
      // 既存の候補を更新
      const { error } = await supabase
        .from('browsing_history_candidates')
        .update({
          visit_count: visitCount,
          last_visit: visitedAt,
          title: title || null,
          favicon: favicon || null,
          confidence_score: confidenceScore,
          suggested_reason: suggestedReason
        })
        .eq('id', existingCandidate.id)

      if (error) {
        throw error
      }

      return res.status(200).json({
        success: true,
        message: '候補を更新しました',
        data: { id: existingCandidate.id }
      })
    } else {
      // 新しい候補を作成
      const { data, error } = await supabase
        .from('browsing_history_candidates')
        .insert({
          url,
          title: title || null,
          favicon: favicon || null,
          visited_at: visitedAt,
          user_id: userId,
          domain: extractedDomain,
          is_academic: isAcademic,
          confidence_score: confidenceScore,
          suggested_reason: suggestedReason,
          visit_count: visitCount
        })
        .select()
        .single()

      if (error) {
        throw error
      }

      return res.status(201).json({
        success: true,
        message: '新しい候補を作成しました',
        data
      })
    }

  } catch (error) {
    console.error('Failed to create candidate:', error)
    return res.status(500).json({
      error: '候補の作成に失敗しました'
    })
  }
}

async function handleUpdateCandidate(req, res, userId) {
  try {
    const { id, dismissed, action } = req.body

    if (!id) {
      return res.status(400).json({
        error: '候補IDが必要です'
      })
    }

    let updateData = {}

    if (action === 'dismiss') {
      updateData = {
        dismissed: true,
        dismissed_at: new Date().toISOString()
      }
    } else if (dismissed !== undefined) {
      updateData.dismissed = dismissed
      if (dismissed) {
        updateData.dismissed_at = new Date().toISOString()
      }
    }

    const { error } = await supabase
      .from('browsing_history_candidates')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId)

    if (error) {
      throw error
    }

    return res.status(200).json({
      success: true,
      message: '候補を更新しました'
    })

  } catch (error) {
    console.error('Failed to update candidate:', error)
    return res.status(500).json({
      error: '候補の更新に失敗しました'
    })
  }
}

// ヘルパー関数
function checkAcademicDomain(domain) {
  const academicDomains = [
    'scholar.google.com',
    'pubmed.ncbi.nlm.nih.gov',
    'arxiv.org',
    'researchgate.net',
    'nature.com',
    'science.org',
    'ieee.org',
    'springer.com',
    'wiley.com',
    'sciencedirect.com',
    'jstor.org',
    'nih.gov',
    'who.int',
    'un.org',
    'ipcc.ch'
  ]

  return domain.match(/\.(edu|ac\.|gov)$/) || academicDomains.includes(domain)
}

function calculateConfidenceScore(url, title, visitCount, domain, isAcademic) {
  let score = 0.3

  if (isAcademic) {
    score += 0.4
  }

  if (visitCount > 1) {
    score += Math.min(visitCount * 0.1, 0.3)
  }

  if (title && title.match(/(research|study|analysis|paper|journal|article|thesis|dissertation)/i)) {
    score += 0.2
  }

  if (url.match(/(research|scholar|academic|journal|paper|article|study)/i)) {
    score += 0.1
  }

  return Math.min(score, 1.0)
}

function generateSuggestedReason(domain, title, isAcademic, visitCount) {
  if (isAcademic) {
    if (domain.includes('scholar.google')) {
      return '学術検索サイトへのアクセス'
    } else if (domain.includes('nature.com')) {
      return 'Nature誌の研究論文'
    } else if (domain.includes('science.org')) {
      return 'Science誌の研究論文'
    } else if (domain.includes('.edu')) {
      return '大学の学術サイト'
    } else {
      return '学術的なウェブサイト'
    }
  }

  if (visitCount > 3) {
    return '頻繁にアクセスしているサイト'
  }

  if (title && title.match(/(research|study|analysis)/i)) {
    return '研究関連のコンテンツ'
  }

  return '研究に関連する可能性があるサイト'
}
