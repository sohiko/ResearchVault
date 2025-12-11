import React, { useState, useEffect, useMemo } from 'react'
import { toast } from 'react-hot-toast'
import ProtectedModal from './ProtectedModal'
import { useModalContext } from '../../hooks/useModalContext'
import {
  renderProjectIcon,
  getAvailableLucideIcons,
  getAvailableEmojiIcons,
  lucideIconMap
} from '../../utils/iconRenderer'

const EditProjectModal = ({ project, onClose, onUpdate }) => {
  const { openModal, closeModal } = useModalContext()
  const modalId = 'edit-project'

  // アイコンの初期タイプ判定
  const initialIconType = useMemo(() => {
    if (!project.icon) return 'emoji'
    if (typeof project.icon === 'string' && project.icon.startsWith('lucide:')) {
      return 'lucide'
    }
    if (lucideIconMap[project.icon]) {
      return 'lucide'
    }
    return 'emoji'
  }, [project.icon])

  const initialIconName = useMemo(() => {
    if (!project.icon) return 'Folder'
    if (typeof project.icon === 'string' && project.icon.startsWith('lucide:')) {
      return project.icon.replace('lucide:', '')
    }
    if (lucideIconMap[project.icon]) {
      return project.icon
    }
    return project.icon // emoji
  }, [project.icon])

  const [formData, setFormData] = useState({
    name: project.name || '',
    description: project.description || '',
    color: project.color || '#3B82F6',
    icon: initialIconName,
    iconType: initialIconType
  })
  const [iconSearchQuery, setIconSearchQuery] = useState('')
  const [showAllIcons, setShowAllIcons] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})

  // モーダルを開いた状態として登録
  useEffect(() => {
    // マウント時にモーダルを登録
    openModal(modalId)
    
    // アンマウント時にクリーンアップ（重要！）
    return () => {
      console.log(`EditProjectModal unmounting: ${modalId}`)
      closeModal(modalId)
    }
  }, [openModal, closeModal, modalId])

  // 未保存の変更があるかチェック
  const hasUnsavedChanges = formData.name !== (project.name || '') ||
                           formData.description !== (project.description || '') ||
                           formData.color !== (project.color || '#3B82F6') ||
                           formData.icon !== initialIconName ||
                           formData.iconType !== initialIconType

  const colorOptions = [
    { value: '#3B82F6', label: 'ブルー', class: 'bg-blue-500' },
    { value: '#10B981', label: 'グリーン', class: 'bg-green-500' },
    { value: '#F59E0B', label: 'イエロー', class: 'bg-yellow-500' },
    { value: '#EF4444', label: 'レッド', class: 'bg-red-500' },
    { value: '#8B5CF6', label: 'パープル', class: 'bg-purple-500' },
    { value: '#F97316', label: 'オレンジ', class: 'bg-orange-500' },
    { value: '#EC4899', label: 'ピンク', class: 'bg-pink-500' },
    { value: '#6B7280', label: 'グレー', class: 'bg-gray-500' }
  ]

  const lucideIcons = useMemo(() => getAvailableLucideIcons(), [])
  const emojiIcons = useMemo(() => getAvailableEmojiIcons(), [])

  const filteredLucideIcons = useMemo(() => {
    const query = iconSearchQuery.toLowerCase()
    return lucideIcons.filter(
      (icon) =>
        icon.label.toLowerCase().includes(query) ||
        icon.name.toLowerCase().includes(query)
    )
  }, [iconSearchQuery, lucideIcons])

  const filteredEmojiIcons = useMemo(() => {
    const query = iconSearchQuery.toLowerCase()
    return emojiIcons.filter((icon) =>
      icon.label.toLowerCase().includes(query)
    )
  }, [iconSearchQuery, emojiIcons])

  const validateForm = () => {
    const newErrors = {}

    if (!formData.name.trim()) {
      newErrors.name = 'プロジェクト名は必須です'
    } else if (formData.name.length > 100) {
      newErrors.name = 'プロジェクト名は100文字以内で入力してください'
    }

    if (formData.description.length > 500) {
      newErrors.description = '説明は500文字以内で入力してください'
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
      let iconValue = formData.icon || 'Folder'
      if (formData.iconType === 'lucide') {
        iconValue = `lucide:${formData.icon}`
      }

      await onUpdate({
        name: formData.name.trim(),
        description: formData.description.trim(),
        color: formData.color,
        icon: iconValue
      })
    } catch (error) {
      console.error('Failed to update project:', error)
      toast.error('プロジェクトの更新に失敗しました')
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

  return (
    <ProtectedModal 
      modalId={modalId}
      onClose={onClose}
      hasUnsavedChanges={hasUnsavedChanges}
      confirmMessage="変更内容が失われますが、よろしいですか？"
    >
      <div className="bg-white dark:bg-secondary-800 rounded-lg max-w-2xl w-full shadow-xl">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">プロジェクトを編集</h2>
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

        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-5">
          {/* プロジェクト名 + 説明 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                プロジェクト名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="name"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                  errors.name ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="プロジェクト名を入力"
                maxLength={100}
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                {formData.name.length}/100文字
              </p>
            </div>

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
                placeholder="プロジェクトの説明を入力（任意）"
                maxLength={500}
              />
              {errors.description && (
                <p className="mt-1 text-sm text-red-600">{errors.description}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                {formData.description.length}/500文字
              </p>
            </div>
          </div>

          {/* カラー & アイコン */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                カラー
              </label>
              <div className="grid grid-cols-4 gap-2">
                {colorOptions.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => handleChange('color', color.value)}
                    className={`w-full h-10 rounded-md border-2 flex items-center justify-center ${
                      formData.color === color.value 
                        ? 'border-gray-800' 
                        : 'border-gray-200 hover:border-gray-300'
                    } ${color.class}`}
                    title={color.label}
                  >
                    {formData.color === color.value && (
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  アイコン
                </label>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="inline-flex items-center gap-1">
                    プレビュー:
                    <span className="w-8 h-8 inline-flex items-center justify-center rounded-md border border-gray-200">
                      {renderProjectIcon(
                        formData.iconType === 'lucide' ? formData.icon : formData.icon || '📂',
                        formData.iconType === 'lucide' ? 'lucide' : 'emoji',
                        'w-5 h-5'
                      )}
                    </span>
                  </span>
                </div>
              </div>

              {/* アイコンタイプ選択 */}
              <div className="flex space-x-2 mb-3">
                <button
                  type="button"
                  onClick={() => handleChange('iconType', 'lucide')}
                  className={`flex-1 px-3 py-2 rounded-md border ${
                    formData.iconType === 'lucide'
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Lucide
                </button>
                <button
                  type="button"
                  onClick={() => handleChange('iconType', 'emoji')}
                  className={`flex-1 px-3 py-2 rounded-md border ${
                    formData.iconType === 'emoji'
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  絵文字
                </button>
              </div>

              {/* 検索 */}
              <input
                type="text"
                placeholder="アイコンを検索..."
                value={iconSearchQuery}
                onChange={(e) => setIconSearchQuery(e.target.value)}
                className="w-full px-3 py-2 mb-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />

              {/* アイコン一覧 */}
              <div className="space-y-2">
                <div className="grid grid-cols-6 gap-2">
                  {(formData.iconType === 'lucide'
                    ? (showAllIcons ? filteredLucideIcons : filteredLucideIcons.slice(0, 12))
                    : (showAllIcons ? filteredEmojiIcons : filteredEmojiIcons.slice(0, 12))
                  ).map((icon) => {
                    const iconName = formData.iconType === 'lucide' ? icon.name : icon.name
                    const selected = formData.icon === iconName
                    return (
                      <button
                        key={icon.name}
                        type="button"
                        onClick={() => handleChange('icon', iconName)}
                        className={`h-10 rounded-md border flex items-center justify-center ${
                          selected ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'
                        }`}
                        title={icon.label}
                      >
                        {renderProjectIcon(
                          formData.iconType === 'lucide' ? icon.name : icon.name,
                          formData.iconType === 'lucide' ? 'lucide' : 'emoji',
                          'w-5 h-5'
                        )}
                      </button>
                    )
                  })}
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowAllIcons((prev) => !prev)}
                    className="text-xs text-primary-600 hover:text-primary-700"
                  >
                    {showAllIcons ? '少なく表示' : 'もっと見る'}
                  </button>
                </div>
              </div>
            </div>
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
            {loading ? '更新中...' : '更新'}
          </button>
        </div>
      </div>
    </ProtectedModal>
  )
}

export default EditProjectModal
