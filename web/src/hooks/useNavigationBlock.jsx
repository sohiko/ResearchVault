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
    if (!shouldBlock) return

    const handleBeforeUnload = (e) => {
      e.preventDefault()
      e.returnValue = message
      return message
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [shouldBlock, message])

  // ブラウザの戻る/進むボタンの制御
  useEffect(() => {
    if (!shouldBlock) return

    const handlePopState = () => {
      if (shouldBlock) {
        // 現在の位置に戻す
        window.history.pushState(null, '', location.pathname + location.search)
        
        // 確認ダイアログを表示
        if (window.confirm(message)) {
          // ユーザーが離脱を選択した場合
          window.removeEventListener('popstate', handlePopState)
          window.history.back()
        }
      }
    }

    // 現在の位置をスタックにプッシュ
    window.history.pushState(null, '', location.pathname + location.search)
    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [shouldBlock, message, location])

  // プログラマティックナビゲーションの制御
  const blockedNavigate = useCallback((to, options = {}) => {
    if (shouldBlock) {
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
