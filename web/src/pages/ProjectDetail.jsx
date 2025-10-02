import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { toast } from 'react-hot-toast'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'

// コンポーネント
import ReferenceCard from '../components/common/ReferenceCard'
import AddReferenceModal from '../components/common/AddReferenceModal'
import ShareProjectModal from '../components/common/ShareProjectModal'
import EditProjectModal from '../components/common/EditProjectModal'
import ConfirmDialog from '../components/common/ConfirmDialog'

export default function ProjectDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  
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
  
  // フィルター・ソート状態
  const [sortBy, setSortBy] = useState('saved_at')
  const [sortOrder, setSortOrder] = useState('desc')
  const [searchQuery, setSearchQuery] = useState('')

  const loadProject = useCallback(async () => {
    if (!id || !user) {return}
    
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

    setProject(projectData)
  }, [id, user, navigate])

  const loadReferences = useCallback(async () => {
    if (!id) {return}
    
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

    // 検索フィルター
    if (searchQuery) {
      query = query.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)
    }

    // ソート
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
  }, [id, searchQuery, sortBy, sortOrder])

  const loadMembers = useCallback(async () => {
    if (!id) {return}
    
    const { data, error } = await supabase
      .from('project_members')
      .select(`
        *,
        profiles (name, email)
      `)
      .eq('project_id', id)

    if (error) {throw error}

    setMembers(data)
  }, [id])

  const loadProjectData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      await Promise.all([
        loadProject(),
        loadReferences(),
        loadMembers()
      ])
    } catch (error) {
      console.error('Failed to load project data:', error)
      setError('プロジェクトデータの読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }, [loadProject, loadReferences, loadMembers])

  useEffect(() => {
    if (user && id) {
      loadProjectData()
    }
  }, [user, id, loadProjectData])

  const handleAddReference = async (referenceData) => {
    try {
      const { error } = await supabase
        .from('references')
        .insert([{
          ...referenceData,
          project_id: id,
          user_id: user.id
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
      const { error } = await supabase
        .from('references')
        .delete()
        .eq('id', referenceToDelete)

      if (error) {throw error}

      await loadReferences()
      toast.success('参照を削除しました')
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

  const isOwner = project?.owner_id === user?.id
  const userRole = project?.project_members?.[0]?.role || (isOwner ? 'owner' : 'viewer')
  const canEdit = isOwner || userRole === 'editor'
  const canShare = isOwner || userRole === 'editor'

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

  const filteredReferences = references.filter(ref => 
    ref.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ref.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

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
        
        <div className="flex items-center gap-2">
          {canShare && (
            <button
              onClick={() => setShowShareModal(true)}
              className="btn btn-outline"
            >
              <span className="text-lg">👥</span>
              共有
            </button>
          )}
          {canEdit && (
            <button
              onClick={() => setShowEditModal(true)}
              className="btn btn-outline"
            >
              <span className="text-lg">✏️</span>
              編集
            </button>
          )}
          {canEdit && (
            <button
              onClick={() => setShowAddReference(true)}
              className="btn btn-primary"
            >
              <span className="text-lg">➕</span>
              参照を追加
            </button>
          )}
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
    </div>
  )
}
