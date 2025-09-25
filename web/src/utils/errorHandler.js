// ResearchVault 統一エラーハンドリングシステム

import { toast } from 'react-hot-toast'

/**
 * エラータイプ定義
 */
export const ERROR_TYPES = {
  NETWORK: 'NETWORK',
  AUTH: 'AUTH', 
  VALIDATION: 'VALIDATION',
  PERMISSION: 'PERMISSION',
  NOT_FOUND: 'NOT_FOUND',
  SERVER: 'SERVER',
  CLIENT: 'CLIENT',
  UNKNOWN: 'UNKNOWN'
}

/**
 * エラー重要度レベル
 */
export const ERROR_LEVELS = {
  LOW: 'low',        // ログのみ
  MEDIUM: 'medium',  // ユーザー通知
  HIGH: 'high',      // ユーザー通知 + 報告
  CRITICAL: 'critical' // 即座の対応が必要
}

/**
 * ResearchVaultカスタムエラークラス
 */
export class ResearchVaultError extends Error {
  constructor(
    message, 
    type = ERROR_TYPES.UNKNOWN, 
    level = ERROR_LEVELS.MEDIUM,
    context = {},
    originalError = null
  ) {
    super(message)
    this.name = 'ResearchVaultError'
    this.type = type
    this.level = level
    this.context = context
    this.originalError = originalError
    this.timestamp = new Date().toISOString()
    this.userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'
    this.url = typeof window !== 'undefined' ? window.location.href : 'unknown'
  }

  /**
   * エラーの詳細情報を取得
   */
  getDetails() {
    return {
      name: this.name,
      message: this.message,
      type: this.type,
      level: this.level,
      context: this.context,
      timestamp: this.timestamp,
      userAgent: this.userAgent,
      url: this.url,
      stack: this.stack,
      originalError: this.originalError?.message || null
    }
  }

  /**
   * ユーザー向けメッセージを取得
   */
  getUserMessage() {
    return getUserFriendlyMessage(this.message, this.type)
  }
}

/**
 * エラーメッセージの日本語化マップ
 */
const ERROR_MESSAGES = {
  // 認証関連
  'Invalid login credentials': 'メールアドレスまたはパスワードが正しくありません',
  'Email not confirmed': 'メールアドレスが確認されていません。確認メールをチェックしてください',
  'User already registered': 'このメールアドレスは既に登録されています',
  'Password should be at least 6 characters': 'パスワードは6文字以上で入力してください',
  'Unable to validate email address: invalid format': 'メールアドレスの形式が正しくありません',
  'signup is disabled': 'アカウント作成は現在無効になっています',
  'Email rate limit exceeded': 'メール送信の制限に達しました。しばらく待ってから再試行してください',
  'Unauthorized': '認証が必要です。再度ログインしてください',
  'Forbidden': 'この操作を実行する権限がありません',
  
  // ネットワーク関連
  'Network Error': 'インターネット接続を確認してください',
  'Failed to fetch': 'サーバーに接続できません。インターネット接続を確認してください',
  'NetworkError': 'ネットワークエラーが発生しました',
  'TypeError: Failed to fetch': 'サーバーに接続できません。しばらく待ってから再試行してください',
  
  // サーバー関連
  'Internal Server Error': 'サーバーでエラーが発生しました。しばらく待ってから再試行してください',
  'Service Unavailable': 'サービスが一時的に利用できません',
  'Bad Gateway': 'サーバーに問題が発生しています',
  'Gateway Timeout': 'サーバーの応答が遅れています。しばらく待ってから再試行してください',
  
  // リソース関連
  'Not Found': '要求されたリソースが見つかりません',
  'Resource not found': 'リソースが見つかりません',
  
  // バリデーション関連
  'Validation failed': '入力内容にエラーがあります',
  'Required field missing': '必須項目が入力されていません',
  'Invalid format': '形式が正しくありません',
  
  // ブラウザ拡張機能関連
  'Extension context invalidated': 'ブラウザ拡張機能を再読み込みしてください',
  'chrome.tabs.executeScript is not a function': 'ブラウザ拡張機能に問題があります。更新してください',
  
  // デフォルト
  'default': '予期しないエラーが発生しました'
}

