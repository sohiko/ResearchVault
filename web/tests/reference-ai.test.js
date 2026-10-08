import assert from 'node:assert/strict'
import { test } from 'node:test'
import { generateReference } from '../src/lib/referenceAI.js'

async function aiRequest(payload, input = {}, status = 200) {
  const original = globalThis.fetch
  let request
  globalThis.fetch = async (url, options) => {
    request = { url, options, body: JSON.parse(options.body) }
    return new Response(JSON.stringify(payload), { status })
  }
  try { return { result: await generateReference({ apiKey: 'fixture-key', ...input }), request } }
  finally { globalThis.fetch = original }
}
const candidate = result => ({ candidates: [{ finishReason: 'STOP', content: { parts: [
  { text: 'Internal reasoning', thought: true }, { text: JSON.stringify(result) }
] } }] })

test('structured extraction rejects invented fields and ignores thought parts', async () => {
  const { result, request } = await aiRequest(candidate({ title: 'Real title', authors: [{ name: 'Jane' }, { name: 'Invented author' }],
    publishedDate: '2020', journalName: 'Invented Journal', publisher: 'Publisher',
    evidence: { title: 'Real title', publishedDate: '2020', journalName: 'Real title', publisher: 'Nonexistent quote' } }),
    { content: 'Real title. Jane. Published in 2020.' })
  assert.equal(result.title, 'Real title')
  assert.equal(result.publishedDate, '2020-01-01')
  assert.equal(result.publishedDatePrecision, 'year')
  assert.equal(result.journalName, '')
  assert.equal(result.publisher, '')
  assert.deepEqual(result.authors.map(author => author.name), ['Jane'])
  assert.equal(request.options.headers['x-goog-api-key'], 'fixture-key')
  assert.equal(request.body.generationConfig.responseMimeType, 'application/json')
  assert.equal(request.body.generationConfig.responseJsonSchema.type, 'object')
  assert.ok(request.options.signal)
  assert.doesNotMatch(request.url, /fixture-key/)
})

test('blocked, quota-limited and truncated output are recognizable failures', async () => {
  await assert.rejects(aiRequest({ promptFeedback: { blockReason: 'SAFETY' } }), error => error.code === 'GEMINI_BLOCKED')
  await assert.rejects(aiRequest({ error: { message: 'quota' } }, {}, 429), error => error.code === 'GEMINI_RATE_LIMIT')
  await assert.rejects(aiRequest({ candidates: [{ finishReason: 'MAX_TOKENS' }] }), /完了/)
})

test('evidence spanning PDF line breaks is preserved', async () => {
  const { result } = await aiRequest(candidate({ title: 'Long title', evidence: { title: 'Long\ntitle' } }), { content: 'Long\ntitle' })
  assert.equal(result.title, 'Long title')
})

test('Japanese bibliography survives glyph spacing in older PDF text', async () => {
  const { result } = await aiRequest(candidate({ title: '日本語の論文', authors: [{ name: '上園 慶子' }, { name: '架空 著者' }, { name: '川崎 晃一' }],
    evidence: { title: '日本語の論文' } }), { content: '日 本 語 の 論 文\n上 園 慶 子\n川崎, 晃一' })
  assert.equal(result.title, '日本語の論文')
  assert.deepEqual(result.authors.map(author => author.name), ['上園 慶子', '川崎 晃一'])
  assert.deepEqual(result.authors.map(author => author.order), [1, 2])
})
