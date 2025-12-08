import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { toast } from 'react-hot-toast'
import ConfirmDialog from './ConfirmDialog'
import ProtectedModal from './ProtectedModal'
import { useModalContext } from '../../hooks/useModalContext'
import { useAuth } from '../../hooks/useAuth'
import { Link, Copy, Mail, AlertTriangle, Check, X, UserPlus, Users, Globe, Lock } from 'lucide-react'

const ShareProjectModal = ({ project, members, onClose, onUpdate }) => {
  const { openModal, closeModal } = useModalContext()
  const { user } = useAuth()
  const modalId = 'share-project'
  
  const [loading, setLoading] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('viewer')
  const [inviteMessage, setInviteMessage] = useState('')
  const [copyLinkLoading, setCopyLinkLoading] = useState(false)
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)
  const [memberToDelete, setMemberToDelete] = useState(null)
  
  // メンバー一覧はローカルでも保持して即時反映
  const [memberList, setMemberList] = useState(members || [])

  useEffect(() => {
    setMemberList(members || [])
  }, [members])

  // リンク共有関連の状態
  const [isLinkSharingEnabled, setIsLinkSharingEnabled] = useState(project.is_link_sharing_enabled || false)
  const [linkSharingToken, setLinkSharingToken] = useState(project.link_sharing_token || '')
  const [showLinkSharingWarning, setShowLinkSharingWarning] = useState(false)
  const [linkSharingAction, setLinkSharingAction] = useState(null) // 'enable' or 'disable'
  const [updatingLinkSharing, setUpdatingLinkSharing] = useState(false)

  // モーダルを開いた状態として登録
  useEffect(() => {
    openModal(modalId)
    return () => {
      console.log(`ShareProjectModal unmounting: ${modalId}`)
      closeModal(modalId)
    }
  }, [openModal, closeModal, modalId])

  // 未保存の変更があるかチェック
  const hasUnsavedChanges = inviteEmail.trim() !== '' || inviteMessage.trim() !== ''

  // オーナー判定
  const isOwner = project.owner_id === user?.id

  // リンク共有のトグル
  const handleLinkSharingToggle = () => {
    const action = isLinkSharingEnabled ? 'disable' : 'enable'
    setLinkSharingAction(action)
    setShowLinkSharingWarning(true)
  }

  // リンク共有の確認後の処理
  const confirmLinkSharingChange = async () => {
    try {
      setUpdatingLinkSharing(true)
      const newValue = linkSharingAction === 'enable'

      const { data, error } = await supabase
        .from('projects')
        .update({ 
          is_link_sharing_enabled: newValue,
          updated_at: new Date().toISOString()
        })
        .eq('id', project.id)
        .select('is_link_sharing_enabled, link_sharing_token')
        .single()

      if (error) throw error

      setIsLinkSharingEnabled(data.is_link_sharing_enabled)
      setLinkSharingToken(data.link_sharing_token)
      
      toast.success(newValue ? 'リンク共有を有効にしました' : 'リンク共有を無効にしました')
      onUpdate()
    } catch (error) {
      console.error('Failed to update link sharing:', error)
      toast.error('設定の更新に失敗しました')
    } finally {
      setUpdatingLinkSharing(false)
      setShowLinkSharingWarning(false)
      setLinkSharingAction(null)
    }
  }

  // 共有リンクの生成
  const getShareLink = () => {
    if (!isLinkSharingEnabled || !linkSharingToken) return ''
    return `${window.location.origin}/projects/${project.id}?token=${linkSharingToken}`
  }

  const handleInviteMember = async (e) => {
    e.preventDefault()
    
    if (!inviteEmail.trim()) {
      toast.error('メールアドレスを入力してください')
      return
    }

    try {
      setLoading(true)

      // ユーザーが存在するかチェック
      const { data: userProfile, error: userError } = await supabase
        .from('profiles')
        .select('id, email, name')
        .eq('email', inviteEmail.trim().toLowerCase())
        .single()

      if (userError || !userProfile) {
        toast.error('指定されたメールアドレスのユーザーが見つかりません。このサービスに登録されているユーザーのみ招待できます。')
        return
      }

      // 既にメンバーかチェック（ローカル状態を参照）
      const existingMember = memberList.find(m => m.user_id === userProfile.id)
      if (existingMember) {
        toast.error('このユーザーは既にプロジェクトのメンバーです')
        return
      }

      // オーナーかチェック
      if (project.owner_id === userProfile.id) {
        toast.error('プロジェクトのオーナーは招待できません')
        return
      }

      // プロジェクトメンバーに追加
      const { error: memberError } = await supabase
        .from('project_members')
        .insert([{
          project_id: project.id,
          user_id: userProfile.id,
          role: inviteRole
        }])

      if (memberError) {
        throw memberError
      }

      // 招待レコードを作成（メール送信用）
      const { data: invitation, error: invitationError } = await supabase
        .from('project_invitations')
        .insert([{
          project_id: project.id,
          inviter_id: user.id,
          invitee_id: userProfile.id,
          invitee_email: inviteEmail.trim().toLowerCase(),
          role: inviteRole,
          message: inviteMessage.trim() || null,
          status: 'accepted',
          responded_at: new Date().toISOString()
        }])
        .select()
        .single()

      if (invitationError) {
        console.warn('Failed to create invitation record:', invitationError)
      } else {
        // Supabase Edge Functions経由でメール送信（supabase.functions.invokeでCORS/認証を処理）
        try {
          const { data: inviterProfile } = await supabase
            .from('profiles')
            .select('name, email')
            .eq('id', user.id)
            .single()

          const invokeResult = await supabase.functions.invoke('send-invitation-email', {
            body: {
              invitationId: invitation.id,
              projectId: project.id,
              projectName: project.name,
              projectDescription: project.description,
              projectColor: project.color || '#3b82f6',
              projectIcon: project.icon || '📂',
              inviterName: inviterProfile?.name || inviterProfile?.email || 'ユーザー',
              inviteeEmail: inviteEmail,
              role: inviteRole,
              message: inviteMessage.trim() || null,
              siteUrl: window.location.origin
            }
          })

          if (invokeResult.error) {
            console.warn('Failed to send invitation email via edge function:', invokeResult.error)
            toast('招待は成功しましたが、メール送信に失敗しました。', { icon: '⚠️' })
          }
        } catch (emailError) {
          console.warn('Failed to send invitation email via edge function:', emailError)
          toast('招待は成功しましたが、メール送信に失敗しました。', { icon: '⚠️' })
        }
      }

      // ローカル表示を即時更新
      setMemberList(prev => [
        ...prev,
        {
          project_id: project.id,
          user_id: userProfile.id,
          role: inviteRole,
          profiles: {
            name: userProfile.name,
            email: userProfile.email
          }
        }
      ])

      toast.success('メンバーを招待しました')
      setInviteEmail('')
      setInviteRole('viewer')
      setInviteMessage('')
      onUpdate()
    } catch (error) {
      console.error('Failed to invite member:', error)
      toast.error('メンバーの招待に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveMember = (member) => {
    setMemberToDelete(member)
    setShowConfirmDelete(true)
  }

  const confirmRemoveMember = async () => {
    try {
      const { error } = await supabase
        .from('project_members')
        .delete()
        .eq('project_id', memberToDelete.project_id)
        .eq('user_id', memberToDelete.user_id)

      if (error) throw error

      // 関連する招待レコードも削除（存在しない場合は無視）
      await supabase
        .from('project_invitations')
        .delete()
        .eq('project_id', memberToDelete.project_id)
        .eq('invitee_id', memberToDelete.user_id)

      toast.success('メンバーを削除しました')
      // ローカル表示からも即時削除
      setMemberList(prev => prev.filter(m => !(m.project_id === memberToDelete.project_id && m.user_id === memberToDelete.user_id)))
      onUpdate()
    } catch (error) {
      console.error('Failed to remove member:', error)
      toast.error('メンバーの削除に失敗しました')
    } finally {
      setShowConfirmDelete(false)
      setMemberToDelete(null)
    }
  }

  const handleUpdateMemberRole = async (member, newRole) => {
    try {
      const { error } = await supabase
        .from('project_members')
        .update({ role: newRole })
        .eq('project_id', member.project_id)
        .eq('user_id', member.user_id)

      if (error) throw error

      toast.success('権限を更新しました')
      onUpdate()
    } catch (error) {
      console.error('Failed to update member role:', error)
      toast.error('権限の更新に失敗しました')
    }
  }

  const handleCopyShareLink = async () => {
    try {
      setCopyLinkLoading(true)
      const shareUrl = getShareLink()
      await navigator.clipboard.writeText(shareUrl)
      toast.success('共有リンクをコピーしました')
    } catch (error) {
      console.error('Failed to copy link:', error)
      toast.error('リンクのコピーに失敗しました')
    } finally {
      setCopyLinkLoading(false)
    }
  }

  // トークン再生成
  const handleRegenerateToken = async () => {
    try {
      setUpdatingLinkSharing(true)
      const { data, error } = await supabase.rpc('regenerate_link_sharing_token', {
        p_project_id: project.id
      })

      if (error) throw error

      setLinkSharingToken(data)
      toast.success('共有リンクを再生成しました')
      onUpdate()
    } catch (error) {
      console.error('Failed to regenerate token:', error)
      toast.error('リンクの再生成に失敗しました')
    } finally {
      setUpdatingLinkSharing(false)
    }
  }

  return (
    <>
    <ProtectedModal 
      modalId={modalId}
      onClose={onClose}
      hasUnsavedChanges={hasUnsavedChanges}
      confirmMessage="入力内容が失われますが、よろしいですか？"
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">プロジェクトを共有</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
            >
              <span className="sr-only">閉じる</span>
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <div className="px-6 py-4 max-h-[calc(90vh-120px)] overflow-y-auto">
          {/* プロジェクト情報 */}
          <div className="mb-6">
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                style={{ backgroundColor: project.color || '#3b82f6' }}
              >
                {project.icon || '📂'}
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">{project.name}</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">{project.description || 'プロジェクトの説明はありません'}</p>
              </div>
            </div>
          </div>

          {/* リンク共有セクション */}
          {isOwner && (
            <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {isLinkSharingEnabled ? (
                    <Globe className="w-5 h-5 text-green-500" />
                  ) : (
                    <Lock className="w-5 h-5 text-gray-400" />
                  )}
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    リンク共有設定
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isLinkSharingEnabled}
                    onChange={handleLinkSharingToggle}
                    disabled={updatingLinkSharing}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                </label>
              </div>
              
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                {isLinkSharingEnabled 
                  ? 'リンクを知っている人は、アカウントがあれば誰でも閲覧できます（編集不可）'
                  : 'このプロジェクトは完全非公開です。オーナーと招待されたメンバーのみアクセスできます'}
              </p>

              {isLinkSharingEnabled && (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={getShareLink()}
                      readOnly
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-mono"
                    />
                    <button
                      onClick={handleCopyShareLink}
                      disabled={copyLinkLoading}
                      className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 text-sm flex items-center gap-2 whitespace-nowrap"
                    >
                      <Copy className="w-4 h-4" />
                      {copyLinkLoading ? 'コピー中...' : 'コピー'}
                    </button>
                  </div>
                  <button
                    onClick={handleRegenerateToken}
                    disabled={updatingLinkSharing}
                    className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
                  >
                    リンクを再生成する（既存のリンクは無効になります）
                  </button>
                </div>
              )}
            </div>
          )}

          {/* メンバー招待 */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <UserPlus className="w-5 h-5 text-gray-500" />
              <span className="font-medium text-gray-900 dark:text-gray-100">
                メンバーを招待
              </span>
            </div>
            <form onSubmit={handleInviteMember} className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="user@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="viewer">閲覧者</option>
                  <option value="editor">編集者</option>
                </select>
              </div>
              <textarea
                placeholder="招待メッセージ（任意）"
                value={inviteMessage}
                onChange={(e) => setInviteMessage(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 resize-none"
              />
              <div className="flex justify-between items-center">
                <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <Mail className="w-3 h-3" />
                  招待メールが送信されます
                </p>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 text-sm disabled:opacity-50 flex items-center gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  {loading ? '招待中...' : '招待'}
                </button>
              </div>
            </form>
          </div>

          {/* 現在のメンバー */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-5 h-5 text-gray-500" />
              <span className="font-medium text-gray-900 dark:text-gray-100">
                メンバー ({memberList.length + 1})
              </span>
            </div>
            <div className="space-y-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
              {/* オーナー */}
              <div className="flex items-center justify-between py-2 px-3 bg-white dark:bg-gray-800 rounded-lg">
                <div className="flex items-center">
                  <div className="w-9 h-9 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mr-3">
                    <span className="text-purple-600 dark:text-purple-400 font-medium text-sm">
                      {project.profiles?.name?.[0] || project.profiles?.email?.[0] || 'O'}
                    </span>
                  </div>
                  <div>
                    <div className="font-medium text-sm text-gray-900 dark:text-gray-100">
                      {project.profiles?.name || project.profiles?.email || 'オーナー'}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {project.profiles?.email || ''}
                    </div>
                  </div>
                </div>
                <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 rounded-full text-xs font-medium">
                  オーナー
                </span>
              </div>

              {/* メンバー */}
              {memberList.map((member) => (
                <div key={`${member.project_id}-${member.user_id}`} className="flex items-center justify-between py-2 px-3 bg-white dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center">
                    <div className="w-9 h-9 bg-gray-100 dark:bg-gray-600 rounded-full flex items-center justify-center mr-3">
                      <span className="text-gray-600 dark:text-gray-300 font-medium text-sm">
                        {member.profiles?.name?.[0] || member.profiles?.email?.[0] || 'U'}
                      </span>
                    </div>
                    <div>
                      <div className="font-medium text-sm text-gray-900 dark:text-gray-100">
                        {member.profiles?.name || member.profiles?.email || 'ユーザー'}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {member.profiles?.email || ''}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isOwner ? (
                      <>
                        <select
                          value={member.role}
                          onChange={(e) => handleUpdateMemberRole(member, e.target.value)}
                          className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        >
                          <option value="viewer">閲覧者</option>
                          <option value="editor">編集者</option>
                        </select>
                        <button
                          onClick={() => handleRemoveMember(member)}
                          className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-sm px-2 py-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                          title="削除"
                        >
                          削除
                        </button>
                      </>
                    ) : (
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        member.role === 'editor' 
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' 
                          : 'bg-gray-100 dark:bg-gray-600 text-gray-800 dark:text-gray-300'
                      }`}>
                        {member.role === 'editor' ? '編集者' : '閲覧者'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 権限の説明 */}
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
            <h5 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">権限について</h5>
            <div className="text-xs text-blue-700 dark:text-blue-400 space-y-1">
              <div className="flex items-start gap-2">
                <span className="px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 rounded text-[10px] font-medium">オーナー</span>
                <span>すべての操作が可能です（設定変更、メンバー管理、削除など）</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded text-[10px] font-medium">編集者</span>
                <span>参照の追加・編集・削除、メンバーの招待が可能です</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-600 text-gray-800 dark:text-gray-300 rounded text-[10px] font-medium">閲覧者</span>
                <span>プロジェクトと参照の閲覧のみ可能です</span>
              </div>
              {isLinkSharingEnabled && (
                <div className="flex items-start gap-2 mt-2 pt-2 border-t border-blue-200 dark:border-blue-700">
                  <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 rounded text-[10px] font-medium">リンク共有</span>
                  <span>リンクを知っている人は閲覧のみ可能です（メンバー一覧には表示されません）</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            閉じる
          </button>
        </div>
      </div>
    </ProtectedModal>

    {/* メンバー削除確認ダイアログ */}
    {showConfirmDelete && (
      <ConfirmDialog
        isOpen={showConfirmDelete}
        onClose={() => setShowConfirmDelete(false)}
        onConfirm={confirmRemoveMember}
        title="メンバーを削除"
        message="このメンバーをプロジェクトから削除しますか？この操作は取り消せません。"
        confirmText="削除"
        cancelText="キャンセル"
      />
    )}

    {/* リンク共有警告ダイアログ */}
    {showLinkSharingWarning && (
      <ConfirmDialog
        isOpen={showLinkSharingWarning}
        onClose={() => {
          setShowLinkSharingWarning(false)
          setLinkSharingAction(null)
        }}
        onConfirm={confirmLinkSharingChange}
        title={linkSharingAction === 'enable' ? 'リンク共有を有効にしますか？' : 'リンク共有を無効にしますか？'}
        message={
          linkSharingAction === 'enable'
            ? '有効にすると、共有リンクを知っている人は誰でもこのプロジェクトを閲覧できるようになります。\n\n・閲覧のみ可能（編集不可）\n・このサービスのアカウントが必要\n・メンバー一覧には表示されません\n\n機密情報を含むプロジェクトの場合は、メンバー招待機能をご利用ください。'
            : '無効にすると、共有リンクからのアクセスができなくなります。\n\n・既存のリンクは無効になります\n・招待されたメンバーは引き続きアクセス可能です'
        }
        confirmText={linkSharingAction === 'enable' ? '有効にする' : '無効にする'}
        cancelText="キャンセル"
        icon={<AlertTriangle className="w-6 h-6 text-amber-500" />}
      />
    )}
    </>
  )
}

export default ShareProjectModal
