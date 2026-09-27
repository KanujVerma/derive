import assert from 'node:assert/strict';
import test from 'node:test';
import { CatalogContributionError, contributionCandidateKey, parseCatalogContribution,
  prioritizeContributionDemand, validateContributionGtin } from '../src/domain/catalog-contribution/proposal.ts';

const OWNER_A = '11111111-1111-4111-8111-111111111111';
const OWNER_B = '22222222-2222-4222-8222-222222222222';
const REQUEST = '33333333-3333-4333-8333-333333333333';
const EVIDENCE = '44444444-4444-4444-8444-444444444444';
function proposal(product: Record<string, unknown> = {}, rest: Record<string, unknown> = {}) {
  return { version: 1, intent: 'help_add_product', requestId: REQUEST,
    product: { brand: 'Example brand', name: 'Example cream', ...product }, ...rest };
}
function invalid(raw: unknown) {
  assert.throws(() => parseCatalogContribution(raw), (error) => error instanceof CatalogContributionError
    && error.code === 'INVALID_PROPOSAL' && error.message === 'INVALID_PROPOSAL');
}

test('explicit intent is required; an unresolved Check is not a contribution', () => {
  invalid({ ...proposal(), intent: undefined });
  invalid({ ...proposal(), intent: 'save_check' });
  invalid({ ...proposal(), version: 2 });
  invalid({ ...proposal(), requestId: 'not-an-id' });
  invalid({ ...proposal(), product: { name: 'Cream' } });
  invalid({ ...proposal(), product: { brand: 'Example' } });
});

test('bounded preparation normalizes whitespace and returns detached immutable evidence', () => {
  const raw = proposal({ brand: ' Ｅxample  brand ', name: ' Cream  SPF 30 ', region: 'us', packageSize: '50 mL' },
    { evidence: [{ evidenceId: EVIDENCE.toUpperCase(), role: 'front_label' }] });
  const parsed = parseCatalogContribution(raw);
  assert.deepEqual(parsed.product, { brand: 'Example brand', name: 'Cream SPF 30', region: 'US', packageSize: '50 mL' });
  raw.product.name = 'Changed later';
  assert.equal(parsed.product.name, 'Cream SPF 30');
  assert.ok(Object.isFrozen(parsed) && Object.isFrozen(parsed.product) && Object.isFrozen(parsed.evidence)
    && Object.isFrozen(parsed.evidence![0]));
  assert.equal(parsed.evidence![0]!.evidenceId, EVIDENCE);
});

test('untrusted owner, canonical/formula authority, public reuse and arbitrary fields are rejected', () => {
  for (const key of ['ownerId', 'productId', 'canonical', 'verifiedFormula', 'imageReuseConsent', 'sourceAuthority', 'reviewStatus', '__proto__']) {
    invalid(Object.assign(Object.create(null), proposal(), { [key]: true }));
    invalid(proposal({ [key]: true }));
  }
  invalid(proposal({}, { evidence: [{ evidenceId: EVIDENCE, role: 'front_label', publicUrl: 'https://example.test/photo' }] }));
});

test('text is length-bounded and rejects controls, invisible direction changes and invalid region', () => {
  for (const name of ['', ' '.repeat(10), 'a'.repeat(181), 'cream\nnotes', 'cre\u200bam', 'cream\u202etest']) invalid(proposal({ name }));
  invalid(proposal({ brand: 'a'.repeat(121) }));
  invalid(proposal({ variant: 'a'.repeat(181) }));
  invalid(proposal({ packageSize: 'a'.repeat(81) }));
  for (const region of ['USA', 'U', 'US/CA', 'US-', 'US-ABCDEFGHI']) invalid(proposal({ region }));
  assert.equal(parseCatalogContribution(proposal({ region: 'us-ca' })).product.region, 'US-CA');
});

