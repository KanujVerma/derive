import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  extractPrivateProductPhoto, MAX_PRODUCT_PHOTO_BYTES, MAX_PRODUCT_PHOTO_REQUEST_BYTES,
  parsePrivateProductPhotoRequest, parsePrivateProductPhotoResult,
} from '../supabase/functions/_shared/private-product-photo.ts';
import { handlePrivateProductPhoto } from '../supabase/functions/private-product-photo/handler.ts';
import type { PrivateProductPhotoRequest } from '../src/contracts/PrivateProductPhoto.ts';

// Synthetic signature fixtures test request validation only, not visual recognition accuracy.
const jpeg = (length = 12) => {
  const bytes = new Uint8Array(length); bytes.set([255, 216, 255, 224]);
  bytes[length - 2] = 255; bytes[length - 1] = 217;
  return Buffer.from(bytes).toString('base64');
};
const requestData: PrivateProductPhotoRequest = {
  photos: [{ mimeType: 'image/jpeg', base64: jpeg() }], photoSharingConsent: true,
};
const label = { productName: 'Example Moisturizer', brand: 'Example', size: '3 oz',
  ingredientsText: 'Water, Glycerin.', category: 'skincare' as const };
const provider = (text: string = JSON.stringify(label)) => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text }] } }] });
const owner = 'e6000000-0000-4000-8000-000000000001';

test('photo request requires explicit consent and one or two bounded image-signature checked photos', () => {
  assert.deepEqual(parsePrivateProductPhotoRequest(requestData), requestData);
  assert.equal(parsePrivateProductPhotoRequest({ ...requestData, photos: [...requestData.photos, ...requestData.photos] }).photos.length, 2);
  const bad = [
    { ...requestData, photoSharingConsent: false }, { photos: requestData.photos },
    { ...requestData, ownerId: owner }, { ...requestData, profile: {} },
    { ...requestData, photos: [] }, { ...requestData, photos: Array(3).fill(requestData.photos[0]) },
    { ...requestData, photos: [{ ...requestData.photos[0], mimeType: 'image/heic' }] },
    { ...requestData, photos: [{ ...requestData.photos[0], mimeType: 'image/png' }] },
    { ...requestData, photos: [{ ...requestData.photos[0], base64: 'data:image/jpeg;base64,' + jpeg() }] },
    { ...requestData, photos: [{ ...requestData.photos[0], base64: 'not-an-image' }] },
    { ...requestData, photos: [{ ...requestData.photos[0], base64: Buffer.from('<script>x</script>').toString('base64') }] },
    { ...requestData, photos: [{ ...requestData.photos[0], url: 'https://example.com/a.jpg' }] },
  ];
  for (const value of bad) assert.throws(() => parsePrivateProductPhotoRequest(value), /INVALID_PRODUCT_PHOTOS/);
});

test('PNG and WebP require their declared format headers and bounded aggregate decoded bytes', () => {
  const png = new Uint8Array(45);
  png.set([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82]);
  new DataView(png.buffer).setUint32(16, 1); new DataView(png.buffer).setUint32(20, 1);
  png.set([0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130], 33);
  const webp = new Uint8Array(20);
  webp.set(Buffer.from('RIFF')); new DataView(webp.buffer).setUint32(4, 12, true);
  webp.set(Buffer.from('WEBPVP8 '), 8);
  for (const [mimeType, bytes] of [['image/png', png], ['image/webp', webp]] as const) {
    const photo = { mimeType, base64: Buffer.from(bytes).toString('base64') };
    assert.equal(parsePrivateProductPhotoRequest({ photos: [photo], photoSharingConsent: true }).photos.length, 1);
    const corrupt = Uint8Array.from(bytes); corrupt[0] = 0;
    assert.throws(() => parsePrivateProductPhotoRequest({ photos: [{ ...photo, base64: Buffer.from(corrupt).toString('base64') }], photoSharingConsent: true }));
  }
  const tooLarge = { ...requestData, photos: [{ mimeType: 'image/jpeg', base64: jpeg(MAX_PRODUCT_PHOTO_BYTES + 1) }] };
  assert.throws(() => parsePrivateProductPhotoRequest(tooLarge), /INVALID_PRODUCT_PHOTOS/);
  const sumTooLarge = { ...requestData, photos: [
    { mimeType: 'image/jpeg', base64: jpeg(MAX_PRODUCT_PHOTO_BYTES / 2 + 1) },
    { mimeType: 'image/jpeg', base64: jpeg(MAX_PRODUCT_PHOTO_BYTES / 2 + 1) },
  ] };
  assert.throws(() => parsePrivateProductPhotoRequest(sumTooLarge), /INVALID_PRODUCT_PHOTOS/);
});

