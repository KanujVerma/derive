import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { createReviewedFixtureAuthority, evaluatePrivateEvidence, hashPrivateObservation, producePrivateReviewedReceipt, PrivateEvidenceContextSchema, PrivateReviewedReceiptSchema } from '../supabase/functions/_shared/part-one-private-evidence.ts';
import type { PrivateEvidenceContext, PrivateReviewedReceipt, PrivateReviewAuthorityPolicy, PrivateObservationRecord } from '../supabase/functions/_shared/part-one-private-evidence.ts';
import type { Variant } from '../src/contracts/PartOne.ts';
import { canClaimFullListAbsence, factBundleClaimLimits, selectDeclaration } from '../src/domain/part-one/evidence.ts';
import { commitPrivateCapture } from '../supabase/functions/_shared/part-one-private-commit.ts';

const id = (n: number) => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const now = '2026-10-02T12:00:00.000Z', future = '2026-10-03T12:00:00.000Z';
const hash = async (text: string) => createHash('sha256').update(text).digest('hex');
const variant: Variant = { brand: 'Example', line: 'Daily', form: 'toner', scent: 'unscented', shade: 'clear', spf: 'not applicable', strength: 'standard', size: '100', unit: 'ml', packCount: 1, packagingLevel: 'each' };
const authorityPolicy: PrivateReviewAuthorityPolicy = { policyId: id(40), version: 'synthetic-review-1', enabled: true, mode: 'synthetic_local_only', permissionEvidence: 'Synthetic local fixture: independent package review', reviewedAt: now, expiresAt: future, revokedAt: null };
const rawIngredients = 'Ingredients: 1,2-Hexanediol, Aqua (Water, Eau), PPG-6-Decyltetradeceth-30, PEG-240/HDI Copolymer';
function context(ownerId = id(1)): PrivateEvidenceContext {
  const binding = { ownerId, captureSessionId: id(2), packageObservationId: id(3), generation: 4, deletionEpoch: 2 };
  const observation = (observationId: string, rawText: string, role: 'ingredients' | 'package'): PrivateObservationRecord => ({ ...binding, observationId, revision: 1, kind: 'ocr', role, coordinateSpace:'sanitized_derivative', derivedFromObservationIds:[], rawText, assetEvidenceIds: [id(5)], originalObservationId: observationId, supersedesId: null, uncertaintyReasons: [], ocr: { evidenceId: id(6), captureSessionId: id(2), generation: 4, recognizer: 'fixture-vision', recognizerVersion: '1', languageConfig: ['en'], correctionEnabled: false, sourceWidth: 1200, sourceHeight: 1600, orientationTransform: [1,0,0,0,1,0,0,0,1], lines: rawText.split('\n').map((text, i) => ({ text, alternatives: [], region: [0.1, i / 20, 0.8, 0.04], confidence: 0.99 })), status: 'recognized' }, edit: null, observedAt: now, expiresAt: future, status: 'active' });
  const item = { snapshotId: id(8), itemId: id(9), revision: 1, name: 'Example Daily toner', variant: structuredClone(variant), fieldEvidence: { name: [id(10)] }, barcodeAssertions: [{ raw: '3606000537538', symbology: 'ean13', namespace: 'gtin' as const, canonical: '03606000537538', evidenceId: id(10) }], requestedMarket: 'US', sourceMarkets: ['US'], packageMarket: null, declarationIds: [id(11)], conflictIds: [], scope: 'public' as const, supersedesId: null };
  return { ownerId, capture: { schemaVersion: 1, captureSessionId: id(2), packageObservationId: id(3), scanId: id(12), generation: 4, captureRevision: 1, deletionEpoch: 2, itemId: id(9), candidateId: null }, result: { schemaVersion: 1, requestId: id(13), scanId: id(12), generation: 4, resultRevision: 1, identity: 'exact', itemId: id(9), candidateIds: [], snapshotId: id(8), declarationId: id(11), declarationState: 'conflict', scope: 'public', packageConfirmation: 'user_bound', work: 'complete', jobId: null, subscriptionId: null, nextCheckAfter: null, display: { resultRevision: 1, selectedIdentity: null, candidates: [], sections: [], sources: [], limitations: [] }, reasonCodes: ['public_ingredient_source_wrong'], conflictIds: [id(99)], evidenceIds: [id(10)], allowedActions: ['add_photo'], freshness: { observedAt: now, expiresAt: future, state: 'fresh' } }, item, assets: [{ ...binding, evidenceId: id(5), clientEvidenceId: id(6), attestationId: id(7), storageObjectId: id(14), contentHash: 'sha256:synthetic-sanitized-image', objectVersion: 'synthetic-storage-version-1', width: 1200, height: 1600, metadataStripped: true, sanitizerVersion: 'synthetic-sanitizer-1', verificationEvidence: 'Synthetic locally decoded JPEG', observedAt: now, expiresAt: future, status: 'active' }], observations: [observation(id(15), rawIngredients, 'ingredients'), observation(id(16), [...Object.values(variant).map(String), 'US', 'Cosmetic', '3606000537538'].join('\n'), 'package')], priorObservations: [], supersedesDeclarationId: null, reviewRequest: { reviewId: id(17) }, policy: { policyId: id(18), provider: 'private_capture', version: 'synthetic-private-1', permissionEvidence: 'Synthetic local fixture: private retention/display only', reviewedAt: now, expiresAt: future, revokedAt: null, operations: { lookup: false, process: true, retain: true, privateDisplay: true, sharedDisplay: false, ocr: true, cropThumbnail: false, rehost: false, hotlink: false, export: false }, retainedFields: ['identity', 'ingredients', 'private_photo'], attribution: null, purgeObligations: ['delete all derivatives'] }, now, ids: { snapshotId: id(19), declarationId: id(20) } };
}
async function reviewed(input: PrivateEvidenceContext): Promise<PrivateReviewedReceipt> {
  const ingredient = input.observations.find(o => o.role === 'ingredients')!, packageRecord = input.observations.find(o => o.role === 'package')!;
  const ref = (o: PrivateObservationRecord, text: string) => ({ observationId: o.observationId, revision: o.revision, start: o.rawText.indexOf(text), end: o.rawText.indexOf(text) + text.length, assetEvidenceId: input.assets[0].evidenceId, text, region: [0.1, 0.1, 0.8, 0.1] });
  const start = ingredient.rawText.startsWith('Ingredients: ') ? 13 : 0;
  return { schemaVersion: 1, ownerId: input.ownerId, captureSessionId: input.capture.captureSessionId, packageObservationId: input.capture.packageObservationId, generation: input.capture.generation, deletionEpoch: input.capture.deletionEpoch, reviewId: input.reviewRequest!.reviewId, authorityPolicyId: authorityPolicy.policyId, authorityPolicyVersion: authorityPolicy.version, reviewedAt: now, expiresAt: future, permissionEvidence: 'Synthetic independent adjudicator inspected complete fixture panel', selectedItemId: input.item!.itemId, selectedSnapshotId: input.item!.snapshotId, assetBindings: input.assets.map(a => ({ evidenceId: a.evidenceId, attestationId: a.attestationId, storageObjectId: a.storageObjectId, contentHash: a.contentHash, objectVersion: a.objectVersion })), observationBindings: await Promise.all(input.observations.map(async o => ({ observationId: o.observationId, revision: o.revision, ...await hashPrivateObservation(o, hash) }))), packageIdentity: { code: { raw: '3606000537538', symbology: 'ean13', namespace: 'gtin', retailerId: null }, evidenceRefs: [ref(packageRecord, '3606000537538')] }, category: 'cosmetic', categoryRefs: [ref(packageRecord, 'Cosmetic')], variant: structuredClone(variant), variantRefs: Object.fromEntries(Object.entries(variant).map(([key, value]) => [key, [ref(packageRecord, String(value))]])), packageMarket: 'US', marketRefs: [ref(packageRecord, 'US')], sections: [{ kind: 'ingredients', observationId: ingredient.observationId, revision: ingredient.revision, start, end: ingredient.rawText.length, startCovered: true, endCovered: true, lineCoverageComplete: true, lineRefs: [ref(ingredient, ingredient.rawText.slice(start))], uncertaintyReasons: [] }], conflictIds: [], uncertaintyReasons: [] };
}
const evaluate = async (input: PrivateEvidenceContext, receipt?: PrivateReviewedReceipt, policy = authorityPolicy) => evaluatePrivateEvidence(input, { hash, authority: createReviewedFixtureAuthority(policy, [receipt ?? await reviewed(input)]) });

