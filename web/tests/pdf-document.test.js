import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readPdfDocument, validatePdfBytes, repositoryCoverMetadata } from '../lib/pdfDocument.js'
import handler from '../api/pdf-proxy.js'

import { fixturePdf, fixtureCjkPdf } from './fixtures/pdf.js'
import { loadServerPdfJs, serverPdfResources } from '../lib/pdfServer.js'

test('real PDF parser extracts title, author and text without a Gemini key', async () => {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const result = await readPdfDocument(fixturePdf(), pdfjs)
  assert.equal(result.metadata.title, 'A scientific study')
  assert.equal(result.metadata.authors[0].name, 'Jane Smith')
  assert.match(result.content, /Published 2020-05-20/)
  assert.equal(result.metadata.pdfPageCount, 1)
  assert.equal(result.metadata.publishedDate, '2020-05-20') // stated publication, not the 2026 PDF creation timestamp
})

test('HTML returned at a PDF URL is rejected before AI receives it', () => {
  assert.throws(() => validatePdfBytes(Buffer.from('<html>Sign in</html>')), /PDFではありません/)
})

test('Japanese CID fonts decode through bundled CMaps without Gemini', async () => {
  const result = await readPdfDocument(fixtureCjkPdf(), await loadServerPdfJs(), serverPdfResources)
  assert.match(result.content, /日本語の論文/)
})

test('repository cover retains explicit bibliography even without a Gemini key', () => {
  const result = repositoryCoverMetadata('九州大学学術情報リポジトリ\nKyushu University Institutional Repository\n九州大学学生の栄養摂取状況について\n上園, 慶子\n九州大学健康科学センター\nhttps://doi.org/10.15017/468\n出版情報：健康科学. 9, pp.15-19, 1987-03-28. 九州大学健康科学センター\n本文では1985年の調査を記述する。')
  assert.equal(result.title, '九州大学学生の栄養摂取状況について')
  assert.equal(result.publishedDate, '1987-03-28')
  assert.equal(result.journalName, '健康科学')
  assert.equal(result.volume, '9')
  assert.equal(result.pages, '15-19')
  assert.equal(result.publisher, '九州大学健康科学センター')
  assert.deepEqual(repositoryCoverMetadata('Ordinary text. Published in 1985.'), {})
})

test('text proxy returns extracted metadata and body rather than PDF base64', async () => {
  const original = globalThis.fetch
  globalThis.fetch = async () => new Response(fixturePdf(), { headers: { 'content-type': 'application/pdf' } })
  const res = { code: 200, setHeader() {}, status(code) { this.code = code; return this }, json(body) { this.body = body; return this } }
  try {
    await handler({ method: 'POST', body: { url: 'https://example.org/paper.pdf', format: 'text' } }, res)
    assert.equal(res.code, 200)
    assert.equal(res.body.success, true)
    assert.equal(res.body.metadata.title, 'A scientific study')
    assert.match(res.body.content, /scientific study/)
    assert.equal(res.body.data, undefined)
  } finally { globalThis.fetch = original }
})
