import React, { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import ProtectedModal from './ProtectedModal'
import { useModalContext } from '../../hooks/useModalContext'

const EditReferenceModal = ({ reference, onClose, onUpdate }) => {
  const { openModal, closeModal } = useModalContext()
  const { user } = useAuth()
  const modalId = 'edit-reference'
  
  const [formData, setFormData] = useState({
    title: '',
    url: '',
    description: '',
    siteName: '',
    publishedDate: '',
    accessedDate: '',
    projectId: '',
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
  const [projects, setProjects] = useState([])

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
      console.log(`EditReferenceModal unmounting: ${modalId}`)
      closeModal(modalId)
    }
  }, [openModal, closeModal, modalId])

  useEffect(() => {
    if (reference) {
      const metadata = reference.metadata || {}
      setFormData({
        title: reference.title || '',
        url: reference.url || '',
        description: reference.metadata?.description || reference.description || '',
        siteName: metadata.siteName || '',
        publishedDate: reference.published_date ? reference.published_date.split('T')[0] : 
                      (metadata.publishedDate ? metadata.publishedDate.split('T')[0] : ''),
        accessedDate: reference.accessed_date ? reference.accessed_date.split('T')[0] : 
                     (reference.saved_at ? reference.saved_at.split('T')[0] : ''),
        projectId: reference.project_id || '',
        reference_type: reference.reference_type || 'website',
        publisher: reference.publisher || '',
        pages: reference.pages || '',
        isbn: reference.isbn || '',
        doi: reference.doi || '',
        journal_name: reference.journal_name || '',
        volume: reference.volume || '',
        issue: reference.issue || '',
        edition: reference.edition || ''
      })

      // 著者情報の初期化
      if (reference.authors && Array.isArray(reference.authors) && reference.authors.length > 0) {
        setAuthors(reference.authors.map((a, index) => ({
          name: typeof a === 'string' ? a : (a.name || ''),
          order: index + 1
        })))
      } else if (reference.author) {
        setAuthors([{ name: reference.author, order: 1 }])
      } else {
        setAuthors([{ name: '', order: 1 }])
      }
    }
  }, [reference])

  // 未保存の変更があるかチェック
  const hasUnsavedChanges = reference && (
    formData.title !== (reference.title || '') ||
    formData.url !== (reference.url || '') ||
    formData.description !== (reference.metadata?.description || reference.description || '') ||
    formData.siteName !== ((reference.metadata?.siteName || '')) ||
    formData.publishedDate !== (reference.published_date ? reference.published_date.split('T')[0] : 
                               (reference.metadata?.publishedDate ? reference.metadata.publishedDate.split('T')[0] : '')) ||
    formData.accessedDate !== (reference.accessed_date ? reference.accessed_date.split('T')[0] : 
                              (reference.saved_at ? reference.saved_at.split('T')[0] : ''))
  )

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
      // 著者情報をJSONB形式に変換
      const authorsData = authors
        .filter(a => a.name.trim())
        .map((a, index) => ({ name: a.name.trim(), order: index + 1 }))

      const updatedReference = {
        ...reference,
        title: formData.title.trim(),
        url: formData.url.trim(),
        authors: authorsData.length > 0 ? authorsData : null,
        published_date: formData.publishedDate || null,
        accessed_date: formData.accessedDate || null,
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
        metadata: {
          ...reference.metadata,
          description: formData.description.trim() || null,
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

          {/* プロジェクト */}
          <div>
            <label htmlFor="projectId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              プロジェクト
            </label>
            <select
              id="projectId"
              value={formData.projectId}
              onChange={(e) => handleChange('projectId', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">プロジェクトを選択（任意）</option>
              {projects.map(project => (
                <option key={project.id} value={project.id}>
                  {project.icon || '📁'} {project.name}
                </option>
              ))}
            </select>
          </div>

          {/* 引用種類 */}
          <div>
            <label htmlFor="reference_type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              引用種類
            </label>
            <select
              id="reference_type"
              value={formData.reference_type}
              onChange={(e) => handleChange('reference_type', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="website">ウェブサイト</option>
              <option value="article">論文</option>
              <option value="journal">雑誌論文</option>
              <option value="book">書籍</option>
              <option value="report">レポート</option>
            </select>
          </div>

          {/* 著者（複数対応） */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              著者・執筆者
            </label>
            <div className="space-y-2">
              {authors.map((author, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={author.name}
                    onChange={(e) => updateAuthor(index, e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder={`著者 ${index + 1}`}
                  />
                  {authors.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeAuthor(index)}
                      className="px-3 py-2 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 border border-red-300 dark:border-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      削除
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addAuthor}
                className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
              >
                + 著者を追加
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

            {/* アクセス日（オンライン資料のみ） */}
            {formData.reference_type !== 'book' && (
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
            )}
          </div>

          {/* ISBN（書籍のみ） */}
          {formData.reference_type === 'book' && (
            <div>
              <label htmlFor="isbn" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                ISBN
              </label>
              <input
                type="text"
                id="isbn"
                value={formData.isbn}
                onChange={(e) => handleChange('isbn', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="978-4-XXXX-XXXX-X"
              />
            </div>
          )}

          {/* 出版社（書籍、レポート） */}
          {(formData.reference_type === 'book' || formData.reference_type === 'report') && (
            <div>
              <label htmlFor="publisher" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                出版社
              </label>
              <input
                type="text"
                id="publisher"
                value={formData.publisher}
                onChange={(e) => handleChange('publisher', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="出版社名"
              />
            </div>
          )}

          {/* 論文誌名（雑誌論文、論文） */}
          {(formData.reference_type === 'journal' || formData.reference_type === 'article') && (
            <div>
              <label htmlFor="journal_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                論文誌・ジャーナル名
              </label>
              <input
                type="text"
                id="journal_name"
                value={formData.journal_name}
                onChange={(e) => handleChange('journal_name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="論文誌名またはジャーナル名"
              />
            </div>
          )}

          {/* 巻・号（雑誌論文、論文） */}
          {(formData.reference_type === 'journal' || formData.reference_type === 'article') && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="volume" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  巻
                </label>
                <input
                  type="text"
                  id="volume"
                  value={formData.volume}
                  onChange={(e) => handleChange('volume', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="例: 12"
                />
              </div>
              <div>
                <label htmlFor="issue" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  号
                </label>
                <input
                  type="text"
                  id="issue"
                  value={formData.issue}
                  onChange={(e) => handleChange('issue', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="例: 3"
                />
              </div>
            </div>
          )}

          {/* ページ（論文、書籍、レポート、雑誌論文） */}
          {formData.reference_type !== 'website' && (
            <div>
              <label htmlFor="pages" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                ページ
              </label>
              <input
                type="text"
                id="pages"
                value={formData.pages}
                onChange={(e) => handleChange('pages', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="例: 45-67 または 250（総ページ数）"
              />
            </div>
          )}

          {/* DOI（論文、雑誌論文） */}
          {(formData.reference_type === 'journal' || formData.reference_type === 'article') && (
            <div>
              <label htmlFor="doi" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                DOI
              </label>
              <input
                type="text"
                id="doi"
                value={formData.doi}
                onChange={(e) => handleChange('doi', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="例: 10.1000/xxxxx"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Digital Object Identifier（デジタルオブジェクト識別子）
              </p>
            </div>
          )}

          {/* 版（書籍のみ） */}
          {formData.reference_type === 'book' && (
            <div>
              <label htmlFor="edition" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                版
              </label>
              <input
                type="text"
                id="edition"
                value={formData.edition}
                onChange={(e) => handleChange('edition', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="例: 第2版"
              />
            </div>
          )}
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