test('A07 actual private evaluator accepts independently reviewed correct label despite wrong public ingredient source; no public promotion', async () => {
  const input = context(), before = structuredClone(input.item), output = await evaluate(input);
  assert.equal(output.selection.accepted, true, JSON.stringify(output.reasonCodes)); assert.equal(output.factBundle?.state, 'accepted'); assert.equal(output.packageSnapshot?.scope, 'private_package'); assert.equal(output.declaration.ownerId, input.ownerId); assert.equal(output.declaration.packageObservationId, input.capture.packageObservationId); assert.deepEqual(input.item, before); assert.equal(input.item?.scope, 'public'); assert.equal(output.declaration.formulaEquivalence, 'unknown'); assert.equal(canClaimFullListAbsence(output.factBundle!, now), true);
  assert.equal(selectDeclaration(output.declaration, output.packageSnapshot!, 'public', input.policy, now).accepted, false); assert.equal(selectDeclaration(output.declaration, output.packageSnapshot!, 'private_package', input.policy, now, { ownerId: id(100), packageObservationId: id(3) }).accepted, false);
  assert.ok(output.dependencies.includes(input.item!.snapshotId)); assert.ok(output.dependencies.includes(id(10))); assert.equal(output.declaration.expiresAt, future); assert.throws(() => output.declaration.rawText = 'mutated', TypeError);
});
test('A11 private evidence retains chemical punctuation and exact image/text spans without invented canonical ingredients', async () => {
  const out = await evaluate(context()); assert.equal(out.declaration.rawText, rawIngredients);
  assert.deepEqual(out.declaration.sections[0].entries.map(e => e.rawToken), ['1,2-Hexanediol', 'Aqua (Water, Eau)', 'PPG-6-Decyltetradeceth-30', 'PEG-240/HDI Copolymer']);
  for (const entry of out.declaration.sections[0].entries) { const span = entry.sourceSpans[0]; assert.equal(rawIngredients.slice(span.start!, span.end!), entry.rawToken); assert.equal(span.observationId, id(15)); assert.equal(span.imageId, id(5)); assert.ok(span.region); assert.equal(entry.canonicalIngredientId, null); }
});
test('Private facts retain scope in downstream presence and full-list claim limits', async () => {
  const accepted=await evaluate(context()), acceptedLimits=factBundleClaimLimits(accepted.factBundle!,now);
  assert.equal(acceptedLimits.evidenceBasis,'private_label'); assert.equal(acceptedLimits.globalCatalogVerification,false);
  assert.equal(acceptedLimits.fullListAbsence,true); assert.equal(acceptedLimits.inferUnobservedIngredients,false);
  const partial=await evaluatePrivateEvidence(context(),{hash}), limits=factBundleClaimLimits(partial.factBundle!,now);
  assert.equal(limits.fullListAbsence,false); assert.equal(limits.globalCatalogVerification,false);
  assert.equal(limits.inferUnobservedIngredients,false); assert.equal(limits.formulaEquivalence,'unknown');
  const revoked=factBundleClaimLimits(accepted.factBundle!,now,[accepted.declaration.declarationId]);
  assert.deepEqual(revoked.readableEntryIds,[]); assert.equal(revoked.selectedPackagePresence,false); assert.equal(revoked.fullListAbsence,false);
});
test('A07 default absent adjudication authority and client confirmation/high OCR confidence stay partial', async () => {
  const input = context(), output = await evaluatePrivateEvidence(input, { hash }); assert.equal(output.selection.accepted, false); assert.ok(output.reasonCodes.includes('private_review_unavailable')); assert.equal(output.declaration.sections[0].lineCoverageComplete, false);
  assert.equal(PrivateEvidenceContextSchema.safeParse({ ...input, complete: true }).success, false); assert.equal(PrivateReviewedReceiptSchema.safeParse({ ...await reviewed(input), clientConfirmed: true }).success, false);
});
test('Ordinary private commit extracts its current source without a fixture review authority', async () => {
  const input=context();input.reviewRequest=null;
  const receipt={schemaVersion:1 as const,capture:input.capture,result:input.result,observationIds:input.observations.map(o=>o.observationId),declarationIds:[],assetIds:input.assets.map(a=>a.evidenceId)};
  const actions:string[]=[];let applied:any;
  const result=await commitPrivateCapture(input.capture.captureSessionId,{schemaVersion:2,idempotencyKey:'ordinary-source',expectedGeneration:4,expectedResultRevision:1,expectedCaptureRevision:1,expectedDeletionEpoch:2,packageObservationId:input.capture.packageObservationId,assets:[],sourceObservations:[],edits:[],review:null,reviewId:null},{ownerId:input.ownerId,
    operation:async(action)=>{actions.push(action);return receipt;},
    service:async(action,payload)=>{actions.push(action);if(action==='review/prepare')return{context:input,sourceCommitId:id(90),captureRevision:1,resultRevision:1};applied=payload;return receipt;},
  });
  assert.deepEqual(actions,['captures/observations','review/prepare','source/apply']);assert.deepEqual(result,receipt);
  assert.equal(applied.authorityPolicy,null);assert.equal(applied.reviewId,null);assert.equal(applied.evaluation.reviewReceipt,null);
  assert.equal(applied.evaluation.selection.accepted,false);assert.equal(applied.evaluation.capturedSource.acceptanceEligible,false);
  assert.equal(applied.evaluation.capturedSource.catalogVerified,false);assert.equal(applied.evaluation.capturedSource.absenceClaimsAllowed,false);
  assert.ok(applied.evaluation.declaration.sections[0].rawText.includes('1,2-Hexanediol'));
  const limits=factBundleClaimLimits(applied.evaluation.factBundle,now);
  assert.equal(limits.readableEntryIds.length,4);assert.equal(limits.selectedPackagePresence,false);assert.equal(limits.fullListAbsence,false);
});
test('A07 reviewed fixture producer rejects changed image/hash/Storage version/text/region/recognizer/revision without independent review', async () => {
  const initial = context(), receipt = await reviewed(initial);
  const edits: Array<(input: PrivateEvidenceContext) => void> = [i => i.assets[0].contentHash = 'changed', i => i.assets[0].objectVersion = 'changed', i => i.observations[0].rawText += ', Added', i => i.observations[0].ocr!.lines[0].region[0] = 0.3, i => i.observations[0].ocr!.recognizerVersion = '2', i => i.observations[0].revision = 2];
  for (const mutate of edits) { const input = structuredClone(initial); mutate(input); const output = await evaluate(input, receipt); assert.equal(output.selection.accepted, false); assert.equal(output.reviewReceipt, null); }
});
test('A08 wrong selected identity/barcode/variant/package conflicts remain blocked; unknown identity attrs may be privately established', async () => {
  const initial = context();
  for (const key of ['brand','form','scent','spf','size','packCount'] as const) { const input = structuredClone(initial); Object.assign(input.item!.variant, { [key]: key === 'packCount' ? 2 : 'contradiction' }); const output = await evaluate(input); assert.equal(output.selection.accepted, false, key); assert.equal(output.selection.state, 'conflict'); }
  const wrongCode = await reviewed(initial); wrongCode.packageIdentity.code.raw = '305210416383'; assert.equal((await evaluate(initial, wrongCode)).selection.accepted, false);
  const conflicted = structuredClone(initial); conflicted.item!.conflictIds = [id(101)]; assert.equal((await evaluate(conflicted)).selection.accepted, false);
  const packageConflict = structuredClone(initial); packageConflict.result.packageConfirmation = 'conflict'; assert.equal((await evaluate(packageConflict)).selection.accepted, false);
  const missing = structuredClone(initial); missing.item!.variant = Object.fromEntries(Object.keys(variant).map(k => [k,null])) as Variant; const out = await evaluate(missing); assert.equal(out.selection.accepted, true); assert.equal(missing.item!.variant.brand, null); assert.equal(out.packageSnapshot?.variant.brand, 'Example');
});
test('A10 header/end/line coverage gaps, hidden tail, bad source ref, unknown category/market/variant, glare and alternates never false-complete', async () => {
  const input = context(), initial = await reviewed(input);
  const changes: Array<(r: PrivateReviewedReceipt) => void> = [r => r.sections[0].startCovered = false, r => r.sections[0].endCovered = false, r => r.sections[0].lineCoverageComplete = false, r => r.sections[0].end -= 5, r => r.sections[0].lineRefs[0].end -= 1, r => r.sections[0].lineRefs[0].revision = 2, r => r.category = 'unknown', r => r.packageMarket = null, r => r.variant.size = null, r => r.uncertaintyReasons = ['glare'], r => r.sections[0].uncertaintyReasons = ['missing_tail']];
  for (const change of changes) { const r = structuredClone(initial); change(r); assert.equal((await evaluate(input, r)).selection.accepted, false); }
  const glare = context(); glare.observations[0].uncertaintyReasons = ['glare']; assert.equal((await evaluate(glare)).selection.accepted, false);
  const alternates = context(); alternates.observations[0].ocr!.lines[0].alternatives = ['Different text']; assert.equal((await evaluate(alternates)).selection.accepted, false);
});
test('A26 review/policy/asset/transcript expiry or withdrawal retract readiness; fresh review never refreshes old ingredients', async () => {
  const input = context(), receipt = await reviewed(input);
  for (const policy of [{ ...authorityPolicy, enabled: false }, { ...authorityPolicy, revokedAt: now }, { ...authorityPolicy, expiresAt: now }]) assert.equal((await evaluate(input, receipt, policy)).selection.accepted, false);
  for (const mutate of [(i: PrivateEvidenceContext) => i.assets[0].status = 'deleted', (i: PrivateEvidenceContext) => i.observations[0].status = 'revoked', (i: PrivateEvidenceContext) => i.observations[0].expiresAt = now, (i: PrivateEvidenceContext) => i.policy.revokedAt = now, (i: PrivateEvidenceContext) => i.policy.operations.privateDisplay = false]) { const changed = structuredClone(input); mutate(changed); assert.equal((await evaluate(changed, receipt)).selection.accepted, false); }
  const shorter = context(); shorter.assets[0].expiresAt = '2026-10-02T13:00:00.000Z'; const out = await evaluate(shorter); assert.equal(out.declaration.expiresAt, shorter.assets[0].expiresAt);
});
test('A25 owner, capture, generation, deletion epoch and package revisions cannot reuse another receipt', async () => {
  const input = context(), receipt = await reviewed(input);
  for (const field of ['ownerId', 'captureSessionId', 'packageObservationId'] as const) { const r = structuredClone(receipt); r[field] = id(102); const out = await evaluate(input, r); assert.equal(out.selection.accepted, false); assert.equal(out.reviewReceipt, null); }
  for (const field of ['generation','deletionEpoch'] as const) { const r = structuredClone(receipt); r[field]++; assert.equal((await evaluate(input,r)).selection.accepted,false); }
  const other = context(id(103)); const result = await evaluate(other); assert.equal(result.selection.accepted,true); assert.equal(result.declaration.ownerId,id(103)); assert.equal((await evaluate(other,receipt)).selection.accepted,false);
  const mismatched = context(); mismatched.capture.generation++; await assert.rejects(evaluate(mismatched), /binding_mismatch/);
  const stolen = context(); stolen.assets[0].ownerId = id(103); await assert.rejects(evaluate(stolen), /owner_or_package_mismatch/);
});
test('A25 attributed correction preserves original, needs a new exact review, and never selects superseded original', async () => {
  const input = context(), oldReceipt = await reviewed(input), original = input.observations[0];
  const edit: PrivateObservationRecord = { ...structuredClone(original), observationId: id(30), revision: 2, kind: 'edit', rawText: 'Water, Glycerin', originalObservationId: original.observationId, supersedesId: original.observationId, ocr: null, edit: { observationId: id(30), supersedesId: original.observationId, revision: 2, text: 'Water, Glycerin', reason: 'Synthetic independently reviewed correction' } };
  input.observations[0] = edit; input.priorObservations = [original]; input.supersedesDeclarationId = id(31); input.reviewRequest = { reviewId: id(32) };
  assert.equal((await evaluate(input, oldReceipt)).selection.accepted,false);
  const reviewedEdit = await evaluate(input); assert.equal(reviewedEdit.selection.accepted,true,JSON.stringify(reviewedEdit.reasonCodes)); assert.equal(reviewedEdit.declaration.supersedesId,id(31)); assert.equal(reviewedEdit.dependencies.includes(id(31)),false); assert.equal(canClaimFullListAbsence(reviewedEdit.factBundle!,now,[id(31)]),true); assert.equal(canClaimFullListAbsence(reviewedEdit.factBundle!,now,[original.observationId]),false); assert.equal(canClaimFullListAbsence(reviewedEdit.factBundle!,now,[id(5)]),false); assert.ok(reviewedEdit.dependencies.includes(original.observationId)); assert.equal(original.rawText,rawIngredients);
  const selectedOld = structuredClone(input); selectedOld.observations.push(selectedOld.priorObservations.pop()!); assert.equal((await evaluate(selectedOld)).selection.accepted,false);
  const deletedOriginal = structuredClone(input); deletedOriginal.priorObservations[0].status = 'deleted'; assert.equal((await evaluate(deletedOriginal)).selection.accepted,false);
});
test('Reviewed fixture manifest immutable registration and duplicate reference sets fail closed', async () => {
  const input = context(), receipt = await reviewed(input), authority = createReviewedFixtureAuthority(authorityPolicy,[receipt]); receipt.category = 'unknown'; assert.equal(authority.resolve(input.reviewRequest!)!.category,'cosmetic'); assert.throws(() => createReviewedFixtureAuthority({ ...authorityPolicy,permissionEvidence:'Client approval' },[receipt]),/synthetic_review_grant_required/);
  const duplicate = await reviewed(input); duplicate.observationBindings[1] = duplicate.observationBindings[0]; const out = await evaluate(input,duplicate); assert.equal(out.selection.accepted,false); assert.ok(out.reasonCodes.includes('review_evidence_set_mismatch'));
  assert.equal((await producePrivateReviewedReceipt(input,{hash,authority})).receipt?.category,'cosmetic');
});

