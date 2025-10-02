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
      
      // 実際の削除アイテムデータを取得
      const { data: trashedData, error: trashedError } = await supabase
        .from('trashed_items')
        .select(`
          *,
          projects!trashed_items_project_id_fkey(name, color)
        `)
        .eq('deleted_by', user.id)
        .order('deleted_at', { ascending: false })

      if (trashedError) {
        console.error('Failed to load trashed items:', trashedError)
        // フォールバック: 空の配列を表示
        setTrashedItems([])
        return
      }

      // データ形式を統一
      const formattedItems = (trashedData || []).map(item => ({
        id: item.id,
        type: item.original_table.replace('s', ''), // 'references' -> 'reference'
        title: item.original_data?.title || item.original_data?.name || 'タイトルなし',
        url: item.original_data?.url,
        project: item.projects ? {
          name: item.projects.name,
          color: item.projects.color
        } : null,
        deletedAt: item.deleted_at,
        deletedBy: item.deleted_by,
        originalData: item.original_data,
        originalId: item.original_id,
        originalTable: item.original_table,
        expiresAt: item.restore_expires_at
      }))

      setTrashedItems(formattedItems)
    } catch (error) {
      console.error('Failed to load trashed items:', error)
      setError('ゴミ箱の読み込みに失敗しました')
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

      // 元のテーブルにデータを復元
      const restoreData = {
        ...item.originalData,
        id: item.originalId, // 元のIDを使用
        updated_at: new Date().toISOString()
      }

      const { error: restoreError } = await supabase
        .from(item.originalTable)
        .insert(restoreData)

      if (restoreError) {
        throw restoreError
      }

      // ゴミ箱から削除
      const { error: deleteError } = await supabase
        .from('trashed_items')
        .delete()
        .eq('id', item.id)
        .eq('deleted_by', user.id)

      if (deleteError) {
        console.error('Failed to remove from trash:', deleteError)
        // 復元は成功したので、UIからは削除する
      }

      // UIから削除
      setTrashedItems(prev => prev.filter(t => t.id !== item.id))
      toast.success('アイテムを復元しました')
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

      // ゴミ箱から完全削除
      const { error } = await supabase
        .from('trashed_items')
        .delete()
        .eq('id', itemToDelete.id)
        .eq('deleted_by', user.id)

      if (error) {
        throw error
      }

      // UIから削除
      setTrashedItems(prev => prev.filter(t => t.id !== itemToDelete.id))
      toast.success('アイテムを完全に削除しました')
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

      // すべてのアイテムを完全削除
      const { error } = await supabase
        .from('trashed_items')
        .delete()
        .eq('deleted_by', user.id)

      if (error) {
        throw error
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
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 text-sm">{error}</p>
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
                    {item.title || item.originalData?.name || item.originalData?.title}
                  </h3>
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
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
                
                <div className="flex items-center space-x-4 text-sm text-secondary-500">
                  <span>
                    {format(new Date(item.deletedAt), 'MM/dd HH:mm', { locale: ja })} に削除
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
