import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import handler, { isDatabaseReachable } from '../api/health.js'

const originalFetch = globalThis.fetch
after(() => { globalThis.fetch = originalFetch })

function response() {
  return {
    code: 200,
    setHeader() {},
    status(code) { this.code = code; return this },
    json(body) { this.body = body; return this },
    end() { return this },
  }
}

async function request(fetchImpl) {
  globalThis.fetch = fetchImpl
  const res = response()
  await handler({ method: 'GET', headers: {} }, res)
  return res
}

test('permission-denied probe errors count as reachable', () => {
  assert.equal(isDatabaseReachable(null), true)
  assert.equal(isDatabaseReachable({ code: '42501', message: 'permission denied for table projects' }), true)
  assert.equal(isDatabaseReachable({ message: 'new row violates row-level security policy' }), true)
  assert.equal(isDatabaseReachable({ code: 'PGRST002', message: 'Could not connect to the database' }), false)
  assert.equal(isDatabaseReachable({ message: 'fetch failed' }), false)
})

test('health reports database true when PostgREST returns 42501', async () => {
  const res = await request(async () => new Response(JSON.stringify({
    code: '42501',
    details: null,
    hint: null,
    message: 'permission denied for table projects',
  }), { status: 401, headers: { 'Content-Type': 'application/json' } }))

  assert.equal(res.code, 200)
  assert.equal(res.body.status, 'healthy')
  assert.equal(res.body.api, true)
  assert.equal(res.body.database, true)
  assert.equal(res.body.version, '1.0.0')
  assert.ok(res.body.timestamp)
  assert.ok(res.body.environment)
  assert.equal(res.body.error, undefined)
  assert.deepEqual(Object.keys(res.body).sort(), [
    'api', 'database', 'environment', 'status', 'timestamp', 'version',
  ])
})

test('health reports database true when the probe query succeeds', async () => {
  const res = await request(async () => new Response('[]', {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  }))

  assert.equal(res.code, 200)
  assert.equal(res.body.database, true)
})

test('health reports database false when the database is unreachable', async () => {
  const res = await request(async () => {
    throw new TypeError('fetch failed')
  })

  assert.equal(res.code, 200)
  assert.equal(res.body.status, 'healthy')
  assert.equal(res.body.api, true)
  assert.equal(res.body.database, false)
  assert.equal(res.body.error, undefined)
})

test('health reports database false on gateway failures', async () => {
  const res = await request(async () => new Response(JSON.stringify({
    message: 'Could not connect to the database',
  }), { status: 503, headers: { 'Content-Type': 'application/json' } }))

  assert.equal(res.code, 200)
  assert.equal(res.body.database, false)
})

test('health rejects non-GET methods', async () => {
  const res = response()
  await handler({ method: 'POST', headers: {} }, res)
  assert.equal(res.code, 405)
})
