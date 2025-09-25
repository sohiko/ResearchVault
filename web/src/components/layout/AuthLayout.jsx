import React from 'react'
import { Link } from 'react-router-dom'
import { ThemeToggle } from '../../hooks/useTheme'

export default function AuthLayout({ children }) {
  return (
    <div className="min-h-screen flex">
      {/* 左側：ブランドエリア */}
      <div className="hidden lg:flex lg:flex-1 lg:items-center lg:justify-center bg-primary-600">
        <div className="max-w-md text-center text-white">
          <div className="mb-8">
            <img 
              src="/android-chrome-192x192.png" 
              alt="ResearchVault Logo" 
              className="w-24 h-24 mx-auto mb-6"
            />
            <h1 className="text-4xl font-bold mb-4">ResearchVault</h1>
            <p className="text-primary-100 text-lg leading-relaxed">
              研究資料を効率的に管理し、<br />
              学術活動をサポートします
            </p>
          </div>
          
          <div className="space-y-4 text-primary-100">
            <div className="flex items-center justify-center space-x-3">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span>Webページの瞬時保存</span>
            </div>
            <div className="flex items-center justify-center space-x-3">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span>自動引用生成</span>
            </div>
            <div className="flex items-center justify-center space-x-3">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span>プロジェクト別整理</span>
            </div>
            <div className="flex items-center justify-center space-x-3">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span>チーム共有機能</span>
            </div>
          </div>
        </div>
      </div>

      {/* 右側：認証フォームエリア */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 bg-white dark:bg-secondary-900">
        <div className="w-full max-w-md space-y-8">
          {/* モバイル用ロゴ */}
          <div className="lg:hidden text-center">
            <Link to="/" className="inline-flex items-center space-x-3">
              <img 
                src="/android-chrome-192x192.png" 
                alt="ResearchVault" 
                className="w-12 h-12"
              />
              <span className="text-2xl font-bold text-primary-600">ResearchVault</span>
            </Link>
          </div>

          {/* テーマ切り替えボタン */}
          <div className="flex justify-end">
            <ThemeToggle />
          </div>

          {/* 認証フォーム */}
          <div className="bg-white dark:bg-secondary-800 py-8 px-6 shadow-soft rounded-xl border border-secondary-200 dark:border-secondary-700">
            {children}
          </div>

          {/* フッター */}
          <div className="text-center text-sm text-secondary-500 dark:text-secondary-400">
            <p>
              続行することで、{' '}
              <Link to="/terms" className="text-primary-600 hover:text-primary-500">
                利用規約
              </Link>{' '}
              と{' '}
              <Link to="/privacy" className="text-primary-600 hover:text-primary-500">
                プライバシーポリシー
              </Link>{' '}
              に同意したものとみなされます。
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
