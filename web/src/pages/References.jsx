import React from 'react'

export default function References() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900 dark:text-secondary-100">
            参照一覧
          </h1>
          <p className="text-secondary-600 dark:text-secondary-400">
            保存された参照資料を管理します
          </p>
        </div>
        <button className="btn-primary">
          新しい参照を追加
        </button>
      </div>
      
      <div className="card p-6">
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-secondary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-secondary-900 dark:text-secondary-100">
            参照がありません
          </h3>
          <p className="mt-1 text-sm text-secondary-500 dark:text-secondary-400">
            Chrome拡張機能を使って参照を保存してみましょう
          </p>
        </div>
      </div>
    </div>
  )
}
