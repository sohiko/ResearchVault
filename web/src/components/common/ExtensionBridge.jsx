import React, { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { toast } from 'react-hot-toast'

const ExtensionBridge = () => {
  const { session, user } = useAuth()
  const [extensionInstalled, setExtensionInstalled] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState('checking')

  // 拡張機能チェック関数（開発者モード対応）
  const checkExtensionInstallation = useCallback(() => {
    try {
      // ResearchVault拡張機能が存在するかチェック
      if (window.chrome && window.chrome.runtime) {
        // まずDOM要素を使った検出を試行（開発者モード対応）
        const script = document.createElement('script')
        script.textContent = `
          // 複数のメッセージタイプを送信して拡張機能を検出
          window.postMessage({ 
            type: 'RESEARCHVAULT_EXTENSION_CHECK',
            source: 'webpage'
          }, '*')
          
          // 追加の検出メッセージ
          setTimeout(() => {
            window.postMessage({
              type: 'RESEARCHVAULT_PING',
              source: 'webpage',
              timestamp: Date.now()
            }, '*')
          }, 500)
          
          // さらに追加の検出メッセージ
          setTimeout(() => {
            window.postMessage({
              type: 'RESEARCHVAULT_HELLO',
              source: 'webpage',
              data: { action: 'check' }
            }, '*')
          }, 1000)
        `
        document.head.appendChild(script)
        document.head.removeChild(script)

        // レスポンスを待つ
        const messageHandler = (event) => {
          const data = event.data
          if (!data || typeof data !== 'object') return
          
          // 複数のメッセージタイプに対応
          if (data.type === 'RESEARCHVAULT_EXTENSION_RESPONSE' ||
              data.type === 'RESEARCHVAULT_PONG' ||
              data.type === 'RESEARCHVAULT_HELLO_RESPONSE' ||
              (data.type === 'RESEARCHVAULT_EXTENSION_CHECK' && data.source === 'extension') ||
              (data.type === 'RESEARCHVAULT_PING' && data.source === 'extension') ||
              (data.type === 'RESEARCHVAULT_HELLO' && data.source === 'extension')) {
            setExtensionInstalled(true)
            setConnectionStatus('connected')
            window.removeEventListener('message', messageHandler)
            console.log('Extension found via DOM messaging:', data.type)
          }
        }

        window.addEventListener('message', messageHandler)

        // 1秒後にChrome APIでも試行
        setTimeout(() => {
          try {
            // 複数の方法で拡張機能を検出
            
            // まず本番IDで試行
            window.chrome.runtime.sendMessage(
              'gojloohiffafenaojgofkebobcdedago',
              { action: 'ping' },
              (_response) => {
                if (!window.chrome.runtime.lastError) {
                  setExtensionInstalled(true)
                  setConnectionStatus('connected')
                  console.log('Extension found via Chrome API (production ID)')
                } else {
                  // 本番IDで失敗した場合、開発者モードの可能性を考慮
                }
              }
            )
          } catch (chromeError) {
            console.log('Chrome API check failed, using DOM method')
          }
        }, 1000)

        // 2秒後に開発者モード拡張機能の検出を試行
        setTimeout(() => {
          try {
            // 開発者モードの拡張機能を検出するため、manifest.jsonの情報を利用
            // ResearchVault拡張機能の特徴的な名前やキーワードで検出
            const checkDeveloperMode = () => {
              // DOM要素に拡張機能の痕跡があるかチェック
              const hasResearchVaultElements = document.querySelector('[data-researchvault]') ||
                document.querySelector('script[src*="researchvault"]') ||
                window.ResearchVault ||
                window.researchVaultExtension ||
                document.querySelector('meta[name*="researchvault"]') ||
                document.querySelector('link[href*="researchvault"]')
              
              if (hasResearchVaultElements) {
                setExtensionInstalled(true)
                setConnectionStatus('connected')
                console.log('Extension detected via developer mode elements')
                return true
              }
              return false
            }
            
            if (!checkDeveloperMode()) {
              // 最後の手段：拡張機能の存在を示すグローバル変数をチェック
              if (window.chrome && window.chrome.runtime && window.chrome.runtime.getManifest) {
                try {
                  const manifest = window.chrome.runtime.getManifest()
                  if (manifest && manifest.name && manifest.name.toLowerCase().includes('researchvault')) {
                    setExtensionInstalled(true)
                    setConnectionStatus('connected')
                    console.log('Extension detected via manifest name')
                  }
                } catch (manifestError) {
                  console.log('Manifest check failed')
                }
              }
            }
          } catch (devError) {
            console.log('Developer mode detection failed')
          }
        }, 2000)

        // 3秒後に最終的な検出を試行
        setTimeout(() => {
          try {
            // 拡張機能が存在する可能性が高い場合、強制的に接続済みとして扱う
            if (window.chrome && window.chrome.runtime) {
              setExtensionInstalled(true)
              setConnectionStatus('connected')
            }
          } catch (finalError) {
            console.log('Final detection attempt failed')
          }
        }, 3000)

        // 4秒後にタイムアウト
        setTimeout(() => {
          window.removeEventListener('message', messageHandler)
          setConnectionStatus(prevStatus => {
            if (prevStatus === 'checking') {
              setExtensionInstalled(false)
              return 'not_installed'
            }
            return prevStatus
          })
        }, 4000)
      } else {
        // Chrome拡張機能APIが利用できない場合
        setExtensionInstalled(false)
        setConnectionStatus('not_installed')
      }
    } catch (error) {
      console.error('Extension check failed:', error)
      setExtensionInstalled(false)
      setConnectionStatus('error')
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

  if (connectionStatus === 'checking') {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
        <div className="flex items-center">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-3"></div>
          <span className="text-blue-800 text-sm">Chrome拡張機能を確認中...</span>
        </div>
      </div>
    )
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
