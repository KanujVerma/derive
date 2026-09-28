import assert from 'node:assert/strict';
import test from 'node:test';
import { createProductAnalytics } from '../src/presentation/product-analytics/index.ts';

test('a safe event is emitted with only its declared coarse properties', () => {
  const events: unknown[] = [];
  const analytics = createProductAnalytics((event) => { events.push(event); });

  assert.equal(analytics.track('plus_trigger_reached', { trigger: 'compare' }), true);
  assert.deepEqual(events, [{ schemaVersion: 1, event: 'plus_trigger_reached', properties: { trigger: 'compare' } }]);
});

test('personal decision exposure carries no product, owner, or context payload', () => {
  const events: unknown[] = [];
  const analytics = createProductAnalytics((event) => { events.push(event); });
  const unsafe = analytics.track as (event: unknown, properties: unknown) => boolean;
  assert.equal(unsafe('personal_decision_viewed', { productName: 'Private cream' }), false);
  assert.equal(unsafe('personal_decision_viewed', {}), true);
  assert.deepEqual(events, [{ schemaVersion: 1, event: 'personal_decision_viewed', properties: {} }]);
});

test('runtime validation rejects extra, identifying, free-text, and invalid values', () => {
  const events: unknown[] = [];
  const analytics = createProductAnalytics((event) => { events.push(event); });
  const unsafe = analytics.track as (event: unknown, properties: unknown) => boolean;

  assert.equal(unsafe('plus_trigger_reached', { trigger: 'compare', productName: 'Private cream' }), false);
  assert.equal(unsafe('plus_trigger_reached', { trigger: 'Private cream' }), false);
  assert.equal(unsafe('referral_opened', { channel: 'friend', referralCode: 'private-code' }), false);
  assert.equal(unsafe('unknown_event', {}), false);
  assert.equal(unsafe('app_opened', { platform: true }), false);
  assert.deepEqual(events, []);
});

test('an accessor cannot change an allowed value into private text during emission', () => {
  const events: unknown[] = [];
  const analytics = createProductAnalytics((event) => { events.push(event); });
  const unsafe = analytics.track as (event: unknown, properties: unknown) => boolean;
  let reads = 0;
  const properties = Object.defineProperty({}, 'channel', {
    enumerable: true,
    get() { reads += 1; return reads === 1 ? 'direct' : 'private skin note'; },
  });

  assert.equal(unsafe('acquisition_touch', properties), false);
  assert.equal(reads, 0);
  assert.deepEqual(events, []);
});

test('symbol and hidden fields and throwing proxy traps fail closed', () => {
  const events: unknown[] = [];
  const unsafe = createProductAnalytics((event) => { events.push(event); }).track as
    (event: unknown, properties: unknown) => boolean;
  const withSymbol = { channel: 'direct', [Symbol('private')]: 'skin note' };
  const withHidden = Object.defineProperty({ channel: 'direct' }, 'privateNote', { value: 'skin note' });
  const hostile = new Proxy({ channel: 'direct' }, {
    getOwnPropertyDescriptor() { throw new Error('hostile trap'); },
  });

  assert.equal(unsafe('acquisition_touch', withSymbol), false);
  assert.equal(unsafe('acquisition_touch', withHidden), false);
  assert.equal(unsafe('acquisition_touch', hostile), false);
  assert.deepEqual(events, []);
});

test('one visible Check session counts once despite retries or provider calls', () => {
  const events: unknown[] = [];
  const analytics = createProductAnalytics((event) => { events.push(event); });
  const check = analytics.beginCheck('photo');

  assert.equal(check.complete('insufficient_evidence', false), true);
  assert.equal(check.complete('useful', true), false);
  assert.deepEqual(events, [
    { schemaVersion: 1, event: 'check_started', properties: { inputMethod: 'photo' } },
    { schemaVersion: 1, event: 'check_completed', properties: { inputMethod: 'photo', outcome: 'insufficient_evidence', personalized: false } },
  ]);
});

test('generic event calls cannot bypass the one-Check lifecycle', () => {
  const events: unknown[] = [];
  const analytics = createProductAnalytics((event) => { events.push(event); });
  const unsafe = analytics.track as (event: unknown, properties: unknown) => boolean;
  assert.equal(unsafe('check_started', { inputMethod: 'barcode' }), false);
  assert.equal(unsafe('check_completed', { inputMethod: 'barcode', outcome: 'useful', personalized: false }), false);
  assert.deepEqual(events, []);
});

test('no sink means no telemetry transport and sink failure cannot block Check', () => {
  const analytics = createProductAnalytics();
  assert.equal(analytics.track('app_opened', { platform: 'ios' }), false);
  const failing = createProductAnalytics(() => { throw new Error('offline'); });
  const check = failing.beginCheck('barcode');
  assert.equal(check.complete('useful', true), false);
  assert.equal(check.complete('useful', true), false);
});

test('a non-useful outcome cannot claim personalization and invalid input cannot finish a Check', () => {
  const events: unknown[] = [];
  const analytics = createProductAnalytics((event) => { events.push(event); });
  const nonUseful = analytics.beginCheck('search');
  assert.equal(nonUseful.complete('unknown_product', true), false);
  const invalidCheck = (analytics.beginCheck as (input: unknown) => ReturnType<typeof analytics.beginCheck>)('a private product name');
  assert.equal(invalidCheck.complete('useful', false), false);
  assert.deepEqual(events, [{ schemaVersion: 1, event: 'check_started', properties: { inputMethod: 'search' } }]);
});
