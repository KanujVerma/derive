import assert from 'node:assert/strict';
import test from 'node:test';
import type { FreeSkinProfile } from '../src/contracts/FreePersonalFit.ts';
import type { FreeSavedProduct, FreeCheckEntry, FreeExperienceEntry } from '../src/contracts/FreeContext.ts';
import { mapFreeMyStuff } from '../src/presentation/my-stuff/liveMyStuff.ts';
import { buildMyStuffPresentation, myStuffCopy, formatMyStuffDate } from '../src/presentation/my-stuff/myStuffPresentation.ts';
import { createMyStuffStore } from '../src/stores/myStuffStore.ts';

const profile: FreeSkinProfile = {
  goals: ['dryness', 'dark_spots'], skinBehavior: 'dry_tight', reactivity: 'unsure',
  pregnancyStatus: 'unanswered', sensitivitiesStatus: 'unanswered', knownSensitivities: [],
  treatmentStatus: 'unanswered', currentTreatments: [], updatedAt: '2026-09-24T12:00:00Z',
};
const products: FreeSavedProduct[] = [
  { id: 'p1', productId: 'catalog-1', brand: 'Brand', name: 'Cleanser', source: 'catalog', state: 'using', createdAt: 'a', updatedAt: 'a' },
  { id: 'p2', productId: null, brand: null, name: 'My mystery cream', source: 'user_reported', state: 'considering', createdAt: 'a', updatedAt: 'a' },
  { id: 'p3', productId: 'catalog-3', brand: null, name: 'Serum', source: 'catalog', state: 'stopped', createdAt: 'a', updatedAt: 'a' },
];
const checks: FreeCheckEntry[] = [
  { id: 'c1', productId: null, brand: null, productName: 'Guess from OCR', resolutionState: 'unresolved', checkedAt: '2026-09-24T12:00:00Z' },
  { id: 'c2', productId: 'catalog-1', brand: 'Brand', productName: 'Cleanser', resolutionState: 'catalog_product', checkedAt: '2026-09-23T12:00:00Z' },
];
const experiences: FreeExperienceEntry[] = [
  { id: 'e1', productId: null, brand: null, productName: 'My mystery cream', source: 'user_reported', kind: 'reacted', note: 'Stung', notedAt: '2026-09-24T12:00:00Z' },
  { id: 'e2', productId: 'catalog-1', brand: 'Brand', productName: 'Cleanser', source: 'catalog', kind: 'tolerated', note: null, notedAt: '2026-09-23T12:00:00Z' },
];

test('K3/S3 maps the real profile and free memory without upgrading user reports or unresolved checks', () => {
  const model = mapFreeMyStuff(profile, products, checks, experiences);
  assert.deepEqual(model.profile, { concerns: ['Dryness', 'Dark spots'], skinFeel: 'Dry or tight', summaryUnit: 'skin goal' });
  assert.deepEqual(model.products.map((item) => [item.state, item.source]), [
    ['using', 'catalog'], ['considering', 'user_reported'], ['stopped', 'catalog'],
  ]);
  assert.equal(model.checks[0].productName, 'Product not identified');
  assert.equal(model.checks[1].productName, 'Cleanser');
  assert.equal(model.experiences[0].kind, 'reacted');
  assert.equal(model.experiences[0].source, 'user_reported');
  assert.equal(model.experiences[0].note, 'Stung');
  assert.ok(!JSON.stringify(model).toLowerCase().includes('allergy'));
  assert.ok(!JSON.stringify(model).toLowerCase().includes('formula'));
});

test('K3/S3 describes broader profile goals without calling them skin concerns', () => {
  const model = mapFreeMyStuff({ ...profile, goals: ['simplify', 'maintain'] }, [], [], []);
  assert.equal(buildMyStuffPresentation(model).profile.summary, '2 skin goals');
});

test('K3/S3 keeps legacy My Stuff wording and dates outside live local free context', () => {
  assert.deepEqual(myStuffCopy(false), {
    productHeader: 'Current products',
    experienceHeader: 'Reactions & tolerance',
    experienceFooter: 'Your own observations, separate from a medical diagnosis.',
  });
  assert.equal(formatMyStuffDate('Sep 21', false), 'Sep 21');
  assert.equal(formatMyStuffDate('2026-09-24T12:00:00Z', false), '2026-09-24T12:00:00Z');
  assert.deepEqual(myStuffCopy(true), {
    productHeader: 'Saved products',
    experienceHeader: 'Product experiences',
    experienceFooter: 'Your reports, separate from a medical diagnosis.',
  });
  assert.match(formatMyStuffDate('2026-09-24T12:00:00Z', true), /2026/);
});

