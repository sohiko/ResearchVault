import { generateReference } from './referenceAI'
import { mergeReferenceMetadata } from '../../lib/referenceMetadata.js'
import { readPdfDocument, validatePdfBytes } from '../../lib/pdfDocument.js'

const MAX_DIRECT_BYTES = 18 * 1024 * 1024

async function readDirectPDF(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) })
  if (!response.ok) {throw new Error(`PDFの取得に失敗しました (${response.status})`)}
  if (Number(response.headers.get('content-length')) > MAX_DIRECT_BYTES) {
    await response.body?.cancel()
    throw new Error('PDFが大きすぎます（18 MiBまで）')
  }
  const reader = response.body.getReader()
  const chunks = []
  let size = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) {break}
      size += value.byteLength
      if (size > MAX_DIRECT_BYTES) {throw new Error('PDFが大きすぎます（18 MiBまで）')}
      chunks.push(value)
    }
  } finally { await reader.cancel(); reader.releaseLock() }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
  validatePdfBytes(bytes)
  return { bytes }
}

async function readProxyPDF(url, format = 'base64') {
  const response = await fetch('/api/pdf-proxy', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, format }), signal: AbortSignal.timeout(60000)
  })
  const data = await response.json()
  if (response.status === 413 && format === 'base64') {return readProxyPDF(url, 'text')}
  if (!response.ok || !data.success) {throw new Error(data.error || 'PDFの取得に失敗しました')}
  if (format === 'text') {return { document: { metadata: data.metadata, content: data.content } }}
  const bytes = Uint8Array.from(atob(data.data), character => character.charCodeAt(0))
  validatePdfBytes(bytes)
  return { bytes }
}

function base64Encode(bytes) {
  const chunks = []
  for (let i = 0; i < bytes.length; i += 8192) {chunks.push(String.fromCharCode(...bytes.subarray(i, i + 8192)))}
  return btoa(chunks.join(''))
}

export async function extractReferenceFromPDF(url, apiKey, onProgress = null) {
  onProgress?.({ status: 'downloading', progress: 0 })
  let downloaded
  try { downloaded = await readDirectPDF(url) } catch { downloaded = await readProxyPDF(url) }
  onProgress?.({ status: 'processing', progress: 0.3 })
  let document = downloaded.document
  let parseWarning = ''
  if (!document) {
    try {
      const pdfjs = await import('pdfjs-dist/build/pdf.mjs')
      const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
      document = await readPdfDocument(downloaded.bytes, pdfjs)
    } catch (error) {
      parseWarning = `PDFのテキスト解析に失敗しました: ${error.message}`
      if (!apiKey) {throw new Error(parseWarning)}
      document = { metadata: { referenceType: 'report' }, content: '' }
    }
  }
  let result = document.metadata
  if (apiKey) {
    try {
      // Text is cheaper and verifiable; use visual PDF analysis for scans.
      const ai = await generateReference({ apiKey, ...document,
        pdfBase64: downloaded.bytes && document.content.trim().length < 100 ? base64Encode(downloaded.bytes) : null })
      result = mergeReferenceMetadata(document.metadata, ai)
    } catch (error) {
      result = { ...result, extractionWarning: `AI解析に失敗しました: ${error.message}` }
    }
  }
  if (!document.content.trim() && !apiKey) {
    throw new Error('画像のみのPDFを解析するには、アカウント設定でGemini APIキーを有効にしてください。')
  }
  if (!result.title) {
    result = { ...result, title: decodeURIComponent(new URL(url).pathname.split('/').pop()) || url,
      titleIsFallback: true, extractionWarning: result.extractionWarning || 'タイトルを特定できませんでした。保存後に書誌情報を確認してください。' }
  }
  if (parseWarning) {result.extractionWarning ||= parseWarning}
  onProgress?.({ status: 'complete', progress: 1 })
  return result
}