test('extraction parser preserves visible label text without accepting authority, scoring or extra context', () => {
  assert.deepEqual(parsePrivateProductPhotoResult(label), { ...label, status: 'extracted', basis: 'photo_label', formulaVerified: false });
  assert.equal(parsePrivateProductPhotoResult({ ...label, ingredientsText: null }).status, 'extracted');
  for (const value of [
    { ...label, formulaVerified: true }, { ...label, score: 99 }, { ...label, productName: 'x'.repeat(241) },
    { ...label, ingredientsText: 'x'.repeat(16001) }, { ...label, brand: 7 }, { ...label, category: 'medicine' },
    { ...label, brand: 'x\0' }, { productName: null, brand: null, size: null, ingredientsText: null, category: 'unknown' },
  ]) assert.equal(parsePrivateProductPhotoResult(value).status, 'unreadable');
});

test('one budgeted server-side model call receives only labels and never search or personal context', async () => {
  let calls = 0, reservations = 0;
  const answer = await extractPrivateProductPhoto(requestData, {
    apiKey: 'fixture-key-not-a-secret', model: 'gemini-3.8-flash',
    reserveRequest: async () => { reservations++; return 'reserved'; },
    fetcher: async (url, init) => {
      calls++; assert.equal(reservations, 1);
      assert.match(String(url), /gemini-3\.8-flash:generateContent$/);
      assert.equal((init!.headers as Record<string, string>)['x-goog-api-key'], 'fixture-key-not-a-secret');
      assert.equal(init!.redirect, 'error');
      const body = JSON.parse(init!.body as string);
      assert.equal('tools' in body, false);
      assert.equal(body.generationConfig.responseMimeType, 'application/json');
      assert.deepEqual(body.contents[0].parts[1].inlineData, { mimeType: 'image/jpeg', data: jpeg() });
      assert.match(body.systemInstruction.parts[0].text, /Do not search the web or use memory/);
      assert.doesNotMatch(init!.body as string, /fixture-key-not-a-secret|e6000000/);
      return new Response(JSON.stringify(provider()));
    },
  });
  assert.equal(answer.status, 'extracted'); assert.equal(calls, 1); assert.equal(reservations, 1);
});

test('missing configuration, malformed images and denied budget cannot invoke provider', async () => {
  const neverFetch: typeof fetch = async () => { throw Error('unexpected provider'); };
  const neverReserve = async (): Promise<'reserved'> => { throw Error('unexpected reservation'); };
  assert.equal((await extractPrivateProductPhoto(requestData, { apiKey: '', reserveRequest: neverReserve, fetcher: neverFetch })).status, 'configuration_required');
  assert.equal((await extractPrivateProductPhoto(requestData, { apiKey: 'key', model: '../model', reserveRequest: neverReserve, fetcher: neverFetch })).status, 'configuration_required');
  assert.equal((await extractPrivateProductPhoto(requestData, { apiKey: 'key', reserveRequest: async () => 'rate_limited', fetcher: neverFetch })).status, 'rate_limited');
  assert.equal((await extractPrivateProductPhoto(requestData, { apiKey: 'key', reserveRequest: neverReserve, fetcher: neverFetch })).status, 'unavailable');
  await assert.rejects(extractPrivateProductPhoto({ ...requestData, photos: [] }, {
    apiKey: 'key', reserveRequest: neverReserve, fetcher: neverFetch,
  }), /INVALID_PRODUCT_PHOTOS/);
});

test('provider quota, refusal, truncated JSON, oversized responses and timeout fail typed without retry', async () => {
  for (const [http, status] of [[429, 'rate_limited'], [400, 'configuration_required'], [403, 'configuration_required'], [404, 'configuration_required'], [503, 'unavailable']] as const) {
    let calls = 0;
    const result = await extractPrivateProductPhoto(requestData, { apiKey: 'key', reserveRequest: async () => 'reserved',
      fetcher: async () => { calls++; return new Response('{}', { status: http }); } });
    assert.equal(result.status, status); assert.equal(calls, 1);
  }
  const truncated = provider(); truncated.candidates[0].finishReason = 'MAX_TOKENS';
  for (const value of [truncated, { candidates: [] }, provider('{"ingredientsText": "made up"}')]) {
    assert.equal((await extractPrivateProductPhoto(requestData, { apiKey: 'key', reserveRequest: async () => 'reserved',
      fetcher: async () => new Response(JSON.stringify(value)) })).status, 'unreadable');
  }
  assert.equal((await extractPrivateProductPhoto(requestData, { apiKey: 'key', reserveRequest: async () => 'reserved',
    fetcher: async () => new Response('x'.repeat(65537)) })).status, 'unavailable');
  let calls = 0;
  const timed = await extractPrivateProductPhoto(requestData, { apiKey: 'key', timeoutMs: 5, reserveRequest: async () => 'reserved',
    fetcher: async (_url, init) => {
      calls++;
      await new Promise((_resolve, reject) => init!.signal!.addEventListener('abort', () => reject(Error('timed out')), { once: true }));
      throw Error('unreachable');
    },
  });
  assert.equal(timed.status, 'unavailable'); assert.equal(calls, 1);
});

