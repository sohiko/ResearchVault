// ResearchVault Chrome Extension Error Handler
console.log('Loading errorHandler.js...');

/**
 * Chrome拡張機能用のエラーハンドリングクラス
 */
class ExtensionErrorHandler {
  constructor() {
    this.errorCount = 0
    this.lastErrors = []
    this.maxErrorHistory = 10
  }

  /**
   * エラーを処理
   */
  async handleError(error, context = {}) {
    this.errorCount++
    
    const errorDetails = {
      id: `ext_err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      message: error?.message || String(error),
      type: this.inferErrorType(error),
      timestamp: new Date().toISOString(),
      context: context,
      userAgent: navigator.userAgent,
      url: context.url || 'unknown',
      count: this.errorCount
    }

    // エラー履歴に追加
    this.lastErrors.unshift(errorDetails)
    if (this.lastErrors.length > this.maxErrorHistory) {
      this.lastErrors.pop()
    }

    // コンソールログ
    this.logError(errorDetails)

    // Chrome拡張のストレージに保存
    await this.saveErrorToStorage(errorDetails)

    // バックグラウンドスクリプトに通知
    this.notifyBackground(errorDetails)

    return errorDetails
  }

  /**
   * エラータイプを推定
   */
  inferErrorType(error) {
    const message = error?.message?.toLowerCase() || ''
    
    if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
      return 'NETWORK'
    }
    if (message.includes('unauthorized') || message.includes('forbidden') || message.includes('auth')) {
      return 'AUTH'
    }
    if (message.includes('not found') || message.includes('404')) {
      return 'NOT_FOUND'
    }
    if (message.includes('server') || message.includes('500') || message.includes('502')) {
      return 'SERVER'
    }
    if (message.includes('permission') || message.includes('denied')) {
      return 'PERMISSION'
    }
    if (message.includes('extension') || message.includes('chrome')) {
      return 'EXTENSION'
    }
    
    return 'UNKNOWN'
  }

  /**
   * コンソールログ出力
   */
  logError(errorDetails) {
    const prefix = errorDetails.type === 'NETWORK' ? '🌐' : 
                  errorDetails.type === 'AUTH' ? '🔒' : 
                  errorDetails.type === 'EXTENSION' ? '🧩' : '❌'
    
    console.error(`${prefix} [ResearchVault Extension Error]`, {
      id: errorDetails.id,
      message: errorDetails.message,
      type: errorDetails.type,
      context: errorDetails.context,
      timestamp: errorDetails.timestamp
    })
  }

  /**
   * エラーをChrome拡張ストレージに保存
   */
  async saveErrorToStorage(errorDetails) {
    try {
      const { extensionErrors = [] } = await chrome.storage.local.get(['extensionErrors'])
      
      extensionErrors.unshift(errorDetails)
      
      // 最新の20件のみ保持
      if (extensionErrors.length > 20) {
        extensionErrors.splice(20)
      }
      
      await chrome.storage.local.set({ extensionErrors })
    } catch (storageError) {
      console.warn('Failed to save error to storage:', storageError)
    }
  }

  /**
   * バックグラウンドスクリプトに通知
   */
  notifyBackground(errorDetails) {
    try {
      chrome.runtime.sendMessage({
        action: 'errorOccurred',
        data: errorDetails
      }).catch(() => {
        // バックグラウンドスクリプトが利用できない場合は無視
      })
    } catch (e) {
      // 通知に失敗しても継続
    }
  }

  /**
   * ユーザーフレンドリーなエラーメッセージを取得
   */
  getUserMessage(error) {
    const errorMessages = {
      // ネットワーク関連
      'Failed to fetch': 'サーバーに接続できません。インターネット接続を確認してください',
      'NetworkError': 'ネットワークエラーが発生しました',
      'Network Error': 'インターネット接続を確認してください',
      
      // 認証関連
      'Unauthorized': '認証が必要です。再度ログインしてください',
      'Invalid login credentials': 'メールアドレスまたはパスワードが正しくありません',
      'Forbidden': 'この操作を実行する権限がありません',
      
      // サーバー関連
      'Internal Server Error': 'サーバーでエラーが発生しました',
      'Service Unavailable': 'サービスが一時的に利用できません',
      
      // 拡張機能関連
      'Extension context invalidated': '拡張機能を再読み込みしてください',
      'chrome.tabs.executeScript is not a function': '拡張機能を更新してください',
      
      // デフォルト
      'default': '予期しないエラーが発生しました'
    }

    const message = error?.message || String(error)
    return errorMessages[message] || errorMessages.default
  }

  /**
   * 再試行機能付きで関数を実行
   */
  async withRetry(asyncFn, options = {}) {
    const {
      maxRetries = 3,
      delay = 1000,
      backoff = 2,
      shouldRetry = (error) => this.shouldRetry(error)
    } = options

    let lastError
    let attempts = 0

    while (attempts < maxRetries) {
      try {
        return await asyncFn()
      } catch (error) {
        lastError = error
        attempts++

        if (attempts >= maxRetries || !shouldRetry(error)) {
          break
        }

        console.log(`Retrying... (${attempts}/${maxRetries})`)
        await this.delay(delay * Math.pow(backoff, attempts - 1))
      }
    }

    throw lastError
  }

  /**
   * 再試行すべきエラーかどうか判定
   */
  shouldRetry(error) {
    const type = this.inferErrorType(error)
    const retryableTypes = ['NETWORK', 'SERVER']
    return retryableTypes.includes(type)
  }

  /**
   * 遅延ユーティリティ
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * エラー統計を取得
   */
  getErrorStats() {
    const typeCount = {}
    this.lastErrors.forEach(error => {
      typeCount[error.type] = (typeCount[error.type] || 0) + 1
    })

    return {
      totalCount: this.errorCount,
      recentCount: this.lastErrors.length,
      typeDistribution: typeCount,
      lastError: this.lastErrors[0] || null
    }
  }

  /**
   * エラー履歴をクリア
   */
  clearErrorHistory() {
    this.lastErrors = []
    this.errorCount = 0
    chrome.storage.local.remove(['extensionErrors'])
  }
}

// グローバルインスタンス
const extensionErrorHandler = new ExtensionErrorHandler()

/**
 * 便利なヘルパー関数
 */
const handleExtensionError = (error, context) => extensionErrorHandler.handleError(error, context)
const withExtensionRetry = (fn, options) => extensionErrorHandler.withRetry(fn, options)
