import React, { useEffect, useCallback } from 'react'
import { useModalContext } from '../../hooks/useModalContext'
import { useNavigationBlock } from '../../hooks/useNavigationBlock'

/**
 * ナビゲーション保護機能付きモーダルラッパー
 */
const ProtectedModal = ({ 
  children, 
  modalId, 
  onClose, 
  hasUnsavedChanges = false,
  confirmMessage = '入力内容が失われますが、よろしいですか？'
}) => {
  const { closeModal, setUnsavedChanges } = useModalContext()

  // 未保存の変更状態を更新
  useEffect(() => {
    setUnsavedChanges(modalId, hasUnsavedChanges)
  }, [modalId, hasUnsavedChanges, setUnsavedChanges])

  // ナビゲーションブロック
  useNavigationBlock(
    hasUnsavedChanges, 
    confirmMessage
  )

  // モーダルを閉じる処理
  const handleClose = useCallback(() => {
    const performClose = () => {
      try {
        // 1. 先に未保存フラグをクリア
        setUnsavedChanges(modalId, false)
        
        // 2. モーダルを閉じる（useModalContextから削除）
        closeModal(modalId)
        
        // 3. 親コンポーネントのonCloseを呼び出す（これによりコンポーネントがアンマウントされる）
        if (onClose) {
          onClose()
        }
      } catch (error) {
        console.error('Failed to close modal:', error)
      }
    }

    if (hasUnsavedChanges) {
      // eslint-disable-next-line no-alert
      if (window.confirm(confirmMessage)) {
        performClose()
      }
    } else {
      performClose()
    }
  }, [hasUnsavedChanges, confirmMessage, closeModal, modalId, onClose, setUnsavedChanges])

  // ESCキーでモーダルを閉じる
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        handleClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [handleClose])

  // モーダル外クリックで閉じる
  const handleBackdropClick = useCallback((e) => {
    if (e.target === e.currentTarget) {
      handleClose()
    }
  }, [handleClose])

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center p-4 z-50"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onClick={handleBackdropClick}
    >
      {React.cloneElement(children, { onClose: handleClose })}
    </div>
  )
}

export default ProtectedModal
