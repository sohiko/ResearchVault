import React, { useMemo, useState } from 'react'
import { useReferenceFetchQueue } from '../../context/ReferenceFetchQueueContext'

const STATUS_LABELS = {
  pending: '待機中',
  processing: '処理中',
  success: '完了',
  error: 'エラー'
}

const STATUS_COLORS = {
  pending: 'bg-amber-400',
  processing: 'bg-blue-500 animate-pulse',
  success: 'bg-emerald-500',
  error: 'bg-rose-500'
}

export default function ReferenceFetchStatusPanel() {
  const { tasks, dismissTask, hasActiveTasks } = useReferenceFetchQueue()
  const [isCollapsed, setIsCollapsed] = useState(false)

  const visibleTasks = useMemo(() => {
    return [...tasks]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 4)
  }, [tasks])

  const totalPending = tasks.filter((task) => task.status === 'pending').length
  const totalProcessing = tasks.filter(
    (task) => task.status === 'processing'
  ).length

  return (
    <div className="fixed bottom-4 right-4 z-40 w-[320px] pointer-events-none">
      <div className="bg-white border border-gray-200 rounded-xl shadow-2xl pointer-events-auto overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
          <div>
            <p className="text-sm font-semibold text-gray-900">参照取得キュー</p>
            <p className="text-xs text-gray-500">
              {hasActiveTasks
                ? `待機 ${totalPending}・処理中 ${totalProcessing}`
                : '現在の処理はありません'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsCollapsed((prev) => !prev)}
            className="text-gray-500 hover:text-gray-700"
          >
            <span className="sr-only">トグル</span>
            {isCollapsed ? (
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            ) : (
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 15l7-7 7 7"
                />
              </svg>
            )}
          </button>
        </div>

        {!isCollapsed && (
          <div className="divide-y divide-gray-100">
            {visibleTasks.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-gray-500">
                キューに追加された処理はありません
              </div>
            )}
            {visibleTasks.map((task) => {
              const isActive = ['pending', 'processing'].includes(task.status)
              return (
                <div key={task.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            STATUS_COLORS[task.status] || 'bg-gray-300'
                          }`}
                        />
                        <p className="text-sm font-medium text-gray-900 truncate max-w-[180px]">
                          {task.manualFields?.title ||
                            task.manualFields?.urlTitle ||
                            task.url}
                        </p>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {STATUS_LABELS[task.status] || '状態不明'}
                        {task.statusMessage ? `・${task.statusMessage}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => dismissTask(task.id)}
                      disabled={isActive}
                      className="text-gray-400 hover:text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <span className="sr-only">削除</span>
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-2 truncate">
                    {task.url}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