test('Reviewed source assertions cannot change variant/market value without matching literal source proof', async () => {
  const input = context(); input.item!.variant = Object.fromEntries(Object.keys(variant).map(k => [k,null])) as Variant;
  const receipt = await reviewed(input); receipt.variant.brand = 'Other'; assert.equal((await evaluate(input,receipt)).selection.accepted,false);
  const market = await reviewed(input); market.packageMarket = 'UK'; assert.equal((await evaluate(input,market)).selection.accepted,false);
  const priorPackage = context(); priorPackage.item!.packageMarket = 'UK'; assert.equal((await evaluate(priorPackage)).selection.state,'conflict');
});
test('Only exact selected identity and permitted private OCR can become accepted', async () => {
  const candidate = context(); candidate.result.identity = 'candidate'; assert.equal((await evaluate(candidate)).selection.accepted,false);
  const disabled = context(); disabled.policy.operations.ocr = false; const out = await evaluate(disabled); assert.equal(out.selection.accepted,false); assert.equal(out.persistable,false);
  const invalidGeometry = context(); invalidGeometry.observations[0].ocr!.sourceWidth = 100; assert.equal((await evaluate(invalidGeometry)).selection.accepted,false);
});
test('Immutable correction lifetime includes original expiry and every split span retains exact local offsets', async () => {
  const input = context(), original = input.observations[0]; original.expiresAt = '2026-10-02T12:30:00.000Z';
  input.observations[0] = { ...structuredClone(original), observationId: id(33), revision: 2, kind: 'edit', rawText: 'Aqua (Water,\nEau), Glycerin', expiresAt: future, supersedesId: original.observationId, ocr: null, edit: { observationId:id(33),supersedesId:original.observationId,revision:2,text:'Aqua (Water,\nEau), Glycerin',reason:'Independent synthetic correction' } };
  input.priorObservations=[original]; const receipt=await reviewed(input), o=input.observations[0], first='Aqua (Water,', second='Eau), Glycerin';
  receipt.sections[0].lineRefs=[{ observationId:o.observationId,revision:2,start:0,end:first.length,assetEvidenceId:id(5),text:first,region:[0.1,0.1,0.8,0.1] },{ observationId:o.observationId,revision:2,start:first.length+1,end:o.rawText.length,assetEvidenceId:id(5),text:second,region:[0.1,0.2,0.8,0.1] }];
  const out=await evaluate(input,receipt); assert.equal(out.selection.accepted,true,JSON.stringify(out.reasonCodes)); assert.equal(out.declaration.expiresAt,original.expiresAt); assert.equal(out.declaration.sections[0].entries[0].sourceSpans.length,2);
  for(const entry of out.declaration.sections[0].entries) for(const span of entry.sourceSpans) for(const mapping of span.transformation) { assert.ok(mapping.sourceStart>=span.start!); assert.ok(mapping.sourceEnd<=span.end!); }
});

