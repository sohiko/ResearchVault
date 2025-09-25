import React from 'react'
import { Link } from 'react-router-dom'

export default function Signup() {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-secondary-900 dark:text-secondary-100">
          アカウント作成
        </h2>
        <p className="mt-2 text-sm text-secondary-600 dark:text-secondary-400">
          ResearchVaultで研究活動を始めましょう
        </p>
      </div>
      <div className="text-center py-12">
        <p className="text-secondary-600 dark:text-secondary-400">
          アカウント作成機能は準備中です
        </p>
        <Link to="/auth/login" className="btn-primary mt-4">
          ログインページへ戻る
        </Link>
      </div>
    </div>
  )
}
