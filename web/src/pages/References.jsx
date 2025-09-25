import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { toast } from 'react-hot-toast'
import ConfirmDialog from '../components/common/ConfirmDialog'

export default function References() {
  const { user } = useAuth()
  const [references, setReferences] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)
  const [referenceToDelete, setReferenceToDelete] = useState(null)
  const [filters, setFilters] = useState({
    project: '',
    search: '',
    sortBy: 'saved_at',
    sortOrder: 'desc'
  })

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

      // フィルター適用
      if (filters.project) {
        query = query.eq('project_id', filters.project)
      }

      if (filters.search) {
        query = query.or(`title.ilike.%${filters.search}%,url.ilike.%${filters.search}%,memo.ilike.%${filters.search}%`)
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
  }, [user, filters])

  const loadData = useCallback(async () => {
    if (!user) {return}
    
    try {
      setLoading(true)
      setError(null)
      
      // プロジェクトと参照を並行で取得
      const [projectsResult, referencesResult] = await Promise.all([
        supabase
          .from('projects')
          .select('id, name, color, icon')
          .or(`owner_id.eq.${user.id},project_members.user_id.eq.${user.id}`)
          .order('name'),
        loadReferences()
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
  }, [user, loadReferences])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleAddReference = async (referenceData) => {
    try {
      const { error } = await supabase
        .from('references')
        .insert({
          title: referenceData.title.trim(),
          url: referenceData.url.trim(),
          memo: referenceData.memo?.trim() || '',
          project_id: referenceData.projectId || null,
          saved_by: user.id,
          metadata: {}
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
      const { error } = await supabase
        .from('references')
        .delete()
        .eq('id', referenceToDelete)

      if (error) {
        throw error
      }

      await loadData()
      toast.success('参照を削除しました')
    } catch (error) {
      console.error('Failed to delete reference:', error)
      toast.error('参照の削除に失敗しました')
    } finally {
      setShowConfirmDelete(false)
      setReferenceToDelete(null)
    }
  }

  const generateCitation = (reference) => {
    // 簡易APA引用生成
    const title = reference.title || 'タイトルなし'
    const url = reference.url
    const accessDate = format(new Date(), 'yyyy年MM月dd日', { locale: ja })
    
    return `${title}. Retrieved ${accessDate}, from ${url}`
  }

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('引用をクリップボードにコピーしました')
    } catch (error) {
      console.error('Failed to copy:', error)
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
              onGenerateCitation={(ref) => copyToClipboard(generateCitation(ref))}
            />
          ))}
        </div>
      )}

      {showAddModal && (
        <AddReferenceModal
          projects={projects}
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddReference}
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

function ReferenceCard({ reference, onDelete, onGenerateCitation }) {
  return (
    <div className="card hover:shadow-lg transition-shadow duration-200">
      <div className="p-6">
        <div className="flex items-start space-x-4">
          {reference.favicon && (
            <img 
              src={reference.favicon} 
              alt="" 
              className="w-4 h-4 mt-1 flex-shrink-0"
              onError={(e) => { e.target.style.display = 'none' }}
            />
          )}
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-medium text-secondary-900 dark:text-secondary-100 mb-1">
                  {reference.title}
                </h3>
                <p className="text-sm text-secondary-500 break-all mb-2">
                  {reference.url}
                </p>
                
                {reference.memo && (
                  <p className="text-sm text-secondary-600 dark:text-secondary-400 mb-3">
                    {reference.memo}
                  </p>
                )}
                
                <div className="flex items-center space-x-4 text-sm text-secondary-500">
                  {reference.project && (
                    <div className="flex items-center space-x-2">
                      <div 
                        className="w-3 h-3 rounded-sm"
                        style={{ backgroundColor: reference.project.color }}
                      />
                      <span>{reference.project.name}</span>
                    </div>
                  )}
                  
                  {reference.textCount > 0 && (
                    <span>{reference.textCount} 選択テキスト</span>
                  )}
                  
                  {reference.bookmarkCount > 0 && (
                    <span>{reference.bookmarkCount} ブックマーク</span>
                  )}
                  
                  <span>
                    {format(new Date(reference.saved_at), 'MM/dd HH:mm', { locale: ja })}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center space-x-2 ml-4">
                <button
                  onClick={() => onGenerateCitation(reference)}
                  className="text-secondary-400 hover:text-primary-500 transition-colors"
                  title="引用をコピー"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
                
                <a
                  href={reference.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-secondary-400 hover:text-primary-500 transition-colors"
                  title="リンクを開く"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
                
                <button
                  onClick={() => onDelete(reference.id)}
                  className="text-secondary-400 hover:text-red-500 transition-colors"
                  title="削除"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function AddReferenceModal({ projects, onClose, onAdd }) {
  const [formData, setFormData] = useState({
    title: '',
    url: '',
    memo: '',
    projectId: ''
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (formData.title.trim() && formData.url.trim()) {
      setLoading(true)
      await onAdd(formData)
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-secondary-800 rounded-lg max-w-md w-full">
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-secondary-900 dark:text-secondary-100">
                新しい参照を追加
              </h3>
              <button
                type="button"
                onClick={onClose}
                className="text-secondary-400 hover:text-secondary-600"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div className="px-6 py-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
                タイトル *
              </label>
              <input
                type="text"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="参照のタイトルを入力..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
                URL *
              </label>
              <input
                type="url"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                placeholder="https://..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
                プロジェクト
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                value={formData.projectId}
                onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
              >
                <option value="">プロジェクトを選択</option>
                {projects.map(project => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
                メモ
              </label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                rows={3}
                value={formData.memo}
                onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
                placeholder="メモを入力..."
              />
            </div>
          </div>

          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 btn-secondary"
              disabled={loading}
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="flex-1 btn-primary"
              disabled={loading || !formData.title.trim() || !formData.url.trim()}
            >
              {loading ? '追加中...' : '追加'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
