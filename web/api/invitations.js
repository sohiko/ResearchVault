// 招待管理APIエンドポイント
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://pzplwtvnxikhykqsvcfs.supabase.co'
const supabaseServiceKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('Using fallback Supabase configuration. Please set environment variables for production.')
}



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
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false }
    })
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return res.status(401).json({ error: '無効な認証トークンです' })
    }

    switch (req.method) {
      case 'GET':
        return handleGetInvitations(req, res, user.id, supabase)
      case 'POST':
        return handleCreateInvitation(req, res, user.id, supabase)
      case 'PUT':
        return handleUpdateInvitation(req, res, user.id, supabase)
      case 'DELETE':
        return handleDeleteInvitation(req, res, user.id, supabase)
      default:
        return res.status(405).json({ error: 'Method not allowed' })
    }

  } catch (error) {
    console.error('Invitations API error:', error)
    return res.status(500).json({
      error: '内部サーバーエラーが発生しました'
    })
  }
}

// 招待一覧を取得
async function handleGetInvitations(req, res, userId, supabase) {
  try {
    const { projectId, type } = req.query

    let query = supabase
      .from('project_invitations')
      .select(`
        *,
        projects (id, name, description, color, icon),
        inviter:profiles!inviter_id (id, name, email),
        invitee:profiles!invitee_id (id, name, email)
      `)
      .order('created_at', { ascending: false })

    if (projectId) {
      query = query.eq('project_id', projectId)
    }

    if (type === 'sent') {
      // 送信した招待
      query = query.eq('inviter_id', userId)
    } else if (type === 'received') {
      // 受信した招待
      query = query.eq('invitee_id', userId)
    } else {
      // 両方（自分が関係する招待）
      query = query.or(`inviter_id.eq.${userId},invitee_id.eq.${userId}`)
    }

    const { data, error } = await query

    if (error) {
      console.error('Get invitations error:', error)
      return res.status(500).json({ error: '招待の取得に失敗しました' })
    }

    return res.status(200).json(data || [])

  } catch (error) {
    console.error('Get invitations unexpected error:', error)
    return res.status(500).json({ error: '招待の取得に失敗しました' })
  }
}

