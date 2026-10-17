/** Disposable local-only HTTP smoke for same-Check ingredient continuation. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const status = JSON.parse(execFileSync('supabase', ['status', '-o', 'json'], {
  encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
}));
assert.equal(status.API_URL, process.env.DERIVE_LOCAL_SUPABASE_API_URL ?? 'http://127.0.0.1:54321',
  'Refuse a hosted target');
const make = (key) => createClient(status.API_URL, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const admin = make(status.SERVICE_ROLE_KEY);
const a = make(status.ANON_KEY);
const b = make(status.ANON_KEY);
let aId, bId, productId, variantId, formulaIds = [], photoPath;
const photoPaths = [];
async function invoke(client, body) {
  return client.functions.invoke('resolve-product-identity', { body });
}
try {
  const first = await a.auth.signInAnonymously();
  const second = await b.auth.signInAnonymously();
  assert.ifError(first.error); assert.ifError(second.error);
  aId = first.data.user.id; bId = second.data.user.id;
  const unauthenticated = await fetch(`${status.API_URL}/functions/v1/resolve-product-identity`, {
    method: 'POST', headers: { apikey: status.ANON_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ operation: 'continue_ingredients' }),
  });
  assert.equal(unauthenticated.status, 401);

  const now = new Date().toISOString();
  const name = `Continuation ${randomUUID()}`;
  const product = await admin.from('products').insert({ brand: 'Fixture', name, category: 'cleanser',
    is_catalog_standard: true, catalog_source_reference: 'internal://continuation',
    catalog_public_source_url: 'https://example.org/product', catalog_observed_at: now,
    catalog_verified_at: now }).select('id').single();
  assert.ifError(product.error); productId = product.data.id;
  const variant = await admin.from('product_variants').insert({ product_id: productId,
    variant_name: 'Original', region_code: 'US', catalog_verification_status: 'verified',
    catalog_source_reference: 'internal://variant', catalog_public_source_url: 'https://example.org/variant',
    catalog_observed_at: now }).select('id').single();
  assert.ifError(variant.error); variantId = variant.data.id;
  for (const [ingredients, fingerprint] of [
    [['Water', 'Glycerin'], 'water|glycerin'],
    [['Water', 'Niacinamide'], 'water|niacinamide'],
  ]) {
    const formula = await admin.from('product_formula_versions').insert({ variant_id: variantId,
      ingredients, normalized_ingredient_fingerprint: fingerprint, region_code: 'US',
      provenance_type: 'manufacturer', source_reference: 'internal://formula',
      catalog_public_source_url: `https://example.org/${fingerprint}`, observed_at: now,
      verification_status: 'verified' }).select('id').single();
    assert.ifError(formula.error); formulaIds.push(formula.data.id);
  }
  for (const formulaId of formulaIds) {
    assert.ifError((await admin.from('product_identifiers').insert({ variant_id: variantId,
      formula_version_id: formulaId, identifier_type: 'gtin_12',
      identifier_value: '012345678905', source_authority: 'manufacturer',
      source_reference: 'internal://package-evidence', verified_at: now })).error);
  }
  const initial = await invoke(a, { requestId: randomUUID(), consumer: 'scan',
    barcode: '012345678905' });
  assert.ifError(initial.error);
  assert.equal(initial.data.state, 'identified_formula_unverified');
  const original = initial.data.truthSnapshot;
  assert.equal(original.formula, null);
  // Legacy device requests and explicitly reported device requests replay identically.
  const rootRow = await admin.from('product_resolution_cases').select('request_id')
    .eq('id', initial.data.caseId).single();
  assert.ifError(rootRow.error);
  const explicitDevice = await invoke(a, { requestId: rootRow.data.request_id, consumer: 'scan',
    barcode: '012345678905', barcodeSource: 'device_barcode' });
  assert.ifError(explicitDevice.error);
  assert.equal(explicitDevice.data.caseId, initial.data.caseId);
  assert.equal((await invoke(a, { requestId: rootRow.data.request_id, consumer: 'scan',
    barcode: '012345678905', barcodeSource: 'member_input' })).error?.context?.status, 409,
    'changing barcode origin on retry must fail');
  for (const body of [
    { barcode: '012345678905', barcodeSource: 'trusted_ocr' },
    { brand: 'Fixture', productName: name, barcodeSource: 'member_input' },
  ]) {
    assert.equal((await invoke(a, { requestId: randomUUID(), consumer: 'scan', ...body })).error?.context?.status, 400);
  }
  const linkedRoot = await invoke(a, { requestId: randomUUID(), consumer: 'scan',
    barcode: '012345678905', barcodeSource: 'member_input' });
  assert.ifError(linkedRoot.error);
  assert.equal(linkedRoot.data.truthSnapshot.evidence.find((item) => item.type === 'barcode').source,
    'member_input');
  const linkedEvidence = await admin.from('product_resolution_evidence').select('source_type')
    .eq('case_id', linkedRoot.data.caseId).eq('evidence_type', 'barcode').single();
  assert.ifError(linkedEvidence.error);
  assert.equal(linkedEvidence.data.source_type, 'member_input');
  const linkedContinuation = await invoke(a, { operation: 'continue_ingredients', requestId: randomUUID(),
    rootCaseId: linkedRoot.data.caseId, parentSnapshotId: linkedRoot.data.truthSnapshot.snapshotId,
    ingredientList: ['Water', 'Glycerin'] });
  assert.ifError(linkedContinuation.error);
  assert.equal(linkedContinuation.data.state, 'identified_formula_unverified',
    'link-derived code plus copied ingredients is not a reported package scan');
  assert.equal(linkedContinuation.data.truthSnapshot.formula, null);

  const input = { operation: 'continue_ingredients', requestId: randomUUID(),
    rootCaseId: initial.data.caseId, parentSnapshotId: original.snapshotId,
    ingredientList: ['Water', 'Glycerin'] };
  const continued = await invoke(a, input);
  assert.ifError(continued.error);
  assert.equal(continued.data.attemptId, initial.data.caseId);
  assert.equal(continued.data.attemptRevision, 2);
  assert.equal(continued.data.state, 'verified_product_formula');
  assert.equal(continued.data.truthSnapshot.formula.formulaVersionId, formulaIds[0]);
  assert.deepEqual(continued.data.truthSnapshot.formula.ingredients, ['Water', 'Glycerin']);
  assert.notEqual(continued.data.caseId, initial.data.caseId);
  assert.deepEqual((await invoke(a, input)).data.truthSnapshot, continued.data.truthSnapshot);
  assert.equal((await invoke(a, { ...input, ingredientList: ['Water', 'Niacinamide'] })).error?.context?.status,
    409, 'changed retry must be rejected');
  assert.equal((await invoke(a, { ...input, requestId: randomUUID() })).error?.context?.status,
    409, 'one root cannot branch');
  assert.equal((await invoke(b, { ...input, requestId: randomUUID() })).error?.context?.status,
    404, 'other account cannot continue owner root');
  const savedChild = await a.functions.invoke('free-context', { body: {
    operation: 'record_check', requestId: randomUUID(), caseId: continued.data.caseId,
  } });
  assert.ifError(savedChild.error);
  assert.equal(savedChild.data.check.resolutionState, 'verified_product_formula');
  const duplicateSave = await a.functions.invoke('free-context', { body: {
    operation: 'record_check', requestId: randomUUID(), caseId: initial.data.caseId,
  } });
  assert.equal(duplicateSave.error?.context?.status, 409,
    'root and child cannot become two saved Checks');
  const history = await admin.from('free_check_history').select('id,attempt_case_id')
    .eq('user_id', aId).eq('attempt_case_id', initial.data.caseId);
  assert.ifError(history.error);
  assert.equal(history.data.length, 1);
  const rootRead = await admin.from('product_truth_snapshots').select('snapshot')
    .eq('id', original.snapshotId).single();
  assert.ifError(rootRead.error); assert.deepEqual(rootRead.data.snapshot, original);
  assert.doesNotMatch(JSON.stringify(continued.data.truthSnapshot), /internal:\/\/|storagePath|Water, Glycerin/);

  const secondRootRequestId = randomUUID();
  const secondRoot = await invoke(a, { requestId: secondRootRequestId, consumer: 'scan',
    barcode: '012345678905' });
  assert.ifError(secondRoot.error);
  const grant = await a.functions.invoke('prepare-free-product-evidence', {
    body: { requestId: randomUUID(), role: 'ingredients', mimeType: 'image/jpeg' },
  });
  assert.ifError(grant.error); photoPath = grant.data.storagePath; photoPaths.push(photoPath);
  assert.ifError((await a.storage.from('customer-product-evidence').upload(photoPath,
    Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 1, 2]), { contentType: 'image/jpeg', upsert: false })).error);
  const scanSessionId = randomUUID();
  const photoRequest = { operation: 'continue_ingredients', requestId: randomUUID(), scanSessionId,
    rootCaseId: secondRoot.data.caseId, parentSnapshotId: secondRoot.data.truthSnapshot.snapshotId,
    evidencePhoto: { role: 'ingredients', storagePath: photoPath } };
  const photoOnly = await invoke(a, photoRequest);
  assert.ifError(photoOnly.error);
  assert.equal(photoOnly.data.kind, 'ingredient_panel_attempt', 'photo bytes are not OCR or a truth child');
  assert.equal(photoOnly.data.outcome, 'unavailable');
  assert.equal(photoOnly.data.attemptsUsed, 1);
  assert.equal(photoOnly.data.truthSnapshot, undefined);
  const collision = await invoke(a, { requestId: photoRequest.requestId, consumer: 'scan', barcode: '012345678905' });
  assert.equal(collision.error?.context?.status, 409, 'ordinary identity cannot take a panel request UUID');
  const caseThenPhoto = await invoke(a, { ...photoRequest, requestId: secondRootRequestId });
  assert.equal(caseThenPhoto.error?.context?.status, 409, 'a case request UUID cannot reserve a panel');
  const photoReplay = await invoke(a, photoRequest);
  assert.ifError(photoReplay.error); assert.deepEqual(photoReplay.data, photoOnly.data);
  const duplicate = await invoke(a, { ...photoRequest, requestId: randomUUID() });
  assert.ifError(duplicate.error); assert.equal(duplicate.data.attemptsUsed, 1);
  const fallback = await invoke(a, { requestId: randomUUID(), consumer: 'scan', scanSessionId,
    barcode: '012345678905', barcodeSource: 'member_input' });
  assert.ifError(fallback.error);
  assert.equal(fallback.data.state, 'identified_formula_unverified');
  assert.notEqual(fallback.data.caseId, secondRoot.data.caseId, 'link/catalog fallback can create another identity in the same Check');
  const retakeGrant = await a.functions.invoke('prepare-free-product-evidence', {
    body: { requestId: randomUUID(), role: 'ingredients', mimeType: 'image/jpeg' },
  });
  assert.ifError(retakeGrant.error); photoPaths.push(retakeGrant.data.storagePath);
  assert.ifError((await a.storage.from('customer-product-evidence').upload(retakeGrant.data.storagePath,
    Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 3, 4]), { contentType: 'image/jpeg', upsert: false })).error);
  const resumedScanSessionId = randomUUID();
  const retake = await invoke(a, { ...photoRequest, requestId: randomUUID(), scanSessionId: resumedScanSessionId,
    rootCaseId: fallback.data.caseId, parentSnapshotId: fallback.data.truthSnapshot.snapshotId,
    evidencePhoto: { role: 'ingredients', storagePath: retakeGrant.data.storagePath } });
  assert.ifError(retake.error); assert.equal(retake.data.attemptsUsed, 2); assert.equal(retake.data.outcome, 'exhausted');
  assert.deepEqual(retake.data.fallbackActions, ['product_link', 'verified_catalog', 'retry_later']);
  assert.doesNotMatch(JSON.stringify(retake.data), /storagePath|[.]jpg|formula|review/);
  const noChild = await admin.from('product_resolution_continuations').select('id').eq('root_case_id', secondRoot.data.caseId);
  assert.ifError(noChild.error); assert.equal(noChild.data.length, 0);
  const exhaustedOriginal = await invoke(a, { ...photoRequest, requestId: randomUUID() });
  assert.ifError(exhaustedOriginal.error); assert.equal(exhaustedOriginal.data.attemptsUsed, 2); assert.equal(exhaustedOriginal.data.outcome, 'exhausted');
  const fallbackChild = await admin.from('product_resolution_continuations').select('id').eq('root_case_id', fallback.data.caseId);
  assert.ifError(fallbackChild.error); assert.equal(fallbackChild.data.length, 0);
  const typedRoot = await invoke(a, { requestId: randomUUID(), consumer: 'scan',
    brand: 'Fixture', productName: name, variantName: 'Original', regionCode: 'US' });
  assert.ifError(typedRoot.error);
  assert.equal(typedRoot.data.state, 'identified_formula_unverified');
  const typedContinuation = await invoke(a, { operation: 'continue_ingredients', requestId: randomUUID(),
    rootCaseId: typedRoot.data.caseId, parentSnapshotId: typedRoot.data.truthSnapshot.snapshotId,
    ingredientList: ['Water', 'Glycerin'] });
  assert.ifError(typedContinuation.error);
  assert.equal(typedContinuation.data.state, 'identified_formula_unverified',
    'typed product identity plus copied ingredients do not authenticate a package formula');
  assert.equal(typedContinuation.data.truthSnapshot.formula, null);
  console.log('Same-Check continuation: auth, exact formula, retry/conflict, owner, immutable root, photo abstention, cross-route request UUIDs and fallback-root continuity passed');
} finally {
  if (photoPaths.length) await admin.storage.from('customer-product-evidence').remove(photoPaths);
  if (aId) await admin.auth.admin.deleteUser(aId);
  if (bId) await admin.auth.admin.deleteUser(bId);
  if (variantId) await admin.from('product_identifiers').delete().eq('variant_id', variantId);
  if (formulaIds.length) await admin.from('product_formula_versions').delete().in('id', formulaIds);
  if (variantId) await admin.from('product_variants').delete().eq('id', variantId);
  if (productId) await admin.from('products').delete().eq('id', productId);
}
