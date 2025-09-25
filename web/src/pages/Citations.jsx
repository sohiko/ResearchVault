import React, { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'

export default function Citations() {
  const { user } = useAuth()
  const [projects, setProjects] = useState([])
  const [selectedProject, setSelectedProject] = useState('')
  const [references, setReferences] = useState([])
  const [selectedReferences, setSelectedReferences] = useState([])
  const [citationFormat, setCitationFormat] = useState('APA')
  const [generatedCitations, setGeneratedCitations] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (user) {
      loadData()
    }
  }, [user])

  useEffect(() => {
    if (selectedProject) {
      loadReferences()
    } else {
      setReferences([])
      setSelectedReferences([])
    }
  }, [selectedProject])

  const loadData = async () => {
    try {
      setLoading(true)
      
      // プロジェクトと設定を並行で取得
      const [projectsResult, settingsResult] = await Promise.all([
        supabase
          .from('projects')
          .select('id, name, color, icon')
          .or(`owner_id.eq.${user.id},project_members.user_id.eq.${user.id}`)
          .order('name'),
        supabase
          .from('citation_settings')
          .select('default_style')
          .eq('user_id', user.id)
          .single()
      ])

      if (projectsResult.error) {
        throw projectsResult.error
      }

      setProjects(projectsResult.data || [])
      
      // ユーザーのデフォルト引用形式を設定
      if (settingsResult.data?.default_style) {
        setCitationFormat(settingsResult.data.default_style)
      }
    } catch (error) {
      console.error('Failed to load data:', error)
      setError('データの読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const loadReferences = async () => {
    try {
      const { data, error } = await supabase
        .from('references')
        .select('id, title, url, favicon, metadata, saved_at')
        .eq('project_id', selectedProject)
        .eq('saved_by', user.id)
        .order('saved_at', { ascending: false })

      if (error) {
        throw error
      }

      setReferences(data || [])
    } catch (error) {
      console.error('Failed to load references:', error)
      setError('参照の読み込みに失敗しました')
    }
  }

  const toggleReferenceSelection = (referenceId) => {
    setSelectedReferences(prev => 
      prev.includes(referenceId)
        ? prev.filter(id => id !== referenceId)
        : [...prev, referenceId]
    )
  }

  const selectAllReferences = () => {
    setSelectedReferences(references.map(ref => ref.id))
  }

  const clearSelection = () => {
    setSelectedReferences([])
  }

  const generateCitations = async () => {
    if (selectedReferences.length === 0) {
      setError('引用を生成する参照を選択してください')
      return
    }

    try {
      setGenerating(true)
      setError(null)
      
      const selectedRefs = references.filter(ref => selectedReferences.includes(ref.id))
      const citations = []

      for (const reference of selectedRefs) {
        const citation = generateSingleCitation(reference, citationFormat)
        citations.push({
          referenceId: reference.id,
          title: reference.title,
          citation,
          format: citationFormat
        })
      }

      setGeneratedCitations(citations)
    } catch (error) {
      console.error('Failed to generate citations:', error)
      setError('引用の生成に失敗しました')
    } finally {
      setGenerating(false)
    }
  }

  const generateSingleCitation = (reference, format) => {
    const title = reference.title || 'タイトルなし'
    const url = reference.url
    const metadata = reference.metadata || {}
    const author = metadata.author || ''
    const siteName = metadata.siteName || new URL(url).hostname
    const publishedDate = metadata.publishedDate || ''
    const accessDate = format === 'ja' 
      ? format(new Date(), 'yyyy年MM月dd日', { locale: ja })
      : format(new Date(), 'MMMM d, yyyy')

    switch (format.toUpperCase()) {
      case 'APA':
        return generateAPACitation({ title, url, author, siteName, publishedDate, accessDate })
      case 'MLA':
        return generateMLACitation({ title, url, author, siteName, publishedDate, accessDate })
      case 'CHICAGO':
        return generateChicagoCitation({ title, url, author, siteName, publishedDate, accessDate })
      case 'HARVARD':
        return generateHarvardCitation({ title, url, author, siteName, publishedDate, accessDate })
      default:
        return generateAPACitation({ title, url, author, siteName, publishedDate, accessDate })
    }
  }

  const generateAPACitation = ({ title, url, author, siteName, publishedDate, accessDate }) => {
    let citation = ''
    
    if (author) {
      citation += `${author}. `
    }
    
    if (publishedDate) {
      const year = new Date(publishedDate).getFullYear()
      citation += `(${year}). `
    } else {
      citation += '(n.d.). '
    }
    
    citation += `${title}. `
    
    if (siteName) {
      citation += `${siteName}. `
    }
    
    citation += `Retrieved ${accessDate}, from ${url}`
    
    return citation
  }

  const generateMLACitation = ({ title, url, author, siteName, publishedDate, accessDate }) => {
    let citation = ''
    
    if (author) {
      citation += `${author}. `
    }
    
    citation += `"${title}." `
    
    if (siteName) {
      citation += `${siteName}, `
    }
    
    if (publishedDate) {
      citation += `${format(new Date(publishedDate), 'd MMM yyyy')}, `
    }
    
    citation += `${url}. Accessed ${accessDate}.`
    
    return citation
  }

  const generateChicagoCitation = ({ title, url, author, siteName, publishedDate, accessDate }) => {
    let citation = ''
    
    if (author) {
      citation += `${author}. `
    }
    
    citation += `"${title}." `
    
    if (siteName) {
      citation += `${siteName}. `
    }
    
    if (publishedDate) {
      citation += `${format(new Date(publishedDate), 'MMMM d, yyyy')}. `
    }
    
    citation += `${url} (accessed ${accessDate}).`
    
    return citation
  }

  const generateHarvardCitation = ({ title, url, author, siteName, publishedDate, accessDate }) => {
    let citation = ''
    
    if (author) {
      citation += `${author} `
    }
    
    if (publishedDate) {
      const year = new Date(publishedDate).getFullYear()
      citation += `${year}, `
    } else {
      citation += 'n.d., '
    }
    
    citation += `${title}, `
    
    if (siteName) {
      citation += `${siteName}, `
    }
    
    citation += `viewed ${accessDate}, <${url}>.`
    
    return citation
  }

  const copyAllCitations = async () => {
    const allCitations = generatedCitations.map(item => item.citation).join('\n\n')
    try {
      await navigator.clipboard.writeText(allCitations)
      alert('すべての引用をクリップボードにコピーしました')
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const copyCitation = async (citation) => {
    try {
      await navigator.clipboard.writeText(citation)
      alert('引用をクリップボードにコピーしました')
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const exportCitations = () => {
    const content = generatedCitations.map(item => 
      `${item.title}\n${item.citation}\n`
    ).join('\n')
    
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `citations_${citationFormat}_${format(new Date(), 'yyyyMMdd')}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="card p-6">
              <div className="animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
                <div className="space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-full"></div>
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-secondary-900 dark:text-secondary-100">
          引用生成
        </h1>
        <p className="text-secondary-600 dark:text-secondary-400">
          参照から引用を自動生成します
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 引用設定・参照選択 */}
        <div className="space-y-6">
          {/* 引用形式選択 */}
          <div className="card">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-secondary-900 dark:text-secondary-100">
                引用設定
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
                  引用形式
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  value={citationFormat}
                  onChange={(e) => setCitationFormat(e.target.value)}
                >
                  <option value="APA">APA 7th Edition</option>
                  <option value="MLA">MLA 9th Edition</option>
                  <option value="Chicago">Chicago 17th Edition</option>
                  <option value="Harvard">Harvard</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
                  プロジェクト
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                >
                  <option value="">プロジェクトを選択</option>
                  {projects.map(project => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 参照選択 */}
          {selectedProject && (
            <div className="card">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-secondary-900 dark:text-secondary-100">
                    参照選択
                  </h3>
                  <div className="flex space-x-2">
                    <button
                      onClick={selectAllReferences}
                      className="text-sm text-primary-600 hover:text-primary-700"
                    >
                      すべて選択
                    </button>
                    <button
                      onClick={clearSelection}
                      className="text-sm text-secondary-500 hover:text-secondary-600"
                    >
                      クリア
                    </button>
                  </div>
                </div>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {references.length > 0 ? (
                  references.map((reference) => (
                    <div
                      key={reference.id}
                      className="px-6 py-3 border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                    >
                      <label className="flex items-start space-x-3 cursor-pointer">
                        <input
                          type="checkbox"
                          className="mt-1 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                          checked={selectedReferences.includes(reference.id)}
                          onChange={() => toggleReferenceSelection(reference.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            {reference.favicon && (
                              <img 
                                src={reference.favicon} 
                                alt="" 
                                className="w-4 h-4 flex-shrink-0"
                                onError={(e) => { e.target.style.display = 'none' }}
                              />
                            )}
                            <p className="text-sm font-medium text-secondary-900 dark:text-secondary-100 truncate">
                              {reference.title}
                            </p>
                          </div>
                          <p className="text-xs text-secondary-500 truncate mt-1">
                            {reference.url}
                          </p>
                        </div>
                      </label>
                    </div>
                  ))
                ) : (
                  <div className="px-6 py-8 text-center">
                    <p className="text-sm text-secondary-500">
                      このプロジェクトには参照がありません
                    </p>
                  </div>
                )}
              </div>
              {references.length > 0 && (
                <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={generateCitations}
                    disabled={selectedReferences.length === 0 || generating}
                    className="w-full btn-primary"
                  >
                    {generating ? '生成中...' : `引用を生成 (${selectedReferences.length}件)`}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 生成された引用 */}
        <div className="card">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-secondary-900 dark:text-secondary-100">
                生成された引用 ({citationFormat})
              </h3>
              {generatedCitations.length > 0 && (
                <div className="flex space-x-2">
                  <button
                    onClick={copyAllCitations}
                    className="text-sm text-primary-600 hover:text-primary-700"
                  >
                    すべてコピー
                  </button>
                  <button
                    onClick={exportCitations}
                    className="text-sm text-secondary-500 hover:text-secondary-600"
                  >
                    エクスポート
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {generatedCitations.length > 0 ? (
              generatedCitations.map((item) => (
                <div
                  key={item.referenceId}
                  className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-secondary-900 dark:text-secondary-100 mb-2">
                        {item.title}
                      </p>
                      <p className="text-sm text-secondary-600 dark:text-secondary-400 leading-relaxed">
                        {item.citation}
                      </p>
                    </div>
                    <button
                      onClick={() => copyCitation(item.citation)}
                      className="ml-3 text-secondary-400 hover:text-primary-500 transition-colors"
                      title="引用をコピー"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-6 py-12 text-center">
                <svg className="mx-auto h-12 w-12 text-secondary-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <h3 className="text-sm font-medium text-secondary-900 dark:text-secondary-100 mb-2">
                  引用がありません
                </h3>
                <p className="text-sm text-secondary-500">
                  プロジェクトを選択して参照を選び、引用を生成してください
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
