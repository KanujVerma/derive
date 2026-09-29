import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { managedOffer } from '../src/presentation/managed-waitlist/offer.ts';
import {
  createManagedWaitlistController,
  createMemoryWaitlistStore,
} from '../src/presentation/managed-waitlist/store.ts';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('the free Plan offer explains delegation and the current price hypothesis', () => {
  assert.equal(managedOffer.name, 'Managed Skincare');
  assert.equal(managedOffer.tagline, 'Your skincare, handled.');
  assert.equal(managedOffer.price, '$25/month');
  assert.equal(managedOffer.commercialTerm, 'Products purchased separately');
  assert.deepEqual(managedOffer.benefits, [
    'One clear morning and evening routine',
    'Know what to keep, add, pause, or replace',
    'Check-ins that help your routine adapt over time',
    'You approve meaningful changes before they go live',
  ]);
  assert.equal(managedOffer.joinLabel, 'Join waitlist');
  assert.match(managedOffer.joinNote, /No payment today/);
  assert.equal(managedOffer.joinedTitle, 'You\'re on the waitlist');
  const copy = JSON.stringify(managedOffer);
  assert.doesNotMatch(copy, /Founder review|AI-powered|clinical|dermatologist|guaranteed|unlimited|spots left|checkout|subscriber/i);
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

test('the free Plan screen owns the waitlist and the managed routine screen does not', () => {
  const plan = read('app/(tabs)/plan.tsx');
  const offer = read('src/components/plan/PreviewPlanShell.tsx');
  const managed = read('src/components/plan/managed/ManagedPlanPresentation.tsx');
  assert.match(plan, /kind === 'free'\) return <PreviewPlanShell/);
  assert.match(plan, /LegacyManagedPlanScreen/);
  assert.match(offer, /managedOffer.joinLabel/);
  assert.match(offer, /managedOffer.leaveLabel/);
  assert.doesNotMatch(offer, /Enrollment coming soon|Stripe|checkout/);
  assert.doesNotMatch(managed, /Join waitlist|managed_waitlist/);
});
