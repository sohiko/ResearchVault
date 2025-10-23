import { useEffect, useCallback, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

/**
 * ナビゲーションをブロックするカスタムフック
 * モーダルが開いている時や未保存の変更がある時に使用
 */
export const useNavigationBlock = (shouldBlock, message = '変更内容が失われますが、よろしいですか？') => {
  const navigate = useNavigate()
  const location = useLocation()

  // ページ離脱時の確認
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (shouldBlock) {
        e.preventDefault()
        e.returnValue = message
        return message
      }
    }

    // shouldBlockの状態に関わらず常にリスナーを登録し、内部で条件判定
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [shouldBlock, message])

  // ブラウザの戻る/進むボタンの制御
  useEffect(() => {
    if (!shouldBlock) {
      // shouldBlockがfalseの場合は何もしない（履歴操作も行わない）
      return
    }

    // handlePopStateをuseRefで保持し、常に最新のshouldBlockを参照できるようにする
    let isActive = true

    const handlePopState = () => {
      // コンポーネントがまだアクティブで、かつshouldBlockがtrueの場合のみ処理
      if (!isActive || !shouldBlock) {
        return
      }

      // 現在の位置に戻す
      window.history.pushState(null, '', location.pathname + location.search)
      
      // 確認ダイアログを表示
      // eslint-disable-next-line no-alert
      if (window.confirm(message)) {
        // ユーザーが離脱を選択した場合
        isActive = false
        window.removeEventListener('popstate', handlePopState)
        setTimeout(() => window.history.back(), 0)
      }
    }

    // 現在の位置をスタックにプッシュ
    window.history.pushState(null, '', location.pathname + location.search)
    window.addEventListener('popstate', handlePopState)

    return () => {
      // クリーンアップ時に確実にフラグをfalseにしてリスナーを削除
      isActive = false
      window.removeEventListener('popstate', handlePopState)
    }
  }, [shouldBlock, message, location])

  // プログラマティックナビゲーションの制御
  const blockedNavigate = useCallback((to, options = {}) => {
    if (shouldBlock) {
      // eslint-disable-next-line no-alert
      if (window.confirm(message)) {
        navigate(to, options)
      }
    } else {
      navigate(to, options)
    }
  }, [navigate, shouldBlock, message])

  return blockedNavigate
}

/**
 * モーダル状態管理用のカスタムフック
 */
export const useModalState = () => {
  const [modals, setModals] = useState(new Set())

  const openModal = useCallback((modalId) => {
    setModals(prev => new Set([...prev, modalId]))
  }, [])

  const closeModal = useCallback((modalId) => {
    setModals(prev => {
      const newSet = new Set(prev)
      newSet.delete(modalId)
      return newSet
    })
  }, [])

  const hasOpenModals = modals.size > 0

  return {
    openModal,
    closeModal,
    hasOpenModals,
    openModals: Array.from(modals)
  }
}