test('Pinned reusable local smoke review builder rejects unreviewed transcripts and mutated native metadata', async () => {
  const { createSyntheticPrivateReviewBuilder } = await import('./fixtures/part-one-private-review.ts');
  const build = createSyntheticPrivateReviewBuilder({ sanitizedAssetHash:'sha256:synthetic-sanitized-image',width:1200,height:1600,sanitizerVersion:'synthetic-sanitizer-1',recognizer:'fixture-vision',recognizerVersion:'1',hash,authorityPolicy });
  const input=context(), receipt=await build(input), result=await evaluate(input,receipt); assert.equal(result.selection.accepted,true);
  const changed=context(); changed.observations[0].rawText='Water, Other arbitrary formula'; changed.observations[0].ocr!.lines[0].text=changed.observations[0].rawText; await assert.rejects(build(changed),/gold_transcript_mismatch/);
  const image=context(); image.assets[0].contentHash='new-image'; await assert.rejects(build(image),/gold_image_mismatch/);
  const metadata=context(); metadata.observations[0].ocr!.lines[0].confidence=0.98; await assert.rejects(build(metadata),/gold_ocr_mismatch/);
  const variant=context(); variant.item!.variant.size='200'; await assert.rejects(build(variant),/gold_identity_mismatch/);
});

