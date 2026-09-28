import assert from 'node:assert/strict';
import test from 'node:test';
import { createCatalogContributionClient } from '../src/presentation/catalog-contribution/client.ts';

const REQUEST_ID = '33333333-3333-4333-8333-333333333333';
const ROW_ID = '44444444-4444-4444-8444-444444444444';
const request = { version: 1 as const, intent: 'help_add_product' as const, requestId: REQUEST_ID,
  product: { brand: ' Example ', name: ' Cream ' } };
const row = { id: ROW_ID, requestId: REQUEST_ID, status: 'submitted', consentVersion: 1,
  consentedAt: '2026-09-28T00:00:00Z', withdrawnAt: null, createdAt: '2026-09-28T00:00:00Z' };

test('submit requires affirmative v1 catalog-review consent and sends canonical owner-free details only', async () => {
  const calls: { name: string; body: object }[] = [];
  const client = createCatalogContributionClient({ functions: { async invoke(name, options) {
    calls.push({ name, body: options.body });
    return { data: { contribution: row }, error: null };
  } } });
  await assert.rejects(client.submit(request, { version: 1, purpose: 'catalog_review', accepted: false }));
  assert.equal(calls.length, 0);
  assert.deepEqual(await client.submit(request, { version: 1, purpose: 'catalog_review', accepted: true }), row);
  assert.deepEqual(calls, [{ name: 'catalog-contribution', body: {
    operation: 'submit', contribution: { ...request, product: { brand: 'Example', name: 'Cream' } },
    consent: { version: 1, purpose: 'catalog_review', accepted: true },
  } }]);
  assert.equal(JSON.stringify(calls).includes('ownerId'), false);
});

test('status and withdrawal use only identifiers and validate owner-bound server projections', async () => {
  const calls: object[] = [];
  const client = createCatalogContributionClient({ functions: { async invoke(_name, options) {
    calls.push(options.body);
    const operation = (options.body as { operation: string }).operation;
    return { data: { contribution: operation === 'withdraw'
      ? { ...row, status: 'withdrawn', withdrawnAt: '2026-09-28T01:00:00Z' } : row }, error: null };
  } } });
  assert.deepEqual(await client.status(REQUEST_ID), row);
  assert.deepEqual(await client.withdraw(ROW_ID), { ...row, status: 'withdrawn', withdrawnAt: '2026-09-28T01:00:00Z' });
  assert.deepEqual(calls, [{ operation: 'status', requestId: REQUEST_ID }, { operation: 'withdraw', id: ROW_ID }]);
});

test('missing status stays unknown and malformed, mismatched, or failed receipts never look accepted', async () => {
  let response: { data: unknown; error: unknown } = { data: { contribution: null }, error: null };
  const client = createCatalogContributionClient({ functions: { async invoke() { return response; } } });
  assert.equal(await client.status(REQUEST_ID), null);
  response = { data: { contribution: { ...row, requestId: ROW_ID } }, error: null };
  await assert.rejects(client.status(REQUEST_ID));
  response = { data: { contribution: { ...row, payload: { private: 'text' } } }, error: null };
  await assert.rejects(client.submit(request, { version: 1, purpose: 'catalog_review', accepted: true }));
  let getterCalls = 0;
  const accessor = Object.defineProperty({ ...row }, 'status', { enumerable: true, get() {
    getterCalls++;
    return 'submitted';
  } });
  response = { data: { contribution: accessor }, error: null };
  await assert.rejects(client.status(REQUEST_ID));
  assert.equal(getterCalls, 0);
  response = { data: { contribution: row }, error: new Error('private server detail') };
  await assert.rejects(client.submit(request, { version: 1, purpose: 'catalog_review', accepted: true }),
    /Product request is unavailable/);
  response = { data: { contribution: row }, error: null };
  await assert.rejects(client.withdraw(ROW_ID), /Product request is unavailable/);
  await assert.rejects(client.withdraw('not-a-uuid'));
});
