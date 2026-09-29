import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { coverageSha256, evaluateCoverage } from '../scripts/catalog-coverage-benchmark.ts';
import { adjudicateOpenBeautyFactsRun, openBeautyFactsEvaluationReadiness, runOpenBeautyFactsEvaluation } from '../scripts/open-beauty-facts-evaluation.ts';

const gtinA = '000000000000';
const gtinB = '000000000017';
const userAgent = 'DeriveCatalogEval/1.0 (contact@example.com)';
const identity = { brand: 'Fiction', name: 'Synthetic Lotion', variant: '', packageSize: '100 mL', region: 'US' };
function fixture() {
  const row = (id: string, gtin: string) => ({ id, gtin, category: 'facial_moisturizer', channel: 'drugstore',
    scan: { decoded: true, deviceEvidenceRef: 'synthetic-device' },
    reference: { identity, evidenceRef: 'synthetic-package' },
    rights: { collectionEvidenceRef: 'synthetic-collection', permissionEvidenceRef: 'synthetic-permission', providerEvaluationAllowed: true } });
  const corpus = { schemaVersion: 1, cohort: 'synthetic-evaluator-test', cases: [row('a', gtinA), row('repeat-a', `0${gtinA}`), row('b', gtinB)],
    sources: [{ id: 'open-beauty-facts', kind: 'external', evaluationPermissionRef: 'reviewed-evaluation', termsReviewRef: 'reviewed-terms' }] };
  const json = JSON.stringify(corpus);
  const digest = coverageSha256(json);
  const options = { allowNetwork: true as const, evaluationPermissionRef: 'reviewed-evaluation', termsReviewRef: 'reviewed-terms', userAgent, maxUniqueReads: 2 };
  return { corpus, json, digest, options };
}
const response = (gtin: string, extra: Record<string, unknown> = {}) => new Response(JSON.stringify({
  code: gtin, status: 'success', result: { id: 'product_found' },
  product: { code: gtin, brands: 'Fiction', product_name: 'Synthetic Lotion', quantity: '100 mL',
    last_modified_t: 1700000000, ingredients_text: 'SHOULD_NEVER_APPEAR', image_front_url: 'SHOULD_NEVER_APPEAR', ...extra },
}), { status: 200, headers: { 'content-type': 'application/json' } });

test('default CLI and readiness perform zero network calls', () => {
  assert.deepEqual(openBeautyFactsEvaluationReadiness(), { status: 'NETWORK_DISABLED_UNTIL_EXPLICIT_RIGHTS_REVIEW',
    sourceId: 'open-beauty-facts', providerCalls: 0, measuredCoverage: null });
  const cli = spawnSync(process.execPath, ['--experimental-strip-types', 'scripts/open-beauty-facts-evaluation-cli.ts'], { encoding: 'utf8' });
  assert.equal(cli.status, 0);
  assert.equal(JSON.parse(cli.stdout).providerCalls, 0);
});

test('permission, rights, user agent and bounded read count fail before fetch', async () => {
  const f = fixture(); let calls = 0;
  const fetcher: typeof fetch = async () => { calls++; throw new Error('unexpected network'); };
  await assert.rejects(runOpenBeautyFactsEvaluation(f.json, f.digest, { ...f.options, allowNetwork: false } as never, { fetcher }));
  await assert.rejects(runOpenBeautyFactsEvaluation(f.json, f.digest, { ...f.options, termsReviewRef: 'wrong' }, { fetcher }));
  await assert.rejects(runOpenBeautyFactsEvaluation(f.json, f.digest, { ...f.options, userAgent: 'curl' }, { fetcher }));
  await assert.rejects(runOpenBeautyFactsEvaluation(f.json, f.digest, { ...f.options, maxUniqueReads: 1 }, { fetcher }));
  f.corpus.cases[1].rights.providerEvaluationAllowed = false;
  f.json = JSON.stringify(f.corpus); f.digest = coverageSha256(f.json);
  await assert.rejects(runOpenBeautyFactsEvaluation(f.json, f.digest, f.options, { fetcher }));
  assert.equal(calls, 0);
});

test('v3 exact barcode projection is bounded, deduplicated, paced below 15/min and pending review', async () => {
  const f = fixture(); let current = 0;
  const starts: number[] = []; const waits: number[] = []; const calls: Array<{ url: string; init?: RequestInit }> = [];
  const pending = await runOpenBeautyFactsEvaluation(f.json, f.digest, f.options, {
    clock: () => current, sleep: async ms => { waits.push(ms); current += ms; },
    now: () => new Date('2026-09-28T00:00:00Z'),
    fetcher: async (url, init) => { starts.push(current); calls.push({ url: String(url), init }); current += 17;
      return response(String(url).includes(gtinA) ? gtinA : gtinB); },
  });
  assert.equal(calls.length, 2); // Repeat scan encounter reuses one external lookup.
  assert.ok(starts[1] - starts[0] >= 6000);
  assert.deepEqual(waits, [5983]);
  assert.equal(calls[0].url, `https://world.openbeautyfacts.org/api/v3/product/${gtinA}.json?fields=code,brands,product_name,quantity,categories,last_modified_t`);
  assert.equal(calls[0].init?.redirect, 'error');
  assert.equal((calls[0].init?.headers as Record<string, string>)['User-Agent'], userAgent);
  assert.equal(pending.entries.length, 3);
  assert.equal(pending.entries[0].outcome, 'candidate');
  assert.equal(pending.entries[0].candidate?.identity.region, 'Unverified');
  assert.equal(pending.entries[0].candidate?.recordRef, `obf:gtin-sha256:${coverageSha256(gtinA)}`);
  assert.equal(JSON.stringify(pending).includes(gtinA), false);
  assert.equal(JSON.stringify(pending).includes('SHOULD_NEVER_APPEAR'), false);
  assert.equal(JSON.stringify(pending).includes('canonicalProductId'), false);
  assert.throws(() => evaluateCoverage(f.json, f.digest, [pending]), /INVALID_CATALOG_COVERAGE_INPUT/);
  const reviewed = adjudicateOpenBeautyFactsRun(f.json, f.digest, pending, pending.entries.map(entry => ({
    caseId: entry.caseId, identityMatch: 'possible' as const, reviewerRef: 'independent-reviewer', evidenceRef: `comparison-${entry.caseId}`,
  })));
  const scored = evaluateCoverage(f.json, f.digest, [reviewed]).sources[0];
  assert.equal(scored.counts.candidate, 3);
  assert.equal(scored.counts.possibleCandidate, 3);
  assert.equal(scored.counts.usefulHit, 0); // Possible without observed customer confirmation is not a launch hit.
});

