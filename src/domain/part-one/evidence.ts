import { DeclarationSchema, FactBundleV1Schema, ItemSnapshotSchema, SourcePolicySchema } from '../../contracts/PartOne.ts';
import type { Declaration, DeclarationPredicate, DisplayProjection, FactBundleV1, ItemSnapshot, Scope, SourcePolicy, Variant } from '../../contracts/PartOne.ts';

export const ACCEPTANCE_POLICY_VERSION = 'part-one-dec-1';
export type VariantField = keyof Variant;
export type VariantComparison = { state: 'compatible' | 'unknown' | 'contradiction'; contradictions: VariantField[]; unknowns: VariantField[]; matched: VariantField[] };
const variantFields: VariantField[] = ['brand', 'line', 'form', 'scent', 'shade', 'spf', 'strength', 'size', 'unit', 'packCount', 'packagingLevel'];
const normalizeAssertion = (value: string | number) => String(value).normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
/** Unknown is never a matching assertion; cosmetic name similarity has no authority. */
export function compareVariant(a: Variant, b: Variant): VariantComparison {
  const contradictions: VariantField[] = [], unknowns: VariantField[] = [], matched: VariantField[] = [];
  for (const key of variantFields) {
    if (a[key] === null || b[key] === null) unknowns.push(key);
    else if (normalizeAssertion(a[key]) !== normalizeAssertion(b[key])) contradictions.push(key);
    else matched.push(key);
  }
  return { state: contradictions.length ? 'contradiction' : unknowns.length ? 'unknown' : 'compatible', contradictions, unknowns, matched };
}
export function policyAllows(policy: SourcePolicy | undefined, operation: keyof SourcePolicy['operations'], now: string): boolean {
  if (!policy || !SourcePolicySchema.safeParse(policy).success || !policy.permissionEvidence || !policy.reviewedAt || !policy.expiresAt || policy.revokedAt || !Number.isFinite(Date.parse(now))) return false;
  return Date.parse(policy.reviewedAt) <= Date.parse(now) && Date.parse(policy.expiresAt) > Date.parse(now) && policy.operations[operation] === true;
}
export type DeclarationSelectionContext = {
  ownerId?: string; packageObservationId?: string; requiredVariantFields?: VariantField[];
  requireMarket?: boolean; revokedIds?: readonly string[]; deletedIds?: readonly string[];
};
export type DeclarationSelection = { accepted: boolean; predicate: DeclarationPredicate; reasons: string[]; state: 'accepted' | 'partial' | 'uncertain' | 'conflict'; expiresAt: string };
export function selectDeclaration(d: Declaration, item: ItemSnapshot, scope: Scope, policy: SourcePolicy | undefined, now: string, context: DeclarationSelectionContext = {}): DeclarationSelection {
  const valid = DeclarationSchema.safeParse(d).success && ItemSnapshotSchema.safeParse(item).success;
  const check = (passed: boolean, reasons: string[], evidenceIds = d.associationEvidenceIds) => ({ passed: valid && passed, reasons: valid ? reasons : ['malformed_evidence'], evidenceIds });
  const bound = d.itemId === item.itemId && d.snapshotId === item.snapshotId && d.associationEvidenceIds.length > 0 && d.scope === scope;
  const privateBound = scope !== 'private_package' || !!context.ownerId && d.ownerId === context.ownerId && !!context.packageObservationId && d.packageObservationId === context.packageObservationId;
  const comparison = compareVariant(d.variant, item.variant);
  const conflicts = [...d.conflictIds, ...item.conflictIds];
  const required = context.requiredVariantFields ?? ['brand', 'form', 'size', 'unit', 'packCount', 'packagingLevel'];
  // If either side makes a distinguishing claim, unknown on the other side blocks that claim.
  const unknownRequired = comparison.unknowns.filter(key => required.includes(key) || d.variant[key] !== null || item.variant[key] !== null);
  const sourceMarkets = new Set(d.sourceMarkets);
  const packageMarket = d.packageMarket;
  const requiredMarket = scope === 'private_package' ? item.packageMarket : item.requestedMarket;
  const marketConflict = !!packageMarket && !!item.packageMarket && packageMarket !== item.packageMarket || !!packageMarket && sourceMarkets.size > 0 && !sourceMarkets.has(packageMarket);
  const marketSupported = context.requireMarket === false || (requiredMarket !== null && (scope === 'private_package' ? packageMarket === requiredMarket : sourceMarkets.has(requiredMarket)));
  const kinds = new Set(d.sections.map(s => s.kind));
  const drugComplete = d.category !== 'drug' || kinds.has('active') && kinds.has('inactive') && d.sections.filter(s => s.kind === 'active').every(s => s.entries.length > 0 && s.entries.every(e => e.quantity?.parse === 'exact'));
  const complete = d.sections.length > 0 && d.sections.every(s => s.startCovered && s.endCovered && s.lineCoverageComplete && s.entries.length > 0) && d.completenessReasons.length === 0 && d.transcriptionUncertainty.length === 0 && d.sections.every(s => s.entries.every(e => e.uncertaintyReasons.length === 0)) && drugComplete && d.category !== 'unknown';
  const dependencies = [d.declarationId, d.policyId, ...d.dependencyIds, ...d.observationIds];
  const invalidated = [...context.revokedIds ?? [], ...context.deletedIds ?? []].some(id => dependencies.includes(id));
  const fresh = Number.isFinite(Date.parse(now)) && Date.parse(d.observedAt) <= Date.parse(now) && Date.parse(d.expiresAt) > Date.parse(now);
  const permitted = policy?.policyId === d.policyId && policy.retainedFields.includes('ingredients') && policyAllows(policy, 'process', now) && policyAllows(policy, 'retain', now) && policyAllows(policy, scope === 'public' ? 'sharedDisplay' : 'privateDisplay', now);
  const predicate: DeclarationPredicate = {
    association: check(bound && privateBound, bound && privateBound ? [] : ['no_association']),
    noContradiction: check(!conflicts.length && !comparison.contradictions.length && !marketConflict, conflicts.length || comparison.contradictions.length || marketConflict ? ['identity_conflict'] : [], [...d.associationEvidenceIds, ...conflicts]),
    variantMarket: check(!unknownRequired.length && marketSupported, [...unknownRequired.map(k => `variant_unknown:${k}`), ...!marketSupported ? ['market_unknown'] : []]),
    completeness: check(complete, complete ? [] : [...d.completenessReasons, ...d.transcriptionUncertainty, ...!drugComplete ? ['missing_section'] : [], ...d.sections.some(s => !s.startCovered || !s.endCovered || !s.lineCoverageComplete) ? ['unreadable_region'] : [], ...d.category === 'unknown' ? ['category_unknown'] : []], d.observationIds),
    rightsFreshness: check(permitted && fresh && !invalidated, [...!permitted ? ['source_blocked'] : [], ...!fresh || invalidated ? ['expired_evidence'] : []], dependencies),
  };
  const accepted = Object.values(predicate).every(c => c.passed);
  return { accepted, predicate, expiresAt: policy?.expiresAt && Date.parse(policy.expiresAt) < Date.parse(d.expiresAt) ? policy.expiresAt : d.expiresAt, reasons: [...new Set(Object.values(predicate).flatMap(c => c.reasons))], state: accepted ? 'accepted' : !predicate.noContradiction.passed ? 'conflict' : d.transcriptionUncertainty.length ? 'uncertain' : 'partial' };
}
/** Rights are enforced on reads too. A fresh image never refreshes an ingredient section. */
export function filterDisplayProjection(display: DisplayProjection, policies: readonly SourcePolicy[], now: string, offlineStatusCheckedAt: string | null = null): DisplayProjection {
  const policy = (id: string) => policies.find(p => p.policyId === id);
  const fresh = (expiry: string) => Date.parse(expiry) > Date.parse(now);
  const offlineAllowed = offlineStatusCheckedAt === null || Number.isFinite(Date.parse(offlineStatusCheckedAt)) && Date.parse(now) >= Date.parse(offlineStatusCheckedAt) && Date.parse(now) - Date.parse(offlineStatusCheckedAt) < 24 * 60 * 60 * 1000;
  const filterIdentity = (identity: NonNullable<DisplayProjection['selectedIdentity']>) => ({ ...identity, image: identity.image && offlineAllowed && fresh(identity.image.expiresAt) && policyAllows(policy(identity.image.policyId), 'sharedDisplay', now) && (policyAllows(policy(identity.image.policyId), 'hotlink', now) || policyAllows(policy(identity.image.policyId), 'rehost', now)) ? identity.image : null });
  return { ...display, selectedIdentity: display.selectedIdentity && fresh(display.selectedIdentity.expiresAt) ? filterIdentity(display.selectedIdentity) : null, candidates: display.candidates.filter(identity => fresh(identity.expiresAt)).map(filterIdentity), sections: display.sections.filter(s => offlineAllowed && fresh(s.expiresAt) && policyAllows(policy(s.policyId), 'sharedDisplay', now)), sources: display.sources.filter(s => offlineAllowed && fresh(s.expiresAt) && policyAllows(policy(s.policyId), 'sharedDisplay', now)), limitations: [...display.limitations, ...!offlineAllowed ? ['Offline evidence validity expired'] : []] };
}
export function toFactBundle(d: Declaration, item: ItemSnapshot, selection: DeclarationSelection, sources: FactBundleV1['sources'], confirmation: FactBundleV1['packageConfirmation']): FactBundleV1 {
  return FactBundleV1Schema.parse({ schemaVersion: 1, itemId: item.itemId, snapshotId: item.snapshotId, snapshotRevision: item.revision, declarationId: d.declarationId, declarationRevision: d.revision, scope: d.scope, ownerId: d.ownerId, packageConfirmation: confirmation, requestedMarket: item.requestedMarket, sourceMarkets: d.sourceMarkets, packageMarket: d.packageMarket, sections: d.sections, predicate: selection.predicate, state: selection.state, completenessReasons: d.completenessReasons, uncertaintyReasons: d.transcriptionUncertainty, conflictIds: [...new Set([...d.conflictIds, ...item.conflictIds])], observedAt: d.observedAt, expiresAt: selection.expiresAt, sources, parserVersion: d.parserVersion, aliasVersion: d.aliasVersion, dependencyIds: [...new Set([item.snapshotId, d.declarationId, d.policyId, ...d.observationIds, ...d.dependencyIds])] });
}
export function canClaimFullListAbsence(bundle: FactBundleV1, now = new Date().toISOString(), invalidatedIds: readonly string[] = []): boolean { return FactBundleV1Schema.safeParse(bundle).success && bundle.state === 'accepted' && Object.values(bundle.predicate).every(c => c.passed) && bundle.conflictIds.length === 0 && Number.isFinite(Date.parse(now)) && Date.parse(bundle.observedAt) <= Date.parse(now) && Date.parse(bundle.expiresAt) > Date.parse(now) && !invalidatedIds.some(id => bundle.dependencyIds.includes(id)); }
