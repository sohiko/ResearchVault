import React from 'react'

const ConfirmDialog = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = '確認', 
  cancelText = 'キャンセル',
  icon = null,
  confirmButtonClassName = 'bg-red-600 hover:bg-red-700'
}) => {
  if (!isOpen) {
    return null
  }

  // メッセージを改行で分割して表示
  const messageLines = typeof message === 'string' 
    ? message.split('\n') 
    : [message]

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center p-4 z-[60]"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full shadow-xl">
        <div className="px-6 py-5">
          <div className="flex items-start gap-4">
            {icon && (
              <div className="flex-shrink-0">
                {icon}
              </div>
            )}
            <div className="flex-1">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">{title}</h3>
              <div className="text-gray-600 dark:text-gray-400 text-sm space-y-2">
                {messageLines.map((line, index) => (
                  <p key={index} className={line.startsWith('・') ? 'ml-2' : ''}>
                    {line}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-white rounded-md ${confirmButtonClassName}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmDialog
