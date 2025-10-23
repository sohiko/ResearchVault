/**
 * ISBN検索APIクライアント
 * Google Books API → Open Library APIの順で試行
 */

/**
 * ISBN番号を正規化（ハイフンを削除）
 */
export function normalizeISBN(isbn) {
  return isbn.replace(/[-\s]/g, '')
}

/**
 * Google Books APIで書籍情報を取得
 */
async function fetchFromGoogleBooks(isbn) {
  const normalizedISBN = normalizeISBN(isbn)
  const url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${normalizedISBN}`
  
  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Google Books API error: ${response.status}`)
    }
    
    const data = await response.json()
    
    if (!data.items || data.items.length === 0) {
      return null
    }
    
    const book = data.items[0].volumeInfo
    
    // 著者情報を配列形式に変換
    const authors = book.authors ? book.authors.map((name, index) => ({
      name,
      order: index + 1
    })) : []
    
    // 出版日を解析
    let publishedDate = null
    if (book.publishedDate) {
      try {
        // YYYY-MM-DD形式に変換
        if (book.publishedDate.match(/^\d{4}$/)) {
          publishedDate = `${book.publishedDate}-01-01`
        } else if (book.publishedDate.match(/^\d{4}-\d{2}$/)) {
          publishedDate = `${book.publishedDate}-01`
        } else {
          publishedDate = book.publishedDate
        }
      } catch (e) {
        console.warn('Failed to parse publishedDate:', e)
      }
    }
    
    return {
      title: book.title,
      authors,
      publisher: book.publisher,
      publishedDate,
      pages: book.pageCount ? `${book.pageCount}pp` : null,
      isbn: normalizedISBN,
      description: book.description,
      language: book.language || 'ja',
      onlineLink: book.infoLink,
      thumbnail: book.imageLinks?.thumbnail,
      source: 'Google Books'
    }
  } catch (error) {
    console.error('Google Books API error:', error)
    return null
  }
}

/**
 * Open Library APIで書籍情報を取得
 */
async function fetchFromOpenLibrary(isbn) {
  const normalizedISBN = normalizeISBN(isbn)
  const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${normalizedISBN}&format=json&jscmd=data`
  
  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Open Library API error: ${response.status}`)
    }
    
    const data = await response.json()
    const bookKey = `ISBN:${normalizedISBN}`
    
    if (!data[bookKey]) {
      return null
    }
    
    const book = data[bookKey]
    
    // 著者情報を配列形式に変換
    const authors = book.authors ? book.authors.map((author, index) => ({
      name: author.name,
      order: index + 1
    })) : []
    
    // 出版日を解析
    let publishedDate = null
    if (book.publish_date) {
      try {
        const date = new Date(book.publish_date)
        if (!isNaN(date.getTime())) {
          publishedDate = date.toISOString().split('T')[0]
        }
      } catch (e) {
        console.warn('Failed to parse publish_date:', e)
      }
    }
    
    return {
      title: book.title,
      authors,
      publisher: book.publishers ? book.publishers[0]?.name : null,
      publishedDate,
      pages: book.number_of_pages ? `${book.number_of_pages}pp` : null,
      isbn: normalizedISBN,
      description: book.notes || book.subtitle,
      language: 'ja', // Open Libraryは言語情報が不完全
      onlineLink: book.url,
      thumbnail: book.cover?.medium || book.cover?.small,
      source: 'Open Library'
    }
  } catch (error) {
    console.error('Open Library API error:', error)
    return null
  }
}

/**
 * ISBNから書籍情報を取得
 * Google Books API → Open Library APIの順で試行
 */
export async function fetchBookByISBN(isbn) {
  if (!isbn) {
    throw new Error('ISBNが指定されていません')
  }
  
  const normalizedISBN = normalizeISBN(isbn)
  
  // ISBN-10またはISBN-13の形式チェック
  if (!normalizedISBN.match(/^(\d{10}|\d{13})$/)) {
    throw new Error('無効なISBN形式です（10桁または13桁の数字を入力してください）')
  }
  
  console.log('Fetching book info for ISBN:', normalizedISBN)
  
  // 1. Google Books APIを試行
  let result = await fetchFromGoogleBooks(normalizedISBN)
  if (result) {
    console.log('Book found in Google Books')
    return result
  }
  
  // 2. Open Library APIを試行
  result = await fetchFromOpenLibrary(normalizedISBN)
  if (result) {
    console.log('Book found in Open Library')
    return result
  }
  
  // 両方で見つからなかった場合
  throw new Error('書籍情報が見つかりませんでした。ISBNを確認してください。')
}

/**
 * ISBN検証
 */
export function validateISBN(isbn) {
  const normalized = normalizeISBN(isbn)
  
  // ISBN-10またはISBN-13の形式チェック
  if (!normalized.match(/^(\d{10}|\d{13})$/)) {
    return false
  }
  
  // ISBN-10のチェックサム検証
  if (normalized.length === 10) {
    let sum = 0
    for (let i = 0; i < 9; i++) {
      sum += parseInt(normalized[i]) * (10 - i)
    }
    const checkDigit = normalized[9].toUpperCase() === 'X' ? 10 : parseInt(normalized[9])
    return (sum + checkDigit) % 11 === 0
  }
  
  // ISBN-13のチェックサム検証
  if (normalized.length === 13) {
    let sum = 0
    for (let i = 0; i < 12; i++) {
      sum += parseInt(normalized[i]) * (i % 2 === 0 ? 1 : 3)
    }
    const checkDigit = parseInt(normalized[12])
    return (10 - (sum % 10)) % 10 === checkDigit
  }
  
  return false
}