/**
 * ユーザーフレンドリーなエラーメッセージを取得
 */
export function getUserFriendlyMessage(error, type = ERROR_TYPES.UNKNOWN) {
  if (typeof error === 'string') {
    return ERROR_MESSAGES[error] || ERROR_MESSAGES.default
  }
  
  if (error?.message) {
    return ERROR_MESSAGES[error.message] || ERROR_MESSAGES.default
  }
  
  return ERROR_MESSAGES.default
}

/**
 * エラータイプを推定
 */
export function inferErrorType(error) {
  const message = error?.message?.toLowerCase() || ''
  
  if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
    return ERROR_TYPES.NETWORK
  }
  
  if (message.includes('unauthorized') || message.includes('forbidden') || message.includes('auth')) {
    return ERROR_TYPES.AUTH
  }
  
  if (message.includes('validation') || message.includes('required') || message.includes('invalid')) {
    return ERROR_TYPES.VALIDATION
  }
  
  if (message.includes('permission') || message.includes('denied')) {
    return ERROR_TYPES.PERMISSION
  }
  
  if (message.includes('not found') || message.includes('404')) {
    return ERROR_TYPES.NOT_FOUND
  }
  
  if (message.includes('server') || message.includes('500') || message.includes('502') || message.includes('503')) {
    return ERROR_TYPES.SERVER
  }
  
  return ERROR_TYPES.UNKNOWN
}

/**
 * エラーレベルを推定
 */
export function inferErrorLevel(error, type) {
  switch (type) {
    case ERROR_TYPES.NETWORK:
      return ERROR_LEVELS.MEDIUM
    case ERROR_TYPES.AUTH:
      return ERROR_LEVELS.HIGH
    case ERROR_TYPES.SERVER:
      return ERROR_LEVELS.HIGH
    case ERROR_TYPES.PERMISSION:
      return ERROR_LEVELS.MEDIUM
    case ERROR_TYPES.VALIDATION:
      return ERROR_LEVELS.LOW
    case ERROR_TYPES.NOT_FOUND:
      return ERROR_LEVELS.LOW
    default:
      return ERROR_LEVELS.MEDIUM
  }
}

/**
 * メインエラーハンドリング関数
 */
export class ErrorHandler {
  constructor(options = {}) {
    this.options = {
      enableReporting: options.enableReporting ?? true,
      enableToasts: options.enableToasts ?? true,
      enableConsoleLog: options.enableConsoleLog ?? true,
      retryEnabled: options.retryEnabled ?? true,
      maxRetries: options.maxRetries ?? 3,
      retryDelay: options.retryDelay ?? 1000,
      ...options
    }
  }

  /**
   * エラーを処理
   */
  async handle(error, context = {}) {
    const rvError = this.normalizeError(error, context)
    
    // コンソールログ
    if (this.options.enableConsoleLog) {
      this.logError(rvError)
    }
    
    // ユーザー通知
    if (this.options.enableToasts && rvError.level !== ERROR_LEVELS.LOW) {
      this.showUserNotification(rvError)
    }
    
    // エラー報告
    if (this.options.enableReporting && rvError.level === ERROR_LEVELS.HIGH) {
      await this.reportError(rvError)
    }
    
    return rvError
  }

  /**
   * エラーを正規化
   */
  normalizeError(error, context = {}) {
    if (error instanceof ResearchVaultError) {
      return error
    }
    
    const type = inferErrorType(error)
    const level = inferErrorLevel(error, type)
    const message = error?.message || String(error) || 'Unknown error'
    
    return new ResearchVaultError(message, type, level, context, error)
  }

  /**
   * コンソールログ出力
   */
  logError(rvError) {
    const details = rvError.getDetails()
    
    switch (rvError.level) {
      case ERROR_LEVELS.CRITICAL:
        console.error('🚨 CRITICAL ERROR:', details)
        break
      case ERROR_LEVELS.HIGH:
        console.error('❌ HIGH ERROR:', details)
        break
      case ERROR_LEVELS.MEDIUM:
        console.warn('⚠️ MEDIUM ERROR:', details)
        break
      case ERROR_LEVELS.LOW:
        console.log('ℹ️ LOW ERROR:', details)
        break
      default:
        console.error('🔴 UNKNOWN ERROR:', details)
    }
  }

  /**
   * ユーザー通知表示
   */
  showUserNotification(rvError) {
    const userMessage = rvError.getUserMessage()
    
    switch (rvError.level) {
      case ERROR_LEVELS.CRITICAL:
      case ERROR_LEVELS.HIGH:
        toast.error(userMessage, {
          duration: 6000,
          position: 'top-right'
        })
        break
      case ERROR_LEVELS.MEDIUM:
        toast.error(userMessage, {
          duration: 4000
        })
        break
      default:
        toast(userMessage, {
          icon: 'ℹ️',
          duration: 3000
        })
    }
  }

  /**
   * エラー報告（外部サービス連携）
   */
  async reportError(rvError) {
    try {
      // プロダクション環境でのエラー報告
      if (import.meta.env.PROD) {
        // Sentryやその他の監視サービスに送信
        // await sentry.captureException(rvError)
        
        // 簡易的なエラー報告API（実装時に有効化）
        /*
        await fetch('/api/errors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(rvError.getDetails())
        })
        */
      }
    } catch (reportingError) {
      console.error('Failed to report error:', reportingError)
    }
  }

  /**
   * 再試行機能付き関数実行
   */
  async withRetry(asyncFn, context = {}) {
    let lastError
    let attempts = 0
    
    while (attempts < this.options.maxRetries) {
      try {
        return await asyncFn()
      } catch (error) {
        lastError = error
        attempts++
        
        const rvError = this.normalizeError(error, { ...context, attempt: attempts })
        
        if (attempts < this.options.maxRetries && this.shouldRetry(rvError)) {
          console.log(`Retrying... (${attempts}/${this.options.maxRetries})`)
          await this.delay(this.options.retryDelay * attempts) // 指数バックオフ
          continue
        }
        
        break
      }
    }
    
    throw lastError
  }

  /**
   * 再試行すべきエラーかどうか判定
   */
  shouldRetry(rvError) {
    // ネットワークエラーまたはサーバーエラーの場合のみ再試行
    return [ERROR_TYPES.NETWORK, ERROR_TYPES.SERVER].includes(rvError.type)
  }

  /**
   * 遅延ユーティリティ
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// デフォルトのエラーハンドラーインスタンス
export const errorHandler = new ErrorHandler()

/**
 * 便利なヘルパー関数
 */
export const handleError = (error, context) => errorHandler.handle(error, context)
export const withRetry = (fn, context) => errorHandler.withRetry(fn, context)

/**
 * 非同期処理のエラーハンドリング用デコレータ
 */
export function handleAsync(target, propertyKey, descriptor) {
  const originalMethod = descriptor.value
  
  descriptor.value = async function (...args) {
    try {
      return await originalMethod.apply(this, args)
    } catch (error) {
      await handleError(error, { 
        method: propertyKey,
        class: target.constructor.name,
        args: args.length
      })
      throw error
    }
  }
  
  return descriptor
}

/**
 * React Error Boundary用のエラーハンドリング
 */
export function handleComponentError(error, errorInfo) {
  const rvError = new ResearchVaultError(
    error.message,
    ERROR_TYPES.CLIENT,
    ERROR_LEVELS.HIGH,
    {
      componentStack: errorInfo.componentStack,
      errorBoundary: true
    },
    error
  )
  
  return errorHandler.handle(rvError)
}

export default errorHandler
