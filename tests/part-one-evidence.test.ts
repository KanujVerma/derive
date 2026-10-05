import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ScanRequestSchema, ScanResultSchema, CaptureCommitRequestSchema, DeclarationSchema, SourcePolicySchema } from '../src/contracts/PartOne.ts';
import type { Declaration, DisplayProjection, ItemSnapshot, SourcePolicy, Variant } from '../src/contracts/PartOne.ts';
import { normalizeBarcode, publicLookupKey, expandUpce } from '../src/domain/part-one/barcode.ts';
import { compareVariant, selectDeclaration, toFactBundle, canClaimFullListAbsence, filterDisplayProjection, policyAllows } from '../src/domain/part-one/evidence.ts';
import { parseDeclarationSection, parseIngredientTable, normalizeWithOffsets, extractBoundedSection } from '../src/domain/part-one/parser.ts';
import { createEvidenceRevisionLedger, appendImageObservation } from '../src/domain/part-one/revisions.ts';
import { ExternalSourcePolicies } from '../src/domain/part-one/policies.ts';
import { createBarcodeObservationGate } from '../src/presentation/capture/barcodeObservationGate.ts';
import { evaluateProviderFixture, negativeCacheExpiry, isPermittedProviderDestination, ProviderLookupRequestSchema } from '../supabase/functions/_shared/part-one-providers.ts';
import type { ProviderLookupRequest, BoundedProviderFixture } from '../supabase/functions/_shared/part-one-providers.ts';

// Synthetic authorized evidence, never a assertion about current physical-package ground truth.
const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const now = '2026-10-02T12:00:00.000Z', later = '2026-11-02T12:00:00.000Z';
const variant: Variant = { brand: 'Example', line: 'Daily', form: 'toner', scent: 'unscented', shade: 'clear', spf: 'not applicable', strength: 'standard', size: '100', unit: 'ml', packCount: 1, packagingLevel: 'each' };
function policy(provider = 'fixture'): SourcePolicy { return { policyId: id(1), provider, version: 'sanitized-fixture-1', permissionEvidence: 'Synthetic test grant only', reviewedAt: '2026-10-01T00:00:00.000Z', expiresAt: later, revokedAt: null, operations: { lookup: true, process: true, retain: true, sharedDisplay: true, privateDisplay: true, ocr: true, cropThumbnail: true, rehost: true, hotlink: true, export: true }, retainedFields: ['identity', 'ingredients'], attribution: 'Synthetic test', purgeObligations: [] }; }
function section(rawText = 'Water, Glycerin') { return parseDeclarationSection({ sectionId: id(2), observationId: id(3), imageId: null, sourceRevision: 1, rawText, sourceOffset: 0, kind: 'ingredients', startCovered: true, endCovered: true, lineCoverageComplete: true, entryId: order => id(100 + order) }); }
function item(): ItemSnapshot { return { snapshotId: id(4), itemId: id(5), revision: 1, name: 'Example Daily toner', variant: { ...variant }, fieldEvidence: { brand: [id(3)] }, barcodeAssertions: [{ raw: '3606000537538', symbology: 'ean13', namespace: 'gtin', canonical: '03606000537538', evidenceId: id(3) }], requestedMarket: 'US', sourceMarkets: ['US'], packageMarket: null, declarationIds: [id(6)], conflictIds: [], scope: 'public', supersedesId: null }; }
function declaration(): Declaration { return { declarationId: id(6), revision: 1, itemId: id(5), snapshotId: id(4), observationIds: [id(3)], dependencyIds: [id(3)], rawText: 'Water, Glycerin', textStructureHash: 'synthetic-text-hash', sections: [section()], category: 'cosmetic', completenessReasons: [], transcriptionUncertainty: [], parserVersion: 'part-one-spans-1', aliasVersion: 'observed-only-1', sourceRevision: 1, sourceUpdatedAt: null, observedAt: now, expiresAt: later, policyId: id(1), scope: 'public', ownerId: null, packageObservationId: null, associationEvidenceIds: [id(3)], variant: { ...variant }, sourceMarkets: ['US'], packageMarket: null, conflictIds: [], supersedesId: null, formulaEquivalence: 'unknown' }; }
const code = (raw: string, symbology: string | null) => ({ raw, symbology, namespace: 'gtin' as const, retailerId: null });
const request: ProviderLookupRequest = { canonicalCode: '03606000537538', originalCode: '3606000537538', symbology: 'ean13', nativeCode: '3606000537538', requestedMarket: 'US', categoryHint: 'beauty', requestedFields: ['identity', 'ingredients'], jobId: id(7), stageId: id(8), deadlineAt: '2026-10-02T12:00:04.000Z', reservationId: id(9) };
function response(body: unknown, status = 200, contentType = 'application/json'): BoundedProviderFixture { const text = typeof body === 'string' ? body : JSON.stringify(body); return { status, contentType, body: text, retryAfter: null, providerRequestId: 'synthetic-request', elapsedMs: 12, decompressedBytes: new TextEncoder().encode(text).byteLength }; }
function lookup(body: unknown, overrides: Partial<BoundedProviderFixture> = {}, p = policy('open_facts')) { return evaluateProviderFixture('open_facts', request, p, { ...response(body), ...overrides }, { now, observationId: id(3), contentHash: 'synthetic-hash', sourceUrl: null }); }

