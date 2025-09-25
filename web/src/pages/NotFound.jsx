import React from 'react'
import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary-50 dark:bg-secondary-900">
      <div className="text-center">
        <div className="mb-6">
          <h1 className="text-9xl font-bold text-secondary-200 dark:text-secondary-700">
            404
          </h1>
        </div>
        <h2 className="text-2xl font-bold text-secondary-900 dark:text-secondary-100 mb-2">
          ページが見つかりません
        </h2>
        <p className="text-secondary-600 dark:text-secondary-400 mb-8">
          お探しのページは存在しないか、移動された可能性があります。
        </p>
        <Link to="/dashboard" className="btn-primary">
          ダッシュボードに戻る
        </Link>
      </div>
    </div>
  )
}
