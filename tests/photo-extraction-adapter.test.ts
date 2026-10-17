import assert from 'node:assert/strict';
import test from 'node:test';
import {createPhotoExtractionAdapter} from '../supabase/functions/_shared/photo-extraction-adapter.ts';

const binding = {evidenceId: 'photo-test-1', role: 'front_label' as const};
const config = {providerId: 'test-provider', modelId: 'test-model', enabled: true};
const input = () => ({schemaVersion: 1, ...binding, outcome: 'candidate',
  brandText: 'Example', productNameText: 'Daily Lotion', variantText: 'Fragrance Free',
  orderedIngredients: ['Water', 'Invented From Pixels'], labelText: 'Unverified entire label',
  numbers: [{text: '1', unitText: '%', contextText: 'Unverified concentration'}]});

test('disabled by default and does not inspect raw response', () => {
  const raw = new Proxy({}, {ownKeys() {throw Error('must not inspect');}});
  assert.deepEqual(createPhotoExtractionAdapter({providerId: 'p', modelId: 'm'}).decode(raw, binding), {kind: 'disabled'});
});
test('provider-neutral observations always require catalog lookup, never formula authority', () => {
  for (const providerId of ['luna', 'gemini', 'haiku', 'future-provider']) {
    const result = createPhotoExtractionAdapter({...config, providerId}).decode(input(), binding);
    assert.equal(result.kind, 'catalog_lookup_required');
    if (result.kind !== 'catalog_lookup_required') return;
    assert.deepEqual(result.evidence, binding);
    assert.deepEqual(result.observations, {brandText: 'Example', productNameText: 'Daily Lotion', variantText: 'Fragrance Free'});
    assert.equal(result.provider.id, providerId);
    assert.ok(Object.isFrozen(result.observations));
    assert.ok(Object.isFrozen(result.evidence));
    assert.doesNotMatch(JSON.stringify(result), /Invented|concentration|orderedIngredients|labelText|verified/);
  }
});
test('copies binding and observations instead of aliasing mutable provider input', () => {
  const raw = input();
  const result = createPhotoExtractionAdapter(config).decode(raw, binding);
  raw.brandText = 'Changed';
  assert.equal(result.kind === 'catalog_lookup_required' && result.observations.brandText, 'Example');
});
test('binds to expected evidence ID and role', () => {
  for (const raw of [{...input(), evidenceId: 'other'}, {...input(), role: 'ingredients'}]) {
    assert.deepEqual(createPhotoExtractionAdapter(config).decode(raw, binding), {kind: 'unavailable', reason: 'invalid_response'});
  }
});
test('retake reasons are concrete and contain no human review route', () => {
  const actions = {unreadable: 'clearer_photo', conflicting_evidence: 'another_angle', no_product_evidence: 'front_label'};
  for (const [reason, action] of Object.entries(actions)) {
    const result = createPhotoExtractionAdapter(config).decode({schemaVersion: 1, ...binding, outcome: 'abstained', abstentionReason: reason}, binding);
    assert.deepEqual(result, {kind: 'retake', reason, action});
  }
});
test('unsupported input and invalid response are not blamed on photo quality', () => {
  assert.deepEqual(createPhotoExtractionAdapter(config).decode({schemaVersion: 1, ...binding, outcome: 'abstained', abstentionReason: 'unsupported'}, binding), {kind: 'unavailable', reason: 'unsupported_input'});
  for (const raw of [null, {error: 'private provider secret'}, {...input(), confidence: 1}, {...input(), verified: true}, {...input(), ingredientsComplete: true}]) {
    assert.deepEqual(createPhotoExtractionAdapter(config).decode(raw, binding), {kind: 'unavailable', reason: 'invalid_response'});
  }
});
test('ingredients or free text alone cannot produce an identity match', () => {
  for (const observations of [{orderedIngredients: ['Water']}, {labelText: 'A whole label'}, {variantText: 'Sensitive'}, {regionText: 'US'}]) {
    assert.deepEqual(createPhotoExtractionAdapter(config).decode({schemaVersion: 1, ...binding, outcome: 'candidate', ...observations}, binding),
      {kind: 'retake', reason: 'identity_not_visible', action: 'front_label'});
  }
});
test('barcode remains a literal search observation rather than an authoritative identity', () => {
  const result = createPhotoExtractionAdapter(config).decode({schemaVersion: 1, ...binding, outcome: 'candidate', barcodeText: 'unconfirmed-print'}, binding);
  assert.equal(result.kind, 'catalog_lookup_required');
  assert.equal(result.kind === 'catalog_lookup_required' && result.observations.barcodeText, 'unconfirmed-print');
});
test('malicious response getters and thrown private errors are sanitized', () => {
  let read = false;
  const raw = Object.defineProperty(input(), 'brandText', {enumerable: true, get() {read = true; throw Error('secret');}});
  assert.deepEqual(createPhotoExtractionAdapter(config).decode(raw, binding), {kind: 'unavailable', reason: 'invalid_response'});
  assert.equal(read, false);
});
test('configuration is captured and invalid enable values are rejected', () => {
  const options = {...config};
  const adapter = createPhotoExtractionAdapter(options);
  options.enabled = false;
  options.providerId = 'changed';
  assert.equal(adapter.decode(input(), binding).kind, 'catalog_lookup_required');
  assert.equal(adapter.provider.id, 'test-provider');
  assert.throws(() => createPhotoExtractionAdapter({...config, enabled: 'true' as never}));
});
test('configuration accessors cannot change values between validation and capture', () => {
  let invoked = false;
  const options = Object.defineProperty({...config}, 'enabled', {enumerable: true, get() {invoked = true; return true;}});
  assert.throws(() => createPhotoExtractionAdapter(options), /invalid_photo_adapter_configuration/);
  assert.equal(invoked, false);
  assert.throws(() => createPhotoExtractionAdapter(Object.create(config)), /invalid_photo_adapter_configuration/);
});
