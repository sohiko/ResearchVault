import assert from 'node:assert/strict'
import { test } from 'node:test'
import proxyHandler from '../api/pdf-proxy.js'
const handler = (req, res) => proxyHandler({ ...req, body: { ...req.body, format: 'ai' } }, res)

const response = () => ({ code: 200, headers: {}, setHeader(name, value) { this.headers[name] = value },
  status(code) { this.code = code; return this }, json(body) { this.body = body; return this } })

test('AI fallback rejects anonymous callers without generating', async () => {
  const res = response()
  await handler({ method: 'POST', headers: {}, body: {} }, res)
  assert.equal(res.code, 401)
})

test('AI fallback refuses an invalid token before calling Gemini', async () => {
  const original = globalThis.fetch
  const previousUrl = process.env.SUPABASE_URL
  const previousKey = process.env.VITE_SUPABASE_ANON_KEY
  process.env.SUPABASE_URL = 'https://fixture.supabase.invalid'
  process.env.VITE_SUPABASE_ANON_KEY = 'fixture-public-key'
  let calls = 0
  globalThis.fetch = async url => {
    calls++
    assert.ok(String(url).includes('/auth/v1/user'))
    return Response.json({ message: 'Invalid token' }, { status: 401 })
  }
  try {
    const res = response()
    await handler({ method: 'POST', headers: { authorization: 'Bearer invalid-token' }, body: { apiKey: 'fixture-ai-key' } }, res)
    assert.equal(res.code, 401)
    assert.equal(calls, 1)
  } finally {
    globalThis.fetch = original
    if (previousUrl === undefined) {delete process.env.SUPABASE_URL} else {process.env.SUPABASE_URL = previousUrl}
    if (previousKey === undefined) {delete process.env.VITE_SUPABASE_ANON_KEY} else {process.env.VITE_SUPABASE_ANON_KEY = previousKey}
  }
})

test('AI fallback validates the user token before forwarding the user key', async () => {
  const original = globalThis.fetch
  const env = { url: process.env.SUPABASE_URL, key: process.env.VITE_SUPABASE_ANON_KEY }
  process.env.SUPABASE_URL = 'https://fixture.supabase.invalid'
  process.env.VITE_SUPABASE_ANON_KEY = 'fixture-public-key'
  const calls = []
  globalThis.fetch = async (url, options) => {
    calls.push(String(url))
    if (String(url).includes('/auth/v1/user')) {
      assert.equal(new Headers(options.headers).get('authorization'), 'Bearer fixture-token')
      return Response.json({ id: 'fixture-user' })
    }
    assert.equal(new Headers(options.headers).get('x-goog-api-key'), 'fixture-ai-key')
    return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ title: 'Real title', evidence: { title: 'Real title' } }) }] } }] })
  }
  try {
    const res = response()
    await handler({ method: 'POST', headers: { authorization: 'Bearer fixture-token' }, body: { apiKey: 'fixture-ai-key', content: 'Real title' } }, res)
    assert.equal(res.code, 200)
    assert.equal(res.body.metadata.title, 'Real title')
    assert.equal(res.headers['Cache-Control'], 'no-store')
    assert.equal(calls.length, 2)
    assert.ok(calls[0].includes('/auth/v1/user'))
  } finally {
    globalThis.fetch = original
    if (env.url === undefined) {delete process.env.SUPABASE_URL} else {process.env.SUPABASE_URL = env.url}
    if (env.key === undefined) {delete process.env.VITE_SUPABASE_ANON_KEY} else {process.env.VITE_SUPABASE_ANON_KEY = env.key}
  }
})