test('Two independently pinned package/ingredient assets retain distinct hash and region lineage', async () => {
  const { createSyntheticPrivateReviewBuilder } = await import('./fixtures/part-one-private-review.ts');
  const input=context(), second={ ...structuredClone(input.assets[0]),evidenceId:id(70),clientEvidenceId:id(71),attestationId:id(72),storageObjectId:id(73),contentHash:'sha256:separate-package-fixture' };
  input.assets.push(second); input.observations[1].assetEvidenceIds=[second.evidenceId]; input.observations[1].ocr!.evidenceId=second.clientEvidenceId;
  const build=createSyntheticPrivateReviewBuilder({ sanitizedAssetHash:'sha256:synthetic-sanitized-image',width:1200,height:1600,assetsByRole:{ingredients:{sanitizedAssetHash:'sha256:synthetic-sanitized-image',width:1200,height:1600},package:{sanitizedAssetHash:'sha256:separate-package-fixture',width:1200,height:1600}},sanitizerVersion:'synthetic-sanitizer-1',recognizer:'fixture-vision',recognizerVersion:'1',hash,authorityPolicy });
  const receipt=await build(input), output=await evaluate(input,receipt); assert.equal(output.selection.accepted,true); assert.equal(receipt.assetBindings.length,2); assert.equal(receipt.sections[0].lineRefs[0].assetEvidenceId,id(5)); assert.equal(receipt.packageIdentity.evidenceRefs[0].assetEvidenceId,id(70));
  const wrong=structuredClone(input); wrong.assets[1].contentHash=wrong.assets[0].contentHash; await assert.rejects(build(wrong),/gold_image_mismatch/);
});

