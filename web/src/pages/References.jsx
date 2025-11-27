import React, { useState, useCallback, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { toast } from 'react-hot-toast'
import { useSearchParams } from 'react-router-dom'
import ConfirmDialog from '../components/common/ConfirmDialog'
import ReferenceCard from '../components/common/ReferenceCard'
import AddReferenceModal from '../components/common/AddReferenceModal'
import { usePageFocus } from '../hooks/usePageFocus'
import { useModalContext } from '../hooks/useModalContext'
import { useDebounce } from '../hooks/useDebounce'
import { useReferenceAction } from '../context/ReferenceActionContext'

export default function References() {
  const { user } = useAuth()
  const { hasOpenModals } = useModalContext()
  const { pendingAction, clearPendingAction } = useReferenceAction()
  const [searchParams] = useSearchParams()
  const [references, setReferences] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)
  const [referenceToDelete, setReferenceToDelete] = useState(null)
  const [citationFormat, setCitationFormat] = useState('APA')
  const [referenceToAutoEdit, setReferenceToAutoEdit] = useState(null)
  
  // URLパラメータから検索キーワードを取得
  const searchFromUrl = searchParams.get('search') || ''
  
  const [filters, setFilters] = useState({
    project: '',
    search: searchFromUrl,
    sortBy: 'saved_at',
    sortOrder: 'desc'
  })

  // デバウンスされた検索クエリ（500ms遅延）
  const debouncedSearch = useDebounce(filters.search, 500)

  const loadReferences = useCallback(async () => {
    if (!user) {return []}
    
    try {
      let query = supabase
        .from('references')
        .select(`
          *,
          projects(name, color, icon),
          reference_tags(tags(name, color)),
          selected_texts(id),
          bookmarks(id)
        `)
        .eq('saved_by', user.id)
        .is('deleted_at', null) // 削除されていないアイテムのみ取得

      // フィルター適用
      if (filters.project) {
        query = query.eq('project_id', filters.project)
      }

      if (debouncedSearch) {
        query = query.or(`title.ilike.%${debouncedSearch}%,url.ilike.%${debouncedSearch}%,memo.ilike.%${debouncedSearch}%`)
      }

      // ソート
      const ascending = filters.sortOrder === 'asc'
      query = query.order(filters.sortBy, { ascending })

      const { data, error } = await query

      if (error) {
        throw error
      }

      // データを整形
      return data.map(ref => ({
        ...ref,
        project: ref.projects,
        tags: ref.reference_tags?.map(rt => rt.tags) || [],
        textCount: ref.selected_texts?.length || 0,
        bookmarkCount: ref.bookmarks?.length || 0
      }))
    } catch (error) {
      console.error('Failed to load references:', error)
      return []
    }
  }, [user, filters.project, filters.sortBy, filters.sortOrder, debouncedSearch])

  const loadCitationSettings = useCallback(async () => {
    if (!user) {return}
    
    try {
      const { data } = await supabase
        .from('citation_settings')
        .select('default_style')
        .eq('user_id', user.id)
        .single()

      if (data?.default_style) {
        setCitationFormat(data.default_style)
      }
    } catch (error) {
      // 設定がない場合はデフォルトのAPAを使用
    }
  }, [user])

  const loadData = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }
    
    // モーダルが開いている場合はリロードをスキップ
    if (hasOpenModals) {
      return
    }
    
    try {
      setLoading(true)
      setError(null)
      
      // プロジェクト、参照、引用設定を並行で取得
      const [projectsResult, referencesResult] = await Promise.all([
        supabase
          .from('projects')
          .select('id, name, color, icon')
          .eq('owner_id', user.id)
          .order('name'),
        loadReferences(),
        loadCitationSettings()
      ])

      if (projectsResult.error) {
        throw projectsResult.error
      }

      setProjects(projectsResult.data || [])
      setReferences(referencesResult)
    } catch (error) {
      console.error('Failed to load data:', error)
      setError('データの読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }, [user, loadReferences, loadCitationSettings, hasOpenModals])

  // 初回ロード＆フィルター変更時のリロード
  useEffect(() => {
    if (user && !hasOpenModals) {
      loadData()
    }
  }, [user, hasOpenModals, loadData])

  // debouncedSearchが変更されたときのリロード（検索実行）
  useEffect(() => {
    if (user && !hasOpenModals && !loading) {
      loadData()
    }
  }, [debouncedSearch]) // eslint-disable-line react-hooks/exhaustive-deps
  
  useEffect(() => {
    const handleReferenceCreated = () => {
      if (!hasOpenModals) {
        loadData()
      }
    }
    
    window.addEventListener('reference:created', handleReferenceCreated)
    return () => {
      window.removeEventListener('reference:created', handleReferenceCreated)
    }
  }, [hasOpenModals, loadData])
  
  useEffect(() => {
    if (pendingAction?.type === 'edit' && !pendingAction.projectId) {
      setReferenceToAutoEdit(pendingAction.referenceId)
      clearPendingAction()
    }
  }, [pendingAction, clearPendingAction])

  // ページフォーカス時の自動リロードを無効化（モーダルがあるページなので完全に無効）
  usePageFocus(() => {}, [], {
    enableFocusReload: false
  })

  const handleAddReference = async (referenceData) => {
    try {
      const { error } = await supabase
        .from('references')
        .insert({
          ...referenceData,
          saved_by: user.id
        })
        .select()
        .single()

      if (error) {
        throw error
      }

      setShowAddModal(false)
      await loadData()
    } catch (error) {
      console.error('Failed to add reference:', error)
      setError('参照の追加に失敗しました')
    }
  }

  const handleDeleteReference = (referenceId) => {
    setReferenceToDelete(referenceId)
    setShowConfirmDelete(true)
  }

  const confirmDeleteReference = async () => {
    try {
      // ソフト削除（ゴミ箱に移動）
      const { error } = await supabase
        .from('references')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: user.id
        })
        .eq('id', referenceToDelete)

      if (error) {
        throw error
      }

      // ローカル状態から削除されたアイテムを即座に除去
      setReferences(prev => prev.filter(ref => ref.id !== referenceToDelete))
      toast.success('参照をゴミ箱に移動しました')
    } catch (error) {
      console.error('Failed to delete reference:', error)
      toast.error('参照の削除に失敗しました')
    } finally {
      setShowConfirmDelete(false)
      setReferenceToDelete(null)
    }
  }

  const handleUpdateReference = async (updatedReference) => {
    try {
      // descriptionはmetadataに含まれるため、個別に送信しない
      const { id, ...updateData } = updatedReference
      delete updateData.description // descriptionカラムは存在しないため削除
      
      const { error } = await supabase
        .from('references')
        .update(updateData)
        .eq('id', id)

      if (error) {throw error}

      // ローカル状態を更新
      setReferences(prev => 
        prev.map(ref => 
          ref.id === updatedReference.id 
            ? { ...ref, ...updatedReference }
            : ref
        )
      )
    } catch (error) {
      console.error('Failed to update reference:', error)
      throw error
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
          {[...Array(5)].map((_, i) => (
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
            参照一覧
          </h1>
          <p className="text-secondary-600 dark:text-secondary-400">
            保存された参照資料を管理します
          </p>
        </div>
        <button 
          className="btn-primary"
          onClick={() => setShowAddModal(true)}
        >
          新しい参照を追加
        </button>
      </div>

      {/* フィルター */}
      <div className="card p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-1">
              検索
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="タイトル、URL、メモで検索..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-1">
              プロジェクト
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              value={filters.project}
              onChange={(e) => setFilters({ ...filters, project: e.target.value })}
            >
              <option value="">すべてのプロジェクト</option>
              {projects.map(project => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-1">
              並び順
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              value={`${filters.sortBy}-${filters.sortOrder}`}
              onChange={(e) => {
                const [sortBy, sortOrder] = e.target.value.split('-')
                setFilters({ ...filters, sortBy, sortOrder })
              }}
            >
              <option value="saved_at-desc">保存日時 (新しい順)</option>
              <option value="saved_at-asc">保存日時 (古い順)</option>
              <option value="title-asc">タイトル (A-Z)</option>
              <option value="title-desc">タイトル (Z-A)</option>
            </select>
          </div>
          
          <div className="flex items-end">
            <button
              className="btn-secondary w-full"
              onClick={() => setFilters({
                project: '',
                search: '',
                sortBy: 'saved_at',
                sortOrder: 'desc'
              })}
            >
              リセット
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}
      
      {references.length === 0 ? (
        <div className="card p-6">
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-secondary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-secondary-900 dark:text-secondary-100">
              {filters.search || filters.project ? '条件に一致する参照がありません' : '参照がありません'}
            </h3>
            <p className="mt-1 text-sm text-secondary-500 dark:text-secondary-400">
              {filters.search || filters.project 
                ? 'フィルターを変更して再度検索してください' 
                : 'Chrome拡張機能を使って参照を保存してみましょう'
              }
            </p>
            {!filters.search && !filters.project && (
              <button 
                className="mt-4 btn-primary"
                onClick={() => setShowAddModal(true)}
              >
                最初の参照を追加
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {references.map((reference) => (
            <ReferenceCard
              key={reference.id}
              reference={reference}
              onDelete={handleDeleteReference}
              onUpdate={handleUpdateReference}
              citationFormat={citationFormat}
              autoOpenEdit={reference.id === referenceToAutoEdit}
              onAutoEditHandled={() => setReferenceToAutoEdit(null)}
            />
          ))}
        </div>
      )}

      {showAddModal && (
        <AddReferenceModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddReference}
          projectId=""
        />
      )}

      <ConfirmDialog
        isOpen={showConfirmDelete}
        onClose={() => setShowConfirmDelete(false)}
        onConfirm={confirmDeleteReference}
        title="参照を削除"
        message="この参照を削除しますか？この操作は取り消せません。"
        confirmText="削除"
        cancelText="キャンセル"
      />
    </div>
  )
}


