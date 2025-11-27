import React, { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import ProtectedModal from './ProtectedModal'
import { useModalContext } from '../../hooks/useModalContext'
import { useReferenceFetchQueue } from '../../context/ReferenceFetchQueueContext'

const AddReferenceModal = ({ onClose, onAdd, projectId: _projectId }) => {
  const { openModal, closeModal, setUnsavedChanges } = useModalContext()
  const { enqueueFetch } = useReferenceFetchQueue()
  const { user } = useAuth()
  const modalId = 'add-reference'

  const [formData, setFormData] = useState({
    url: '',
    title: '',
    description: '',
    tags: '',
    memo: '',
    publishedDate: '',
    accessedDate: new Date().toISOString().split('T')[0],
    projectId: _projectId || '',
    reference_type: 'website',
    publisher: '',
    pages: '',
    isbn: '',
    doi: '',
    journal_name: '',
    volume: '',
    issue: '',
    edition: ''
  })
  const [authors, setAuthors] = useState([{ name: '', order: 1 }])
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})
  const [isQueueing, setIsQueueing] = useState(false)
  const [isbnLoading, setIsbnLoading] = useState(false)
  const [projects, setProjects] = useState([])
  const [hasBackgroundJob, setHasBackgroundJob] = useState(false)

  // プロジェクト一覧を取得
  useEffect(() => {
    const loadProjects = async () => {
      if (!user) {
        return
      }

      try {
        const { data, error } = await supabase
          .from('projects')
          .select('id, name, color, icon')
          .eq('owner_id', user.id)
          .is('deleted_at', null)
          .order('name')

        if (error) {
          throw error
        }
        setProjects(data || [])
      } catch (error) {
        console.error('Failed to load projects:', error)
      }
    }

    loadProjects()
  }, [user])

  // モーダルを開いた状態として登録
  useEffect(() => {
    // マウント時にモーダルを登録
    openModal(modalId)

    // アンマウント時にクリーンアップ（重要！）
    return () => {
      console.log(`AddReferenceModal unmounting: ${modalId}`)
      closeModal(modalId)
    }
  }, [openModal, closeModal, modalId])

  // 未保存の変更があるかチェック
  const hasUnsavedChanges = formData.url.trim() || formData.title.trim() ||
    formData.description.trim() || formData.tags.trim() ||
    formData.memo.trim() || authors.some(a => a.name.trim())

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

  // 著者管理
  const addAuthor = () => {
    setAuthors([...authors, { name: '', order: authors.length + 1 }])
  }

  const removeAuthor = (index) => {
    if (authors.length > 1) {
      setAuthors(authors.filter((_, i) => i !== index))
    }
  }

  const updateAuthor = (index, name) => {
    const updatedAuthors = [...authors]
    updatedAuthors[index] = { ...updatedAuthors[index], name }
    setAuthors(updatedAuthors)
  }

  // ISBN自動取得
  const fetchFromISBN = async () => {
    if (!formData.isbn) {
      toast.error('ISBNを入力してください')
      return
    }

    try {
      setIsbnLoading(true)
      const { fetchBookByISBN } = await import('../../lib/isbnApi')
      const bookInfo = await fetchBookByISBN(formData.isbn)

      setFormData(prev => ({
        ...prev,
        title: bookInfo.title || prev.title,
        publisher: bookInfo.publisher || prev.publisher,
        publishedDate: bookInfo.publishedDate || prev.publishedDate,
        pages: bookInfo.pages?.toString() || prev.pages,
        description: bookInfo.description || prev.description
      }))

      if (bookInfo.authors && bookInfo.authors.length > 0) {
        setAuthors(bookInfo.authors.map((name, index) => ({
          name,
          order: index + 1
        })))
      }

      toast.success(`書籍情報を取得しました (${bookInfo.source})`)
    } catch (error) {
      console.error('ISBN fetch error:', error)
      toast.error(error.message || '書籍情報の取得に失敗しました')
    } finally {
      setIsbnLoading(false)
    }
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

      // 著者情報をJSONB形式に変換
      const authorsData = authors
        .filter(a => a.name.trim())
        .map((a, index) => ({ name: a.name.trim(), order: index + 1 }))

      const referenceData = {
        url: formData.url.trim(),
        title: formData.title.trim(),
        memo: formData.memo.trim() || null,
        authors: authorsData.length > 0 ? authorsData : null,
        published_date: formData.publishedDate || null,
        accessed_date: formData.accessedDate || new Date().toISOString().split('T')[0],
        project_id: formData.projectId || null,
        reference_type: formData.reference_type,
        publisher: formData.publisher.trim() || null,
        pages: formData.pages.trim() || null,
        isbn: formData.isbn.trim() || null,
        doi: formData.doi.trim() || null,
        journal_name: formData.journal_name.trim() || null,
        volume: formData.volume.trim() || null,
        issue: formData.issue.trim() || null,
        edition: formData.edition.trim() || null,
        saved_at: new Date().toISOString(),
        // tagsとdescriptionはmetadataに格納
        metadata: {
          description: formData.description.trim() || null,
          tags: tagsArray
        }
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

  const queueReferenceFetch = async () => {
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
      setIsQueueing(true)

      const tagsArray = formData.tags
        ? formData.tags.split(',').map(tag => tag.trim()).filter(Boolean)
        : []

      const manualAuthors = authors
        .filter(author => author.name.trim())
        .map((author, index) => ({
          name: author.name.trim(),
          order: index + 1
        }))

      const manualFields = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        memo: formData.memo.trim(),
        reference_type: formData.reference_type,
        publishedDate: formData.publishedDate || null,
        accessedDate: formData.accessedDate || new Date().toISOString().split('T')[0],
        publisher: formData.publisher.trim(),
        pages: formData.pages.trim(),
        isbn: formData.isbn.trim(),
        doi: formData.doi.trim(),
        journal_name: formData.journal_name.trim(),
        volume: formData.volume.trim(),
        issue: formData.issue.trim(),
        edition: formData.edition.trim(),
        authors: manualAuthors
      }

      await enqueueFetch({
        url: formData.url.trim(),
        projectId: formData.projectId || null,
        tags: tagsArray,
        manualFields
      })

      setHasBackgroundJob(true)
      setUnsavedChanges(modalId, false)
      onClose() // モーダルを閉じる
    } catch (error) {
      console.error('Failed to queue reference fetch:', error)
      toast.error(error.message || '情報取得キューへの追加に失敗しました')
    } finally {
      setIsQueueing(false)
    }
  }

  const modalHasUnsavedChanges = !hasBackgroundJob && hasUnsavedChanges

  return (
    <ProtectedModal
      modalId={modalId}
      onClose={onClose}
      hasUnsavedChanges={modalHasUnsavedChanges}
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
                className={`flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 ${errors.url ? 'border-red-300' : 'border-gray-300'
                  }`}
                placeholder="https://example.com"
              />
              <button
                type="button"
                onClick={queueReferenceFetch}
                disabled={isQueueing || !formData.url || hasBackgroundJob}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 text-sm"
              >
                {isQueueing ? 'キュー追加中...' : '情報取得'}
              </button>
            </div>
            {errors.url && (
              <p className="mt-1 text-sm text-red-600">{errors.url}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              情報取得を開始するとバックグラウンドで処理され、モーダルを閉じても継続します
            </p>
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
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 ${errors.title ? 'border-red-300' : 'border-gray-300'
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
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 ${errors.description ? 'border-red-300' : 'border-gray-300'
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

          {/* 引用種類 */}
          <div>
            <label htmlFor="reference_type" className="block text-sm font-medium text-gray-700 mb-1">
              引用種類
            </label>
            <select
              id="reference_type"
              value={formData.reference_type}
              onChange={(e) => handleChange('reference_type', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="website">ウェブサイト</option>
              <option value="article">論文</option>
              <option value="journal">雑誌論文</option>
              <option value="book">書籍</option>
              <option value="report">レポート</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">
              引用の種類を選択してください
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

          {/* 著者（複数対応） */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              著者・執筆者
            </label>
            <div className="space-y-2">
              {authors.map((author, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={author.name}
                    onChange={(e) => updateAuthor(index, e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder={`著者 ${index + 1}`}
                  />
                  {authors.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeAuthor(index)}
                      className="px-3 py-2 text-red-600 hover:text-red-700 border border-red-300 rounded-md hover:bg-red-50"
                    >
                      削除
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addAuthor}
                className="text-sm text-primary-600 hover:text-primary-700"
              >
                + 著者を追加
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              共同執筆者がいる場合は追加できます
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

          {/* アクセス日（オンライン資料のみ） */}
          {formData.reference_type !== 'book' && (
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
          )}

          {/* ISBN（書籍のみ） */}
          {formData.reference_type === 'book' && (
            <div>
              <label htmlFor="isbn" className="block text-sm font-medium text-gray-700 mb-1">
                ISBN
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  id="isbn"
                  value={formData.isbn}
                  onChange={(e) => handleChange('isbn', e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="978-4-XXXX-XXXX-X"
                />
                <button
                  type="button"
                  onClick={fetchFromISBN}
                  disabled={isbnLoading || !formData.isbn}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 text-sm whitespace-nowrap"
                >
                  {isbnLoading ? '取得中...' : '自動取得'}
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                ISBNを入力して自動取得ボタンを押すと、書籍情報が自動入力されます
              </p>
            </div>
          )}

          {/* 出版社（書籍、レポート） */}
          {(formData.reference_type === 'book' || formData.reference_type === 'report') && (
            <div>
              <label htmlFor="publisher" className="block text-sm font-medium text-gray-700 mb-1">
                出版社
              </label>
              <input
                type="text"
                id="publisher"
                value={formData.publisher}
                onChange={(e) => handleChange('publisher', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="出版社名"
              />
            </div>
          )}

          {/* 論文誌名（雑誌論文、論文） */}
          {(formData.reference_type === 'journal' || formData.reference_type === 'article') && (
            <div>
              <label htmlFor="journal_name" className="block text-sm font-medium text-gray-700 mb-1">
                論文誌・ジャーナル名
              </label>
              <input
                type="text"
                id="journal_name"
                value={formData.journal_name}
                onChange={(e) => handleChange('journal_name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="論文誌名またはジャーナル名"
              />
            </div>
          )}

          {/* 巻・号（雑誌論文、論文） */}
          {(formData.reference_type === 'journal' || formData.reference_type === 'article') && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="volume" className="block text-sm font-medium text-gray-700 mb-1">
                  巻
                </label>
                <input
                  type="text"
                  id="volume"
                  value={formData.volume}
                  onChange={(e) => handleChange('volume', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="例: 12"
                />
              </div>
              <div>
                <label htmlFor="issue" className="block text-sm font-medium text-gray-700 mb-1">
                  号
                </label>
                <input
                  type="text"
                  id="issue"
                  value={formData.issue}
                  onChange={(e) => handleChange('issue', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="例: 3"
                />
              </div>
            </div>
          )}

          {/* ページ（論文、書籍、レポート、雑誌論文） */}
          {formData.reference_type !== 'website' && (
            <div>
              <label htmlFor="pages" className="block text-sm font-medium text-gray-700 mb-1">
                ページ
              </label>
              <input
                type="text"
                id="pages"
                value={formData.pages}
                onChange={(e) => handleChange('pages', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="例: 45-67 または 250（総ページ数）"
              />
              <p className="mt-1 text-xs text-gray-500">
                {formData.reference_type === 'book' ? '総ページ数または参照ページ' : '掲載ページ範囲'}
              </p>
            </div>
          )}

          {/* DOI（論文、雑誌論文） */}
          {(formData.reference_type === 'journal' || formData.reference_type === 'article') && (
            <div>
              <label htmlFor="doi" className="block text-sm font-medium text-gray-700 mb-1">
                DOI
              </label>
              <input
                type="text"
                id="doi"
                value={formData.doi}
                onChange={(e) => handleChange('doi', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="例: 10.1000/xxxxx"
              />
              <p className="mt-1 text-xs text-gray-500">
                Digital Object Identifier（デジタルオブジェクト識別子）
              </p>
            </div>
          )}

          {/* 版（書籍のみ） */}
          {formData.reference_type === 'book' && (
            <div>
              <label htmlFor="edition" className="block text-sm font-medium text-gray-700 mb-1">
                版
              </label>
              <input
                type="text"
                id="edition"
                value={formData.edition}
                onChange={(e) => handleChange('edition', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="例: 第2版"
              />
            </div>
          )}

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
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 ${errors.memo ? 'border-red-300' : 'border-gray-300'
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
            disabled={loading || hasBackgroundJob}
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
