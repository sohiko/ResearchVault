import React, { createContext, useContext, useState, useCallback } from 'react'

const ModalContext = createContext()

export const ModalProvider = ({ children }) => {
  const [openModals, setOpenModals] = useState(new Set())
  const [modalData, setModalData] = useState(new Map())

  const openModal = useCallback((modalId, data = null) => {
    setOpenModals(prev => new Set([...prev, modalId]))
    if (data) {
      setModalData(prev => new Map([...prev, [modalId, data]]))
    }
  }, [])

  const closeModal = useCallback((modalId) => {
    setOpenModals(prev => {
      const newSet = new Set(prev)
      newSet.delete(modalId)
      return newSet
    })
    setModalData(prev => {
      const newMap = new Map(prev)
      newMap.delete(modalId)
      return newMap
    })
  }, [])

  const getModalData = useCallback((modalId) => {
    return modalData.get(modalId)
  }, [modalData])

  const hasOpenModals = openModals.size > 0
  const hasUnsavedChanges = useCallback((modalId) => {
    const data = modalData.get(modalId)
    return data?.hasUnsavedChanges || false
  }, [modalData])

  const setUnsavedChanges = useCallback((modalId, hasChanges) => {
    setModalData(prev => {
      const newMap = new Map(prev)
      const existingData = newMap.get(modalId) || {}
      newMap.set(modalId, { ...existingData, hasUnsavedChanges: hasChanges })
      return newMap
    })
  }, [])

  const value = {
    openModals: Array.from(openModals),
    hasOpenModals,
    openModal,
    closeModal,
    getModalData,
    hasUnsavedChanges,
    setUnsavedChanges
  }

  return (
    <ModalContext.Provider value={value}>
      {children}
    </ModalContext.Provider>
  )
}

export const useModalContext = () => {
  const context = useContext(ModalContext)
  if (!context) {
    throw new Error('useModalContext must be used within a ModalProvider')
  }
  return context
}

// モーダル状態の変更を監視するためのカスタムフック
export const useModalStateChange = (callback) => {
  const { hasOpenModals } = useModalContext()
  const prevHasOpenModalsRef = React.useRef(hasOpenModals)

  React.useEffect(() => {
    if (prevHasOpenModalsRef.current !== hasOpenModals) {
      callback(hasOpenModals, prevHasOpenModalsRef.current)
      prevHasOpenModalsRef.current = hasOpenModals
    }
  }, [hasOpenModals, callback])
}
