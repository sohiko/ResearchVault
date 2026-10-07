const text = value => typeof value === 'string' ? value.trim() : ''

// Keep the date's stated precision separately; the database column is a DATE.
export function parsePublicationDate(value) {
  const raw = text(value)
  if (!raw) {return { date: '', precision: null, original: '' }}
  const match = raw.match(/^(\d{4})(?:[-/年.](\d{1,2}))?(?:[-/月.](\d{1,2}))?(?:日)?(?:$|[T\s])/)
  let year, month, day, precision
  if (match) {
    year = Number(match[1]); month = Number(match[2] || 1); day = Number(match[3] || 1)
    precision = match[3] ? 'day' : match[2] ? 'month' : 'year'
  } else {
    // Named months are unambiguous; do not guess numeric day/month order.
    if (!/[A-Za-z]{3,}/.test(raw) || !/\d{4}/.test(raw)) {return { date: '', precision: null, original: raw }}
    const parsed = new Date(raw)
    if (Number.isNaN(parsed.getTime())) {return { date: '', precision: null, original: raw }}
    year = parsed.getUTCFullYear(); month = parsed.getUTCMonth() + 1; day = parsed.getUTCDate()
    precision = /\b\d{1,2}\b/.test(raw) ? 'day' : 'month'
  }
  const check = new Date(Date.UTC(year, month - 1, day))
  if (year < 1000 || year > 9999 || check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    return { date: '', precision: null, original: raw }
  }
  return { date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`, precision, original: raw }
}

export function normalizeAuthors(value) {
  const list = Array.isArray(value) ? value : value ? [value] : []
  const seen = new Set()
  return list.flatMap(author => {
    const name = text(typeof author === 'string' ? author : author?.name)
    if (!name || /^https?:\/\//i.test(name) || seen.has(name.toLowerCase())) {return []}
    seen.add(name.toLowerCase())
    return [{ name, order: seen.size }]
  })
}

export function normalizeReferenceMetadata(input = {}) {
  const result = { ...input, authors: normalizeAuthors(input.authors) }
  const publication = parsePublicationDate(input.publishedDate || input.published_date)
  result.publishedDate = publication.date
  result.publishedDatePrecision = input.publishedDatePrecision || publication.precision
  result.publishedDateOriginal = input.publishedDateOriginal || publication.original
  for (const field of ['title', 'description', 'publisher', 'pages', 'doi', 'isbn', 'volume', 'issue', 'edition']) {
    result[field] = typeof input[field] === 'number' ? String(input[field]) : text(input[field])
  }
  result.doi = result.doi.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '').replace(/^doi:\s*/i, '')
  result.journalName = text(input.journalName || input.journal_name)
  const type = text(input.referenceType || input.reference_type).toLowerCase()
  result.referenceType = ['website', 'article', 'journal', 'book', 'report'].includes(type) ? type : 'website'
  return result
}

// Structured metadata and user input take precedence over generated guesses.
export function mergeReferenceMetadata(base, supplement) {
  const merged = { ...normalizeReferenceMetadata(supplement), ...normalizeReferenceMetadata(base) }
  const normalizedSupplement = normalizeReferenceMetadata(supplement)
  for (const field of ['title', 'description', 'publisher', 'pages', 'doi', 'isbn', 'journalName', 'volume', 'issue', 'edition']) {
    if (!merged[field] || (field === 'title' && base.titleIsFallback)) {merged[field] = normalizedSupplement[field] || merged[field]}
  }
  if (!merged.authors.length) {merged.authors = normalizedSupplement.authors}
  if (!merged.publishedDate) {
    for (const field of ['publishedDate', 'publishedDatePrecision', 'publishedDateOriginal']) {merged[field] = normalizedSupplement[field]}
  }
  if ((base.referenceTypeIsFallback || merged.referenceType === 'website') && normalizedSupplement.referenceType !== 'website') {merged.referenceType = normalizedSupplement.referenceType}
  merged.extractionMethod = supplement.extractionMethod || base.extractionMethod
  merged.extractionWarning = supplement.extractionWarning || base.extractionWarning
  return merged
}
