import { useState, useEffect } from 'react'

/**
 * デバウンスフック
 * 値の変更を指定時間遅延させる（連続した変更を防ぐ）
 * 
 * @param {*} value - デバウンスする値
 * @param {number} delay - 遅延時間（ミリ秒）デフォルト: 500ms
 * @returns {*} デバウンスされた値
 */
export function useDebounce(value, delay = 500) {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    // 値が変更されたら、指定時間後にdebouncedValueを更新
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    // クリーンアップ: 次の値が来る前にタイマーをクリア
    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

/**
 * デバウンスコールバックフック
 * 関数の実行を指定時間遅延させる
 * 
 * @param {Function} callback - デバウンスする関数
 * @param {number} delay - 遅延時間（ミリ秒）デフォルト: 500ms
 * @returns {Function} デバウンスされた関数
 */
export function useDebouncedCallback(callback, delay = 500) {
  const [timeoutId, setTimeoutId] = useState(null)

  const debouncedCallback = (...args) => {
    // 既存のタイマーをクリア
    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    // 新しいタイマーを設定
    const newTimeoutId = setTimeout(() => {
      callback(...args)
    }, delay)

    setTimeoutId(newTimeoutId)
  }

  // コンポーネントのアンマウント時にタイマーをクリア
  useEffect(() => {
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [timeoutId])

  return debouncedCallback
}

