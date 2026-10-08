import { normalizeReferenceMetadata } from './referenceMetadata.js'

export function validatePdfBytes(bytes) {
  const header = new TextDecoder('latin1').decode(bytes.subarray(0, 1024))
  if (!header.includes('%PDF-')) {throw new Error('取得したファイルはPDFではありません。ログイン画面やリンク先を確認してください。')}
}

export function repositoryCoverMetadata(content) {
  const lines = content.split('\n').map(line => line.trim()).filter(Boolean)
  const publicationIndex = lines.findIndex(line => /^出版情報\s*[:：]/.test(line))
  if (publicationIndex < 0) {return {}}
  const headerIndex = lines.findLastIndex((line, index) => index < publicationIndex &&
    /(?:Institutional Repository|学術情報リポジトリ|機関リポジトリ)$/i.test(line))
  if (headerIndex < 0) {return {}}
  const publication = lines[publicationIndex].replace(/^出版情報\s*[:：]\s*/, '')
  const publishedDate = publication.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0] || ''
  const journal = publication.match(/^(.+?)\.\s*(\d+)(?:\s*\(([^)]*)\))?\s*,?\s*pp?\./)
  const title = lines[headerIndex + 1]
  return {
    title: title && title.length <= 200 && !/^https?:\/\//i.test(title) ? title : '',
    publishedDate,
    journalName: journal?.[1] || '', volume: journal?.[2] || '', issue: journal?.[3] || '',
    pages: publication.match(/\bpp?\.\s*([\d]+(?:\s*[-–—]\s*\d+)?)/)?.[1] || '',
    publisher: publishedDate ? publication.split(publishedDate)[1]?.replace(/^[.\s]+/, '').trim() : ''
  }
}

export async function readPdfDocument(bytes, pdfjs, resources = {}) {
  validatePdfBytes(bytes)
  const task = pdfjs.getDocument({ data: new Uint8Array(bytes), isEvalSupported: false, useSystemFonts: true, ...resources })
  try {
    const document = await task.promise
    const { info = {}, metadata } = await document.getMetadata().catch(() => ({}))
    const chunks = []
    const pageNumbers = new Set([
      ...Array.from({ length: Math.min(document.numPages, 8) }, (_, i) => i + 1),
      Math.max(1, document.numPages - 1), document.numPages
    ])
    for (const pageNumber of pageNumbers) {
      const page = await document.getPage(pageNumber)
      try {
        const content = await page.getTextContent()
        chunks.push(content.items.map(item => `${item.str || ''}${item.hasEOL ? '\n' : ' '}`).join(''))
      } finally { page.cleanup() }
      if (chunks.join('\n').length > 50000) {break}
    }
    const rawTitle = metadata?.get('dc:title') || info.Title || ''
    const title = typeof rawTitle === 'string' && !/^(untitled|microsoft|word|powerpoint|document\d*)/i.test(rawTitle) ? rawTitle : ''
    const creator = metadata?.get('dc:creator') || info.Author || []
    const openingText = chunks.slice(0, 2).join('\n').slice(0, 6000)
    const repository = repositoryCoverMetadata(openingText)
    const finalTitle = title || repository.title || ''
    const publication = openingText.match(/(?:\bpublished(?:\s+online)?(?:\s+on)?|\bpublication\s+date|発行(?:年月日|日)?|刊行日|公開日)\s*[:：]?\s*(\d{4}[-/年.]\d{1,2}[-/月.]\d{1,2}日?|[A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{1,2}\s+[A-Za-z]+\s+\d{4}|\d{4}[-/年.]\d{1,2}月?|\d{4})/i)?.[1] || ''
    const doi = openingText.match(/(?:doi\s*:\s*|https?:\/\/(?:dx\.)?doi\.org\/)(10\.\d{4,9}\/[^\s<>]+)/i)?.[1]?.replace(/[.,;)]+$/, '') || ''
    return {
      metadata: normalizeReferenceMetadata({ ...repository, title: finalTitle, titleIsFallback: !finalTitle, authors: creator,
        publishedDate: repository.publishedDate || publication, doi,
        referenceType: doi ? 'article' : 'report', referenceTypeIsFallback: !doi, extractionMethod: 'pdf-text', pdfPageCount: document.numPages,
        documentCreatedDate: info.CreationDate || null }),
      content: chunks.join('\n').slice(0, 50000)
    }
  } finally { await task.destroy() }
}
