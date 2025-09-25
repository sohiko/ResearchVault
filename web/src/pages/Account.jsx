import React, { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { toast } from 'react-hot-toast'
import ConfirmDialog from '../components/common/ConfirmDialog'

export default function Account() {
  const { user, signOut } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showPasswordChangeForm, setShowPasswordChangeForm] = useState(false)
  
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    created_at: null
  })
  
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  
  const [statistics, setStatistics] = useState({
    projects: 0,
    references: 0,
    selectedTexts: 0,
    bookmarks: 0
  })

  useEffect(() => {
    if (user) {
      loadAccountData()
    }
  }, [user])

  const loadAccountData = async () => {
    try {
      setLoading(true)
      
      // プロファイル情報を取得
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profileError && profileError.code !== 'PGRST116') {
        throw profileError
      }

      // 統計情報を並行取得
      const [projectsResult, referencesResult, textsResult, bookmarksResult] = await Promise.all([
        supabase.from('projects').select('id', { count: 'exact' }).eq('owner_id', user.id),
        supabase.from('references').select('id', { count: 'exact' }).eq('saved_by', user.id),
        supabase.from('selected_texts').select('id', { count: 'exact' }).eq('created_by', user.id),
        supabase.from('bookmarks').select('id', { count: 'exact' }).eq('created_by', user.id)
      ])

      setProfile({
        name: profileData?.name || user.user_metadata?.name || '',
        email: user.email || '',
        created_at: user.created_at
      })

      setStatistics({
        projects: projectsResult.count || 0,
        references: referencesResult.count || 0,
        selectedTexts: textsResult.count || 0,
        bookmarks: bookmarksResult.count || 0
      })

    } catch (error) {
      console.error('Failed to load account data:', error)
      toast.error('アカウント情報の読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleProfileUpdate = async (e) => {
    e.preventDefault()
    
    try {
      setSaving(true)
      
      // プロファイル情報を更新
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          name: profile.name,
          email: profile.email,
          updated_at: new Date().toISOString()
        })

      if (profileError) {
        throw profileError
      }

      // ユーザーメタデータも更新
      const { error: authError } = await supabase.auth.updateUser({
        data: { name: profile.name }
      })

      if (authError) {
        throw authError
      }

      toast.success('プロファイルを更新しました')
      
    } catch (error) {
      console.error('Failed to update profile:', error)
      toast.error('プロファイルの更新に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordChange = async (e) => {
    e.preventDefault()
    
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('新しいパスワードが一致しません')
      return
    }

    if (passwordForm.newPassword.length < 6) {
      toast.error('パスワードは6文字以上で入力してください')
      return
    }

    try {
      setSaving(true)
      
      const { error } = await supabase.auth.updateUser({
        password: passwordForm.newPassword
      })

      if (error) {
        throw error
      }

      toast.success('パスワードを変更しました')
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      })
      setShowPasswordChangeForm(false)
      
    } catch (error) {
      console.error('Failed to change password:', error)
      toast.error('パスワードの変更に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const handleAccountDelete = async () => {
    try {
      setSaving(true)
      
      // まず関連データを削除
      const tablesToCleanup = [
        'bookmarks',
        'selected_texts', 
        'reference_tags',
        'references',
        'project_members',
        'projects',
        'citation_settings',
        'activity_logs'
      ]

      for (const table of tablesToCleanup) {
        try {
          if (table === 'projects') {
            await supabase.from(table).delete().eq('owner_id', user.id)
          } else if (['project_members', 'activity_logs'].includes(table)) {
            await supabase.from(table).delete().eq('user_id', user.id)
          } else if (table === 'references') {
            await supabase.from(table).delete().eq('saved_by', user.id)
          } else if (['selected_texts', 'bookmarks'].includes(table)) {
            await supabase.from(table).delete().eq('created_by', user.id)
          } else if (table === 'citation_settings') {
            await supabase.from(table).delete().eq('user_id', user.id)
          } else if (table === 'reference_tags') {
            // 参照に関連するタグを削除
            const { data: refs } = await supabase
              .from('references')
              .select('id')
              .eq('saved_by', user.id)
            
            if (refs && refs.length > 0) {
              await supabase
                .from('reference_tags')
                .delete()
                .in('reference_id', refs.map(r => r.id))
            }
          }
        } catch (cleanupError) {
          console.warn(`Failed to cleanup ${table}:`, cleanupError)
        }
      }

      // プロファイルを削除
      await supabase.from('profiles').delete().eq('id', user.id)

      // 最後にユーザーアカウントを削除
      const { error } = await supabase.rpc('delete_user')

      if (error) {
        console.error('Failed to delete user account:', error)
        toast.error('アカウント削除に失敗しました。管理者にお問い合わせください。')
        return
      }

      toast.success('アカウントを削除しました')
      await signOut()
      
    } catch (error) {
      console.error('Failed to delete account:', error)
      toast.error('アカウント削除に失敗しました')
    } finally {
      setSaving(false)
      setShowDeleteConfirm(false)
    }
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-secondary-900 dark:text-secondary-100">
          アカウント設定
        </h1>
        <p className="text-secondary-600 dark:text-secondary-400">
          アカウント情報の管理と設定を行います
        </p>
      </div>

      {/* アカウント統計 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
            {statistics.projects}
          </div>
          <div className="text-sm text-secondary-600 dark:text-secondary-400">
            プロジェクト
          </div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {statistics.references}
          </div>
          <div className="text-sm text-secondary-600 dark:text-secondary-400">
            参照
          </div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {statistics.selectedTexts}
          </div>
          <div className="text-sm text-secondary-600 dark:text-secondary-400">
            選択テキスト
          </div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
            {statistics.bookmarks}
          </div>
          <div className="text-sm text-secondary-600 dark:text-secondary-400">
            ブックマーク
          </div>
        </div>
      </div>

      {/* 基本情報 */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-secondary-900 dark:text-secondary-100 mb-4">
          基本情報
        </h2>
        
        <form onSubmit={handleProfileUpdate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-1">
              名前
            </label>
            <input
              type="text"
              value={profile.name}
              onChange={(e) => setProfile({...profile, name: e.target.value})}
              className="input-field"
              placeholder="お名前を入力"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-1">
              メールアドレス
            </label>
            <input
              type="email"
              value={profile.email}
              readOnly
              className="input-field bg-secondary-50 dark:bg-secondary-800 cursor-not-allowed"
            />
            <p className="text-xs text-secondary-500 mt-1">
              メールアドレスの変更はサポートまでお問い合わせください
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-1">
              登録日
            </label>
            <input
              type="text"
              value={profile.created_at ? formatDate(profile.created_at) : ''}
              readOnly
              className="input-field bg-secondary-50 dark:bg-secondary-800 cursor-not-allowed"
            />
          </div>
          
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="btn-primary"
            >
              {saving ? '保存中...' : '基本情報を保存'}
            </button>
          </div>
        </form>
      </div>

      {/* パスワード変更 */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-secondary-900 dark:text-secondary-100 mb-4">
          パスワード変更
        </h2>
        
        {!showPasswordChangeForm ? (
          <div>
            <p className="text-secondary-600 dark:text-secondary-400 mb-4">
              セキュリティのため、定期的にパスワードを変更することをお勧めします。
            </p>
            <button
              onClick={() => setShowPasswordChangeForm(true)}
              className="btn-secondary"
            >
              パスワードを変更
            </button>
          </div>
        ) : (
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-1">
                新しいパスワード
              </label>
              <input
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({...passwordForm, newPassword: e.target.value})}
                className="input-field"
                placeholder="新しいパスワード（6文字以上）"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-1">
                パスワード確認
              </label>
              <input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm({...passwordForm, confirmPassword: e.target.value})}
                className="input-field"
                placeholder="パスワードを再入力"
                required
              />
            </div>
            
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => {
                  setShowPasswordChangeForm(false)
                  setPasswordForm({currentPassword: '', newPassword: '', confirmPassword: ''})
                }}
                className="btn-secondary"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={saving}
                className="btn-primary"
              >
                {saving ? '変更中...' : 'パスワードを変更'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* データエクスポート */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-secondary-900 dark:text-secondary-100 mb-4">
          データ管理
        </h2>
        
        <div className="space-y-4">
          <div>
            <h3 className="font-medium text-secondary-900 dark:text-secondary-100 mb-2">
              データエクスポート
            </h3>
            <p className="text-secondary-600 dark:text-secondary-400 text-sm mb-3">
              保存されたすべてのデータをJSON形式でダウンロードできます。
            </p>
            <button className="btn-secondary" disabled>
              データをエクスポート（準備中）
            </button>
          </div>
        </div>
      </div>

      {/* 危険な操作 */}
      <div className="card p-6 border-l-4 border-red-500">
        <h2 className="text-lg font-semibold text-red-700 dark:text-red-400 mb-4">
          危険な操作
        </h2>
        
        <div className="space-y-4">
          <div>
            <h3 className="font-medium text-secondary-900 dark:text-secondary-100 mb-2">
              アカウント削除
            </h3>
            <p className="text-secondary-600 dark:text-secondary-400 text-sm mb-3">
              アカウントを削除すると、すべてのプロジェクト、参照、設定が永久に失われます。
              この操作は取り消すことができません。
            </p>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
            >
              アカウントを削除
            </button>
          </div>
        </div>
      </div>

      {/* 削除確認ダイアログ */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleAccountDelete}
        title="アカウント削除の確認"
        message="本当にアカウントを削除しますか？すべてのデータが永久に失われ、この操作は取り消せません。"
        confirmText="削除する"
        cancelText="キャンセル"
      />
    </div>
  )
}