test('strict JSON objects never invoke accessors and reject prototypes, symbols and hidden fields', () => {
  let invoked = false;
  const getter = { ...proposal(), get product() { invoked = true; return {}; } };
  invalid(getter);
  assert.equal(invoked, false);
  invalid(Object.create(proposal()));
  invalid(new Date());
  invalid([]);
  invalid({ ...proposal(), [Symbol('hidden')]: 'bad' });
  const hidden = proposal();
  Object.defineProperty(hidden, 'secret', { value: 'bad' });
  invalid(hidden);
  assert.equal(parseCatalogContribution(Object.assign(Object.create(null), proposal())).intent, 'help_add_product');
});

test('GTIN checks preserve exact digit lengths and validate check digits, without guessing', () => {
  for (const code of ['96385074', '036000291452', '0036000291452', '00036000291452']) {
    assert.equal(validateContributionGtin(code), code);
  }
  for (const code of ['96385075', '036000291453', '03600029145', '036-000291452', ' 036000291452',
    '00000000', '00000000000000', '０３６０００２９１４５２', 36000291452]) {
    assert.throws(() => validateContributionGtin(code), CatalogContributionError);
  }
});

test('evidence accepts opaque IDs only, not device URIs, URLs, paths or image bytes', () => {
  for (const evidenceId of ['file:///photo.jpg', 'ph://abc', 'https://example.test/image', `${OWNER_A}/free_scan/front_label/photo.jpg`, 'data:image/png;base64,abc']) {
    invalid(proposal({}, { evidence: [{ evidenceId, role: 'front_label' }] }));
  }
  invalid(proposal({}, { evidence: [{ evidenceId: EVIDENCE, role: 'skin' }] }));
  invalid(proposal({}, { evidence: [{ evidenceId: EVIDENCE, role: 'ingredients', bytes: 'abc' }] }));
});

test('evidence is bounded and rejects duplicate IDs, roles, holes and accessor items', () => {
  const first = { evidenceId: EVIDENCE, role: 'front_label' };
  invalid(proposal({}, { evidence: Array(4).fill(first) }));
  invalid(proposal({}, { evidence: [first, { evidenceId: EVIDENCE, role: 'ingredients' }] }));
  invalid(proposal({}, { evidence: [first, { evidenceId: REQUEST, role: 'front_label' }] }));
  invalid(proposal({}, { evidence: Array(1) }));
  let invoked = false;
  const accessor: unknown[] = [];
  Object.defineProperty(accessor, '0', { get() { invoked = true; return first; }, enumerable: true });
  invalid(proposal({}, { evidence: accessor }));
  assert.equal(invoked, false);
  const extra = [first];
  Object.assign(extra, { url: 'https://private.test' });
  invalid(proposal({}, { evidence: extra }));
});

test('dedupe unifies padded representations of the same GTIN without making it truth', () => {
  const key = contributionCandidateKey(parseCatalogContribution(proposal({ gtin: '036000291452' })));
  assert.equal(key, contributionCandidateKey(parseCatalogContribution(proposal({ gtin: '0036000291452', name: 'Different reported label' }))));
  assert.equal(key, contributionCandidateKey(parseCatalogContribution(proposal({ gtin: '00036000291452' }))));
  assert.ok(key.includes('00036000291452'));
});

test('region, variant and size remain separate, and missing context is not a wildcard', () => {
  const variants = [{}, { region: 'US' }, { region: 'CA' }, { variant: 'SPF 30' }, { variant: 'SPF 50' },
    { packageSize: '50 mL' }, { packageSize: '50 ML' }, { packageSize: '50 g' }, { packageSize: '1.7 fl oz' }];
  const keys = variants.map((fields) => contributionCandidateKey(parseCatalogContribution(proposal({ gtin: '036000291452', ...fields }))));
  assert.equal(new Set(keys).size, keys.length);
});

test('evidence input ordering does not make unchanged owner/request replay conflict', () => {
  const evidence = [{ evidenceId: EVIDENCE, role: 'front_label' }, { evidenceId: REQUEST, role: 'ingredients' }];
  const results = prioritizeContributionDemand([{ authenticatedOwnerId: OWNER_A, request: proposal({}, { evidence }) },
    { authenticatedOwnerId: OWNER_A, request: proposal({}, { evidence: [...evidence].reverse() }) }]);
  assert.equal(results[0]!.uniqueContributors, 1);
});