test('K3/S3 keeps pagination cursors and appends the next page without losing the first', async () => {
  const seen: string[] = [];
  const store = createMyStuffStore({
    getProfile: async () => null,
    listProducts: async (_limit, cursor) => { seen.push(`products:${cursor ?? 'first'}`); return { items: cursor ? [products[1]] : [products[0]], nextCursor: cursor ? null : 'next-p' }; },
    listChecks: async () => ({ items: checks, nextCursor: null }),
    listExperiences: async () => ({ items: [], nextCursor: null }),
    setProductState: async () => products[0], deleteProduct: async () => undefined, deleteEntry: async () => undefined,
  });
  store.getState().setOwner('owner-a');
  await store.getState().load();
  assert.deepEqual(store.getState().model.products.map((item) => item.id), ['p1']);
  assert.equal(store.getState().cursors.products, 'next-p');
  await store.getState().loadMore('products');
  assert.deepEqual(store.getState().model.products.map((item) => item.id), ['p1', 'p2']);
  assert.equal(store.getState().cursors.products, null);
  assert.deepEqual(seen, ['products:first', 'products:next-p']);
});

test('K3/S3 clears old owner data and rejects a late response after an auth transition', async () => {
  let release!: (value: { items: FreeSavedProduct[]; nextCursor: null }) => void;
  const pending = new Promise<{ items: FreeSavedProduct[]; nextCursor: null }>((resolve) => { release = resolve; });
  const store = createMyStuffStore({
    getProfile: async () => null, listProducts: async () => pending,
    listChecks: async () => ({ items: [], nextCursor: null }),
    listExperiences: async () => ({ items: [], nextCursor: null }),
    setProductState: async () => products[0], deleteProduct: async () => undefined, deleteEntry: async () => undefined,
  });
  store.getState().setOwner('owner-a');
  const loading = store.getState().load();
  store.getState().setOwner('owner-b');
  assert.equal(store.getState().model.products.length, 0);
  release({ items: [products[0]], nextCursor: null });
  await loading;
  assert.equal(store.getState().ownerId, 'owner-b');
  assert.equal(store.getState().model.products.length, 0);
});

test('K3/S3 applies supported writes only after server success and only for the current owner', async () => {
  let deleted = false;
  const store = createMyStuffStore({
    getProfile: async () => null, listProducts: async () => ({ items: [products[0]], nextCursor: null }),
    listChecks: async () => ({ items: checks, nextCursor: null }),
    listExperiences: async () => ({ items: experiences, nextCursor: null }),
    setProductState: async (_id, state) => ({ ...products[0], state }),
    deleteProduct: async () => { deleted = true; }, deleteEntry: async () => undefined,
  });
  store.getState().setOwner('owner-a');
  await store.getState().load();
  await store.getState().changeProductState('p1', 'stopped');
  assert.equal(store.getState().model.products[0].state, 'stopped');
  await store.getState().removeEntry('experiences', 'e1');
  assert.deepEqual(store.getState().model.experiences.map((item) => item.id), ['e2']);
  await store.getState().removeProduct('p1');
  assert.equal(deleted, true);
  assert.equal(store.getState().model.products.length, 0);
});

test('K3/S3 keeps a confirmed state change when a same-owner refresh overlaps it', async () => {
  let release!: (product: FreeSavedProduct) => void;
  const pending = new Promise<FreeSavedProduct>((resolve) => { release = resolve; });
  const store = createMyStuffStore({
    getProfile: async () => null,
    listProducts: async () => ({ items: [products[0]], nextCursor: null }),
    listChecks: async () => ({ items: [], nextCursor: null }),
    listExperiences: async () => ({ items: [], nextCursor: null }),
    setProductState: async () => pending,
    deleteProduct: async () => undefined, deleteEntry: async () => undefined,
  });
  store.getState().setOwner('owner-a');
  await store.getState().load();
  const changing = store.getState().changeProductState('p1', 'stopped');
  await store.getState().load();
  release({ ...products[0], state: 'stopped' });
  await changing;
  assert.equal(store.getState().model.products[0].state, 'stopped');
});
