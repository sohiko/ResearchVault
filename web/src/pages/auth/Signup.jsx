import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { toast } from 'react-hot-toast'

export default function Signup() {
  const { signUp, loading } = useAuth()
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    agreeToTerms: false
  })

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const validateForm = () => {
    if (!formData.name.trim()) {
      toast.error('名前を入力してください')
      return false
    }
    
    if (!formData.email.trim()) {
      toast.error('メールアドレスを入力してください')
      return false
    }
    
    if (formData.password.length < 6) {
      toast.error('パスワードは6文字以上で入力してください')
      return false
    }
    
    if (formData.password !== formData.confirmPassword) {
      toast.error('パスワードが一致しません')
      return false
    }
    
    if (!formData.agreeToTerms) {
      toast.error('利用規約への同意が必要です')
      return false
    }
    
    return true
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    try {
      const { data, error } = await signUp(formData.email, formData.password, {
        name: formData.name
      })
      
      if (error) {
        console.error('Signup error:', error)
        if (error.message.includes('already registered')) {
          toast.error('このメールアドレスは既に登録されています')
        } else {
          toast.error('アカウント作成に失敗しました')
        }
        return
      }

      // アカウント作成成功
      toast.success('アカウントが作成されました！メールを確認してください')
      navigate('/auth/login')
    } catch (error) {
      console.error('Signup error:', error)
      toast.error('アカウント作成に失敗しました')
    }
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-secondary-900 dark:text-secondary-100">
          アカウント作成
        </h2>
        <p className="mt-2 text-sm text-secondary-600 dark:text-secondary-400">
          ResearchVaultで研究活動を始めましょう
        </p>
      </div>

      {/* サインアップフォーム */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-secondary-700 dark:text-secondary-300">
            名前
          </label>
          <div className="mt-1">
            <input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              required
              value={formData.name}
              onChange={handleChange}
              className="input-field"
              placeholder="あなたの名前"
            />
          </div>
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-secondary-700 dark:text-secondary-300">
            メールアドレス
          </label>
          <div className="mt-1">
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={formData.email}
              onChange={handleChange}
              className="input-field"
              placeholder="example@email.com"
            />
          </div>
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-secondary-700 dark:text-secondary-300">
            パスワード
          </label>
          <div className="mt-1">
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              value={formData.password}
              onChange={handleChange}
              className="input-field"
              placeholder="6文字以上のパスワード"
            />
          </div>
          <p className="mt-1 text-xs text-secondary-500 dark:text-secondary-400">
            パスワードは6文字以上で入力してください
          </p>
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-secondary-700 dark:text-secondary-300">
            パスワード確認
          </label>
          <div className="mt-1">
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              value={formData.confirmPassword}
              onChange={handleChange}
              className="input-field"
              placeholder="パスワードを再入力"
            />
          </div>
        </div>

        <div>
          <div className="flex items-start">
            <input
              id="agreeToTerms"
              name="agreeToTerms"
              type="checkbox"
              checked={formData.agreeToTerms}
              onChange={handleChange}
              className="h-4 w-4 mt-1 text-primary-600 focus:ring-primary-500 border-secondary-300 rounded"
            />
            <label htmlFor="agreeToTerms" className="ml-3 block text-sm text-secondary-700 dark:text-secondary-300">
              <Link to="/terms" className="text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300">
                利用規約
              </Link>
              {' '}と{' '}
              <Link to="/privacy" className="text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300">
                プライバシーポリシー
              </Link>
              に同意します
            </label>
          </div>
        </div>

        <div>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full"
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <div className="spinner w-4 h-4 mr-2"></div>
                アカウント作成中...
              </div>
            ) : (
              'アカウント作成'
            )}
          </button>
        </div>
      </form>

      {/* ソーシャル登録 */}
      <div>
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-secondary-300 dark:border-secondary-600" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white dark:bg-secondary-800 text-secondary-500 dark:text-secondary-400">
              または
            </span>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            className="btn-outline w-full"
            onClick={() => toast.info('Google認証は準備中です')}
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Google
          </button>

          <button
            type="button"
            className="btn-outline w-full"
            onClick={() => toast.info('GitHub認証は準備中です')}
          >
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
            GitHub
          </button>
        </div>
      </div>

      {/* ログインリンク */}
      <div className="text-center">
        <p className="text-sm text-secondary-600 dark:text-secondary-400">
          既にアカウントをお持ちの方は{' '}
          <Link
            to="/auth/login"
            className="font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300"
          >
            ログイン
          </Link>
        </p>
      </div>
    </div>
  )
}
