// 引用生成APIエンドポイント
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://pzplwtvnxikhykqsvcfs.supabase.co'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6cGx3dHZueGlraHlrcXN2Y2ZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3NTg3NzQsImV4cCI6MjA3NDMzNDc3NH0.k8h6E0QlW2549ILvrR5NeMdzJMmhmekj6O_GZ3C43V0'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

export default async function handler(req, res) {
  // CORS設定
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Client-Info')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // 認証チェック
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '認証が必要です' })
    }

    const token = authHeader.split(' ')[1]
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return res.status(401).json({ error: '無効な認証トークンです' })
    }

    const {
      url,
      title,
      metadata,
      format = 'APA',
      accessDate
    } = req.body

    if (!url || !title) {
      return res.status(400).json({ error: 'URLとタイトルが必要です' })
    }

    // 引用を生成
    const citation = generateCitation({
      url,
      title,
      metadata: metadata || {},
      format,
      accessDate: accessDate || new Date().toISOString()
    })

    return res.status(200).json({
      citation,
      format,
      generatedAt: new Date().toISOString()
    })

  } catch (error) {
    console.error('Citation generation error:', error)
    return res.status(500).json({
      error: '引用の生成に失敗しました'
    })
  }
}

function formatAuthorsAPA(authors) {
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

function formatAPADate(rawDate) {
  if (!rawDate) { return 'n.d.' }
  const dateString = rawDate.toString()
  const date = new Date(rawDate)
  if (Number.isNaN(date.getTime())) { return 'n.d.' }

  const year = date.getFullYear()
  const dateHasDay = hasDayInfo(dateString)
  const dateHasMonth = dateHasDay || hasMonthInfo(dateString)

  const monthName = date.toLocaleDateString('en-US', { month: 'long' })
  const day = date.getDate()

  if (dateHasDay) {
    return `${year}, ${monthName} ${day}`
  }

  if (dateHasMonth) {
    return `${year}, ${monthName}`
  }

  return `${year}`
}

function formatAccessDate(rawDate) {
  if (!rawDate) { return '' }
  const date = new Date(rawDate)
  if (Number.isNaN(date.getTime())) { return '' }
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

function generateCitation({ url, title, metadata, format, accessDate }) {
  const parsedUrl = new URL(url)
  const siteName = metadata.siteName || parsedUrl.hostname

  const authors = metadata.authors || []
  const author = formatAuthorsAPA(authors) || metadata.author || ''
  const publishedDate = metadata.publishedDate || ''
  const accessDateFormatted = formatAccessDate(accessDate)

  switch (format.toUpperCase()) {
    case 'APA':
      return generateAPACitation({
        url,
        title,
        author,
        siteName,
        publishedDate,
        accessDate: accessDateFormatted
      })
    
    case 'MLA':
      return generateMLACitation({
        url,
        title,
        author,
        siteName,
        publishedDate,
        accessDate: accessDateFormatted
      })
    
    case 'CHICAGO':
      return generateChicagoCitation({
        url,
        title,
        author,
        siteName,
        publishedDate,
        accessDate: accessDateFormatted
      })
    
    case 'HARVARD':
      return generateHarvardCitation({
        url,
        title,
        author,
        siteName,
        publishedDate,
        accessDate: accessDateFormatted
      })
    
    default:
      return generateAPACitation({
        url,
        title,
        author,
        siteName,
        publishedDate,
        accessDate: accessDateFormatted
      })
  }
}

function generateAPACitation({ url, title, author, siteName, publishedDate, accessDate }) {
  const dateText = formatAPADate(publishedDate)
  const retrievalNeeded = !publishedDate && !!accessDate

  const parts = []

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

function generateMLACitation({ url, title, author, siteName, publishedDate, accessDate }) {
  let citation = ''

  if (author) {
    citation += `${author}. `
  }

  citation += `"${title}." `

  if (siteName) {
    citation += `${siteName}, `
  }

  if (publishedDate) {
    citation += `${publishedDate}, `
  }

  citation += `${url}. Accessed ${accessDate}.`

  return citation
}

function generateChicagoCitation({ url, title, author, siteName, publishedDate, accessDate }) {
  let citation = ''

  if (author) {
    citation += `${author}. `
  }

  citation += `"${title}." `

  if (siteName) {
    citation += `${siteName}. `
  }

  if (publishedDate) {
    citation += `${publishedDate}. `
  }

  citation += `${url} (accessed ${accessDate}).`

  return citation
}

function generateHarvardCitation({ url, title, author, siteName, publishedDate, accessDate }) {
  let citation = ''

  if (author) {
    citation += `${author} `
  }

  if (publishedDate) {
    const year = publishedDate.split('/')[0]
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
