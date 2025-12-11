import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef
} from 'react'
import { toast } from 'react-hot-toast'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { extractReferenceFromPDF } from '../lib/pdfExtractor'

const ReferenceFetchQueueContext = createContext(null)

const initialState = {
  tasks: []
}

const TASK_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  SUCCESS: 'success',
  ERROR: 'error'
}

function queueReducer(state, action) {
  switch (action.type) {
    case 'ENQUEUE':
      return {
        ...state,
        tasks: [...state.tasks, action.payload]
      }
    case 'START':
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === action.id
            ? {
              ...task,
              status: TASK_STATUS.PROCESSING,
              startedAt: Date.now(),
              statusMessage: '情報取得を開始しました'
            }
            : task
        )
      }
    case 'UPDATE':
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === action.id
            ? { ...task, ...action.payload }
            : task
        )
      }
    case 'SUCCESS':
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === action.id
            ? {
              ...task,
              status: TASK_STATUS.SUCCESS,
              finishedAt: Date.now(),
              reference: action.reference,
              statusMessage: '参照を追加しました'
            }
            : task
        )
      }
    case 'FAIL':
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === action.id
            ? {
              ...task,
              status: TASK_STATUS.ERROR,
              finishedAt: Date.now(),
              error: action.error,
              statusMessage: action.error || 'エラーが発生しました'
            }
            : task
        )
      }
    case 'DISMISS':
      return {
        ...state,
        tasks: state.tasks.filter((task) => task.id !== action.id)
      }
    default:
      return state
  }
}

