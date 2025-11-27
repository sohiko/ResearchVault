import React, { useState } from 'react'
import { useReferenceFetchQueue } from '../../context/ReferenceFetchQueueContext'
import { useNavigate } from 'react-router-dom'
import { useReferenceAction } from '../../context/ReferenceActionContext'

export default function ReferenceFetchStatus() {
  const { tasks, activeTasks, dismissTask } = useReferenceFetchQueue()
  const [isMinimized, setIsMinimized] = useState(false)
  const navigate = useNavigate()
  const { requestReferenceEdit } = useReferenceAction()

  // アクティブなタスクまたは完了したがまだ表示されているタスクがある場合に表示
  const visibleTasks = tasks.filter(task =>
    task.status === 'processing' ||
    task.status === 'pending' ||
    (task.status === 'success' && !task.dismissed) ||
    (task.status === 'error' && !task.dismissed)
  )

  if (visibleTasks.length === 0) {
    return null
  }

  const processingCount = activeTasks.length

  const handleTaskClick = (task) => {
    if (task.status === 'success' && task.reference) {
      // 参照ページへ移動して編集モーダルを開く
      const destination = task.reference.project_id
        ? `/projects/${task.reference.project_id}`
        : '/references'

      navigate(destination)
      requestReferenceEdit(task.reference.id, task.reference.project_id)
      dismissTask(task.id)
    }
  }

  return (
    <div className={`fixed bottom-4 right-4 z-50 transition-all duration-300 ${isMinimized ? 'w-auto' : 'w-80'
      }`}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Header */}
        <div className="bg-gray-50 dark:bg-gray-900 px-4 py-3 flex items-center justify-between border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2">
            {processingCount > 0 ? (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-500 border-t-transparent"></div>
            ) : (
              <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
            <span className="font-medium text-sm text-gray-900 dark:text-gray-100">
              {processingCount > 0 ? '情報取得中...' : '処理完了'}
            </span>
            <span className="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs px-2 py-0.5 rounded-full">
              {visibleTasks.length}
            </span>
          </div>
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 focus:outline-none"
          >
            {isMinimized ? (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            )}
          </button>
        </div>

        {/* Task List */}
        {!isMinimized && (
          <div className="max-h-60 overflow-y-auto">
            {visibleTasks.map(task => (
              <div
                key={task.id}
                className={`p-3 border-b border-gray-100 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors ${task.status === 'success' ? 'cursor-pointer' : ''
                  }`}
                onClick={() => handleTaskClick(task)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0 mr-2">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {task.manualFields?.title || task.url}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {task.statusMessage}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    {task.status === 'processing' && (
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-500 border-t-transparent"></div>
                    )}
                    {task.status === 'success' && (
                      <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                    {task.status === 'error' && (
                      <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                    {task.status === 'pending' && (
                      <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                  </div>
                </div>
                {task.status === 'error' && (
                  <div className="mt-1 flex justify-end">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        dismissTask(task.id)
                      }}
                      className="text-xs text-gray-500 hover:text-gray-700 underline"
                    >
                      閉じる
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
