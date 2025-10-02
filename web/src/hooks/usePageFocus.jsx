import { useEffect, useRef } from 'react'

/**
 * ページフォーカス時の不要なリロードを防ぐフック
 * @param {Function} callback - フォーカス時に実行するコールバック
 * @param {Array} deps - 依存配列
 * @param {Object} options - オプション
 * @param {boolean} options.enableFocusReload - フォーカス時のリロードを有効にするか
 * @param {number} options.debounceMs - デバウンス時間（ミリ秒）
 */
export function usePageFocus(callback, deps = [], options = {}) {
  const {
    enableFocusReload = false,
    debounceMs = 1000
  } = options

  const callbackRef = useRef(callback)
  const lastFocusTimeRef = useRef(0)
  const timeoutRef = useRef(null)

  // コールバックを最新のものに更新
  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  useEffect(() => {
    if (!enableFocusReload) return

    const handleFocus = () => {
      const now = Date.now()
      const timeSinceLastFocus = now - lastFocusTimeRef.current

      // デバウンス時間内の場合は実行しない
      if (timeSinceLastFocus < debounceMs) {
        return
      }

      lastFocusTimeRef.current = now

      // タイムアウトをクリア
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      // デバウンス後にコールバックを実行
      timeoutRef.current = setTimeout(() => {
        callbackRef.current()
      }, debounceMs)
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleFocus()
      }
    }

    // イベントリスナーを追加
    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [enableFocusReload, debounceMs])

  // 依存配列が変更された場合のみコールバックを実行
  useEffect(() => {
    callbackRef.current()
  }, deps)
}

export default usePageFocus