export const ReferenceFetchQueueProvider = ({ children }) => {
  const [state, dispatch] = useReducer(queueReducer, initialState)
  const processingRef = useRef(false)
  const { user } = useAuth()
  const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY

  const enqueueFetch = useCallback((payload) => {
    if (!payload?.url) {
      throw new Error('URLは必須です')
    }

    const id = generateTaskId()
    const normalizedPayload = {
      id,
      status: TASK_STATUS.PENDING,
      createdAt: Date.now(),
      url: payload.url,
      projectId: payload.projectId || null,
      tags: payload.tags || [],
      manualFields: payload.manualFields || {},
      note: payload.note || '',
      source: payload.source || 'manual'
    }

    dispatch({ type: 'ENQUEUE', payload: normalizedPayload })
    toast.success('参照取得をキューに追加しました')
    return id
  }, [])

  const dismissTask = useCallback((taskId) => {
    dispatch({ type: 'DISMISS', id: taskId })
  }, [])

  const processTask = useCallback(
    async (task) => {
      if (!user) {
        throw new Error('認証情報が見つかりません')
      }

      dispatch({ type: 'START', id: task.id })

      try {
        dispatch({
          type: 'UPDATE',
          id: task.id,
          payload: { statusMessage: 'リンク種別を判定しています...' }
        })

        const referenceInfo = await fetchReferenceInfo(task.url)

        let extractedData = referenceInfo.metadata || {}

        if (referenceInfo.isPdf) {
          if (!geminiApiKey) {
            throw new Error('Gemini APIキーが設定されていません')
          }

          dispatch({
            type: 'UPDATE',
            id: task.id,
            payload: { statusMessage: 'PDFを解析しています (Gemini)...' }
          })

          try {
            extractedData = await extractReferenceFromPDF(task.url, geminiApiKey)
          } catch (error) {
            const isRateLimit =
              error?.code === 'GEMINI_RATE_LIMIT' ||
              String(error?.message || '').includes('429')
          const isBlocked =
            error?.code === 'GEMINI_BLOCKED' ||
            String(error?.blockReason || '').length > 0 ||
            String(error?.message || '').includes('block')

          if (isRateLimit || isBlocked) {
              const fallbackData = {
              extractionMethod: isBlocked ? 'gemini-blocked' : 'gemini-rate-limited',
              geminiError: error.message,
              geminiBlockReason: error.blockReason || null
              }

              extractedData = { ...(extractedData || {}), ...fallbackData }

              dispatch({
                type: 'UPDATE',
                id: task.id,
                payload: {
                statusMessage: isBlocked
                  ? 'Geminiがコンテンツをブロックしたため、既存情報のみで保存します'
                  : 'Geminiの使用上限に達したため、既存情報のみで保存します'
                }
              })

            toast.error(
              isBlocked
                ? 'Geminiがコンテンツをブロックしました。既存のメタデータのみで保存します。'
                : 'Gemini APIの使用上限を超過しました。既存のメタデータのみで参照を保存します。'
            )
            } else {
              throw error
            }
          }
        } else {
          dispatch({
            type: 'UPDATE',
            id: task.id,
            payload: { statusMessage: 'ページ情報を解析しています...' }
          })
        }

        const referencePayload = buildReferencePayload({
          task,
          extractedData,
          referenceInfo,
          userId: user.id
        })

        dispatch({
          type: 'UPDATE',
          id: task.id,
          payload: { statusMessage: '参照を保存しています...' }
        })

        const referenceRecord = await saveReference(referencePayload)

        dispatch({
          type: 'SUCCESS',
          id: task.id,
          reference: referenceRecord
        })

        window.dispatchEvent(
          new CustomEvent('reference:created', {
            detail: {
              reference: referenceRecord
            }
          })
        )


        dispatch({
          type: 'SUCCESS',
          id: task.id,
          reference: referenceRecord
        })

        window.dispatchEvent(
          new CustomEvent('reference:created', {
            detail: {
              reference: referenceRecord
            }
          })
        )
      } catch (error) {
        console.error('Reference fetch task failed:', error)
        dispatch({ type: 'FAIL', id: task.id, error: error.message })
        toast.error(error.message || '参照情報の取得に失敗しました')
      }
    },
    [geminiApiKey, user]
  )

  useEffect(() => {
    if (!user || processingRef.current) {
      return
    }

    const nextTask = state.tasks.find(
      (task) => task.status === TASK_STATUS.PENDING
    )

    if (!nextTask) {
      return
    }

    processingRef.current = true

    processTask(nextTask).finally(() => {
      processingRef.current = false
    })
  }, [processTask, state.tasks, user])

  useEffect(() => {
    const hasActiveTasks = state.tasks.some((task) =>
      [TASK_STATUS.PENDING, TASK_STATUS.PROCESSING].includes(task.status)
    )

    const handleBeforeUnload = (event) => {
      if (!hasActiveTasks) {
        return
      }
      event.preventDefault()
      event.returnValue =
        '情報取得中の参照があります。ページを離れると処理が中断されます。'
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [state.tasks])

  const activeTasks = useMemo(
    () =>
      state.tasks.filter((task) =>
        [TASK_STATUS.PENDING, TASK_STATUS.PROCESSING].includes(task.status)
      ),
    [state.tasks]
  )

  const value = {
    tasks: state.tasks,
    activeTasks,
    hasActiveTasks: activeTasks.length > 0,
    enqueueFetch,
    dismissTask
  }

  return (
    <ReferenceFetchQueueContext.Provider value={value}>
      {children}
    </ReferenceFetchQueueContext.Provider>
  )
}

export const useReferenceFetchQueue = () => {
  const context = useContext(ReferenceFetchQueueContext)
  if (!context) {
    throw new Error(
      'useReferenceFetchQueue must be used within ReferenceFetchQueueProvider'
    )
  }
  return context
}

async function fetchReferenceInfo(url) {
  const response = await fetch('/api/reference-info', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ url })
  })

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}))
    throw new Error(errorBody.error || 'リンク情報の取得に失敗しました')
  }

  return response.json()
}