test('A01 UPC-A/EAN-13/provider representation share canonical job key and retain native payloads', () => {
  const a = normalizeBarcode(code('305210416383', 'upc_a')), b = normalizeBarcode(code('0305210416383', 'ean13')), c = normalizeBarcode(code('305210416383', 'ean13'));
  assert.equal(a.supported, true); assert.equal(a.canonicalCode, b.canonicalCode); assert.equal(b.canonicalCode, c.canonicalCode); assert.equal(a.raw, '305210416383'); assert.equal(b.raw, '0305210416383'); assert.equal(c.symbology, 'ean13');
  assert.equal(publicLookupKey(a, 'US', 'ingredients', '1'), publicLookupKey(b, 'US', 'ingredients', '1'));
  assert.notEqual(publicLookupKey(a, null, 'ingredients', '1'), publicLookupKey(a, 'US', 'ingredients', '1'));
  const gate = createBarcodeObservationGate(() => 0); assert.equal(gate.observe(a.raw, false), true); assert.equal(gate.observe(a.raw, false), false);
});
test('A02 UPC-E expansion, EAN-8 namespace, case GTIN and retailer routing preserve identity', () => {
  assert.equal(expandUpce('04252614'), '042100005264');
  const upce = normalizeBarcode(code('04252614', 'upce')); assert.equal(upce.canonicalCode, '00042100005264');
  assert.equal(normalizeBarcode(code('96385074', 'ean8')).canonicalCode, '00000096385074');
  assert.equal(normalizeBarcode(code('96385074', null)).reason, 'unsupported_namespace');
  const caseCode = normalizeBarcode(code('10012345000017', 'itf14')); assert.equal(caseCode.canonicalCode, '10012345000017');
  assert.notEqual(caseCode.canonicalCode, normalizeBarcode(code('012345000010', 'upca')).canonicalCode);
  assert.equal(normalizeBarcode(code('2000000000015', 'ean13')).supported, false);
  const retailer = normalizeBarcode({ ...code('2000000000015', 'ean13'), namespace: 'retailer', retailerId: 'synthetic-store' }); assert.equal(retailer.canonicalCode, 'retailer:synthetic-store:2000000000015'); assert.equal(retailer.canonicalGtin14, null);
  assert.equal(normalizeBarcode(code('https://metadata.invalid/', 'qr')).supported, false);
  assert.equal(normalizeBarcode(code('305210416384', 'upca')).reason, 'invalid_code');
});
test('A02 restricted UPC 2/4 namespace is invariant across UPC/EAN/GTIN and iOS representations', () => {
  for (const upc of ['200000000004', '400000000008']) {
    const representations: Array<[string, string | null]> = [[upc, 'upca'], [upc, 'ean13'], [`0${upc}`, 'ean13'], [`00${upc}`, 'gtin14'], [`00${upc}`, null]];
    for (const [raw, symbology] of representations) {
      const global = normalizeBarcode(code(raw, symbology));
      assert.equal(global.supported, false, `${raw}:${symbology}`);
      assert.equal(global.reason, 'unsupported_namespace'); assert.equal(global.canonicalCode, null); assert.equal(global.canonicalGtin14, null);
      assert.equal(publicLookupKey(global, 'US', 'ingredients', '1'), null);
      assert.equal(global.raw, raw); assert.equal(global.symbology, symbology);
      const scoped = normalizeBarcode({ ...code(raw, symbology), namespace: 'retailer', retailerId: 'synthetic-store' });
      assert.equal(scoped.supported, true); assert.equal(scoped.namespace, 'retailer'); assert.equal(scoped.canonicalGtin14, null);
      assert.equal(scoped.nativeCode, raw); assert.equal(scoped.canonicalCode, `retailer:synthetic-store:${raw}`);
      assert.equal(normalizeBarcode({ ...code(raw, symbology), namespace: 'retailer' }).supported, false);
    }
  }
});
test('A02 restricted EAN-13 20-29 stays restricted when zero-padded to GTIN-14', () => {
  for (const ean of ['2000000000008', '2900000000001']) {
    for (const [raw, symbology] of [[ean, 'ean13'], [`0${ean}`, 'gtin14'], [`0${ean}`, null]] as Array<[string, string | null]>) {
      const normalized = normalizeBarcode(code(raw, symbology)); assert.equal(normalized.supported, false); assert.equal(normalized.reason, 'unsupported_namespace');
      assert.equal(publicLookupKey(normalized, null, 'identity', '1'), null);
      assert.equal(normalizeBarcode({ ...code(raw, symbology), namespace: 'retailer', retailerId: 'synthetic-store' }).supported, true);
    }
  }
});
test('A02 normal UPC equivalents retain one public key while nonzero case indicators stay distinct', () => {
  const consumer = normalizeBarcode(code('305210416383', 'upca'));
  for (const [raw, symbology] of [['305210416383', 'ean13'], ['0305210416383', 'ean13'], ['00305210416383', 'gtin14']] as Array<[string, string]>) {
    const equivalent = normalizeBarcode(code(raw, symbology)); assert.equal(equivalent.supported, true); assert.equal(equivalent.canonicalGtin14, consumer.canonicalGtin14);
    assert.equal(publicLookupKey(equivalent, 'US', 'identity', '1'), publicLookupKey(consumer, 'US', 'identity', '1'));
  }
  for (const raw of ['10012345000017', '20012345000014', '20305210416387', '40305210416381']) {
    const packaged = normalizeBarcode(code(raw, 'itf14')); assert.equal(packaged.supported, true, raw); assert.equal(packaged.canonicalGtin14, raw); assert.equal(packaged.nativeCode, raw);
    assert.notEqual(packaged.canonicalGtin14, consumer.canonicalGtin14); assert.notEqual(publicLookupKey(packaged, 'US', 'identity', '1'), publicLookupKey(consumer, 'US', 'identity', '1'));
  }
  assert.equal(normalizeBarcode(code('305210416383', 'ean8')).reason, 'invalid_code');
  assert.equal(normalizeBarcode(code('305210416383', 'gtin14')).reason, 'invalid_code');
});
test('A03 deliberately selected foreground Vaseline only is handed off; repeated/background callbacks are suppressed', () => {
  const candidates = ['305210416383', '305210231597'];
  const gate = createBarcodeObservationGate(() => 0), selected = candidates[0];
  assert.equal(gate.observe(selected, false), true); assert.equal(gate.observe(selected, false), false); assert.equal(gate.observe(candidates[1], true), false);
  // Rotation/zoom/crop/missing bounds need deliberate selection until native mapping is validated.
  for (const geometry of ['rotation', 'zoom', 'crop', 'missing_bounds']) {
    const choose = (candidate: string | null) => candidate !== null && candidates.includes(candidate) ? normalizeBarcode(code(candidate, 'upca')) : null;
    assert.equal(choose(null), null, geometry); assert.equal(choose(selected)?.raw, selected);
  }
});
test('A04 decoded and printed valid codes remain separate; checksum never supplies association', () => {
  const decoded = normalizeBarcode(code('3337875844574', 'ean13')), printed = normalizeBarcode(code('3612624649779', 'ean13'));
  assert.equal(decoded.supported, true); assert.equal(printed.supported, true); assert.notEqual(decoded.canonicalCode, printed.canonicalCode);
  const d = declaration(); d.associationEvidenceIds = []; assert.equal(selectDeclaration(d, item(), 'public', policy(), now).predicate.association.passed, false);
});
test('A05 CeraVe identity cannot import contradictory soda declaration; no full-list bundle', () => {
  const i = item(); i.name = 'CeraVe'; i.variant.brand = 'CeraVe';
  const d = declaration(); d.variant.brand = 'Soda'; d.variant.form = 'beverage'; d.rawText = 'Carbonated water, Sugar';
  const selected = selectDeclaration(d, i, 'public', policy(), now); assert.equal(selected.state, 'conflict'); assert.equal(selected.accepted, false);
  assert.equal(canClaimFullListAbsence(toFactBundle(d, i, selected, [], 'user_bound'), now), false); assert.equal(i.name, 'CeraVe');
});
test('A06 corrupted toner text is verbatim uncertain evidence, never silently repaired', () => {
  const d = declaration(); d.rawText = 'Water, P0lyacrylarnide // PPG-6-Decyltetradeceth-3O'; d.sections = [section(d.rawText)]; d.transcriptionUncertainty = ['chemical_transcription_discrepancy'];
  const selected = selectDeclaration(d, item(), 'public', policy(), now); assert.equal(selected.state, 'uncertain'); assert.equal(selected.accepted, false);
  assert.equal(d.sections[0].entries[1].rawToken, 'P0lyacrylarnide // PPG-6-Decyltetradeceth-3O'); assert.equal(d.sections[0].entries[1].canonicalIngredientId, null);
});
test('A07 private Squatch package proof is owner-bound, cannot upgrade public or other-owner verification', () => {
  const d = declaration(), i = item(); i.name = 'Dr. Squatch'; i.packageMarket = 'US'; d.scope = 'private_package'; d.ownerId = id(10); d.packageObservationId = id(11); d.packageMarket = 'US';
  assert.equal(selectDeclaration(d, i, 'private_package', policy(), now, { ownerId: id(10), packageObservationId: id(11) }).accepted, true);
  assert.equal(selectDeclaration(d, i, 'public', policy(), now).accepted, false);
  assert.equal(selectDeclaration(d, i, 'private_package', policy(), now, { ownerId: id(12), packageObservationId: id(11) }).accepted, false);
  assert.equal(i.scope, 'public'); assert.equal(i.declarationIds.length, 1);
});
test('US source tag is equivalent to US market without admitting unknown or other markets',()=>{const d=declaration();d.sourceMarkets=['en:united-states','en:morocco'];const selected=selectDeclaration(d,item(),'public',policy(),now);assert.equal(selected.predicate.variantMarket.passed,true);assert.deepEqual(d.sourceMarkets,['en:united-states','en:morocco']);for(const markets of [[],['en:morocco'],['en:united-kingdom']]){d.sourceMarkets=markets;assert.equal(selectDeclaration(d,item(),'public',policy(),now).predicate.variantMarket.passed,false);}});
test('A08 explicit scent/SPF/strength/form/size/count contradictions win; unknown market is never US', () => {
  for (const [key, value] of Object.entries({ scent: 'rose', spf: '50', strength: 'double', form: 'cream', size: '200', packCount: 2 })) {
    const d = declaration(); Object.assign(d.variant, { [key]: value }); const result = selectDeclaration(d, item(), 'public', policy(), now);
    assert.equal(result.predicate.noContradiction.passed, false, key); assert.equal(result.accepted, false, key);
  }
  const d = declaration(); d.sourceMarkets = []; assert.equal(selectDeclaration(d, item(), 'public', policy(), now).predicate.variantMarket.passed, false); assert.deepEqual(d.sourceMarkets, []);
  const missing = { ...variant, scent: null }; assert.equal(compareVariant(missing, variant).unknowns.includes('scent'), true);
});
test('A09 same GTIN immutable declarations coexist; saved package selection not overwritten or unioned', () => {
  const ledger = createEvidenceRevisionLedger(); ledger.appendSnapshot(item());
  const old = declaration(), latest = structuredClone(old); ledger.appendDeclaration(old);
  const saved = ledger.snapshotAtSave(old.snapshotId!, old.declarationId, id(10));
  latest.declarationId = id(20); latest.revision = 2; latest.supersedesId = old.declarationId; latest.rawText = 'Water, New Ingredient'; latest.sections = [section(latest.rawText)]; ledger.appendDeclaration(latest);
  assert.equal(latest.formulaEquivalence, 'unknown'); assert.equal(saved.selectedDeclarationId, old.declarationId); assert.equal(saved.declaration?.rawText, 'Water, Glycerin');
  assert.equal(ledger.getDeclaration(latest.declarationId)?.rawText, 'Water, New Ingredient');
  assert.throws(() => ledger.appendDeclaration({ ...old, rawText: latest.rawText }), /immutable_revision_conflict/);
  assert.throws(() => { saved.declaration!.rawText = 'mutated'; }, TypeError);
  assert.throws(() => ledger.snapshotAtSave(old.snapshotId!, id(999), id(10)), /unknown_saved_revision/);
});
test('A10 extracting a valid substring/key ingredients cannot satisfy whole-section completeness', () => {
  const source = 'Water, Glycerin, Phenoxyethanol';
  const cropped = extractBoundedSection(source, { start: 0, end: 15, establishedStart: 0, establishedEnd: source.length, sectionLabel: 'Ingredients', lineCoverageComplete: true });
  assert.equal(cropped.rawText, 'Water, Glycerin'); assert.equal(cropped.complete, false);
  const key = extractBoundedSection(source, { start: 0, end: source.length, establishedStart: 0, establishedEnd: source.length, sectionLabel: 'Key ingredients', lineCoverageComplete: true }); assert.equal(key.complete, false);
  const d = declaration(); d.sections[0].endCovered = false; assert.equal(selectDeclaration(d, item(), 'public', policy(), now).accepted, false);
});
test('A11 chemical commas, parentheses, compounds, decimal quantities and may-contain spans remain exact', () => {
  const raw = '1,2-Hexanediol, Aqua (Water, Eau), PPG-6-Decyltetradeceth-30, PEG-240/HDI Copolymer, Zinc Oxide 1,5% w/w, May contain (+/-): CI 77491, CI 77492';
  const parsed = section(raw); assert.equal(parsed.entries.length, 7);
  assert.equal(parsed.entries[0].rawToken, '1,2-Hexanediol'); assert.equal(parsed.entries[1].rawToken, 'Aqua (Water, Eau)'); assert.equal(parsed.entries[4].quantity?.value, '1,5'); assert.equal(parsed.entries[4].quantity?.unit, '%'); assert.equal(parsed.entries[4].quantity?.basis, 'w/w'); assert.equal(parsed.entries[6].conditional, 'May contain (+/-):');
  for (const entry of parsed.entries) { const span = entry.sourceSpans[0]; assert.equal(raw.slice(span.start!, span.end!), entry.rawToken); assert.equal(entry.canonicalIngredientId, null); }
  const n = normalizeWithOffsets('Aqua\n  Cafe\u0301', 10); assert.equal(n.text, 'Aqua Café'); assert.equal(n.mapping.at(-1)?.sourceEnd, 22);
});
test('A12 active-only Drug Facts remains partial; explanatory column and complex marketing quantity not inferred', () => {
  const d = declaration(); d.category = 'drug'; d.sections = [{ ...section('Zinc Oxide 20%'), kind: 'active' }];
  assert.equal(selectDeclaration(d, item(), 'public', policy(), now).accepted, false);
  d.sections.push({ ...section('Water, Glycerin'), kind: 'inactive' }); assert.equal(selectDeclaration(d, item(), 'public', policy(), now).accepted, true);
  const panel = 'Water\tA liquid solvent\nSodium Bicarbonate\tHelps neutralize odors';
  const native = parseIngredientTable({ sectionId: id(2), observationId: id(3), imageId: null, sourceRevision: 1, kind: 'ingredients', startCovered: true, endCovered: true, lineCoverageComplete: true, entryId: order => id(100 + order), sourceText: panel, rows: [{ ingredientStart: 0, ingredientEnd: 5, explanationStart: 6, explanationEnd: 22 }, { ingredientStart: 23, ingredientEnd: 41, explanationStart: 42, explanationEnd: panel.length }] });
  assert.deepEqual(native.entries.map(e => e.rawToken), ['Water', 'Sodium Bicarbonate']); assert.equal(native.rawText, panel);
  const remedy = section('Water, Ascorbic Acid, Glutathione'); assert.equal(remedy.entries.every(e => e.quantity === null), true);
  assert.equal(extractBoundedSection('15% Vitamin C Complex', { start: 0, end: 21, establishedStart: 0, establishedEnd: 21, sectionLabel: 'Complex claim', lineCoverageComplete: true }).complete, false);
});
test('A13 front-image revision never refreshes ingredient observation/revision', () => {
  const ledger = createEvidenceRevisionLedger(); ledger.appendSnapshot(item()); ledger.appendDeclaration(declaration());
  const prior = ledger.getDeclaration(id(6));
  const ingredients = { role: 'ingredients' as const, observedAt: now, sourceRevision: 1, language: 'en', crop: [0, 0, 1, 1], rotation: 0, evidenceId: id(31) };
  const front = { role: 'front' as const, observedAt: '2026-10-03T00:00:00.000Z', sourceRevision: 2, language: 'fr', crop: [0, 0.1, 1, 0.9], rotation: 90, evidenceId: id(30) };
  const images = appendImageObservation(appendImageObservation([], ingredients), front);
  assert.equal(images[0].observedAt, now); assert.equal(images[1].sourceRevision, 2);
  assert.equal(ledger.getDeclaration(id(6)), prior); assert.equal(prior?.sourceRevision, 1); assert.equal(prior?.observedAt, now);
  assert.throws(() => appendImageObservation(images, { ...ingredients, observedAt: front.observedAt }), /immutable_image_conflict/);
});
test('A22 provider 429, timeout, malformed/HTML/unconfigured and genuine miss are separate cache states', () => {
  const cases = [
    ['rate_limited', { status: 429, retryAfter: '120' }, {}], ['unavailable', { status: 0 }, {}], ['unavailable', { status: 503 }, {}], ['malformed_response', {}, '{bad'], ['malformed_response', { status: 403, contentType: 'text/html' }, '<html>Denied</html>'], ['configuration_required', { status: 401 }, {}], ['not_found', {}, { status: 0 }],
  ] as const;
  for (const [expected, options, body] of cases) { const reply = lookup(body, options); assert.equal(reply.status, expected); assert.equal(negativeCacheExpiry(reply, now) !== null, expected === 'not_found'); }
  const hit = lookup({ status: 1, product: { code: '3606000537538', product_name: 'CeraVe' } }); assert.equal(hit.status, 'found'); assert.equal(negativeCacheExpiry(hit, now), null); assert.equal((hit.observations[0].payload as { rawIngredients: unknown }).rawIngredients, null);
  assert.equal(lookup({}, {}, ExternalSourcePolicies[0]).status, 'disallowed_by_source_policy');
  assert.equal(lookup({}, { decompressedBytes: 300000 }).status, 'malformed_response');
});
test('A22 provider-native UPC identifiers normalize before comparison; requested code cannot supply source binding', () => {
  const upc = evaluateProviderFixture('upcitemdb', { ...request, canonicalCode: '00305210416383', originalCode: '305210416383', nativeCode: '305210416383' }, policy('upcitemdb'), response({ code: 'OK', items: [{ ean: '0305210416383', title: 'Synthetic Vaseline' }] }), { now, observationId: id(3), contentHash: 'hash', sourceUrl: null });
  assert.equal(upc.observations[0].comparison, 'exact');
  const contradictory = lookup({ status: 1, product: { code: '305210416383', product_name: 'Wrong item' } }); assert.equal(contradictory.observations[0].comparison, 'contradiction');
  assert.equal(ProviderLookupRequestSchema.safeParse({ ...request, ownerId: id(10), profile: {} }).success, false);
});
test('A26 rights revocation/read purge/offline expiry remove affected material but retain independent identity', () => {
  const p = policy(); const display: DisplayProjection = { resultRevision: 1, selectedIdentity: { id: id(5), name: 'Example', brand: 'Example', variantText: '100 ml', expiresAt: later, image: { url: 'https://authorized.example/image', policyId: p.policyId, evidenceId: id(30), observedAt: now, expiresAt: later, sourceRevision: 1 } }, candidates: [], sections: [{ sectionId: id(2), kind: 'ingredients', text: 'Water', evidenceIds: [id(3)], policyId: p.policyId, observedAt: now, expiresAt: later }], sources: [], limitations: [] };
  assert.equal(filterDisplayProjection(display, [p], now).sections.length, 1);
  const revoked = { ...p, revokedAt: now }; const purged = filterDisplayProjection(display, [revoked], now); assert.equal(purged.sections.length, 0); assert.equal(purged.selectedIdentity?.image, null); assert.equal(purged.selectedIdentity?.name, 'Example');
  const offline = filterDisplayProjection(display, [p], '2026-10-03T12:00:00.000Z', now); assert.equal(offline.sections.length, 0); assert.equal(offline.selectedIdentity?.image, null);
  const expiredIdentity = { ...display.selectedIdentity!, expiresAt: now };
  const expired = filterDisplayProjection({ ...display, selectedIdentity: expiredIdentity, candidates: [expiredIdentity] }, [p], now);
  assert.equal(expired.selectedIdentity, null); assert.deepEqual(expired.candidates, []);
  assert.equal(selectDeclaration(declaration(), item(), 'public', p, now, { revokedIds: [id(3)] }).accepted, false);
});
test('SEC02 SSRF validation denies private addresses, redirects, missing DNS, credentials and oversized bodies', () => {
  assert.equal(isPermittedProviderDestination('https://authorized.example/item', ['authorized.example'], ['93.184.216.34']), true);
  for (const addr of ['127.0.0.1', '10.0.0.1', '169.254.169.254', '100.64.0.1', '172.31.1.1', '192.168.1.1', '::1', '::ffff:127.0.0.1', 'fe80::1', 'fc00::1']) assert.equal(isPermittedProviderDestination('https://authorized.example/item', ['authorized.example'], [addr]), false, addr);
  for (const url of ['http://authorized.example/', 'https://user:pass@authorized.example/', 'https://authorized.example:8443/', 'https://other.example/', 'https://authorized.example/#fragment']) assert.equal(isPermittedProviderDestination(url, ['authorized.example'], ['93.184.216.34']), false);
  assert.equal(isPermittedProviderDestination('https://authorized.example/', ['authorized.example'], []), false);
  assert.equal(isPermittedProviderDestination('https://authorized.example/', ['authorized.example'], ['93.184.216.34'], 4), false);
  assert.equal(lookup({ status: 0 }, { body: ' '.repeat(262145), decompressedBytes: 262145 }).status, 'malformed_response');
});
test('runtime request schemas reject omitted nullable fields, client owners, malformed IDs and cross-revision display', () => {
  const req = { schemaVersion: 1, requestId: id(40), idempotencyKey: 'fixture', clientScanId: id(41), generation: 0, code: code('305210416383', 'upca'), requestedMarket: null, categoryHint: null };
  assert.equal(ScanRequestSchema.safeParse(req).success, true); const { requestedMarket, ...missing } = req; assert.equal(ScanRequestSchema.safeParse(missing).success, false);
  assert.equal(ScanRequestSchema.safeParse({ ...req, ownerId: id(10) }).success, false); assert.equal(ScanRequestSchema.safeParse({ ...req, requestId: 'non-uuid' }).success, false);
  assert.equal(CaptureCommitRequestSchema.safeParse({ idempotencyKey: 'fixture', expectedGeneration: 0, expectedResultRevision: 0, expectedCaptureRevision: 0, expectedDeletionEpoch: 0, packageObservationId: id(11), assets: [], observations: [], edits: [] }).success, true);
  const result = { schemaVersion: 1, requestId: id(40), scanId: id(42), generation: 0, resultRevision: 1, identity: 'unresolved', itemId: null, candidateIds: [], snapshotId: null, declarationId: null, declarationState: 'none', scope: null, packageConfirmation: 'unconfirmed', work: 'complete', jobId: null, subscriptionId: null, nextCheckAfter: null, display: { resultRevision: 2, selectedIdentity: null, candidates: [], sections: [], sources: [], limitations: [] }, reasonCodes: [], conflictIds: [], evidenceIds: [], allowedActions: ['rescan'], freshness: { observedAt: null, expiresAt: null, state: 'unknown' } };
  assert.equal(ScanResultSchema.safeParse(result).success, false); assert.equal(ScanResultSchema.safeParse({ ...result, display: { ...result.display, resultRevision: 1 } }).success, true);
});
test('whole DEC predicate records evidence/reasons and fails unknown or unapproved source rights', () => {
  assert.equal(DeclarationSchema.safeParse(declaration()).success, true); assert.equal(SourcePolicySchema.safeParse(policy()).success, true);
  for (const p of ExternalSourcePolicies) { for (const op of Object.keys(p.operations) as Array<keyof SourcePolicy['operations']>) assert.equal(policyAllows(p, op, now), false); }
  const selected = selectDeclaration(declaration(), item(), 'public', policy(), now); assert.equal(selected.accepted, true); assert.equal(Object.values(selected.predicate).every(c => c.evidenceIds.length > 0), true); assert.equal(canClaimFullListAbsence(toFactBundle(declaration(), item(), selected, [], 'unconfirmed'), now), true);
  assert.equal(selectDeclaration(declaration(), item(), 'public', undefined, now).accepted, false);
  const shortPolicy = { ...policy(), expiresAt: '2026-10-03T00:00:00.000Z' };
  const shortSelection = selectDeclaration(declaration(), item(), 'public', shortPolicy, now);
  const bundle = toFactBundle(declaration(), item(), shortSelection, [], 'unconfirmed');
  assert.equal(bundle.expiresAt, shortPolicy.expiresAt);
  assert.equal(canClaimFullListAbsence(bundle, '2026-10-03T00:00:00.000Z'), false);
  assert.equal(canClaimFullListAbsence(bundle, now, [id(3)]), false);
});

