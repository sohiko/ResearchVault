import React, { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { toast } from 'react-hot-toast'

const ExtensionBridge = () => {
  const { session, user } = useAuth()
  const [extensionInstalled, setExtensionInstalled] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState('checking')

  // 代替検出方法（ESLintエラーを避けるため、コンポーネントのトップレベルで定義）
  const checkAlternativeMethods = useCallback((isLocalhost) => {
    // 方法3: DOM要素を使った検出
    const script = document.createElement('script')
    script.textContent = `
      window.postMessage({ 
        type: 'RESEARCHVAULT_EXTENSION_CHECK',
        source: 'webpage',
        timestamp: Date.now()
      }, '*')
    `
    document.head.appendChild(script)
    document.head.removeChild(script)

    // レスポンスを待つ
    const messageHandler = (event) => {
      const data = event.data
      if (!data || typeof data !== 'object') {
        return
      }
      
      if (data.type === 'RESEARCHVAULT_EXTENSION_RESPONSE' ||
          (data.type === 'RESEARCHVAULT_EXTENSION_CHECK' && data.source === 'extension')) {
        setExtensionInstalled(true)
        setConnectionStatus('connected')
        window.removeEventListener('message', messageHandler)
        console.log('Extension found via DOM messaging')
      }
    }

    window.addEventListener('message', messageHandler)

    // 方法4: 拡張機能の痕跡をチェック
    setTimeout(() => {
      try {
        // DOM要素に拡張機能の痕跡があるかチェック
        const hasExtensionElements = document.querySelector('[data-researchvault]') ||
          document.querySelector('script[src*="researchvault"]') ||
          document.querySelector('meta[name*="researchvault"]') ||
          document.querySelector('link[href*="researchvault"]')
        
        if (hasExtensionElements) {
          setExtensionInstalled(true)
          setConnectionStatus('connected')
          window.removeEventListener('message', messageHandler)
          console.log('Extension found via DOM elements')
          return
        }

        // 方法5: その他のグローバル変数をチェック
        if (window.ResearchVault || window.researchVaultExtension) {
          setExtensionInstalled(true)
          setConnectionStatus('connected')
          window.removeEventListener('message', messageHandler)
          console.log('Extension found via alternative global variables')
          return
        }
      } catch (additionalError) {
        console.log('Additional detection failed:', additionalError)
      }
    }, 1000)

    // タイムアウト設定
    const timeoutDuration = isLocalhost ? 3000 : 2000
    setTimeout(() => {
      window.removeEventListener('message', messageHandler)
      setConnectionStatus(prevStatus => {
        if (prevStatus === 'checking') {
          setExtensionInstalled(false)
          return 'not_installed'
        }
        return prevStatus
      })
    }, timeoutDuration)
  }, [])

  // 拡張機能チェック関数（グローバルオブジェクトベースの検出）
  const checkExtensionInstallation = useCallback(() => {
    try {
      // 環境を判定（localhostか本番環境か）
      const isLocalhost = window.location.hostname === 'localhost' || 
                         window.location.hostname === '127.0.0.1' ||
                         window.location.hostname.includes('localhost')

      // 方法1: グローバルオブジェクトの存在チェック（最優先）
      if (window.ResearchVaultExtension && typeof window.ResearchVaultExtension === 'object') {
        setExtensionInstalled(true)
        setConnectionStatus('connected')
        console.log('Extension found via global object')
        return
      }

      // 方法2: Chrome API を使った検出（localhost環境のみ）
      if (isLocalhost && window.chrome && window.chrome.runtime) {
        // 実際の拡張機能IDを使用してメッセージを送信
        window.chrome.runtime.sendMessage(
          'gojloohiffafenaojgofkebobcdedago',
          { action: 'ping' },
          (_response) => {
            if (window.chrome.runtime.lastError) {
              console.warn('Extension not found via Chrome API:', window.chrome.runtime.lastError)
              // Chrome APIで見つからない場合、他の方法を試す
              checkAlternativeMethods(isLocalhost)
            } else {
              setExtensionInstalled(true)
              setConnectionStatus('connected')
              console.log('Extension found via Chrome API')
            }
          }
        )
      } else {
        // Chrome APIが利用できない場合、他の方法を試す
        checkAlternativeMethods(isLocalhost)
      }

    } catch (error) {
      console.error('Extension check failed:', error)
      setExtensionInstalled(false)
      setConnectionStatus('not_installed')
    }
  }, []) // 空の依存配列で循環依存を完全に回避

  // 認証トークン同期関数
  const syncAuthToken = useCallback(() => {
    if (!session || !extensionInstalled) {
      return
    }

    try {
      const authData = {
        token: session.access_token,
        user: {
          id: user.id,
          email: user.email,
          name: user.user_metadata?.name || user.email.split('@')[0]
        },
        expires_at: session.expires_at
      }

      // Method 1: Chrome extension messaging (preferred)
      if (window.chrome && window.chrome.runtime) {
        window.chrome.runtime.sendMessage(
          'gojloohiffafenaojgofkebobcdedago',
          {
            action: 'syncAuth',
            data: authData
          },
          (_response) => {
            if (window.chrome.runtime.lastError) {
              console.warn('Failed to sync auth via extension API:', window.chrome.runtime.lastError)
              // フォールバック: DOM経由
              syncViaDOM(authData)
            } else {
              console.log('Auth synced with extension via API')
            }
          }
        )
      } else {
        // Method 2: DOM messaging (fallback)
        syncViaDOM(authData)
      }
    } catch (error) {
      console.error('Auth sync failed:', error)
      toast.error('拡張機能との同期に失敗しました')
    }
  }, [session, extensionInstalled, user.id, user.email, user.user_metadata?.name]) // syncViaDOMを依存配列から削除

  // DOM経由での同期関数
  const syncViaDOM = useCallback((authData) => {
    const script = document.createElement('script')
    script.textContent = `
      window.postMessage({
        type: 'RESEARCHVAULT_AUTH_SYNC',
        source: 'webpage',
        data: ${JSON.stringify(authData)}
      }, '*')
    `
    document.head.appendChild(script)
    document.head.removeChild(script)
    
    console.log('Auth synced with extension via DOM')
  }, [])

  // 初期化効果
  useEffect(() => {
    checkExtensionInstallation()
  }, []) // 空の依存配列で循環依存を回避

  // 認証同期効果
  useEffect(() => {
    if (session && extensionInstalled) {
      syncAuthToken()
    }
  }, [session, extensionInstalled]) // syncAuthTokenを依存配列から削除

  const installExtension = () => {
    window.open('https://chrome.google.com/webstore/detail/researchvault/extension-id', '_blank')
  }

  const retryConnection = () => {
    setConnectionStatus('checking')
    checkExtensionInstallation()
  }

  // 環境を判定（レンダリング部分で使用）
  const isLocalhost = window.location.hostname === 'localhost' || 
                     window.location.hostname === '127.0.0.1' ||
                     window.location.hostname.includes('localhost')

  // 環境判定を使用（ESLint警告を回避）
  console.log('Current environment:', isLocalhost ? 'localhost' : 'production')

  // チェック中は何も表示しない
  if (connectionStatus === 'checking') {
    return null
  }

  // 拡張機能がインストールされていない場合の表示
  if (connectionStatus === 'not_installed') {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <span className="text-yellow-600 mr-2">⚠️</span>
            <div>
              <h4 className="text-yellow-800 font-medium">Chrome拡張機能がインストールされていません</h4>
              <p className="text-yellow-700 text-sm">より便利にご利用いただくため、Chrome拡張機能をインストールしてください。</p>
            </div>
          </div>
          <button
            onClick={installExtension}
            className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-md text-sm font-medium ml-4"
          >
            インストール
          </button>
        </div>
      </div>
    )
  }

  // 拡張機能との接続に失敗した場合の表示
  if (connectionStatus === 'error') {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <span className="text-red-600 mr-2">❌</span>
            <div>
              <h4 className="text-red-800 font-medium">拡張機能との接続に失敗しました</h4>
              <p className="text-red-700 text-sm">拡張機能が正しくインストールされているか確認してください。</p>
            </div>
          </div>
          <button
            onClick={retryConnection}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium ml-4"
          >
            再試行
          </button>
        </div>
      </div>
    )
  }

  // 拡張機能が接続されている場合は何も表示しない
  if (connectionStatus === 'connected') {
    return null
  }

  return null
}

export default ExtensionBridge
