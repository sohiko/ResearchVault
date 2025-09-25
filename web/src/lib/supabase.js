import { createClient } from '@supabase/supabase-js'
import { ResearchVaultError, ERROR_TYPES, ERROR_LEVELS, handleError, withRetry } from '../utils/errorHandler.js'

// Supabaseの設定（環境変数またはフォールバック値）
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://pzplwtvnxikhykqsvcfs.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6cGx3dHZueGlraHlrcXN2Y2ZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3NTg3NzQsImV4cCI6MjA3NDMzNDc3NH0.k8h6E0QlW2549ILvrR5NeMdzJMmhmekj6O_GZ3C43V0'

// 環境変数が設定されていない場合は警告を表示
if (!import.meta.env.VITE_SUPABASE_URL) {
  console.warn('VITE_SUPABASE_URL is not set, using fallback value. Please add it to your .env.local file for production.');
}

if (!import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.warn('VITE_SUPABASE_ANON_KEY is not set, using fallback value. Please add it to your .env.local file for production.');
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
    if (typeof callback !== 'function') {
      throw new ResearchVaultError(
        'Callback must be a function',
        ERROR_TYPES.VALIDATION,
        ERROR_LEVELS.LOW,
        { callbackType: typeof callback }
      )
    }
    
    this.listeners.add(callback)
    
    // 購読解除関数を返す
    return () => {
      this.listeners.delete(callback)
    }
  },
  
  async notify(session, event) {
    const promises = Array.from(this.listeners).map(async (callback) => {
      try {
        await callback(session, event)
      } catch (error) {
        await handleError(error, {
          method: 'authStateListener',
          component: 'authStateManager',
          event,
          hasSession: !!session
        })
      }
    })
    
    // 全てのリスナーの完了を待つ（エラーは個別に処理済み）
    await Promise.allSettled(promises)
  }
}

// 認証状態の変更を監視
supabase.auth.onAuthStateChange(async (event, session) => {
  console.log('Auth state changed:', event, session?.user?.email)
  try {
    await authStateManager.notify(session, event)
  } catch (error) {
    await handleError(error, {
      method: 'onAuthStateChange',
      component: 'supabase',
      event
    })
  }
})

// ユーティリティ関数
export const authHelpers = {
  // 現在のユーザーを取得
  async getCurrentUser() {
    try {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error) {
        throw new ResearchVaultError(
          error.message,
          ERROR_TYPES.AUTH,
          ERROR_LEVELS.MEDIUM,
          { operation: 'getCurrentUser' },
          error
        )
      }
      return user
    } catch (error) {
      if (error instanceof ResearchVaultError) {
        await handleError(error)
      } else {
        await handleError(error, {
          method: 'getCurrentUser',
          component: 'authHelpers'
        })
      }
      return null
    }
  },

  // 現在のセッションを取得
  async getCurrentSession() {
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error) {
        throw new ResearchVaultError(
          error.message,
          ERROR_TYPES.AUTH,
          ERROR_LEVELS.MEDIUM,
          { operation: 'getCurrentSession' },
          error
        )
      }
      return session
    } catch (error) {
      if (error instanceof ResearchVaultError) {
        await handleError(error)
      } else {
        await handleError(error, {
          method: 'getCurrentSession',
          component: 'authHelpers'
        })
      }
      return null
    }
  },

  // サインアップ
  async signUp(email, password, metadata = {}) {
    try {
      // 入力値検証
      if (!email || !password) {
        throw new ResearchVaultError(
          'メールアドレスとパスワードが必要です',
          ERROR_TYPES.VALIDATION,
          ERROR_LEVELS.LOW,
          { hasEmail: !!email, hasPassword: !!password }
        )
      }

      const { data, error } = await withRetry(async () => {
        return await supabase.auth.signUp({
          email,
          password,
          options: {
            data: metadata,
            emailRedirectTo: `${window.location.origin}/auth/callback`
          }
        })
      })
      
      if (error) {
        throw new ResearchVaultError(
          error.message,
          ERROR_TYPES.AUTH,
          ERROR_LEVELS.MEDIUM,
          { operation: 'signUp', email, metadata: Object.keys(metadata) },
          error
        )
      }
      
      return { data, error: null }
    } catch (error) {
      if (error instanceof ResearchVaultError) {
        await handleError(error)
        return { data: null, error }
      } else {
        const rvError = await handleError(error, {
          method: 'signUp',
          component: 'authHelpers',
          email
        })
        return { data: null, error: rvError }
      }
    }
  },

  // サインイン
  async signIn(email, password) {
    try {
      // 入力値検証
      if (!email || !password) {
        throw new ResearchVaultError(
          'メールアドレスとパスワードが必要です',
          ERROR_TYPES.VALIDATION,
          ERROR_LEVELS.LOW,
          { hasEmail: !!email, hasPassword: !!password }
        )
      }

      const { data, error } = await withRetry(async () => {
        return await supabase.auth.signInWithPassword({
          email,
          password
        })
      })
      
      if (error) {
        throw new ResearchVaultError(
          error.message,
          ERROR_TYPES.AUTH,
          ERROR_LEVELS.MEDIUM,
          { operation: 'signIn', email },
          error
        )
      }
      
      return { data, error: null }
    } catch (error) {
      if (error instanceof ResearchVaultError) {
        await handleError(error)
        return { data: null, error }
      } else {
        const rvError = await handleError(error, {
          method: 'signIn',
          component: 'authHelpers',
          email
        })
        return { data: null, error: rvError }
      }
    }
  },

  // サインアウト
  async signOut() {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) {throw error}
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
      
      if (error) {throw error}
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
      
      if (error) {throw error}
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
      
      if (error) {throw error}
      
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
      if (error) {throw error}
      
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
