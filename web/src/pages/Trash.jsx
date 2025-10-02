import React, { useState, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { toast } from 'react-hot-toast'
import { usePageFocus } from '../hooks/usePageFocus'
import ConfirmDialog from '../components/common/ConfirmDialog'

export default function Trash() {
  const { user } = useAuth()
  const [trashedItems, setTrashedItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState(null)
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)
  const [showConfirmEmptyTrash, setShowConfirmEmptyTrash] = useState(false)
  const [itemToDelete, setItemToDelete] = useState(null)

  const loadTrashedItems = useCallback(async () => {
    if (!user) return
    try {
      setLoading(true)
      setError(null)
      
      // ゴミ箱のプロジェクトを取得
      const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .eq('deleted_by', user.id)
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false })

      if (projectsError) throw projectsError

      // ゴミ箱の参照を取得（プロジェクトに属さない個別削除のもののみ）
      const { data: references, error: referencesError } = await supabase
        .from('references')
        .select('*')
        .eq('deleted_by', user.id)
        .not('deleted_at', 'is', null)
        .is('project_id', null)
        .order('deleted_at', { ascending: false })

      if (referencesError) throw referencesError

      // データを統合して30日計算を追加
      const allItems = [
        ...(projects || []).map(p => {
          const deletedDate = new Date(p.deleted_at)
          const daysSinceDeleted = Math.floor((new Date() - deletedDate) / (1000 * 60 * 60 * 24))
          return { 
            ...p, 
            type: 'project',
            days_until_permanent_deletion: Math.max(0, 30 - daysSinceDeleted)
          }
        }),
        ...(references || []).map(r => {
          const deletedDate = new Date(r.deleted_at)
          const daysSinceDeleted = Math.floor((new Date() - deletedDate) / (1000 * 60 * 60 * 24))
          return { 
            ...r, 
            type: 'reference',
            days_until_permanent_deletion: Math.max(0, 30 - daysSinceDeleted)
          }
        })
      ].sort((a, b) => new Date(b.deleted_at) - new Date(a.deleted_at))

      setTrashedItems(allItems)
    } catch (error) {
      console.error('Failed to load trashed items:', error)
      
      // データベースカラムが存在しない場合の特別なエラーハンドリング
      if (error.code === '42703' && error.message.includes('deleted_by does not exist')) {
        setError('migration_required')
      } else {
        setError('ゴミ箱の読み込みに失敗しました')
      }
    } finally {
      setLoading(false)
    }
  }, [user])

  // ページフォーカス時の不要なリロードを防ぐ
  usePageFocus(loadTrashedItems, [user?.id], {
    enableFocusReload: false // フォーカス時のリロードは無効
  })

  const restoreItem = async (item) => {
    try {
      setProcessing(true)
      setError(null)

      if (item.type === 'project') {
        const { error } = await supabase
          .from('projects')
          .update({ deleted_at: null, deleted_by: null })
          .eq('id', item.id)
        
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('references')
          .update({ deleted_at: null, deleted_by: null })
          .eq('id', item.id)
        
        if (error) throw error
      }

      // UIから削除
      setTrashedItems(prev => prev.filter(t => t.id !== item.id))
      toast.success(`${item.type === 'project' ? 'プロジェクト' : '参照'}を復元しました`)
    } catch (error) {
      console.error('Failed to restore item:', error)
      setError('復元に失敗しました')
      toast.error('復元に失敗しました')
    } finally {
      setProcessing(false)
    }
  }

  const permanentlyDelete = (item) => {
    setItemToDelete(item)
    setShowConfirmDelete(true)
  }

  const confirmPermanentlyDelete = async () => {
    try {
      setProcessing(true)
      setError(null)

      if (itemToDelete.type === 'project') {
        const { error } = await supabase
          .from('projects')
          .delete()
          .eq('id', itemToDelete.id)
        
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('references')
          .delete()
          .eq('id', itemToDelete.id)
        
        if (error) throw error
      }

      // UIから削除
      setTrashedItems(prev => prev.filter(t => t.id !== itemToDelete.id))
      toast.success(`${itemToDelete.type === 'project' ? 'プロジェクト' : '参照'}を完全に削除しました`)
    } catch (error) {
      console.error('Failed to permanently delete item:', error)
      setError('完全削除に失敗しました')
      toast.error('完全削除に失敗しました')
    } finally {
      setProcessing(false)
      setShowConfirmDelete(false)
      setItemToDelete(null)
    }
  }

  const emptyTrash = () => {
    setShowConfirmEmptyTrash(true)
  }

  const confirmEmptyTrash = async () => {
    try {
      setProcessing(true)
      setError(null)

      // プロジェクトを完全削除
      const projectIds = trashedItems.filter(item => item.type === 'project').map(item => item.id)
      if (projectIds.length > 0) {
        const { error: projectError } = await supabase
          .from('projects')
          .delete()
          .in('id', projectIds)
        
        if (projectError) throw projectError
      }

      // 参照を完全削除
      const referenceIds = trashedItems.filter(item => item.type === 'reference').map(item => item.id)
      if (referenceIds.length > 0) {
        const { error: referenceError } = await supabase
          .from('references')
          .delete()
          .in('id', referenceIds)
        
        if (referenceError) throw referenceError
      }

      setTrashedItems([])
      toast.success('ゴミ箱を空にしました')
    } catch (error) {
      console.error('Failed to empty trash:', error)
      setError('ゴミ箱を空にできませんでした')
      toast.error('ゴミ箱を空にできませんでした')
    } finally {
      setProcessing(false)
      setShowConfirmEmptyTrash(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
        
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card p-6">
              <div className="animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-3/4 mb-3"></div>
                <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900 dark:text-secondary-100">
            ゴミ箱
          </h1>
          <p className="text-secondary-600 dark:text-secondary-400">
            削除されたアイテムを復元または完全に削除できます
          </p>
        </div>
        {trashedItems.length > 0 && (
          <button 
            onClick={emptyTrash}
            disabled={processing}
            className="btn-destructive"
          >
            ゴミ箱を空にする
          </button>
        )}
      </div>

      {error && (
        <div className={`border rounded-lg p-4 ${
          error === 'migration_required' 
            ? 'bg-blue-50 border-blue-200' 
            : 'bg-red-50 border-red-200'
        }`}>
          {error === 'migration_required' ? (
            <div>
              <div className="flex items-start space-x-3">
                <svg className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h4 className="text-sm font-medium text-blue-900 mb-2">
                    データベースの更新が必要です
                  </h4>
                  <p className="text-sm text-blue-800 mb-3">
                    ゴミ箱機能を使用するには、データベースマイグレーションを実行する必要があります。
                  </p>
                  <div className="bg-blue-100 rounded p-3 mb-3">
                    <p className="text-xs text-blue-900 font-medium mb-2">実行手順:</p>
                    <ol className="text-xs text-blue-800 space-y-1 list-decimal list-inside">
                      <li>Supabaseダッシュボードにアクセス</li>
                      <li>SQL Editorを開く</li>
                      <li>以下のマイグレーションを実行</li>
                    </ol>
                  </div>
                  <details className="text-xs">
                    <summary className="cursor-pointer text-blue-700 hover:text-blue-900 font-medium mb-2">
                      📋 マイグレーションSQL（クリックして表示）
                    </summary>
                    <pre className="bg-gray-100 p-3 rounded text-xs overflow-auto max-h-40 text-gray-800">
{`-- ゴミ箱システムの実装
ALTER TABLE projects 
ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN deleted_by UUID REFERENCES auth.users(id);

ALTER TABLE references 
ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN deleted_by UUID REFERENCES auth.users(id);

-- インデックス作成
CREATE INDEX idx_projects_deleted_at ON projects(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_references_deleted_at ON references(deleted_at) WHERE deleted_at IS NOT NULL;

-- RLSポリシー追加
CREATE POLICY "Users can view their own deleted projects" ON projects
  FOR SELECT USING (auth.uid() = deleted_by AND deleted_at IS NOT NULL);

CREATE POLICY "Users can view their own deleted references" ON references
  FOR SELECT USING (auth.uid() = deleted_by AND deleted_at IS NOT NULL);`}
                    </pre>
                  </details>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-red-800 text-sm">{error}</p>
          )}
        </div>
      )}

      {trashedItems.length === 0 ? (
        <div className="card p-6">
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-secondary-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-secondary-900 dark:text-secondary-100">
              ゴミ箱は空です
            </h3>
            <p className="mt-1 text-sm text-secondary-500 dark:text-secondary-400">
              削除されたアイテムはここに表示されます
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {trashedItems.map((item) => (
            <TrashItemCard
              key={item.id}
              item={item}
              onRestore={restoreItem}
              onPermanentDelete={permanentlyDelete}
              processing={processing}
            />
          ))}
        </div>
      )}

      {/* 自動削除の説明 */}
      <div className="card p-6 bg-yellow-50 dark:bg-yellow-900/20">
        <div className="flex items-start space-x-3">
          <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <div>
            <h4 className="text-sm font-medium text-yellow-900 dark:text-yellow-100 mb-1">
              自動削除について
            </h4>
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              ゴミ箱のアイテムは30日後に自動的に完全削除されます。
              重要なアイテムは早めに復元することをお勧めします。
            </p>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={showConfirmDelete}
        onClose={() => setShowConfirmDelete(false)}
        onConfirm={confirmPermanentlyDelete}
        title="アイテムを完全削除"
        message="このアイテムを完全に削除しますか？この操作は取り消せません。"
        confirmText="削除"
        cancelText="キャンセル"
      />

      <ConfirmDialog
        isOpen={showConfirmEmptyTrash}
        onClose={() => setShowConfirmEmptyTrash(false)}
        onConfirm={confirmEmptyTrash}
        title="ゴミ箱を空にする"
        message="ゴミ箱を空にしますか？すべてのアイテムが完全に削除されます。この操作は取り消せません。"
        confirmText="空にする"
        cancelText="キャンセル"
      />
    </div>
  )
}

function TrashItemCard({ item, onRestore, onPermanentDelete, processing }) {
  const getTypeIcon = (type) => {
    switch (type) {
      case 'reference':
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        )
      case 'project':
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        )
      default:
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        )
    }
  }

  const getTypeLabel = (type) => {
    switch (type) {
      case 'reference':
        return '参照'
      case 'project':
        return 'プロジェクト'
      default:
        return 'アイテム'
    }
  }

  return (
    <div className="card hover:shadow-lg transition-shadow duration-200">
      <div className="p-6">
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0 text-secondary-400">
            {getTypeIcon(item.type)}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-1">
                  <h3 className="text-lg font-medium text-secondary-900 dark:text-secondary-100">
                    {item.name || item.title}
                  </h3>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    item.type === 'project' 
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' 
                      : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                  }`}>
                    {getTypeLabel(item.type)}
                  </span>
                </div>
                
                {item.url && (
                  <p className="text-sm text-secondary-500 break-all mb-2">
                    {item.url}
                  </p>
                )}
                
                {item.project && (
                  <div className="flex items-center space-x-2 mb-2">
                    <div 
                      className="w-3 h-3 rounded-sm"
                      style={{ backgroundColor: item.project.color }}
                    />
                    <span className="text-sm text-secondary-600">
                      {item.project.name}
                    </span>
                  </div>
                )}
                
                <div className="flex items-center space-x-4 text-sm text-secondary-500 dark:text-secondary-400">
                  <span>
                    {format(new Date(item.deleted_at), 'MM/dd HH:mm', { locale: ja })} に削除
                  </span>
                  <span className="font-medium text-orange-600 dark:text-orange-400">
                    {item.days_until_permanent_deletion > 0 
                      ? `${Math.ceil(item.days_until_permanent_deletion)}日後に完全削除`
                      : '間もなく完全削除'
                    }
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={() => onRestore(item)}
                disabled={processing}
                className="btn-primary"
              >
                {processing ? '処理中...' : '復元'}
              </button>
              
              <button
                onClick={() => onPermanentDelete(item)}
                disabled={processing}
                className="btn-destructive"
              >
                完全削除
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
