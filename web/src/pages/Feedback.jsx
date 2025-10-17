import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { toast } from 'react-hot-toast'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import ConfirmDialog from '../components/common/ConfirmDialog'

export default function Feedback() {
  const { user } = useAuth()
  const [feedbacks, setFeedbacks] = useState([])
  const [showSubmitForm, setShowSubmitForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [sortOrder, setSortOrder] = useState('newest') // 'newest', 'oldest'
  const [typeFilter, setTypeFilter] = useState('') // '', 'feature', 'bug', 'improvement'
  const [editingFeedback, setEditingFeedback] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [feedbackToDelete, setFeedbackToDelete] = useState(null)

  const loadFeedbacks = useCallback(async () => {
    if (!user) {return}
    try {
      setLoading(true)
      setError(null)
      
      // ユーザーが管理者かチェック
      const { data: profileData } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single()
      
      const userIsAdmin = profileData?.is_admin || false
      setIsAdmin(userIsAdmin)
      
      // フィードバックを取得
      let query = supabase
        .from('feature_requests')
        .select(`
          *,
          profiles (name, email)
        `)
        .is('deleted_at', null)
      
      // 管理者でない場合は自分の投稿のみ
      if (!userIsAdmin) {
        query = query.eq('user_id', user.id)
      }
      
      // ソート
      if (sortOrder === 'newest') {
        query = query.order('created_at', { ascending: false })
      } else {
        query = query.order('created_at', { ascending: true })
      }
      
      const { data, error: fetchError } = await query
      
      if (fetchError) throw fetchError
      
      setFeedbacks(data || [])
    } catch (error) {
      console.error('Failed to load feedbacks:', error)
      setError('フィードバックの読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }, [user, sortOrder])

  useEffect(() => {
    if (user) {
      loadFeedbacks()
    }
  }, [user, loadFeedbacks])

  const submitFeedback = async (feedbackData) => {
    try {
      setSubmitting(true)
      setError(null)

      if (editingFeedback) {
        // 編集
        const { error: updateError } = await supabase
          .from('feature_requests')
          .update({
            title: feedbackData.title,
            type: feedbackData.type,
            description: feedbackData.description,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingFeedback.id)
          .eq('user_id', user.id)
        
        if (updateError) throw updateError
        toast.success('フィードバックを更新しました')
      } else {
        // 新規作成
        const { error: insertError } = await supabase
          .from('feature_requests')
          .insert([{
            user_id: user.id,
            title: feedbackData.title,
            type: feedbackData.type,
            description: feedbackData.description
          }])
        
        if (insertError) throw insertError
        toast.success('フィードバックを送信しました。ご協力ありがとうございます！')
      }

      setShowSubmitForm(false)
      setEditingFeedback(null)
      await loadFeedbacks()
    } catch (error) {
      console.error('Failed to submit feedback:', error)
      setError('フィードバックの送信に失敗しました')
      toast.error('フィードバックの送信に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = (feedback) => {
    setEditingFeedback(feedback)
    setShowSubmitForm(true)
  }

  const handleDelete = (feedback) => {
    setFeedbackToDelete(feedback)
    setShowDeleteConfirm(true)
  }

  const confirmDelete = async () => {
    try {
      const { error } = await supabase
        .from('feature_requests')
        .update({
          deleted_at: new Date().toISOString()
        })
        .eq('id', feedbackToDelete.id)
        .eq('user_id', user.id)
      
      if (error) throw error
      
      toast.success('フィードバックを削除しました')
      await loadFeedbacks()
    } catch (error) {
      console.error('Failed to delete feedback:', error)
      toast.error('削除に失敗しました')
    } finally {
      setShowDeleteConfirm(false)
      setFeedbackToDelete(null)
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

  // タイプフィルター適用
  const filteredFeedbacks = typeFilter
    ? feedbacks.filter(f => f.type === typeFilter)
    : feedbacks

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900 dark:text-secondary-100">
            機能リクエスト
          </h1>
          <p className="text-secondary-600 dark:text-secondary-400">
            {isAdmin ? '管理者表示中：全ユーザーのリクエストを表示しています' : '新機能の提案やバグ報告を行えます'}
          </p>
        </div>
        <button 
          onClick={() => {
            setEditingFeedback(null)
            setShowSubmitForm(true)
          }}
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

      {/* フィルターとソート */}
      {isAdmin && (
        <div className="card p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {/* タイプフィルター */}
            <div className="flex items-center space-x-2 flex-1">
              <span className="text-sm font-medium text-secondary-700 dark:text-secondary-300 whitespace-nowrap">
                タイプ:
              </span>
              <div className="flex gap-2">
                <button 
                  onClick={() => setTypeFilter('')}
                  className={`px-3 py-1 text-sm rounded-full ${typeFilter === '' ? 'bg-primary-100 text-primary-800' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  すべて
                </button>
                <button 
                  onClick={() => setTypeFilter('feature')}
                  className={`px-3 py-1 text-sm rounded-full ${typeFilter === 'feature' ? 'bg-primary-100 text-primary-800' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  機能要望
                </button>
                <button 
                  onClick={() => setTypeFilter('bug')}
                  className={`px-3 py-1 text-sm rounded-full ${typeFilter === 'bug' ? 'bg-primary-100 text-primary-800' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  バグ報告
                </button>
                <button 
                  onClick={() => setTypeFilter('improvement')}
                  className={`px-3 py-1 text-sm rounded-full ${typeFilter === 'improvement' ? 'bg-primary-100 text-primary-800' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  改善提案
                </button>
              </div>
            </div>
            
            {/* 並び順 */}
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-secondary-700 dark:text-secondary-300 whitespace-nowrap">
                並び順:
              </span>
              <select 
                className="text-sm border border-gray-300 rounded-lg px-3 py-1 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
              >
                <option value="newest">新しい順</option>
                <option value="oldest">古い順</option>
              </select>
            </div>
          </div>
        </div>
      )}
      
      {!isAdmin && (
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-secondary-600 dark:text-secondary-400">
              あなたの投稿履歴
            </span>
            <select 
              className="text-sm border border-gray-300 rounded-lg px-3 py-1 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            >
              <option value="newest">新しい順</option>
              <option value="oldest">古い順</option>
            </select>
          </div>
        </div>
      )}

      {filteredFeedbacks.length === 0 ? (
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
          {filteredFeedbacks.map((feedback) => (
            <FeedbackCard
              key={feedback.id}
              feedback={feedback}
              currentUser={user}
              isAdmin={isAdmin}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={confirmDelete}
        title="フィードバックを削除"
        message="このフィードバックを削除しますか？この操作は取り消せません。"
        confirmText="削除"
        cancelText="キャンセル"
      />

      {showSubmitForm && (
        <SubmitFeedbackModal
          onClose={() => {
            setShowSubmitForm(false)
            setEditingFeedback(null)
          }}
          onSubmit={submitFeedback}
          submitting={submitting}
          editingFeedback={editingFeedback}
        />
      )}
    </div>
  )
}

function FeedbackCard({ feedback, currentUser, isAdmin, onEdit, onDelete }) {

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

  const canEdit = feedback.user_id === currentUser?.id
  const showAuthor = isAdmin

  return (
    <div className="card hover:shadow-lg transition-shadow duration-200">
      <div className="p-6">
        <div className="flex items-start space-x-4">
          <div className="text-secondary-600 mt-1">
            {getTypeIcon(feedback.type)}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h3 className="text-lg font-medium text-secondary-900 dark:text-secondary-100 mb-2">
                  {feedback.title}
                </h3>
                
                <p className="text-sm text-secondary-600 dark:text-secondary-400 mb-3 whitespace-pre-wrap">
                  {feedback.description}
                </p>
                
                <div className="flex items-center space-x-4 text-xs text-secondary-500">
                  <span className={`px-2 py-1 rounded-full ${
                    feedback.type === 'feature' ? 'bg-blue-100 text-blue-800' :
                    feedback.type === 'bug' ? 'bg-red-100 text-red-800' :
                    'bg-purple-100 text-purple-800'
                  }`}>
                    {feedback.type === 'feature' ? '機能要望' :
                     feedback.type === 'bug' ? 'バグ報告' : '改善提案'}
                  </span>
                  <span>
                    {format(new Date(feedback.created_at), 'yyyy/MM/dd HH:mm', { locale: ja })}
                  </span>
                  {showAuthor && feedback.profiles && (
                    <span className="text-primary-600">
                      投稿者: {feedback.profiles.name || feedback.profiles.email}
                    </span>
                  )}
                </div>
              </div>
              
              {canEdit && (
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => onEdit(feedback)}
                    className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded"
                  >
                    編集
                  </button>
                  <button
                    onClick={() => onDelete(feedback)}
                    className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
                  >
                    削除
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function SubmitFeedbackModal({ onClose, onSubmit, submitting, editingFeedback }) {
  const [formData, setFormData] = useState({
    title: editingFeedback?.title || '',
    type: editingFeedback?.type || 'feature',
    description: editingFeedback?.description || ''
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (formData.title.trim() && formData.description.trim()) {
      onSubmit(formData)
    }
  }

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
    >
      <div className="bg-white dark:bg-secondary-800 rounded-lg max-w-md w-full">
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-secondary-900 dark:text-secondary-100">
                {editingFeedback ? 'リクエストを編集' : '新しいリクエスト'}
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
