import React, { createContext, useContext, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase, authHelpers, errorHelpers } from '../lib/supabase'
import { toast } from 'react-hot-toast'

// 認証コンテキストの作成
const AuthContext = createContext({
  user: null,
  session: null,
  loading: true,
  signUp: async () => {},
  signIn: async () => {},
  signOut: async () => {},
  resetPassword: async () => {},
  updateProfile: async () => {},
  deleteAccount: async () => {}
})

// 認証プロバイダーコンポーネント
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    // 初期セッションの取得
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Failed to get initial session:', error)
          throw error
        }

        if (mounted) {
          setSession(session)
          setUser(session?.user ?? null)
          setLoading(false)
        }
      } catch (error) {
        console.error('Session initialization error:', error)
        if (mounted) {
          setLoading(false)
        }
      }
    }

    getInitialSession()

    // 認証状態の変更を監視
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email)
        
        if (mounted) {
          setSession(session)
          setUser(session?.user ?? null)
          setLoading(false)
        }

        // イベントに応じた処理
        switch (event) {
          case 'SIGNED_IN':
            toast.success('ログインしました')
            break
          case 'SIGNED_OUT':
            toast.success('ログアウトしました')
            break
          case 'PASSWORD_RECOVERY':
            toast.success('パスワードリセットメールを送信しました')
            break
          case 'USER_UPDATED':
            toast.success('プロフィールを更新しました')
            break
          case 'TOKEN_REFRESHED':
            console.log('Token refreshed')
            break
        }
      }
    )

    return () => {
      mounted = false
      subscription?.unsubscribe()
    }
  }, [])

  // サインアップ
  const signUp = async (email, password, metadata = {}) => {
    try {
      setLoading(true)
      
      const { data, error } = await authHelpers.signUp(email, password, {
        name: metadata.name,
        ...metadata
      })

      if (error) {
        const translatedError = errorHelpers.translateError(error)
        toast.error(translatedError)
        throw error
      }

      // メール確認が必要な場合
      if (data.user && !data.session) {
        toast.success('確認メールを送信しました。メールをチェックしてアカウントを有効化してください。')
      }

      return { data, error: null }
    } catch (error) {
      console.error('Sign up error:', error)
      return { data: null, error }
    } finally {
      setLoading(false)
    }
  }

  // サインイン
  const signIn = async (email, password) => {
    try {
      setLoading(true)
      
      const { data, error } = await authHelpers.signIn(email, password)

      if (error) {
        const translatedError = errorHelpers.translateError(error)
        toast.error(translatedError)
        throw error
      }

      return { data, error: null }
    } catch (error) {
      console.error('Sign in error:', error)
      return { data: null, error }
    } finally {
      setLoading(false)
    }
  }

  // サインアウト
  const signOut = async () => {
    try {
      setLoading(true)
      
      const { error } = await authHelpers.signOut()

      if (error) {
        const translatedError = errorHelpers.translateError(error)
        toast.error(translatedError)
        throw error
      }

      // ローカルストレージのクリア
      localStorage.removeItem('researchvault-theme')
      localStorage.removeItem('researchvault-settings')

      return { error: null }
    } catch (error) {
      console.error('Sign out error:', error)
      return { error }
    } finally {
      setLoading(false)
    }
  }

  // パスワードリセット
  const resetPassword = async (email) => {
    try {
      const { data, error } = await authHelpers.resetPassword(email)

      if (error) {
        const translatedError = errorHelpers.translateError(error)
        toast.error(translatedError)
        throw error
      }

      toast.success('パスワードリセットメールを送信しました')
      return { data, error: null }
    } catch (error) {
      console.error('Password reset error:', error)
      return { data: null, error }
    }
  }

  // プロフィール更新
  const updateProfile = async (updates) => {
    try {
      setLoading(true)

      // ユーザーデータの更新
      const { data: authData, error: authError } = await authHelpers.updateProfile(updates)

      if (authError) {
        const translatedError = errorHelpers.translateError(authError)
        toast.error(translatedError)
        throw authError
      }

      // プロファイルテーブルの更新
      if (user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            name: updates.name,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id)

        if (profileError) {
          console.error('Profile update error:', profileError)
          // プロファイル更新エラーは致命的ではないので続行
        }
      }

      return { data: authData, error: null }
    } catch (error) {
      console.error('Update profile error:', error)
      return { data: null, error }
    } finally {
      setLoading(false)
    }
  }

  // アカウント削除
  const deleteAccount = async (password) => {
    try {
      setLoading(true)

      // パスワードで再認証
      if (user?.email) {
        const { error: reAuthError } = await supabase.auth.signInWithPassword({
          email: user.email,
          password
        })

        if (reAuthError) {
          const translatedError = errorHelpers.translateError(reAuthError)
          toast.error(translatedError)
          throw reAuthError
        }
      }

      // ユーザーデータの削除（Supabaseの削除トリガーでプロファイルとデータも削除される）
      const { error } = await supabase.auth.admin.deleteUser(user.id)

      if (error) {
        const translatedError = errorHelpers.translateError(error)
        toast.error(translatedError)
        throw error
      }

      toast.success('アカウントを削除しました')
      return { error: null }
    } catch (error) {
      console.error('Delete account error:', error)
      return { error }
    } finally {
      setLoading(false)
    }
  }

  // Google認証
  const signInWithGoogle = async () => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      })

      if (error) {
        const translatedError = errorHelpers.translateError(error)
        toast.error(translatedError)
        throw error
      }

      return { data, error: null }
    } catch (error) {
      console.error('Google sign in error:', error)
      return { data: null, error }
    }
  }

  // GitHub認証
  const signInWithGithub = async () => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      })

      if (error) {
        const translatedError = errorHelpers.translateError(error)
        toast.error(translatedError)
        throw error
      }

      return { data, error: null }
    } catch (error) {
      console.error('GitHub sign in error:', error)
      return { data: null, error }
    }
  }

  // パスワード更新
  const updatePassword = async (newPassword) => {
    try {
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (error) {
        const translatedError = errorHelpers.translateError(error)
        toast.error(translatedError)
        throw error
      }

      toast.success('パスワードを更新しました')
      return { data, error: null }
    } catch (error) {
      console.error('Update password error:', error)
      return { data: null, error }
    }
  }

  // メールアドレス更新
  const updateEmail = async (newEmail) => {
    try {
      const { data, error } = await supabase.auth.updateUser({
        email: newEmail
      })

      if (error) {
        const translatedError = errorHelpers.translateError(error)
        toast.error(translatedError)
        throw error
      }

      toast.success('確認メールを送信しました。新しいメールアドレスを確認してください。')
      return { data, error: null }
    } catch (error) {
      console.error('Update email error:', error)
      return { data: null, error }
    }
  }

  // 認証状態の確認
  const isAuthenticated = () => {
    return !!user && !!session
  }

  // ユーザーロールの確認
  const hasRole = (role) => {
    return user?.user_metadata?.role === role
  }

  // プレミアム機能の確認
  const isPremium = () => {
    return user?.user_metadata?.premium === true
  }

  const value = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    resetPassword,
    updateProfile,
    updatePassword,
    updateEmail,
    deleteAccount,
    signInWithGoogle,
    signInWithGithub,
    isAuthenticated,
    hasRole,
    isPremium
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

// カスタムフック
export function useAuth() {
  const context = useContext(AuthContext)
  
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  
  return context
}

// 認証が必要なコンポーネント用HOC
export function withAuth(Component) {
  return function AuthenticatedComponent(props) {
    const { user, loading } = useAuth()

    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="spinner w-8 h-8"></div>
        </div>
      )
    }

    if (!user) {
      return <Navigate to="/auth/login" replace />
    }

    return <Component {...props} />
  }
}

export default useAuth
