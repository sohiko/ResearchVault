import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useProjects } from '../../hooks/useProjects'

const navigation = [
  {
    name: 'ダッシュボード',
    href: '/dashboard',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2V7z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v1H8V5z" />
      </svg>
    )
  },
  {
    name: '参照一覧',
    href: '/references',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    )
  },
  {
    name: 'プロジェクト',
    href: '/projects',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    )
  },
  {
    name: '引用生成',
    href: '/citations',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    )
  }
]

const quickActions = [
  {
    name: '記録漏れ候補',
    href: '/candidates',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
    ),
    badge: '3'
  },
  {
    name: 'ゴミ箱',
    href: '/trash',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    )
  },
  {
    name: '機能リクエスト',
    href: '/feedback',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    )
  }
]

export default function Sidebar() {
  const location = useLocation()
  const { projects, currentProject } = useProjects()

  const isActiveLink = (href) => {
    if (href === '/dashboard') {
      return location.pathname === '/dashboard' || location.pathname === '/'
    }
    return location.pathname.startsWith(href)
  }

  const getProjectIcon = (project) => {
    // プロジェクトタイプに応じたアイコンを返す
    const projectType = project.name.toLowerCase()
    
    if (projectType.includes('extended essay') || projectType.includes('ee')) {
      return '📝'
    } else if (projectType.includes('tok') || projectType.includes('theory of knowledge')) {
      return '💭'
    } else if (projectType.includes('cas')) {
      return '🎯'
    } else if (projectType.includes('ia') || projectType.includes('internal assessment')) {
      return '🔬'
    } else {
      return '📂'
    }
  }

  return (
    <div className="flex h-full flex-col bg-white dark:bg-secondary-800 border-r border-secondary-200 dark:border-secondary-700">
      {/* ロゴエリア */}
      <div className="flex h-16 items-center justify-between px-6 border-b border-secondary-200 dark:border-secondary-700">
        <Link to="/dashboard" className="flex items-center space-x-3">
          <img 
            src="../favicon/android-chrome-192x192.png" 
            alt="ResearchVault" 
            className="w-8 h-8"
          />
          <span className="text-xl font-bold text-secondary-900 dark:text-secondary-100">
            ResearchVault
          </span>
        </Link>
      </div>

      {/* ナビゲーション */}
      <nav className="flex-1 px-4 py-6 space-y-6 overflow-y-auto">
        {/* メインナビゲーション */}
        <div>
          <ul className="space-y-1">
            {navigation.map((item) => (
              <li key={item.name}>
                <Link
                  to={item.href}
                  className={`nav-link ${
                    isActiveLink(item.href) ? 'nav-link-active' : 'nav-link-inactive'
                  }`}
                >
                  {item.icon}
                  <span className="ml-3">{item.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* プロジェクト一覧 */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-secondary-700 dark:text-secondary-300">
              プロジェクト
            </h3>
            <Link
              to="/projects?action=create"
              className="p-1 rounded text-secondary-400 hover:text-secondary-600 dark:hover:text-secondary-200"
              title="新規プロジェクト"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </Link>
          </div>
          
          <ul className="space-y-1">
            {projects.slice(0, 5).map((project) => (
              <li key={project.id}>
                <Link
                  to={`/projects/${project.id}`}
                  className={`nav-link ${
                    currentProject?.id === project.id ? 'nav-link-active' : 'nav-link-inactive'
                  }`}
                >
                  <span className="text-lg">{getProjectIcon(project)}</span>
                  <div className="flex-1 ml-3 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {project.name}
                    </div>
                    <div className="text-xs text-secondary-500 dark:text-secondary-400">
                      {project.referenceCount} 件の参照
                    </div>
                  </div>
                </Link>
              </li>
            ))}
            
            {projects.length > 5 && (
              <li>
                <Link
                  to="/projects"
                  className="nav-link nav-link-inactive text-center"
                >
                  <span className="text-sm">すべて表示 ({projects.length})</span>
                </Link>
              </li>
            )}
            
            {projects.length === 0 && (
              <li>
                <Link
                  to="/projects?action=create"
                  className="nav-link nav-link-inactive text-center border-2 border-dashed border-secondary-300 dark:border-secondary-600"
                >
                  <svg className="w-5 h-5 mx-auto text-secondary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="text-sm text-secondary-500 dark:text-secondary-400 mt-1 block">
                    新規プロジェクト
                  </span>
                </Link>
              </li>
            )}
          </ul>
        </div>

        {/* クイックアクション */}
        <div>
          <h3 className="text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-3">
            その他
          </h3>
          <ul className="space-y-1">
            {quickActions.map((item) => (
              <li key={item.name}>
                <Link
                  to={item.href}
                  className={`nav-link nav-link-inactive justify-between`}
                >
                  <div className="flex items-center">
                    {item.icon}
                    <span className="ml-3">{item.name}</span>
                  </div>
                  {item.badge && (
                    <span className="badge badge-primary">
                      {item.badge}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Chrome拡張機能のリンク */}
        <div className="pt-4 border-t border-secondary-200 dark:border-secondary-700">
          <div className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
            <div className="flex items-center space-x-3 mb-2">
              <div className="flex-shrink-0">
                <svg className="w-6 h-6 text-primary-600 dark:text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                </svg>
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-medium text-primary-900 dark:text-primary-100">
                  Chrome拡張機能
                </h4>
                <p className="text-xs text-primary-700 dark:text-primary-300">
                  Webページを素早く保存
                </p>
              </div>
            </div>
            <a
              href="/extension/install"
              className="btn-primary w-full text-xs"
            >
              インストール
            </a>
          </div>
        </div>
      </nav>
    </div>
  )
}
