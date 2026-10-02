import { z } from 'zod';
import { DeclarationSchema, DisplaySectionSchema, DisplaySourceSchema, ItemSnapshotSchema, PartOneIdSchema, SourceObservationSchema, SourcePolicySchema, VariantSchema } from '../../contracts/PartOne.ts';
import type { Declaration, DisplayProjection, ItemSnapshot, SourceObservation, SourcePolicy } from '../../contracts/PartOne.ts';
import { normalizeBarcode } from './barcode.ts';
import { parseDeclarationSection } from './parser.ts';
import { compareVariant, policyAllows, selectDeclaration } from './evidence.ts';
import type { DeclarationSelectionContext } from './evidence.ts';

const PolicyBindingSchema = z.strictObject({ databasePolicyId: z.string().regex(/^[a-z][a-z0-9_]{0,63}$/), sourcePolicyId: PartOneIdSchema, policyVersion: z.string().min(1) });
export const EvidenceAdmissionSchema = z.strictObject({ id: PartOneIdSchema, kind: z.enum(['observation', 'declaration', 'snapshot']), itemId: PartOneIdSchema, revision: z.number().int().positive(), canonicalKey: z.string().min(1), policyId: z.string().min(1), policyVersion: z.string().min(1), scope: z.literal('public'), dependencies: z.array(PartOneIdSchema), supersedesId: PartOneIdSchema.nullable(), observedAt: z.iso.datetime(), expiresAt: z.iso.datetime(), payload: z.record(z.string(), z.unknown()) });
export type EvidenceAdmission = z.infer<typeof EvidenceAdmissionSchema>;
export type EvidenceAdmissionContext = DeclarationSelectionContext & { databasePolicy: z.infer<typeof PolicyBindingSchema> };
function immutable<T>(value: T): T {
  const copied = structuredClone(value);
  const freeze = (v: unknown): void => { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } };
  freeze(copied); return copied;
}
/**
 * Service-side bridge to part_one_worker('admit', payload). It admits evidence,
 * never caller-supplied DEC booleans. No HTTP handler or outbound call is enabled.
 * Batch ordering avoids a cycle: observation -> declaration -> snapshot. Exact
 * immutable snapshot association remains in the declaration payload, while the
 * snapshot depends on its observations and whole declaration record.
 */