const dependencies = () => ({ enabled: true, allowedUserIds: [owner], authenticate: async () => ({ userId: owner }),
  extract: async () => ({ status: 'unreadable' as const }),
  failure: (code: string, _message: string, status: number) => Object.assign(new Error(code), { status }),
  respond: (body: unknown, status = 200) => new Response(JSON.stringify(body), { status }),
  errorResponse: (error: unknown) => new Response(null, { status: (error as { status?: number }).status ?? 500 }),
  corsHeaders: {},
});
const httpRequest = (body: unknown = requestData) => new Request('https://example.com', { method: 'POST', body: JSON.stringify(body) });

test('photo endpoint requires private flag, allowlisted authenticated owner and valid payload', async () => {
  let calls = 0;
  const extract = async () => { calls++; return { status: 'unreadable' as const }; };
  for (const [overrides, http] of [
    [{ enabled: false }, 503], [{ allowedUserIds: [] }, 503],
    [{ authenticate: async () => ({ userId: 'other' }) }, 403],
    [{ authenticate: async () => { throw Object.assign(Error(), { status: 401 }); } }, 401],
  ] as const) assert.equal((await handlePrivateProductPhoto(httpRequest(), { ...dependencies(), extract, ...overrides })).status, http);
  assert.equal((await handlePrivateProductPhoto(httpRequest({ ...requestData, userId: owner }), { ...dependencies(), extract })).status, 400);
  assert.equal(calls, 0);
  assert.equal((await handlePrivateProductPhoto(new Request('https://example.com'), dependencies())).status, 405);
  assert.equal((await handlePrivateProductPhoto(new Request('https://example.com', { method: 'OPTIONS' }), dependencies())).status, 200);
});

test('stream body limits apply despite missing or forged Content-Length before extraction', async () => {
  let cancelled = false, calls = 0;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) { controller.enqueue(new Uint8Array(MAX_PRODUCT_PHOTO_REQUEST_BYTES + 1)); },
    cancel() { cancelled = true; },
  });
  const req = new Request('https://example.com', { method: 'POST', headers: { 'content-length': '1' },
    body: stream, duplex: 'half' } as RequestInit);
  const extract = async () => { calls++; return { status: 'unreadable' as const }; };
  assert.equal((await handlePrivateProductPhoto(req, { ...dependencies(), extract })).status, 413);
  assert.equal(cancelled, true); assert.equal(calls, 0);
  const tooLarge = new Request('https://example.com', { method: 'POST', headers: { 'content-length': String(MAX_PRODUCT_PHOTO_REQUEST_BYTES + 1) }, body: '{}' });
  assert.equal((await handlePrivateProductPhoto(tooLarge, { ...dependencies(), extract })).status, 413);
});

test('endpoint uses authenticated identity, exact contract and typed statuses', async () => {
  for (const [status, http] of [['unreadable', 200], ['configuration_required', 503], ['unavailable', 503], ['rate_limited', 429]] as const) {
    const response = await handlePrivateProductPhoto(httpRequest(), { ...dependencies(), extract: async (photos, identity) => {
      assert.deepEqual(photos, requestData); assert.equal(identity.userId, owner); return { status };
    } });
    assert.equal(response.status, http);
  }
});

test('server composition defaults off, reads keys only on server and uses existing owner budget without storage', () => {
  const source = readFileSync(new URL('../supabase/functions/private-product-photo/index.ts', import.meta.url), 'utf8');
  assert.match(source, /DERIVE_GEMINI_PRODUCT_PHOTO_TEST_ENABLED'\) === 'true'/);
  assert.match(source, /DERIVE_UPC_PRIVATE_TESTER_IDS/);
  assert.match(source, /Deno\.env\.get\('GEMINI_API_KEY'\)/);
  assert.match(source, /reserve_private_grounded_search.*p_user_id: userId/);
  assert.doesNotMatch(source, /\.storage|\.insert\(|\.upsert\(|console\./);
});
