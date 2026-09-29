/** Disposable local-only immutable truth / replay / ownership Edge smoke. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
const status = JSON.parse(execFileSync('supabase', ['status', '-o', 'json'], {encoding:'utf8', stdio:['ignore','pipe','pipe']}));
assert.equal(status.API_URL, process.env.DERIVE_LOCAL_SUPABASE_API_URL ?? 'http://127.0.0.1:54321', 'Refuse hosted target');
const make = (key) => createClient(status.API_URL,key,{auth:{persistSession:false,autoRefreshToken:false}});
const admin = make(status.SERVICE_ROLE_KEY), a = make(status.ANON_KEY), b = make(status.ANON_KEY);
let aId, bId, productId, variantId, formulaId, normalizedTwinId, normalizedTwinVariantId;
let uploadedPath;
try {
  const first = await a.auth.signInAnonymously(), second = await b.auth.signInAnonymously();
  assert.ifError(first.error); assert.ifError(second.error); aId=first.data.user.id; bId=second.data.user.id;
  const photoRequest = {requestId:randomUUID(),role:'front_label',mimeType:'image/jpeg'};
  const statusBody = {...photoRequest,operation:'status'};
  const absent = await a.functions.invoke('prepare-free-product-evidence',{body:statusBody});
  assert.equal(absent.error?.context?.status,404,'status must never issue a missing grant');
  const grant = await a.functions.invoke('prepare-free-product-evidence',{body:photoRequest});
  assert.ifError(grant.error); uploadedPath=grant.data.storagePath;
  const beforeUpload = await a.functions.invoke('prepare-free-product-evidence',{body:statusBody});
  assert.ifError(beforeUpload.error); assert.equal(beforeUpload.data.uploaded,false);
  const jpeg = Uint8Array.from([0xff,0xd8,0xff,0xe0,1,2]);
  assert.ifError((await a.storage.from('customer-product-evidence').upload(uploadedPath,jpeg,{contentType:'image/jpeg',upsert:false})).error);
  const confirmed = await a.functions.invoke('prepare-free-product-evidence',{body:statusBody});
  assert.ifError(confirmed.error); assert.equal(confirmed.data.uploaded,true); assert.equal(confirmed.data.objectBytes,jpeg.byteLength);
  assert.equal(confirmed.data.target.storagePath,uploadedPath);
  assert.equal((await b.functions.invoke('prepare-free-product-evidence',{body:statusBody})).error?.context?.status,404);
  assert.equal((await a.functions.invoke('prepare-free-product-evidence',{body:{...statusBody,role:'ingredients'}})).error?.context?.status,409);
  assert.equal((await admin.from('free_product_evidence_grants').select('id').eq('user_id',aId)).data.length,1,'status checks do not consume quota');
  const now = new Date().toISOString();
  const product = await admin.from('products').insert({brand:'P0A Synthetic',name:`Fixture ${randomUUID()}`,
    category:'cleanser',is_catalog_standard:true,catalog_source_reference:'internal://operator-source',
    catalog_public_source_url:'https://example.org/synthetic',catalog_observed_at:now,catalog_verified_at:now}).select('id,name').single();
  assert.ifError(product.error); productId=product.data.id;
  const variant = await admin.from('product_variants').insert({product_id:productId,variant_name:'Synthetic Exact',region_code:'US',
    catalog_verification_status:'verified',catalog_source_reference:'internal://private-variant-proof',
    catalog_public_source_url:'https://example.org/synthetic-variant',catalog_observed_at:now}).select('id').single();
  assert.ifError(variant.error); variantId=variant.data.id;
  const formula = await admin.from('product_formula_versions').insert({variant_id:variantId,ingredients:['Water','Glycerin'],
    normalized_ingredient_fingerprint:'water|glycerin',region_code:'US',provenance_type:'manufacturer',
    source_reference:'internal://private-proof',catalog_public_source_url:'https://example.org/synthetic-formula',
    observed_at:now,verification_status:'verified'}).select('id').single();
  assert.ifError(formula.error); formulaId=formula.data.id;
  assert.ifError((await admin.from('product_identifiers').insert({variant_id:variantId,formula_version_id:formulaId,
    identifier_type:'gtin_12',identifier_value:'012345678905',source_authority:'manufacturer',
    source_reference:'internal://private-package-proof',verified_at:now})).error);
  const exactInput = {requestId:randomUUID(),consumer:'scan',barcode:'012345678905'};
  const simultaneous = await Promise.all(Array.from({length:3},()=>a.functions.invoke('resolve-product-identity',{body:exactInput})));
  simultaneous.forEach(result=>assert.ifError(result.error));
  const exact = simultaneous[0].data.truthSnapshot;
  assert.equal(exact.state,'verified_product_formula'); assert.deepEqual(exact.formula.ingredients,['Water','Glycerin']);
  assert.equal(exact.formula.formulaVersionId,formulaId); assert.equal(exact.formula.appliesToSelectedVariant,true);
  simultaneous.forEach(result=>assert.deepEqual(result.data.truthSnapshot,exact));
  assert.doesNotMatch(JSON.stringify(exact),/internal:\/\/|private-package-proof/);
  const eanEquivalent = await a.functions.invoke('resolve-product-identity',{body:{requestId:randomUUID(),consumer:'scan',barcode:'0012345678905'}});
  assert.ifError(eanEquivalent.error);
  assert.equal(eanEquivalent.data.state,'verified_product_formula','zero-prefixed EAN-13 must resolve the UPC-A assertion');
  assert.equal(eanEquivalent.data.formula.formulaVersionId,formulaId);
  const contradictory = await a.functions.invoke('resolve-product-identity',{body:{requestId:randomUUID(),consumer:'scan',barcode:'012345678905',brand:'Different'}});
  assert.ifError(contradictory.error);
  assert.equal(contradictory.data.state,'ambiguous_candidates','typed conflict must not use barcode-only candidate loading');
  const unknownBarcode = await a.functions.invoke('resolve-product-identity',{body:{requestId:randomUUID(),consumer:'scan',barcode:'000000000000'}});
  assert.ifError(unknownBarcode.error);
  assert.equal(unknownBarcode.data.state,'insufficient_evidence','an absent barcode cannot become a guessed product');
  const input = {requestId:randomUUID(),consumer:'scan',brand:'P0A Synthetic',productName:product.data.name,variantName:'Synthetic Exact',regionCode:'US'};
  const firstResult = await a.functions.invoke('resolve-product-identity',{body:input});
  assert.ifError(firstResult.error);
  const snapshot = firstResult.data.truthSnapshot;
  assert.equal(snapshot.schemaVersion,1); assert.equal(snapshot.state,'identified_formula_unverified');
  assert.equal(snapshot.formula,null); assert.equal(snapshot.product.productId,productId);
  assert.ok(snapshot.unknownFields.includes('formula'));
  assert.doesNotMatch(JSON.stringify(snapshot),/internal:\/\/|storagePath|extractedText/);
  const mixedUnknownBarcode = await a.functions.invoke('resolve-product-identity',{body:{...input,requestId:randomUUID(),barcode:'000000000000'}});
  assert.ifError(mixedUnknownBarcode.error);
  assert.equal(mixedUnknownBarcode.data.state,'identified_formula_unverified','an unknown barcode must not hide an exact typed identity');
  assert.equal(mixedUnknownBarcode.data.product.productId,productId);
  const repeated = await a.functions.invoke('resolve-product-identity',{body:input});
  assert.ifError(repeated.error); assert.deepEqual(repeated.data.truthSnapshot,snapshot);
  const changed = await a.functions.invoke('resolve-product-identity',{body:{...input,brand:'Different'}});
  assert.equal(changed.error?.context?.status,409,'same UUID cannot substitute new evidence');
  const normalizedTwin = await admin.from('products').insert({brand:'P0A-Synthetic',name:product.data.name,
    category:'cleanser',is_catalog_standard:true,catalog_source_reference:'internal://operator-source-twin',
    catalog_public_source_url:'https://example.org/synthetic-twin',catalog_observed_at:now,catalog_verified_at:now}).select('id').single();
  assert.ifError(normalizedTwin.error); normalizedTwinId=normalizedTwin.data.id;
  const normalizedTwinVariant = await admin.from('product_variants').insert({product_id:normalizedTwinId,
    variant_name:'Synthetic Exact',region_code:'US',catalog_verification_status:'verified',
    catalog_source_reference:'internal://operator-variant-twin',catalog_public_source_url:'https://example.org/synthetic-variant-twin',
    catalog_observed_at:now}).select('id').single();
  assert.ifError(normalizedTwinVariant.error); normalizedTwinVariantId=normalizedTwinVariant.data.id;
  const ambiguousTyped = await a.functions.invoke('resolve-product-identity',{body:{...input,requestId:randomUUID()}});
  assert.ifError(ambiguousTyped.error);
  assert.equal(ambiguousTyped.data.state,'ambiguous_candidates','indexed normalized duplicates must remain ambiguous');
  assert.equal(ambiguousTyped.data.candidates.length,2);
  assert.ifError((await admin.from('products').update({name:'Changed catalog label'}).eq('id',productId)).error);
  const afterChange = await a.functions.invoke('resolve-product-identity',{body:input});
  assert.ifError(afterChange.error); assert.deepEqual(afterChange.data.truthSnapshot,snapshot);
  assert.equal(afterChange.data.product.name,product.data.name,'legacy response binds to saved truth too');
  assert.deepEqual((await b.from('product_truth_snapshots').select('id').eq('case_id',snapshot.resolutionCaseId)).data,[]);
  assert.equal((await a.rpc('seal_product_truth_snapshot',{p_user_id:aId,p_case_id:snapshot.resolutionCaseId})).error?.code,'42501');
  const crossReplay = await b.functions.invoke('resolve-product-identity',{body:input});
  assert.ifError(crossReplay.error); assert.notEqual(crossReplay.data.caseId,snapshot.resolutionCaseId);
  assert.equal((await admin.from('product_truth_snapshots').select('id').eq('case_id',snapshot.resolutionCaseId)).data.length,1);
  const deleted = await a.functions.invoke('delete-customer-account',{body:{confirmation:'DELETE_MY_DERIVE_ACCOUNT'}});
  assert.ifError(deleted.error); aId=null;
  assert.deepEqual((await admin.from('product_truth_snapshots').select('id').eq('case_id',snapshot.resolutionCaseId)).data,[]);
  console.log('P0-A truth: read-only lost-ACK status/quota/owner isolation; exact formula/ordered ingredients, concurrent immutable replay, typed identity, changed-input 409, catalog history, RPC isolation and deletion passed');
} finally {
  if(uploadedPath) await admin.storage.from('customer-product-evidence').remove([uploadedPath]);
  if(aId) await admin.auth.admin.deleteUser(aId);
  if(bId) await admin.auth.admin.deleteUser(bId);
  if(variantId) await admin.from('product_identifiers').delete().eq('variant_id',variantId);
  if(formulaId) await admin.from('product_formula_versions').delete().eq('id',formulaId);
  if(normalizedTwinVariantId) await admin.from('product_variants').delete().eq('id',normalizedTwinVariantId);
  if(normalizedTwinId) await admin.from('products').delete().eq('id',normalizedTwinId);
  if(productId) await admin.from('products').delete().eq('id',productId);
}
