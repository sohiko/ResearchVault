/**
 * 引用生成ユーティリティ
 * 各種引用形式の生成関数を提供
 */

/**
 * 著者名をフォーマット（APA形式）
 * @param {Array|Object|string} authors - 著者情報
 * @param {boolean} forInText - 本文中引用用かどうか
 * @returns {string} フォーマットされた著者名
 */
function formatAuthors(authors, forInText = false) {
  if (!authors) { return '' }
  
  // 配列の場合
  if (Array.isArray(authors)) {
    if (authors.length === 0) { return '' }
    
    // authors が文字列の配列の場合
    if (typeof authors[0] === 'string') {
      if (forInText) {
        // 本文中引用: 最初の著者の姓のみ
        return extractLastName(authors[0])
      }
      return authors[0]
    }
    
    // authors が {name, order} の配列の場合
    if (authors[0].name) {
      if (forInText) {
        // 本文中引用: 最初の著者の姓のみ
        return extractLastName(authors[0].name)
      }
      return authors[0].name
    }
    
    return ''
  }
  
  // 文字列の場合
  if (typeof authors === 'string') {
    if (forInText) {
      return extractLastName(authors)
    }
    return authors
  }
  
  return ''
}

/**
 * 姓を抽出（日本語と英語に対応）
 * @param {string} fullName - フルネーム
 * @returns {string} 姓
 */
function extractLastName(fullName) {
  if (!fullName) { return '' }
  
  // 日本語の場合（姓 名）
  if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(fullName)) {
    const parts = fullName.trim().split(/\s+/)
    return parts[0] || fullName
  }
  
  // 英語の場合（名 姓）
  const parts = fullName.trim().split(/\s+/)
  if (parts.length >= 2) {
    return parts[parts.length - 1] // 最後の部分が姓
  }
  
  return fullName
}

/**
 * 複数著者をAPA形式でフォーマット
 * @param {Array} authors - 著者配列
 * @returns {string} フォーマットされた著者名
 */
function formatMultipleAuthors(authors) {
  if (!authors || authors.length === 0) { return '' }
  
  const names = authors.map(author => {
    const name = typeof author === 'string' ? author : author.name
    return name || ''
  }).filter(name => name.trim())
  
  if (names.length === 0) { return '' }
  if (names.length === 1) { return names[0] }
  if (names.length === 2) { return `${names[0]} & ${names[1]}` }
  if (names.length <= 20) { return `${names[0]} et al.` }
  
  return `${names[0]} et al.`
}

/**
 * 年を抽出
 * @param {string} date - 日付文字列
 * @returns {string} 年
 */
function extractYear(date) {
  if (!date) { return '' }
  
  // YYYY-MM-DD形式から年を抽出
  const match = date.match(/(\d{4})/)
  return match ? match[1] : ''
}

/**
 * 本文中引用（in-text citation）を生成
 * @param {Object} reference - 参照オブジェクト
 * @param {string} format - 引用形式 (APA, MLA, Chicago, Harvard, IEEE)
 * @param {number} citationNumber - IEEE用の引用番号
 * @returns {string} 本文中引用
 */
export function generateInTextCitation(reference, format = 'APA', citationNumber = 1) {
  const authors = reference.authors || []
  const year = extractYear(reference.published_date || reference.publishedDate || reference.metadata?.publishedDate)
  const pages = reference.pages
  
  switch (format.toUpperCase()) {
    case 'APA': {
      // APA第7版: (著者, 年) 形式
      let authorText = ''
      
      if (authors.length === 0) {
        // 著者情報がない場合
        const fallbackAuthor = reference.author || reference.metadata?.author
        if (fallbackAuthor) {
          authorText = extractLastName(fallbackAuthor)
        } else {
          return '(著者不明, n.d.)'
        }
      } else if (authors.length === 1) {
        // 1名の著者
        const author = typeof authors[0] === 'string' ? authors[0] : authors[0].name
        authorText = extractLastName(author)
      } else if (authors.length === 2) {
        // 2名の著者: Smith & Jones
        const author1 = typeof authors[0] === 'string' ? authors[0] : authors[0].name
        const author2 = typeof authors[1] === 'string' ? authors[1] : authors[1].name
        authorText = `${extractLastName(author1)} & ${extractLastName(author2)}`
      } else {
        // 3名以上の著者: Smith et al.
        const author1 = typeof authors[0] === 'string' ? authors[0] : authors[0].name
        authorText = `${extractLastName(author1)} et al.`
      }
      
      if (year) {
        return `(${authorText}, ${year})`
      } else {
        return `(${authorText}, n.d.)`
      }
    }
      
    case 'MLA': {
      // MLA: (著者 ページ) または (著者)
      const mlaAuthor = formatAuthors(authors, true) || reference.author || reference.metadata?.author || '著者不明'
      if (pages) {
        return `(${mlaAuthor} ${pages})`
      } else {
        return `(${mlaAuthor})`
      }
    }
      
    case 'CHICAGO': {
      // Chicago: (著者 年, ページ) または (著者 n.d.)
      const chicagoAuthor = formatAuthors(authors, true) || reference.author || reference.metadata?.author || '著者不明'
      if (year && pages) {
        return `(${chicagoAuthor} ${year}, ${pages})`
      } else if (year) {
        return `(${chicagoAuthor} ${year})`
      } else {
        return `(${chicagoAuthor} n.d.)`
      }
    }
      
    case 'HARVARD': {
      // Harvard: (著者 年) または (著者 n.d.)
      const harvardAuthor = formatAuthors(authors, true) || reference.author || reference.metadata?.author || '著者不明'
      if (year) {
        return `(${harvardAuthor} ${year})`
      } else {
        return `(${harvardAuthor} n.d.)`
      }
    }
      
    case 'IEEE':
      // IEEE: [番号]
      return `[${citationNumber}]`
      
    default:
      return generateInTextCitation(reference, 'APA', citationNumber)
  }
}

