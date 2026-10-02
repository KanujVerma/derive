import { z } from 'zod';
import { AttributedEditSchema, CaptureSessionSchema, DeclarationSchema, ItemSnapshotSchema, OcrObservationSchema, PartOneIdSchema, ScanResultSchema, SourcePolicySchema, VariantSchema } from '../../../src/contracts/PartOne.ts';
import type { Declaration, EvidenceSpan, ItemSnapshot, SourcePolicy, Variant } from '../../../src/contracts/PartOne.ts';
import { normalizeBarcode } from '../../../src/domain/part-one/barcode.ts';
import { compareVariant, policyAllows, selectDeclaration, toFactBundle } from '../../../src/domain/part-one/evidence.ts';
import { DECLARATION_ALIAS_VERSION, DECLARATION_PARSER_VERSION, parseDeclarationSection } from '../../../src/domain/part-one/parser.ts';

export const PRIVATE_ACCEPTANCE_POLICY_VERSION = 'part-one-private-dec-1';
const id = PartOneIdSchema.transform(value => value.toLowerCase()), ids = z.array(id), revision = z.number().int().nonnegative(), date = z.iso.datetime();
const region = z.array(z.number().finite().min(0).max(1)).length(4).refine(r => r[2] > 0 && r[3] > 0 && r[0] + r[2] <= 1.000001 && r[1] + r[3] <= 1.000001, 'Invalid normalized image region');
const binding = { ownerId: id, captureSessionId: id, packageObservationId: id, generation: revision, deletionEpoch: revision };
export const PrivateAssetAttestationSchema = z.strictObject({ ...binding, evidenceId: id, clientEvidenceId: id, attestationId: id, storageObjectId: id, contentHash: z.string().min(1), objectVersion: z.string().min(1), width: z.number().int().positive().max(4096), height: z.number().int().positive().max(4096), metadataStripped: z.literal(true), sanitizerVersion: z.string().min(1), verificationEvidence: z.string().min(1), observedAt: date, expiresAt: date, status: z.enum(['active', 'revoked', 'deleted']) });
export const PrivateObservationRecordSchema = z.strictObject({ ...binding, observationId: id, revision: z.number().int().positive(), kind: z.enum(['ocr', 'edit']), role: z.enum(['ingredients', 'package']), rawText: z.string(), assetEvidenceIds: ids.min(1), originalObservationId: id, supersedesId: id.nullable(), uncertaintyReasons: z.array(z.string()), ocr: OcrObservationSchema.nullable(), edit: AttributedEditSchema.nullable(), observedAt: date, expiresAt: date, status: z.enum(['active', 'revoked', 'deleted']) });
export type PrivateAssetAttestation = z.infer<typeof PrivateAssetAttestationSchema>;
export type PrivateObservationRecord = z.infer<typeof PrivateObservationRecordSchema>;
const assetBinding = z.strictObject({ evidenceId: id, attestationId: id, storageObjectId: id, contentHash: z.string().min(1), objectVersion: z.string().min(1) });
const observationBinding = z.strictObject({ observationId: id, revision: z.number().int().positive(), textHash: z.string().min(1), recordHash: z.string().min(1) });
const sourceRef = z.strictObject({ observationId: id, revision: z.number().int().positive(), start: revision, end: revision, assetEvidenceId: id, text: z.string().min(1), region });
export const PrivateReviewedReceiptSchema = z.strictObject({ schemaVersion: z.literal(1), ...binding, reviewId: id, authorityPolicyId: id, authorityPolicyVersion: z.string().min(1), reviewedAt: date, expiresAt: date, permissionEvidence: z.string().min(1), selectedItemId: id, selectedSnapshotId: id, assetBindings: z.array(assetBinding).min(1), observationBindings: z.array(observationBinding).min(1), packageIdentity: z.strictObject({ code: z.strictObject({ raw: z.string(), symbology: z.string().nullable(), namespace: z.literal('gtin'), retailerId: z.null() }), evidenceRefs: z.array(sourceRef).min(1) }), category: z.enum(['cosmetic', 'drug', 'unknown']), categoryRefs: z.array(sourceRef), variant: VariantSchema, variantRefs: z.record(z.string(), z.array(sourceRef)), packageMarket: z.string().nullable(), marketRefs: z.array(sourceRef), sections: z.array(z.strictObject({ kind: z.enum(['ingredients', 'active', 'inactive', 'may_contain']), observationId: id, revision: z.number().int().positive(), start: revision, end: revision, startCovered: z.boolean(), endCovered: z.boolean(), lineCoverageComplete: z.boolean(), lineRefs: z.array(sourceRef), uncertaintyReasons: z.array(z.string()) })), conflictIds: ids, uncertaintyReasons: z.array(z.string()) });
export type PrivateReviewedReceipt = z.infer<typeof PrivateReviewedReceiptSchema>;
export const PrivateReviewRequestSchema = z.strictObject({ reviewId: id });
export type PrivateReviewRequest = z.infer<typeof PrivateReviewRequestSchema>;
export const PrivateReviewAuthorityPolicySchema = z.strictObject({ policyId: id, version: z.string().min(1), enabled: z.boolean(), mode: z.literal('synthetic_local_only'), permissionEvidence: z.string().min(1), reviewedAt: date, expiresAt: date, revokedAt: date.nullable() });
export type PrivateReviewAuthorityPolicy = z.infer<typeof PrivateReviewAuthorityPolicySchema>;
export interface PrivateReviewAuthority { policy: PrivateReviewAuthorityPolicy; resolve(request: PrivateReviewRequest): PrivateReviewedReceipt | null }
export const PrivateEvidenceContextSchema = z.strictObject({ ownerId: id, capture: CaptureSessionSchema, result: ScanResultSchema, item: ItemSnapshotSchema.nullable(), assets: z.array(PrivateAssetAttestationSchema), observations: z.array(PrivateObservationRecordSchema), priorObservations: z.array(PrivateObservationRecordSchema), supersedesDeclarationId: id.nullable(), reviewRequest: PrivateReviewRequestSchema.nullable(), policy: SourcePolicySchema, now: date, ids: z.strictObject({ snapshotId: id, declarationId: id }) });
export type PrivateEvidenceContext = z.infer<typeof PrivateEvidenceContextSchema>;
export type PrivateEvidencePorts = { hash(text: string): Promise<string>; authority?: PrivateReviewAuthority };

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
function frozen<T>(value: T): T { const clone = structuredClone(value); const freeze = (v: unknown): void => { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } }; freeze(clone); return clone; }
export async function hashPrivateObservation(recordInput: PrivateObservationRecord, hash: PrivateEvidencePorts['hash']) {
  const record = PrivateObservationRecordSchema.parse(recordInput);
  return { textHash: await hash(record.rawText), recordHash: await hash(canonical(record)) };
}
/** Reviewed manifests are injected by a trusted local test runner, never an HTTP
 * request. No deployment authority or default review grant is supplied here. */
