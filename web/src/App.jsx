import React, { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { ThemeProvider } from './hooks/useTheme'
import { ProjectProvider } from './hooks/useProjects'
import { handleComponentError } from './utils/errorHandler'

// レイアウトコンポーネント
import Layout from './components/layout/Layout'
import AuthLayout from './components/layout/AuthLayout'

// ページコンポーネント
import Dashboard from './pages/Dashboard'
import References from './pages/References'
import ReferenceDetail from './pages/ReferenceDetail'
import Projects from './pages/Projects'
import ProjectDetail from './pages/ProjectDetail'
import Citations from './pages/Citations'
import Settings from './pages/Settings'
import Account from './pages/Account'
import Login from './pages/auth/Login'
import Signup from './pages/auth/Signup'
import ForgotPassword from './pages/auth/ForgotPassword'
import ResetPassword from './pages/auth/ResetPassword'
import AuthCallback from './pages/auth/AuthCallback'
import NotFound from './pages/NotFound'
import Candidates from './pages/Candidates'
import Trash from './pages/Trash'
import Feedback from './pages/Feedback'
import Test from './pages/Test'
import DatabaseTest from './pages/DatabaseTest'

// プロテクトされたルートコンポーネント
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-secondary-50">
        <div className="text-center">
          <div className="spinner w-8 h-8 mx-auto mb-4"></div>
          <p className="text-secondary-600">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/auth/login" replace />
  }

  return children
}

// パブリックルート（認証済みユーザーはダッシュボードにリダイレクト）
function PublicRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-secondary-50">
        <div className="text-center">
          <div className="spinner w-8 h-8 mx-auto mb-4"></div>
          <p className="text-secondary-600">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (user) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

// エラーバウンダリコンポーネント
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    handleComponentError(error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-red-50">
          <div className="text-center max-w-md mx-auto p-6">
            <div className="mb-6">
              <img 
                src="../favicon/android-chrome-192x192.png" 
                alt="ResearchVault" 
                className="w-16 h-16 mx-auto"
              />
            </div>
            <h1 className="text-2xl font-bold text-red-900 mb-2">
              申し訳ございません
            </h1>
            <p className="text-red-700 mb-6">
              ResearchVaultでエラーが発生しました
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-md font-medium"
            >
              もう一度試す
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

// メインAppコンポーネント
function App() {
  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    // アプリケーションの初期化処理
    const initializeApp = async () => {
      try {
        // 必要な初期化処理があればここに記述
        console.log('ResearchVault initializing...')
        
        // テーマの初期設定
        const savedTheme = localStorage.getItem('researchvault-theme')
        if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
          document.documentElement.classList.add('dark')
        }

        setIsInitialized(true)
        console.log('ResearchVault initialized successfully')
      } catch (error) {
        console.error('App initialization failed:', error)
        setIsInitialized(true) // エラーでも続行
      }
    }

    initializeApp()
  }, [])

  // 初期化中の表示
  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="mb-6">
            <img 
              src="../favicon/android-chrome-192x192.png" 
              alt="ResearchVault" 
              className="w-16 h-16 mx-auto"
            />
          </div>
          <h1 className="text-2xl font-bold text-secondary-900 mb-2">
            ResearchVault
          </h1>
          <p className="text-secondary-600 mb-6">
            研究資料管理システム
          </p>
          <div className="spinner w-8 h-8 mx-auto"></div>
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <div className="App">
            <SpeedInsights />
            <Routes>
            {/* 認証関連のルート */}
            <Route
              path="/auth/login"
              element={
                <PublicRoute>
                  <AuthLayout>
                    <Login />
                  </AuthLayout>
                </PublicRoute>
              }
            />
            <Route
              path="/auth/signup"
              element={
                <PublicRoute>
                  <AuthLayout>
                    <Signup />
                  </AuthLayout>
                </PublicRoute>
              }
            />
            <Route
              path="/auth/forgot-password"
              element={
                <PublicRoute>
                  <AuthLayout>
                    <ForgotPassword />
                  </AuthLayout>
                </PublicRoute>
              }
            />
            <Route
              path="/auth/reset-password"
              element={
                <PublicRoute>
                  <AuthLayout>
                    <ResetPassword />
                  </AuthLayout>
                </PublicRoute>
              }
            />
            <Route path="/auth/callback" element={<AuthCallback />} />

            {/* メインアプリケーションのルート */}
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <ProjectProvider>
                    <Layout>
                      <Routes>
                        {/* ダッシュボード */}
                        <Route path="/dashboard" element={<Dashboard />} />
                        
                        {/* 参照管理 */}
                        <Route path="/references" element={<References />} />
                        <Route path="/references/:id" element={<ReferenceDetail />} />
                        
                        {/* プロジェクト管理 */}
                        <Route path="/projects" element={<Projects />} />
                        <Route path="/projects/:id" element={<ProjectDetail />} />
                        
                        {/* 引用生成 */}
                        <Route path="/citations" element={<Citations />} />
                        
                        {/* 設定 */}
                        <Route path="/settings" element={<Settings />} />
                        <Route path="/account" element={<Account />} />
                        
                        {/* その他の機能 */}
                        <Route path="/candidates" element={<Candidates />} />
                        <Route path="/trash" element={<Trash />} />
                        <Route path="/feedback" element={<Feedback />} />
                        <Route path="/test" element={<Test />} />
                        <Route path="/database-test" element={<DatabaseTest />} />
                        
                        {/* ルートパスはダッシュボードにリダイレクト */}
                        <Route path="/" element={<Navigate to="/dashboard" replace />} />
                        
                        {/* 404ページ */}
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </Layout>
                  </ProjectProvider>
                </ProtectedRoute>
              }
            />
            </Routes>
          </div>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}

export default App
