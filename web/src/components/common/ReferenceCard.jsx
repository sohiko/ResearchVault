import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { toast } from 'react-hot-toast'
import { generateCitation } from '../../utils/citationGenerator'
import EditReferenceModal from './EditReferenceModal'

const ReferenceCard = ({ reference, onDelete, onUpdate, citationFormat = 'APA' }) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [showActions, setShowActions] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)

  const truncateText = (text, maxLength = 150) => {
    if (!text || text.length <= maxLength) {return text}
    return text.substring(0, maxLength) + '...'
  }

  const getDomainFromUrl = (url) => {
    try {
      return new URL(url).hostname
    } catch {
      return url
    }
  }

  const formatDate = (dateString) => {
    try {
      return format(new Date(dateString), 'yyyy年MM月dd日', { locale: ja })
    } catch {
      return '日付不明'
    }
  }

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(reference.url)
      toast.success('URLをコピーしました')
    } catch (error) {
      console.error('Failed to copy URL:', error)
      toast.error('URLのコピーに失敗しました')
    }
  }

  const handleCopyCitation = async () => {
    try {
      const citation = generateCitation(reference, citationFormat)
      await navigator.clipboard.writeText(citation)
      toast.success('引用をコピーしました')
    } catch (error) {
      console.error('Failed to copy citation:', error)
      toast.error('引用のコピーに失敗しました')
    }
  }

  const handleOpenUrl = () => {
    window.open(reference.url, '_blank', 'noopener,noreferrer')
  }

  const handleEdit = () => {
    setShowEditModal(true)
    setShowActions(false)
  }

  const handleUpdateReference = async (updatedReference) => {
    if (onUpdate) {
      await onUpdate(updatedReference)
    }
  }

  return (
    <div className="card hover:shadow-md transition-shadow duration-200">
      <div className="p-4">
        {/* ヘッダー部分 */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {reference.favicon && (
                <img
                  src={reference.favicon}
                  alt=""
                  className="w-4 h-4 flex-shrink-0"
                  onError={(e) => {
                    e.target.style.display = 'none'
                  }}
                />
              )}
              <span className="text-sm text-gray-500 truncate">
                {getDomainFromUrl(reference.url)}
              </span>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1 line-clamp-2">
              <Link
                to={`/references/${reference.id}`}
                className="hover:text-primary-600 transition-colors"
              >
                {reference.title}
              </Link>
            </h3>
          </div>
          
          <div className="relative ml-2">
            <button
              onClick={() => setShowActions(!showActions)}
              className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
              </svg>
            </button>
            
            {showActions && (
              <div className="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-10">
                <div className="py-1">
                  <button
                    onClick={handleOpenUrl}
                    className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    サイトを開く
                  </button>
                  <button
                    onClick={handleCopyUrl}
                    className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    URLをコピー
                  </button>
                  <button
                    onClick={handleCopyCitation}
                    className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    引用をコピー ({citationFormat})
                  </button>
                  {onUpdate && (
                    <button
                      onClick={handleEdit}
                      className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      編集
                    </button>
                  )}
                  {onDelete && (
                    <button
                      onClick={() => onDelete(reference.id)}
                      className="flex items-center px-4 py-2 text-sm text-red-700 hover:bg-red-50 w-full text-left"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      削除
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 説明文 */}
        {reference.description && (
          <div className="mb-3">
            <p className="text-gray-600 text-sm">
              {isExpanded ? reference.description : truncateText(reference.description)}
              {reference.description.length > 150 && (
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="ml-1 text-primary-600 hover:text-primary-700 text-sm font-medium"
                >
                  {isExpanded ? '折りたたむ' : '続きを読む'}
                </button>
              )}
            </p>
          </div>
        )}

        {/* タグ */}
        {reference.tags && reference.tags.length > 0 && (
          <div className="mb-3">
            <div className="flex flex-wrap gap-1">
              {reference.tags.slice(0, 5).map((tag, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                  style={{
                    backgroundColor: tag.color ? `${tag.color}20` : '#F3F4F6',
                    color: tag.color || '#6B7280'
                  }}
                >
                  {tag.name}
                </span>
              ))}
              {reference.tags.length > 5 && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                  +{reference.tags.length - 5}
                </span>
              )}
            </div>
          </div>
        )}

        {/* メタデータ */}
        {reference.metadata && (
          <div className="mb-3 space-y-1">
            {reference.metadata.author && (
              <div className="text-sm text-gray-600">
                <span className="font-medium">著者:</span> {reference.metadata.author}
              </div>
            )}
            {reference.metadata.publishedDate && (
              <div className="text-sm text-gray-600">
                <span className="font-medium">公開日:</span> {formatDate(reference.metadata.publishedDate)}
              </div>
            )}
            {reference.metadata.siteName && (
              <div className="text-sm text-gray-600">
                <span className="font-medium">サイト:</span> {reference.metadata.siteName}
              </div>
            )}
          </div>
        )}

        {/* フッター */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span>保存: {formatDate(reference.saved_at)}</span>
            {reference.textCount > 0 && (
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {reference.textCount}
              </span>
            )}
            {reference.bookmarkCount > 0 && (
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
                {reference.bookmarkCount}
              </span>
            )}
          </div>
          
          <Link
            to={`/references/${reference.id}`}
            className="text-primary-600 hover:text-primary-700 text-sm font-medium"
          >
            詳細を見る
          </Link>
        </div>
      </div>

      {/* クリック時のアクション領域を閉じる */}
      {showActions && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setShowActions(false)}
        />
      )}

      {/* 編集モーダル */}
      {showEditModal && (
        <EditReferenceModal
          reference={reference}
          onClose={() => setShowEditModal(false)}
          onUpdate={handleUpdateReference}
        />
      )}
    </div>
  )
}

export default ReferenceCard
