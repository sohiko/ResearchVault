import React, { useState } from 'react'
import { toast } from 'react-hot-toast'

const AddReferenceModal = ({ onClose, onAdd, projectId: _projectId }) => {
  const [formData, setFormData] = useState({
    url: '',
    title: '',
    description: '',
    tags: '',
    memo: ''
  })
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})
  const [isExtracting, setIsExtracting] = useState(false)

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
      
      // 簡単なページ情報の抽出（実際の実装ではAPI経由で行う）
      const response = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(formData.url)}`)
      const data = await response.json()

      if (data.status === 'success') {
        if (data.data.title && !formData.title) {
          handleChange('title', data.data.title)
        }
        if (data.data.description && !formData.description) {
          handleChange('description', data.data.description)
        }
        toast.success('ページ情報を取得しました')
      } else {
        throw new Error('Failed to extract page info')
      }
    } catch (error) {
      console.error('Failed to extract page info:', error)
      toast.error('ページ情報の取得に失敗しました')
    } finally {
      setIsExtracting(false)
    }
  }

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center p-4 z-50"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
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
    </div>
  )
}

export default AddReferenceModal
