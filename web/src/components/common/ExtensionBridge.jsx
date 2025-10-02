import React, { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { toast } from 'react-hot-toast'

const ExtensionBridge = () => {
  const { session, user } = useAuth()
  const [extensionInstalled, setExtensionInstalled] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState('checking')

  // 拡張機能チェック関数（環境対応）
  const checkExtensionInstallation = useCallback(() => {
    try {
      // 環境を判定（localhostか本番環境か）
      const isLocalhost = window.location.hostname === 'localhost' || 
                         window.location.hostname === '127.0.0.1' ||
                         window.location.hostname.includes('localhost')

      if (window.chrome && window.chrome.runtime) {
        // localhost環境では詳細な検出を実行
        if (isLocalhost) {
          // 実際の拡張機能IDを使用してメッセージを送信
          window.chrome.runtime.sendMessage(
            'gojloohiffafenaojgofkebobcdedago',
            { action: 'ping' },
            (_response) => {
              if (window.chrome.runtime.lastError) {
                console.warn('Extension not found:', window.chrome.runtime.lastError)
                setExtensionInstalled(false)
                setConnectionStatus('not_installed')
              } else {
                setExtensionInstalled(true)
                setConnectionStatus('connected')
                console.log('Extension found and connected')
              }
            }
          )

          // DOM要素を使った検出も並行して実行
          const script = document.createElement('script')
          script.textContent = `
            window.postMessage({ 
              type: 'RESEARCHVAULT_EXTENSION_CHECK',
              source: 'webpage'
            }, '*')
          `
          document.head.appendChild(script)
          document.head.removeChild(script)

          // レスポンスを待つ
          const messageHandler = (event) => {
            const data = event.data
            if (!data || typeof data !== 'object') return
            
            if (data.type === 'RESEARCHVAULT_EXTENSION_RESPONSE' ||
                (data.type === 'RESEARCHVAULT_EXTENSION_CHECK' && data.source === 'extension')) {
              setExtensionInstalled(true)
              setConnectionStatus('connected')
              window.removeEventListener('message', messageHandler)
            }
          }

          window.addEventListener('message', messageHandler)

          // 1秒後に追加の検出を試行
          setTimeout(() => {
            try {
              // 拡張機能の存在を示すグローバル変数をチェック
              if (window.ResearchVault || window.researchVaultExtension) {
                setExtensionInstalled(true)
                setConnectionStatus('connected')
                return
              }

              // DOM要素に拡張機能の痕跡があるかチェック
              const hasExtensionElements = document.querySelector('[data-researchvault]') ||
                document.querySelector('script[src*="researchvault"]') ||
                document.querySelector('meta[name*="researchvault"]')
              
              if (hasExtensionElements) {
                setExtensionInstalled(true)
                setConnectionStatus('connected')
                return
              }
            } catch (additionalError) {
              console.log('Additional detection failed:', additionalError)
            }
          }, 1000)

          // 3秒後にタイムアウト
          setTimeout(() => {
            window.removeEventListener('message', messageHandler)
            setConnectionStatus(prevStatus => {
              if (prevStatus === 'checking') {
                setExtensionInstalled(false)
                return 'not_installed'
              }
              return prevStatus
            })
          }, 3000)
        } else {
          // 本番環境では複数の検出方法を試行
          let detectionSuccess = false

          // 方法1: DOM要素を使った検出
          try {
            const script = document.createElement('script')
            script.textContent = `
              window.postMessage({ 
                type: 'RESEARCHVAULT_EXTENSION_CHECK',
                source: 'webpage'
              }, '*')
            `
            document.head.appendChild(script)
            document.head.removeChild(script)
          } catch (scriptError) {
            console.log('Script injection failed:', scriptError)
          }

          // レスポンスを待つ
          const messageHandler = (event) => {
            const data = event.data
            if (!data || typeof data !== 'object') return
            
            if (data.type === 'RESEARCHVAULT_EXTENSION_RESPONSE' ||
                (data.type === 'RESEARCHVAULT_EXTENSION_CHECK' && data.source === 'extension')) {
              setExtensionInstalled(true)
              setConnectionStatus('connected')
              detectionSuccess = true
              window.removeEventListener('message', messageHandler)
            }
          }

          window.addEventListener('message', messageHandler)

          // 方法2: 直接的なメッセージ送信（CSP制限を回避）
          setTimeout(() => {
            try {
              // 直接window.postMessageを使用
              window.postMessage({
                type: 'RESEARCHVAULT_EXTENSION_CHECK',
                source: 'webpage',
                timestamp: Date.now()
              }, '*')
            } catch (directError) {
              console.log('Direct postMessage failed:', directError)
            }
          }, 500)

          // 方法3: 拡張機能の痕跡をチェック
          setTimeout(() => {
            try {
              // 拡張機能の痕跡をチェック
              const hasExtensionElements = document.querySelector('[data-researchvault]') ||
                document.querySelector('script[src*="researchvault"]') ||
                document.querySelector('meta[name*="researchvault"]') ||
                document.querySelector('link[href*="researchvault"]')
              
              if (hasExtensionElements) {
                setExtensionInstalled(true)
                setConnectionStatus('connected')
                detectionSuccess = true
                return
              }

              // グローバル変数をチェック
              if (window.ResearchVault || window.researchVaultExtension) {
                setExtensionInstalled(true)
                setConnectionStatus('connected')
                detectionSuccess = true
                return
              }
            } catch (traceError) {
              console.log('Trace detection failed:', traceError)
            }
          }, 1000)

          // 本番環境では2.5秒後にタイムアウト
          setTimeout(() => {
            window.removeEventListener('message', messageHandler)
            if (!detectionSuccess) {
              setConnectionStatus(prevStatus => {
                if (prevStatus === 'checking') {
                  setExtensionInstalled(false)
                  return 'not_installed'
                }
                return prevStatus
              })
            }
          }, 2500)
        }
      } else {
        // Chrome拡張機能APIが利用できない場合
        setExtensionInstalled(false)
        setConnectionStatus('not_installed')
      }
    } catch (error) {
      console.error('Extension check failed:', error)
      setExtensionInstalled(false)
      setConnectionStatus('not_installed')
    }
  }, []) // 空の依存配列で循環依存を回避

  // 認証トークン同期関数（循環依存を避けるため、依存配列を空にする）
  const syncAuthToken = useCallback(() => {
    if (!session || !extensionInstalled) {return}

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
  }, []) // 空の依存配列で循環依存を回避

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
  }, [checkExtensionInstallation])

  // 認証同期効果
  useEffect(() => {
    if (session && extensionInstalled) {
      syncAuthToken()
    }
  }, [session, extensionInstalled, syncAuthToken])

  const installExtension = () => {
    window.open('https://chrome.google.com/webstore/detail/researchvault/extension-id', '_blank')
  }

  const retryConnection = () => {
    setConnectionStatus('checking')
    checkExtensionInstallation()
  }

  // チェック中は何も表示しない
  if (connectionStatus === 'checking') {
    return null
  }

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

  if (connectionStatus === 'connected') {
    // 連携完了時は何も表示しない
    return null
  }

  return null
}

export default ExtensionBridge
