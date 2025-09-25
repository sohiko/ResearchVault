import React from 'react'

export default function Projects() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900 dark:text-secondary-100">
            プロジェクト
          </h1>
          <p className="text-secondary-600 dark:text-secondary-400">
            研究プロジェクトを管理します
          </p>
        </div>
        <button className="btn-primary">
          新しいプロジェクト
        </button>
      </div>
      
      <div className="card p-6">
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-secondary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-secondary-900 dark:text-secondary-100">
            プロジェクトがありません
          </h3>
          <p className="mt-1 text-sm text-secondary-500 dark:text-secondary-400">
            新しいプロジェクトを作成して研究を始めましょう
          </p>
        </div>
      </div>
    </div>
  )
}
