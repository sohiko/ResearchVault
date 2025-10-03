import { useEffect, useCallback, useRef } from 'react'
import { useModalContext } from './useModalContext'

/**
 * モーダルデータの永続化フック
 * ページリロードや再アクティブ化時にモーダルの入力データを保護する
 */
export const useModalDataPersistence = (modalId, data, setData) => {
  const { hasOpenModals } = useModalContext()
  const storageKey = `modal_data_${modalId}`
  const lastSaveTime = useRef(0)
  const saveInterval = useRef(null)

  // データを自動保存
  const saveData = useCallback(() => {
    if (!data || Object.keys(data).length === 0) {
      return
    }
    
    try {
      const savePayload = {
        data,
        timestamp: Date.now(),
        modalId
      }
      sessionStorage.setItem(storageKey, JSON.stringify(savePayload))
      lastSaveTime.current = Date.now()
      console.log(`モーダルデータを保存しました: ${modalId}`)
    } catch (error) {
      console.warn('モーダルデータの保存に失敗:', error)
    }
  }, [data, modalId, storageKey])

  // データを復元
  const restoreData = useCallback(() => {
    try {
      const saved = sessionStorage.getItem(storageKey)
      if (!saved) {
        return false
      }

      const { data: savedData, timestamp, modalId: savedModalId } = JSON.parse(saved)
      
      // 5分以内のデータのみ復元
      const fiveMinutes = 5 * 60 * 1000
      if (Date.now() - timestamp > fiveMinutes) {
        sessionStorage.removeItem(storageKey)
        return false
      }

      if (savedModalId === modalId && savedData) {
        setData(savedData)
        console.log(`モーダルデータを復元しました: ${modalId}`)
        return true
      }
    } catch (error) {
      console.warn('モーダルデータの復元に失敗:', error)
      sessionStorage.removeItem(storageKey)
    }
    return false
  }, [modalId, storageKey, setData])

  // データをクリア
  const clearData = useCallback(() => {
    try {
      sessionStorage.removeItem(storageKey)
      console.log(`モーダルデータをクリアしました: ${modalId}`)
    } catch (error) {
      console.warn('モーダルデータのクリアに失敗:', error)
    }
  }, [modalId, storageKey])

  // 初回マウント時にデータを復元
  useEffect(() => {
    restoreData()
  }, [restoreData])

  // データが変更されたら自動保存（デバウンス付き）
  useEffect(() => {
    if (!hasOpenModals || !data) {
      return
    }

    // 前回の保存から1秒以内は保存しない
    const timeSinceLastSave = Date.now() - lastSaveTime.current
    if (timeSinceLastSave < 1000) {
      if (saveInterval.current) {
        clearTimeout(saveInterval.current)
      }
      saveInterval.current = setTimeout(saveData, 1000 - timeSinceLastSave)
    } else {
      saveData()
    }

    return () => {
      if (saveInterval.current) {
        clearTimeout(saveInterval.current)
      }
    }
  }, [data, hasOpenModals, saveData])

  // ページ離脱時に最終保存
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (hasOpenModals && data) {
        saveData()
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasOpenModals, data, saveData])

  // モーダルが閉じられた時にデータをクリア
  useEffect(() => {
    return () => {
      // コンポーネントがアンマウントされる時（モーダルが閉じられる時）にデータをクリア
      clearData()
    }
  }, [clearData])

  return {
    saveData,
    restoreData,
    clearData
  }
}

export default useModalDataPersistence
