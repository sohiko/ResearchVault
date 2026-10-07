import { extractReferenceFromPDF } from './pdfExtractor'
import { generateReference } from './referenceAI'
import { mergeReferenceMetadata, normalizeReferenceMetadata } from '../../lib/referenceMetadata.js'

export async function readReferenceUrl(url, apiKey = null) {
  const response = await fetch('/api/reference-info', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }), signal: AbortSignal.timeout(55000)
  })
  if (!(response.headers.get('content-type') || '').includes('application/json')) {
    throw new Error('情報取得APIが応答しません。APIサーバーの起動状態を確認してください。')
  }
  const info = await response.json()
  if (!response.ok) {throw new Error([info.error, info.details].filter(Boolean).join(': ') || 'リンク情報の取得に失敗しました')}
  if (info.isPdf) {
    const metadata = await extractReferenceFromPDF(info.url || url, apiKey)
    return { info, metadata }
  }
  let metadata = normalizeReferenceMetadata(info.metadata)
  if (apiKey && info.content && (!metadata.authors.length || !metadata.publishedDate || metadata.titleIsFallback || !metadata.description)) {
    try {
      metadata = mergeReferenceMetadata(metadata, await generateReference({ apiKey, metadata, content: info.content }))
    } catch (error) {
      metadata.extractionWarning = `AI補完に失敗しました: ${error.message}`
    }
  }
  return { info, metadata }
}