test('admission bridge derives DEC from source text/variant and freezes exact RPC records', async () => {
  const { buildEvidenceAdmissions, EvidenceAdmissionSchema } = await import('../src/domain/part-one/admission.ts');
  const p = policy('open_facts'), d = declaration(), i = item();
  const reply = lookup({ status: 1, product: { code: '3606000537538', product_name: 'Example', ingredients_text: d.rawText, variant, countries_tags: ['US'] } });
  const observation = reply.observations[0];
  const context = { databasePolicy: { databasePolicyId: 'open_facts', sourcePolicyId: p.policyId, policyVersion: p.version } };
  const result = buildEvidenceAdmissions(observation, i, d, p, now, context);
  assert.equal(result.selection.accepted, true);
  assert.deepEqual(result.admissions.map(a => a.kind), ['observation', 'declaration', 'snapshot']);
  assert.deepEqual(result.admissions.map(a => a.id), [id(3), id(6), id(4)]);
  for (const record of result.admissions) { assert.equal(EvidenceAdmissionSchema.safeParse(record).success, true); assert.equal(record.policyId, 'open_facts'); }
  const admitted = result.admissions[1].payload;
  assert.equal(admitted.state, 'accepted'); assert.deepEqual(admitted.predicate, result.selection.predicate);
  assert.equal((admitted.sections as DisplayProjection['sections'])[0].text, d.rawText);
  assert.deepEqual(admitted.structuredSections, d.sections);
  assert.equal(result.admissions[1].dependencies.includes(i.snapshotId), false);
  assert.equal(result.admissions[2].dependencies.includes(d.declarationId), true);
  assert.throws(() => { result.admissions[1].payload.state = 'mutated'; }, TypeError);
  assert.throws(() => buildEvidenceAdmissions(observation, i, { ...d, predicate: {} } as Declaration, p, now, context));
  const wrongSource = structuredClone(observation); wrongSource.variant.brand = 'Soda';
  const contradicted = buildEvidenceAdmissions(wrongSource, i, d, p, now, context);
  assert.equal(contradicted.selection.accepted, false); assert.equal(contradicted.admissions[1].payload.state, 'conflict');
  assert.equal(d.conflictIds.length, 0); assert.equal(i.name, 'Example Daily toner');
});
test('admission bridge rejects unapproved/mismatched policy and source binding; cannot admit false-complete substring', async () => {
  const { buildEvidenceAdmissions } = await import('../src/domain/part-one/admission.ts');
  const p = policy('open_facts'), d = declaration(), i = item();
  const observation = lookup({ status: 1, product: { code: '3606000537538', product_name: 'Example', ingredients_text: d.rawText, variant, countries_tags: ['US'] } }).observations[0];
  const context = { databasePolicy: { databasePolicyId: 'open_facts', sourcePolicyId: p.policyId, policyVersion: p.version } };
  assert.throws(() => buildEvidenceAdmissions(observation, i, d, p, now), /policy_mapping_required/);
  assert.throws(() => buildEvidenceAdmissions(observation, i, d, p, now, { databasePolicy: { ...context.databasePolicy, databasePolicyId: 'derive_catalog' } }), /policy_mapping_mismatch/);
  assert.throws(() => buildEvidenceAdmissions(observation, i, d, { ...p, permissionEvidence: null }, now, context), /source_policy_disabled/);
  assert.throws(() => buildEvidenceAdmissions({ ...observation, policyVersion: 'wrong' }, i, d, p, now, context), /policy_mapping_mismatch/);
  const partial = structuredClone(d); partial.rawText += ', Phenoxyethanol';
  const fullSource = { ...observation, payload: { ...(observation.payload as object), rawIngredients: partial.rawText } };
  // Caller-marked complete sections still omit the declaration tail: reparse/coverage retract readiness.
  const cropped = buildEvidenceAdmissions(fullSource, i, partial, p, now, context);
  assert.equal(cropped.selection.accepted, false); assert.equal(cropped.selection.predicate.completeness.passed, false);
  const omittedEntries = structuredClone(d); omittedEntries.sections[0].entries.pop();
  assert.equal(buildEvidenceAdmissions(observation, i, omittedEntries, p, now, context).selection.accepted, false);
  const noMarket = { ...observation, sourceMarkets: [] };
  assert.equal(buildEvidenceAdmissions(noMarket, i, d, p, now, context).selection.predicate.variantMarket.passed, false);
  const noVariant = { ...observation, variant: { ...variant, size: null } };
  assert.equal(buildEvidenceAdmissions(noVariant, i, d, p, now, context).selection.predicate.variantMarket.passed, false);
  assert.throws(() => buildEvidenceAdmissions(observation, i, { ...d, observedAt: '2026-10-02T12:00:01.000Z' }, p, now, context), /declaration_source_date_mismatch/);
  const unsupported = { ...observation, comparison: 'unknown' as const };
  assert.equal(buildEvidenceAdmissions(unsupported, i, d, p, now, context).selection.predicate.association.passed, false);
  const privateDeclaration = { ...d, scope: 'private_package' as const, ownerId: id(10), packageObservationId: id(11) };
  assert.throws(() => buildEvidenceAdmissions(observation, i, privateDeclaration, p, now, context), /private_retention_disabled/);
});

