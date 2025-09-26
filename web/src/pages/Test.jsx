import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

export default function Test() {
  const { user } = useAuth()
  const [testResults, setTestResults] = useState({})
  const [loading, setLoading] = useState(false)

  const runTests = useCallback(async () => {
    setLoading(true)
    const results = {}

    try {
      // テスト1: Supabase接続
      try {
        const { error } = await supabase
          .from('profiles')
          .select('*')
          .limit(1)
        
        results.connection = error ? `エラー: ${error.message}` : '接続成功'
      } catch (error) {
        results.connection = `例外: ${error.message}`
      }

      // テスト2: プロファイルテーブル
      if (user) {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single()
          
          results.profile = error ? `エラー: ${error.message}` : `成功: ${data?.name || '名前なし'}`
        } catch (error) {
          results.profile = `例外: ${error.message}`
        }

        // テスト3: プロジェクトテーブル
        try {
          const { data, error } = await supabase
            .from('projects')
            .select('*')
            .eq('owner_id', user.id)
            .limit(5)
          
          results.projects = error ? `エラー: ${error.message}` : `成功: ${data?.length || 0}件`
        } catch (error) {
          results.projects = `例外: ${error.message}`
        }

        // テスト4: 参照テーブル
        try {
          const { data, error } = await supabase
            .from('references')
            .select('*')
            .eq('saved_by', user.id)
            .limit(5)
          
          results.references = error ? `エラー: ${error.message}` : `成功: ${data?.length || 0}件`
        } catch (error) {
          results.references = `例外: ${error.message}`
        }
      } else {
        results.profile = 'ユーザー未ログイン'
        results.projects = 'ユーザー未ログイン'
        results.references = 'ユーザー未ログイン'
      }

    } catch (error) {
      results.general = `全般エラー: ${error.message}`
    }

    setTestResults(results)
    setLoading(false)
  }, [user])

  useEffect(() => {
    runTests()
  }, [runTests])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-secondary-900 dark:text-secondary-100">
          データベース接続テスト
        </h1>
        <p className="text-secondary-600 dark:text-secondary-400">
          Supabaseとの接続状況を確認します
        </p>
      </div>

      <div className="card p-6">
        <div className="space-y-4">
          <div>
            <strong>ユーザー状態:</strong> {user ? `ログイン済み (${user.email})` : '未ログイン'}
          </div>
          
          <div>
            <strong>Supabase URL:</strong> {import.meta.env.VITE_SUPABASE_URL || 'フォールバック値使用'}
          </div>
          
          <div>
            <strong>環境変数:</strong> {
              import.meta.env.VITE_SUPABASE_URL ? '設定済み' : '未設定（フォールバック使用）'
            }
          </div>

          <button 
            onClick={runTests}
            disabled={loading}
            className="btn-primary"
          >
            {loading ? 'テスト中...' : '再テスト'}
          </button>

          <div className="space-y-2">
            <h3 className="font-semibold">テスト結果:</h3>
            
            <div className="space-y-1 text-sm">
              <div>
                <span className="font-medium">接続テスト:</span> {testResults.connection || 'テスト中...'}
              </div>
              
              <div>
                <span className="font-medium">プロファイル:</span> {testResults.profile || 'テスト中...'}
              </div>
              
              <div>
                <span className="font-medium">プロジェクト:</span> {testResults.projects || 'テスト中...'}
              </div>
              
              <div>
                <span className="font-medium">参照:</span> {testResults.references || 'テスト中...'}
              </div>

              {testResults.general && (
                <div className="text-red-600">
                  <span className="font-medium">全般エラー:</span> {testResults.general}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h3 className="font-semibold mb-3">デバッグ情報</h3>
        <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
          {JSON.stringify({
            env: {
              VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
              NODE_ENV: import.meta.env.NODE_ENV,
              MODE: import.meta.env.MODE
            },
            user: user ? {
              id: user.id,
              email: user.email,
              created_at: user.created_at
            } : null,
            testResults
          }, null, 2)}
        </pre>
      </div>
    </div>
  )
}
