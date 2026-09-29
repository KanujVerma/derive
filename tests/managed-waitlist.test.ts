import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createCanonicalWaitlistStore } from '../src/presentation/managed-waitlist/canonical.ts';
import { MANAGED_WAITLIST_OFFER_VERSION, MANAGED_WAITLIST_PRICE_CENTS, managedOffer } from '../src/presentation/managed-waitlist/offer.ts';
import { resolvePlanPresentation } from '../src/presentation/managed-plan/planComposition.ts';
import {
  acceptOwnerResult,
  createManagedWaitlistController,
  createMemoryWaitlistStore,
} from '../src/presentation/managed-waitlist/store.ts';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('the free Plan offer explains delegation and the current price hypothesis', () => {
  assert.equal(managedOffer.name, 'Managed Skincare');
  assert.equal(managedOffer.tagline, 'Your skincare, handled.');
  assert.equal(managedOffer.price, '$25/month');
  assert.equal(managedOffer.eyebrow, 'Early Access');
  assert.equal(managedOffer.commercialTerm, 'Products purchased separately');
  assert.equal(managedOffer.benefits.length, 3);
  assert.deepEqual(managedOffer.benefits, [
    { title: 'Your routine', body: 'Morning and evening plan' },
    { title: 'Your products', body: 'What to keep, add, pause, or replace' },
    { title: 'Ongoing adjustments', body: 'Check-ins guide changes.\nYou approve meaningful updates.' },
  ]);
  assert.equal(managedOffer.joinLabel, 'Join waitlist');
  assert.equal(managedOffer.joinNote, 'No payment today.\nWe\'ll let you know when early access opens.');
  assert.doesNotMatch(JSON.stringify(managedOffer), /builds and manages your routine|in Derive when/);
  assert.equal(managedOffer.error, 'Couldn\'t join right now. Try again.');
  assert.equal(managedOffer.joinedTitle, 'You\'re on the waitlist');
  const copy = JSON.stringify(managedOffer);
  assert.doesNotMatch(copy, /Founder review|AI-powered|clinical|dermatologist|guaranteed|unlimited|spots left|checkout|subscriber|follows how/i);
  assert.equal(MANAGED_WAITLIST_OFFER_VERSION, 'managed_waitlist_v1');
  assert.equal(MANAGED_WAITLIST_PRICE_CENTS, 2500);
});

test('joining, leaving, and changing owner stay on the waitlist record', async () => {
  let clock = 0;
  const controller = createManagedWaitlistController({
    store: createMemoryWaitlistStore(() => `2026-09-29T00:00:0${clock++}.000Z`),
    track() {},
  });
  assert.equal((await controller.show('owner-a')).status, 'none');
  const joined = await controller.join('owner-a');
  assert.equal(joined.status, 'joined');
  assert.equal(joined.joinedAt, '2026-09-29T00:00:00.000Z');
  assert.equal((await controller.join('owner-a')).joinedAt, joined.joinedAt);
  assert.equal((await controller.show('owner-b')).status, 'none');
  assert.equal((await controller.leave('owner-a')).status, 'withdrawn');
  assert.equal((await controller.show('owner-a')).status, 'withdrawn');
  assert.equal((await controller.join('owner-a')).status, 'joined');
});

test('managed interest is recorded only after a join succeeds', async () => {
  const events: string[] = [];
  const store = createMemoryWaitlistStore();
  const controller = createManagedWaitlistController({
    store: {
      read: (key) => store.read(key),
      join() { throw new Error('offline'); },
      withdraw: (key) => store.withdraw(key),
    },
    track(event) { events.push(event); },
  });
  await controller.show('owner-a');
  await assert.rejects(() => controller.join('owner-a'));
  assert.deepEqual(events, ['managed_viewed']);

  const recovered = createManagedWaitlistController({
    store,
    track(event) {
      events.push(event);
      if (event === 'managed_interest') throw new Error('sink down');
    },
  });
  assert.equal((await recovered.join('owner-a')).status, 'joined');
  assert.deepEqual(events, ['managed_viewed', 'managed_interest']);
});

test('a missing or different session cannot become a canonical join', async () => {
  let calls = 0;
  const canonical = createCanonicalWaitlistStore({
    getSession: async () => null,
    async read() { calls += 1; return { status: 'joined', joinedAt: 't', offerVersion: 'managed_waitlist_v1' }; },
    async join() { calls += 1; return { status: 'joined', joinedAt: 't', offerVersion: 'managed_waitlist_v1' }; },
    async withdraw() { calls += 1; return { status: 'withdrawn', joinedAt: 't', offerVersion: 'managed_waitlist_v1' }; },
  });
  const controller = createManagedWaitlistController({ store: canonical, track() {} });
  assert.equal((await controller.show(null)).status, 'none');
  await assert.rejects(() => controller.join(null));
  await assert.rejects(() => canonical.join('owner-a'));
  assert.equal(calls, 0);

  const mismatched = createCanonicalWaitlistStore({
    getSession: async () => ({ userId: 'owner-b' }),
    async read() { calls += 1; return { status: 'joined', joinedAt: 't', offerVersion: 'managed_waitlist_v1' }; },
    async join() { calls += 1; return { status: 'joined', joinedAt: 't', offerVersion: 'managed_waitlist_v1' }; },
    async withdraw() { calls += 1; return { status: 'none' }; },
  });
  await assert.rejects(() => mismatched.read('owner-a'));
  await assert.rejects(() => mismatched.join('owner-a'));
  assert.equal(calls, 0);
});

test('a late result for the previous owner is discarded', () => {
  const joined = { status: 'joined' as const, joinedAt: 't', offerVersion: 'managed_waitlist_v1' };
  assert.equal(acceptOwnerResult({
    ticket: 1, currentTicket: 2, expectedOwner: 'owner-a', currentOwner: 'owner-b', value: joined,
  }), null);
  assert.deepEqual(acceptOwnerResult({
    ticket: 2, currentTicket: 2, expectedOwner: 'owner-b', currentOwner: 'owner-b', value: joined,
  }), joined);
});

test('free Plan presentation is the waitlist and managed access keeps the routine plan', () => {
  assert.equal(resolvePlanPresentation({ shell: 'scanner_first_preview', managedAccess: false }).kind, 'free');
  assert.equal(resolvePlanPresentation({ shell: 'local_free_integration', managedAccess: false }).kind, 'free');
  assert.equal(resolvePlanPresentation({ shell: 'local_free_integration', managedAccess: true }).kind, 'managed');
  assert.equal(resolvePlanPresentation({ shell: 'legacy', managedAccess: false }).kind, 'managed');
});

test('the free Plan screen owns the waitlist and the managed routine screen does not', () => {
  const plan = read('app/(tabs)/plan.tsx');
  const offer = read('src/components/plan/PreviewPlanShell.tsx');
  const managed = read('src/components/plan/managed/ManagedPlanPresentation.tsx');
  assert.match(plan, /kind === 'free'\) return <PreviewPlanShell/);
  assert.match(plan, /LegacyManagedPlanScreen/);
  assert.match(offer, /managedOffer.sectionLabel/);
  assert.match(offer, /managedOffer.joinLabel/);
  assert.doesNotMatch(read('supabase/migrations/20260929040000_managed_waitlist.sql'), /Your routine/);
  assert.match(offer, /managedOffer.leaveLabel/);
  assert.doesNotMatch(offer, /Enrollment coming soon|Stripe|checkout|createMemoryWaitlistStore/);
  assert.doesNotMatch(managed, /Join waitlist|managed_waitlist/);
});
