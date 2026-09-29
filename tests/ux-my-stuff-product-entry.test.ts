import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ProductEntryController } from '../src/presentation/my-stuff/productEntry.ts';
import type { FreeSavedProduct, FreeContextRequest } from '../src/contracts/FreeContext.ts';

type Request = Extract<FreeContextRequest, { operation: 'save_product' }>;
const firstId = '11111111-1111-4111-8111-111111111111';
const productId = '22222222-2222-4222-8222-222222222222';
const saved = (request: Request): FreeSavedProduct => ({ id: '33333333-3333-4333-8333-333333333333', productId: request.product.productId ?? null, name: request.product.name ?? 'Cream', brand: request.product.brand ?? null, source: request.product.productId ? 'catalog' : 'user_reported', state: request.state, createdAt: '2026-09-29T00:00:00Z', updatedAt: '2026-09-29T00:00:00Z' });
function setup(write: (request: Request) => Promise<FreeSavedProduct> = async request => saved(request)) {
  let owner: string | null = 'A';
  let counter = 0;
  const requests: Request[] = [];
  const controller = new ProductEntryController({ getOwner: () => owner, createRequestId: () => counter++ ? '44444444-4444-4444-8444-444444444444' : firstId, save: async (initiatingOwner, request) => { assert.equal(initiatingOwner, 'A'); requests.push(request); return write(request); } });
  controller.setOwner('A');
  return { controller, requests, changeOwner: (value: string | null) => { owner = value; controller.setOwner(value); } };
}

test('manual product creation requires explicit state and never invents routine use', async () => {
  const { controller, requests } = setup();
  controller.enterManual({ name: 'My cream', brand: '' });
  assert.equal(await controller.save(), null);
  assert.equal(requests.length, 0);
  assert.equal(controller.getState().draft.state, null);
  controller.chooseState('considering');
  const result = await controller.save();
  assert.equal(result?.state, 'considering');
  assert.equal(result?.source, 'user_reported');
  assert.deepEqual(requests[0], { operation: 'save_product', requestId: firstId, product: { name: 'My cream' }, state: 'considering' });
});

test('response loss preserves draft and retries the identical request', async () => {
  let fail = true;
  const { controller, requests } = setup(async request => { if (fail) throw new Error('Response lost'); return saved(request); });
  controller.enterManual({ name: '  My cream  ', brand: '  Maker  ' }); controller.chooseState('stopped');
  assert.equal(await controller.save(), null);
  assert.equal(controller.getState().status, 'error');
  assert.equal(controller.getState().draft.product?.name, '  My cream  ');
  fail = false;
  assert.equal((await controller.save())?.state, 'stopped');
  assert.deepEqual(requests[1], requests[0]);
});

test('changing an uncertain save keeps its retry available until resolved', async () => {
  const { controller, requests } = setup(async () => { throw new Error('Response lost'); });
  controller.enterManual({ name: 'Cream' }); controller.chooseState('using'); await controller.save();
  controller.enterManual({ name: 'Other cream' });
  assert.equal(controller.getState().draft.product?.name, 'Cream');
  assert.equal(controller.getState().status, 'error');
  await controller.save();
  assert.deepEqual(requests[1], requests[0]);
});

test('owner A-B-A rejects late acknowledgment and clears sensitive draft', async () => {
  let release!: (product: FreeSavedProduct) => void;
  const { controller, requests, changeOwner } = setup(() => new Promise(resolve => { release = resolve; }));
  controller.enterManual({ name: 'Private cream' }); controller.chooseState('using');
  const pending = controller.save();
  assert.equal(controller.getState().status, 'saving');
  changeOwner('B'); changeOwner('A'); release(saved(requests[0]));
  assert.equal(await pending, null);
  assert.equal(controller.getState().draft.product, null);
  assert.equal(controller.getState().status, 'editing');
});

test('unavailable preview cannot create a saved product', async () => {
  const { controller, requests, changeOwner } = setup(); changeOwner(null);
  controller.enterManual({ name: 'Cream' }); controller.chooseState('using');
  assert.equal(await controller.save(), null); assert.equal(requests.length, 0);
  assert.equal(controller.getState().status, 'unavailable');
});

test('catalog save retains explicit state and does not supply fabricated formula details', async () => {
  const { controller, requests } = setup();
  controller.selectCatalog({ productId, name: 'Cream', brand: 'Maker' }); controller.chooseState('considering');
  const result = await controller.save();
  assert.equal(result?.productId, productId);
  assert.deepEqual(requests[0].product, { productId });
  assert.equal(requests[0].state, 'considering');
});

test('malformed acknowledgment never publishes a saved state', async () => {
  const { controller } = setup(async request => ({ ...saved(request), state: 'using' }));
  controller.enterManual({ name: 'Cream' }); controller.chooseState('considering');
  assert.equal(await controller.save(), null);
  assert.equal(controller.getState().status, 'error');
});

test('concurrent save presses issue one request and publish only after acknowledgment', async () => {
  let release!: (product: FreeSavedProduct) => void;
  const { controller, requests } = setup(() => new Promise(resolve => { release = resolve; }));
  controller.enterManual({ name: 'Cream' }); controller.chooseState('stopped');
  const pending = controller.save(); assert.equal(await controller.save(), null); assert.equal(requests.length, 1);
  assert.equal(controller.getState().status, 'saving'); release(saved(requests[0]));
  assert.equal((await pending)?.state, 'stopped'); assert.equal(controller.getState().status, 'saved');
});
