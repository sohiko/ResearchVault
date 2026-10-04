import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { stripTypeScriptTypes } from 'node:module'

process.env.VITE_SUPABASE_URL = 'https://fixture.supabase.invalid'
process.env.SUPABASE_URL = process.env.VITE_SUPABASE_URL
process.env.VITE_SUPABASE_ANON_KEY = 'fixture-public-key'
process.env.SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY
process.env.SUPABASE_SERVICE_ROLE_KEY = 'must-never-be-used-for-user-data'

const userId = '10000000-0000-4000-8000-000000000001'
const modules = [
  ['candidates', '../api/candidates.js', 'GET'],
  ['invitations', '../api/invitations.js', 'GET'],
  ['selected texts', '../api/selected-texts.js', 'GET'],
  ['project', '../api/projects/[id].js', 'GET'],
  ['citations', '../api/citations/generate.js', 'POST']
]
function response() {
  return { statusCode: 200, setHeader() {}, status(code) {this.statusCode = code; return this},
    json(body) {this.body = body; return this}, end() {return this} }
}
for (const [name, path, method] of modules) {
  test(`${name}: unsigned requests are rejected`, async () => {
    const { default: handler } = await import(path)
    const res = response()
    await handler({ method, headers: {}, query: { id: 'fixture-project' }, body: {} }, res)
    assert.equal(res.statusCode, 401)
  })
  test(`${name}: data requests keep the caller JWT and public API key`, async () => {
    const original = globalThis.fetch
    const requests = []
    globalThis.fetch = async (url, options = {}) => {
      const headers = new Headers(options.headers)
      requests.push({ url: String(url), headers })
      const body = String(url).includes('/auth/v1/user') ? { id: userId, aud: 'authenticated' }
        : String(url).includes('/rest/v1/projects?') ? { id: 'fixture-project', owner_id: userId, name: 'Fixture', profiles: { name: 'A' } } : []
      return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    try {
      const { default: handler } = await import(path)
      const res = response()
      await handler({ method, headers: { authorization: 'Bearer fixture-user-token' }, query: { id: 'fixture-project' },
        body: { url: 'https://fixture.invalid', title: 'Fixture' } }, res)
      assert.equal(res.statusCode, 200)
      assert.ok(requests.length > 0)
      for (const request of requests) {
        assert.equal(request.headers.get('authorization'), 'Bearer fixture-user-token')
        assert.equal(request.headers.get('apikey'), 'fixture-public-key')
      }
    } finally { globalThis.fetch = original }
  })
}

const edgeSource = fs.readFileSync(new URL('../../supabase/functions/send-invitation-email/index.ts', import.meta.url), 'utf8')
function edgeHarness({ authenticated = true, invitation = true, owner = true, alreadySent = false, recipientMatches = true } = {}) {
  let handler
  const sent = []
  const client = {
    auth: { getUser: async () => ({ data: { user: authenticated ? { id: userId } : null }, error: null }) },
    rpc: async () => ({ data: recipientMatches ? [{ id: 'fixture-invitee' }] : [], error: null }),
    from(table) {
      const result = table === 'project_invitations' ? (invitation ? {
        id: 'fixture-invitation', project_id: 'fixture-project', inviter_id: userId,
        invitee_id: 'fixture-invitee', invitee_email: 'approved@fixture.invalid', role: 'viewer', message: '<script>fixture</script>',
        status: 'accepted', email_sent_at: alreadySent ? '2026-10-04' : null
      } : null) : table === 'projects' ? { id: 'fixture-project', owner_id: owner ? userId : 'other', name: '<Fixture>', description: 'safe' }
        : table === 'profiles' ? { name: 'A' } : null
      const builder = { select() {return this}, eq() {return this}, is() {return this}, update() {return this},
        single: async () => ({ data: result, error: null }), maybeSingle: async () => ({ data: result, error: null }) }
      return builder
    }
  }
  vm.runInNewContext(stripTypeScriptTypes(edgeSource.replace(/^import .*;\s*$/gm, '')), {
    Deno: { serve(fn) {handler = fn}, env: { get(key) {return key === 'MAIL_FROM' ? 'fixture@fixture.invalid' : 'fixture'} } },
    createClient: () => client, console, Request, Response,
    fetch: async (url, options) => {sent.push({ url, ...options }); return new Response('{}', {status: 200})}
  })
  return { sent, run: (authorization = 'Bearer fixture') => handler(new Request('https://fixture.invalid', {
    method: 'POST', headers: authorization ? { Authorization: authorization } : {},
    body: JSON.stringify({ invitationId: 'fixture-invitation', inviteeEmail: 'attacker@fixture.invalid',
      siteUrl: 'https://attacker.invalid', projectName: 'Forged' })
  })) }
}
for (const [label, options, token, expected] of [
  ['missing token', {}, null, 401], ['invalid user', { authenticated: false }, 'Bearer fixture', 401],
  ['unrelated invitation', { invitation: false }, 'Bearer fixture', 403],
  ['no project authority', { owner: false }, 'Bearer fixture', 403],
  ['stored recipient mismatch', { recipientMatches: false }, 'Bearer fixture', 403]
]) {
  test(`invitation mail rejects ${label} without sending`, async () => {
    const harness = edgeHarness(options)
    assert.equal((await harness.run(token)).status, expected)
    assert.equal(harness.sent.length, 0)
  })
}
test('invitation mail uses database recipient and fixed site URL, escapes HTML, and sets idempotency', async () => {
  const harness = edgeHarness()
  assert.equal((await harness.run()).status, 200)
  const body = JSON.parse(harness.sent[0].body)
  assert.deepEqual(body.to, ['approved@fixture.invalid'])
  assert.match(body.html, /&lt;Fixture&gt;/)
  assert.doesNotMatch(body.html, /<script>|attacker\.invalid|Forged/)
  assert.match(body.html, /https:\/\/rv\.insas\.jp\/projects\/fixture-project/)
  assert.equal(harness.sent[0].headers['Idempotency-Key'], 'invitation/fixture-invitation')
})
test('invitation mail does not resend a completed invitation', async () => {
  const harness = edgeHarness({ alreadySent: true })
  assert.equal((await harness.run()).status, 200)
  assert.equal(harness.sent.length, 0)
})
