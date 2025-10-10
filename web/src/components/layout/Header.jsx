import React, { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useProjects } from '../../hooks/useProjects'
import { ThemeToggle } from '../../hooks/useTheme'
import { useNavigationBlock } from '../../hooks/useNavigationBlock'
import { useModalContext } from '../../hooks/useModalContext'
import { Menu, Search, Bell, ChevronDown, User, Settings, HelpCircle, LogOut } from 'lucide-react'

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
            <Menu className="h-6 w-6" />
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
                <Search className="h-5 w-5 text-secondary-400" />
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
            <Bell className="h-6 w-6" />
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
              <ChevronDown className="h-4 w-4" />
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
                      <User className="h-4 w-4" />
                      <span>アカウント設定</span>
                    </div>
                  </Link>

                  <Link
                    to="/settings"
                    className="block px-4 py-2 text-sm text-secondary-700 hover:bg-secondary-100 dark:text-secondary-300 dark:hover:bg-secondary-700"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    <div className="flex items-center space-x-2">
                      <Settings className="h-4 w-4" />
                      <span>設定</span>
                    </div>
                  </Link>

                  <a
                    href="https://github.com/sohiko/ResearchVault"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block px-4 py-2 text-sm text-secondary-700 hover:bg-secondary-100 dark:text-secondary-300 dark:hover:bg-secondary-700"
                  >
                    <div className="flex items-center space-x-2">
                      <HelpCircle className="h-4 w-4" />
                      <span>ヘルプ</span>
                    </div>
                  </a>

                  <div className="border-t border-secondary-200 dark:border-secondary-600">
                    <button
                      onClick={handleLogout}
                      className="block w-full text-left px-4 py-2 text-sm text-error-700 hover:bg-error-50 dark:text-error-400 dark:hover:bg-error-900/20"
                    >
                      <div className="flex items-center space-x-2">
                        <LogOut className="h-4 w-4" />
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
