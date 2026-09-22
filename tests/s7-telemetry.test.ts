import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PrivacySafeAnalytics } from '../src/services/analytics.ts';
import { useAuthStore } from '../src/stores/authStore.ts';
import { sanitizeTelemetryEvent } from '../src/services/telemetry/contract.ts';
import { classifyRemoteFailure } from '../src/services/remote/diagnostics.ts';
import type { TelemetrySink } from '../src/services/telemetry/posthogTransport.ts';

test('S7: unknown events and invalid required enums are rejected at runtime', () => {
  assert.equal(sanitizeTelemetryEvent('camera_raw_frame', { photo: 'secret' }), null);
  assert.equal(sanitizeTelemetryEvent('onboarding_stage_completed', { stage: 'medical_note' }), null);
  assert.equal(sanitizeTelemetryEvent('diagnostic_operation', {
    operation: 'ask', outcome: 'failure', errorCode: 'prompt: my rash',
  }), null);
});

test('S7: old callers cannot leak product names, member IDs, notes, URLs, or health fields', () => {
  const examples = [
    sanitizeTelemetryEvent('product_scan_recognized', {
      productName: 'My prescription', barcode: '0123456789', photoUri: 'file:///private/face.jpg',
    }),
    sanitizeTelemetryEvent('shop_product_viewed', {
      productId: 'member-product-uuid', productName: 'Private acne product', source: 'shop_home',
      email: 'sam@example.com',
    }),
    sanitizeTelemetryEvent('checkin_completed', {
      outcome: 'worse', irritationReported: true, adherenceReported: false,
      contextNote: 'my reaction', pregnancyStatus: 'yes',
    }),
    sanitizeTelemetryEvent('onboarding_completed', {
      productCount: 3, hasReactionHistory: true, hasPhotos: true, access_token: 'secret',
    }),
  ];
  assert.ok(examples.every(Boolean));
  const wire = JSON.stringify(examples);
  for (const forbidden of [
    'prescription', 'barcode', 'file://', 'member-product', 'Private acne', 'sam@example.com',
    'irritation', 'my reaction', 'pregnancy', 'access_token', 'hasPhotos',
  ]) assert.equal(wire.includes(forbidden), false, forbidden);
  assert.deepEqual(examples[3]?.properties, { schema_version: 1, product_count_bucket: '2_3' });
});

test('S7: final wire validation strips SDK and accidental extra properties', () => {
  const normalized = sanitizeTelemetryEvent('shop_product_viewed', {
    source: 'shop_home', productId: 'private-id', productName: 'Private name',
  });
  assert.ok(normalized);
  const outgoing = sanitizeTelemetryEvent(normalized.event, {
    ...normalized.properties,
    $current_url: 'https://example.com/private',
    person_email: 'person@example.com',
  });
  assert.deepEqual(outgoing, normalized);
});

test('S7: telemetry is nonblocking and anonymous identity rotates across Auth changes', () => {
  const sent: string[] = [];
  let resets = 0;
  let optedOut = false;
  const sink: TelemetrySink = {
    capture: (event) => { sent.push(event.event); },
    reset: () => { resets += 1; },
    optOut: () => { optedOut = true; },
    optIn: () => { optedOut = false; },
    isOptedOut: () => optedOut,
  };
  const analytics = new PrivacySafeAnalytics(null);
  analytics.setSinkForTesting(sink);
  // A configured transport never sends until a privacy choice opts in.
  analytics.track('onboarding_started', { entryPoint: 'welcome_cta' });
  assert.deepEqual(sent, []);
  useAuthStore.getState().setSession('member-A', 'member-a@example.com');
  analytics.optIn();
  analytics.track('onboarding_started', { entryPoint: 'welcome_cta' });
  useAuthStore.getState().setSignedOut();
  useAuthStore.getState().setSession('member-B', 'member-b@example.com');
  assert.equal(resets, 3);
  analytics.track('onboarding_started', { entryPoint: 'welcome_cta' });
  assert.deepEqual(sent, ['onboarding_started']);
  analytics.optOut();
  analytics.track('onboarding_started', { entryPoint: 'welcome_cta' });
  assert.deepEqual(sent, ['onboarding_started']);
  analytics.optIn();
  analytics.track('onboarding_started', { entryPoint: 'welcome_cta' });
  assert.deepEqual(sent, ['onboarding_started', 'onboarding_started']);
  useAuthStore.getState().setSignedOut();
});

test('S7: sink failures never interrupt a customer action', () => {
  const analytics = new PrivacySafeAnalytics(null);
  analytics.setSinkForTesting({
    capture: () => { throw Error('analytics offline'); },
    reset: () => { throw Error('analytics offline'); },
    optOut: () => {}, optIn: () => {}, isOptedOut: () => false,
  });
  analytics.optIn();
  assert.doesNotThrow(() => analytics.track('onboarding_started', { entryPoint: 'welcome_cta' }));
  assert.doesNotThrow(() => useAuthStore.getState().setSession('member-C', 'c@example.com'));
  useAuthStore.getState().setSignedOut();
});

test('S7: diagnostic classification ignores raw provider message content', () => {
  const raw = {
    name: 'FunctionsHttpError',
    context: { status: 503 },
    message: 'Patient note: irritated skin, sam@example.com, file:///face.jpg',
  };
  assert.equal(classifyRemoteFailure(raw, 'routine_propose'), 'MODEL_UNAVAILABLE');
  assert.equal(classifyRemoteFailure({ code: 'CATALOG_UNAVAILABLE', message: raw.message }, 'catalog_search'), 'CATALOG_UNAVAILABLE');
  assert.equal(classifyRemoteFailure({ code: 'INVALID_RESPONSE', message: raw.message }, 'checkin_submit'), 'INVALID_RESPONSE');
  const wire = sanitizeTelemetryEvent('diagnostic_operation', {
    operation: 'routine_propose', outcome: 'failure', errorCode: classifyRemoteFailure(raw, 'routine_propose'),
    message: raw.message,
  });
  assert.deepEqual(wire?.properties, {
    schema_version: 1, operation: 'routine_propose', outcome: 'failure', error_code: 'MODEL_UNAVAILABLE',
  });
});
