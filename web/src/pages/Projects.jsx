import React, { useState, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { toast } from 'react-hot-toast'
import ConfirmDialog from '../components/common/ConfirmDialog'
import { usePageFocus } from '../hooks/usePageFocus'

export default function Projects() {
  const { user } = useAuth()
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)
  const [projectToDelete, setProjectToDelete] = useState(null)

  const loadProjects = useCallback(async () => {
    if (!user) {return}
    
    try {
      setLoading(true)
      setError(null)
      
      // 所有プロジェクトを取得
      const { data: ownedProjects, error: ownedError } = await supabase
        .from('projects')
        .select(`
          *,
          references(id)
        `)
        .eq('owner_id', user.id)
        .order('updated_at', { ascending: false })

      if (ownedError) {
        throw ownedError
      }

      // メンバープロジェクトを取得
      const { data: memberProjects, error: memberError } = await supabase
        .from('project_members')
        .select(`
          role,
          projects(
            *,
            references(id)
          )
        `)
        .eq('user_id', user.id)

      if (memberError) {
        throw memberError
      }

      // データを統合
      const allProjects = [
        ...(ownedProjects || []).map(project => ({
          ...project,
          role: 'owner',
          referenceCount: project.references?.length || 0
        })),
        ...(memberProjects || []).map(member => ({
          ...member.projects,
          role: member.role,
          referenceCount: member.projects?.references?.length || 0
        }))
      ]

      // 重複を排除して更新日順でソート
      const uniqueProjects = allProjects
        .filter((project, index, self) => 
          index === self.findIndex(p => p.id === project.id)
        )
        .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))

      setProjects(uniqueProjects)
    } catch (error) {
      console.error('Failed to load projects:', error)
      setError('プロジェクトの読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }, [user])

  // ページフォーカス時の不要なリロードを防ぐ
  usePageFocus(loadProjects, [user?.id], {
    enableFocusReload: false // フォーカス時のリロードは無効
  })

  const handleCreateProject = async (projectData) => {
    try {
      setCreateLoading(true)
      setError(null)

      const { data: project, error } = await supabase
        .from('projects')
        .insert({
          name: projectData.name.trim(),
          description: projectData.description?.trim() || '',
          color: projectData.color || '#3B82F6',
          icon: projectData.icon || '📂',
          owner_id: user.id
        })
        .select()
        .single()

      if (error) {
        throw error
      }

      // プロジェクトメンバーとしてオーナーを追加
      const { error: memberError } = await supabase
        .from('project_members')
        .insert({
          project_id: project.id,
          user_id: user.id,
          role: 'admin'
        })

      if (memberError) {
        console.warn('Failed to add project member:', memberError)
      }

      // プロジェクトリストを更新
      await loadProjects()
      setShowCreateModal(false)
    } catch (error) {
      console.error('Failed to create project:', error)
      setError('プロジェクトの作成に失敗しました')
    } finally {
      setCreateLoading(false)
    }
  }

  const handleDeleteProject = (projectId) => {
    setProjectToDelete(projectId)
    setShowConfirmDelete(true)
  }

  const confirmDeleteProject = async () => {
    try {
      // ソフト削除（ゴミ箱に移動）
      const { error } = await supabase
        .from('projects')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: user.id
        })
        .eq('id', projectToDelete)

      if (error) {
        throw error
      }

      await loadProjects()
      toast.success('プロジェクトをゴミ箱に移動しました')
    } catch (error) {
      console.error('Failed to delete project:', error)
      toast.error('プロジェクトの削除に失敗しました')
    } finally {
      setShowConfirmDelete(false)
      setProjectToDelete(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
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
            プロジェクト
          </h1>
          <p className="text-secondary-600 dark:text-secondary-400">
            研究プロジェクトを管理します
          </p>
        </div>
        <button 
          className="btn-primary"
          onClick={() => setShowCreateModal(true)}
        >
          新しいプロジェクト
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}
      
      {projects.length === 0 ? (
        <div className="card p-6">
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-secondary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-secondary-900 dark:text-secondary-100">
              プロジェクトがありません
            </h3>
            <p className="mt-1 text-sm text-secondary-500 dark:text-secondary-400">
              新しいプロジェクトを作成して研究を始めましょう
            </p>
            <button 
              className="mt-4 btn-primary"
              onClick={() => setShowCreateModal(true)}
            >
              最初のプロジェクトを作成
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onDelete={handleDeleteProject}
            />
          ))}
        </div>
      )}

      {showCreateModal && (
        <CreateProjectModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateProject}
          loading={createLoading}
        />
      )}

      <ConfirmDialog
        isOpen={showConfirmDelete}
        onClose={() => setShowConfirmDelete(false)}
        onConfirm={confirmDeleteProject}
        title="プロジェクトを削除"
        message="このプロジェクトをゴミ箱に移動しますか？関連するすべての参照も一緒に移動されます。30日以内であれば復元できます。"
        confirmText="削除"
        cancelText="キャンセル"
      />
    </div>
  )
}

