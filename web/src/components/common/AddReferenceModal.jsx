import React, { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import ProtectedModal from './ProtectedModal'
import { useModalContext } from '../../hooks/useModalContext'

const AddReferenceModal = ({ onClose, onAdd, projectId: _projectId }) => {
  const { openModal } = useModalContext()
  const { user } = useAuth()
  const modalId = 'add-reference'
  
  const [formData, setFormData] = useState({
    url: '',
    title: '',
    description: '',
    tags: '',
    memo: '',
    author: '',
    publishedDate: '',
    accessedDate: new Date().toISOString().split('T')[0], // 今日の日付をデフォルト
    projectId: _projectId || '' // プロジェクトIDを追加
  })
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})
  const [isExtracting, setIsExtracting] = useState(false)
  const [projects, setProjects] = useState([])

  // プロジェクト一覧を取得
  useEffect(() => {
    const loadProjects = async () => {
      if (!user) return
      
      try {
        const { data, error } = await supabase
          .from('projects')
          .select('id, name, color, icon')
          .eq('owner_id', user.id)
          .is('deleted_at', null)
          .order('name')
        
        if (error) throw error
        setProjects(data || [])
      } catch (error) {
        console.error('Failed to load projects:', error)
      }
    }
    
    loadProjects()
  }, [user])
  
  // モーダルを開いた状態として登録
  useEffect(() => {
    openModal(modalId)
    
    // クリーンアップ関数でモーダル状態をクリア
    return () => {
      // モーダルが閉じられる時は既にProtectedModalでクリアされるため、
      // ここでは何もしない（重複クリアを避ける）
    }
  }, [openModal, modalId])

  // 未保存の変更があるかチェック
  const hasUnsavedChanges = formData.url.trim() || formData.title.trim() || 
                           formData.description.trim() || formData.tags.trim() || 
                           formData.memo.trim() || formData.author.trim()

  const validateForm = () => {
    const newErrors = {}

    if (!formData.url.trim()) {
      newErrors.url = 'URLは必須です'
    } else {
      try {
        new URL(formData.url)
      } catch {
        newErrors.url = '有効なURLを入力してください'
      }
    }

    if (!formData.title.trim()) {
      newErrors.title = 'タイトルは必須です'
    } else if (formData.title.length > 200) {
      newErrors.title = 'タイトルは200文字以内で入力してください'
    }

    if (formData.description.length > 1000) {
      newErrors.description = '説明は1000文字以内で入力してください'
    }

    if (formData.memo.length > 500) {
      newErrors.memo = 'メモは500文字以内で入力してください'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    try {
      setLoading(true)

      const tagsArray = formData.tags
        ? formData.tags.split(',').map(tag => tag.trim()).filter(Boolean)
        : []

      const referenceData = {
        url: formData.url.trim(),
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        tags: tagsArray,
        memo: formData.memo.trim() || null,
        author: formData.author.trim() || null,
        published_date: formData.publishedDate || null,
        accessed_date: formData.accessedDate || new Date().toISOString().split('T')[0],
        project_id: formData.projectId || null,
        saved_at: new Date().toISOString()
      }

      await onAdd(referenceData)
    } catch (error) {
      console.error('Failed to add reference:', error)
      toast.error('参照の追加に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
    
    // エラーをクリア
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: null
      }))
    }
  }

  const extractPageInfo = async () => {
    if (!formData.url) {
      toast.error('URLを入力してください')
      return
    }

    try {
      new URL(formData.url)
    } catch {
      toast.error('有効なURLを入力してください')
      return
    }

    try {
      setIsExtracting(true)
      
      // 複数のAPIを試行して最適な情報を取得
      const extractedInfo = await extractWebPageInfo(formData.url)
      
      // 取得した情報をフォームに反映
      if (extractedInfo.title && !formData.title) {
        handleChange('title', extractedInfo.title)
      }
      if (extractedInfo.description && !formData.description) {
        handleChange('description', extractedInfo.description)
      }
      if (extractedInfo.author && !formData.author) {
        handleChange('author', extractedInfo.author)
      }
      if (extractedInfo.publishedDate && !formData.publishedDate) {
        handleChange('publishedDate', extractedInfo.publishedDate)
      }
      
      toast.success('ページ情報を取得しました')
    } catch (error) {
      console.error('Failed to extract page info:', error)
      toast.error('ページ情報の取得に失敗しました')
    } finally {
      setIsExtracting(false)
    }
  }

  // 高度なウェブページ情報抽出関数
  const extractWebPageInfo = async (url) => {
    const results = {
      title: '',
      description: '',
      author: '',
      publishedDate: ''
    }

    try {
      // 1. Microlink.io APIを使用（メタデータ取得）
      const microlinkResponse = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}&meta=true`)
      const microlinkData = await microlinkResponse.json()

      if (microlinkData.status === 'success' && microlinkData.data) {
        const data = microlinkData.data
        
        results.title = data.title || ''
        results.description = data.description || ''
        results.author = data.author || ''
        
        // 公開日の抽出（複数のフィールドを確認）
        results.publishedDate = 
          data.date || 
          data.publishedTime || 
          data['article:published_time'] ||
          data['og:article:published_time'] ||
          ''
      }

      // 2. JSONLDデータの抽出を試行
      try {
        const jsonldResponse = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}&data.jsonld=true`)
        const jsonldData = await jsonldResponse.json()
        
        if (jsonldData.status === 'success' && jsonldData.data?.jsonld) {
          const jsonld = Array.isArray(jsonldData.data.jsonld) 
            ? jsonldData.data.jsonld[0] 
            : jsonldData.data.jsonld

          if (jsonld) {
            // 著者情報の抽出
            if (!results.author && jsonld.author) {
              if (typeof jsonld.author === 'string') {
                results.author = jsonld.author
              } else if (jsonld.author.name) {
                results.author = jsonld.author.name
              } else if (Array.isArray(jsonld.author) && jsonld.author[0]?.name) {
                results.author = jsonld.author[0].name
              }
            }

            // 公開日の抽出
            if (!results.publishedDate) {
              results.publishedDate = 
                jsonld.datePublished ||
                jsonld.dateCreated ||
                jsonld.dateModified ||
                ''
            }
          }
        }
      } catch (jsonldError) {
        console.warn('JSONLDデータの取得に失敗:', jsonldError)
      }

      // 3. Open Graph / Twitter Cardデータの抽出
      try {
        const ogResponse = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}&data.og=true`)
        const ogData = await ogResponse.json()
        
        if (ogData.status === 'success' && ogData.data?.og) {
          const og = ogData.data.og
          
          if (!results.author && og['article:author']) {
            results.author = og['article:author']
          }
          
          if (!results.publishedDate && og['article:published_time']) {
            results.publishedDate = og['article:published_time']
          }
        }
      } catch (ogError) {
        console.warn('Open Graphデータの取得に失敗:', ogError)
      }

    } catch (error) {
      console.error('ページ情報の抽出に失敗:', error)
      
      // フォールバック: 基本的なメタデータのみ取得
      try {
        const fallbackResponse = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}`)
        const fallbackData = await fallbackResponse.json()
        
        if (fallbackData.status === 'success' && fallbackData.data) {
          results.title = fallbackData.data.title || ''
          results.description = fallbackData.data.description || ''
        }
      } catch (fallbackError) {
        console.error('フォールバック抽出も失敗:', fallbackError)
      }
    }

    // 日付の正規化
    if (results.publishedDate) {
      try {
        const date = new Date(results.publishedDate)
        if (!isNaN(date.getTime())) {
          results.publishedDate = date.toISOString().split('T')[0]
        } else {
          results.publishedDate = ''
        }
      } catch (dateError) {
        results.publishedDate = ''
      }
    }

    return results
  }

  return (
    <ProtectedModal 
      modalId={modalId}
      onClose={onClose}
      hasUnsavedChanges={hasUnsavedChanges}
      confirmMessage="入力内容が失われますが、よろしいですか？"
    >
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">参照を追加</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <span className="sr-only">閉じる</span>
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 max-h-[calc(90vh-120px)] overflow-y-auto space-y-4">
          {/* URL */}
          <div>
            <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-1">
              URL <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                id="url"
                value={formData.url}
                onChange={(e) => handleChange('url', e.target.value)}
                className={`flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                  errors.url ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="https://example.com"
              />
              <button
                type="button"
                onClick={extractPageInfo}
                disabled={isExtracting || !formData.url}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 text-sm"
              >
                {isExtracting ? '取得中...' : '情報取得'}
              </button>
            </div>
            {errors.url && (
              <p className="mt-1 text-sm text-red-600">{errors.url}</p>
            )}
          </div>

          {/* タイトル */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              タイトル <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="title"
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                errors.title ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="参照のタイトルを入力"
              maxLength={200}
            />
            {errors.title && (
              <p className="mt-1 text-sm text-red-600">{errors.title}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              {formData.title.length}/200文字
            </p>
          </div>

          {/* 説明 */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              説明
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              rows={3}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                errors.description ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="参照の説明を入力（任意）"
              maxLength={1000}
            />
            {errors.description && (
              <p className="mt-1 text-sm text-red-600">{errors.description}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              {formData.description.length}/1000文字
            </p>
          </div>

          {/* プロジェクト */}
          <div>
            <label htmlFor="projectId" className="block text-sm font-medium text-gray-700 mb-1">
              プロジェクト
            </label>
            <select
              id="projectId"
              value={formData.projectId}
              onChange={(e) => handleChange('projectId', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">プロジェクトを選択（任意）</option>
              {projects.map(project => (
                <option key={project.id} value={project.id}>
                  {project.icon || '📁'} {project.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              参照を追加するプロジェクトを選択できます
            </p>
          </div>

          {/* タグ */}
          <div>
            <label htmlFor="tags" className="block text-sm font-medium text-gray-700 mb-1">
              タグ
            </label>
            <input
              type="text"
              id="tags"
              value={formData.tags}
              onChange={(e) => handleChange('tags', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="タグをカンマ区切りで入力（例: 研究, AI, 機械学習）"
            />
            <p className="mt-1 text-xs text-gray-500">
              カンマ（,）で区切って複数のタグを入力できます
            </p>
          </div>

          {/* 著者 */}
          <div>
            <label htmlFor="author" className="block text-sm font-medium text-gray-700 mb-1">
              著者・制作者
            </label>
            <input
              type="text"
              id="author"
              value={formData.author}
              onChange={(e) => handleChange('author', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="著者名または制作者名（自動取得）"
              maxLength={200}
            />
            <p className="mt-1 text-xs text-gray-500">
              ウェブページから自動取得されます
            </p>
          </div>

          {/* 公開日 */}
          <div>
            <label htmlFor="publishedDate" className="block text-sm font-medium text-gray-700 mb-1">
              公開日
            </label>
            <input
              type="date"
              id="publishedDate"
              value={formData.publishedDate}
              onChange={(e) => handleChange('publishedDate', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              ページの公開日（自動取得または手動入力）
            </p>
          </div>

          {/* アクセス日 */}
          <div>
            <label htmlFor="accessedDate" className="block text-sm font-medium text-gray-700 mb-1">
              アクセス日
            </label>
            <input
              type="date"
              id="accessedDate"
              value={formData.accessedDate}
              onChange={(e) => handleChange('accessedDate', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              このページにアクセスした日（デフォルト: 今日）
            </p>
          </div>

          {/* メモ */}
          <div>
            <label htmlFor="memo" className="block text-sm font-medium text-gray-700 mb-1">
              メモ
            </label>
            <textarea
              id="memo"
              value={formData.memo}
              onChange={(e) => handleChange('memo', e.target.value)}
              rows={2}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                errors.memo ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="個人的なメモを入力（任意）"
              maxLength={500}
            />
            {errors.memo && (
              <p className="mt-1 text-sm text-red-600">{errors.memo}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              {formData.memo.length}/500文字
            </p>
          </div>
        </form>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            キャンセル
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
          >
            {loading ? '追加中...' : '追加'}
          </button>
        </div>
      </div>
    </ProtectedModal>
  )
}

export default AddReferenceModal
