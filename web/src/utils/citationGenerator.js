import { format } from 'date-fns'

/**
 * APA向けに著者名を整形
 * - 1名: "Name"
 * - 2〜20名: "Name, Name, & Name"
 * - 21名以上: 先頭19名 + "..., & 最後の1名"
 */
const formatAuthorsAPA = (authors) => {
  if (!authors || authors.length === 0) { return '' }

  const normalized = authors
    .map((author) => typeof author === 'string' ? author.trim() : author?.name?.trim())
    .filter(Boolean)

  if (normalized.length === 0) { return '' }
  if (normalized.length === 1) { return normalized[0] }

  if (normalized.length <= 20) {
    const head = normalized.slice(0, -1).join(', ')
    const last = normalized[normalized.length - 1]
    return `${head}, & ${last}`
  }

  const head19 = normalized.slice(0, 19).join(', ')
  const last = normalized[normalized.length - 1]
  return `${head19}, ..., & ${last}`
}

const hasDayInfo = (dateString) => /\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(dateString) || /\b\d{1,2},?\s*[A-Za-z]+\s*\d{4}/.test(dateString)
const hasMonthInfo = (dateString) => /[-/][0-1]?\d/.test(dateString) || /[A-Za-z]+/.test(dateString)

/**
 * APAの日付表記（Year, Month Day / Year, Month / Year / n.d.）
 */
const formatAPADate = (dateString) => {
  if (!dateString) { return 'n.d.' }

  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) { return 'n.d.' }

  const year = date.getFullYear()
  const dateHasDay = hasDayInfo(dateString)
  const dateHasMonth = dateHasDay || hasMonthInfo(dateString)

  if (dateHasDay) {
    return `${year}, ${format(date, 'MMMM d')}`
  }

  if (dateHasMonth) {
    return `${year}, ${format(date, 'MMMM')}`
  }

  return `${year}`
}

const formatAccessDate = (dateString) => {
  if (!dateString) { return '' }
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) { return '' }
  return format(date, 'MMMM d, yyyy')
}

export const generateCitation = (reference, citationFormat) => {
  const title = reference.title || 'タイトルなし'
  const url = reference.url
  const metadata = reference.metadata || {}

  // 著者情報（配列を優先）
  const authors = reference.authors || metadata.authors || []
  const authorText = formatAuthorsAPA(authors) || reference.author || metadata.author || ''

  const siteName = metadata.siteName || (url ? new URL(url).hostname : '')
  const publishedDate = reference.published_date || metadata.publishedDate || ''

  // アクセス日は明示的な値 > 保存日時 > 現在日時
  const accessDateRaw = reference.accessed_date || reference.saved_at || new Date().toISOString()
  const accessDate = formatAccessDate(accessDateRaw)

  switch (citationFormat.toUpperCase()) {
    case 'APA':
      return generateAPACitation({ title, url, author: authorText, siteName, publishedDate, accessDate })
    case 'MLA':
      return generateMLACitation({ title, url, author: authorText, siteName, publishedDate, accessDate })
    case 'CHICAGO':
      return generateChicagoCitation({ title, url, author: authorText, siteName, publishedDate, accessDate })
    case 'HARVARD':
      return generateHarvardCitation({ title, url, author: authorText, siteName, publishedDate, accessDate })
    default:
      return generateAPACitation({ title, url, author: authorText, siteName, publishedDate, accessDate })
  }
}

const generateAPACitation = ({ title, url, author, siteName, publishedDate, accessDate }) => {
  const dateText = formatAPADate(publishedDate)
  const retrievalNeeded = !publishedDate && !!accessDate

  const parts = []

  // 先頭は「著者.」または「タイトル.」（著者がない場合タイトルが著者位置に来るAPAルール）
  parts.push(`${author || title}.`)
  parts.push(`(${dateText}).`)

  if (author) {
    parts.push(`${title}.`)
  }

  if (siteName) {
    parts.push(`${siteName}.`)
  }

  if (url) {
    if (retrievalNeeded) {
      parts.push(`Retrieved ${accessDate}, from ${url}`)
    } else {
      parts.push(url)
    }
  }

  return parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
}

const generateMLACitation = ({ title, url, author, siteName, publishedDate, accessDate }) => {
  let citation = ''
  
  if (author) {
    citation += `${author}. `
  }
  
  citation += `"${title}." `
  
  if (siteName) {
    citation += `${siteName}, `
  }
  
  if (publishedDate) {
    citation += `${format(new Date(publishedDate), 'd MMM yyyy')}, `
  }
  
  citation += `${url}. Accessed ${accessDate}.`
  
  return citation
}

const generateChicagoCitation = ({ title, url, author, siteName, publishedDate, accessDate }) => {
  let citation = ''
  
  if (author) {
    citation += `${author}. `
  }
  
  citation += `"${title}." `
  
  if (siteName) {
    citation += `${siteName}. `
  }
  
  if (publishedDate) {
    citation += `${format(new Date(publishedDate), 'MMMM d, yyyy')}. `
  }
  
  citation += `${url} (accessed ${accessDate}).`
  
  return citation
}

const generateHarvardCitation = ({ title, url, author, siteName, publishedDate, accessDate }) => {
  let citation = ''
  
  if (author) {
    citation += `${author} `
  }
  
  if (publishedDate) {
    const year = new Date(publishedDate).getFullYear()
    citation += `${year}, `
  } else {
    citation += 'n.d., '
  }
  
  citation += `${title}, `
  
  if (siteName) {
    citation += `${siteName}, `
  }
  
  citation += `viewed ${accessDate}, <${url}>.`
  
  return citation
}

export const generateProjectCitations = (references, citationFormat) => {
  return references.map(reference => generateCitation(reference, citationFormat)).join('\n\n')
}