test('A12 unreviewed explanatory-column table remains partial without flattening it into complete INCI evidence', async () => {
  const input=context(); input.observations[0].rawText='Water\tA liquid solvent\nGlycerin\tHumectant'; input.observations[0].ocr!.lines=input.observations[0].rawText.split('\n').map((text,index)=>({text,alternatives:[],region:[0.1,index/20,0.8,0.04],confidence:0.99}));
  const out=await evaluate(input); assert.equal(out.selection.accepted,false); assert.ok(out.reasonCodes.includes('unreviewed_table_layout')); assert.equal(out.declaration.rawText,input.observations[0].rawText);
});

test('Actual pinned JPEG review rejects Water/Glycerin formula replacement and accepts only source-preserving header edit', async () => {
  const { createSyntheticPrivateReviewBuilder,SYNTHETIC_PRIVATE_EDIT_TEXT }=await import('./fixtures/part-one-private-review.ts');
  const build=createSyntheticPrivateReviewBuilder({sanitizedAssetHash:'sha256:synthetic-sanitized-image',width:1200,height:1600,sanitizerVersion:'synthetic-sanitizer-1',recognizer:'fixture-vision',recognizerVersion:'1',hash,authorityPolicy});
  const input=context(),original=input.observations[0];input.priorObservations=[original];input.observations[0]={...structuredClone(original),observationId:id(80),revision:2,kind:'edit',rawText:'Water, Glycerin',supersedesId:original.observationId,ocr:null,edit:{observationId:id(80),supersedesId:original.observationId,revision:2,text:'Water, Glycerin',reason:'Changed formula'}};
  await assert.rejects(build(input),/gold_transcript_mismatch/);
  input.observations[0].rawText=SYNTHETIC_PRIVATE_EDIT_TEXT;input.observations[0].edit!.text=SYNTHETIC_PRIVATE_EDIT_TEXT;
  const output=await evaluate(input,await build(input));assert.equal(output.selection.accepted,true);assert.equal(output.declaration.sections[0].entries[0].rawToken,'1,2-Hexanediol');
});


