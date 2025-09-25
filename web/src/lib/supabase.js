import { createClient } from '@supabase/supabase-js'

// 環境変数からSupabaseの設定を取得
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// 環境変数が設定されていない場合のエラーハンドリング
if (!supabaseUrl) {
  throw new Error(
    'VITE_SUPABASE_URL is not set. Please add it to your .env.local file.\n' +
    'You can find this in your Supabase project settings.'
  )
}

if (!supabaseAnonKey) {
  throw new Error(
    'VITE_SUPABASE_ANON_KEY is not set. Please add it to your .env.local file.\n' +
    'You can find this in your Supabase project settings.'
  )
}

// Supabaseクライアントの作成
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
    flowType: 'pkce' // より安全な認証フロー
  },
  db: {
    schema: 'public'
  },
  global: {
    headers: {
      'X-Client-Info': 'researchvault-web@1.0.0'
    }
  }
})

// 認証状態の監視
export const authStateManager = {
  listeners: new Set(),
  
  subscribe(callback) {
    this.listeners.add(callback)
    
    // 購読解除関数を返す
    return () => {
      this.listeners.delete(callback)
    }
  },
  
  notify(session, event) {
    this.listeners.forEach(callback => {
      try {
        callback(session, event)
      } catch (error) {
        console.error('Auth state listener error:', error)
      }
    })
  }
}

// 認証状態の変更を監視
supabase.auth.onAuthStateChange((event, session) => {
  console.log('Auth state changed:', event, session?.user?.email)
  authStateManager.notify(session, event)
})

// ユーティリティ関数
export const authHelpers = {
  // 現在のユーザーを取得
  async getCurrentUser() {
    try {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error) throw error
      return user
    } catch (error) {
      console.error('Failed to get current user:', error)
      return null
    }
  },

  // 現在のセッションを取得
  async getCurrentSession() {
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error) throw error
      return session
    } catch (error) {
      console.error('Failed to get current session:', error)
      return null
    }
  },

  // サインアップ
  async signUp(email, password, metadata = {}) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata,
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      })
      
      if (error) throw error
      return { data, error: null }
    } catch (error) {
      console.error('Sign up error:', error)
      return { data: null, error }
    }
  },

  // サインイン
  async signIn(email, password) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })
      
      if (error) throw error
      return { data, error: null }
    } catch (error) {
      console.error('Sign in error:', error)
      return { data: null, error }
    }
  },

  // サインアウト
  async signOut() {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      return { error: null }
    } catch (error) {
      console.error('Sign out error:', error)
      return { error }
    }
  },

  // パスワードリセット
  async resetPassword(email) {
    try {
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`
      })
      
      if (error) throw error
      return { data, error: null }
    } catch (error) {
      console.error('Password reset error:', error)
      return { data: null, error }
    }
  },

  // プロフィール更新
  async updateProfile(updates) {
    try {
      const { data, error } = await supabase.auth.updateUser({
        data: updates
      })
      
      if (error) throw error
      return { data, error: null }
    } catch (error) {
      console.error('Profile update error:', error)
      return { data: null, error }
    }
  }
}

// データベースヘルパー
export const dbHelpers = {
  // プロジェクト関連
  async getProjects(userId) {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          project_members!inner(role),
          references(id)
        `)
        .or(`owner_id.eq.${userId},project_members.user_id.eq.${userId}`)
        .order('updated_at', { ascending: false })
      
      if (error) throw error
      
      // 参照数を計算
      return data.map(project => ({
        ...project,
        referenceCount: project.references?.length || 0,
        references: undefined // 参照リストは削除（メモリ節約）
      }))
    } catch (error) {
      console.error('Failed to get projects:', error)
      return []
    }
  },

  // 参照関連
  async getReferences(projectId = null, userId = null) {
    try {
      let query = supabase
        .from('references')
        .select(`
          *,
          projects(name),
          reference_tags(tags(name, color))
        `)
        .order('saved_at', { ascending: false })

      if (projectId) {
        query = query.eq('project_id', projectId)
      }
      
      if (userId) {
        query = query.eq('saved_by', userId)
      }

      const { data, error } = await query
      if (error) throw error
      
      return data
    } catch (error) {
      console.error('Failed to get references:', error)
      return []
    }
  },

  // 統計情報
  async getStatistics(userId) {
    try {
      const [projectsResult, referencesResult, textsResult] = await Promise.all([
        supabase
          .from('projects')
          .select('id', { count: 'exact' })
          .or(`owner_id.eq.${userId},project_members.user_id.eq.${userId}`),
        supabase
          .from('references')
          .select('id', { count: 'exact' })
          .eq('saved_by', userId),
        supabase
          .from('selected_texts')
          .select('id', { count: 'exact' })
          .eq('created_by', userId)
      ])

      return {
        projects: projectsResult.count || 0,
        references: referencesResult.count || 0,
        texts: textsResult.count || 0
      }
    } catch (error) {
      console.error('Failed to get statistics:', error)
      return { projects: 0, references: 0, texts: 0 }
    }
  }
}

// リアルタイム購読ヘルパー
export const realtimeHelpers = {
  // プロジェクトの変更を監視
  subscribeToProject(projectId, callback) {
    return supabase
      .channel(`project-${projectId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'references',
        filter: `project_id=eq.${projectId}`
      }, callback)
      .subscribe()
  },

  // 参照の変更を監視
  subscribeToReferences(userId, callback) {
    return supabase
      .channel(`user-references-${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'references',
        filter: `saved_by=eq.${userId}`
      }, callback)
      .subscribe()
  },

  // 購読解除
  unsubscribe(subscription) {
    return supabase.removeChannel(subscription)
  }
}

// エラーハンドリングヘルパー
export const errorHelpers = {
  // Supabaseエラーを日本語に変換
  translateError(error) {
    const errorMessages = {
      'Invalid login credentials': 'メールアドレスまたはパスワードが正しくありません',
      'Email not confirmed': 'メールアドレスが確認されていません',
      'User already registered': 'このメールアドレスは既に登録されています',
      'Password should be at least 6 characters': 'パスワードは6文字以上である必要があります',
      'Unable to validate email address: invalid format': 'メールアドレスの形式が正しくありません',
      'signup is disabled': 'アカウント作成は現在無効になっています',
      'Email rate limit exceeded': 'メール送信の制限に達しました。しばらく待ってから再試行してください'
    }

    return errorMessages[error.message] || error.message || '不明なエラーが発生しました'
  }
}

export default supabase
