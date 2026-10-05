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
  controller.releaseSelection();
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

test('cancel fences a pending lookup and permits an explicit retry with the retained query', async () => {
  let resolve!: (items: string[]) => void;
  let calls = 0;
  const controller = createCatalogSearchController(() => { calls++; return new Promise<string[]>(done => { resolve = done; }); });
  controller.setQuery('cleanser');
  const pending = controller.submit();
  controller.cancel();
  assert.equal(controller.snapshot().query, 'cleanser');
  assert.equal(controller.snapshot().loading, false);
  resolve(['late']);
  await pending;
  assert.deepEqual(controller.snapshot().items, []);
  const retry = controller.submit();
  resolve(['current']);
  await retry;
  assert.equal(calls, 2);
  assert.deepEqual(controller.snapshot().items, ['current']);
  controller.dispose();
});

test('selection is synchronous and locked until the originating result is dismissed', async () => {
  const controller = createCatalogSearchController(async () => ['one']);
  controller.setQuery('cleanser');
  await controller.submit();
  assert.equal(controller.select(true), true);
  assert.equal(controller.select(true), false);
  controller.releaseSelection();
  assert.equal(controller.select(true), true);
  controller.dispose();
});

test('a host-owned controller retains exact results across view subscriptions and resets at an owner boundary', async () => {
  const controller = createCatalogSearchController(async () => ['one', 'two']);
  let events = 0;
  const stop = controller.subscribe(() => { events++; });
  controller.setQuery('cleanser');
  await controller.submit();
  const retained = controller.getState();
  stop();
  const stopNext = controller.subscribe(() => { events++; });
  assert.equal(controller.getState(), retained);
  assert.deepEqual(controller.getState().items, ['one', 'two']);
  controller.reset();
  assert.equal(controller.getState().query, '');
  assert.deepEqual(controller.getState().items, []);
  assert.ok(events >= 3);
  stopNext(); controller.dispose();
});

test('duplicate submit while the same query is in flight makes one lookup', async () => {
  let resolve!: (items: string[]) => void;
  let calls = 0;
  const controller = createCatalogSearchController(() => { calls++; return new Promise<string[]>(done => { resolve = done; }); });
  controller.setQuery('cleanser');
  const first = controller.submit();
  const second = controller.submit();
  assert.equal(calls, 1);
  resolve(['one']);
  await Promise.all([first, second]);
  controller.dispose();
});

test('a late failed old search cannot replace a newer successful product', async () => {
  let fail!: (error: Error) => void;
  const controller = createCatalogSearchController(query => query === 'old'
    ? new Promise<string[]>((_resolve, reject) => { fail = reject; }) : Promise.resolve(['new']));
  controller.setQuery('old'); const old = controller.submit();
  controller.setQuery('new'); await controller.submit();
  fail(new Error('old lookup failed')); await old;
  assert.equal(controller.snapshot().error, false);
  assert.deepEqual(controller.snapshot().items, ['new']);
  controller.dispose();
});


test('automatic search debounces, aborts a superseded lookup and reuses only a current owner cache', async () => {
  let calls=0,oldSignal:AbortSignal|undefined,now=0;
  const c=createCatalogSearchController(async (query,signal)=>{calls++;if(query==='old'){oldSignal=signal;return new Promise<string[]>(()=>{});}return [query];},()=>{}, {debounceMs:1,cacheTtlMs:30000,now:()=>now});
  c.setQuery('old');await new Promise(done=>setTimeout(done,10));assert.equal(calls,1);
  c.setQuery('Hydro Boost');await new Promise(done=>setTimeout(done,10));assert.equal(oldSignal?.aborted,true);assert.deepEqual(c.snapshot().items,['Hydro Boost']);
  c.setQuery('Hydro Boost');await c.submit();assert.equal(calls,2);
  now=30001;c.setQuery('Hydro Boost');await c.submit();assert.equal(calls,3);
  c.reset();c.setQuery('Hydro Boost');await c.submit();assert.equal(calls,4);c.dispose();
});
test('automatic name search never dispatches a partially typed barcode', async()=>{
 let calls=0;const c=createCatalogSearchController(async()=>{calls++;return [];},()=>{}, {debounceMs:1,automaticQuery:q=>!/^\d+$/.test(q)});
 c.setQuery('87863900');await new Promise(done=>setTimeout(done,10));assert.equal(calls,0);await c.submit();assert.equal(calls,1);c.dispose();
});
