// 引用生成APIエンドポイント
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

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

function generateCitation({ url, title, metadata, format, accessDate }) {
  const parsedUrl = new URL(url)
  const siteName = metadata.siteName || parsedUrl.hostname
  const author = metadata.author || ''
  const publishedDate = metadata.publishedDate || ''
  const description = metadata.description || ''
  const accessDateFormatted = formatDate(new Date(accessDate))
  const publishedDateFormatted = publishedDate ? formatDate(new Date(publishedDate)) : ''

  switch (format.toUpperCase()) {
    case 'APA':
      return generateAPACitation({
        url,
        title,
        author,
        siteName,
        publishedDate: publishedDateFormatted,
        accessDate: accessDateFormatted
      })
    
    case 'MLA':
      return generateMLACitation({
        url,
        title,
        author,
        siteName,
        publishedDate: publishedDateFormatted,
        accessDate: accessDateFormatted
      })
    
    case 'CHICAGO':
      return generateChicagoCitation({
        url,
        title,
        author,
        siteName,
        publishedDate: publishedDateFormatted,
        accessDate: accessDateFormatted
      })
    
    case 'HARVARD':
      return generateHarvardCitation({
        url,
        title,
        author,
        siteName,
        publishedDate: publishedDateFormatted,
        accessDate: accessDateFormatted
      })
    
    default:
      return generateAPACitation({
        url,
        title,
        author,
        siteName,
        publishedDate: publishedDateFormatted,
        accessDate: accessDateFormatted
      })
  }
}

function generateAPACitation({ url, title, author, siteName, publishedDate, accessDate }) {
  let citation = ''

  if (author) {
    citation += `${author}. `
  }

  if (publishedDate) {
    const year = publishedDate.split('/')[0]
    citation += `(${year}). `
  } else {
    citation += '(n.d.). '
  }

  citation += `${title}. `

  if (siteName) {
    citation += `${siteName}. `
  }

  citation += `Retrieved ${accessDate}, from ${url}`

  return citation
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

function formatDate(date) {
  const options = {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }
  return date.toLocaleDateString('en-US', options)
}