test('label-only dedupe preserves multilingual labels, punctuation and decimal/strength distinctions', () => {
  const key = (name: string) => contributionCandidateKey(parseCatalogContribution(proposal({ name })));
  assert.equal(key('Ｃream  0.1%'), key('cream 0.1%'));
  assert.notEqual(key('Cream 0.1%'), key('Cream 1%'));
  assert.notEqual(key('A/B'), key('AB'));
  assert.notEqual(key('クレンザー'), key('保湿剤'));
  assert.notEqual(key('Crème'), key('Creme'));
});

test('review demand counts unique owner identities, not repeated checks or request spam', () => {
  const request = proposal();
  const results = prioritizeContributionDemand([
    { authenticatedOwnerId: OWNER_A, request }, { authenticatedOwnerId: OWNER_A, request },
    { authenticatedOwnerId: OWNER_A, request: proposal({}, { requestId: EVIDENCE }) },
    { authenticatedOwnerId: OWNER_B, request },
  ]);
  assert.equal(results.length, 1);
  assert.deepEqual(Object.keys(results[0]!).sort(), ['candidateKey', 'conflictingObservedLabels', 'reviewRequired', 'uniqueContributors']);
  assert.equal(results[0]!.uniqueContributors, 2);
  assert.equal(results[0]!.reviewRequired, true);
  assert.ok(!JSON.stringify(results).includes(OWNER_A) && !JSON.stringify(results).includes(OWNER_B));
});

test('same owner/request replay is payload-bound and evidence changes conflict', () => {
  for (const changed of [proposal({ name: 'Different' }), proposal({}, { evidence: [{ evidenceId: EVIDENCE, role: 'front_label' }] })]) {
    assert.throws(() => prioritizeContributionDemand([{ authenticatedOwnerId: OWNER_A, request: proposal() },
      { authenticatedOwnerId: OWNER_A, request: changed }]), (error) => error instanceof CatalogContributionError && error.code === 'IDEMPOTENCY_CONFLICT');
  }
});

test('request IDs are owner-bound, not globally deduplicated', () => {
  const results = prioritizeContributionDemand([{ authenticatedOwnerId: OWNER_A, request: proposal() },
    { authenticatedOwnerId: OWNER_B, request: proposal({ name: 'Different' }) }]);
  assert.equal(results.length, 2);
});

test('GTIN conflicting observed labels remain review conflicts rather than majority canonical truth', () => {
  const results = prioritizeContributionDemand([{ authenticatedOwnerId: OWNER_A, request: proposal({ gtin: '036000291452' }) },
    { authenticatedOwnerId: OWNER_B, request: proposal({ gtin: '036000291452', name: 'Different reported label' }) }]);
  assert.equal(results[0]!.uniqueContributors, 2);
  assert.equal(results[0]!.conflictingObservedLabels, true);
  assert.equal('verified' in results[0]!, false);
  assert.equal('formula' in results[0]!, false);
});

test('ranking is deterministic and bounded without silently dropping input', () => {
  const inputs = [{ authenticatedOwnerId: OWNER_A, request: proposal({ name: 'Other' }) },
    { authenticatedOwnerId: OWNER_B, request: proposal() },
    { authenticatedOwnerId: OWNER_A, request: proposal({}, { requestId: EVIDENCE }) }];
  const results = prioritizeContributionDemand(inputs);
  assert.equal(results[0]!.uniqueContributors, 2);
  assert.deepEqual(results, prioritizeContributionDemand([...inputs].reverse()));
  assert.deepEqual(prioritizeContributionDemand([]), []);
  assert.throws(() => prioritizeContributionDemand(Array(5001).fill(inputs[0])), (error) => error instanceof CatalogContributionError
    && error.code === 'BATCH_TOO_LARGE');
});

test('demand envelopes reject customer-assigned identity or malformed owners', () => {
  assert.throws(() => prioritizeContributionDemand([{ authenticatedOwnerId: 'anonymous', request: proposal() }]), CatalogContributionError);
  assert.throws(() => prioritizeContributionDemand([{ authenticatedOwnerId: OWNER_A, request: { ...proposal(), ownerId: OWNER_B } }]), CatalogContributionError);
});