test('Original rotated/large OCR remains attributed provenance while exact JPEG OCR supplies derivative coordinates', async()=>{
 const input=context(),derivative=input.observations[0],original=structuredClone(derivative);
 original.observationId=id(90);original.originalObservationId=original.observationId;original.coordinateSpace='source_original';
 original.ocr!.sourceWidth=6000;original.ocr!.sourceHeight=3000;original.ocr!.orientationTransform=[0,-1,1,1,0,0,0,0,1];
 derivative.derivedFromObservationIds=[original.observationId];input.observations.push(original);
 const out=await evaluate(input);assert.equal(out.reasonCodes.includes('invalid_ocr_geometry'),false);assert.equal(out.selection.accepted,true);
 assert.equal(out.declaration.rawText,rawIngredients);assert.ok(out.dependencies.includes(original.observationId));
 assert.equal(input.observations.at(-1)!.ocr!.sourceWidth,6000);
 const absent=structuredClone(input);absent.observations[0].derivedFromObservationIds=[id(99)];
 assert.ok((await evaluate(absent)).reasonCodes.includes('invalid_derivative_lineage'));
 const rotated=structuredClone(input);rotated.observations[0].ocr!.orientationTransform=original.ocr!.orientationTransform;
 assert.ok((await evaluate(rotated)).reasonCodes.includes('invalid_ocr_geometry'));
 const wrong=structuredClone(input);wrong.observations[0].ocr!.sourceWidth=6000;
 assert.ok((await evaluate(wrong)).reasonCodes.includes('invalid_ocr_geometry'));
});