async function saveReference(referencePayload) {
  const { data, error } = await supabase
    .from('references')
    .insert(referencePayload)
    .select()
    .single()

  if (error) {
    throw new Error(error.message || '参照の保存に失敗しました')
  }

  return data
}

function buildReferencePayload({ task, extractedData, referenceInfo, userId }) {
  const manual = task.manualFields || {}
  const infoMetadata = referenceInfo.metadata || {}
  const now = new Date().toISOString()

  const mergedAuthors = formatAuthors(
    manual.authors,
    extractedData.authors || infoMetadata.authors
  )

  const description =
    manual.description ||
    extractedData.description ||
    infoMetadata.description ||
    ''

  const tags = Array.isArray(task.tags) ? task.tags : []

  const rawReferenceType =
    manual.reference_type ||
    manual.referenceType ||
    extractedData.referenceType ||
    extractedData.reference_type ||
    extractedData.type ||
    infoMetadata.referenceType ||
    infoMetadata.reference_type

  const referenceType = normalizeReferenceType(rawReferenceType)

  return {
    title:
      manual.title ||
      extractedData.title ||
      infoMetadata.title ||
      task.url ||
      'Untitled Reference',
    url: task.url,
    memo: manual.memo || null,
    authors: mergedAuthors,
    published_date:
      manual.publishedDate ||
      extractedData.publishedDate ||
      infoMetadata.publishedDate ||
      null,
    accessed_date:
      manual.accessedDate || new Date().toISOString().split('T')[0],
    project_id: task.projectId || null,
    reference_type: referenceType,
    publisher:
      manual.publisher || extractedData.publisher || infoMetadata.siteName || null,
    pages: manual.pages || extractedData.pages || null,
    isbn: manual.isbn || extractedData.isbn || null,
    doi: manual.doi || extractedData.doi || null,
    journal_name:
      manual.journal_name || extractedData.journal_name || null,
    volume: manual.volume || extractedData.volume || null,
    issue: manual.issue || extractedData.issue || null,
    edition: manual.edition || extractedData.edition || null,
    saved_at: now,
    saved_by: userId,
    metadata: {
      description: description || null,
      tags,
      siteName: infoMetadata.siteName || null,
      language: infoMetadata.language || null,
      keywords: infoMetadata.keywords || [],
      source: {
        url: task.url,
        isPdf: referenceInfo.isPdf || false,
        method: extractedData.extractionMethod || null
      }
    }
  }
}

function formatAuthors(manualAuthors = [], extractedAuthors = []) {
  const normalizedManual =
    manualAuthors
      ?.map((author, index) => {
        if (!author) {
          return null
        }
        if (typeof author === 'string') {
          return {
            name: author.trim(),
            order: index + 1
          }
        }
        const name = author.name?.trim()
        if (!name) {
          return null
        }
        return {
          name,
          order: author.order || index + 1
        }
      })
      .filter(Boolean) || []

  if (normalizedManual.length > 0) {
    return normalizedManual
  }

  const normalizedExtracted =
    extractedAuthors
      ?.map((author, index) => {
        if (!author) {
          return null
        }
        if (typeof author === 'string') {
          return {
            name: author.trim(),
            order: index + 1
          }
        }
        if (author.name) {
          return {
            name: author.name.trim(),
            order: author.order || index + 1
          }
        }
        return null
      })
      .filter(Boolean) || []

  return normalizedExtracted.length > 0 ? normalizedExtracted : null
}

function normalizeReferenceType(value) {
  const normalized = (value || '').toLowerCase()
  const allowed = ['website', 'article', 'journal', 'book', 'report']
  if (allowed.includes(normalized)) {
    return normalized
  }
  if (normalized.includes('journal')) {
    return 'journal'
  }
  if (normalized.includes('article') || normalized.includes('paper')) {
    return 'article'
  }
  if (normalized.includes('book')) {
    return 'book'
  }
  if (normalized.includes('report')) {
    return 'report'
  }
  return 'website'
}

function generateTaskId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `task_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
}


