import React, { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'

export default function DatabaseTest() {
  const { user } = useAuth()
  const [testResults, setTestResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState('未テスト')
  const [projects, setProjects] = useState([])
  const [error, setError] = useState(null)

  const runDatabaseTest = async () => {
    setLoading(true)
    setError(null)
    setTestResults([])
    setConnectionStatus('テスト中...')

    const results = []

    try {
      // テスト1: 基本的な接続テスト
      results.push({
        name: 'Supabase接続テスト',
        status: 'running',
        message: 'Supabaseへの接続を確認中...'
      })

      const { data: connectionTest, error: connectionError } = await supabase
        .from('projects')
        .select('count')
        .limit(1)

      if (connectionError) {
        results[0] = {
          name: 'Supabase接続テスト',
          status: 'failed',
          message: `接続エラー: ${connectionError.message}`,
          details: connectionError
        }
        setConnectionStatus('接続失敗')
        throw connectionError
      }

      results[0] = {
        name: 'Supabase接続テスト',
        status: 'success',
        message: 'Supabaseへの接続が正常に確立されました',
        details: connectionTest
      }

      // テスト2: プロジェクトデータの取得テスト
      results.push({
        name: 'プロジェクトデータ取得テスト',
        status: 'running',
        message: 'プロジェクトテーブルからデータを取得中...'
      })

      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false })

      if (projectsError) {
        results[1] = {
          name: 'プロジェクトデータ取得テスト',
          status: 'failed',
          message: `データ取得エラー: ${projectsError.message}`,
          details: projectsError
        }
        throw projectsError
      }

      results[1] = {
        name: 'プロジェクトデータ取得テスト',
        status: 'success',
        message: `${projectsData.length}件のプロジェクトデータを正常に取得しました`,
        details: projectsData
      }

      setProjects(projectsData || [])

      // テスト3: データの整合性チェック
      results.push({
        name: 'データ整合性チェック',
        status: 'running',
        message: 'データの整合性を確認中...'
      })

      const hasValidData = projectsData.every(project => 
        project.id && 
        project.name && 
        project.owner_id && 
        project.created_at
      )

      if (hasValidData) {
        results[2] = {
          name: 'データ整合性チェック',
          status: 'success',
          message: 'すべてのプロジェクトデータが正常な形式です',
          details: { validProjects: projectsData.length }
        }
      } else {
        results[2] = {
          name: 'データ整合性チェック',
          status: 'warning',
          message: '一部のプロジェクトデータに不整合があります',
          details: projectsData
        }
      }

      // テスト4: パフォーマンステスト
      results.push({
        name: 'パフォーマンステスト',
        status: 'running',
        message: 'クエリ実行時間を測定中...'
      })

      const startTime = performance.now()
      const { data: perfTest, error: perfError } = await supabase
        .from('projects')
        .select('id, name, created_at')
        .eq('owner_id', user.id)
        .limit(10)

      const endTime = performance.now()
      const executionTime = endTime - startTime

      if (perfError) {
        results[3] = {
          name: 'パフォーマンステスト',
          status: 'failed',
          message: `パフォーマンステストエラー: ${perfError.message}`,
          details: perfError
        }
      } else {
        results[3] = {
          name: 'パフォーマンステスト',
          status: 'success',
          message: `クエリ実行時間: ${executionTime.toFixed(2)}ms`,
          details: { 
            executionTime: `${executionTime.toFixed(2)}ms`,
            recordCount: perfTest.length,
            performance: executionTime < 100 ? '優秀' : executionTime < 500 ? '良好' : '要改善'
          }
        }
      }

      setConnectionStatus('接続成功')
      setTestResults(results)

    } catch (error) {
      console.error('Database test failed:', error)
      setError(`テスト実行エラー: ${error.message}`)
      setConnectionStatus('テスト失敗')
      setTestResults(results)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'success': return 'text-green-600 bg-green-50 border-green-200'
      case 'failed': return 'text-red-600 bg-red-50 border-red-200'
      case 'warning': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'running': return 'text-blue-600 bg-blue-50 border-blue-200'
      default: return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'success': return '✅'
      case 'failed': return '❌'
      case 'warning': return '⚠️'
      case 'running': return '🔄'
      default: return 'ℹ️'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900 dark:text-secondary-100">
            データベース接続テスト
          </h1>
          <p className="text-secondary-600 dark:text-secondary-400">
            Supabaseデータベースとの接続状況とプロジェクトデータの取得をテストします
          </p>
        </div>
        <button
          onClick={runDatabaseTest}
          disabled={loading || !user}
          className="btn-primary"
        >
          {loading ? 'テスト実行中...' : 'テスト実行'}
        </button>
      </div>

      {/* 接続ステータス */}
      <div className="card p-6">
        <div className="flex items-center space-x-3">
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
            connectionStatus === '接続成功' ? 'bg-green-100 text-green-800' :
            connectionStatus === '接続失敗' ? 'bg-red-100 text-red-800' :
            connectionStatus === 'テスト中...' ? 'bg-blue-100 text-blue-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {connectionStatus}
          </div>
          <span className="text-sm text-secondary-600">
            ユーザーID: {user?.id || '未認証'}
          </span>
        </div>
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {/* テスト結果 */}
      {testResults.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-secondary-900 dark:text-secondary-100">
            テスト結果
          </h2>
          {testResults.map((result, index) => (
            <div key={index} className={`card p-4 border ${getStatusColor(result.status)}`}>
              <div className="flex items-start space-x-3">
                <span className="text-lg">{getStatusIcon(result.status)}</span>
                <div className="flex-1">
                  <h3 className="font-medium">{result.name}</h3>
                  <p className="text-sm mt-1">{result.message}</p>
                  {result.details && (
                    <details className="mt-2">
                      <summary className="text-xs cursor-pointer text-secondary-500 hover:text-secondary-700">
                        詳細情報を表示
                      </summary>
                      <pre className="mt-2 text-xs bg-white dark:bg-gray-800 p-2 rounded border overflow-auto max-h-32">
                        {JSON.stringify(result.details, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* プロジェクトデータ表示 */}
      {projects.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-secondary-900 dark:text-secondary-100">
            取得したプロジェクトデータ ({projects.length}件)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <div key={project.id} className="card p-4 hover:shadow-lg transition-shadow">
                <div className="flex items-start space-x-3">
                  <span className="text-2xl">{project.icon || '📂'}</span>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-secondary-900 dark:text-secondary-100 truncate">
                      {project.name}
                    </h3>
                    <p className="text-sm text-secondary-600 dark:text-secondary-400 mt-1 line-clamp-2">
                      {project.description || '説明なし'}
                    </p>
                    <div className="flex items-center space-x-2 mt-2">
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: project.color || '#3b82f6' }}
                      ></div>
                      <span className="text-xs text-secondary-500">
                        {format(new Date(project.created_at), 'yyyy/MM/dd HH:mm', { locale: ja })}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-secondary-400">
                      ID: {project.id.substring(0, 8)}...
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* テスト説明 */}
      <div className="card p-6 bg-blue-50 dark:bg-blue-900/20">
        <div className="flex items-start space-x-3">
          <svg className="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
              データベース接続テストについて
            </h4>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              このテストでは、Supabaseデータベースへの接続、プロジェクトデータの取得、データの整合性、クエリのパフォーマンスを確認します。
              テストを実行する前に、上記のSQLでプロジェクトテーブルに仮想データを挿入してください。
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
