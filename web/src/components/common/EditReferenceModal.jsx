import React, { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import ProtectedModal from './ProtectedModal'
import { useModalContext } from '../../hooks/useModalContext'

const EditReferenceModal = ({ reference, onClose, onUpdate }) => {
  const { openModal } = useModalContext()
  const modalId = 'edit-reference'
  
  const [formData, setFormData] = useState({
    title: '',
    url: '',
    description: '',
    author: '',
    siteName: '',
    publishedDate: '',
    accessedDate: ''
  })
  const [loading, setLoading] = useState(false)

  // モーダルを開いた状態として登録
  useEffect(() => {
    openModal(modalId)
  }, [openModal])

  useEffect(() => {
    if (reference) {
      const metadata = reference.metadata || {}
      setFormData({
        title: reference.title || '',
        url: reference.url || '',
        description: reference.description || '',
        author: reference.author || metadata.author || '',
        siteName: metadata.siteName || '',
        publishedDate: reference.published_date ? reference.published_date.split('T')[0] : 
                      (metadata.publishedDate ? metadata.publishedDate.split('T')[0] : ''),
        accessedDate: reference.accessed_date ? reference.accessed_date.split('T')[0] : 
                     (reference.saved_at ? reference.saved_at.split('T')[0] : '')
      })
    }
  }, [reference])

  // 未保存の変更があるかチェック
  const hasUnsavedChanges = reference && (
    formData.title !== (reference.title || '') ||
    formData.url !== (reference.url || '') ||
    formData.description !== (reference.description || '') ||
    formData.author !== (reference.author || (reference.metadata?.author || '')) ||
    formData.siteName !== ((reference.metadata?.siteName || '')) ||
    formData.publishedDate !== (reference.published_date ? reference.published_date.split('T')[0] : 
                               (reference.metadata?.publishedDate ? reference.metadata.publishedDate.split('T')[0] : '')) ||
    formData.accessedDate !== (reference.accessed_date ? reference.accessed_date.split('T')[0] : 
                              (reference.saved_at ? reference.saved_at.split('T')[0] : ''))
  )

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.title.trim()) {
      toast.error('タイトルは必須です')
      return
    }
    
    if (!formData.url.trim()) {
      toast.error('URLは必須です')
      return
    }

    try {
      // URLの形式チェック
      new URL(formData.url)
    } catch {
      toast.error('有効なURLを入力してください')
      return
    }

    setLoading(true)

    try {
      const updatedReference = {
        ...reference,
        title: formData.title.trim(),
        url: formData.url.trim(),
        description: formData.description.trim(),
        author: formData.author.trim() || null,
        published_date: formData.publishedDate || null,
        accessed_date: formData.accessedDate || null,
        metadata: {
          ...reference.metadata,
          author: formData.author.trim(),
          siteName: formData.siteName.trim(),
          publishedDate: formData.publishedDate || null
        },
        updated_at: new Date().toISOString()
      }

      await onUpdate(updatedReference)
      onClose()
      toast.success('参照を更新しました')
    } catch (error) {
      console.error('Failed to update reference:', error)
      toast.error('参照の更新に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  return (
    <ProtectedModal 
      modalId={modalId}
      onClose={onClose}
      hasUnsavedChanges={hasUnsavedChanges}
      confirmMessage="変更内容が失われますが、よろしいですか？"
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-xl">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
              参照を編集
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:text-gray-300 dark:hover:text-gray-100"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-96 overflow-y-auto">
          {/* タイトル */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              タイトル <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="参照のタイトルを入力"
              required
            />
          </div>

          {/* URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              URL <span className="text-red-500">*</span>
            </label>
            <input
              type="url"
              value={formData.url}
              onChange={(e) => handleChange('url', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="https://example.com"
              required
            />
          </div>

          {/* 説明 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              説明
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="参照の説明や要約を入力"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 著者 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                著者
              </label>
              <input
                type="text"
                value={formData.author}
                onChange={(e) => handleChange('author', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="著者名を入力"
              />
            </div>

            {/* サイト名 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                サイト名
              </label>
              <input
                type="text"
                value={formData.siteName}
                onChange={(e) => handleChange('siteName', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="サイト名を入力"
              />
            </div>

            {/* 公開日 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                公開日
              </label>
              <input
                type="date"
                value={formData.publishedDate}
                onChange={(e) => handleChange('publishedDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            {/* アクセス日 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                アクセス日
              </label>
              <input
                type="date"
                value={formData.accessedDate}
                onChange={(e) => handleChange('accessedDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                引用時のアクセス日として使用されます
              </p>
            </div>
          </div>
        </form>

        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-outline"
            disabled={loading}
          >
            キャンセル
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="btn btn-primary"
          >
            {loading ? '更新中...' : '更新'}
          </button>
        </div>
      </div>
    </ProtectedModal>
  )
}

export default EditReferenceModal
