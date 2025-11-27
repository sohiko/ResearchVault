import React, { createContext, useCallback, useContext, useState } from 'react'

const ReferenceActionContext = createContext(null)

export const ReferenceActionProvider = ({ children }) => {
  const [pendingAction, setPendingAction] = useState(null)

  const requestReferenceEdit = useCallback((referenceId, projectId = null) => {
    if (!referenceId) {
      return
    }

    setPendingAction({
      type: 'edit',
      referenceId,
      projectId: projectId || null,
      requestedAt: Date.now()
    })
  }, [])

  const clearPendingAction = useCallback(() => {
    setPendingAction(null)
  }, [])

  return (
    <ReferenceActionContext.Provider
      value={{
        pendingAction,
        requestReferenceEdit,
        clearPendingAction
      }}
    >
      {children}
    </ReferenceActionContext.Provider>
  )
}

export const useReferenceAction = () => {
  const context = useContext(ReferenceActionContext)

  if (!context) {
    throw new Error('useReferenceAction must be used within ReferenceActionProvider')
  }

  return context
}

