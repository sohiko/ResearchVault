import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { toast } from 'react-hot-toast'

export default function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    // URLのハッシュからトークンを取得
    const handleAuthCallback = async () => {
      try {
        // Supabaseが自動的にセッションを処理
        const { data: { session }, error } = await supabase.auth.getSession()

        if (error) {
          throw error
        }

        if (session) {
          // プロファイルの作成/更新
          const { error: profileError } = await supabase
            .from('profiles')
            .upsert({
              id: session.user.id,
              email: session.user.email,
              name: session.user.user_metadata?.name || session.user.user_metadata?.full_name || session.user.email?.split('@')[0],
              avatar_url: session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture,
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'id'
            })

          if (profileError) {
            console.error('Profile upsert error:', profileError)
          }

          toast.success('ログインしました')
          navigate('/dashboard')
        } else {
          toast.error('認証に失敗しました')
          navigate('/auth/login')
        }
      } catch (error) {
        console.error('Auth callback error:', error)
        toast.error('認証処理中にエラーが発生しました')
        navigate('/auth/login')
      }
    }

    handleAuthCallback()
  }, [navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary-50 dark:bg-secondary-900">
      <div className="text-center">
        <div className="spinner w-12 h-12 mx-auto mb-4"></div>
        <p className="text-secondary-600 dark:text-secondary-400">認証処理中...</p>
      </div>
    </div>
  )
}