export function createReviewedFixtureAuthority(policyInput: PrivateReviewAuthorityPolicy, receiptsInput: readonly PrivateReviewedReceipt[]): PrivateReviewAuthority {
  const policy = frozen(PrivateReviewAuthorityPolicySchema.parse(policyInput));
  if (!policy.permissionEvidence.startsWith('Synthetic local fixture:')) throw new Error('synthetic_review_grant_required');
  const receipts = receiptsInput.map(r => frozen(PrivateReviewedReceiptSchema.parse(r)));
  if (new Set(receipts.map(r => r.reviewId)).size !== receipts.length) throw new Error('duplicate_review_id');
  if (receipts.some(r => r.authorityPolicyId !== policy.policyId || r.authorityPolicyVersion !== policy.version)) throw new Error('review_authority_mismatch');
  return Object.freeze({ policy, resolve(requestInput: PrivateReviewRequest) { const request = PrivateReviewRequestSchema.parse(requestInput); return receipts.find(r => r.reviewId === request.reviewId) ?? null; } });
}
const sameBinding = (record: z.infer<typeof PrivateAssetAttestationSchema> | PrivateObservationRecord | PrivateReviewedReceipt, input: PrivateEvidenceContext) => record.ownerId === input.ownerId && record.captureSessionId === input.capture.captureSessionId && record.packageObservationId === input.capture.packageObservationId && record.generation === input.capture.generation && record.deletionEpoch === input.capture.deletionEpoch;
const current = (record: { observedAt: string; expiresAt: string; status: string }, now: string) => record.status === 'active' && Date.parse(record.observedAt) <= Date.parse(now) && Date.parse(record.expiresAt) > Date.parse(now);
function inputBindings(input: PrivateEvidenceContext) {
  if (input.capture.scanId !== input.result.scanId || input.capture.generation !== input.result.generation || input.capture.itemId !== input.result.itemId || input.item && (input.item.snapshotId !== input.result.snapshotId || input.item.itemId !== input.result.itemId)) throw new Error('private_capture_binding_mismatch');
  for (const record of [...input.assets, ...input.observations, ...input.priorObservations]) if (!sameBinding(record, input)) throw new Error('private_owner_or_package_mismatch');
  if (new Set(input.assets.map(a => a.evidenceId)).size !== input.assets.length || new Set(input.assets.map(a => a.storageObjectId)).size !== input.assets.length || new Set([...input.observations, ...input.priorObservations].map(o => o.observationId)).size !== input.observations.length + input.priorObservations.length) throw new Error('duplicate_private_evidence_id');
}
function validRef(ref: z.infer<typeof sourceRef>, input: PrivateEvidenceContext) {
  const observation = input.observations.find(o => o.observationId === ref.observationId && o.revision === ref.revision);
  return !!observation && observation.assetEvidenceIds.includes(ref.assetEvidenceId) && input.assets.some(a => a.evidenceId === ref.assetEvidenceId && current(a, input.now)) && ref.start < ref.end && ref.end <= observation.rawText.length && observation.rawText.slice(ref.start, ref.end) === ref.text;
}
function lineCoverage(section: PrivateReviewedReceipt['sections'][number], input: PrivateEvidenceContext) {
  if (!section.startCovered || !section.endCovered || !section.lineCoverageComplete || !section.lineRefs.length) return false;
  const observation = input.observations.find(o => o.observationId === section.observationId && o.revision === section.revision);
  if (!observation || section.start >= section.end || section.end > observation.rawText.length) return false;
  const ranges = section.lineRefs.map(r => [r.start, r.end] as const).sort((a, b) => a[0] - b[0]);
  let cursor = section.start;
  for (let i = 0; i < ranges.length; i++) {
    const ref = section.lineRefs.find(r => r.start === ranges[i][0] && r.end === ranges[i][1])!;
    if (!validRef(ref, input) || ref.observationId !== section.observationId || ref.revision !== section.revision || ref.start < cursor || ref.end > section.end || observation.rawText.slice(cursor, ref.start).trim()) return false;
    cursor = ref.end;
  }
  return observation.rawText.slice(cursor, section.end).trim() === '';
}
function fullFieldCoverage(receipt: PrivateReviewedReceipt, input: PrivateEvidenceContext) {
  return input.observations.filter(o => o.role === 'ingredients').every(o => {
    let cursor = 0;
    for (const section of receipt.sections.filter(s => s.observationId === o.observationId).sort((a, b) => a.start - b.start)) {
      if (section.start < cursor || section.end > o.rawText.length) return false;
      const gap = o.rawText.slice(cursor, section.start).replace(/\b(?:active\s+|inactive\s+)?ingredients\s*:?/gi, '').trim();
      if (gap) return false;
      cursor = section.end;
    }
    return o.rawText.slice(cursor).trim() === '';
  });
}

