import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readPdfDocument, validatePdfBytes } from '../lib/pdfDocument.js'
import handler from '../api/pdf-proxy.js'

import { fixturePdf } from './fixtures/pdf.js'

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
