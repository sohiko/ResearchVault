import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App.jsx'
import './styles/globals.css'
import { handleComponentError, ErrorHandler } from './utils/errorHandler.js'

// 高度なエラーバウンダリーコンポーネント
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      errorId: null,
      retryCount: 0
    }
    this.errorHandler = new ErrorHandler({
      enableReporting: import.meta.env.PROD,
      enableToasts: false // ErrorBoundaryでは独自UI表示
    })
  }

  static getDerivedStateFromError(_error) {
    return { 
      hasError: true,
      errorId: `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }
  }

  async componentDidCatch(error, errorInfo) {
    this.setState({
      error,
      errorInfo
    })
    
    // 統一エラーハンドリングシステムを使用
    await handleComponentError(error, errorInfo)
    
    // ユーザー行動の記録（分析用）
    this.recordUserAction('error_boundary_triggered', {
      errorMessage: error.message,
      componentStack: errorInfo.componentStack,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString()
    })
  }

  recordUserAction(action, data) {
    try {
      // ユーザー行動の記録（分析やサポート用）
      if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('event', action, {
          custom_parameter_1: JSON.stringify(data)
        })
      }
      
      // ローカルストレージにも記録（オフライン時の分析用）
      const logs = JSON.parse(localStorage.getItem('researchvault_error_logs') || '[]')
      logs.push({ action, data, timestamp: new Date().toISOString() })
      
      // 最新の10件のみ保持
      if (logs.length > 10) {
        logs.splice(0, logs.length - 10)
      }
      
      localStorage.setItem('researchvault_error_logs', JSON.stringify(logs))
    } catch (e) {
      console.warn('Failed to record user action:', e)
    }
  }

  handleRetry = () => {
    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prevState.retryCount + 1
    }))
    
    this.recordUserAction('error_boundary_retry', {
      retryCount: this.state.retryCount + 1,
      errorId: this.state.errorId
    })
  }

  handleReload = () => {
    this.recordUserAction('error_boundary_reload', {
      errorId: this.state.errorId
    })
    window.location.reload()
  }

  handleReportIssue = () => {
    const subject = encodeURIComponent(`ResearchVault エラー報告 - ${this.state.errorId}`)
    const body = encodeURIComponent(`
エラーID: ${this.state.errorId}
発生時刻: ${new Date().toLocaleString()}
URL: ${window.location.href}
エラー内容: ${this.state.error?.message || '不明'}

追加情報:
- ブラウザ: ${navigator.userAgent}
- 再試行回数: ${this.state.retryCount}

※ このエラーについて詳細を教えてください
    `)
    
    window.open(`mailto:support@researchvault.com?subject=${subject}&body=${body}`)
    
    this.recordUserAction('error_boundary_report', {
      errorId: this.state.errorId
    })
  }

  render() {
    if (this.state.hasError) {
      const isProductionError = import.meta.env.PROD
      const canRetry = this.state.retryCount < 3
      
      return (
        <div className="min-h-screen flex items-center justify-center bg-secondary-50">
          <div className="max-w-lg mx-auto text-center p-6">
            {/* エラーアイコン */}
            <div className="mb-6">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-error-100">
                <svg className="h-8 w-8 text-error-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
            </div>

            {/* エラーメッセージ */}
            <h1 className="text-2xl font-bold text-secondary-900 mb-3">
              申し訳ございません
            </h1>
            <p className="text-secondary-600 mb-2">
              ResearchVaultでエラーが発生しました
            </p>
            {this.state.retryCount > 0 && (
              <p className="text-sm text-secondary-500 mb-6">
                再試行回数: {this.state.retryCount} / 3
              </p>
            )}
            {!isProductionError && (
              <p className="text-xs text-secondary-500 mb-6">
                エラーID: {this.state.errorId}
              </p>
            )}

            {/* アクションボタン */}
            <div className="space-y-3 mb-6">
              {canRetry ? (
                <button
                  onClick={this.handleRetry}
                  className="btn-primary w-full flex items-center justify-center"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  もう一度試す
                </button>
              ) : (
                <button
                  onClick={this.handleReload}
                  className="btn-primary w-full flex items-center justify-center"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  ページを再読み込み
                </button>
              )}
              
              <button
                onClick={this.handleReportIssue}
                className="btn-outline w-full flex items-center justify-center"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                問題を報告
              </button>
            </div>

            {/* 開発環境でのエラー詳細 */}
            {!isProductionError && this.state.error && (
              <details className="text-left bg-white rounded-lg border border-secondary-200 p-4">
                <summary className="cursor-pointer text-sm font-medium text-secondary-700 hover:text-secondary-900 mb-2">
                  🔧 開発者向け詳細情報
                </summary>
                <div className="space-y-3">
                  <div>
                    <h4 className="text-xs font-semibold text-secondary-600 mb-1">エラーメッセージ:</h4>
                    <pre className="text-xs bg-red-50 p-2 rounded border overflow-auto text-red-800">
                      {this.state.error.toString()}
                    </pre>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-secondary-600 mb-1">コンポーネントスタック:</h4>
                    <pre className="text-xs bg-secondary-50 p-2 rounded border overflow-auto max-h-32 text-secondary-700">
                      {this.state.errorInfo?.componentStack}
                    </pre>
                  </div>
                  {this.state.error.stack && (
                    <div>
                      <h4 className="text-xs font-semibold text-secondary-600 mb-1">スタックトレース:</h4>
                      <pre className="text-xs bg-secondary-50 p-2 rounded border overflow-auto max-h-32 text-secondary-700">
                        {this.state.error.stack}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            )}

            {/* ヘルプリンク */}
            <div className="mt-8 pt-6 border-t border-secondary-200">
              <p className="text-xs text-secondary-500 mb-2">
                問題が解決しない場合は、以下のリソースをご確認ください:
              </p>
              <div className="flex justify-center space-x-4 text-xs">
                <a 
                  href="/help" 
                  className="text-primary-600 hover:text-primary-700 underline"
                  onClick={(e) => {
                    e.preventDefault()
                    window.open('/help', '_blank')
                  }}
                >
                  ヘルプ
                </a>
                <a 
                  href="/status" 
                  className="text-primary-600 hover:text-primary-700 underline"
                  onClick={(e) => {
                    e.preventDefault()
                    window.open('https://status.researchvault.com', '_blank')
                  }}
                >
                  サービス状況
                </a>
                <a 
                  href="mailto:support@researchvault.com" 
                  className="text-primary-600 hover:text-primary-700 underline"
                >
                  サポート
                </a>
              </div>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

// アプリケーションの初期化
function initializeApp() {
  // サービスワーカーの登録（プロダクション環境のみ）
  // 一時的に無効化 - sw.jsファイルが存在しないため
  /*
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('SW registered: ', registration)
        })
        .catch((registrationError) => {
          console.log('SW registration failed: ', registrationError)
        })
    })
  }
  */

  // パフォーマンス測定
  if (import.meta.env.DEV) {
    import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
      getCLS(console.log)
      getFID(console.log)
      getFCP(console.log)
      getLCP(console.log)
      getTTFB(console.log)
    })
  }
}

// Reactアプリケーションのレンダリング
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#fff',
              color: '#374151',
              border: '1px solid #e5e7eb',
              borderRadius: '0.5rem',
              fontSize: '14px',
              maxWidth: '400px',
            },
            success: {
              iconTheme: {
                primary: '#10b981',
                secondary: '#fff',
              },
              style: {
                border: '1px solid #10b981',
              },
            },
            error: {
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
              style: {
                border: '1px solid #ef4444',
              },
            },
            loading: {
              iconTheme: {
                primary: '#3b82f6',
                secondary: '#fff',
              },
            },
          }}
        />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
)

// アプリケーション初期化
initializeApp()

// ホットリロード対応（開発環境のみ）
if (import.meta.hot) {
  import.meta.hot.accept()
}