test('human review must cover every candidate and must not fabricate customer confirmation', async () => {
  const f = fixture(); const pending = await runOpenBeautyFactsEvaluation(f.json, f.digest, f.options, {
    clock: () => 0, sleep: async () => {}, fetcher: async (url) => response(String(url).includes(gtinA) ? gtinA : gtinB),
  });
  assert.throws(() => adjudicateOpenBeautyFactsRun(f.json, f.digest, pending, []));
  const reviews = pending.entries.map(entry => ({ caseId: entry.caseId, identityMatch: 'possible' as const,
    reviewerRef: 'reviewer', evidenceRef: `comparison-${entry.caseId}` }));
  reviews[0].evidenceRef = '';
  assert.throws(() => adjudicateOpenBeautyFactsRun(f.json, f.digest, pending, reviews));
});

test('rate limit or upstream overload stops further queries and leaves unrun encounters visible', async () => {
  const f = fixture(); let calls = 0;
  const pending = await runOpenBeautyFactsEvaluation(f.json, f.digest, f.options, {
    clock: () => 0, sleep: async () => {}, fetcher: async () => { calls++; return new Response(null, { status: 429 }); },
  });
  assert.equal(calls, 1);
  assert.equal(pending.entries.length, 2); // Both encounters for the queried GTIN share the error.
  assert.ok(pending.entries.every(entry => entry.outcome === 'error' && entry.action === 'search_name'));
  assert.equal(evaluateCoverage(f.json, f.digest, [pending]).sources[0].status, 'PARTIAL');
});

test('oversized, malformed or code-mismatched payloads never become candidates', async () => {
  const f = fixture();
  for (const badResponse of [
    new Response('x'.repeat(32_769), { headers: { 'content-type': 'application/json' } }),
    new Response('{bad', { headers: { 'content-type': 'application/json' } }),
    response(gtinA, { code: gtinB }),
  ]) {
    const run = await runOpenBeautyFactsEvaluation(f.json, f.digest, { ...f.options, maxUniqueReads: 2 }, {
      clock: () => 0, sleep: async () => {}, fetcher: async () => badResponse.clone(),
    });
    assert.notEqual(run.entries[0].outcome, 'candidate');
  }
});

test('only UPC-A and leading-zero EAN-13 equivalents share identity', async () => {
  const f = fixture();
  const equivalent = await runOpenBeautyFactsEvaluation(f.json, f.digest, f.options, {
    clock: () => 0, sleep: async () => {}, fetcher: async (url) => response(String(url).includes(gtinA) ? `0${gtinA}` : gtinB),
  });
  assert.equal(equivalent.entries[0].outcome, 'candidate');
  assert.equal(equivalent.entries[1].outcome, 'candidate');
  assert.equal(equivalent.entries[0].candidate?.recordRef, `obf:gtin-sha256:${coverageSha256(gtinA)}`);
  const wrong = await runOpenBeautyFactsEvaluation(f.json, f.digest, f.options, {
    clock: () => 0, sleep: async () => {}, fetcher: async () => response(gtinB),
  });
  assert.equal(wrong.entries[0].outcome, 'error');
});

test('parallel in-process evaluations cannot compound the provider read budget', async () => {
  const f = fixture(); let release!: (value: Response) => void; let calls = 0;
  const pendingResponse = new Promise<Response>(resolve => { release = resolve; });
  const first = runOpenBeautyFactsEvaluation(f.json, f.digest, f.options, {
    clock: () => 0, sleep: async () => {}, fetcher: async () => { calls++; return pendingResponse; },
  });
  await assert.rejects(runOpenBeautyFactsEvaluation(f.json, f.digest, f.options, {
    clock: () => 0, sleep: async () => {}, fetcher: async () => { calls++; return response(gtinA); },
  }), /OBF_EVALUATION_NOT_AUTHORIZED/);
  assert.equal(calls, 1);
  release(new Response(null, { status: 429 }));
  await first;
  const third = await runOpenBeautyFactsEvaluation(f.json, f.digest, f.options, {
    clock: () => 0, sleep: async () => {}, fetcher: async () => { calls++; return new Response(null, { status: 429 }); },
  });
  assert.equal(third.entries[0].outcome, 'error');
  assert.equal(calls, 2);
});
