import React, { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useProjects } from '../../hooks/useProjects'
import { ThemeToggle } from '../../hooks/useTheme'
import { useNavigationBlock } from '../../hooks/useNavigationBlock'
import { useModalContext } from '../../hooks/useModalContext'

export default function Header({ onMenuClick }) {
  const { user, signOut } = useAuth()
  const { currentProject } = useProjects()
  const { hasOpenModals } = useModalContext()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const userMenuRef = useRef(null)
  
  // モーダルが開いている時のナビゲーションをブロック
  const blockedNavigate = useNavigationBlock(hasOpenModals, '入力内容が失われる可能性があります。ページを離れますか？')

  // ユーザーメニューの外側クリックで閉じる
  useEffect(() => {
    function handleClickOutside(event) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setUserMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleLogout = async () => {
    try {
      await signOut()
      blockedNavigate('/auth/login')
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  const handleSearch = (e) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      blockedNavigate(`/references?search=${encodeURIComponent(searchQuery.trim())}`)
      setSearchQuery('')
    }
  }

  const getUserDisplayName = () => {
    return user?.user_metadata?.name || user?.email?.split('@')[0] || 'ユーザー'
  }

  const getUserInitials = () => {
    const name = getUserDisplayName()
    return name.charAt(0).toUpperCase()
  }

  return (
    <header className="bg-white dark:bg-secondary-800 shadow-sm border-b border-secondary-200 dark:border-secondary-700">
      <div className="flex items-center justify-between h-16 px-4 lg:px-6">
        {/* 左側：メニューボタン（モバイル）とプロジェクト情報 */}
        <div className="flex items-center space-x-4">
          {/* モバイルメニューボタン */}
          <button
            type="button"
            className="lg:hidden p-2 rounded-lg text-secondary-600 hover:text-secondary-900 hover:bg-secondary-100 dark:text-secondary-400 dark:hover:text-secondary-100 dark:hover:bg-secondary-700"
            onClick={onMenuClick}
          >
            <span className="sr-only">メニューを開く</span>
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* 現在のプロジェクト */}
          {currentProject && (
            <div className="hidden sm:flex items-center space-x-2 text-sm">
              <span className="text-secondary-500 dark:text-secondary-400">プロジェクト:</span>
              <Link 
                to={`/projects/${currentProject.id}`}
                className="font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
              >
                {currentProject.name}
              </Link>
            </div>
          )}
        </div>

        {/* 中央：検索バー */}
        <div className="flex-1 max-w-md mx-4">
          <form onSubmit={handleSearch} className="relative">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-secondary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-secondary-300 rounded-lg bg-white dark:bg-secondary-700 text-secondary-900 dark:text-secondary-100 placeholder-secondary-500 dark:placeholder-secondary-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:border-secondary-600 text-sm"
                placeholder="参照を検索..."
              />
            </div>
          </form>
        </div>

        {/* 右側：テーマ切り替えとユーザーメニュー */}
        <div className="flex items-center space-x-3">
          {/* テーマ切り替えボタン */}
          <ThemeToggle />

          {/* 通知ボタン */}
          <button className="p-2 rounded-lg text-secondary-600 hover:text-secondary-900 hover:bg-secondary-100 dark:text-secondary-400 dark:hover:text-secondary-100 dark:hover:bg-secondary-700 relative">
            <span className="sr-only">通知</span>
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM4 8h16l-1 9H5L4 8z" />
            </svg>
            {/* 通知バッジ（仮） */}
            <span className="absolute top-1 right-1 h-2 w-2 bg-error-500 rounded-full"></span>
          </button>

          {/* ユーザーメニュー */}
          <div className="relative" ref={userMenuRef}>
            <button
              type="button"
              className="flex items-center space-x-2 p-2 rounded-lg text-secondary-700 hover:text-secondary-900 hover:bg-secondary-100 dark:text-secondary-300 dark:hover:text-secondary-100 dark:hover:bg-secondary-700"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
            >
              <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                {getUserInitials()}
              </div>
              <span className="hidden sm:block text-sm font-medium">{getUserDisplayName()}</span>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* ドロップダウンメニュー */}
            {userMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-lg shadow-lg bg-white dark:bg-secondary-800 ring-1 ring-black ring-opacity-5 z-50">
                <div className="py-1">
                  {/* ユーザー情報 */}
                  <div className="px-4 py-3 border-b border-secondary-200 dark:border-secondary-600">
                    <div className="text-sm font-medium text-secondary-900 dark:text-secondary-100">
                      {getUserDisplayName()}
                    </div>
                    <div className="text-sm text-secondary-500 dark:text-secondary-400">
                      {user?.email}
                    </div>
                  </div>

                  {/* メニューアイテム */}
                  <Link
                    to="/account"
                    className="block px-4 py-2 text-sm text-secondary-700 hover:bg-secondary-100 dark:text-secondary-300 dark:hover:bg-secondary-700"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    <div className="flex items-center space-x-2">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <span>アカウント設定</span>
                    </div>
                  </Link>

                  <Link
                    to="/settings"
                    className="block px-4 py-2 text-sm text-secondary-700 hover:bg-secondary-100 dark:text-secondary-300 dark:hover:bg-secondary-700"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    <div className="flex items-center space-x-2">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>設定</span>
                    </div>
                  </Link>

                  <a
                    href="https://github.com/yourusername/research-vault"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block px-4 py-2 text-sm text-secondary-700 hover:bg-secondary-100 dark:text-secondary-300 dark:hover:bg-secondary-700"
                  >
                    <div className="flex items-center space-x-2">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>ヘルプ</span>
                    </div>
                  </a>

                  <div className="border-t border-secondary-200 dark:border-secondary-600">
                    <button
                      onClick={handleLogout}
                      className="block w-full text-left px-4 py-2 text-sm text-error-700 hover:bg-error-50 dark:text-error-400 dark:hover:bg-error-900/20"
                    >
                      <div className="flex items-center space-x-2">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        <span>ログアウト</span>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
