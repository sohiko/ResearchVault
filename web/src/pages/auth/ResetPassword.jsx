import React from 'react'
import { Link } from 'react-router-dom'

export default function ResetPassword() {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-secondary-900 dark:text-secondary-100">
          新しいパスワード
        </h2>
        <p className="mt-2 text-sm text-secondary-600 dark:text-secondary-400">
          新しいパスワードを入力してください
        </p>
      </div>
      <div className="text-center py-12">
        <p className="text-secondary-600 dark:text-secondary-400">
          パスワードリセット機能は準備中です
        </p>
        <Link to="/auth/login" className="btn-primary mt-4">
          ログインページへ戻る
        </Link>
      </div>
    </div>
  )
}
