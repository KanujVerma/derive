import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { ExternalSourcePolicies } from '../src/domain/part-one/policies.ts';
import type { SourcePolicy, Variant } from '../src/contracts/PartOne.ts';
import { runPartOneLookup } from '../supabase/functions/_shared/part-one-lookup.ts';
import type { LookupPublication, LookupCheckpoint, PartOneLookupJob, PartOneLookupPorts, LookupReservation } from '../supabase/functions/_shared/part-one-lookup.ts';
import { lookupPrimaryProvider } from '../supabase/functions/_shared/part-one-providers.ts';
import type { ProviderTransport, ProviderLookupRequest } from '../supabase/functions/_shared/part-one-providers.ts';
import type { EvidenceAdmission } from '../src/domain/part-one/admission.ts';
const id = (n: number) => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const now = '2026-10-02T12:00:00.000Z', later = '2026-11-02T12:00:00.000Z';
const variant: Variant = { brand: 'Fixture', line: 'Daily', form: 'toner', scent: 'none', shade: 'clear', spf: 'not applicable', strength: 'standard', size: '100', unit: 'ml', packCount: 1, packagingLevel: 'each' };
const grant = (provider: string): SourcePolicy => ({ policyId: id(provider === 'open_facts' ? 1 : 2), provider, version: 'synthetic-authorized-1', permissionEvidence: 'Synthetic response test grant; not real source permission', reviewedAt: '2026-10-01T00:00:00.000Z', expiresAt: later, revokedAt: null, operations: { lookup: true, process: true, retain: true, sharedDisplay: true, privateDisplay: false, ocr: false, cropThumbnail: false, rehost: false, hotlink: false, export: false }, retainedFields: ['identity', 'ingredients'], attribution: 'Synthetic provider fixture', purgeObligations: [] });
const source = (extra: Record<string, unknown> = {}) => ({ status: 1, product: { code: '3606000537538', product_name: 'Fixture Daily toner', brands: 'Fixture', ingredients_text: 'Water, 1,2-Hexanediol, Poly(dimethylsiloxane), Sodium Hyaluronate 0.1% w/w', variant, countries_tags: ['US'], ...extra } });
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
function fixture(responses: Array<Response | Error> = [json(source())]) {
  let next = 100, current = now;
  const events: string[] = [], calls: string[] = [], admissions: EvidenceAdmission[] = [], publications: LookupPublication[] = [], checkpoints: Record<string, LookupCheckpoint> = {};
  const job: PartOneLookupJob = { id: id(20), input: { raw: '3606000537538', symbology: 'ean13', namespace: 'gtin', retailerId: null, canonicalKey: 'gtin:03606000537538', requestedMarket: 'US', categoryHint: 'beauty' }, checkpoints, attempts: 1, maxAttempts: 3 };
  const transport: ProviderTransport = { pinsResolvedAddresses: true, resolve: async () => ['93.184.216.34'], fetch: async (url, options) => { assert.equal(options.redirect, 'manual'); assert.deepEqual(options.resolvedAddresses, ['93.184.216.34']); events.push('fetch'); calls.push(url); const r = responses.shift(); if (r instanceof Error) throw r; if (!r) throw new Error('unexpected_fixture_request'); return r; } };
  const ports: PartOneLookupPorts = { now: () => current, uuid: () => id(next++), hash: async text => createHash('sha256').update(text).digest('hex'), policies: [grant('open_facts'), grant('upcitemdb')], configs: { open_facts: { endpoint: 'https://open.synthetic.invalid/', allowedHosts: ['open.synthetic.invalid'], userAgent: 'Derive authorized synthetic fixture', timeoutMs: 1000 }, upcitemdb: { endpoint: 'https://upc.synthetic.invalid/lookup', allowedHosts: ['upc.synthetic.invalid'], userAgent: 'Derive authorized synthetic fixture', timeoutMs: 1000 } }, transport, readCatalog: async () => null, reserve: async stage => { events.push(`reserve:${stage}`); return { reservationId: id(next++) }; }, dispatch: async () => { events.push('dispatch'); return true; }, checkpoint: async (stage, output) => { events.push(`checkpoint:${stage}`); checkpoints[stage] = structuredClone(output); }, admit: async a => { events.push(`admit:${a.kind}`); const old = admissions.find(existing => existing.id === a.id); if (old) assert.deepEqual(a, old); else admissions.push(structuredClone(a)); }, publish: async p => { events.push('publish'); publications.push(structuredClone(p)); }, extractDeclaration: () => ({ category: 'cosmetic', complete: true, uncertaintyReasons: [] }) };
  return { job, ports, calls, events, admissions, publications, checkpoints, setNow: (date: string) => { current = date; } };
}
test('primary E2E authorized synthetic source dispatches, checkpoints, derives DEC, admits, publishes', async () => {
  const f = fixture(), out = await runPartOneLookup(f.job, f.ports);
  assert.equal(out.work, 'complete'); assert.equal(out.resultPatch.identity, 'exact'); assert.equal(out.resultPatch.declarationState, 'accepted');
  assert.equal(f.calls.length, 1); assert.equal(new URL(f.calls[0]).searchParams.get('product_type'), 'all');
  assert.equal(f.admissions.length, 3); assert.deepEqual(f.admissions.map(a => a.kind), ['observation', 'declaration', 'snapshot']);
  assert.equal(out.resultPatch.display.sections[0].text, source().product.ingredients_text);
  assert.ok(f.events.indexOf('checkpoint:lookup.open_facts.1') < f.events.indexOf('admit:observation'));
  assert.ok(f.events.findIndex(e => e.startsWith('checkpoint:composition.')) < f.events.indexOf('admit:observation'));
  assert.equal(f.events.at(-1), 'publish');
  assert.ok(Object.values(f.admissions[1].payload.predicate as Record<string, { passed: boolean }>).every(p => p.passed));
  assert.equal((f.admissions[1].payload.structuredSections as Array<{ entries: Array<{ rawToken: string }> }>)[0].entries[1].rawToken, '1,2-Hexanediol');
  assert.equal(f.admissions[1].payload.formulaEquivalence, 'unknown');
  const wire = JSON.stringify(f.calls); for (const forbidden of ['profile', 'owner', 'photo', 'health']) assert.equal(wire.includes(forbidden), false);
});
test('actual flat Open Facts shape keeps returned code/brand/text, unknown variant and bounds stay partial', async () => {
  const body = source(); delete (body.product as Partial<typeof body.product>).variant; delete (body.product as Partial<typeof body.product>).countries_tags;
  const f = fixture([json(body)]); delete f.ports.extractDeclaration;
  const out = await runPartOneLookup(f.job, f.ports);
  assert.equal(out.resultPatch.identity, 'exact'); assert.equal(out.resultPatch.declarationState, 'partial'); assert.equal(f.calls.length, 1);
  assert.equal(out.resultPatch.display.sections[0].text, body.product.ingredients_text);
  assert.ok(out.resultPatch.reasonCodes.includes('category_unknown')); assert.ok(out.resultPatch.reasonCodes.includes('market_unknown')); assert.ok(out.resultPatch.reasonCodes.includes('full_panel_not_established'));
  assert.equal(f.admissions[1].payload.category, 'unknown');
});
test('disabled real policies perform no quota reservation, network, admission or source display', async () => {
  const f = fixture(); f.ports.policies = ExternalSourcePolicies;
  const out = await runPartOneLookup(f.job, f.ports); assert.equal(out.work, 'complete'); assert.deepEqual(out.resultPatch.reasonCodes, ['source_blocked']);
  assert.deepEqual(f.calls, []); assert.deepEqual(f.admissions, []); assert.deepEqual(f.events, ['publish']);
});
test('each operation and policy expiry/revocation fails closed before reserve', async () => {
  for (const operation of ['lookup', 'process', 'retain', 'sharedDisplay'] as const) {
    const f = fixture(), p = grant('open_facts'); p.operations[operation] = false; f.ports.policies = [p];
    await runPartOneLookup(f.job, f.ports); assert.equal(f.calls.length, 0); assert.equal(f.events.some(e => e.startsWith('reserve:')), false);
  }
  for (const change of [{ expiresAt: now }, { revokedAt: now }, { permissionEvidence: null }]) {
    const f = fixture(); f.ports.policies = [{ ...grant('open_facts'), ...change }]; await runPartOneLookup(f.job, f.ports); assert.equal(f.calls.length, 0);
  }
});
test('not_found alone triggers UPC identity fallback; never retains its unrequested ingredient list', async () => {
  const f = fixture([json({ status: 0 }), json({ code: 'OK', items: [{ ean: '3606000537538', title: 'Fixture toner', brand: 'Fixture', ingredients_text: 'Wrong-source ingredients' }] })]);
  const out = await runPartOneLookup(f.job, f.ports); assert.equal(f.calls.length, 2); assert.equal(out.resultPatch.identity, 'exact'); assert.equal(out.resultPatch.declarationState, 'none'); assert.equal(out.resultPatch.declarationId, null);
  assert.deepEqual(f.admissions.map(a => a.kind), ['observation', 'snapshot']); assert.equal(f.checkpoints['lookup.open_facts.1'].parsedNegative, true); assert.equal(f.checkpoints['lookup.upcitemdb.1'].parsedNegative, false);
  assert.equal(JSON.stringify(f.admissions).includes('Wrong-source'), false); assert.equal(out.resultPatch.display.sections.length, 0);
});
test('missing ingredients is a usable identity and does not waste UPC fallback calls', async () => {
  const f = fixture([json(source({ ingredients_text: null }))]); const out = await runPartOneLookup(f.job, f.ports); assert.equal(f.calls.length, 1); assert.equal(out.resultPatch.identity, 'exact'); assert.equal(out.resultPatch.declarationState, 'none'); assert.deepEqual(out.resultPatch.reasonCodes, ['ingredients_missing']);
});
test('identity-only retention never requests/processes an ingredient field', async () => {
  const f = fixture(), p = grant('open_facts'); p.retainedFields = ['identity']; f.ports.policies = [p];
  const out = await runPartOneLookup(f.job, f.ports); assert.equal(new URL(f.calls[0]).searchParams.get('fields')?.includes('ingredients_text'), false); assert.equal(out.resultPatch.declarationState, 'none'); assert.equal(JSON.stringify(f.admissions).includes('Hexanediol'), false);
});
test('rate limit checkpoints typed retry and never creates a negative cache or abandoned redispatch', async () => {
  const f = fixture([json({}, 429, { 'retry-after': '120' })]); const out = await runPartOneLookup(f.job, f.ports); assert.equal(out.work, 'retry_wait'); assert.equal(out.nextEligibleAt, '2026-10-02T12:02:00.000Z'); assert.equal(f.calls.length, 1); assert.equal(f.checkpoints['lookup.open_facts.1'].parsedNegative, false);
  f.job.attempts = 2; await runPartOneLookup(f.job, f.ports); assert.equal(f.calls.length, 1); assert.equal(f.admissions.length, 0);
});
test('durable unknown dispatch never redispatches after process loss', async () => {
  const f = fixture(); f.job.unknownReservations = [{ id: id(99) }]; const out = await runPartOneLookup(f.job, f.ports); assert.equal(out.work, 'retry_wait'); assert.equal(f.calls.length, 0); assert.equal(f.events.some(e => e.startsWith('reserve:')), false);
});
test('budget defer preserves durable stage, schedules recovery and uses no provider request', async () => {
  const f = fixture(); f.ports.reserve = async () => ({ reservationId: null, work: 'deferred_budget', nextEligibleAt: '2026-10-03T00:00:00.000Z' });
  const out = await runPartOneLookup(f.job, f.ports); assert.equal(out.work, 'deferred_budget'); assert.equal(out.nextEligibleAt, '2026-10-03T00:00:00.000Z'); assert.equal(f.calls.length, 0); assert.equal(Object.keys(f.checkpoints).length, 0);
});
test('composition crash resumes with same immutable IDs and reuses durable provider result', async () => {
  const f = fixture(), admit = f.ports.admit; let fail = true;
  f.ports.admit = async a => { await admit(a); if (a.kind === 'observation' && fail) { fail = false; throw new Error('synthetic persistence loss'); } };
  await assert.rejects(runPartOneLookup(f.job, f.ports), /persistence loss/); assert.equal(f.publications.length, 0); assert.equal(f.calls.length, 1);
  const out = await runPartOneLookup(f.job, f.ports); assert.equal(out.resultPatch.declarationState, 'accepted'); assert.equal(f.calls.length, 1); assert.equal(f.admissions.length, 3);
});
test('dispatch/checkpoint failures are not swallowed or acknowledged as completed provider work', async () => {
  for (const which of ['dispatch', 'checkpoint'] as const) {
    const f = fixture(); if (which === 'dispatch') f.ports.dispatch = async () => { throw new Error('ledger unavailable'); }; else f.ports.checkpoint = async () => { throw new Error('ledger unavailable'); };
    await assert.rejects(runPartOneLookup(f.job, f.ports), /ledger unavailable/); assert.equal(f.publications.length, 0); assert.equal(f.admissions.length, 0); assert.equal(f.calls.length, which === 'dispatch' ? 0 : 1);
  }
});
test('SSRF and redirect DNS are checked before every quota dispatch', async () => {
  const f = fixture([new Response(null, { status: 302, headers: { location: 'https://open.synthetic.invalid/redirected' } }), json(source())]); let resolutions = 0;
  f.ports.transport!.resolve = async () => ++resolutions === 1 ? ['93.184.216.34'] : ['169.254.169.254'];
  const out = await runPartOneLookup(f.job, f.ports); assert.equal(f.calls.length, 1); assert.equal(f.events.filter(e => e === 'dispatch').length, 1); assert.equal(out.resultPatch.declarationState, 'none');
  assert.equal(f.checkpoints['lookup.open_facts.1'].reply?.usage.calls, 1);
});
test('authorized redirect has a separate durable reservation and counts both real requests', async () => {
  const f = fixture([new Response(null, { status: 302, headers: { location: '/redirected' } }), json(source())]); const out = await runPartOneLookup(f.job, f.ports);
  assert.equal(out.resultPatch.declarationState, 'accepted'); assert.equal(f.calls.length, 2); assert.equal(f.events.filter(e => e === 'dispatch').length, 2);
  assert.ok(f.checkpoints['lookup.open_facts.1.redirect.1']); assert.equal(f.checkpoints['lookup.open_facts.1'].reply?.usage.calls, 2);
});
test('cross-host redirect stays blocked even when the destination returns valid JSON', async () => {
  const f = fixture([new Response(null, { status: 302, headers: { location: 'https://evil.synthetic.invalid/' } })]); f.ports.policies = [grant('open_facts')];
  await runPartOneLookup(f.job, f.ports); assert.equal(f.calls.length, 1); assert.equal(f.admissions.length, 0); assert.equal(f.checkpoints['lookup.open_facts.1'].parsedNegative, false);
});
test('decompressed body bound and HTML denial classify malformed, never not_found', async () => {
  for (const response of [json(source({ ingredients_text: 'a'.repeat(2000) })), new Response('<html>denied</html>', { status: 200, headers: { 'content-type': 'text/html' } })]) {
    const f = fixture([response]); f.ports.policies = [grant('open_facts')]; f.ports.configs.open_facts!.maxBytes = 1000;
    await runPartOneLookup(f.job, f.ports); assert.equal(f.admissions.length, 0); assert.equal(f.checkpoints['lookup.open_facts.1'].reply?.status, 'malformed_response'); assert.equal(f.checkpoints['lookup.open_facts.1'].reply?.usage.calls, 1); assert.equal(f.checkpoints['lookup.open_facts.1'].parsedNegative, false);
  }
});
test('fetch timeout/failure retains dispatched-unknown accounting; final attempt is finite', async () => {
  const f = fixture([new Error('transport failure')]); f.ports.policies = [grant('open_facts')]; f.job.attempts = 3;
  const out = await runPartOneLookup(f.job, f.ports); assert.equal(f.checkpoints['lookup.open_facts.3'].reply?.usage.calls, 1); assert.equal(f.checkpoints['lookup.open_facts.3'].parsedNegative, false); assert.equal(f.admissions.length, 0); assert.equal(out.work, 'failed_final');
});
test('restricted namespace equivalents cannot reserve or dispatch a public lookup', async () => {
  for (const raw of ['200000000004', '0200000000004', '00200000000004']) {
    const f = fixture(); f.job.input.raw = raw; f.job.input.symbology = raw.length === 12 ? 'ean13' : null; f.job.input.canonicalKey = 'gtin:00200000000004';
    const out = await runPartOneLookup(f.job, f.ports); assert.equal(out.work, 'failed_final'); assert.equal(f.calls.length, 0); assert.equal(f.events.some(e => e.startsWith('reserve:')), false);
  }
});
test('wrong source barcode may fall back to identity but its ingredient evidence is never imported', async () => {
  const f = fixture([json(source({ code: '305210416383', ingredients_text: 'Contradictory soda formula' })), json({ code: 'OK', items: [{ ean: '3606000537538', title: 'Verified UPC identity', brand: 'Fixture' }] })]);
  const out = await runPartOneLookup(f.job, f.ports); assert.equal(out.resultPatch.identity, 'exact'); assert.equal(out.resultPatch.display.selectedIdentity?.name, 'Verified UPC identity'); assert.equal(out.resultPatch.declarationState, 'none');
  assert.equal(JSON.stringify(f.admissions).includes('Contradictory'), false); assert.equal(f.calls.length, 2);
});
test('catalog exact identity is retained when same-code source variant contradicts it', async () => {
  const seed = fixture(), accepted = await runPartOneLookup(seed.job, seed.ports);
  const snapshot = seed.admissions[2].payload; const { brand, variantText, image, ...item } = snapshot;
  const base = structuredClone(accepted.resultPatch); base.declarationState = 'partial'; base.declarationId = null; base.display.sections = [];
  const f = fixture([json(source({ product_name: 'Soda', variant: { ...variant, brand: 'Contradictory soda', form: 'beverage' } }))]);
  f.ports.readCatalog = async () => ({ resultPatch: base, item: item as unknown as import('../src/contracts/PartOne.ts').ItemSnapshot });
  const out = await runPartOneLookup(f.job, f.ports); assert.equal(out.resultPatch.display.selectedIdentity?.name, 'Fixture Daily toner'); assert.equal(out.resultPatch.declarationState, 'conflict'); assert.equal(out.resultPatch.declarationId, null); assert.equal(f.calls.length, 1); assert.equal(f.admissions.length, 0);
});
test('fresh accepted catalog performs no dispatch; expired/revoked source evidence cannot bypass gates', async () => {
  const seed = fixture(), accepted = await runPartOneLookup(seed.job, seed.ports);
  const fresh = fixture(); fresh.ports.readCatalog = async () => ({ resultPatch: accepted.resultPatch, item: null });
  const out = await runPartOneLookup(fresh.job, fresh.ports); assert.equal(out.resultPatch.declarationState, 'accepted'); assert.equal(fresh.calls.length, 0);
  const revoked = fixture(); revoked.ports.policies = [{ ...grant('open_facts'), revokedAt: now }]; revoked.ports.readCatalog = fresh.ports.readCatalog;
  const rejected = await runPartOneLookup(revoked.job, revoked.ports); assert.equal(rejected.resultPatch.declarationState, 'none'); assert.equal(revoked.calls.length, 0);
  const expired = fixture(); expired.setNow('2026-11-03T00:00:00.000Z'); expired.ports.readCatalog = fresh.ports.readCatalog;
  const stale = await runPartOneLookup(expired.job, expired.ports); assert.equal(stale.resultPatch.declarationState, 'none'); assert.equal(expired.calls.length, 0);
});
test('reviewed complete-field evidence still cannot accept unknown market/variant or damaged tokens', async () => {
  for (const changes of [{ countries_tags: [] }, { variant: { ...variant, size: null } }, { ingredients_text: 'Water, Poly(dimethylsiloxane' }]) {
    const f = fixture([json(source(changes))]); const out = await runPartOneLookup(f.job, f.ports); assert.equal(out.resultPatch.declarationState, 'partial'); assert.equal(out.resultPatch.allowedActions.includes('save'), false); assert.equal(f.admissions.length, 3);
  }
});
test('negative checkpoint six-hour lifetime expires independently of long-lived durable job', async () => {
  const f = fixture([json({ status: 0 }), json({ status: 0 })]); f.ports.policies = [grant('open_facts')];
  await runPartOneLookup(f.job, f.ports); assert.equal(f.calls.length, 1);
  f.job.attempts = 2; f.setNow('2026-10-02T17:00:00.000Z'); await runPartOneLookup(f.job, f.ports); assert.equal(f.calls.length, 1);
  f.job.attempts = 3; f.setNow('2026-10-02T18:00:00.001Z'); await runPartOneLookup(f.job, f.ports); assert.equal(f.calls.length, 2);
});
test('source revocation during composition prevents admission/publication', async () => {
  const f = fixture(), checkpoint = f.ports.checkpoint;
  f.ports.checkpoint = async (stage, output, reservationId) => { await checkpoint(stage, output, reservationId); if (stage.startsWith('composition.')) f.ports.policies = [{ ...grant('open_facts'), revokedAt: now }]; };
  await assert.rejects(runPartOneLookup(f.job, f.ports), /policy_changed/); assert.equal(f.admissions.length, 0); assert.equal(f.publications.length, 0);
});
test('ambiguous/candidate catalog association stays a deliberate choice without guessed replacement', async () => {
  const seed = fixture(), accepted = await runPartOneLookup(seed.job, seed.ports);
  for (const identity of ['candidate', 'ambiguous'] as const) {
    const f = fixture(), patch = structuredClone(accepted.resultPatch); patch.identity = identity; patch.itemId = null; patch.snapshotId = null; patch.declarationId = null; patch.declarationState = 'none'; patch.candidateIds = [id(500), id(501)]; patch.display.candidates = [patch.display.selectedIdentity!]; patch.display.selectedIdentity = null; patch.display.sections = []; patch.allowedActions = ['choose_candidate', 'scan_ingredients', 'rescan'];
    f.ports.readCatalog = async () => ({ resultPatch: patch, item: null }); const out = await runPartOneLookup(f.job, f.ports);
    assert.equal(out.resultPatch.identity, identity); assert.equal(f.calls.length, 0); assert.equal(f.admissions.length, 0); assert.deepEqual(out.resultPatch.candidateIds, patch.candidateIds);
  }
});
test('redirect quota defer checkpoints known first response and resumes target without repeating it', async () => {
  const f = fixture([new Response(null, { status: 302, headers: { location: '/durable-target' } }), json(source())]);
  const reserve = f.ports.reserve, checkpoint = f.ports.checkpoint; let deferred = false; let durable: Record<string, LookupCheckpoint> = {};
  f.ports.reserve = async (stage, provider) => { if (stage === 'lookup.open_facts.1.redirect.1') { deferred = true; return { reservationId: null, work: 'deferred_budget', nextEligibleAt: null }; } return reserve(stage, provider); };
  // Mirrors DB deferral clearing the lease: no later checkpoint is acknowledged.
  f.ports.checkpoint = async (stage, output, reservationId) => { if (!deferred) { await checkpoint(stage, output, reservationId); durable = structuredClone(f.checkpoints); } };
  const first = await runPartOneLookup(f.job, f.ports); assert.equal(first.work, 'deferred_budget'); assert.equal(f.calls.length, 1);
  assert.equal(f.checkpoints['lookup.open_facts.1.redirect_response.1'].redirectResume?.url, 'https://open.synthetic.invalid/durable-target');
  assert.equal(durable['lookup.open_facts.1'], undefined);
  deferred = false; f.job.attempts = 2; f.job.checkpoints = durable;
  const second = await runPartOneLookup(f.job, f.ports); assert.equal(second.resultPatch.declarationState, 'accepted'); assert.equal(f.calls.length, 2); assert.equal(f.calls[1], 'https://open.synthetic.invalid/durable-target');
});
test('a resumed redirect still requires DNS rights and host policy before dispatch', async () => {
  const f = fixture(); f.ports.policies = [grant('open_facts')]; f.job.checkpoints['lookup.open_facts.1.redirect_response.1'] = { status: 'found', parsedNegative: false, checkedAt: now, policyVersion: grant('open_facts').version, redirectResume: { url: 'https://open.synthetic.invalid/resume', redirectIndex: 1 } };
  f.job.attempts = 2; f.ports.transport!.resolve = async () => ['127.0.0.1']; await runPartOneLookup(f.job, f.ports);
  assert.equal(f.calls.length, 0); assert.equal(f.events.filter(e => e === 'dispatch').length, 0); assert.equal(f.admissions.length, 0);
});
test('deadline stops late DNS and late transport results from dispatch/admission callbacks', async () => {
  const f = fixture(); const request: ProviderLookupRequest = { canonicalCode: '03606000537538', originalCode: '3606000537538', symbology: 'ean13', nativeCode: '3606000537538', requestedMarket: 'US', categoryHint: null, requestedFields: ['identity', 'ingredients'], jobId: id(20), stageId: id(21), reservationId: id(22), deadlineAt: '2026-10-02T12:00:08.000Z' };
  let release!: (ips: string[]) => void, dispatches = 0;
  const transport: ProviderTransport = { pinsResolvedAddresses: true, resolve: () => new Promise(resolve => { release = resolve; }), fetch: async () => { throw new Error('late DNS must not reach fetch'); } };
  const reply = await lookupPrimaryProvider('open_facts', request, grant('open_facts'), { ...f.ports.configs.open_facts!, timeoutMs: 5 }, transport, { now: () => now, observationId: id(23), hash: f.ports.hash, beforeRequest: async () => { dispatches++; return true; } });
  assert.equal(reply.status, 'unavailable'); assert.equal(reply.usage.calls, 0); release(['93.184.216.34']); await new Promise(resolve => setTimeout(resolve, 10)); assert.equal(dispatches, 0);
  let resolveFetch!: (response: Response) => void, redirects = 0, unknown = 0;
  transport.resolve = async () => ['93.184.216.34']; transport.fetch = () => new Promise(resolve => { resolveFetch = resolve; });
  const timed = await lookupPrimaryProvider('open_facts', request, grant('open_facts'), { ...f.ports.configs.open_facts!, timeoutMs: 5 }, transport, { now: () => now, observationId: id(23), hash: f.ports.hash, beforeRequest: async () => true, afterRedirect: async () => { redirects++; }, onUnknownDispatch: () => { unknown++; } });
  assert.equal(timed.status, 'unavailable'); assert.equal(timed.usage.calls, 1); assert.equal(unknown, 1);
  resolveFetch(new Response(null, { status: 302, headers: { location: '/late' } })); await new Promise(resolve => setTimeout(resolve, 10)); assert.equal(redirects, 0);
});
test('already expired provider deadline performs no DNS or dispatch', async () => {
  const f = fixture(), request: ProviderLookupRequest = { canonicalCode: '03606000537538', originalCode: '3606000537538', symbology: 'ean13', nativeCode: '3606000537538', requestedMarket: null, categoryHint: null, requestedFields: ['identity'], jobId: id(20), stageId: id(21), reservationId: id(22), deadlineAt: now };
  let dns = 0, dispatch = 0; f.ports.transport!.resolve = async () => { dns++; return ['93.184.216.34']; };
  const reply = await lookupPrimaryProvider('open_facts', request, grant('open_facts'), f.ports.configs.open_facts, f.ports.transport, { now: () => now, hash: f.ports.hash, observationId: id(23), beforeRequest: async () => { dispatch++; return true; } });
  assert.equal(reply.status, 'unavailable'); assert.equal(dns, 0); assert.equal(dispatch, 0);
});
test('all new identity/partial/accepted material expires within 24h, independently bounded by rights', async () => {
  for (const complete of [true, false]) {
    const f = fixture(); f.ports.extractDeclaration = () => ({ category: complete ? 'cosmetic' : 'unknown', complete, uncertaintyReasons: [] });
    const out = await runPartOneLookup(f.job, f.ports); assert.equal(out.resultPatch.freshness.expiresAt, '2026-10-03T12:00:00.000Z'); assert.equal(out.resultPatch.display.selectedIdentity?.expiresAt, '2026-10-03T12:00:00.000Z');
    assert.ok(f.admissions.every(a => Date.parse(a.expiresAt) - Date.parse(a.observedAt) <= 86400000)); assert.ok(out.resultPatch.display.sections.every(s => Date.parse(s.expiresAt) - Date.parse(s.observedAt) <= 86400000));
  }
  const f = fixture(); f.ports.policies = [{ ...grant('open_facts'), expiresAt: '2026-10-02T13:00:00.000Z' }];
  const out = await runPartOneLookup(f.job, f.ports); assert.equal(out.resultPatch.freshness.expiresAt, '2026-10-02T13:00:00.000Z'); assert.ok(f.admissions.every(a => a.expiresAt === '2026-10-02T13:00:00.000Z'));
});
test('source rights are checked again after immutable admission and before publication', async () => {
  const f = fixture(), admit = f.ports.admit;
  f.ports.admit = async a => { await admit(a); if (a.kind === 'snapshot') f.ports.policies = [{ ...grant('open_facts'), revokedAt: now }]; };
  await assert.rejects(runPartOneLookup(f.job, f.ports), /policy_changed_before_publication/); assert.equal(f.admissions.length, 3); assert.equal(f.publications.length, 0);
});
test('provider Retry-After reaches the global ledger as top-level checkpoint data', async () => {
  const f = fixture([json({}, 429, { 'retry-after': '180' })]);
  await runPartOneLookup(f.job, f.ports);
  // SQL budget settlement reads output.retryAfter, not output.reply.retryAfter.
  assert.equal((f.checkpoints['lookup.open_facts.1'] as LookupCheckpoint & { retryAfter?: string | null }).retryAfter, '2026-10-02T12:03:00.000Z');
});
test('parsed redirect-target miss satisfies SQL negative proof before fallback', async () => {
  const f = fixture([new Response(null, { status: 302, headers: { location: '/genuine-miss' } }), json({ status: 0 }), json({ code: 'OK', items: [{ ean: '3606000537538', title: 'UPC identity', brand: 'Fixture' }] })]);
  const checkpoint = f.ports.checkpoint;
  f.ports.checkpoint = async (stage, output, reservationId) => {
    if (output.status === 'not_found' && !output.parsedNegative) throw new Error('PART_ONE_UNPROVEN_NEGATIVE');
    await checkpoint(stage, output, reservationId);
  };
  const out = await runPartOneLookup(f.job, f.ports);
  assert.equal(out.resultPatch.identity, 'exact'); assert.equal(out.resultPatch.declarationState, 'none'); assert.equal(f.calls.length, 3);
  assert.equal(f.checkpoints['lookup.open_facts.1.redirect.1'].parsedNegative, true); assert.equal(f.checkpoints['lookup.open_facts.1'].parsedNegative, true);
});
test('duplicated native and structured source brand contradiction blocks actual primary readiness', async () => {
  const f = fixture([json(source({ brands: 'Contradictory soda brand' })), json({ code: 'OK', items: [{ ean: '3606000537538', title: 'UPC exact identity', brand: 'Fixture' }] })]);
  const out = await runPartOneLookup(f.job, f.ports);
  assert.equal(out.resultPatch.declarationState, 'none'); assert.equal(out.resultPatch.display.selectedIdentity?.name, 'UPC exact identity'); assert.equal(f.admissions.some(a => a.kind === 'declaration'), false);
  const observation = f.checkpoints['lookup.open_facts.1'].reply!.observations[0]; assert.equal(observation.comparison, 'contradiction');
  assert.equal((observation.payload as { nativeBrand: string }).nativeBrand, 'Contradictory soda brand');
  assert.equal((observation.payload as { structuredVariant: Variant }).structuredVariant.brand, 'Fixture');
});
test('UPC native brand disagreement cannot create an exact identity from structured metadata', async () => {
  const f = fixture([json({ status: 0 }), json({ code: 'OK', items: [{ ean: '3606000537538', title: 'UPC ambiguous identity', brand: 'Different brand', variant }] })]);
  const out = await runPartOneLookup(f.job, f.ports); assert.equal(out.resultPatch.identity, 'unresolved'); assert.equal(out.resultPatch.declarationState, 'none'); assert.equal(f.admissions.length, 0);
  assert.equal(f.checkpoints['lookup.upcitemdb.1'].reply!.observations[0].comparison, 'contradiction');
});
test('retained duplicate identity assertions survive every authorized admission unchanged', async () => {
  const f = fixture(); await runPartOneLookup(f.job, f.ports);
  const payload = f.admissions[0].payload.payload as { nativeBrand: string; structuredVariant: Variant };
  assert.equal(payload.nativeBrand, 'Fixture'); assert.deepEqual(payload.structuredVariant, variant);
});

test('rights expiry while awaiting dispatch authorization prevents provider bytes', async () => {
  const f = fixture(), policy = grant('open_facts'); let current = now, fetched = 0;
  const request: ProviderLookupRequest = { canonicalCode: '03606000537538', originalCode: '3606000537538', symbology: 'ean13', nativeCode: '3606000537538', requestedMarket: null, categoryHint: null, requestedFields: ['identity', 'ingredients'], jobId: id(20), stageId: id(21), reservationId: id(22), deadlineAt: '2026-10-02T12:00:08.000Z' };
  policy.expiresAt = '2026-10-02T12:00:01.000Z';
  const transport: ProviderTransport = { pinsResolvedAddresses: true, resolve: async () => ['93.184.216.34'], fetch: async () => { fetched++; return json(source()); } };
  const reply = await lookupPrimaryProvider('open_facts', request, policy, f.ports.configs.open_facts, transport, { now: () => current, observationId: id(23), hash: f.ports.hash, beforeRequest: async () => { current = policy.expiresAt!; return true; } });
  assert.equal(reply.status, 'disallowed_by_source_policy'); assert.equal(reply.usage.calls, 0); assert.equal(fetched, 0);
});
