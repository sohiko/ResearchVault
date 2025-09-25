import React, { useState } from 'react'
import Header from './Header'
import Sidebar from './Sidebar'
import { useTheme } from '../../hooks/useTheme'

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  useTheme() // テーマの読み込みのため

  return (
    <div className="min-h-screen bg-secondary-50 dark:bg-secondary-900">
      {/* サイドバー（モバイル用オーバーレイ） */}
      <div className={`fixed inset-0 z-40 lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}>
        <div 
          className="fixed inset-0 bg-secondary-600 bg-opacity-75"
          onClick={() => setSidebarOpen(false)}
        />
        <div className="relative flex w-full max-w-xs flex-1 flex-col bg-white dark:bg-secondary-800">
          <div className="absolute top-0 right-0 -mr-12 pt-2">
            <button
              type="button"
              className="ml-1 flex h-10 w-10 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
              onClick={() => setSidebarOpen(false)}
            >
              <span className="sr-only">サイドバーを閉じる</span>
              <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <Sidebar />
        </div>
      </div>

      {/* デスクトップ用サイドバー */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <Sidebar />
      </div>

      {/* メインコンテンツエリア */}
      <div className="lg:pl-64 flex flex-col min-h-screen">
        {/* ヘッダー */}
        <Header onMenuClick={() => setSidebarOpen(true)} />
        
        {/* メインコンテンツ */}
        <main className="flex-1 p-4 lg:p-6">
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
