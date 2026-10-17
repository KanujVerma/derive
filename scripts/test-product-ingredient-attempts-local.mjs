// Run with Node 22 --experimental-strip-types, against a task-owned stock-PG
// cluster on a private Unix socket. This never connects to Supabase or TCP.
// Auth/Storage and the existing catalog tables are explicit synthetic scaffolds;
// the new migration, row locks, RPCs, ACLs and FK cascades are real PostgreSQL.
import assert from 'node:assert/strict';
import { execFileSync, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync, writeFileSync, mkdirSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { ingredientEdgeFixture, owner, otherOwner, rootId, parentId, photoPath, requestId } from '../tests/helpers/ingredient-panel-edge.ts';
import { createFreeEvidenceProcessor } from '../src/presentation/capture/freeEvidenceProcessor.ts';
import { createIngredientContinuationProcessor } from '../src/presentation/capture/ingredientContinuationProcessor.ts';
import { createCheckCaptureBridge } from '../src/presentation/capture/checkCaptureAdapter.ts';
import { createIngredientPanelSession } from '../src/presentation/capture/ingredientPanelSession.ts';
import { resolveCatalogIdentity, continueCatalogIngredients } from '../src/services/productCatalog.ts';
import { verifiedProductTruth } from '../src/fixtures/product-truth/snapshots.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const socket = process.argv[2], port = process.argv[3];
assert.ok(socket?.startsWith('/tmp/derive-ingredient-pg-'), 'Explicit task-owned Unix socket is required');
assert.match(port ?? '', /^\d{4,5}$/);
const psql = process.env.DERIVE_TEST_PSQL ?? 'psql';
const env = { PATH: process.env.PATH, PGAPPNAME: 'derive-ingredient-attempt-test', LC_ALL: 'C' };
let database = 'postgres';
const args = () => ['-X', '-At', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose', '-h', socket, '-p', port, '-U', 'postgres', '-d', database];
const sql = text => execFileSync(psql, [...args(), '-c', text], { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const dataDirectory = realpathSync(sql('show data_directory'));
assert.ok(dataDirectory.startsWith(join(realpathSync(root), '.local-artifacts/ingredient-server-')), 'Refusing a shared or non-task PostgreSQL cluster');
database = `ingredient_attempts_${Date.now()}_${process.pid}`;
execFileSync(psql, ['-X', '-v', 'ON_ERROR_STOP=1', '-h', socket, '-p', port, '-U', 'postgres', '-d', 'postgres', '-c', `create database ${database}`], { env, stdio: 'pipe' });
const artifact = join(root, '.local-artifacts/ingredient-server-20261017', database); mkdirSync(artifact, { recursive: true });
const table = (source, name) => { const start = source.indexOf(`create table public.${name} (`); assert.ok(start >= 0); return source.slice(start, source.indexOf('\n);', start) + 3); };
const s6 = readFileSync(join(root, 'supabase/migrations/20260922220000_s6_product_identity_resolution.sql'), 'utf8');
const truth = readFileSync(join(root, 'supabase/migrations/20260927010000_p0a_product_truth_snapshots.sql'), 'utf8');
const child = readFileSync(join(root, 'supabase/migrations/20260929070000_product_check_ingredient_continuation.sql'), 'utf8');
const scaffold = `
do $$ begin
 if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
 if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
 if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;
-- Only these dependency IDs are scaffolds. Existing case/snapshot/continuation
-- and evidence table definitions are taken verbatim from repository migrations.
create table public.profiles(id uuid primary key);
create table public.products(id uuid primary key);
create table public.product_variants(id uuid primary key);
create table public.product_formula_versions(id uuid primary key);
${table(s6, 'product_resolution_cases')}
alter table public.product_resolution_cases add column truth_revision integer not null default 1;
${table(truth, 'product_truth_snapshots')}
${table(child, 'product_resolution_continuations')}
${table(s6, 'product_resolution_evidence')}
grant usage on schema public to service_role;
grant select,insert,update,delete on all tables in schema public to service_role;
`;
writeFileSync(join(artifact, 'scaffold.sql'), scaffold);
sql(scaffold);
const migration = join(root, 'supabase/migrations/20261017120000_product_ingredient_panel_attempts.sql');
execFileSync(psql, [...args(), '-f', migration], { env, stdio: 'pipe' });
sql(`insert into public.profiles values ('${owner}'),('${otherOwner}');
 insert into public.products values ('${verifiedProductTruth.product.productId}');
 insert into public.product_variants values ('${verifiedProductTruth.product.variantId}');
 insert into public.product_resolution_cases (id,user_id,request_id,consumer,resolution_state,next_action,product_id,variant_id)
 values ('${rootId}','${owner}','${requestId(900)}','scan','identified_formula_unverified','photograph_ingredients','${verifiedProductTruth.product.productId}','${verifiedProductTruth.product.variantId}');
 insert into public.product_truth_snapshots(id,user_id,case_id,case_revision,snapshot) values ('${parentId}','${owner}','${rootId}',1,'{}');`);
const evidence = n => n.toString(16).padStart(64, '0');
const quote = value => value === null || value === undefined ? 'null' : `'${String(value).replaceAll("'", "''")}'`;
const columns = {
 bind_product_ingredient_scan: ['p_user_id','p_scan_session_id','p_root_case_id','p_parent_snapshot_id'],
 reserve_product_ingredient_panel: ['p_user_id','p_scan_session_id','p_root_case_id','p_parent_snapshot_id','p_request_id','p_request_fingerprint','p_evidence_fingerprint'],
 settle_product_ingredient_panel: ['p_user_id','p_scan_session_id','p_root_case_id','p_parent_snapshot_id','p_lease_id','p_reason'],
};
const statement = (name, values) => { assert.ok(name in columns); return `set role service_role; select to_jsonb(public.${name}(${columns[name].map(key => quote(values[key])).join(',')}));`; };
const parse = value => JSON.parse(value.split('\n').at(-1));
const rawRpc = (name, values) => parse(sql(statement(name, values)));
const rpc = async ({ name, args: values }) => {
 try { return { data: rawRpc(name, values), error: null }; }
 catch (error) { const code = String(error.stderr).match(/\b(23505|23514|23503|42501)\b/)?.[1]; if (!code) throw error; return { data: null, error: { code } }; }
};
const reserve = (scope, n, extra = {}) => ({ p_user_id: owner, p_scan_session_id: scope, p_root_case_id: null, p_parent_snapshot_id: null,
 p_request_id: requestId(n), p_request_fingerprint: evidence(n), p_evidence_fingerprint: evidence(n), ...extra });
const settle = (scope, lease, reason = 'unreadable', extra = {}) => rawRpc('settle_product_ingredient_panel', {
 p_user_id: owner, p_scan_session_id: scope, p_root_case_id: null, p_parent_snapshot_id: null, p_lease_id: lease, p_reason: reason, ...extra });
const checks = [];
function check(name, fn) { fn(); checks.push(name); }
async function checkAsync(name, fn) { await fn(); checks.push(name); }
const scope = requestId(100);
for (const name of ['product_ingredient_scan_sessions', 'product_ingredient_scan_aliases', 'product_ingredient_panel_attempts']) {
 check(`${name}: RLS enabled`, () => assert.equal(sql(`select relrowsecurity from pg_class where oid='public.${name}'::regclass`), 't'));
 for (const role of ['anon', 'authenticated']) check(`${name}: ${role} denied`, () => assert.equal(sql(`select has_table_privilege('${role}','public.${name}','select,insert,update,delete')`), 'f'));
}
for (const [name, signature] of [['bind_product_ingredient_scan','uuid,uuid,uuid,uuid'], ['reserve_product_ingredient_panel','uuid,uuid,uuid,uuid,uuid,text,text'], ['settle_product_ingredient_panel','uuid,uuid,uuid,uuid,uuid,text']]) {
 for (const role of ['anon', 'authenticated']) check(`${name}: ${role} cannot execute`, () => assert.equal(sql(`select has_function_privilege('${role}','public.${name}(${signature})','execute')`), 'f'));
 check(`${name}: security invoker`, () => assert.equal(sql(`select prosecdef from pg_proc where oid='public.${name}(${signature})'::regprocedure`), 'f'));
}
const first = rawRpc('reserve_product_ingredient_panel', reserve(scope, 1));
check('initial reservation charges exactly one', () => { assert.equal(first.decision, 'reserved'); assert.equal(first.attemptsUsed, 1); });
check('pending request retry is busy without another lease', () => assert.deepEqual(rawRpc('reserve_product_ingredient_panel', reserve(scope, 1)), { decision: 'busy', attemptsUsed: 1, reason: null }));
check('concurrent new panel while pending is uncharged', () => assert.equal(rawRpc('reserve_product_ingredient_panel', reserve(scope, 2)).decision, 'busy'));
await checkAsync('same request with changed payload conflicts', async () => assert.equal((await rpc({ name: 'reserve_product_ingredient_panel', args: reserve(scope, 1, { p_request_fingerprint: evidence(99) }) })).error.code, '23505'));
check('settlement retains one charge', () => assert.deepEqual(settle(scope, first.leaseId), { decision: 'settled', attemptsUsed: 1, reason: 'unreadable' }));
check('late duplicate settlement cannot change observation', () => assert.equal(settle(scope, first.leaseId, 'conflicting_evidence').reason, 'unreadable'));
check('same request replays without processing', () => assert.equal(rawRpc('reserve_product_ingredient_panel', reserve(scope, 1)).decision, 'replayed'));
check('same granted object under another request is uncharged', () => assert.equal(rawRpc('reserve_product_ingredient_panel', reserve(scope, 3, { p_evidence_fingerprint: evidence(1) })).attemptsUsed, 1));
const second = rawRpc('reserve_product_ingredient_panel', reserve(scope, 2));
check('guided retake charges the second slot', () => { assert.equal(second.decision, 'reserved'); assert.equal(second.attemptsUsed, 2); });
settle(scope, second.leaseId, 'unavailable');
check('third distinct panel is exhausted', () => assert.deepEqual(rawRpc('reserve_product_ingredient_panel', reserve(scope, 4)), { decision: 'exhausted', attemptsUsed: 2 }));
check('replay after exhaustion reports the current durable count', () => assert.equal(rawRpc('reserve_product_ingredient_panel', reserve(scope, 1)).attemptsUsed, 2));
await checkAsync('request ID cannot move to another scan', async () => assert.equal((await rpc({ name: 'reserve_product_ingredient_panel', args: reserve(requestId(101), 1) })).error.code, '23505'));
const foreign = rawRpc('reserve_product_ingredient_panel', reserve(scope, 1, { p_user_id: otherOwner }));
check('same UUIDs are owner isolated', () => assert.equal(foreign.attemptsUsed, 1));
await checkAsync('another owner cannot settle the lease', async () => assert.equal((await rpc({ name: 'settle_product_ingredient_panel', args: {
 p_user_id: owner, p_scan_session_id: scope, p_root_case_id: null, p_parent_snapshot_id: null, p_lease_id: foreign.leaseId, p_reason: 'unreadable' } })).error.code, '23514'));

const concurrentScope = requestId(102), asyncExec = promisify(execFile);
const concurrent = await Promise.all([5, 6].map(n => asyncExec(psql, [...args(), '-c', statement('reserve_product_ingredient_panel', reserve(concurrentScope, n))], { env, encoding: 'utf8' }).then(({ stdout }) => parse(stdout.trim()))));
check('two real PostgreSQL sessions yield one permit and one busy reply', () => assert.deepEqual(concurrent.map(r => r.decision).sort(), ['busy', 'reserved']));
check('concurrent race stores one charge', () => assert.equal(sql(`select count(*) from public.product_ingredient_panel_attempts where scope_id='${concurrentScope}'`), '1'));
const oldLease = concurrent.find(r => r.leaseId).leaseId;
sql(`update public.product_ingredient_panel_attempts set lease_expires_at=clock_timestamp()-interval '1 second' where lease_id='${oldLease}'`);
const afterExpiry = rawRpc('reserve_product_ingredient_panel', reserve(concurrentScope, 7));
check('expired interrupted work keeps its charge and permits only the retake', () => assert.equal(afterExpiry.attemptsUsed, 2));
check('expired token cannot replace terminal unavailable with later output', () => assert.equal(settle(concurrentScope, oldLease, 'unreadable').reason, 'unavailable'));
check('expired token cannot settle a newer permit', () => assert.equal(sql(`select status from public.product_ingredient_panel_attempts where lease_id='${afterExpiry.leaseId}'`), 'processing'));
settle(concurrentScope, afterExpiry.leaseId);
check('expired work never creates a third slot', () => assert.equal(rawRpc('reserve_product_ingredient_panel', reserve(concurrentScope, 8)).decision, 'exhausted'));

const bound = { p_root_case_id: rootId, p_parent_snapshot_id: parentId };
await checkAsync('wrong owner cannot reserve this root', async () => assert.equal((await rpc({ name: 'reserve_product_ingredient_panel', args: reserve(requestId(103), 9, { ...bound, p_user_id: otherOwner }) })).error.code, '23514'));
await checkAsync('wrong parent cannot reserve this root', async () => assert.equal((await rpc({ name: 'reserve_product_ingredient_panel', args: reserve(requestId(103), 9, { ...bound, p_parent_snapshot_id: requestId(99) }) })).error.code, '23514'));

// Real entrypoint -> real client service/processor/bridge -> actual SQL RPCs.
// Only Auth, object grants/bytes and catalog dependency IDs are synthetic.
const clientScope = requestId(104), panels = createIngredientPanelSession(() => clientScope);
const f = ingredientEdgeFixture({ rpc }); let id = 200;
const deps = { getOwnerId: () => owner, getScanSessionId: panels.getScanSessionId, createRequestId: () => requestId(++id),
 readPhoto: async () => ({ mimeType: 'image/jpeg', bytes: new ArrayBuffer(2) }),
 prepare: async input => ({ ...input, bucket: 'customer-product-evidence', storagePath: photoPath(id), maxBytes: 100, expiresAt: 'synthetic', uploadToken: 'synthetic' }),
 upload: async () => {} };
const free = createFreeEvidenceProcessor({ ...deps, resolve: input => resolveCatalogIdentity(input, f.client) });
const initial = createCheckCaptureBridge(free, panels);
const panel = n => [{ kind: 'local_photo', role: 'ingredients', value: `file:///synthetic-${n}.jpg` }];
await checkAsync('initial photo follows the real route/service and ends safely unavailable', async () => { await assert.rejects(initial.processor.process(panel(1))); assert.equal(panels.getState().attempts, 1); assert.equal(panels.getState().phase, 'retake'); });
sql(`update public.product_resolution_cases set evidence_snapshot=jsonb_build_object('ingredientScanSessionId','${clientScope}') where id='${rootId}'`);
const noncharging = rawRpc('bind_product_ingredient_scan', { p_user_id: owner, p_scan_session_id: clientScope, ...bound });
check('identity creation registers the root without charging an ingredient attempt', () => { assert.equal(noncharging, clientScope); assert.equal(sql(`select count(*) from public.product_ingredient_panel_attempts where scope_id='${clientScope}'`), '1'); });
const resumedPanels = createIngredientPanelSession(() => requestId(107));
const action = { kind: 'add_requested_evidence', role: 'ingredients', binding: { ownerId: owner, caseId: rootId, snapshotId: parentId,
 caseRevision: 1, productId: verifiedProductTruth.product.productId, variantId: verifiedProductTruth.product.variantId, formulaVersionId: null } };
const followup = createCheckCaptureBridge(createIngredientContinuationProcessor(action, () => true, { ...deps, getScanSessionId: resumedPanels.getScanSessionId,
 continueIngredients: input => continueCatalogIngredients(input, f.client) }), resumedPanels);
await checkAsync('same scan gains a Check root and has only its second slot left', async () => { await assert.rejects(followup.processor.process(panel(2))); assert.equal(resumedPanels.getState().attempts, 2); assert.equal(resumedPanels.getState().phase, 'fallback'); });
check('binding the root adopted the existing standalone accounting', () => assert.equal(sql(`select scope_id from public.product_ingredient_scan_sessions where root_case_id='${rootId}'`), clientScope));
check('root has exactly two combined charges', () => assert.equal(sql(`select count(*) from public.product_ingredient_panel_attempts where scope_id='${clientScope}'`), '2'));
check('a changed client UUID cannot replenish the existing Check root', () => assert.equal(rawRpc('reserve_product_ingredient_panel', reserve(requestId(105), 10, bound)).decision, 'exhausted'));
check('dropping the root after continuation under a new client UUID stays exhausted', () => assert.equal(rawRpc('reserve_product_ingredient_panel', reserve(requestId(105), 11)).decision, 'exhausted'));
check('new client UUID is durably aliased to the original journal', () => assert.equal(sql(`select scope_id from public.product_ingredient_scan_aliases where user_id='${owner}' and scan_session_id='${requestId(105)}'`), clientScope));
const aliasRaceScope = requestId(106);
const aliasRace = await Promise.all([reserve(aliasRaceScope, 12), reserve(aliasRaceScope, 13, bound)].map(values =>
 asyncExec(psql, [...args(), '-c', statement('reserve_product_ingredient_panel', values)], { env, encoding: 'utf8' })
  .then(({ stdout }) => parse(stdout.trim())).catch(error => { assert.match(String(error.stderr), /23505/); return { decision: 'conflict' }; })));
check('concurrent root-bound and standalone calls cannot both accept different budgets', () => {
 assert.ok(aliasRace.every(r => r.decision === 'exhausted') || aliasRace.some(r => r.decision === 'conflict'));
});
check('alias race leaves exactly one canonical target for the client UUID', () => assert.equal(sql(`select count(*) from public.product_ingredient_scan_aliases where user_id='${owner}' and scan_session_id='${aliasRaceScope}'`), '1'));

await checkAsync('exhausted client never dispatches a third panel', async () => { const n = f.calls.length; await assert.rejects(followup.processor.process(panel(3))); assert.equal(f.calls.length, n); });
check('failed photo results never produce a canonical handoff', () => assert.equal(followup.handoff({ authority: 'customer_evidence', evidence: panel(2) }).resolvedCase, null));
check('root truth was not mutated and no child was written', () => { assert.equal(sql('select count(*) from public.product_resolution_cases'), '1'); assert.equal(sql('select count(*) from public.product_truth_snapshots'), '1'); assert.equal(sql('select count(*) from public.product_resolution_continuations'), '0'); });
const crashScope = requestId(108), crashRoot = requestId(109), crashParent = requestId(110), crashClient = requestId(111);
const beforeBind = rawRpc('reserve_product_ingredient_panel', reserve(crashScope, 14)); settle(crashScope, beforeBind.leaseId);
sql(`insert into public.product_resolution_cases (id,user_id,request_id,consumer,resolution_state,next_action,product_id,variant_id,evidence_snapshot)
 values ('${crashRoot}','${owner}','${requestId(901)}','scan','identified_formula_unverified','photograph_ingredients','${verifiedProductTruth.product.productId}','${verifiedProductTruth.product.variantId}',jsonb_build_object('ingredientScanSessionId','${crashScope}'));
 insert into public.product_truth_snapshots(id,user_id,case_id,case_revision,snapshot) values ('${crashParent}','${owner}','${crashRoot}',1,'{}');`);
const resumedBeforeBind = rawRpc('reserve_product_ingredient_panel', reserve(crashClient, 15, { p_root_case_id: crashRoot, p_parent_snapshot_id: crashParent }));
check('restart before first continuation uses identity-creation metadata to retain the earlier charge', () => assert.equal(resumedBeforeBind.attemptsUsed, 2));
check('crash before noncharging bind still aliases both original and resumed client UUIDs', () => assert.equal(sql(`select count(*) from public.product_ingredient_scan_aliases where scope_id='${crashScope}' and scan_session_id in ('${crashScope}','${crashClient}')`), '2'));
sql(`delete from public.product_resolution_cases where id='${rootId}'`);
check('root deletion cascades its session and attempts', () => { assert.equal(sql(`select count(*) from public.product_ingredient_scan_sessions where scope_id='${clientScope}'`), '0'); assert.equal(sql(`select count(*) from public.product_ingredient_panel_attempts where scope_id='${clientScope}'`), '0'); assert.equal(sql(`select count(*) from public.product_ingredient_scan_aliases where scope_id='${clientScope}'`), '0'); });
sql(`delete from public.profiles where id='${otherOwner}'`);
check('owner deletion cascades standalone accounting', () => { assert.equal(sql(`select count(*) from public.product_ingredient_scan_sessions where user_id='${otherOwner}'`), '0'); assert.equal(sql(`select count(*) from public.product_ingredient_panel_attempts where user_id='${otherOwner}'`), '0'); });
const report = { database, assertions: checks.length, passed: checks, entrypointRpcCalls: f.calls.length,
 scopes: 'isolated stock PostgreSQL; actual new migration and resolver/client path; synthetic Auth/Storage/catalog dependency IDs',
 fullSupabaseReset: false, hosted: false, providerCalls: 0 };
writeFileSync(join(artifact, 'verification.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
