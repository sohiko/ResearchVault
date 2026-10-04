import fs from 'node:fs'
import assert from 'node:assert/strict'

// Public compatibility key already shipped in the application. No service key,
// real user session, record retrieval, fixture insertion, or email delivery.
const source = fs.readFileSync(new URL('../web/src/lib/supabase.js', import.meta.url), 'utf8')
const key = source.match(/const supabaseAnonKey = .*?\|\| '([^']+)'/)[1]
const database = 'https://pzplwtvnxikhykqsvcfs.supabase.co'
const site = 'https://rv.insas.jp'
const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
let passed = 0
async function check(url, options, expected) {
  const res = await fetch(url, { ...options, signal: AbortSignal.timeout(15000) })
  assert.ok(expected.includes(res.status), `${url}: unexpected ${res.status}`)
  await res.body?.cancel()
  passed++
}
await check(site, {}, [200])
for (const endpoint of ['invitations', 'projects', 'candidates', 'selected-texts', 'projects/ffffffff-ffff-4fff-8fff-ffffffffffff']) {
  await check(`${site}/api/${endpoint}`, {}, [401])
  await check(`${site}/api/${endpoint}`, { headers: { Authorization: 'Bearer invalid-security-test' } }, [401])
}
for (const table of ['profiles','projects','project_members','references','selected_texts','bookmarks','activity_logs','project_invitations','feature_requests','tags','reference_tags','citation_settings','browsing_history_candidates','user_statistics','project_statistics']) {
  await check(`${database}/rest/v1/${table}?select=*&limit=0`, { headers }, [401,403])
}
await check(`${database}/rest/v1/rpc/get_all_user_statistics`, { method: 'POST', headers, body: '{}' }, [401,403])
for (const name of ['send-invitation-email','clever-responder']) {
  // Gateway rejects the missing user session before the handler can send mail.
  await check(`${database}/functions/v1/${name}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }, [401,403])
}
console.log(JSON.stringify({ passed, production: true, realRecordsRetrieved: false, emailsSent: false }, null, 2))
