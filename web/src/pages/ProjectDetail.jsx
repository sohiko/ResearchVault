import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useModalContext } from '../hooks/useModalContext'
import { usePageFocus } from '../hooks/usePageFocus'
import { useDebounce } from '../hooks/useDebounce'
import { supabase } from '../lib/supabase'
import { toast } from 'react-hot-toast'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { 
  FileText, 
  Plus, 
  MoreVertical, 
  Share2, 
  Edit3, 
  Trash2,
  Copy,
  Download,
  X
} from 'lucide-react'

// コンポーネント
import ReferenceCard from '../components/common/ReferenceCard'
import AddReferenceModal from '../components/common/AddReferenceModal'
import ShareProjectModal from '../components/common/ShareProjectModal'
import EditProjectModal from '../components/common/EditProjectModal'
import ConfirmDialog from '../components/common/ConfirmDialog'
import { useReferenceAction } from '../context/ReferenceActionContext'

// ユーティリティ
import { generateProjectCitations } from '../utils/citationGenerator'

export default function ProjectDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { hasOpenModals } = useModalContext()
  const { pendingAction, clearPendingAction } = useReferenceAction()
  
  // 状態管理
  const [project, setProject] = useState(null)
  const [references, setReferences] = useState([])
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // モーダル状態
  const [showAddReference, setShowAddReference] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)
  const [referenceToDelete, setReferenceToDelete] = useState(null)
  const [showCitationModal, setShowCitationModal] = useState(false)
  const [showProjectDeleteConfirm, setShowProjectDeleteConfirm] = useState(false)
  const [showDropdownMenu, setShowDropdownMenu] = useState(false)
  
  // 引用生成状態
  const [citationFormat, setCitationFormat] = useState('APA')
  const [generatedCitations, setGeneratedCitations] = useState('')
  const [generating, setGenerating] = useState(false)
  const [referenceToAutoEdit, setReferenceToAutoEdit] = useState(null)
  
  // フィルター・ソート状態
  const [sortBy, setSortBy] = useState('saved_at')
  const [sortOrder, setSortOrder] = useState('desc')
  const [searchQuery, setSearchQuery] = useState('')
  
  // デバウンスされた検索クエリ（500ms遅延）
  const debouncedSearchQuery = useDebounce(searchQuery, 500)

  const loadProject = useCallback(async () => {
    if (!id || !user) {return}
    
    // モーダルが開いている場合はリロードをスキップ
    if (hasOpenModals) {
      console.log('モーダルが開いているため、プロジェクト詳細のリロードをスキップします')
      return
    }
    
    // プロジェクトの基本情報を取得
    const { data: projectData, error: projectError } = await supabase
      .from('projects')
      .select(`
        *,
        profiles!owner_id(name, email)
      `)
      .eq('id', id)
      .single()

    if (projectError) {
      if (projectError.code === 'PGRST116') {
        navigate('/projects')
        toast.error('プロジェクトが見つかりません')
        return
      }
      throw projectError
    }

    // アクセス権限をチェック
    const isOwner = projectData.owner_id === user.id
    let hasAccess = isOwner

    if (!isOwner) {
      // メンバーかどうかチェック
      const { data: memberData } = await supabase
        .from('project_members')
        .select('role')
        .eq('project_id', id)
        .eq('user_id', user.id)
        .single()

      hasAccess = !!memberData
    }

    if (!hasAccess) {
      navigate('/projects')
      toast.error('このプロジェクトにアクセスする権限がありません')
      return
    }

    // オーナーの場合は、project_membersに自分自身が含まれていないことを確認
    if (isOwner) {
      // オーナーがメンバーテーブルに誤って追加されている場合は削除
      await supabase
        .from('project_members')
        .delete()
        .eq('project_id', id)
        .eq('user_id', user.id)
    }

    setProject(projectData)
  }, [id, user, navigate, hasOpenModals])

  const loadReferences = useCallback(async () => {
    if (!id) {return}
    
    // モーダルが開いている場合はリロードをスキップ
    if (hasOpenModals) {
      console.log('モーダルが開いているため、参照データのリロードをスキップします')
      return
    }
    
    let query = supabase
      .from('references')
      .select(`
        *,
        reference_tags (
          tags (name, color)
        ),
        selected_texts (id),
        bookmarks (id)
      `)
      .eq('project_id', id)
      .is('deleted_at', null) // 削除されていないアイテムのみ取得

    // ソート（検索はローカルで実行）
    query = query.order(sortBy, { ascending: sortOrder === 'asc' })

    const { data, error } = await query

    if (error) {throw error}

    // データの整形
    const formattedReferences = data.map(ref => ({
      ...ref,
      tags: ref.reference_tags?.map(rt => rt.tags) || [],
      textCount: ref.selected_texts?.length || 0,
      bookmarkCount: ref.bookmarks?.length || 0
    }))

    setReferences(formattedReferences)
  }, [id, sortBy, sortOrder, hasOpenModals])

  const loadMembers = useCallback(async () => {
    if (!id || !user) {return}
    
    // モーダルが開いている場合はリロードをスキップ
    if (hasOpenModals) {
      console.log('モーダルが開いているため、メンバーデータのリロードをスキップします')
      return
    }
    
    const { data, error } = await supabase
      .from('project_members')
      .select(`
        *,
        profiles (name, email)
      `)
      .eq('project_id', id)
      .neq('user_id', user.id) // オーナー（現在のユーザー）を除外

    if (error) {throw error}

    setMembers(data || [])
  }, [id, user, hasOpenModals])

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

  const loadProjectData = useCallback(async () => {
    if (hasOpenModals) {
      return
    }
    
    try {
      setLoading(true)
      setError(null)
      
      await Promise.all([
        loadProject(),
        loadReferences(),
        loadMembers(),
        loadCitationSettings()
      ])
    } catch (error) {
      console.error('Failed to load project data:', error)
      setError('プロジェクトデータの読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }, [hasOpenModals, loadProject, loadReferences, loadMembers, loadCitationSettings])

  // ページフォーカス時の自動リロードを無効化（モーダルがあるページなので完全に無効）
  usePageFocus(() => {}, [], {
    enableFocusReload: false
  })

  useEffect(() => {
    if (user && id && !hasOpenModals) {
      loadProjectData()
    }
  }, [user, id, hasOpenModals, loadProjectData])

  useEffect(() => {
    const handleReferenceCreated = (event) => {
      const createdReference = event.detail?.reference
      if (createdReference?.project_id === id && !hasOpenModals) {
        loadReferences()
      }
    }

    window.addEventListener('reference:created', handleReferenceCreated)
    return () => {
      window.removeEventListener('reference:created', handleReferenceCreated)
    }
  }, [hasOpenModals, id, loadReferences])

  useEffect(() => {
    if (pendingAction?.type === 'edit' && pendingAction.projectId === id) {
      setReferenceToAutoEdit(pendingAction.referenceId)
      clearPendingAction()
    }
  }, [pendingAction, id, clearPendingAction])

  // ドロップダウンメニューの外側クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showDropdownMenu && !event.target.closest('.dropdown-menu')) {
        setShowDropdownMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showDropdownMenu])

  const handleAddReference = async (referenceData) => {
    try {
      const { error } = await supabase
        .from('references')
        .insert([{
          ...referenceData,
          project_id: id,
          saved_by: user.id
        }])
        .select()
        .single()

      if (error) {throw error}

      await loadReferences()
      setShowAddReference(false)
      toast.success('参照を追加しました')
    } catch (error) {
      console.error('Failed to add reference:', error)
      toast.error('参照の追加に失敗しました')
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

      if (error) {throw error}

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

  const handleUpdateProject = async (projectData) => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .update({
          ...projectData,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single()

      if (error) {throw error}

      setProject(data)
      setShowEditModal(false)
      toast.success('プロジェクトを更新しました')
    } catch (error) {
      console.error('Failed to update project:', error)
      toast.error('プロジェクトの更新に失敗しました')
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

  const handleGenerateCitations = async () => {
    if (references.length === 0) {
      toast.error('引用を生成する参照がありません')
      return
    }

    try {
      setGenerating(true)
      const citations = generateProjectCitations(references, citationFormat)
      setGeneratedCitations(citations)
      setShowCitationModal(true)
    } catch (error) {
      console.error('Failed to generate citations:', error)
      toast.error('引用の生成に失敗しました')
    } finally {
      setGenerating(false)
    }
  }

  const copyCitations = async () => {
    try {
      await navigator.clipboard.writeText(generatedCitations)
      toast.success('引用をクリップボードにコピーしました')
    } catch (error) {
      console.error('Failed to copy:', error)
      toast.error('コピーに失敗しました')
    }
  }

  const exportCitations = () => {
    const blob = new Blob([generatedCitations], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${project.name}_citations_${citationFormat}_${format(new Date(), 'yyyyMMdd')}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleDeleteProject = async () => {
    try {
      const { error } = await supabase
        .from('projects')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: user.id
        })
        .eq('id', id)

      if (error) {throw error}

      toast.success('プロジェクトを削除しました')
      navigate('/projects')
    } catch (error) {
      console.error('Failed to delete project:', error)
      toast.error('プロジェクトの削除に失敗しました')
    } finally {
      setShowProjectDeleteConfirm(false)
    }
  }

  const isOwner = project?.owner_id === user?.id
  const userRole = project?.project_members?.[0]?.role || (isOwner ? 'owner' : 'viewer')
  const canEdit = isOwner || userRole === 'editor'
  const canShare = isOwner || userRole === 'editor'

  // ローカルフィルタリング（検索クエリによるフィルタリング）
  const filteredReferences = useMemo(() => {
    if (!debouncedSearchQuery) {
      return references
    }
    
    const query = debouncedSearchQuery.toLowerCase()
    return references.filter(ref => 
      ref.title?.toLowerCase().includes(query) ||
      ref.description?.toLowerCase().includes(query) ||
      ref.url?.toLowerCase().includes(query)
    )
  }, [references, debouncedSearchQuery])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-32 bg-gray-200 rounded"></div>
              ))}
            </div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 text-xl mb-4">エラーが発生しました</div>
        <p className="text-gray-600 mb-6">{error}</p>
        <button
          onClick={loadProjectData}
          className="btn btn-primary"
        >
          再試行
        </button>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-600 text-xl">プロジェクトが見つかりません</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900 dark:text-secondary-100">
            {project.name}
          </h1>
          <p className="text-secondary-600 dark:text-secondary-400 mt-1">
            {project.description || 'プロジェクトの説明はありません'}
          </p>
          <div className="flex items-center gap-4 mt-2 text-sm text-secondary-500">
            <span>{references.length} 件の参照</span>
            <span>作成日: {format(new Date(project.created_at), 'yyyy年MM月dd日', { locale: ja })}</span>
            <span className={`px-2 py-1 rounded-full text-xs ${
              userRole === 'owner' ? 'bg-purple-100 text-purple-800' :
              userRole === 'editor' ? 'bg-green-100 text-green-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {userRole === 'owner' ? 'オーナー' :
               userRole === 'editor' ? '編集者' : '閲覧者'}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {/* メインボタン */}
          <button
            onClick={handleGenerateCitations}
            disabled={generating || references.length === 0}
            className="btn btn-secondary flex items-center gap-2 btn-project-edit"
          >
            <FileText className="w-4 h-4" />
            {generating ? '生成中...' : '引用作成'}
          </button>
          
          {canEdit && (
            <button
              onClick={() => setShowAddReference(true)}
              className="btn btn-primary flex items-center gap-2 btn-project-edit"
            >
              <Plus className="w-4 h-4" />
              参照追加
            </button>
          )}

          {/* 3点リーダーメニュー */}
          <div className="relative dropdown-menu">
            <button
              onClick={() => setShowDropdownMenu(!showDropdownMenu)}
              className="btn btn-outline p-2"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            
            {showDropdownMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-10">
                {canShare && (
                  <button
                    onClick={() => {
                      setShowShareModal(true)
                      setShowDropdownMenu(false)
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                  >
                    <Share2 className="w-4 h-4" />
                    共有
                  </button>
                )}
                {canEdit && (
                  <button
                    onClick={() => {
                      setShowEditModal(true)
                      setShowDropdownMenu(false)
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                  >
                    <Edit3 className="w-4 h-4" />
                    編集
                  </button>
                )}
                {isOwner && (
                  <button
                    onClick={() => {
                      setShowProjectDeleteConfirm(true)
                      setShowDropdownMenu(false)
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    削除
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* メインコンテンツ - 参照リスト */}
        <div className="lg:col-span-2 space-y-4">
          {/* 検索・フィルター */}
          <div className="card p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="参照を検索..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div className="flex gap-2">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="saved_at">保存日時</option>
                  <option value="title">タイトル</option>
                  <option value="updated_at">更新日時</option>
                </select>
                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  {sortOrder === 'asc' ? '↑' : '↓'}
                </button>
              </div>
            </div>
          </div>

          {/* 参照リスト */}
          {filteredReferences.length === 0 ? (
            <div className="card p-8 text-center">
              <div className="text-gray-400 text-6xl mb-4">📚</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">参照がありません</h3>
              <p className="text-gray-600 mb-4">
                {searchQuery ? '検索条件に一致する参照が見つかりません' : 'このプロジェクトには参照が追加されていません'}
              </p>
              {canEdit && !searchQuery && (
                <button
                  onClick={() => setShowAddReference(true)}
                  className="btn btn-primary"
                >
                  最初の参照を追加
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredReferences.map((reference) => (
                <ReferenceCard
                  key={reference.id}
                  reference={reference}
                  onDelete={canEdit ? handleDeleteReference : null}
                  onUpdate={canEdit ? handleUpdateReference : null}
                  citationFormat={citationFormat}
                autoOpenEdit={reference.id === referenceToAutoEdit}
                onAutoEditHandled={() => setReferenceToAutoEdit(null)}
                />
              ))}
            </div>
          )}
        </div>

        {/* サイドバー - プロジェクト情報 */}
        <div className="space-y-6">
          {/* プロジェクト統計 */}
          <div className="card p-4">
            <h3 className="font-medium text-gray-900 mb-4">統計情報</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">参照数</span>
                <span className="font-medium">{references.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">メンバー数</span>
                <span className="font-medium">{members.length + 1}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">最終更新</span>
                <span className="font-medium text-sm">
                  {format(new Date(project.updated_at), 'MM/dd', { locale: ja })}
                </span>
              </div>
            </div>
          </div>

          {/* メンバー一覧 */}
          <div className="card p-4">
            <h3 className="font-medium text-gray-900 mb-4">メンバー</h3>
            <div className="space-y-3">
              {/* オーナー */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                    <span className="text-purple-600 font-medium text-sm">
                      {project.profiles?.name?.[0] || project.profiles?.email?.[0] || 'O'}
                    </span>
                  </div>
                  <div>
                    <div className="font-medium text-sm">
                      {project.profiles?.name || project.profiles?.email || 'オーナー'}
                    </div>
                    <div className="text-xs text-gray-500">オーナー</div>
                  </div>
                </div>
              </div>

              {/* メンバー */}
              {members.map((member) => (
                <div key={member.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                      <span className="text-gray-600 font-medium text-sm">
                        {member.profiles?.name?.[0] || member.profiles?.email?.[0] || 'U'}
                      </span>
                    </div>
                    <div>
                      <div className="font-medium text-sm">
                        {member.profiles?.name || member.profiles?.email || 'ユーザー'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {member.role === 'editor' ? '編集者' : '閲覧者'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* モーダル */}
      {showAddReference && (
        <AddReferenceModal
          onClose={() => setShowAddReference(false)}
          onAdd={handleAddReference}
          projectId={id}
        />
      )}

      {showShareModal && (
        <ShareProjectModal
          project={project}
          members={members}
          onClose={() => setShowShareModal(false)}
          onUpdate={loadMembers}
        />
      )}

      {showEditModal && (
        <EditProjectModal
          project={project}
          onClose={() => setShowEditModal(false)}
          onUpdate={handleUpdateProject}
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

      {/* 引用生成モーダル */}
      {showCitationModal && (
        <div 
          className="fixed inset-0 flex items-center justify-center p-4 z-50"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    引用文 ({citationFormat})
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {project.name} - {references.length}件の参照
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={citationFormat}
                    onChange={(e) => setCitationFormat(e.target.value)}
                    className="px-3 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="APA">APA</option>
                    <option value="MLA">MLA</option>
                    <option value="Chicago">Chicago</option>
                    <option value="Harvard">Harvard</option>
                  </select>
                  <button
                    onClick={() => {
                      const citations = generateProjectCitations(references, citationFormat)
                      setGeneratedCitations(citations)
                    }}
                    className="px-3 py-1 text-sm bg-primary-600 text-white rounded hover:bg-primary-700"
                  >
                    再生成
                  </button>
                  <button
                    onClick={() => setShowCitationModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>
            </div>
            
            <div className="p-6 max-h-96 overflow-y-auto">
              <textarea
                value={generatedCitations}
                readOnly
                className="w-full h-64 p-4 border border-gray-300 rounded-lg font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="引用文がここに表示されます..."
              />
            </div>
            
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
              <button
                onClick={copyCitations}
                className="btn btn-outline flex items-center gap-2"
              >
                <Copy className="w-4 h-4" />
                コピー
              </button>
              <button
                onClick={exportCitations}
                className="btn btn-primary flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                エクスポート
              </button>
            </div>
          </div>
        </div>
      )}

      {/* プロジェクト削除確認ダイアログ */}
      <ConfirmDialog
        isOpen={showProjectDeleteConfirm}
        onClose={() => setShowProjectDeleteConfirm(false)}
        onConfirm={handleDeleteProject}
        title="プロジェクトを削除"
        message="このプロジェクトを削除しますか？この操作は取り消せません。"
        confirmText="削除"
        cancelText="キャンセル"
      />
    </div>
  )
}
