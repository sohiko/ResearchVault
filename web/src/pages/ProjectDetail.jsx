import React from 'react'
import { useParams } from 'react-router-dom'

export default function ProjectDetail() {
  const { id } = useParams()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-secondary-900 dark:text-secondary-100">
          プロジェクト詳細
        </h1>
        <p className="text-secondary-600 dark:text-secondary-400">
          プロジェクトID: {id}
        </p>
      </div>
      
      <div className="card p-6">
        <p className="text-secondary-600 dark:text-secondary-400">
          プロジェクト詳細ページは準備中です
        </p>
      </div>
    </div>
  )
}
