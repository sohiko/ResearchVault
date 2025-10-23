import React, { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import ProtectedModal from './ProtectedModal'
import { useModalContext } from '../../hooks/useModalContext'

const AddReferenceModal = ({ onClose, onAdd, projectId: _projectId }) => {
  const { openModal, closeModal } = useModalContext()
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
  const [isExtracting, setIsExtracting] = useState(false)
  const [isbnLoading, setIsbnLoading] = useState(false)
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
      if (extractedInfo.publishedDate && !formData.publishedDate) {
        handleChange('publishedDate', extractedInfo.publishedDate)
      }
      if (extractedInfo.publisher && !formData.publisher) {
        handleChange('publisher', extractedInfo.publisher)
      }
      if (extractedInfo.pages && !formData.pages) {
        handleChange('pages', extractedInfo.pages)
      }
      if (extractedInfo.doi && !formData.doi) {
        handleChange('doi', extractedInfo.doi)
      }
      if (extractedInfo.journal_name && !formData.journal_name) {
        handleChange('journal_name', extractedInfo.journal_name)
      }
      // 引用種類は抽出結果を優先（デフォルトのwebsiteから上書き）
      if (extractedInfo.referenceType && (formData.reference_type === 'website' || !formData.reference_type)) {
        console.log('Setting reference type:', {
          from: formData.reference_type,
          to: extractedInfo.referenceType
        })
        handleChange('reference_type', extractedInfo.referenceType)
      }
      if (extractedInfo.volume && !formData.volume) {
        handleChange('volume', extractedInfo.volume)
      }
      if (extractedInfo.issue && !formData.issue) {
        handleChange('issue', extractedInfo.issue)
      }
      if (extractedInfo.isbn && !formData.isbn) {
        handleChange('isbn', extractedInfo.isbn)
      }

      // 著者情報の反映
      if (extractedInfo.authors && extractedInfo.authors.length > 0) {
        setAuthors(extractedInfo.authors.map((name, index) => ({
          name: typeof name === 'string' ? name : name.name || '',
          order: index + 1
        })))
      }
      
      toast.success('ページ情報を取得しました')
    } catch (error) {
      console.error('Failed to extract page info:', error)
      toast.error('ページ情報の取得に失敗しました')
    } finally {
      setIsExtracting(false)
    }
  }

  // URLからサイト名を抽出（著者情報がない場合のフォールバック）
  const extractSiteNameFromUrl = (url) => {
    try {
      const urlObj = new URL(url)
      const domain = urlObj.hostname.toLowerCase()
      
      // 既知のサイト名マッピング
      const siteNameMap = {
        'y-history.net': '世界史の窓',
        'www.y-history.net': '世界史の窓',
        'ibo.org': 'IBO',
        'www.ibo.org': 'IBO',
        'wikipedia.org': 'Wikipedia',
        'ja.wikipedia.org': 'Wikipedia',
        'en.wikipedia.org': 'Wikipedia',
        'github.com': 'GitHub',
        'stackoverflow.com': 'Stack Overflow',
        'qiita.com': 'Qiita',
        'zenn.dev': 'Zenn',
        'note.com': 'note',
        'hatenablog.com': 'はてなブログ',
        'ameblo.jp': 'アメブロ',
        'fc2.com': 'FC2ブログ',
        'livedoor.com': 'livedoor',
        'goo.ne.jp': 'goo',
        'yahoo.co.jp': 'Yahoo!',
        'google.com': 'Google',
        'microsoft.com': 'Microsoft',
        'apple.com': 'Apple',
        'amazon.co.jp': 'Amazon',
        'amazon.com': 'Amazon',
        'rakuten.co.jp': '楽天',
        'mercari.com': 'メルカリ',
        'paypay.ne.jp': 'PayPay',
        'line.me': 'LINE',
        'twitter.com': 'Twitter',
        'facebook.com': 'Facebook',
        'instagram.com': 'Instagram',
        'youtube.com': 'YouTube',
        'tiktok.com': 'TikTok',
        'linkedin.com': 'LinkedIn',
        'reddit.com': 'Reddit',
        'medium.com': 'Medium',
        'dev.to': 'DEV Community',
        'codepen.io': 'CodePen',
        'jsfiddle.net': 'JSFiddle',
        'repl.it': 'Replit',
        'codesandbox.io': 'CodeSandbox',
        'npmjs.com': 'npm',
        'pypi.org': 'PyPI',
        'rubygems.org': 'RubyGems',
        'packagist.org': 'Packagist',
        'crates.io': 'Crates.io',
        'nuget.org': 'NuGet',
        'maven.org': 'Maven Central',
        'gradle.org': 'Gradle',
        'docker.com': 'Docker Hub',
        'kubernetes.io': 'Kubernetes',
        'terraform.io': 'Terraform',
        'ansible.com': 'Ansible',
        'jenkins.io': 'Jenkins',
        'gitlab.com': 'GitLab',
        'bitbucket.org': 'Bitbucket',
        'atlassian.com': 'Atlassian',
        'slack.com': 'Slack',
        'discord.com': 'Discord',
        'zoom.us': 'Zoom',
        'teams.microsoft.com': 'Microsoft Teams',
        'meet.google.com': 'Google Meet',
        'webex.com': 'Webex',
        'dropbox.com': 'Dropbox',
        'drive.google.com': 'Google Drive',
        'onedrive.live.com': 'OneDrive',
        'icloud.com': 'iCloud',
        'box.com': 'Box',
        'mega.nz': 'MEGA',
        'wetransfer.com': 'WeTransfer',
        'sendspace.com': 'SendSpace',
        'mediafire.com': 'MediaFire',
        '4shared.com': '4shared',
        'rapidshare.com': 'RapidShare'
      }
      
      // 完全一致をチェック
      if (siteNameMap[domain]) {
        return siteNameMap[domain]
      }
      
      // 部分一致をチェック
      for (const [key, value] of Object.entries(siteNameMap)) {
        if (domain.includes(key)) {
          return value
        }
      }
      
      // ドメインから推測
      const parts = domain.split('.')
      if (parts.length >= 2) {
        const mainDomain = parts[parts.length - 2]
        
        // 一般的なTLDを除外
        const commonTlds = ['com', 'org', 'net', 'edu', 'gov', 'co', 'jp', 'uk', 'de', 'fr', 'it', 'es', 'ca', 'au', 'nz']
        if (!commonTlds.includes(mainDomain)) {
          return mainDomain.charAt(0).toUpperCase() + mainDomain.slice(1)
        }
        
        // サブドメインがある場合はそれを使用
        if (parts.length >= 3) {
          const subdomain = parts[parts.length - 3]
          return subdomain.charAt(0).toUpperCase() + subdomain.slice(1)
        }
      }
      
      // 最後の手段：ドメイン名をそのまま使用
      return domain.charAt(0).toUpperCase() + domain.slice(1)
    } catch {
      return 'Unknown Site'
    }
  }

  // PDF判定ヘルパー
  const checkIfPDF = async (url) => {
    try {
      const response = await fetch(url, { method: 'HEAD' })
      const contentType = response.headers.get('content-type')
      return contentType?.includes('application/pdf')
    } catch {
      return false
    }
  }

  // 高度なウェブページ情報抽出関数
  const extractWebPageInfo = async (url) => {
    const results = {
      title: '',
      description: '',
      publishedDate: '',
      authors: [],
      referenceType: '',
      publisher: '',
      pages: '',
      doi: '',
      journal_name: '',
      volume: '',
      issue: '',
      isbn: ''
    }

    // PDF判定
    const isPdf = url.toLowerCase().endsWith('.pdf') || await checkIfPDF(url)

    if (isPdf) {
      // PDF抽出機能を使用
      try {
        const { extractReferenceFromPDF } = await import('../../lib/pdfExtractor')
        const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY
        
        const pdfInfo = await extractReferenceFromPDF(url, geminiApiKey, (progress) => {
          console.log('PDF extraction progress:', progress)
        })

        results.title = pdfInfo.title || ''
        results.description = pdfInfo.description || ''
        results.authors = pdfInfo.authors || []
        results.publishedDate = pdfInfo.publishedDate || ''
        results.publisher = pdfInfo.publisher || ''
        results.pages = pdfInfo.pages || ''
        results.doi = pdfInfo.doi || ''
        results.journal_name = pdfInfo.journalName || ''
        results.referenceType = pdfInfo.referenceType || 'article' // PDF分析結果の引用種類
        results.volume = pdfInfo.volume || ''
        results.issue = pdfInfo.issue || ''
        results.isbn = pdfInfo.isbn || ''

        console.log('PDF extraction result:', {
          referenceType: results.referenceType,
          title: results.title,
          authors: results.authors
        })

        return results
      } catch (error) {
        console.error('PDF extraction failed:', error)
        toast.error('PDF情報の抽出に失敗しました')
      }
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

    // 著者情報がない場合はサイト名を使用
    if (!results.authors || results.authors.length === 0) {
      const siteName = extractSiteNameFromUrl(url)
      console.log(`No authors found, using site name: ${siteName}`)
      results.authors = [{ name: siteName, order: 1 }]
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
