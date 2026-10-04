import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import handler from '../api/pdf-proxy.js'

const originalFetch = globalThis.fetch
after(() => { globalThis.fetch = originalFetch })

async function request(response) {
  globalThis.fetch = async () => response
  const res = {
    code: 200,
    setHeader() {},
    status(code) { this.code = code; return this },
    json(body) { this.body = body; return this },
  }
  await handler({ method: 'GET', query: { url: 'https://example.org/paper.pdf' } }, res)
  return res
}

test('small PDF retains the existing base64 response contract', async () => {
  const pdf = Buffer.from('%PDF-1.4\n')
  const res = await request(new Response(pdf, { headers: { 'content-type': 'application/pdf' } }))
  assert.equal(res.code, 200)
  assert.equal(res.body.success, true)
  assert.equal(res.body.data, pdf.toString('base64'))
  assert.equal(res.body.size, pdf.length)
})

test('rejects declared oversized PDF before downloading the body', async () => {
  let cancelled = false
  const response = {
    ok: true,
    headers: new Headers({ 'content-length': String(4 * 1024 * 1024) }),
    body: { async cancel() { cancelled = true } },
  }
  const res = await request(response)
  assert.equal(res.code, 413)
  assert.equal(cancelled, true)
  assert.equal(res.body.success, undefined)
})

test('bounds chunked PDFs without Content-Length and closes the stream', async () => {
  let closed = false
  const response = {
    ok: true,
    headers: new Headers(),
    body: (async function* () {
      try {
        yield Buffer.alloc(2 * 1024 * 1024)
        yield Buffer.alloc(2 * 1024 * 1024)
        assert.fail('must stop reading when the size limit is exceeded')
      } finally { closed = true }
    })(),
  }
  const res = await request(response)
  assert.equal(res.code, 413)
  assert.equal(closed, true)
})
