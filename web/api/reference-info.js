import * as cheerio from 'cheerio'

const PDF_MIME_TYPES = [
  'application/pdf',
  'application/x-pdf',
  'application/acrobat',
  'applications/vnd.pdf',
  'text/pdf',
  'text/x-pdf'
]

const DEFAULT_HEADERS = {
  'User-Agent': 'ResearchVaultBot/1.0 (+https://researchvault.app)',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
}

const RESPONSE_CACHE_CONTROL = 'private, max-age=300'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Cache-Control', RESPONSE_CACHE_CONTROL)

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { url } = req.body || {}

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URLは必須です' })
  }

  try {
    const normalizedUrl = new URL(url).toString()
    const headResult = await fetchHead(normalizedUrl)

    if (headResult.isPdf) {
      return res.status(200).json({
        isPdf: true,
        url: normalizedUrl,
        reason: headResult.reason || 'content-type',
        contentType: headResult.contentType
      })
    }

    const htmlResult = await fetchHtml(normalizedUrl, headResult)

    if (htmlResult.isPdf) {
      return res.status(200).json({
        isPdf: true,
        url: normalizedUrl,
        reason: 'body',
        contentType: htmlResult.contentType
      })
    }

    const metadata = extractMetadata(htmlResult.html, normalizedUrl)

    return res.status(200).json({
      isPdf: false,
      url: normalizedUrl,
      contentType: htmlResult.contentType,
      metadata
    })
  } catch (error) {
    console.error('reference-info api error:', error)
    return res.status(500).json({
      error: '参照情報の取得に失敗しました',
      details: error.message
    })
  }
}

async function fetchHead(url) {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      headers: DEFAULT_HEADERS
    })

    const contentType = response.headers.get('content-type') || ''
    const isPdf = isPdfContentType(contentType) || isPdfUrl(url)

    return {
      ok: response.ok,
      contentType,
      isPdf,
      status: response.status,
      reason: isPdf ? 'head' : null
    }
  } catch (error) {
    return {
      ok: false,
      contentType: '',
      isPdf: isPdfUrl(url),
      status: 0,
      reason: 'head-error',
      error
    }
  }
}

async function fetchHtml(url, headResult) {
  const response = await fetch(url, {
    method: 'GET',
    redirect: 'follow',
    headers: DEFAULT_HEADERS
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch HTML (${response.status})`)
  }

  const contentType = response.headers.get('content-type') || headResult.contentType || ''

  if (isPdfContentType(contentType)) {
    return {
      html: '',
      contentType,
      isPdf: true
    }
  }

  const html = await response.text()

  return {
    html,
    contentType,
    isPdf: false
  }
}

function extractMetadata(html, url) {
  if (!html) {
    return {
      title: extractSiteName(url),
      description: '',
      authors: [],
      publishedDate: '',
      referenceType: 'website',
      siteName: extractSiteName(url),
      language: '',
      keywords: []
    }
  }

  const $ = cheerio.load(html)

  const title = pickFirst(
    $('meta[property="og:title"]').attr('content'),
    $('meta[name="twitter:title"]').attr('content'),
    $('title').text()
  )

  const description = pickFirst(
    $('meta[name="description"]').attr('content'),
    $('meta[property="og:description"]').attr('content'),
    $('meta[name="twitter:description"]').attr('content')
  )

  const siteName = pickFirst(
    $('meta[property="og:site_name"]').attr('content'),
    extractSiteName(url)
  )

  const publishedDate = pickFirst(
    $('meta[property="article:published_time"]').attr('content'),
    $('meta[name="pubdate"]').attr('content'),
    $('meta[name="date"]').attr('content'),
    $('meta[name="dc.date"]').attr('content'),
    $('meta[name="citation_publication_date"]').attr('content')
  )

  const referenceType = pickFirst(
    $('meta[property="og:type"]').attr('content'),
    $('meta[name="citation_article_type"]').attr('content'),
    'website'
  )

  const language = pickFirst(
    $('html').attr('lang'),
    $('meta[name="language"]').attr('content')
  )

  const keywordsContent = pickFirst(
    $('meta[name="keywords"]').attr('content'),
    $('meta[name="news_keywords"]').attr('content')
  )

  const keywords = keywordsContent
    ? keywordsContent.split(',').map((keyword) => keyword.trim()).filter(Boolean)
    : []

  const authors = extractAuthors($)

  return {
    title: title?.trim() || extractSiteName(url),
    description: description?.trim() || '',
    authors,
    publishedDate: publishedDate?.trim() || '',
    referenceType: (referenceType || 'website').toLowerCase(),
    siteName: siteName?.trim() || extractSiteName(url),
    language: language?.trim() || '',
    keywords
  }
}

function extractAuthors($) {
  const selectors = [
    { attr: 'name', value: 'author' },
    { attr: 'name', value: 'dc.creator' },
    { attr: 'property', value: 'article:author' },
    { attr: 'name', value: 'citation_author' },
    { attr: 'name', value: 'byline' }
  ]

  const authors = new Set()

  selectors.forEach(({ attr, value }) => {
    $(`meta[${attr}="${value}"]`).each((_, el) => {
      const content = $(el).attr('content')
      if (content) {
        content.split(/[,;｜]/).forEach((name) => {
          const trimmed = name.trim()
          if (trimmed) {
            authors.add(trimmed)
          }
        })
      }
    })
  })

  if (authors.size === 0) {
    const schemaAuthor = $('script[type="application/ld+json"]').map((_, el) => {
      try {
        const data = JSON.parse($(el).html() || '{}')
        if (data.author) {
          if (Array.isArray(data.author)) {
            data.author.forEach((author) => {
              if (typeof author === 'string' && author.trim()) {
                authors.add(author.trim())
              } else if (author?.name) {
                authors.add(author.name.trim())
              }
            })
          } else if (typeof data.author === 'string') {
            authors.add(data.author.trim())
          } else if (data.author?.name) {
            authors.add(data.author.name.trim())
          }
        }
      } catch (error) {
        // ignore JSON parse errors
      }
    })

    if (schemaAuthor && schemaAuthor.length > 0) {
      // authors already collected
    }
  }

  return Array.from(authors)
}

function pickFirst(...values) {
  return values.find((value) => typeof value === 'string' && value.trim().length > 0) || ''
}

function extractSiteName(url) {
  try {
    const { hostname } = new URL(url)
    return hostname.replace('www.', '')
  } catch {
    return 'unknown-site'
  }
}

function isPdfContentType(contentType = '') {
  return PDF_MIME_TYPES.some((type) => contentType.toLowerCase().includes(type))
}

function isPdfUrl(url = '') {
  return /\.pdf($|\?)/i.test(url)
}

