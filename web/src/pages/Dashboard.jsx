import React, { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { dbHelpers } from '../lib/supabase'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import ExtensionBridge from '../components/common/ExtensionBridge'

export default function Dashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState({ projects: 0, references: 0, texts: 0 })
  const [recentReferences, setRecentReferences] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) {
      loadDashboardData()
    }
  }, [user])

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      
      // 統計データとリーセント参照を並行取得
      const [statisticsData, recentReferencesData] = await Promise.all([
        dbHelpers.getStatistics(user.id),
        dbHelpers.getReferences(null, user.id).then(refs => refs.slice(0, 5)) // 最新5件
      ])

      setStats(statisticsData)
      setRecentReferences(recentReferencesData)
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card p-6">
              <div className="animate-pulse">
                <div className="h-8 bg-gray-200 rounded w-8 mb-3"></div>
                <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
                <div className="h-6 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-secondary-900 dark:text-secondary-100">
          ダッシュボード
        </h1>
        <p className="text-secondary-600 dark:text-secondary-400">
          研究活動の概要と最近の活動を確認できます
        </p>
      </div>

      {/* Chrome拡張機能連携 */}
      <ExtensionBridge />
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="総参照数"
          value={stats.references}
          icon={ReferenceIcon}
          color="primary"
        />
        
        <StatCard
          title="プロジェクト数"
          value={stats.projects}
          icon={ProjectIcon}
          color="success"
        />
        
        <StatCard
          title="保存テキスト"
          value={stats.texts}
          icon={TextIcon}
          color="warning"
        />
        
        <StatCard
          title="今月の活動"
          value={recentReferences.length}
          icon={ActivityIcon}
          color="info"
        />
      </div>

      {/* Recent References */}
      <div className="card">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-secondary-900 dark:text-secondary-100">
            最近の参照
          </h3>
        </div>
        
        {recentReferences.length > 0 ? (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {recentReferences.map((reference) => (
              <div key={reference.id} className="px-6 py-4">
                <div className="flex items-start space-x-3">
                  {reference.favicon && (
                    <img 
                      src={reference.favicon} 
                      alt="" 
                      className="w-4 h-4 mt-1 flex-shrink-0"
                      onError={(e) => { e.target.style.display = 'none' }}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-secondary-900 dark:text-secondary-100 truncate">
                      {reference.title}
                    </p>
                    <p className="text-xs text-secondary-500 truncate">
                      {reference.url}
                    </p>
                    <p className="text-xs text-secondary-400 mt-1">
                      {format(new Date(reference.saved_at), 'MM月dd日 HH:mm', { locale: ja })}
                    </p>
                  </div>
                  {reference.projects?.name && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                      {reference.projects.name}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-6 py-8 text-center">
            <p className="text-sm text-secondary-500">
              まだ参照が保存されていません。Chrome拡張機能を使って参照を保存してみましょう。
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ title, value, icon: Icon, color }) {
  const colorClasses = {
    primary: 'bg-primary-100 text-primary-600',
    success: 'bg-success-100 text-success-600',
    warning: 'bg-warning-100 text-warning-600',
    info: 'bg-info-100 text-info-600'
  }

  return (
    <div className="card p-6">
      <div className="flex items-center">
        <div className="flex-shrink-0">
          <div className={`w-8 h-8 ${colorClasses[color]} rounded-lg flex items-center justify-center`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
        <div className="ml-5 w-0 flex-1">
          <dl>
            <dt className="text-sm font-medium text-secondary-500 truncate">
              {title}
            </dt>
            <dd className="text-lg font-medium text-secondary-900 dark:text-secondary-100">
              {value}
            </dd>
          </dl>
        </div>
      </div>
    </div>
  )
}

// Icons
function ReferenceIcon(props) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
}

function ProjectIcon(props) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  )
}

function TextIcon(props) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
    </svg>
  )
}

function ActivityIcon(props) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  )
}
