import React, { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { toast } from 'react-hot-toast'

const ExtensionBridge = () => {
  const { session, user } = useAuth()
  const [extensionInstalled, setExtensionInstalled] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState('checking')

  useEffect(() => {
    checkExtensionInstallation()
  }, [checkExtensionInstallation])

  useEffect(() => {
    if (session && extensionInstalled) {
      syncAuthToken()
    }
  }, [session, extensionInstalled, syncAuthToken])

  const checkExtensionInstallation = useCallback(() => {
    try {
      // ResearchVault拡張機能が存在するかチェック
      if (window.chrome && window.chrome.runtime) {
        // 拡張機能にメッセージを送信してテスト
        window.chrome.runtime.sendMessage(
          'extension-id-here', // 実際の拡張機能IDに置き換える必要がある
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
      } else {
        // 代替手段：DOM要素を使った検出
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
          if (event.data.type === 'RESEARCHVAULT_EXTENSION_RESPONSE') {
            setExtensionInstalled(true)
            setConnectionStatus('connected')
            window.removeEventListener('message', messageHandler)
          }
        }

        window.addEventListener('message', messageHandler)

        // 2秒後にタイムアウト
        setTimeout(() => {
          window.removeEventListener('message', messageHandler)
          if (connectionStatus === 'checking') {
            setExtensionInstalled(false)
            setConnectionStatus('not_installed')
          }
        }, 2000)
      }
    } catch (error) {
      console.error('Extension check failed:', error)
      setExtensionInstalled(false)
      setConnectionStatus('error')
    }
  }, [connectionStatus])

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
          'extension-id-here',
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
              toast.success('拡張機能と認証を同期しました')
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
  }, [session, user, extensionInstalled])

  const syncViaDOM = (authData) => {
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
    toast.success('拡張機能と認証を同期しました')
  }

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
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
        <div className="flex items-center">
          <span className="text-green-600 mr-2">✅</span>
          <div>
            <h4 className="text-green-800 font-medium">Chrome拡張機能と連携済み</h4>
            <p className="text-green-700 text-sm">ブラウザーからページを保存できます。</p>
          </div>
        </div>
      </div>
    )
  }

  return null
}

export default ExtensionBridge
