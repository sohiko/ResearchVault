import React, { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useProjects } from '../../hooks/useProjects'
import { ThemeToggle } from '../../hooks/useTheme'
import { Menu, ChevronDown, User, Settings, HelpCircle, LogOut } from 'lucide-react'

export default function Header({ onMenuClick }) {
  const { user, signOut } = useAuth()
  const { currentProject } = useProjects()
  const navigate = useNavigate()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef(null)

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
      navigate('/auth/login')
    } catch (error) {
      console.error('Logout error:', error)
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

        {/* 中央：スペーサー */}
        <div className="flex-1"></div>

        {/* 右側：テーマ切り替えとユーザーメニュー */}
        <div className="flex items-center space-x-3">
          {/* テーマ切り替えボタン */}
          <ThemeToggle />

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