test('Source-original coordinate records cannot supply accepted derivative source references',async()=>{
 const input=context();for(const o of input.observations)o.coordinateSpace='source_original';
 const out=await evaluate(input);assert.equal(out.selection.accepted,false);assert.ok(out.reasonCodes.includes('review_source_ref_mismatch'));
 const partial=await evaluatePrivateEvidence(input,{hash});assert.equal(partial.declaration.rawText,rawIngredients);assert.equal(partial.selection.accepted,false);
});

test('Original attributed chemical correction cannot be ignored in favor of a fresh JPEG OCR reading',async()=>{
 const input=context(),proof=input.observations[0],original=structuredClone(proof);
 original.observationId=id(92);original.originalObservationId=original.observationId;original.coordinateSpace='source_original';
 proof.derivedFromObservationIds=[original.observationId];input.priorObservations.push(original);
 const corrected={...structuredClone(original),observationId:id(93),kind:'edit' as const,revision:2,supersedesId:original.observationId,
  rawText:'Water, Glycerin',ocr:null,edit:{observationId:id(93),supersedesId:original.observationId,revision:2,text:'Water, Glycerin',reason:'Owner correction'}};
 input.observations.push(corrected);
 const out=await evaluate(input);assert.equal(out.selection.accepted,false);assert.ok(out.reasonCodes.includes('source_derivative_text_disagreement'));
 corrected.rawText=rawIngredients.replace(/^Ingredients: /,'');corrected.edit.text=corrected.rawText;
 const headerOnly=await evaluate(input);assert.equal(headerOnly.reasonCodes.includes('source_derivative_text_disagreement'),false);
 assert.equal(headerOnly.selection.accepted,true);
});
