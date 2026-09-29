import assert from 'node:assert/strict';
import test from 'node:test';
import { createCatalogSearchController } from '../src/presentation/catalog/searchController.ts';

test('contextual selection preserves the query and exact result list', async () => {
  const item = { id: 'selected' };
  const controller = createCatalogSearchController(async () => [item]);
  controller.setQuery('CeraVe');
  await controller.submit();
  const before = controller.snapshot();
  controller.select(true);
  assert.deepEqual(controller.snapshot(), before);
  controller.select(false);
  assert.equal(controller.snapshot().query, '');
  assert.deepEqual(controller.snapshot().items, []);
  controller.dispose();
});
test('an old lookup cannot replace a newer query or publish after disposal', async () => {
  let resolveOld!: (value: string[]) => void;
  const controller = createCatalogSearchController((query: string) => query === 'old'
    ? new Promise<string[]>(resolve => { resolveOld = resolve; }) : Promise.resolve(['new result']));
  controller.setQuery('old');
  const old = controller.submit();
  controller.setQuery('new');
  await controller.submit();
  resolveOld(['stale']);
  await old;
  assert.deepEqual(controller.snapshot().items, ['new result']);
  assert.equal(controller.snapshot().resultQuery, 'new');
  controller.dispose();
  controller.setQuery('other');
  await controller.submit();
  assert.equal(controller.snapshot().query, 'new');
});
test('submission cancels debounce and errors retain the recoverable query', async () => {
  let calls = 0;
  const controller = createCatalogSearchController(async () => { calls++; throw new Error('offline'); });
  controller.setQuery('product');
  await controller.submit();
  assert.equal(calls, 1);
  assert.equal(controller.snapshot().query, 'product');
  assert.equal(controller.snapshot().error, true);
  assert.equal(controller.snapshot().loading, false);
  controller.dispose();
});