function ProjectCard({ project, onDelete }) {
  const canDelete = project.role === 'owner'

  return (
    <div className="card hover:shadow-lg transition-shadow duration-200">
      <div className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div 
              className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-medium"
              style={{ backgroundColor: project.color }}
            >
              {project.icon || '📂'}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-secondary-900 dark:text-secondary-100">
                {project.name}
              </h3>
              <p className="text-sm text-secondary-500">
                {project.role === 'owner' ? 'オーナー' : project.role}
              </p>
            </div>
          </div>
          
          {canDelete && (
            <button
              onClick={() => onDelete(project.id)}
              className="text-secondary-400 hover:text-red-500 transition-colors"
              title="プロジェクトを削除"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>

        {project.description && (
          <p className="mt-3 text-sm text-secondary-600 dark:text-secondary-400">
            {project.description}
          </p>
        )}

        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-secondary-500">
            {project.referenceCount} 件の参照
          </span>
          <span className="text-secondary-400">
            {format(new Date(project.updated_at), 'MM/dd', { locale: ja })}
          </span>
        </div>

        <div className="mt-4">
          <a
            href={`/projects/${project.id}`}
            className="btn-secondary w-full justify-center"
          >
            プロジェクトを開く
          </a>
        </div>
      </div>
    </div>
  )
}

function CreateProjectModal({ onClose, onCreate, loading }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#3B82F6',
    icon: '📂'
  })

  const projectIcons = ['📂', '📚', '🔬', '📊', '🎯', '🔍', '📝', '💡', '🧪', '📋']
  const projectColors = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
    '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'
  ]

  const handleSubmit = (e) => {
    e.preventDefault()
    if (formData.name.trim()) {
      onCreate(formData)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-secondary-800 rounded-lg max-w-md w-full">
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-secondary-900 dark:text-secondary-100">
                新しいプロジェクト
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
                プロジェクト名 *
              </label>
              <input
                type="text"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="例: Extended Essay"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
                説明
              </label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="プロジェクトの説明を入力..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
                アイコン
              </label>
              <div className="grid grid-cols-5 gap-2">
                {projectIcons.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    className={`p-2 text-lg border rounded-lg hover:bg-gray-50 ${
                      formData.icon === icon ? 'border-primary-500 bg-primary-50' : 'border-gray-200'
                    }`}
                    onClick={() => setFormData({ ...formData, icon })}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
                カラー
              </label>
              <div className="grid grid-cols-4 gap-2">
                {projectColors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`w-8 h-8 rounded-lg border-2 ${
                      formData.color === color ? 'border-gray-400' : 'border-gray-200'
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setFormData({ ...formData, color })}
                  />
                ))}
              </div>
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
              disabled={loading || !formData.name.trim()}
            >
              {loading ? '作成中...' : '作成'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
