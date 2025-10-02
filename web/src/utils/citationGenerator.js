import { format } from 'date-fns'
import { ja } from 'date-fns/locale'

export const generateCitation = (reference, citationFormat) => {
  const title = reference.title || 'タイトルなし'
  const url = reference.url
  const metadata = reference.metadata || {}
  const author = metadata.author || ''
  const siteName = metadata.siteName || new URL(url).hostname
  const publishedDate = metadata.publishedDate || ''
  const accessDate = format(new Date(), 'yyyy年MM月dd日', { locale: ja })

  switch (citationFormat.toUpperCase()) {
    case 'APA':
      return generateAPACitation({ title, url, author, siteName, publishedDate, accessDate })
    case 'MLA':
      return generateMLACitation({ title, url, author, siteName, publishedDate, accessDate })
    case 'CHICAGO':
      return generateChicagoCitation({ title, url, author, siteName, publishedDate, accessDate })
    case 'HARVARD':
      return generateHarvardCitation({ title, url, author, siteName, publishedDate, accessDate })
    default:
      return generateAPACitation({ title, url, author, siteName, publishedDate, accessDate })
  }
}

const generateAPACitation = ({ title, url, author, siteName, publishedDate, accessDate }) => {
  let citation = ''
  
  if (author) {
    citation += `${author}. `
  }
  
  if (publishedDate) {
    const year = new Date(publishedDate).getFullYear()
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