test('source routes build all-product Open Facts requests; UPC is needed identity fallback; supplemental routes stay disabled', async () => {
  const { buildOpenFactsLookupUrl, buildUpcIdentityLookupUrl, needsUpcIdentityFallback, supplementalAdapterDisabledReply } = await import('../supabase/functions/_shared/part-one-providers.ts');
  const openUrl = new URL(buildOpenFactsLookupUrl(request, 'https://authorized.example/'));
  assert.equal(openUrl.searchParams.get('product_type'), 'all'); assert.equal(openUrl.pathname, '/api/v2/product/3606000537538.json');
  const identityOnly = lookup({ status: 1, product: { code: '3606000537538', product_name: 'Example' } });
  assert.equal(needsUpcIdentityFallback('exact', identityOnly), false); assert.equal(needsUpcIdentityFallback('unresolved', identityOnly), true);
  assert.equal(needsUpcIdentityFallback('unresolved', lookup({ status: 0 })), true);
  assert.equal(needsUpcIdentityFallback('unresolved', lookup({}, { status: 429 })), false);
  assert.equal(new URL(buildUpcIdentityLookupUrl(request, 'https://authorized.example/lookup')).searchParams.get('upc'), request.nativeCode);
  assert.throws(() => buildOpenFactsLookupUrl(request, 'http://authorized.example/'), /invalid_provider_origin/);
  assert.throws(() => buildUpcIdentityLookupUrl(request, 'https://user:pass@authorized.example/'), /invalid_provider_endpoint/);
  for (const name of ['manufacturer', 'dailymed'] as const) {
    const result = supplementalAdapterDisabledReply(name, ExternalSourcePolicies.find(p => p.provider === name)!, now);
    assert.equal(result.status, 'disallowed_by_source_policy'); assert.equal(result.usage.calls, 0);
    assert.equal(supplementalAdapterDisabledReply(name, policy(name), now).status, 'configuration_required');
  }
});
