import React, { useState, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { toast } from 'react-hot-toast'
import { usePageFocus } from '../hooks/usePageFocus'
import ConfirmDialog from '../components/common/ConfirmDialog'

export default function Candidates() {
  const { user } = useAuth()
  const [candidates, setCandidates] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [showConfirmDismissAll, setShowConfirmDismissAll] = useState(false)

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

      // 実際の記録漏れ候補データを取得
      try {
        const { data: candidatesData, error: candidatesError } = await supabase
          .from('browsing_history_candidates')
          .select('*')
          .eq('user_id', user.id)
          .eq('dismissed', false)
          .order('visited_at', { ascending: false })
          .limit(20)

        if (candidatesError) {
          console.warn('Candidates table not available:', candidatesError)
          // フォールバック: サンプルデータを表示
          const fallbackCandidates = [
            {
              id: 'fallback_1',
              url: 'https://scholar.google.com/scholar?q=climate+change+research',
              title: 'Climate Change Research - Google Scholar',
              visitedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
              favicon: 'https://scholar.google.com/favicon.ico',
              reason: '学術検索サイトへのアクセス',
              confidence: 0.9,
              isAcademic: true
            }
          ]
          setCandidates(fallbackCandidates)
        } else {
          // データ形式を統一
          const formattedCandidates = (candidatesData || []).map(candidate => ({
            id: candidate.id,
            url: candidate.url,
            title: candidate.title,
            visitedAt: candidate.visited_at,
            favicon: candidate.favicon,
            reason: candidate.suggested_reason,
            confidence: candidate.confidence_score,
            isAcademic: candidate.is_academic,
            visitCount: candidate.visit_count
          }))
          setCandidates(formattedCandidates)
        }
      } catch (tableError) {
        console.warn('Candidates table access failed:', tableError)
        // テーブルが存在しない場合のフォールバック
        const fallbackCandidates = [
          {
            id: 'fallback_1',
            url: 'https://scholar.google.com/scholar?q=climate+change+research',
            title: 'Climate Change Research - Google Scholar',
            visitedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            favicon: 'https://scholar.google.com/favicon.ico',
            reason: '学術検索サイトへのアクセス',
            confidence: 0.9,
            isAcademic: true
          }
        ]
        setCandidates(fallbackCandidates)
      }
    } catch (error) {
      console.error('Failed to load data:', error)
      setError('データの読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }, [user])

  // ページフォーカス時の不要なリロードを防ぐ
  usePageFocus(loadData, [user?.id], {
    enableFocusReload: false // フォーカス時のリロードは無効
  })

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
      // フォールバックデータの場合は直接UIから削除
      if (candidateId.startsWith('fallback_')) {
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
      // フォールバックデータのみの場合は直接UIから削除
      const hasRealCandidates = candidates.some(c => !c.id.startsWith('fallback_'))
      
      if (!hasRealCandidates) {
        setCandidates([])
        setShowConfirmDismissAll(false)
        toast.success('すべての候補を削除しました')
        return
      }

      // 実際のデータベースの候補を却下
      const realCandidateIds = candidates
        .filter(c => !c.id.startsWith('fallback_'))
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

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {candidates.length === 0 ? (
        <div className="card p-6">
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-green-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-secondary-900 dark:text-secondary-100">
              記録漏れはありません
            </h3>
            <p className="mt-1 text-sm text-secondary-500 dark:text-secondary-400">
              すべての重要な資料が保存されています
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {candidates.map((candidate) => (
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
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Chrome拡張機能がブラウザの履歴を分析し、学術サイトや研究に関連するページで未保存のものを候補として表示します。
              候補の信頼度が高いほど、研究に重要な資料である可能性があります。
            </p>
          </div>
        </div>
      </div>

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
                
                <div className="flex items-center space-x-4 text-sm">
                  <span className="text-secondary-500">
                    {format(new Date(candidate.visitedAt), 'MM/dd HH:mm', { locale: ja })} に訪問
                  </span>
                  
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getConfidenceColor(candidate.confidence)}`}>
                    信頼度: {getConfidenceText(candidate.confidence)}
                  </span>
                  
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
