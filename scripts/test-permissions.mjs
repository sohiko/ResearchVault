import fs from 'node:fs'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { PGlite } from '../supabase/tests/node_modules/@electric-sql/pglite/dist/index.js'
process.chdir(fileURLToPath(new URL('../', import.meta.url)))
process.on('uncaughtException', error => {
  console.error(error.message, error.code || '', error.query || '')
  process.exit(1)
})

const db = new PGlite()
const baseline = JSON.parse(fs.readFileSync('supabase/tests/baseline-metadata.json', 'utf8'))
const migrationPath = 'supabase/migrations/20261004112223_harden_researchvault_permissions.sql'
await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
  CREATE ROLE supabase_auth_admin; CREATE SCHEMA auth;
  CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb DEFAULT '{}');
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
    $$ SELECT (NULLIF(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;
`)
await db.exec(`CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS
  $$ SELECT COALESCE(NULLIF(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb) $$;
  GRANT USAGE ON SCHEMA auth,public TO anon,authenticated,service_role,supabase_auth_admin;
  GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO anon,authenticated,service_role;
  CREATE FUNCTION public.uuid_generate_v4() RETURNS uuid LANGUAGE sql AS $$ SELECT gen_random_uuid() $$;`)
let schema = fs.readFileSync('supabase/sql/main.sql', 'utf8')
const foreignKeys = [...schema.matchAll(/^\s*(CONSTRAINT \w+ FOREIGN KEY[^\n]+),?\s*$/gm)].map(match => match[1])
const tables = [...schema.matchAll(/CREATE TABLE public\.(\w+) \(([\s\S]*?)\n\);/g)]
for (const [, table, body] of tables) {
  const clean = body.replace(/^\s*CONSTRAINT \w+ FOREIGN KEY[^\n]+\n?/gm, '').replace(/,\s*$/, '')
  await db.exec(`CREATE TABLE public."${table}" (${clean});`)
}
for (const [, table, body] of tables) {
  for (const key of foreignKeys.filter(key => body.includes(key))) await db.exec(`ALTER TABLE public."${table}" ADD ${key.trim().replace(/,$/, '')};`)
}
for (const f of baseline.functions) await db.exec(f.definition)
for (const trigger of baseline.triggers) await db.exec(`${trigger};`)
await db.exec(`CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
 CREATE VIEW public.user_statistics AS SELECT id,name,email FROM public.profiles;
 CREATE VIEW public.project_statistics AS SELECT id,name,owner_id FROM public.projects;
 GRANT ALL ON ALL TABLES IN SCHEMA public TO anon,authenticated,service_role;
 GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon,authenticated,service_role;`)
for (const table of baseline.tables) if (table.rls) await db.exec(`ALTER TABLE public."${table.name}" ENABLE ROW LEVEL SECURITY;`)
for (const policy of baseline.policies) {
  await db.exec(`CREATE POLICY "${policy.policyname.replaceAll('"','""')}" ON public."${policy.tablename}"
    AS ${policy.permissive} FOR ${policy.cmd} TO ${policy.roles.map(role => `"${role}"`).join(',')}
    ${policy.qual ? `USING (${policy.qual})` : ''} ${policy.with_check ? `WITH CHECK (${policy.with_check})` : ''};`)
}
const migration = fs.readFileSync(migrationPath, 'utf8')
await db.exec(`BEGIN; ${migration}; COMMIT;`)
await db.exec(fs.readFileSync('supabase/migrations/20261007170905_fix_reference_insert_returning.sql', 'utf8'))
fs.writeFileSync('supabase/tests/expected-security.json',JSON.stringify({
  policies: (await db.query("SELECT * FROM pg_policies WHERE schemaname='public' ORDER BY tablename,policyname")).rows
},null,2)+'\n')
// uuid-ossp is in extensions on Supabase; the local compatibility shim needs this grant.
await db.exec('GRANT EXECUTE ON FUNCTION public.uuid_generate_v4() TO authenticated;')

const ids = Object.fromEntries(['a','b','admin','pa','pb','ps','ra','rb','rs','ta','tb','ba','bb','session'].map((name,i) => [name,`10000000-0000-4000-8000-${(i+1).toString().padStart(12,'0')}`]))
const verificationSql=[]
let record=true
const originalExec=db.exec.bind(db)
await originalExec('BEGIN')
db.exec=async sql => {
  if(record) verificationSql.push(sql)
  return originalExec(sql)
}
await db.exec(`INSERT INTO auth.users(id,email) VALUES
 ('${ids.a}','a@security.invalid'),('${ids.b}','b@security.invalid'),('${ids.admin}','admin@security.invalid');
 UPDATE public.profiles SET gemini_api_key='synthetic-secret',is_admin=true WHERE id='${ids.b}';
 INSERT INTO public.projects(id,name,owner_id,is_link_sharing_enabled) VALUES
 ('${ids.pa}','private-A','${ids.a}',true),('${ids.pb}','private-B','${ids.b}',false),('${ids.ps}','shared','${ids.a}',false);
 UPDATE public.projects SET link_sharing_token='30000000-0000-4000-8000-000000000001' WHERE id='${ids.pa}';
 INSERT INTO public.project_members(project_id,user_id,role) VALUES ('${ids.ps}','${ids.b}','viewer');
 INSERT INTO public."references"(id,project_id,saved_by,url) VALUES
 ('${ids.ra}','${ids.pa}','${ids.a}','https://a.invalid'),('${ids.rb}','${ids.pb}','${ids.b}','https://b.invalid'),('${ids.rs}','${ids.ps}','${ids.a}','https://shared.invalid');
 INSERT INTO public.selected_texts(id,reference_id,project_id,created_by,text) VALUES
 ('${ids.ta}','${ids.ra}','${ids.pa}','${ids.a}','A'),('${ids.tb}','${ids.rb}','${ids.pb}','${ids.b}','B');
 INSERT INTO public.bookmarks(id,reference_id,project_id,created_by) VALUES
 ('${ids.ba}','${ids.ra}','${ids.pa}','${ids.a}'),('${ids.bb}','${ids.rb}','${ids.pb}','${ids.b}');
 INSERT INTO public.feature_requests(user_id,title,description) VALUES ('${ids.a}','A','fixture'),('${ids.b}','B','fixture');`)
let checks = 0
async function role(user, admin=false) {
  await db.exec(`RESET ROLE; SELECT set_config('request.jwt.claims','${JSON.stringify(user ? {sub:ids[user],role:'authenticated',session_id:ids.session,app_metadata:{is_admin:admin}} : {role:'anon'})}',false); SET ROLE ${user ? 'authenticated' : 'anon'};`)
}
async function rows(sql,count) {
  // Scope fixture counts so the same test can run in a rollback-only production transaction.
  if(!sql.includes(' WHERE ') && /FROM public\.\w+$/.test(sql)) {
    const column=sql.endsWith('feature_requests')?'user_id':'id'
    sql+=` WHERE ${column} IN ('${ids.a}','${ids.b}','${ids.admin}','${ids.pa}','${ids.pb}','${ids.ps}','${ids.ta}','${ids.tb}','${ids.ba}','${ids.bb}')`
  } else if(sql==='SELECT * FROM public."references"') {
    sql+=` WHERE id IN ('${ids.ra}','${ids.rb}','${ids.rs}')`
  }
  assert.equal((await db.query(sql)).rows.length,count,sql)
  verificationSql.push(`DO $test$ BEGIN IF (SELECT count(*) FROM (${sql}) q) <> ${count} THEN RAISE EXCEPTION 'Fixture count assertion failed: ${checks+1}'; END IF; END $test$;`)
  checks++
}
async function denied(sql) {
  let rejected=false; record=false
  await originalExec('SAVEPOINT expected_denial')
  try { await db.exec(sql) } catch(e) { rejected=e.code==='42501'; if(!rejected) throw e }
  finally { await originalExec('ROLLBACK TO SAVEPOINT expected_denial; RELEASE SAVEPOINT expected_denial'); record=true }
  assert.ok(rejected,sql)
  verificationSql.push(`DO $test$ BEGIN BEGIN ${sql}; RAISE EXCEPTION 'Expected permission denial: ${checks+1}'; EXCEPTION WHEN insufficient_privilege THEN NULL; END; END $test$;`)
  checks++
}
async function scalar(sql,value) {
  assert.equal(Object.values((await db.query(sql)).rows[0])[0],value,sql)
  const literal=typeof value==='string'?`'${value.replaceAll("'","''")}'`:String(value)
  verificationSql.push(`DO $test$ BEGIN IF (${sql}) IS DISTINCT FROM ${literal} THEN RAISE EXCEPTION 'Fixture value assertion failed: ${checks+1}'; END IF; END $test$;`)
  checks++
}
for (const user of [null,'a','b','admin']) {
  await role(user,user==='admin')
  await denied('SELECT * FROM public.user_statistics')
  await denied('SELECT * FROM public.project_statistics')
  await denied('SELECT * FROM public.get_all_user_statistics()')
  await denied('SELECT public.cleanup_test_data()')
}
await role(null)
await denied('SELECT * FROM public.profiles')
await denied(`SELECT public.regenerate_link_sharing_token('${ids.pa}')`)
await role('a')
await rows('SELECT * FROM public.profiles',1)
await rows(`SELECT * FROM public.profiles WHERE id='${ids.b}'`,0)
await rows('SELECT * FROM public.projects',2)
await rows('SELECT * FROM public."references"',2)
await rows('SELECT * FROM public.selected_texts',1)
await rows('SELECT * FROM public.bookmarks',1)
await denied(`UPDATE public.profiles SET is_admin=true WHERE id='${ids.a}'`)
await denied(`INSERT INTO public.profiles(id,email,is_admin) VALUES ('${ids.a}','x@security.invalid',true)`)
await denied(`INSERT INTO public.project_members VALUES ('${ids.pb}','${ids.a}','admin',now())`)
await denied(`INSERT INTO public."references"(project_id,saved_by,url) VALUES ('${ids.pb}','${ids.a}','https://bad.invalid')`)
await denied(`UPDATE public.projects SET owner_id='${ids.b}' WHERE id='${ids.pa}'`)
await db.exec(`UPDATE public.profiles SET name='Updated A',gemini_api_key='replacement' WHERE id='${ids.a}'`)
await scalar(`SELECT name FROM public.profiles WHERE id='${ids.a}'`,'Updated A')
await rows(`SELECT * FROM public.find_project_invitee('${ids.ps}','b@security.invalid')`,1)
await role('b')
await rows('SELECT * FROM public.profiles',1)
await rows('SELECT * FROM public.projects',2)
await rows('SELECT * FROM public."references"',2)
await rows('SELECT * FROM public.selected_texts',1)
await rows('SELECT * FROM public.bookmarks',1)
await rows(`SELECT * FROM public.get_project_people('${ids.pa}')`,0)
await rows(`SELECT * FROM public.get_project_people('${ids.ps}')`,2)
await denied(`SELECT * FROM public.find_project_invitee('${ids.ps}','a@security.invalid')`)
await denied(`INSERT INTO public."references"(project_id,saved_by,url) VALUES ('${ids.ps}','${ids.b}','https://bad.invalid')`)
await db.exec(`UPDATE public.project_members SET role='admin' WHERE project_id='${ids.ps}' AND user_id='${ids.b}'`)
await scalar(`SELECT role FROM public.project_members WHERE project_id='${ids.ps}' AND user_id='${ids.b}'`,'viewer')
await rows('SELECT * FROM public.feature_requests',1) // legacy is_admin=true has no authority
await denied(`SELECT public.authorize_project_link('${ids.pa}','00000000-0000-0000-0000-000000000000')`)
await denied(`SELECT public.regenerate_link_sharing_token('${ids.pa}')`)
await db.exec('RESET ROLE')
const token = (await db.query(`SELECT link_sharing_token FROM public.projects WHERE id='${ids.pa}'`)).rows[0].link_sharing_token
await role('b')
await db.exec(`SELECT public.authorize_project_link('${ids.pa}','${token}')`)
await rows(`SELECT * FROM public.projects WHERE id='${ids.pa}'`,1)
await rows(`SELECT * FROM public."references" WHERE id='${ids.ra}'`,1)
await rows(`SELECT * FROM public.profiles WHERE id='${ids.a}'`,0)
await denied(`INSERT INTO public."references"(project_id,saved_by,url) VALUES ('${ids.pa}','${ids.b}','https://bad.invalid')`)
await role('a')
await db.exec(`SELECT public.regenerate_link_sharing_token('${ids.pa}')`)
await role('b')
await rows(`SELECT * FROM public.projects WHERE id='${ids.pa}'`,0)
await denied(`SELECT public.authorize_project_link('${ids.pa}','${token}')`)
await role('a')
await db.exec(`UPDATE public.project_members SET role='editor' WHERE project_id='${ids.ps}' AND user_id='${ids.b}'`)
await role('b')
await db.exec(`UPDATE public."references" SET title='Edited by B' WHERE id='${ids.rs}'`)
await scalar(`SELECT title FROM public."references" WHERE id='${ids.rs}'`,'Edited by B')
await denied(`UPDATE public."references" SET saved_by='${ids.b}' WHERE id='${ids.rs}'`)
await role('a')
await db.exec(`UPDATE public.projects SET deleted_at=now(),deleted_by='${ids.a}' WHERE id='${ids.ps}'`)
await role('b')
await rows(`SELECT * FROM public.projects WHERE id='${ids.ps}'`,0)
await role('a')
await db.exec(`UPDATE public.projects SET deleted_at=NULL,deleted_by=NULL WHERE id='${ids.ps}'`)
await role('b')
await rows(`SELECT * FROM public."references" WHERE id='${ids.rs}' AND deleted_at IS NULL`,1)
await db.exec(`UPDATE public.projects SET name='Editor rename' WHERE id='${ids.ps}'`)
await scalar(`SELECT name FROM public.projects WHERE id='${ids.ps}'`,'Editor rename')
await denied(`UPDATE public.projects SET is_link_sharing_enabled=true WHERE id='${ids.ps}'`)
await denied(`INSERT INTO public.selected_texts(reference_id,project_id,created_by,text) VALUES ('${ids.ra}','${ids.ps}','${ids.b}','invalid association')`)
await denied(`INSERT INTO public.bookmarks(reference_id,project_id,created_by) VALUES ('${ids.ra}','${ids.ps}','${ids.b}')`)
await rows(`SELECT * FROM public.activity_logs WHERE user_id='${ids.a}' AND project_id='${ids.pa}'`,0)
await denied(`INSERT INTO public.activity_logs(user_id,action) VALUES ('${ids.b}','FAKE')`)
await role('a')
await db.exec(`INSERT INTO public.citation_settings(user_id) VALUES ('${ids.a}');
 INSERT INTO public.browsing_history_candidates(user_id,url) VALUES ('${ids.a}','https://fixture.invalid');
 INSERT INTO public.tags(id,name,created_by) VALUES ('40000000-0000-4000-8000-000000000001','SECURITY_FIXTURE_A','${ids.a}');
 INSERT INTO public.reference_tags(reference_id,tag_id) VALUES ('${ids.ra}','40000000-0000-4000-8000-000000000001');`)
await rows(`SELECT * FROM public.citation_settings WHERE user_id='${ids.a}'`,1)
await rows(`SELECT * FROM public.browsing_history_candidates WHERE user_id='${ids.a}'`,1)
await rows(`SELECT * FROM public.tags WHERE id='40000000-0000-4000-8000-000000000001'`,1)
await role('b')
await rows(`SELECT * FROM public.citation_settings WHERE user_id='${ids.a}'`,0)
await rows(`SELECT * FROM public.browsing_history_candidates WHERE user_id='${ids.a}'`,0)
await rows(`SELECT * FROM public.tags WHERE id='40000000-0000-4000-8000-000000000001'`,0)
await rows(`SELECT * FROM public.reference_tags WHERE reference_id='${ids.ra}'`,0)
await denied(`INSERT INTO public.citation_settings(user_id) VALUES ('${ids.a}')`)
await denied(`INSERT INTO public.browsing_history_candidates(user_id,url) VALUES ('${ids.a}','https://forbidden.invalid')`)
await denied(`INSERT INTO public.reference_tags(reference_id,tag_id) VALUES ('${ids.ra}','40000000-0000-4000-8000-000000000001')`)
await denied(`INSERT INTO public.project_invitations(project_id,inviter_id,invitee_id,invitee_email) VALUES ('${ids.pa}','${ids.b}','${ids.admin}','admin@security.invalid')`)
await role('a')
await denied(`INSERT INTO public.project_invitations(project_id,inviter_id,invitee_id,invitee_email) VALUES ('${ids.pa}','${ids.a}','${ids.b}','attacker@security.invalid')`)
await db.exec(`INSERT INTO public.project_invitations(id,project_id,inviter_id,invitee_id,invitee_email,role) VALUES
 ('50000000-0000-4000-8000-000000000001','${ids.pa}','${ids.a}','${ids.b}','b@security.invalid','viewer');`)
await denied("UPDATE public.project_invitations SET invitee_email='attacker@security.invalid' WHERE id='50000000-0000-4000-8000-000000000001'")
await role('admin')
await rows(`SELECT * FROM public.project_invitations WHERE id='50000000-0000-4000-8000-000000000001'`,0)
await denied("SELECT public.respond_project_invitation('50000000-0000-4000-8000-000000000001','accepted')")
await role('b')
await db.exec("SELECT public.respond_project_invitation('50000000-0000-4000-8000-000000000001','accepted')")
await rows(`SELECT * FROM public.projects WHERE id='${ids.pa}'`,1)
await scalar(`SELECT role FROM public.project_members WHERE project_id='${ids.pa}' AND user_id='${ids.b}'`,'viewer')
await denied("SELECT public.respond_project_invitation('50000000-0000-4000-8000-000000000001','accepted')")
await db.exec(`DELETE FROM public.project_members WHERE project_id='${ids.pa}' AND user_id='${ids.b}'`)
await rows(`SELECT * FROM public.projects WHERE id='${ids.pa}'`,0)
await role('a')
await db.exec(`INSERT INTO public.projects(id,name,owner_id) VALUES ('60000000-0000-4000-8000-000000000001','Created by A','${ids.a}')`)
await rows("SELECT * FROM public.projects WHERE id='60000000-0000-4000-8000-000000000001'",1)
await denied(`INSERT INTO public.projects(name,owner_id) VALUES ('Forged owner','${ids.b}')`)
await db.exec(`UPDATE public.selected_texts SET project_id='${ids.ps}',reference_id='${ids.rs}' WHERE id='${ids.ta}'`)
await scalar(`SELECT project_id FROM public.selected_texts WHERE id='${ids.ta}'`,ids.ps)
await role('admin',true)
await rows('SELECT * FROM public.feature_requests',2)
await rows('SELECT * FROM public.get_feedback_authors()',2)
await rows('SELECT * FROM public.profiles',1)
await rows('SELECT * FROM public.projects',0)
await role('a')
await rows('SELECT * FROM public.get_feedback_authors()',0)
await db.exec('RESET ROLE')
await db.exec(`INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES ('20000000-0000-4000-8000-000000000001','new@security.invalid','{"name":"New","is_admin":true}')`)
await scalar("SELECT is_admin FROM public.profiles WHERE email='new@security.invalid'",false)
await scalar("SELECT name FROM public.profiles WHERE email='new@security.invalid'",'New')
console.log(JSON.stringify({ passed: checks, engine: 'PGlite PostgreSQL', syntheticOnly: true },null,2))
const portable=verificationSql.join(';\n')
await originalExec('RESET ROLE; ROLLBACK;')
await originalExec(`BEGIN; ${portable}; RESET ROLE; ROLLBACK;`)
fs.writeFileSync('supabase/tests/verify-permissions.sql',`-- Only synthetic fixtures; always rollback. Never remove the final ROLLBACK.\nBEGIN;\n${portable};\nRESET ROLE;\nROLLBACK;\nSELECT ${checks} AS passed_checks;\n`)
await originalExec(fs.readFileSync('supabase/tests/reference-returning.sql', 'utf8'))
console.log('Reference INSERT/UPDATE RETURNING and access-denial regressions passed')
await db.close()
