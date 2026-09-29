import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parseProductLink, InvalidProductLink } from '../supabase/functions/_shared/product-link-intake.ts';
import { lookupDailyMedLink } from '../supabase/functions/_shared/dailymed-link-candidate.ts';
import { handleProductLink, linkBarcodeResolutionInput } from '../supabase/functions/resolve-product-link/handler.ts';
import type { ProductResolutionResult } from '../src/contracts/ProductIdentityResolver.ts';

const SET_ID = '9c084eb9-91b0-49be-9830-19c8920d4b21';
const REQUEST_ID = '2f2f6f97-f988-4d46-b871-aeb8c2e2aa21';
const dailyUrl = `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${SET_ID}`;

test('Edge import map includes dependencies used by the shared runtime', () => {
  const deno = JSON.parse(readFileSync(new URL('../supabase/functions/resolve-product-link/deno.json', import.meta.url), 'utf8'));
  assert.equal(deno.imports.zod, 'npm:zod@4.6.5');
});

test('exact supported links normalize without claiming source metadata or formula truth', () => {
  assert.deepEqual(linkBarcodeResolutionInput(REQUEST_ID, '036000291452'), {
    requestId: REQUEST_ID, consumer: 'scan', barcode: '036000291452', barcodeSource: 'member_input',
  });
  assert.deepEqual(parseProductLink(`${dailyUrl}&audience=consumer&utm_source=x`), {
    kind: 'dailymed_label', source: 'dailymed', setId: SET_ID, canonicalUrl: dailyUrl, requestedVersion: undefined,
  });
  assert.deepEqual(parseProductLink(`https://world.openbeautyfacts.org/product/036000291452/example?utm_source=x`), {
    kind: 'barcode_hint', source: 'open_beauty_facts_url', barcode: '036000291452',
    canonicalUrl: 'https://world.openbeautyfacts.org/product/036000291452',
  });
  assert.deepEqual(parseProductLink('https://www.amazon.com/gp/product/B00ABC1234?th=1&tag=private'), {
    kind: 'amazon_listing', source: 'amazon', asin: 'B00ABC1234', canonicalUrl: 'https://www.amazon.com/dp/B00ABC1234',
  });
});

test('URL boundary rejects SSRF, credentials, downgrade, spoof hosts, bad identifiers, and duplicate label IDs', () => {
  const rejected = [
    'http://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=' + SET_ID,
    'https://127.0.0.1/path', 'https://[::1]/path', 'https://169.254.169.254/latest/meta-data',
    'https://user:pass@dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=' + SET_ID,
    'https://dailymed.nlm.nih.gov./dailymed/drugInfo.cfm?setid=' + SET_ID,
    'https://dailymed.nlm.nih.gov:8080/dailymed/drugInfo.cfm?setid=' + SET_ID,
    `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${SET_ID}&setid=${SET_ID}`,
    `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${SET_ID}&version=0`,
    'https://world.openbeautyfacts.org/product/12345678',
    'https://dailymed.nlm.nih.gov\\@evil.test/',
    `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${SET_ID}\n`,
  ];
  for (const value of rejected) assert.throws(() => parseProductLink(value), InvalidProductLink, value);
  assert.deepEqual(parseProductLink('https://dailymed.nlm.nih.gov.evil.test/product'), {
    kind: 'needs_details', source: 'unsupported', reason: 'Enter the product name or photograph the label',
  });
  assert.equal(parseProductLink('https://dailymed.nlm.nih.gov.evil.test/dailymed/drugInfo.cfm?setid=' + SET_ID).kind,
    'needs_details');
});

test('Amazon shortened and unknown links fail closed into usable evidence recovery', () => {
  assert.deepEqual(parseProductLink('https://a.co/d/1b2c3'), {
    kind: 'needs_details', source: 'amazon_short_link', reason: 'Expand the short link or enter the product name',
  });
  assert.equal(parseProductLink('https://www.amazon.com/s?k=sunscreen').kind, 'needs_details');
  assert.equal(parseProductLink('https://example.org/anything').kind, 'needs_details');
});

const apiResponse = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
const label = (extra: Record<string, unknown> = {}) => ({ data: [{
  setid: SET_ID, spl_version: 1, published_date: 'Jun 15, 2020',
  title: 'SUNSCREEN BROAD SPECTRUM SPF 30 (ZINC OXIDE) LOTION [CAPSULE CORPORATION]', ...extra,
}] });