export function buildEvidenceAdmissions(observationInput: SourceObservation, itemInput: ItemSnapshot, declarationInput: Declaration, policyInput: SourcePolicy, now: string, context?: EvidenceAdmissionContext) {
  const observation = SourceObservationSchema.parse(observationInput), item = ItemSnapshotSchema.parse(itemInput), declaration = DeclarationSchema.parse(declarationInput), policy = SourcePolicySchema.parse(policyInput);
  if (!context) throw new Error('policy_mapping_required');
  const binding = PolicyBindingSchema.parse(context.databasePolicy);
  if (binding.databasePolicyId !== policy.provider || binding.sourcePolicyId !== policy.policyId || binding.policyVersion !== policy.version || observation.policyId !== policy.policyId || declaration.policyId !== policy.policyId || observation.provider !== policy.provider || observation.policyVersion !== policy.version) throw new Error('policy_mapping_mismatch');
  if (!policyAllows(policy, 'process', now) || !policyAllows(policy, 'retain', now) || !policyAllows(policy, 'sharedDisplay', now) || !policy.retainedFields.includes('identity') || !policy.retainedFields.includes('ingredients')) throw new Error('source_policy_disabled');
  // Public provider admission stays separate from the guarded owner-private capture transaction.
  if (declaration.scope !== 'public' || item.scope !== 'public' || declaration.ownerId !== null) throw new Error('private_retention_disabled');
  if (declaration.observedAt !== observation.fetchedAt || declaration.sourceUpdatedAt !== observation.sourceUpdatedAt) throw new Error('declaration_source_date_mismatch');
  if (observation.status !== 'active') throw new Error('observation_invalidated');
  if (!declaration.observationIds.includes(observation.observationId) || declaration.observationIds.some(id => id !== observation.observationId)) throw new Error('unvalidated_observation_dependency');
  if (declaration.revision < 1 || item.revision < 1) throw new Error('invalid_persistence_revision');
  const keys = [...new Set(item.barcodeAssertions.map(assertion => {
    const normalized = normalizeBarcode({ raw: assertion.raw, symbology: assertion.symbology, namespace: assertion.namespace, retailerId: null });
    if (!normalized.supported || normalized.canonicalCode !== assertion.canonical || normalized.namespace !== 'gtin') throw new Error('invalid_item_barcode_assertion');
    return `gtin:${normalized.canonicalGtin14}`;
  }))];
  if (keys.length !== 1) throw new Error('ambiguous_item_barcode');
  if (observation.dependencyIds.some(id => [observation.observationId, declaration.declarationId, item.snapshotId].includes(id))) throw new Error('cyclic_observation_dependency');
  const rawPayload = z.strictObject({ nativeCode: z.string(), canonicalCode: z.string().nullable(), name: z.string().nullable(), rawIngredients: z.string().nullable(), nativeBrand: z.string().nullable().optional(), structuredVariant: VariantSchema.nullable().optional() }).parse(observation.payload);
  const returnedCode = normalizeBarcode({ raw: rawPayload.nativeCode, symbology: rawPayload.nativeCode.length === 8 ? 'ean8' : null, namespace: 'gtin', retailerId: null });
  const ownAssociation = declaration.associationEvidenceIds.includes(observation.observationId) && observation.comparison === 'exact' && returnedCode.supported && rawPayload.canonicalCode === returnedCode.canonicalCode && keys[0] === `gtin:${returnedCode.canonicalGtin14}`;
  const normalizedBrand = (brand: string) => brand.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
  const nativeBrandConflict = rawPayload.nativeBrand != null && observation.variant.brand !== null && normalizedBrand(rawPayload.nativeBrand) !== normalizedBrand(observation.variant.brand);
  const structuredVariantConflict = rawPayload.structuredVariant != null && compareVariant(rawPayload.structuredVariant, observation.variant).contradictions.length > 0;
  const sourceConflict = nativeBrandConflict || structuredVariantConflict || observation.comparison === 'contradiction' || returnedCode.supported && keys[0] !== `gtin:${returnedCode.canonicalGtin14}` || compareVariant(observation.variant, item.variant).contradictions.length > 0 || compareVariant(observation.variant, declaration.variant).contradictions.length > 0;
  const sourceTextMatches = rawPayload.rawIngredients !== null && rawPayload.rawIngredients === declaration.rawText;
  let searchStart = 0;
  const coveredRanges: Array<[number, number]> = [];
  const parsedSectionsMatch = declaration.sections.every(section => {
    const start = declaration.rawText.indexOf(section.rawText, searchStart);
    if (start < 0 || !section.rawText.length) return false;
    searchStart = start + section.rawText.length; coveredRanges.push([start, searchStart]);
    const expected = parseDeclarationSection({ sectionId: section.sectionId, observationId: observation.observationId, imageId: null, sourceRevision: declaration.sourceRevision, rawText: section.rawText, sourceOffset: start, kind: section.kind, startCovered: true, endCovered: true, lineCoverageComplete: true, entryId: order => section.entries[order]?.entryId ?? observation.observationId });
    return expected.entries.length === section.entries.length && expected.entries.every((entry, i) => entry.rawToken === section.entries[i].rawToken && JSON.stringify(entry.quantity) === JSON.stringify(section.entries[i].quantity));
  });
  let uncovered = declaration.rawText;
  for (const [start, end] of coveredRanges.reverse()) uncovered = uncovered.slice(0, start) + ' '.repeat(end - start) + uncovered.slice(end);
  const entireFieldCovered = uncovered.replace(/\b(?:active\s+|inactive\s+)?ingredients\s*:?/gi, '').replace(/[\s,;:]+/g, '').length === 0;
  const sourceSpansMatch = declaration.sections.every(section => section.entries.every(entry => entry.sourceSpans.length === 1 && entry.sourceSpans.every(span => span.observationId === observation.observationId && span.sourceRevision === declaration.sourceRevision && span.start !== null && span.end !== null && span.start >= 0 && span.end >= span.start && span.end <= declaration.rawText.length && declaration.rawText.slice(span.start, span.end) === entry.rawToken)));
  // Missing source proof affects the computed predicate, never public identity values.
  const evaluation: Declaration = { ...declaration, variant: observation.variant, sourceMarkets: observation.sourceMarkets, associationEvidenceIds: ownAssociation ? declaration.associationEvidenceIds : [], conflictIds: [...new Set([...declaration.conflictIds, ...sourceConflict ? [observation.observationId] : []])], completenessReasons: [...new Set([...declaration.completenessReasons, ...!sourceTextMatches || !sourceSpansMatch || !parsedSectionsMatch || !entireFieldCovered ? ['unvalidated_source_text'] : []])] };
  const selection = selectDeclaration(evaluation, item, 'public', policy, now, context);
  const expiresAt = selection.expiresAt;
  if (Date.parse(expiresAt) <= Date.parse(observation.fetchedAt) || Date.parse(expiresAt) <= Date.parse(declaration.observedAt) || Date.parse(observation.fetchedAt) > Date.parse(now)) throw new Error('expired_admission');
  const sectionDisplay: DisplayProjection['sections'] = declaration.sections.map(section => DisplaySectionSchema.parse({ sectionId: section.sectionId, kind: section.kind, text: section.rawText, evidenceIds: declaration.observationIds, policyId: policy.policyId, observedAt: declaration.observedAt, expiresAt }));
  const sourceDisplay = [DisplaySourceSchema.parse({ observationId: observation.observationId, policyId: policy.policyId, label: policy.attribution ?? policy.provider, url: observation.sourceUrl, observedAt: observation.fetchedAt, sourceUpdatedAt: observation.sourceUpdatedAt, expiresAt })];
  const common = { itemId: item.itemId, canonicalKey: keys[0], policyId: binding.databasePolicyId, policyVersion: binding.policyVersion, scope: 'public' as const, expiresAt };
  const admission = (record: EvidenceAdmission): EvidenceAdmission => immutable(EvidenceAdmissionSchema.parse(record));
  const observationAdmission = admission({ ...common, id: observation.observationId, kind: 'observation', revision: 1, dependencies: observation.dependencyIds, supersedesId: null, observedAt: observation.fetchedAt, payload: { ...observation } });
  // ItemSnapshotId is a binding pointer, not a reverse dependency that would cycle.
  const declarationDependencies = [...new Set([...declaration.dependencyIds, ...declaration.observationIds, ...declaration.associationEvidenceIds])].filter(id => id !== item.snapshotId && id !== declaration.declarationId);
  const declarationAdmission = admission({ ...common, id: declaration.declarationId, kind: 'declaration', revision: declaration.revision, dependencies: declarationDependencies, supersedesId: declaration.supersedesId, observedAt: declaration.observedAt, payload: { ...declaration, predicate: selection.predicate, state: selection.state, reasons: selection.reasons, structuredSections: declaration.sections, sections: sectionDisplay, sources: sourceDisplay, acceptancePolicyVersion: 'part-one-dec-1' } });
  const fieldDependencies = Object.values(item.fieldEvidence).flat();
  const snapshotDependencies = [...new Set([observation.observationId, declaration.declarationId, ...fieldDependencies, ...item.barcodeAssertions.map(a => a.evidenceId)])].filter(id => id !== item.snapshotId);
  const snapshotAdmission = admission({ ...common, id: item.snapshotId, kind: 'snapshot', revision: item.revision, dependencies: snapshotDependencies, supersedesId: item.supersedesId, observedAt: observation.fetchedAt, payload: { ...item, declarationIds: [...new Set([...item.declarationIds, declaration.declarationId])], brand: item.variant.brand, variantText: [item.variant.form, item.variant.scent, item.variant.shade, item.variant.size && item.variant.unit ? `${item.variant.size} ${item.variant.unit}` : null, item.variant.packCount ? `${item.variant.packCount} pack` : null].filter(Boolean).join(' · '), image: null } });
  return immutable({ selection, admissions: [observationAdmission, declarationAdmission, snapshotAdmission] as const });
}
