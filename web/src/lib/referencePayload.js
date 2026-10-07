import { normalizeReferenceMetadata, parsePublicationDate } from '../../lib/referenceMetadata.js'

export function buildReferencePayload({ task, extractedData, referenceInfo, userId }) {
  const manual = task.manualFields || {}
  extractedData = normalizeReferenceMetadata(extractedData)
  const infoMetadata = normalizeReferenceMetadata(referenceInfo.metadata || {})
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

  const inferredType = inferReferenceType({
    rawType: rawReferenceType,
    extractedData,
    infoMetadata,
    referenceInfo,
    task
  })

  const referenceType = normalizeReferenceType(manual.reference_type || manual.referenceType || inferredType)
  const publication = parsePublicationDate(manual.publishedDate || extractedData.publishedDateOriginal || extractedData.publishedDate || infoMetadata.publishedDate)

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
    published_date: publication.date || null,
    accessed_date:
      manual.accessedDate || new Date().toISOString().split('T')[0],
    project_id: task.projectId || null,
    reference_type: referenceType,
    publisher:
      manual.publisher || extractedData.publisher || infoMetadata.publisher || infoMetadata.siteName || null,
    pages: manual.pages || extractedData.pages || null,
    isbn: manual.isbn || extractedData.isbn || null,
    doi: manual.doi || extractedData.doi || null,
    journal_name:
      manual.journal_name || extractedData.journalName || infoMetadata.journalName || null,
    volume: manual.volume || extractedData.volume || null,
    issue: manual.issue || extractedData.issue || null,
    edition: manual.edition || extractedData.edition || null,
    saved_at: now,
    saved_by: userId,
    metadata: {
      publishedDatePrecision: publication.precision,
      publishedDateOriginal: publication.original,
      extractionWarning: extractedData.extractionWarning || null,
      extractionModel: extractedData.extractionModel || null,
      pdfPageCount: extractedData.pdfPageCount || null,
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

function inferReferenceType({ rawType, extractedData = {}, infoMetadata = {}, referenceInfo = {}, task = {} }) {
  const normalizedRaw = (rawType || '').toLowerCase()
  const isPdf = !!referenceInfo.isPdf
  const url = task.url || referenceInfo.url || ''
  const domain = (() => {
    try {
      return new URL(url).hostname.toLowerCase()
    } catch {
      return ''
    }
  })()

  const hasDoi = !!(extractedData.doi || infoMetadata.doi)
  const hasIsbn = !!(extractedData.isbn || infoMetadata.isbn)
  const hasJournalSignals =
    !!(extractedData.journalName ||
      extractedData.journal_name ||
      infoMetadata.journalName ||
      infoMetadata.journal_name ||
      extractedData.volume ||
      extractedData.issue)

  const filename = (() => {
    try {
      return new URL(url).pathname.toLowerCase()
    } catch {
      return ''
    }
  })()

  const maybeReportByFilename = ['report', 'whitepaper', 'wp', 'policy', 'survey', 'workingpaper', 'discussion', 'special_report']
    .some(keyword => filename.includes(keyword))

  const isGovOrEdu = /(go\.jp|gov|gob|\.edu|ac\.jp|ac\.uk|edu\.cn|edu)/.test(domain)
  const isKnownReportDomain = ['mof.go.jp', 'pri.go.jp', 'ilo.org', 'oecd.org', 'imf.org', 'worldbank.org']
    .some(d => domain.includes(d))

  // If Gemini already returned a non-website, respect it
  if (normalizedRaw && normalizedRaw !== 'website') {
    return normalizedRaw
  }

  // PDFでDOIや巻号があれば論文扱い
  if (isPdf && (hasDoi || hasJournalSignals)) {
    return 'article'
  }

  // ISBNがあれば書籍
  if (hasIsbn) {
    return 'book'
  }

  // 政府・研究機関ドメインやファイル名のシグナルでレポート優先
  if (isPdf && (isGovOrEdu || isKnownReportDomain || maybeReportByFilename)) {
    return 'report'
  }

  // PDFで非ウェブならレポートを既定に
  if (isPdf) {
    return 'report'
  }

  // それ以外は元の値（websiteを含む）
  return normalizedRaw || 'website'
}