/**
 * 完全な引用文を生成（参考文献リスト用）
 * @param {Object} reference - 参照オブジェクト
 * @param {string} format - 引用形式
 * @returns {string} 完全な引用文
 */
export function generateFullCitation(reference, format = 'APA') {
  const authors = reference.authors || []
  const year = extractYear(reference.published_date || reference.publishedDate || reference.metadata?.publishedDate)
  const title = reference.title || 'タイトル不明'
  const url = reference.url || reference.online_link
  const publisher = reference.publisher || reference.metadata?.publisher
  const journalName = reference.journal_name
  const volume = reference.volume
  const issue = reference.issue
  const pages = reference.pages
  const doi = reference.doi
  const accessedDate = reference.accessed_date || reference.accessedDate
  
  let citation
  
  switch (format.toUpperCase()) {
    case 'APA': {
      // APA 7th edition - citation.mdに基づく正確な形式
      const authorText = formatMultipleAuthors(authors) || reference.author || reference.metadata?.author || '著者不明'
      const yearText = year || 'n.d.'
      const titleText = title || 'タイトル不明'
      
      // 基本形式: 著者名, A. A. (出版年). タイトル. 出版元.
      citation = `${authorText} (${yearText}). ${titleText}.`
      
      // 雑誌論文の場合
      if (journalName) {
        // 雑誌名はイタリック体（ここではマークダウン形式で表現）
        citation += ` *${journalName}*`
        if (volume) { 
          citation += `, ${volume}` 
        }
        if (issue) { 
          citation += `(${issue})` 
        }
        if (pages) { 
          citation += `, ${pages}` 
        }
        citation += '.'
        
        // DOIまたはURL
        if (doi) {
          citation += ` https://doi.org/${doi.replace(/^https?:\/\/doi\.org\//, '')}`
        } else if (url) {
          citation += ` ${url}`
        }
      } 
      // 書籍の場合
      else if (publisher) {
        citation += ` ${publisher}.`
        if (url) {
          citation += ` ${url}`
        }
      }
      // ウェブページの場合
      else if (url) {
        citation += ` ${url}`
      }
      
      // アクセス日（ウェブページの場合のみ）
      if (accessedDate && url) {
        const accessDate = new Date(accessedDate).toLocaleDateString('ja-JP', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
        citation += ` (${accessDate}閲覧)`
      }
      
      break
    }
    
    case 'MLA': {
      // MLA 9th edition
      const mlaAuthor = formatMultipleAuthors(authors) || reference.author || reference.metadata?.author || '著者不明'
      citation = `${mlaAuthor}. "${title}."`
      
      if (journalName) {
        citation += ` ${journalName}`
        if (volume) { citation += `, vol. ${volume}` }
        if (issue) { citation += `, no. ${issue}` }
        if (pages) { citation += `, ${pages}` }
        citation += `, ${year}`
      } else if (publisher) {
        citation += ` ${publisher}, ${year}`
      } else {
        citation += ` ${year}`
      }
      
      if (url) {
        citation += `, ${url}`
      }
      
      if (accessedDate) {
        citation += `. Accessed ${accessedDate}`
      }
      
      break
    }
    
    case 'CHICAGO': {
      // Chicago 17th edition
      const chicagoAuthor = formatMultipleAuthors(authors) || reference.author || reference.metadata?.author || '著者不明'
      citation = `${chicagoAuthor}. "${title}."`
      
      if (journalName) {
        citation += ` ${journalName}`
        if (volume) { citation += ` ${volume}` }
        if (issue) { citation += `, no. ${issue}` }
        if (pages) { citation += ` (${year}): ${pages}` }
      } else if (publisher) {
        citation += ` ${publisher}, ${year}`
      } else {
        citation += ` ${year}`
      }
      
      if (url) {
        citation += `. ${url}`
      }
      
      if (accessedDate) {
        citation += ` (accessed ${accessedDate})`
      }
      
      break
    }
    
    case 'HARVARD': {
      // Harvard referencing
      const harvardAuthor = formatMultipleAuthors(authors) || reference.author || reference.metadata?.author || '著者不明'
      citation = `${harvardAuthor} ${year}, '${title}',`
      
      if (journalName) {
        citation += ` ${journalName}`
        if (volume) { citation += `, vol. ${volume}` }
        if (issue) { citation += `, no. ${issue}` }
        if (pages) { citation += `, pp. ${pages}` }
      } else if (publisher) {
        citation += ` ${publisher}`
      }
      
      if (url) {
        citation += `, viewed ${accessedDate || 'n.d.'}, <${url}>`
      }
      
      break
    }
    
    case 'IEEE': {
      // IEEE format
      const ieeeAuthor = formatMultipleAuthors(authors) || reference.author || reference.metadata?.author || '著者不明'
      citation = `${ieeeAuthor}, "${title},"`
      
      if (journalName) {
        citation += ` ${journalName}`
        if (volume) { citation += `, vol. ${volume}` }
        if (issue) { citation += `, no. ${issue}` }
        if (pages) { citation += `, pp. ${pages}` }
        citation += `, ${year}`
      } else if (publisher) {
        citation += ` ${publisher}, ${year}`
      } else {
        citation += ` ${year}`
      }
      
      if (doi) {
        citation += `, doi: ${doi}`
      } else if (url) {
        citation += `, ${url}`
      }
      
      break
    }
    
    default:
      return generateFullCitation(reference, 'APA')
  }
  
  return citation
}
