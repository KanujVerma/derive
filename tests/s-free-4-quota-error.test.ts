import assert from 'node:assert/strict';
import test from 'node:test';
import { FreeProductEvidenceDailyLimitError, prepareFreeProductEvidence } from '../src/services/remote/freeProductEvidence.ts';

const input = {
  requestId: 'b43e53a7-586a-4478-9bd0-230cba360e88',
  role: 'front_label' as const,
  mimeType: 'image/jpeg' as const,
};

function client(error: unknown, data: unknown = null) {
  return {
    functions: { invoke: async () => ({ data, error }) },
    storage: { from: () => ({ upload: async () => ({ error: null }) }) },
  };
}

test('only the server DAILY_LIMIT 429 becomes a typed quota error', async () => {
  const response = new Response(JSON.stringify({ code: 'DAILY_LIMIT', error: 'Try tomorrow' }), { status: 429 });
  await assert.rejects(() => prepareFreeProductEvidence(input, client({ context: response })),
    (error: unknown) => error instanceof FreeProductEvidenceDailyLimitError && error.code === 'DAILY_LIMIT');
  assert.deepEqual(await response.json(), { code: 'DAILY_LIMIT', error: 'Try tomorrow' });
});

test('other 429s and malformed HTTP errors stay generic instead of claiming a daily limit', async () => {
  for (const context of [
    new Response(JSON.stringify({ code: 'RATE_LIMITED' }), { status: 429 }),
    new Response('not json', { status: 429 }),
    new Response(JSON.stringify({ code: 'DAILY_LIMIT' }), { status: 503 }),
    { status: 429 },
  ]) {
    await assert.rejects(() => prepareFreeProductEvidence(input, client({ context })),
      (error: unknown) => error instanceof Error && !(error instanceof FreeProductEvidenceDailyLimitError)
        && error.message === 'Photo upload is unavailable');
  }
});

test('successful grant response remains unchanged', async () => {
  const target = { bucket: 'customer-product-evidence', storagePath: 'owner/free_scan/front_label/file.jpg',
    role: input.role, mimeType: input.mimeType, maxBytes: 10 * 1024 * 1024 };
  assert.deepEqual(await prepareFreeProductEvidence(input, client(null, target)), target);
});