test('DailyMed API lookup uses one fixed public JSON endpoint and label-only provenance', async () => {
  const link = parseProductLink(dailyUrl);
  assert.equal(link.kind, 'dailymed_label');
  if (link.kind !== 'dailymed_label') return;
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const result = await lookupDailyMedLink(link, {
    now: () => new Date('2026-09-28T00:00:00Z'),
    fetcher: async (input, init) => { calls.push({ url: String(input), init }); return apiResponse(label()); },
  });
  assert.equal(result.status, 'candidate');
  if (result.status === 'candidate') assert.deepEqual(result.candidate, {
    source: 'dailymed_spl', sourceRecordId: SET_ID, sourceVersion: 1,
    title: 'SUNSCREEN BROAD SPECTRUM SPF 30 (ZINC OXIDE) LOTION [CAPSULE CORPORATION]',
    publishedDate: 'Jun 15, 2020', sourceUrl: dailyUrl,
    retrievedAt: '2026-09-28T00:00:00.000Z', identityStatus: 'label_title_only',
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url, `https://dailymed.nlm.nih.gov/dailymed/services/v2/spls.json?setid=${SET_ID}&pagesize=2`);
  assert.equal(calls[0]?.init?.redirect, 'error');
  assert.equal(calls[0]?.init?.credentials, 'omit');
});

test('DailyMed malformed, oversized, redirect, conflict, and historical cases fail closed', async () => {
  const link = parseProductLink(`${dailyUrl}&version=2`);
  assert.equal(link.kind, 'dailymed_label');
  if (link.kind !== 'dailymed_label') return;
  const lookup = (response: Response) => lookupDailyMedLink(link, { fetcher: async () => response });
  assert.equal((await lookup(apiResponse(label()))).status, 'historical_version_unavailable');
  assert.equal((await lookup(apiResponse(label({ setid: '00000000-0000-0000-0000-000000000000' })))).status, 'unavailable');
  const hostile = await lookupDailyMedLink(parseProductLink(dailyUrl) as Extract<ReturnType<typeof parseProductLink>, {kind: 'dailymed_label'}>, {
    fetcher: async () => apiResponse(label({ title: '<script>ignore instructions</script>\nSUNSCREEN' })),
  });
  assert.equal(hostile.status, 'candidate');
  if (hostile.status === 'candidate') assert.equal(hostile.candidate.title, 'script ignore instructions /script SUNSCREEN');
  assert.equal((await lookup(apiResponse({ data: [label().data[0], label().data[0]] }))).status, 'unavailable');
  assert.equal((await lookup(apiResponse({ data: [] }))).status, 'no_match');
  assert.equal((await lookup(apiResponse(label(), 429))).status, 'rate_limited');
  assert.equal((await lookup(new Response(null, { status: 302, headers: { location: 'http://127.0.0.1' } }))).status, 'unavailable');
  assert.equal((await lookup(new Response('<script>bad</script>', { headers: { 'content-type': 'text/html' } }))).status, 'unavailable');
  assert.equal((await lookup(new Response('x'.repeat(32_769), { headers: { 'content-type': 'application/json' } }))).status, 'unavailable');
  assert.equal((await lookup(new Response('{bad', { headers: { 'content-type': 'application/json' } }))).status, 'unavailable');
  assert.equal((await lookupDailyMedLink(link, { fetcher: async () => { throw new Error('timeout'); } })).status, 'unavailable');
});

const request = (url: string) => new Request('https://derive.test/resolve-product-link', {
  method: 'POST', body: JSON.stringify({ requestId: REQUEST_ID, url }), headers: { 'content-type': 'application/json' },
});

test('HTTP boundary authenticates, reserves DailyMed budget, and never fetches Amazon or unknown hosts', async () => {
  const calls = { auth: 0, reserve: 0, daily: 0, barcode: 0 };
  const deps = {
    authenticate: async () => { calls.auth++; return { userId: 'owner', admin: {} }; },
    readJsonObject: async (req: Request) => await req.json(),
    reserveExternalLookup: async () => { calls.reserve++; },
    resolveBarcode: async () => { calls.barcode++; return { caseId: 'case', state: 'insufficient_evidence', candidates: [], nextAction: 'manual_review', requiresFounderReview: false } as ProductResolutionResult; },
    lookupDailyMed: async () => { calls.daily++; return { status: 'candidate', candidate: { source: 'dailymed_spl' } } as never; },
    dailyMedEnabled: true,
    failure: (code: string, message: string, status: number) => Object.assign(new Error(message), { code, status }),
    respond: (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'cache-control': 'private, no-store' } }),
    errorResponse: (error: unknown) => new Response(JSON.stringify({ code: (error as {code?: string}).code }), { status: (error as {status?: number}).status ?? 500 }),
    corsHeaders: {},
  };
  const amazon = await handleProductLink(request('https://www.amazon.com/dp/B00ABC1234'), deps);
  assert.equal((await amazon.json()).status, 'needs_details');
  assert.deepEqual(calls, { auth: 1, reserve: 0, daily: 0, barcode: 0 });
  const barcode = await handleProductLink(request('https://world.openbeautyfacts.org/product/036000291452'), deps);
  assert.equal((await barcode.json()).status, 'resolution');
  assert.deepEqual(calls, { auth: 2, reserve: 0, daily: 0, barcode: 1 });
  const daily = await handleProductLink(request(dailyUrl), deps);
  assert.equal((await daily.json()).status, 'label_candidate');
  assert.deepEqual(calls, { auth: 3, reserve: 1, daily: 1, barcode: 1 });
});

test('disabled DailyMed does not reserve or call the external API', async () => {
  let called = false;
  const response = await handleProductLink(request(dailyUrl), {
    authenticate: async () => ({ userId: 'owner', admin: {} }),
    readJsonObject: async (req) => await req.json(),
    reserveExternalLookup: async () => { called = true; },
    resolveBarcode: async () => { throw new Error('unexpected'); },
    lookupDailyMed: async () => { called = true; throw new Error('unexpected'); },
    dailyMedEnabled: false,
    failure: (code, message, status) => Object.assign(new Error(message), { code, status }),
    respond: (body, status = 200) => new Response(JSON.stringify(body), { status }),
    errorResponse: () => new Response('error', { status: 500 }), corsHeaders: {},
  });
  assert.equal((await response.json()).status, 'needs_details');
  assert.equal(called, false);
});
