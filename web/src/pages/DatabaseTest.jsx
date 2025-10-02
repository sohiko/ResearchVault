import React, { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { toast } from 'react-hot-toast'

export default function DatabaseTest() {
  const { user } = useAuth()
  const [testResults, setTestResults] = useState([])
  const [loading, setLoading] = useState(false)

  const runTests = async () => {
    if (!user) return
    
    setLoading(true)
    const results = []

    // Test 1: Check if deleted_at column exists in projects table
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, deleted_at, deleted_by')
        .limit(1)
      
      if (error) {
        results.push({
          test: 'projects.deleted_at カラム存在確認',
          status: 'FAIL',
          message: error.message,
          code: error.code
        })
      } else {
        results.push({
          test: 'projects.deleted_at カラム存在確認',
          status: 'PASS',
          message: 'カラムが存在します'
        })
      }
    } catch (error) {
      results.push({
        test: 'projects.deleted_at カラム存在確認',
        status: 'ERROR',
        message: error.message
      })
    }

    // Test 2: Check if deleted_at column exists in references table
    try {
      const { data, error } = await supabase
        .from('references')
        .select('id, title, deleted_at, deleted_by')
        .limit(1)
      
      if (error) {
        results.push({
          test: 'references.deleted_at カラム存在確認',
          status: 'FAIL',
          message: error.message,
          code: error.code
        })
      } else {
        results.push({
          test: 'references.deleted_at カラム存在確認',
          status: 'PASS',
          message: 'カラムが存在します'
        })
      }
    } catch (error) {
      results.push({
        test: 'references.deleted_at カラム存在確認',
        status: 'ERROR',
        message: error.message
      })
    }

    // Test 3: Try to update a project with deleted_at
    try {
      // First get a project
      const { data: projects, error: fetchError } = await supabase
        .from('projects')
        .select('id')
        .eq('owner_id', user.id)
        .limit(1)

      if (fetchError) throw fetchError

      if (projects && projects.length > 0) {
        const testProjectId = projects[0].id
        
        // Try to update with deleted_at
        const { error: updateError } = await supabase
          .from('projects')
          .update({
            deleted_at: new Date().toISOString(),
            deleted_by: user.id
          })
          .eq('id', testProjectId)

        if (updateError) {
          results.push({
            test: 'プロジェクト削除テスト',
            status: 'FAIL',
            message: updateError.message,
            code: updateError.code
          })
        } else {
          // Revert the change
          await supabase
            .from('projects')
            .update({
              deleted_at: null,
              deleted_by: null
            })
            .eq('id', testProjectId)

          results.push({
            test: 'プロジェクト削除テスト',
            status: 'PASS',
            message: '削除・復元が正常に動作しました'
          })
        }
      } else {
        results.push({
          test: 'プロジェクト削除テスト',
          status: 'SKIP',
          message: 'テスト用プロジェクトが見つかりません'
        })
      }
    } catch (error) {
      results.push({
        test: 'プロジェクト削除テスト',
        status: 'ERROR',
        message: error.message
      })
    }

    setTestResults(results)
    setLoading(false)
  }

  const runMigration = async () => {
    const migrationSQL = `
-- ゴミ箱システムの実装
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id);

ALTER TABLE references 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_projects_deleted_at ON projects(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_references_deleted_at ON references(deleted_at) WHERE deleted_at IS NOT NULL;

-- RLSポリシー追加
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own deleted projects') THEN
    CREATE POLICY "Users can view their own deleted projects" ON projects
      FOR SELECT USING (auth.uid() = deleted_by AND deleted_at IS NOT NULL);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update deleted projects they deleted') THEN
    CREATE POLICY "Users can update deleted projects they deleted" ON projects
      FOR UPDATE USING (auth.uid() = deleted_by AND deleted_at IS NOT NULL);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own deleted references') THEN
    CREATE POLICY "Users can view their own deleted references" ON references
      FOR SELECT USING (auth.uid() = deleted_by AND deleted_at IS NOT NULL);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update deleted references they deleted') THEN
    CREATE POLICY "Users can update deleted references they deleted" ON references
      FOR UPDATE USING (auth.uid() = deleted_by AND deleted_at IS NOT NULL);
  END IF;
END $$;
    `

    try {
      const { error } = await supabase.rpc('exec_sql', { sql: migrationSQL })
      
      if (error) {
        toast.error(`マイグレーション実行エラー: ${error.message}`)
      } else {
        toast.success('マイグレーションが正常に実行されました')
        // Re-run tests
        await runTests()
      }
    } catch (error) {
      toast.error('マイグレーション実行に失敗しました。手動でSQL Editorから実行してください。')
      console.error('Migration error:', error)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-secondary-900 dark:text-secondary-100">
          データベーステスト
        </h1>
        <p className="text-secondary-600 dark:text-secondary-400">
          ゴミ箱機能のデータベース状態を確認します
        </p>
      </div>

      <div className="flex space-x-4">
        <button
          onClick={runTests}
          disabled={loading || !user}
          className="btn-primary"
        >
          {loading ? 'テスト実行中...' : 'データベーステスト実行'}
        </button>
        
        <button
          onClick={runMigration}
          disabled={loading || !user}
          className="btn-secondary"
        >
          マイグレーション実行（試験的）
        </button>
      </div>

      {testResults.length > 0 && (
        <div className="card p-6">
          <h3 className="text-lg font-medium text-secondary-900 dark:text-secondary-100 mb-4">
            テスト結果
          </h3>
          <div className="space-y-3">
            {testResults.map((result, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg border ${
                  result.status === 'PASS'
                    ? 'bg-green-50 border-green-200 text-green-800'
                    : result.status === 'FAIL'
                    ? 'bg-red-50 border-red-200 text-red-800'
                    : result.status === 'SKIP'
                    ? 'bg-yellow-50 border-yellow-200 text-yellow-800'
                    : 'bg-gray-50 border-gray-200 text-gray-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{result.test}</span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    result.status === 'PASS'
                      ? 'bg-green-100 text-green-800'
                      : result.status === 'FAIL'
                      ? 'bg-red-100 text-red-800'
                      : result.status === 'SKIP'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {result.status}
                  </span>
                </div>
                <p className="text-sm mt-1">{result.message}</p>
                {result.code && (
                  <p className="text-xs mt-1 font-mono">エラーコード: {result.code}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card p-6 bg-blue-50 dark:bg-blue-900/20">
        <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
          手動マイグレーション手順
        </h4>
        <p className="text-sm text-blue-800 dark:text-blue-300 mb-3">
          自動マイグレーションが失敗した場合は、Supabaseダッシュボードで以下のSQLを実行してください：
        </p>
        <details className="text-xs">
          <summary className="cursor-pointer text-blue-700 hover:text-blue-900 font-medium mb-2">
            📋 マイグレーションSQL（クリックして表示）
          </summary>
          <pre className="bg-gray-100 p-3 rounded text-xs overflow-auto max-h-40 text-gray-800">
{`-- ゴミ箱システムの実装（安全版）
-- 以下を順番に実行してください

-- 1. カラム追加
ALTER TABLE projects ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id);
ALTER TABLE "references" ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE "references" ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id);

-- 2. インデックス作成
CREATE INDEX IF NOT EXISTS idx_projects_deleted_at ON projects(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_references_deleted_at ON "references"(deleted_at) WHERE deleted_at IS NOT NULL;

-- 3. RLSポリシー追加
-- 3. RLSポリシー追加（既存の場合はスキップ）
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own deleted projects') THEN
    CREATE POLICY "Users can view their own deleted projects" ON projects
      FOR SELECT USING (auth.uid() = deleted_by AND deleted_at IS NOT NULL);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update deleted projects they deleted') THEN
    CREATE POLICY "Users can update deleted projects they deleted" ON projects
      FOR UPDATE USING (auth.uid() = deleted_by AND deleted_at IS NOT NULL);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own deleted references') THEN
    CREATE POLICY "Users can view their own deleted references" ON "references"
      FOR SELECT USING (auth.uid() = deleted_by AND deleted_at IS NOT NULL);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update deleted references they deleted') THEN
    CREATE POLICY "Users can update deleted references they deleted" ON "references"
      FOR UPDATE USING (auth.uid() = deleted_by AND deleted_at IS NOT NULL);
  END IF;
END $$;`}
          </pre>
        </details>
      </div>
    </div>
  )
}
