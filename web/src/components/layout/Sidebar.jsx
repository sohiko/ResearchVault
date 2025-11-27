import React, { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useProjects } from '../../hooks/useProjects'
import { useNavigationBlock } from '../../hooks/useNavigationBlock'
import { useModalContext } from '../../hooks/useModalContext'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { renderProjectIcon } from '../../utils/iconRenderer'

import { LayoutDashboard, FileText, FolderKanban, Quote, AlertTriangle, Trash2, Lightbulb, Download, Bookmark } from 'lucide-react'

const navigation = [
  {
    name: 'ダッシュボード',
    href: '/dashboard',
    icon: <LayoutDashboard className="w-5 h-5" />
  },
  {
    name: '参照一覧',
    href: '/references',
    icon: <FileText className="w-5 h-5" />
  },
  {
    name: '保存済みテキスト',
    href: '/selected-texts',
    icon: <Bookmark className="w-5 h-5" />
  },
  {
    name: 'プロジェクト',
    href: '/projects',
    icon: <FolderKanban className="w-5 h-5" />
  },
  {
    name: '引用生成',
    href: '/citations',
    icon: <Quote className="w-5 h-5" />
  }
]

export default function Sidebar() {
  const location = useLocation()
  const { user } = useAuth()
  const { projects, currentProject } = useProjects()
  const { hasOpenModals } = useModalContext()
  const [showAllProjects, setShowAllProjects] = useState(false)
  const [academicCandidatesCount, setAcademicCandidatesCount] = useState(0)
  
  // モーダルが開いている時のナビゲーションをブロック
  const blockedNavigate = useNavigationBlock(hasOpenModals, '入力内容が失われる可能性があります。ページを離れますか？')

  // 学術サイト候補数を取得
  useEffect(() => {
    const loadAcademicCandidatesCount = async () => {
      if (!user) {
        return
      }
      
      try {
        const { count, error } = await supabase
          .from('browsing_history_candidates')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('is_academic', true)
          .is('saved_as_reference', false)
        
        if (error) {
          throw error
        }
        setAcademicCandidatesCount(count || 0)
      } catch (error) {
        console.error('Failed to load academic candidates count:', error)
      }
    }
    
    loadAcademicCandidatesCount()
    
    // 定期的に更新
    const interval = setInterval(loadAcademicCandidatesCount, 30000) // 30秒ごと
    return () => clearInterval(interval)
  }, [user])

  const isActiveLink = (href) => {
    if (href === '/dashboard') {
      return location.pathname === '/dashboard' || location.pathname === '/'
    }
    return location.pathname.startsWith(href)
  }
  
  const quickActions = [
    {
      name: '記録漏れ候補',
      href: '/candidates',
      icon: <AlertTriangle className="w-5 h-5" />,
      badge: academicCandidatesCount > 0 ? academicCandidatesCount.toString() : null
    },
    {
      name: 'ゴミ箱',
      href: '/trash',
      icon: <Trash2 className="w-5 h-5" />
    },
    {
      name: '機能リクエスト',
      href: '/feedback',
      icon: <Lightbulb className="w-5 h-5" />
    }
  ]

  return (
    <div className="flex h-full flex-col bg-white dark:bg-secondary-800 border-r border-secondary-200 dark:border-secondary-700">
      {/* ロゴエリア */}
      <div className="flex h-16 items-center justify-between px-6 border-b border-secondary-200 dark:border-secondary-700">
        <button 
          onClick={() => blockedNavigate('/dashboard')}
          className="flex items-center space-x-3 w-full text-left"
        >
          <img 
            src="/img/icon_circle.png" 
            alt="ResearchVault" 
            className="w-10 h-10"
          />
          <span className="text-xl font-bold text-secondary-900 dark:text-secondary-100">
            ResearchVault
          </span>
        </button>
      </div>

      {/* ナビゲーション */}
      <nav className="flex-1 px-4 py-6 space-y-6 overflow-y-auto">
        {/* メインナビゲーション */}
        <div>
          <ul className="space-y-1">
            {navigation.map((item) => (
              <li key={item.name}>
                <button
                  onClick={() => blockedNavigate(item.href)}
                  className={`nav-link w-full text-left ${
                    isActiveLink(item.href) ? 'nav-link-active' : 'nav-link-inactive'
                  } ${
                    hasOpenModals && !isActiveLink(item.href) ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                  }`}
                  disabled={hasOpenModals && !isActiveLink(item.href)}
                >
                  {item.icon}
                  <span className="ml-3">{item.name}</span>
                </button>
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
            <button
              onClick={() => blockedNavigate('/projects?action=create')}
              className={`p-1 rounded text-secondary-400 hover:text-secondary-600 dark:hover:text-secondary-200 ${
                hasOpenModals ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
              }`}
              title="新規プロジェクト"
              disabled={hasOpenModals}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
          
          <ul className="space-y-1">
            {(showAllProjects ? projects : projects.slice(0, 5)).map((project) => (
              <li key={project.id}>
                <button
                  onClick={() => blockedNavigate(`/projects/${project.id}`)}
                  className={`nav-link w-full text-left ${
                    currentProject?.id === project.id ? 'nav-link-active' : 'nav-link-inactive'
                  } ${
                    hasOpenModals && currentProject?.id !== project.id ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                  }`}
                  disabled={hasOpenModals && currentProject?.id !== project.id}
                >
                  <div className="w-5 h-5 flex items-center justify-center">
                    {renderProjectIcon(project.icon, null, 'w-4 h-4')}
                  </div>
                  <div className="flex-1 ml-3 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {project.name}
                    </div>
                    <div className="text-xs text-secondary-500 dark:text-secondary-400">
                      {project.referenceCount} 件の参照
                    </div>
                  </div>
                </button>
              </li>
            ))}
            
            {projects.length > 5 && (
              <li>
                <button
                  onClick={() => setShowAllProjects(!showAllProjects)}
                  className="nav-link nav-link-inactive text-center w-full"
                >
                  <span className="text-xs text-secondary-500">
                    {showAllProjects ? '表示を減らす' : `すべて表示 (${projects.length})`}
                  </span>
                </button>
              </li>
            )}
            
            {projects.length === 0 && (
              <li>
                <button
                  onClick={() => blockedNavigate('/projects?action=create')}
                  className={`nav-link nav-link-inactive text-center border-2 border-dashed border-secondary-300 dark:border-secondary-600 w-full ${
                    hasOpenModals ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                  }`}
                  disabled={hasOpenModals}
                >
                  <svg className="w-5 h-5 mx-auto text-secondary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="text-sm text-secondary-500 dark:text-secondary-400 mt-1 block">
                    新規プロジェクト
                  </span>
                </button>
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
                <button
                  onClick={() => blockedNavigate(item.href)}
                  className={`nav-link nav-link-inactive justify-between w-full text-left ${
                    hasOpenModals ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                  }`}
                  disabled={hasOpenModals}
                >
                  <div className="flex items-center">
                    {item.icon}
                    <span className="ml-3">{item.name}</span>
                  </div>
                        {item.badge !== null && item.badge !== undefined && (
                          <span className="badge badge-primary">
                            {item.badge}
                          </span>
                        )}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Chrome拡張機能のリンク */}
        <div className="pt-4 border-t border-secondary-200 dark:border-secondary-700">
          <div className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
            <div className="flex items-center space-x-3 mb-2">
              <div className="flex-shrink-0">
                <Download className="w-6 h-6 text-primary-600 dark:text-primary-400" />
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
            <button
              onClick={() => blockedNavigate('/extension/install')}
              className={`btn-primary w-full text-xs ${
                hasOpenModals ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
              }`}
              disabled={hasOpenModals}
            >
              インストール
            </button>
          </div>
        </div>
      </nav>
    </div>
  )
}
