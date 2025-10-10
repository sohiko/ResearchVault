/* eslint-disable no-undef */
import React, { useState, useCallback, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { usePageFocus } from '../hooks/usePageFocus'
import ConfirmDialog from '../components/common/ConfirmDialog'
import GeminiClient from '../lib/geminiClient'

export default function Candidates() {
  const { user } = useAuth()
  const [candidates, setCandidates] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [showConfirmDismissAll, setShowConfirmDismissAll] = useState(false)
  const [classifying, setClassifying] = useState(false)
  const [classificationProgress, setClassificationProgress] = useState({ processed: 0, total: 0 })
  const [subjectFilter, setSubjectFilter] = useState('')

  const loadData = useCallback(async () => {
    if (!user) {
      return
    }
    
    try {
      setLoading(true)
      
      // プロジェクトを取得（所有プロジェクトのみ簡略化）
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('id, name, color, icon')
        .eq('owner_id', user.id)
        .order('name')

      if (projectsError) {
        throw projectsError
      }

      setProjects(projectsData || [])

      // データベースから候補を読み込む
      try {
        const { data: candidatesData, error: candidatesError } = await supabase
          .from('browsing_history_candidates')
          .select('*')
          .eq('user_id', user.id)
          .eq('dismissed', false)
          .order('visited_at', { ascending: false })
          .limit(100)

        if (candidatesError) {
          throw candidatesError
        }

        if (candidatesData && candidatesData.length > 0) {
          const formattedCandidates = candidatesData.map(candidate => ({
            id: candidate.id,
            url: candidate.url,
            title: candidate.title,
            visitedAt: candidate.visited_at,
            favicon: candidate.favicon,
            reason: candidate.suggested_reason,
            confidence: candidate.confidence_score,
            isAcademic: candidate.is_academic,
            visitCount: candidate.visit_count,
            subject: candidate.subject,
            subject_confidence: candidate.subject_confidence,
            ai_classified: candidate.ai_classified,
            classification_result: candidate.classification_result
          }))
          setCandidates(formattedCandidates)
          console.log(`Loaded ${formattedCandidates.length} candidates from database`)
        } else {
          setCandidates([])
        }
      } catch (dbError) {
        console.error('Failed to load candidates from database:', dbError)
        setCandidates([])
      }
      
    } catch (error) {
      console.error('Failed to load data:', error)
      setError('データの読み込みに失敗しました')
      setCandidates([])
    } finally {
      setLoading(false)
    }
  }, [user])

  // ページフォーカス時の不要なリロードを防ぐ
  usePageFocus(loadData, [user?.id], {
    enableFocusReload: false // フォーカス時のリロードは無効
  })

  // 初回ロード時に候補が空なら自動的に履歴を分析
  useEffect(() => {
    const autoAnalyzeHistory = async () => {
      if (!user || loading || candidates.length > 0) {
        return
      }

      // 拡張機能が利用可能かチェック
      if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
        return
      }

      try {
        console.log('Auto-analyzing browsing history...')
        
        const response = await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage(
            { 
              action: 'analyzeHistory',
              data: {
                days: 30,
                limit: 50,
                threshold: 0.5,
                saveToDatabase: true
              }
            },
            (response) => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError)
              } else {
                resolve(response)
              }
            }
          )
          
          setTimeout(() => reject(new Error('タイムアウト')), 30000)
        })

        if (response && response.success && response.saved > 0) {
          console.log(`Auto-analyzed: ${response.saved} new candidates found`)
          await loadData()
        }
      } catch (error) {
        console.debug('Auto-analysis skipped:', error.message)
      }
    }

    autoAnalyzeHistory()
  }, [user, loading, candidates.length, loadData])

  const saveCandidate = async (candidate, projectId) => {
    try {
      setSaving(true)
      setError(null)

      const { error } = await supabase
        .from('references')
        .insert({
          title: candidate.title,
          url: candidate.url,
          favicon: candidate.favicon,
          project_id: projectId || null,
          saved_by: user.id,
          metadata: {
            source: 'candidate',
            confidence: candidate.confidence,
            reason: candidate.reason
          }
        })
        .select()
        .single()

      if (error) {
        throw error
      }

      // 候補から削除
      setCandidates(prev => prev.filter(c => c.id !== candidate.id))
      
      toast.success('参照を保存しました')
    } catch (error) {
      console.error('Failed to save candidate:', error)
      setError('保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const dismissCandidate = async (candidateId) => {
    try {
      // 拡張機能由来のデータまたはフォールバックデータの場合は直接UIから削除
      if (candidateId.startsWith('fallback_') || candidateId.startsWith('ext_')) {
        setCandidates(prev => prev.filter(c => c.id !== candidateId))
        toast.success('候補を削除しました')
        return
      }

      // データベースで候補を却下としてマーク
      const { error } = await supabase
        .from('browsing_history_candidates')
        .update({
          dismissed: true,
          dismissed_at: new Date().toISOString()
        })
        .eq('id', candidateId)
        .eq('user_id', user.id)

      if (error) {
        console.error('Failed to dismiss candidate:', error)
        toast.error('候補の削除に失敗しました')
        return
      }

      // UIから削除
      setCandidates(prev => prev.filter(c => c.id !== candidateId))
      toast.success('候補を削除しました')
    } catch (error) {
      console.error('Failed to dismiss candidate:', error)
      toast.error('候補の削除に失敗しました')
    }
  }

  const dismissAll = () => {
    setShowConfirmDismissAll(true)
  }

  const confirmDismissAll = async () => {
    try {
      // 拡張機能由来またはフォールバックデータのみの場合は直接UIから削除
      const hasRealCandidates = candidates.some(c => 
        !c.id.startsWith('fallback_') && !c.id.startsWith('ext_')
      )
      
      if (!hasRealCandidates) {
        setCandidates([])
        setShowConfirmDismissAll(false)
        toast.success('すべての候補を削除しました')
        return
      }

      // 実際のデータベースの候補を却下
      const realCandidateIds = candidates
        .filter(c => !c.id.startsWith('fallback_') && !c.id.startsWith('ext_'))
        .map(c => c.id)
      
      if (realCandidateIds.length > 0) {
        const { error } = await supabase
          .from('browsing_history_candidates')
          .update({
            dismissed: true,
            dismissed_at: new Date().toISOString()
          })
          .in('id', realCandidateIds)
          .eq('user_id', user.id)

        if (error) {
          console.error('Failed to dismiss all candidates:', error)
          toast.error('すべての候補の削除に失敗しました')
          return
        }
      }

      setCandidates([])
      setShowConfirmDismissAll(false)
      toast.success('すべての候補を削除しました')
    } catch (error) {
      console.error('Failed to dismiss all candidates:', error)
      toast.error('すべての候補の削除に失敗しました')
    }
  }

  const handleAnalyzeHistory = async () => {
    // 拡張機能から履歴を分析
    try {
      if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
        toast.error('拡張機能が利用できません。Chrome拡張機能をインストールしてください。')
        return
      }

      setLoading(true)
      toast.info('履歴を分析しています...')

      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          { 
            action: 'analyzeHistory',
            data: {
              days: 30,
              limit: 50,
              threshold: 0.5,
              saveToDatabase: true
            }
          },
          (response) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError)
            } else {
              resolve(response)
            }
          }
        )
        
        setTimeout(() => reject(new Error('タイムアウト')), 30000)
      })

      if (response && response.success) {
        toast.success(`${response.saved || 0}件の新しい候補を検出しました`)
        await loadData() // データをリロード
      } else {
        toast.error('履歴の分析に失敗しました: ' + (response.error || '不明なエラー'))
      }
    } catch (error) {
      console.error('Failed to analyze history:', error)
      toast.error('履歴の分析に失敗しました: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleClassifyCandidates = async () => {
    // 環境変数からGemini APIキーを取得
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY
    
    if (!apiKey) {
      toast.error('Gemini APIキーが設定されていません。GEMINI_SETUP.mdを参照してください。')
      return
    }

    // 未分類の候補のみを対象
    const unclassifiedCandidates = candidates.filter(c => !c.subject && !c.ai_classified)

    if (unclassifiedCandidates.length === 0) {
      toast.success('すべての候補はすでに分類済みです')
      return
    }

    // eslint-disable-next-line no-alert
    const confirmClassify = window.confirm(
      `${unclassifiedCandidates.length}件の候補を教科分類しますか？\n（Gemini APIを使用します）`
    )

    if (!confirmClassify) {
      return
    }

    try {
      setClassifying(true)
      setClassificationProgress({ processed: 0, total: unclassifiedCandidates.length })

      const geminiClient = new GeminiClient(apiKey)

      // バッチ分類
      const results = await geminiClient.classifyBatch(
        unclassifiedCandidates,
        (progress) => {
          setClassificationProgress(progress)
        }
      )

      // データベースに保存（拡張機能由来でないもののみ）
      let successCount = 0
      for (const result of results) {
        if (!result.success || !result.classification) {continue}

        const { reference: candidate, classification } = result

        // 拡張機能由来のデータはローカル状態のみ更新
        if (candidate.id.startsWith('ext_') || candidate.id.startsWith('fallback_')) {
          setCandidates(prev => prev.map(c => 
            c.id === candidate.id 
              ? { 
                  ...c, 
                  subject: classification.subject,
                  subject_confidence: classification.confidence,
                  ai_classified: true,
                  classification_result: classification
                }
              : c
          ))
          successCount++
          continue
        }

        // データベース候補を更新
        try {
          const { error } = await supabase
            .from('browsing_history_candidates')
            .update({
              subject: classification.subject,
              subject_confidence: classification.confidence,
              ai_classified: true,
              classification_result: classification,
              classified_at: new Date().toISOString()
            })
            .eq('id', candidate.id)
            .eq('user_id', user.id)

          if (error) {
            console.error('Failed to save classification:', error)
          } else {
            successCount++
          }
        } catch (error) {
          console.error('Failed to save classification for:', candidate.title, error)
        }
      }

      toast.success(`${successCount}件の候補を分類しました`)
      
      // データをリロード
      await loadData()
    } catch (error) {
      console.error('Classification failed:', error)
      toast.error('分類に失敗しました: ' + error.message)
    } finally {
      setClassifying(false)
      setClassificationProgress({ processed: 0, total: 0 })
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
        
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
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

  // 教科フィルター適用
  const filteredCandidates = subjectFilter 
    ? candidates.filter(c => c.subject === subjectFilter)
    : candidates

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900 dark:text-secondary-100">
            記録漏れ候補
          </h1>
          <p className="text-secondary-600 dark:text-secondary-400">
            保存し忘れている可能性がある研究資料を確認できます
          </p>
        </div>
        {candidates.length > 0 && (
          <button 
            onClick={dismissAll}
            className="btn-secondary"
          >
            すべて削除
          </button>
        )}
      </div>

      {/* ツールバー */}
      <div className="space-y-4">
        {/* 履歴分析ボタン */}
        <div className="card p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-secondary-900 dark:text-secondary-100 mb-1">
                履歴から候補を検出
              </h3>
              <p className="text-xs text-secondary-600 dark:text-secondary-400">
                ブラウジング履歴を分析して、学術サイトや研究資料の候補を検出します
              </p>
            </div>
            <button
              className="btn-primary flex items-center space-x-2"
              onClick={handleAnalyzeHistory}
              disabled={loading}
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>分析中...</span>
                </>
              ) : (
                <>
                  <span>履歴を分析</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* AI分類ツールバー */}
        <div className="card p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-secondary-900 dark:text-secondary-100 mb-1">
                教科分類（AI自動分類）
              </h3>
              <p className="text-xs text-secondary-600 dark:text-secondary-400">
                Gemini APIを使用して候補を教科ごとに自動分類します
              </p>
            </div>
            <div className="flex items-center space-x-3">
              {classifying && (
                <span className="text-sm text-secondary-600 dark:text-secondary-400">
                  {classificationProgress.processed} / {classificationProgress.total}
                </span>
              )}
              <button
                className="btn-primary flex items-center space-x-2"
                onClick={handleClassifyCandidates}
                disabled={classifying || candidates.length === 0}
              >
                {classifying ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>分類中...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                    <span>未分類の候補を教科分類</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* 教科フィルター */}
        <div className="card p-4">
          <div className="flex items-center space-x-4">
            <label className="text-sm font-medium text-secondary-700 dark:text-secondary-300">
              教科フィルター:
            </label>
            <select
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
            >
              <option value="">すべて表示</option>
              <option value="国語">国語</option>
              <option value="数学">数学</option>
              <option value="歴史">歴史</option>
              <option value="物理">物理</option>
              <option value="生物">生物</option>
              <option value="化学">化学</option>
              <option value="地理">地理</option>
              <option value="英語">英語</option>
              <option value="音楽">音楽</option>
              <option value="美術">美術</option>
              <option value="技術">技術</option>
              <option value="家庭科">家庭科</option>
              <option value="その他">その他</option>
            </select>
            {subjectFilter && (
              <span className="text-sm text-secondary-600 dark:text-secondary-400">
                {filteredCandidates.length}件の候補
              </span>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {filteredCandidates.length === 0 ? (
        <div className="card p-6">
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-green-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-secondary-900 dark:text-secondary-100">
              {subjectFilter ? `「${subjectFilter}」の候補はありません` : '記録漏れはありません'}
            </h3>
            <p className="mt-1 text-sm text-secondary-500 dark:text-secondary-400">
              {subjectFilter ? '別の教科を選択するか、フィルターをリセットしてください' : 'すべての重要な資料が保存されています'}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredCandidates.map((candidate) => (
            <CandidateCard
              key={candidate.id}
              candidate={candidate}
              projects={projects}
              onSave={saveCandidate}
              onDismiss={dismissCandidate}
              saving={saving}
            />
          ))}
        </div>
      )}

      {/* 説明カード */}
      <div className="card p-6 bg-blue-50 dark:bg-blue-900/20">
        <div className="flex items-start space-x-3">
          <svg className="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
              記録漏れ候補について
            </h4>
            <p className="text-sm text-blue-700 dark:text-blue-300 mb-2">
              Chrome拡張機能がブラウザの履歴を分析し、学術サイトや研究に関連するページで未保存のものを候補として表示します。
              候補の信頼度が高いほど、研究に重要な資料である可能性があります。
            </p>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              ※ この機能を使用するには、ResearchVault Chrome拡張機能がインストールされている必要があります。
              候補が表示されない場合は、ページをリロードしてください。
            </p>
          </div>
        </div>
      </div>
      
      {/* リロードボタン */}
      {!loading && candidates.length === 0 && (
        <div className="flex justify-center">
          <button
            onClick={loadData}
            className="btn-primary"
          >
            候補を再読み込み
          </button>
        </div>
      )}

      <ConfirmDialog
        isOpen={showConfirmDismissAll}
        onClose={() => setShowConfirmDismissAll(false)}
        onConfirm={confirmDismissAll}
        title="すべての候補を削除"
        message="すべての候補を削除しますか？この操作は取り消せません。"
        confirmText="削除"
        cancelText="キャンセル"
      />
    </div>
  )
}

function CandidateCard({ candidate, projects, onSave, onDismiss, saving }) {
  const [selectedProject, setSelectedProject] = useState('')

  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.9) {return 'bg-green-100 text-green-800'}
    if (confidence >= 0.7) {return 'bg-yellow-100 text-yellow-800'}
    return 'bg-red-100 text-red-800'
  }

  const getConfidenceText = (confidence) => {
    if (confidence >= 0.9) {return '高'}
    if (confidence >= 0.7) {return '中'}
    return '低'
  }

  return (
    <div className="card hover:shadow-lg transition-shadow duration-200">
      <div className="p-6">
        <div className="flex items-start space-x-4">
          {candidate.favicon && (
            <img 
              src={candidate.favicon} 
              alt="" 
              className="w-4 h-4 mt-1 flex-shrink-0"
              onError={(e) => { e.target.style.display = 'none' }}
            />
          )}
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h3 className="text-lg font-medium text-secondary-900 dark:text-secondary-100 mb-1">
                  {candidate.title}
                </h3>
                <p className="text-sm text-secondary-500 break-all mb-2">
                  {candidate.url}
                </p>
                
                <div className="flex items-center flex-wrap gap-2 text-sm">
                  <span className="text-secondary-500">
                    {format(new Date(candidate.visitedAt), 'MM/dd HH:mm', { locale: ja })} に訪問
                  </span>
                  
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getConfidenceColor(candidate.confidence)}`}>
                    信頼度: {getConfidenceText(candidate.confidence)}
                  </span>
                  
                  {candidate.subject && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200">
                      {candidate.ai_classified && '🤖 '}
                      {candidate.subject}
                    </span>
                  )}
                  
                  <span className="text-secondary-600">
                    {candidate.reason}
                  </span>
                </div>
              </div>
              
              <button
                onClick={() => onDismiss(candidate.id)}
                className="text-secondary-400 hover:text-secondary-600 ml-4"
                title="候補を削除"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex items-center space-x-3">
              <div className="flex-1">
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                >
                  <option value="">プロジェクトを選択（任意）</option>
                  {projects.map(project => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <button
                onClick={() => onSave(candidate, selectedProject)}
                disabled={saving}
                className="btn-primary"
              >
                {saving ? '保存中...' : '保存'}
              </button>
              
              <a
                href={candidate.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary"
              >
                確認
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

