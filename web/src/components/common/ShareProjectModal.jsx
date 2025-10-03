import React, { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { toast } from 'react-hot-toast'
import ConfirmDialog from './ConfirmDialog'

const ShareProjectModal = ({ project, members, onClose, onUpdate }) => {
  const [loading, setLoading] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('viewer')
  const [copyLinkLoading, setCopyLinkLoading] = useState(false)
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)
  const [memberToDelete, setMemberToDelete] = useState(null)

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
        .select('id, email')
        .eq('email', inviteEmail.trim())
        .single()

      if (userError || !userProfile) {
        toast.error('指定されたメールアドレスのユーザーが見つかりません')
        return
      }

      // 既にメンバーかチェック
      const existingMember = members.find(m => m.user_id === userProfile.id)
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

      toast.success('メンバーを招待しました')
      setInviteEmail('')
      setInviteRole('viewer')
      onUpdate()
    } catch (error) {
      console.error('Failed to invite member:', error)
      toast.error('メンバーの招待に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveMember = (memberId) => {
    setMemberToDelete(memberId)
    setShowConfirmDelete(true)
  }

  const confirmRemoveMember = async () => {
    try {
      const { error } = await supabase
        .from('project_members')
        .delete()
        .eq('id', memberToDelete)

      if (error) {throw error}

      toast.success('メンバーを削除しました')
      onUpdate()
    } catch (error) {
      console.error('Failed to remove member:', error)
      toast.error('メンバーの削除に失敗しました')
    } finally {
      setShowConfirmDelete(false)
      setMemberToDelete(null)
    }
  }

  const handleUpdateMemberRole = async (memberId, newRole) => {
    try {
      const { error } = await supabase
        .from('project_members')
        .update({ role: newRole })
        .eq('id', memberId)

      if (error) {throw error}

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
      const shareUrl = `${window.location.origin}/projects/${project.id}`
      await navigator.clipboard.writeText(shareUrl)
      toast.success('共有リンクをコピーしました')
    } catch (error) {
      console.error('Failed to copy link:', error)
      toast.error('リンクのコピーに失敗しました')
    } finally {
      setCopyLinkLoading(false)
    }
  }

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center p-4 z-50"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
    >
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">プロジェクトを共有</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <span className="sr-only">閉じる</span>
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="px-6 py-4 max-h-[calc(90vh-120px)] overflow-y-auto">
          {/* プロジェクト情報 */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-2">{project.name}</h3>
            <p className="text-gray-600 text-sm">{project.description || 'プロジェクトの説明はありません'}</p>
          </div>

          {/* 共有リンク */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              共有リンク
            </label>
            <div className="flex">
              <input
                type="text"
                value={`${window.location.origin}/projects/${project.id}`}
                readOnly
                className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md bg-gray-50 text-gray-600 text-sm"
              />
              <button
                onClick={handleCopyShareLink}
                disabled={copyLinkLoading}
                className="px-4 py-2 bg-primary-600 text-white rounded-r-md hover:bg-primary-700 text-sm"
              >
                {copyLinkLoading ? 'コピー中...' : 'コピー'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              このリンクにアクセスできるユーザーは、プロジェクトに参加できます
            </p>
          </div>

          {/* メンバー招待 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              メンバーを招待
            </label>
            <form onSubmit={handleInviteMember} className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="user@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="viewer">閲覧者</option>
                  <option value="editor">編集者</option>
                </select>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 text-sm disabled:opacity-50"
                >
                  {loading ? '招待中...' : '招待'}
                </button>
              </div>
            </form>
          </div>

          {/* 現在のメンバー */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">
              メンバー ({members.length + 1})
            </h4>
            <div className="space-y-3">
              {/* オーナー */}
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center mr-3">
                    <span className="text-purple-600 font-medium text-sm">
                      {project.profiles?.name?.[0] || project.profiles?.email?.[0] || 'O'}
                    </span>
                  </div>
                  <div>
                    <div className="font-medium text-sm">
                      {project.profiles?.name || project.profiles?.email || 'オーナー'}
                    </div>
                    <div className="text-xs text-gray-500">
                      {project.profiles?.email || ''}
                    </div>
                  </div>
                </div>
                <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">
                  オーナー
                </span>
              </div>

              {/* メンバー */}
              {members.map((member) => (
                <div key={member.id} className="flex items-center justify-between py-2">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center mr-3">
                      <span className="text-gray-600 font-medium text-sm">
                        {member.profiles?.name?.[0] || member.profiles?.email?.[0] || 'U'}
                      </span>
                    </div>
                    <div>
                      <div className="font-medium text-sm">
                        {member.profiles?.name || member.profiles?.email || 'ユーザー'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {member.profiles?.email || ''}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={member.role}
                      onChange={(e) => handleUpdateMemberRole(member.id, e.target.value)}
                      className="px-2 py-1 border border-gray-300 rounded text-xs"
                    >
                      <option value="viewer">閲覧者</option>
                      <option value="editor">編集者</option>
                    </select>
                    <button
                      onClick={() => handleRemoveMember(member.id)}
                      className="text-red-600 hover:text-red-700 text-sm"
                      title="削除"
                    >
                      削除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 権限の説明 */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h5 className="text-sm font-medium text-gray-700 mb-2">権限について</h5>
            <div className="text-xs text-gray-600 space-y-1">
              <div><strong>オーナー:</strong> すべての操作が可能です</div>
              <div><strong>編集者:</strong> 参照の追加・編集・削除、メンバーの招待が可能です</div>
              <div><strong>閲覧者:</strong> プロジェクトと参照の閲覧のみ可能です</div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            閉じる
          </button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={showConfirmDelete}
        onClose={() => setShowConfirmDelete(false)}
        onConfirm={confirmRemoveMember}
        title="メンバーを削除"
        message="このメンバーをプロジェクトから削除しますか？この操作は取り消せません。"
        confirmText="削除"
        cancelText="キャンセル"
      />
    </div>
  )
}

export default ShareProjectModal
