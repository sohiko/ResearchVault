import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState
} from 'react'
import { toast } from 'react-hot-toast'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { readReferenceUrl } from '../lib/referenceReader'
import { buildReferencePayload } from '../lib/referencePayload'
import { useNavigate } from 'react-router-dom'
import { useReferenceAction } from './ReferenceActionContext'
import { resolveGeminiApiKey } from '../lib/userGemini'

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
  const [processing, setProcessing] = useState(false)
  const { user } = useAuth()
  const envGeminiApiKey = import.meta.env.VITE_GEMINI_API_KEY
  const navigate = useNavigate()
  const { requestReferenceEdit } = useReferenceAction()

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

        const { apiKey: activeGeminiKey } = await resolveGeminiApiKey(user.id, envGeminiApiKey)
        dispatch({ type: 'UPDATE', id: task.id, payload: { statusMessage: '文献情報を読み取っています...' } })
        const { info: referenceInfo, metadata: extractedData } = await readReferenceUrl(task.url, activeGeminiKey)
        const geminiFallback = !!extractedData.extractionWarning
        if (geminiFallback) {toast.error(extractedData.extractionWarning, { duration: 6000 })}
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

        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user?.id !== user.id) {
          throw new Error('アカウントが変更されたため、情報取得を中断しました')
        }
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

        if (geminiFallback) {
          const toastId = toast(
            '詳細情報の自動取得に失敗しました。クリックして手動編集してください。',
            {
              icon: '✏️',
              duration: 9000,
              className: 'cursor-pointer',
              // onClickはtoast本体に直接付ける
              onClick: () => {
                const destination = referenceRecord.project_id
                  ? `/projects/${referenceRecord.project_id}`
                  : '/references'
                navigate(destination)
                requestReferenceEdit(referenceRecord.id, referenceRecord.project_id)
                toast.dismiss(toastId)
              }
            }
          )
        }
      } catch (error) {
        console.error('Reference fetch task failed:', error)
        dispatch({ type: 'FAIL', id: task.id, error: error.message })
        toast.error(error.message || '参照情報の取得に失敗しました')
      }
    },
    [envGeminiApiKey, navigate, requestReferenceEdit, user]
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
    setProcessing(true)

    processTask(nextTask).finally(() => {
      processingRef.current = false
      setProcessing(false)
    })
  }, [processTask, state.tasks, user, processing])

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

function generateTaskId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `task_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
}
