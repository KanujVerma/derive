import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_PRODUCT_MEASUREMENT_BYTES,
  parseProductMeasurementJson,
} from '../supabase/functions/_shared/product-measurement-ingress.ts';
import { createProductAnalytics } from '../src/presentation/product-analytics/index.ts';

const accepted = [
  ['app_opened', { platform: 'ios' }],
  ['acquisition_touch', { channel: 'club' }],
  ['referral_opened', { channel: 'friend' }],
  ['referral_shared', { channel: 'creator' }],
  ['check_started', { inputMethod: 'barcode' }],
  ['check_completed', { inputMethod: 'search', outcome: 'useful', personalized: true }],
  ['personal_decision_viewed', {}],
  ['my_stuff_viewed', {}],
  ['check_saved', {}],
  ['plus_trigger_reached', { trigger: 'compare' }],
  ['paywall_viewed', { source: 'quota' }],
  ['plus_plan_selected', { plan: 'monthly' }],
  ['plus_purchase_started', { plan: 'annual' }],
  ['managed_viewed', { source: 'check' }],
  ['managed_learn_more', { source: 'account' }],
  ['managed_interest', { source: 'plan' }],
  ['experiment_exposed', { experiment: 'plus_offer_v1', variant: 'control' }],
] as const;

function json(event: unknown, properties: unknown): string {
  return JSON.stringify({ schemaVersion: 1, event, properties });
}

test('server accepts exactly the V1 client event families and copies their safe fields', () => {
  const clientEvents: unknown[] = [];
  const client = createProductAnalytics((event) => { clientEvents.push(event); });
  for (const [event, properties] of accepted) {
    const payload = json(event, properties);
    assert.deepEqual(parseProductMeasurementJson(payload), JSON.parse(payload));
    if (event !== 'check_started' && event !== 'check_completed') {
      assert.equal((client.track as (name: unknown, props: unknown) => boolean)(event, properties), true);
    }
  }
  assert.equal(clientEvents.length, accepted.length - 2);
  assert.deepEqual(parseProductMeasurementJson(json('check_completed', {
    inputMethod: 'photo', outcome: 'failed', personalized: false,
  }))?.properties, { inputMethod: 'photo', outcome: 'failed', personalized: false });
});

test('ingress rejects owner, product, ingredient, referral code, and arbitrary text fields', () => {
  const privateFields = [
    { ...JSON.parse(json('check_completed', { inputMethod: 'photo', outcome: 'useful', personalized: false })), ownerId: 'private' },
    { schemaVersion: 1, event: 'check_started', properties: { inputMethod: 'photo', productName: 'Private serum' } },
    { schemaVersion: 1, event: 'referral_opened', properties: { channel: 'friend', referralCode: 'private' } },
    { schemaVersion: 1, event: 'managed_interest', properties: { source: 'check', note: 'private skin concern' } },
  ];
  for (const payload of privateFields) {
    assert.equal(parseProductMeasurementJson(JSON.stringify(payload)), null);
  }
  assert.equal(parseProductMeasurementJson('{"schemaVersion":1,"event":"check_started","properties":{"inputMethod":"photo","__proto__":"private"}}'), null);
});

test('every currently allowed enum value has matching client and server validation', () => {
  const values: Record<string, Record<string, readonly string[]>> = {
    app_opened: { platform: ['ios', 'android', 'web', 'unknown'] },
    acquisition_touch: { channel: ['direct', 'organic', 'friend', 'creator', 'club', 'paid', 'unknown'] },
    referral_opened: { channel: ['friend', 'creator', 'club', 'unknown'] },
    referral_shared: { channel: ['friend', 'creator', 'club', 'unknown'] },
    check_started: { inputMethod: ['barcode', 'search', 'photo', 'unknown'] },
    check_completed: {
      inputMethod: ['barcode', 'search', 'photo', 'unknown'],
      outcome: ['useful', 'unknown_product', 'insufficient_evidence', 'failed'],
    },
    plus_trigger_reached: { trigger: ['quota', 'compare', 'shelf_analysis', 'history', 'research', 'other'] },
    paywall_viewed: { source: ['quota', 'compare', 'shelf_analysis', 'history', 'research', 'other'] },
    plus_plan_selected: { plan: ['monthly', 'annual'] },
    plus_purchase_started: { plan: ['monthly', 'annual'] },
    managed_viewed: { source: ['check', 'plan', 'account', 'other'] },
    managed_learn_more: { source: ['check', 'plan', 'account', 'other'] },
    managed_interest: { source: ['check', 'plan', 'account', 'other'] },
    experiment_exposed: {
      experiment: ['plus_offer_v1', 'managed_early_access_v1'],
      variant: ['control', 'treatment'],
    },
  };
  const client = createProductAnalytics(() => {});
  for (const [event, fields] of Object.entries(values)) {
    const baseline: Record<string, unknown> = {};
    for (const [field, options] of Object.entries(fields)) baseline[field] = options[0];
    if (event === 'check_completed') baseline.personalized = false;
    for (const [field, options] of Object.entries(fields)) {
      for (const value of options) {
        const properties = { ...baseline, [field]: value };
        assert.ok(parseProductMeasurementJson(json(event, properties)), `${event}.${field}=${value}`);
        if (event !== 'check_started' && event !== 'check_completed') {
          assert.equal((client.track as (name: unknown, props: unknown) => boolean)(event, properties), true);
        }
      }
    }
  }
});

test('ingress rejects malformed, oversized, nested, and invented event values', () => {
  const invalid = [
    '', '{', '[]', 'null', '{}',
    json('unknown', {}),
    json('app_opened', { platform: 'private' }),
    json('app_opened', { platform: { private: 'skin concern' } }),
    json('check_completed', { inputMethod: 'barcode', outcome: 'failed', personalized: true }),
    JSON.stringify({ schemaVersion: 2, event: 'app_opened', properties: { platform: 'ios' } }),
    JSON.stringify({ schemaVersion: 1, event: 'app_opened', properties: { platform: 'ios' }, timestamp: 'client-claim' }),
    ' '.repeat(MAX_PRODUCT_MEASUREMENT_BYTES + 1),
    JSON.stringify({ schemaVersion: 1, event: 'app_opened', properties: { platform: 'ios' }, padding: 'é'.repeat(500) }),
  ];
  for (const payload of invalid) assert.equal(parseProductMeasurementJson(payload), null);
});