// 新規招待を作成
async function handleCreateInvitation(req, res, userId, supabase) {
  try {
    const { projectId, inviteeEmail, role, message, sendEmail } = req.body

    // バリデーション
    if (!projectId) {
      return res.status(400).json({ error: 'プロジェクトIDが必要です' })
    }

    if (!inviteeEmail) {
      return res.status(400).json({ error: 'メールアドレスが必要です' })
    }

    if (!role || !['viewer', 'editor'].includes(role)) {
      return res.status(400).json({ error: '有効な権限を指定してください' })
    }

    // プロジェクトの存在確認とアクセス権限チェック
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, name, description, color, icon, owner_id')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return res.status(404).json({ error: 'プロジェクトが見つかりません' })
    }

    // 招待権限のチェック（オーナーまたは編集者）
    const isOwner = project.owner_id === userId
    let canInvite = isOwner

    if (!isOwner) {
      const { data: memberData } = await supabase
        .from('project_members')
        .select('role')
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .single()

      canInvite = memberData?.role === 'editor' || memberData?.role === 'admin'
    }

    if (!canInvite) {
      return res.status(403).json({ error: 'このプロジェクトにメンバーを招待する権限がありません' })
    }

    // 招待先ユーザーの存在確認
    const { data: inviteeRows, error: inviteeError } = await supabase.rpc('find_project_invitee', { p_project_id: projectId, p_email: inviteeEmail })
    const inviteeProfile = inviteeRows?.[0]

    if (inviteeError || !inviteeProfile) {
      return res.status(400).json({ 
        error: '指定されたメールアドレスのユーザーが見つかりません。このサービスに登録されているユーザーのみ招待できます。' 
      })
    }

    // 自分自身への招待はNG
    if (inviteeProfile.id === userId) {
      return res.status(400).json({ error: '自分自身を招待することはできません' })
    }

    // プロジェクトオーナーへの招待はNG
    if (inviteeProfile.id === project.owner_id) {
      return res.status(400).json({ error: 'プロジェクトのオーナーは既にフルアクセス権限を持っています' })
    }

    // 既にメンバーかチェック
    const { data: existingMember } = await supabase
      .from('project_members')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', inviteeProfile.id)
      .single()

    if (existingMember) {
      return res.status(400).json({ error: 'このユーザーは既にプロジェクトのメンバーです' })
    }

    // 未処理の招待が既にあるかチェック
    const { data: existingInvitation } = await supabase
      .from('project_invitations')
      .select('id, status')
      .eq('project_id', projectId)
      .eq('invitee_id', inviteeProfile.id)
      .eq('status', 'pending')
      .single()

    if (existingInvitation) {
      return res.status(400).json({ error: 'このユーザーには既に未処理の招待があります' })
    }

    // 招待者の情報を取得
    const { data: inviterProfile } = await supabase
      .from('profiles')
      .select('name, email')
      .eq('id', userId)
      .single()

    // 招待を作成
    const { data: invitation, error: createError } = await supabase
      .from('project_invitations')
      .insert({
        project_id: projectId,
        inviter_id: userId,
        invitee_id: inviteeProfile.id,
        invitee_email: inviteeEmail.trim().toLowerCase(),
        role: role,
        message: message?.trim() || null,
        status: 'pending'
      })
      .select(`
        *,
        projects (id, name, description, color, icon),
        inviter:profiles!inviter_id (id, name, email),
        invitee:profiles!invitee_id (id, name, email)
      `)
      .single()

    if (createError) {
      console.error('Create invitation error:', createError)
      return res.status(500).json({ error: '招待の作成に失敗しました' })
    }

    // 即座にメンバーとして追加（招待承認プロセスを省略）
    const { error: memberError } = await supabase
      .from('project_members')
      .insert({
        project_id: projectId,
        user_id: inviteeProfile.id,
        role: role
      })

    if (memberError) {
      console.error('Add member error:', memberError)
      // 招待は作成されたが、メンバー追加に失敗した場合
      // 招待を削除してエラーを返す
      await supabase
        .from('project_invitations')
        .delete()
        .eq('id', invitation.id)
      return res.status(500).json({ error: 'メンバーの追加に失敗しました' })
    }

    // 招待ステータスを承認済みに更新
    await supabase
      .from('project_invitations')
      .update({ 
        status: 'accepted',
        responded_at: new Date().toISOString()
      })
      .eq('id', invitation.id)

    // メール送信（オプション）
    if (sendEmail !== false) {
      try {
        // Edge Functionを呼び出してメール送信
        const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-invitation-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': req.headers.authorization
          },
          body: JSON.stringify({
            invitationId: invitation.id,
            projectId: project.id,
            projectName: project.name,
            projectDescription: project.description,
            projectColor: project.color || '#3b82f6',
            projectIcon: project.icon || '📂',
            inviterName: inviterProfile?.name || inviterProfile?.email || '招待者',
            inviteeEmail: inviteeEmail,
            role: role,
            message: message,
            siteUrl: req.headers.origin || req.headers.referer?.replace(/\/$/, '') || 'https://researchvault.app'
          })
        })

        if (!emailResponse.ok) {
          console.warn('Email sending failed but invitation was created')
        }
      } catch (emailError) {
        console.warn('Failed to send invitation email:', emailError)
        // メール送信失敗しても招待自体は成功として扱う
      }
    }

    return res.status(201).json({
      success: true,
      invitation: invitation,
      message: 'メンバーを招待しました'
    })

  } catch (error) {
    console.error('Create invitation unexpected error:', error)
    return res.status(500).json({ error: '招待の作成に失敗しました' })
  }
}

// 招待を更新（承認/拒否）
async function handleUpdateInvitation(req, res, userId, supabase) {
  const { invitationId, status } = req.body
  if (!invitationId || !['accepted', 'rejected', 'cancelled'].includes(status)) {
    return res.status(400).json({ error: '有効な招待IDとステータスが必要です' })
  }
  const { data, error } = await supabase.rpc('respond_project_invitation', {
    p_invitation_id: invitationId, p_status: status
  })
  if (error) {return res.status(403).json({ error: '招待への応答が許可されていません' })}
  return res.status(200).json({ success: true, invitation: data })
}
// 招待を削除
async function handleDeleteInvitation(req, res, userId, supabase) {
  try {
    const { invitationId } = req.query

    if (!invitationId) {
      return res.status(400).json({ error: '招待IDが必要です' })
    }

    // 招待の取得
    const { data: invitation, error: getError } = await supabase
      .from('project_invitations')
      .select('*')
      .eq('id', invitationId)
      .single()

    if (getError || !invitation) {
      return res.status(404).json({ error: '招待が見つかりません' })
    }

    // 招待者のみ削除可能
    if (invitation.inviter_id !== userId) {
      return res.status(403).json({ error: '招待を削除する権限がありません' })
    }

    // 招待を削除
    const { error: deleteError } = await supabase
      .from('project_invitations')
      .delete()
      .eq('id', invitationId)

    if (deleteError) {
      console.error('Delete invitation error:', deleteError)
      return res.status(500).json({ error: '招待の削除に失敗しました' })
    }

    return res.status(200).json({
      success: true,
      message: '招待を削除しました'
    })

  } catch (error) {
    console.error('Delete invitation unexpected error:', error)
    return res.status(500).json({ error: '招待の削除に失敗しました' })
  }
}