/** Producer resolves only frozen independently reviewed manifests, then validates
 * the ACTUAL current records. A client reviewId, confirmation or confidence has
 * no authority to change a hash, crop, transcript, market, variant or coverage. */
export async function producePrivateReviewedReceipt(contextInput: PrivateEvidenceContext, ports: PrivateEvidencePorts): Promise<{ receipt: PrivateReviewedReceipt | null; reasons: string[] }> {
  const input = PrivateEvidenceContextSchema.parse(contextInput); inputBindings(input);
  const authority = ports.authority;
  if (!input.reviewRequest || !authority) return { receipt: null, reasons: ['private_review_unavailable'] };
  const authorityPolicy = PrivateReviewAuthorityPolicySchema.parse(authority.policy);
  if (!authorityPolicy.enabled || authorityPolicy.revokedAt || Date.parse(authorityPolicy.reviewedAt) > Date.parse(input.now) || Date.parse(authorityPolicy.expiresAt) <= Date.parse(input.now)) return { receipt: null, reasons: ['review_authority_unavailable'] };
  const found = authority.resolve(input.reviewRequest);
  if (!found) return { receipt: null, reasons: ['review_not_found'] };
  const receipt = PrivateReviewedReceiptSchema.parse(found), reasons: string[] = [];
  if (!sameBinding(receipt, input) || receipt.selectedItemId !== input.item?.itemId || receipt.selectedSnapshotId !== input.item?.snapshotId || receipt.authorityPolicyId !== authorityPolicy.policyId || receipt.authorityPolicyVersion !== authorityPolicy.version) reasons.push('review_binding_mismatch');
  if (Date.parse(receipt.reviewedAt) > Date.parse(input.now) || Date.parse(receipt.expiresAt) <= Date.parse(input.now)) reasons.push('review_expired');
  if (receipt.assetBindings.length !== input.assets.length || receipt.observationBindings.length !== input.observations.length || new Set(receipt.assetBindings.map(a => a.evidenceId)).size !== receipt.assetBindings.length || new Set(receipt.observationBindings.map(o => o.observationId)).size !== receipt.observationBindings.length) reasons.push('review_evidence_set_mismatch');
  for (const b of receipt.assetBindings) {
    const asset = input.assets.find(a => a.evidenceId === b.evidenceId);
    if (!asset || asset.attestationId !== b.attestationId || asset.storageObjectId !== b.storageObjectId || asset.contentHash !== b.contentHash || asset.objectVersion !== b.objectVersion || !current(asset, input.now)) reasons.push('review_asset_mismatch');
  }
  for (const b of receipt.observationBindings) {
    const observation = input.observations.find(o => o.observationId === b.observationId);
    if (!observation || observation.revision !== b.revision || !current(observation, input.now)) { reasons.push('review_observation_mismatch'); continue; }
    const hashes = await hashPrivateObservation(observation, ports.hash);
    if (hashes.textHash !== b.textHash || hashes.recordHash !== b.recordHash) reasons.push('review_observation_hash_mismatch');
  }
  const refs = [...receipt.packageIdentity.evidenceRefs, ...receipt.categoryRefs, ...Object.values(receipt.variantRefs).flat(), ...receipt.marketRefs, ...receipt.sections.flatMap(s => s.lineRefs)];
  if (refs.some(r => !validRef(r, input))) reasons.push('review_source_ref_mismatch');
  return { receipt: reasons.length ? null : frozen(receipt), reasons: [...new Set(reasons)] };
}
async function derivedId(seed: string, hash: PrivateEvidencePorts['hash']) {
  const digest = await hash(seed);
  if (!/^[a-f0-9]{32,}$/i.test(digest)) throw new Error('cryptographic_hash_required');
  const hex = digest.slice(0, 32).toLowerCase(); return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
export async function evaluatePrivateEvidence(contextInput: PrivateEvidenceContext, ports: PrivateEvidencePorts) {
  const input = PrivateEvidenceContextSchema.parse(contextInput); inputBindings(input);
  const reasons: string[] = [];
  if (input.result.identity !== 'exact') reasons.push('selected_identity_not_exact');
  if (!policyAllows(input.policy, 'ocr', input.now)) reasons.push('private_ocr_policy_blocked');
  const all = [...input.observations, ...input.priorObservations];
  for (const o of all) {
    if (!current(o, input.now)) reasons.push('private_observation_unavailable');
    if (!o.assetEvidenceIds.length || o.assetEvidenceIds.some(a => !input.assets.some(asset => asset.evidenceId === a && current(asset, input.now)))) reasons.push('private_asset_unavailable');
    if (o.kind === 'ocr') {
      if (!o.ocr || o.edit || o.revision !== 1 || o.supersedesId !== null || o.originalObservationId !== o.observationId || !input.assets.some(a => o.assetEvidenceIds.includes(a.evidenceId) && a.clientEvidenceId === o.ocr!.evidenceId) || o.ocr.captureSessionId !== input.capture.captureSessionId || o.ocr.generation !== input.capture.generation || o.ocr.lines.map(l => l.text).join('\n') !== o.rawText) reasons.push('invalid_ocr_lineage');
      if (o.ocr?.status !== 'recognized') reasons.push('ocr_not_recognized');
      if (o.ocr && (!input.assets.some(a => o.assetEvidenceIds.includes(a.evidenceId) && a.width === o.ocr!.sourceWidth && a.height === o.ocr!.sourceHeight) || o.ocr.lines.some(l => !region.safeParse(l.region).success))) reasons.push('invalid_ocr_geometry');
      if (input.observations.includes(o) && o.ocr?.lines.some(l => l.alternatives.length)) reasons.push('recognition_alternatives_unresolved');
    } else {
      const prior = all.find(p => p.observationId === o.supersedesId);
      if (!prior || !current(prior, input.now) || !o.edit || o.ocr || o.edit.observationId !== o.observationId || o.edit.supersedesId !== prior.observationId || o.edit.revision !== o.revision || o.revision !== prior.revision + 1 || o.originalObservationId !== prior.originalObservationId || o.edit.text !== o.rawText || canonical([...o.assetEvidenceIds].sort()) !== canonical([...prior.assetEvidenceIds].sort())) reasons.push('invalid_edit_lineage');
    }
    if (input.observations.includes(o)) reasons.push(...o.uncertaintyReasons);
  }
  if (input.observations.some(o => all.some(next => next.supersedesId === o.observationId))) reasons.push('superseded_observation_selected');
  if (input.priorObservations.some(prior => !all.some(next => next.supersedesId === prior.observationId))) reasons.push('unreferenced_prior_observation');
  if (!input.observations.some(o => o.role === 'ingredients')) reasons.push('missing_ingredient_observation');
  // No reviewed column-layout contract is available in this private boundary.
  // A tabular transcript cannot be promoted by flattening explanation cells.
  if (input.observations.some(o => o.role === 'ingredients' && o.rawText.includes('\t'))) reasons.push('unreviewed_table_layout');
  const produced = await producePrivateReviewedReceipt(input, ports), receipt = produced.receipt;
  reasons.push(...produced.reasons);
  const unknown: Variant = { brand: null, line: null, form: null, scent: null, shade: null, spf: null, strength: null, size: null, unit: null, packCount: null, packagingLevel: null };
  const privateVariant = receipt?.variant ?? unknown;
  // A wrong public declaration is independent of this private package proof.
  // Item identity contradictions and package conflicts still block acceptance.
  const conflicts = [...input.item?.conflictIds ?? [], ...receipt?.conflictIds ?? []];
  if (input.item && compareVariant(input.item.variant, privateVariant).contradictions.length) conflicts.push(receipt?.reviewId ?? input.capture.packageObservationId);
  if (receipt) {
    if (input.item?.packageMarket && receipt.packageMarket && input.item.packageMarket !== receipt.packageMarket) conflicts.push(receipt.reviewId);
    const code = normalizeBarcode(receipt.packageIdentity.code);
    if (!receipt.packageIdentity.evidenceRefs.some(r => r.text.replace(/\s/g, '') === receipt.packageIdentity.code.raw) || !code.supported || !input.item?.barcodeAssertions.some(a => a.canonical === code.canonicalCode && a.namespace === 'gtin')) conflicts.push(receipt.reviewId);
    if (!receipt.categoryRefs.length || receipt.category === 'unknown') reasons.push('category_unknown');
    const normalized = (value: string | number) => String(value).normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
    for (const key of Object.keys(privateVariant) as Array<keyof Variant>) if (privateVariant[key] !== null && !receipt.variantRefs[key]?.some(ref => normalized(ref.text) === normalized(privateVariant[key]!))) reasons.push(`variant_evidence_missing:${key}`);
    if (!receipt.packageMarket || !receipt.marketRefs.some(ref => normalized(ref.text) === normalized(receipt.packageMarket!))) reasons.push('market_unknown');
    if (receipt.sections.some(s => input.observations.find(o => o.observationId === s.observationId)?.role !== 'ingredients')) reasons.push('section_role_mismatch');
    if (!receipt.sections.length || !receipt.sections.every(s => lineCoverage(s, input)) || !fullFieldCoverage(receipt, input)) reasons.push('full_panel_not_established');
    reasons.push(...receipt.uncertaintyReasons, ...receipt.sections.flatMap(s => s.uncertaintyReasons));
  }
  if (input.result.packageConfirmation === 'conflict') conflicts.push(input.capture.packageObservationId);
  const rawText = input.observations.filter(o => o.role === 'ingredients').map(o => o.rawText).join('\n');
  const minExpiry = Math.min(Date.parse(input.now) + 86400000, ...input.assets.map(a => Date.parse(a.expiresAt)), ...all.map(o => Date.parse(o.expiresAt)), ...input.policy.expiresAt ? [Date.parse(input.policy.expiresAt)] : [], ...receipt ? [Date.parse(receipt.expiresAt), Date.parse(ports.authority!.policy.expiresAt)] : []);
  const expiresAt = new Date(minExpiry).toISOString();
  const dependencies = [...new Set([...input.assets.map(a => a.evidenceId), ...all.map(o => o.observationId), ...input.item ? [input.item.snapshotId, ...input.item.barcodeAssertions.map(a => a.evidenceId), ...Object.values(input.item.fieldEvidence).flat()] : [], ...receipt ? [receipt.reviewId] : []])];
  const packageSnapshot: ItemSnapshot | null = input.item ? { ...input.item, snapshotId: input.ids.snapshotId, revision: input.item.revision + 1, variant: privateVariant, scope: 'private_package', packageMarket: receipt?.packageMarket ?? null, sourceMarkets: [], fieldEvidence: { ...input.item.fieldEvidence, ...Object.fromEntries(Object.keys(privateVariant).map(k => [k, receipt ? [receipt.reviewId] : []])) }, declarationIds: [input.ids.declarationId], conflictIds: [...new Set(conflicts)], supersedesId: input.item.snapshotId } : null;
  const selectedSections = receipt?.sections ?? input.observations.filter(o => o.role === 'ingredients').map(o => ({ kind: 'ingredients' as const, observationId: o.observationId, revision: o.revision, start: 0, end: o.rawText.length, startCovered: false, endCovered: false, lineCoverageComplete: false, lineRefs: [], uncertaintyReasons: [] }));
  const sections: Declaration['sections'] = [];
  for (let index = 0; index < selectedSections.length; index++) {
    const s = selectedSections[index], o = input.observations.find(o => o.observationId === s.observationId)!;
    if (!o || s.start < 0 || s.end > o.rawText.length || s.start >= s.end) { reasons.push('invalid_section_span'); continue; }
    const sectionId = await derivedId(`${input.ids.declarationId}:section:${index}`, ports.hash);
    const probe = parseDeclarationSection({ sectionId, observationId: o.observationId, imageId: null, sourceRevision: o.revision, rawText: o.rawText.slice(s.start, s.end), sourceOffset: s.start, kind: s.kind, startCovered: false, endCovered: false, lineCoverageComplete: false, entryId: () => sectionId });
    const entryIds = await Promise.all(probe.entries.map((_, n) => derivedId(`${sectionId}:entry:${n}`, ports.hash)));
    const parsed = parseDeclarationSection({ sectionId, observationId: o.observationId, imageId: null, sourceRevision: o.revision, rawText: o.rawText.slice(s.start, s.end), sourceOffset: s.start, kind: s.kind, startCovered: s.startCovered, endCovered: s.endCovered, lineCoverageComplete: s.lineCoverageComplete, entryId: n => entryIds[n], uncertaintyReasons: s.uncertaintyReasons });
    for (const entry of parsed.entries) {
      const spans: EvidenceSpan[] = s.lineRefs.filter(r => r.start < entry.sourceSpans[0].end! && r.end > entry.sourceSpans[0].start!).map(r => ({ observationId: o.observationId, imageId: r.assetEvidenceId, sourceRevision: o.revision, start: Math.max(r.start, entry.sourceSpans[0].start!), end: Math.min(r.end, entry.sourceSpans[0].end!), region: r.region, transformation: entry.sourceSpans[0].transformation.filter(t => t.sourceStart >= Math.max(r.start, entry.sourceSpans[0].start!) && t.sourceEnd <= Math.min(r.end, entry.sourceSpans[0].end!)) }));
      if (spans.length) entry.sourceSpans = spans;
    }
    sections.push(parsed);
  }
  const declaration: Declaration = DeclarationSchema.parse({ declarationId: input.ids.declarationId, revision: Math.max(1, ...input.observations.map(o => o.revision)), itemId: input.item?.itemId ?? null, snapshotId: packageSnapshot?.snapshotId ?? null, observationIds: input.observations.map(o => o.observationId), dependencyIds: dependencies, rawText, textStructureHash: await ports.hash(canonical({ rawText, sections })), sections, category: receipt?.category ?? 'unknown', completenessReasons: [...new Set(reasons)], transcriptionUncertainty: [...new Set(input.observations.flatMap(o => o.uncertaintyReasons))], parserVersion: DECLARATION_PARSER_VERSION, aliasVersion: DECLARATION_ALIAS_VERSION, sourceRevision: Math.max(1, ...input.observations.map(o => o.revision)), sourceUpdatedAt: null, observedAt: input.now, expiresAt, policyId: input.policy.policyId, scope: 'private_package', ownerId: input.ownerId, packageObservationId: input.capture.packageObservationId, associationEvidenceIds: receipt && packageSnapshot ? [receipt.reviewId, ...receipt.packageIdentity.evidenceRefs.map(r => r.observationId)] : [], variant: privateVariant, sourceMarkets: [], packageMarket: receipt?.packageMarket ?? null, conflictIds: [...new Set(conflicts)], supersedesId: input.supersedesDeclarationId, formulaEquivalence: 'unknown' });
  const evaluationItem = packageSnapshot ?? { snapshotId: input.ids.snapshotId, itemId: input.ids.snapshotId, revision: 1, name: '', variant: unknown, fieldEvidence: {}, barcodeAssertions: [], requestedMarket: null, sourceMarkets: [], packageMarket: null, declarationIds: [], conflictIds: [], scope: 'private_package' as const, supersedesId: null };
  const selection = selectDeclaration(declaration, evaluationItem, 'private_package', input.policy, input.now, { ownerId: input.ownerId, packageObservationId: input.capture.packageObservationId });
  const sources = input.observations.map(o => ({ observationId: o.observationId, policyId: input.policy.policyId, label: o.kind === 'ocr' ? 'Private on-device OCR' : 'Private attributed correction', url: null, observedAt: o.observedAt, sourceUpdatedAt: null, expiresAt }));
  return frozen({ packageSnapshot, declaration, selection, factBundle: packageSnapshot ? toFactBundle(declaration, packageSnapshot, selection, sources, receipt ? 'photo_supported' : input.result.packageConfirmation) : null, reviewReceipt: receipt, dependencies, reasonCodes: [...new Set([...reasons, ...selection.reasons])], acceptancePolicyVersion: PRIVATE_ACCEPTANCE_POLICY_VERSION, persistable: ['ocr', 'process', 'retain', 'privateDisplay'].every(op => policyAllows(input.policy, op as keyof SourcePolicy['operations'], input.now)) });
}
