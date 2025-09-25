import React, { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
// import { supabase } from '../lib/supabase' // 未使用のためコメントアウト
import { toast } from 'react-hot-toast'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'

export default function Feedback() {
  const { user } = useAuth()
  const [feedbacks, setFeedbacks] = useState([])
  const [showSubmitForm, setShowSubmitForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (user) {
      loadFeedbacks()
    }
  }, [user])

  const loadFeedbacks = async () => {
    try {
      setLoading(true)
      
      // 模擬的なフィードバックデータ
      const mockFeedbacks = [
        {
          id: 'feedback_1',
          title: 'タグ機能の改善',
          type: 'feature',
          description: '参照にカラータグを付けられるようにしてほしい',
          status: 'under_review',
          votes: 12,
          submittedBy: user.id,
          submittedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          userVoted: true
        },
        {
          id: 'feedback_2',
          title: 'エクスポート機能',
          type: 'feature',
          description: '参照データをCSV形式でエクスポートできるようにしてほしい',
          status: 'planned',
          votes: 8,
          submittedBy: 'other_user',
          submittedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          userVoted: false
        },
        {
          id: 'feedback_3',
          title: 'ダークモードでの表示バグ',
          type: 'bug',
          description: 'ダークモードで一部のテキストが見えにくい',
          status: 'completed',
          votes: 15,
          submittedBy: 'other_user',
          submittedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          userVoted: true
        }
      ]

      setFeedbacks(mockFeedbacks)
    } catch (error) {
      console.error('Failed to load feedbacks:', error)
      setError('フィードバックの読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const submitFeedback = async (feedbackData) => {
    try {
      setSubmitting(true)
      setError(null)

      // 実際のアプリケーションではフィードバックテーブルに保存
      const newFeedback = {
        id: `feedback_${Date.now()}`,
        ...feedbackData,
        submittedBy: user.id,
        submittedAt: new Date().toISOString(),
        status: 'pending',
        votes: 0,
        userVoted: false
      }

      setFeedbacks(prev => [newFeedback, ...prev])
      setShowSubmitForm(false)
      
      toast.success('フィードバックを送信しました。ご協力ありがとうございます！')
    } catch (error) {
      console.error('Failed to submit feedback:', error)
      setError('フィードバックの送信に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  const toggleVote = (feedbackId) => {
    setFeedbacks(prev => prev.map(feedback => {
      if (feedback.id === feedbackId) {
        const userVoted = !feedback.userVoted
        const votes = userVoted ? feedback.votes + 1 : feedback.votes - 1
        return { ...feedback, userVoted, votes }
      }
      return feedback
    }))
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
            機能リクエスト
          </h1>
          <p className="text-secondary-600 dark:text-secondary-400">
            新機能の提案やバグ報告を行えます
          </p>
        </div>
        <button 
          onClick={() => setShowSubmitForm(true)}
          className="btn-primary"
        >
          新しいリクエスト
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {/* フィルター */}
      <div className="card p-4">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-secondary-700 dark:text-secondary-300">
              フィルター:
            </span>
            <button className="px-3 py-1 text-sm rounded-full bg-primary-100 text-primary-800">
              すべて
            </button>
            <button className="px-3 py-1 text-sm rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200">
              機能要望
            </button>
            <button className="px-3 py-1 text-sm rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200">
              バグ報告
            </button>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-secondary-700 dark:text-secondary-300">
              並び順:
            </span>
            <select className="text-sm border border-gray-300 rounded-lg px-3 py-1 focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
              <option>人気順</option>
              <option>新着順</option>
              <option>古い順</option>
            </select>
          </div>
        </div>
      </div>

      {feedbacks.length === 0 ? (
        <div className="card p-6">
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-secondary-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-secondary-900 dark:text-secondary-100">
              リクエストがありません
            </h3>
            <p className="mt-1 text-sm text-secondary-500 dark:text-secondary-400">
              新しい機能リクエストを送信してください
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {feedbacks.map((feedback) => (
            <FeedbackCard
              key={feedback.id}
              feedback={feedback}
              onToggleVote={toggleVote}
            />
          ))}
        </div>
      )}

      {showSubmitForm && (
        <SubmitFeedbackModal
          onClose={() => setShowSubmitForm(false)}
          onSubmit={submitFeedback}
          submitting={submitting}
        />
      )}
    </div>
  )
}

function FeedbackCard({ feedback, onToggleVote }) {
  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'under_review':
        return 'bg-blue-100 text-blue-800'
      case 'planned':
        return 'bg-purple-100 text-purple-800'
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'rejected':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusText = (status) => {
    switch (status) {
      case 'pending':
        return '審査中'
      case 'under_review':
        return '検討中'
      case 'planned':
        return '実装予定'
      case 'completed':
        return '完了'
      case 'rejected':
        return '却下'
      default:
        return status
    }
  }

  const getTypeIcon = (type) => {
    switch (type) {
      case 'feature':
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        )
      case 'bug':
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      default:
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
    }
  }

  return (
    <div className="card hover:shadow-lg transition-shadow duration-200">
      <div className="p-6">
        <div className="flex items-start space-x-4">
          <button
            onClick={() => onToggleVote(feedback.id)}
            className={`flex flex-col items-center p-2 rounded-lg transition-colors ${
              feedback.userVoted 
                ? 'bg-primary-50 text-primary-600' 
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
          >
            <svg className="w-5 h-5 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
            <span className="text-sm font-medium">{feedback.votes}</span>
          </button>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <div className="text-secondary-600">
                    {getTypeIcon(feedback.type)}
                  </div>
                  <h3 className="text-lg font-medium text-secondary-900 dark:text-secondary-100">
                    {feedback.title}
                  </h3>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(feedback.status)}`}>
                    {getStatusText(feedback.status)}
                  </span>
                </div>
                
                <p className="text-sm text-secondary-600 dark:text-secondary-400 mb-3">
                  {feedback.description}
                </p>
                
                <div className="flex items-center space-x-4 text-xs text-secondary-500">
                  <span>
                    {format(new Date(feedback.submittedAt), 'yyyy/MM/dd', { locale: ja })} に投稿
                  </span>
                  {feedback.submittedBy === feedback.submittedBy && (
                    <span className="text-primary-600">自分の投稿</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function SubmitFeedbackModal({ onClose, onSubmit, submitting }) {
  const [formData, setFormData] = useState({
    title: '',
    type: 'feature',
    description: ''
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (formData.title.trim() && formData.description.trim()) {
      onSubmit(formData)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-secondary-800 rounded-lg max-w-md w-full">
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-secondary-900 dark:text-secondary-100">
                新しいリクエスト
              </h3>
              <button
                type="button"
                onClick={onClose}
                className="text-secondary-400 hover:text-secondary-600"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div className="px-6 py-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
                タイプ
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              >
                <option value="feature">機能要望</option>
                <option value="bug">バグ報告</option>
                <option value="improvement">改善提案</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
                タイトル *
              </label>
              <input
                type="text"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="リクエストのタイトルを入力..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
                詳細 *
              </label>
              <textarea
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                rows={4}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="詳細な説明を入力してください..."
              />
            </div>
          </div>

          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 btn-secondary"
              disabled={submitting}
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="flex-1 btn-primary"
              disabled={submitting || !formData.title.trim() || !formData.description.trim()}
            >
              {submitting ? '送信中...' : '送信'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
