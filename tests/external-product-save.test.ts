import assert from 'node:assert/strict';
import test from 'node:test';
import { createExternalProductSaver, type ExternalProductSaveState } from '../src/presentation/external-products/saveProduct.ts';
import { ingredientQueryKey } from '../src/presentation/external-products/ingredientSearch.ts';
import type { FreeSavedProduct, FreeContextRequest } from '../src/contracts/FreeContext.ts';
const query = { barcode: '0012044038840', name: 'Old Spice High Endurance Fresh Scent Deodorant for Men 3.0 oz', brand: 'Old Spice', size: 'One 3oz. Stick' };
const saved: FreeSavedProduct = { id: 'saved-product', productId: null, name: query.name, brand: query.brand,
  source: 'user_reported', state: 'considering', createdAt: '2026-09-30T12:00:00Z', updatedAt: '2026-09-30T12:00:00Z' };
const deferred = <T>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };
function setup() {
  const states: ExternalProductSaveState[] = [], requests: Extract<FreeContextRequest, { operation: 'save_product' }>[] = [];
  let owner: string | null = 'owner', key = ingredientQueryKey(query);
  const input = { ownerId: 'owner', query, getOwner: () => owner, getQueryKey: () => key, createId: () => 'stable-request',
    list: async (_cursor?: string) => ({ items: [] as FreeSavedProduct[], nextCursor: null as string | null }),
    save: async (request: Extract<FreeContextRequest, { operation: 'save_product' }>) => { requests.push(request); return saved; },
    publish: (state: ExternalProductSaveState) => { states.push(state); } };
  return { input, states, requests, owner: (value: string | null) => { owner = value; }, key: (value: string) => { key = value; } };
}
test('save requires explicit confirmation and persists only a manual product name/brand, not provider formula or barcode', async () => {
  const f = setup(), controller = createExternalProductSaver(f.input);
  await controller.save(false); assert.equal(f.states.length, 0);
  await controller.save(true); await controller.save(true);
  assert.deepEqual(f.requests, [{ operation: 'save_product', requestId: 'stable-request',
    product: { name: query.name, brand: 'Old Spice' }, state: 'considering' }]);
  assert.equal(f.states.at(-1)?.kind, 'saved');
});
test('a reopened scan finds the existing product across pages and preserves its state', async () => {
  const f = setup(), cursors: Array<string | undefined> = [];
  f.input.list = async cursor => { cursors.push(cursor); return cursor ? { items: [{ ...saved, state: 'stopped' }], nextCursor: null }
    : { items: [{ ...saved, name: 'Other product' }], nextCursor: 'page-2' }; };
  await createExternalProductSaver(f.input).save(true);
  assert.deepEqual(cursors, [undefined, 'page-2']); assert.equal(f.requests.length, 0);
  const result = f.states.at(-1); assert.equal(result?.kind, 'saved');
  if (result?.kind === 'saved') assert.equal(result.product.state, 'stopped');
});
test('response-loss retry keeps the request ID and does not duplicate writes', async () => {
  const f = setup(); let failed = true;
  f.input.save = async request => { f.requests.push(request); if (failed) { failed = false; throw new Error('NETWORK'); } return saved; };
  const controller = createExternalProductSaver(f.input);
  await controller.save(true); assert.equal(f.states.at(-1)?.kind, 'error');
  await controller.save(true); assert.deepEqual(f.requests[0], f.requests[1]); assert.equal(f.states.at(-1)?.kind, 'saved');
});
test('owner changes, product changes and disposal block stale publication and further writes', async () => {
  for (const change of ['owner', 'query', 'dispose']) {
    const f = setup(), waiting = deferred<{ items: FreeSavedProduct[]; nextCursor: null }>();
    f.input.list = () => waiting.promise;
    const controller = createExternalProductSaver(f.input), pending = controller.save(true);
    if (change === 'owner') f.owner('other'); else if (change === 'query') f.key('other'); else controller.dispose();
    waiting.resolve({ items: [], nextCursor: null }); await pending;
    assert.deepEqual(f.states.map(state => state.kind), ['saving']); assert.equal(f.requests.length, 0);
  }
});
test('repeat taps while saving make one request', async () => {
  const f = setup(), waiting = deferred<FreeSavedProduct>();
  f.input.save = request => { f.requests.push(request); return waiting.promise; };
  const controller = createExternalProductSaver(f.input), first = controller.save(true);
  await Promise.resolve(); await controller.save(true); waiting.resolve(saved); await first;
  assert.equal(f.requests.length, 1);
});
test('invalid readback and incomplete/repeated pagination never claim success', async () => {
  const f = setup(); f.input.save = async () => ({ ...saved, source: 'catalog', productId: 'catalog' });
  await createExternalProductSaver(f.input).save(true); assert.equal(f.states.at(-1)?.kind, 'error');
  const g = setup(); g.input.list = async () => ({ items: [], nextCursor: 'loop' });
  await createExternalProductSaver(g.input).save(true); assert.equal(g.states.at(-1)?.kind, 'error'); assert.equal(g.requests.length, 0);
});
