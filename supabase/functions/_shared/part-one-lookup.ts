import { z } from 'zod';
import { ItemSnapshotSchema, LookupReplySchema, ScanResultSchema, SourceObservationSchema, VariantSchema } from '../../../src/contracts/PartOne.ts';
import type { Code, Declaration, ItemSnapshot, LookupReply, ScanResult, SourceObservation, SourcePolicy } from '../../../src/contracts/PartOne.ts';
import { normalizeBarcode } from '../../../src/domain/part-one/barcode.ts';
import { buildEvidenceAdmissions, EvidenceAdmissionSchema } from '../../../src/domain/part-one/admission.ts';
import type { EvidenceAdmission } from '../../../src/domain/part-one/admission.ts';
import { compareVariant, policyAllows } from '../../../src/domain/part-one/evidence.ts';
import { DECLARATION_ALIAS_VERSION, DECLARATION_PARSER_VERSION, parseDeclarationSection } from '../../../src/domain/part-one/parser.ts';
import { emptyProviderReply, permittedOpenFactsImage, lookupPrimaryProvider, needsUpcIdentityFallback, providerOperationPermitted } from './part-one-providers.ts';
import type { PrimaryProvider, ProviderConfiguration, ProviderLookupRequest, ProviderTransport } from './part-one-providers.ts';

export type PartOneResultPatch = Pick<ScanResult, 'identity' | 'itemId' | 'candidateIds' | 'snapshotId' | 'declarationId' | 'declarationState' | 'scope' | 'packageConfirmation' | 'display' | 'reasonCodes' | 'conflictIds' | 'evidenceIds' | 'allowedActions' | 'freshness'>;
export type LookupPublication = { resultPatch: PartOneResultPatch; work: 'complete' | 'retry_wait' | 'deferred_budget' | 'failed_final'; nextEligibleAt: string | null };
export type LookupCheckpoint = { status: LookupReply['status']; parsedNegative: boolean; reply?: LookupReply; plan?: CompositionPlan; redirectHop?: number; policyVersion?: string; checkedAt?: string; retryAfter?: string | null; redirectResume?: { url: string; redirectIndex: number } };
export type PartOneLookupJob = { id: string; input: Code & { canonicalKey: string; requestedMarket: string | null; categoryHint?: string | null }; checkpoints: Record<string, unknown>; unknownReservations?: readonly unknown[]; attempts?: number; maxAttempts?: number };
export type LookupReservation = { reservationId: string | null; work?: 'deferred_budget' | 'retry_wait'; nextEligibleAt?: string | null };
/** An extractor is enabled only for an independently reviewed source layout. The
 * default does not infer category or complete-panel coverage from ingredients_text. */
export type DeclarationExtraction = { category: Declaration['category']; complete: boolean; uncertaintyReasons: string[] };
export interface PartOneLookupPorts {
  now(): string; uuid(): string; hash(text: string): Promise<string>;
  policies: readonly SourcePolicy[];
  configs: Partial<Record<PrimaryProvider, ProviderConfiguration>>;
  transport?: ProviderTransport;
  readCatalog(job: PartOneLookupJob): Promise<{ resultPatch: PartOneResultPatch; item: ItemSnapshot | null } | null>;
  reserve(stage: string, provider: PrimaryProvider): Promise<LookupReservation>;
  dispatch(reservationId: string): Promise<boolean>;
  checkpoint(stage: string, output: LookupCheckpoint, reservationId: string | null): Promise<void>;
  admit(payload: EvidenceAdmission): Promise<void>;
  publish(publication: LookupPublication): Promise<void>;
  extractDeclaration?(observation: SourceObservation): DeclarationExtraction;
}
const PlanSchema = z.strictObject({ observationId: z.string().uuid(), itemId: z.string().uuid(), snapshotId: z.string().uuid(), declarationId: z.string().uuid(), sectionId: z.string().uuid(), entryIds: z.array(z.string().uuid()), snapshotRevision: z.number().int().positive(), supersedesSnapshotId: z.string().uuid().nullable(), extraction: z.strictObject({ category: z.enum(['cosmetic', 'drug', 'unknown']), complete: z.boolean(), uncertaintyReasons: z.array(z.string()) }) });
type CompositionPlan = z.infer<typeof PlanSchema>;
const PayloadSchema = z.strictObject({ nativeCode: z.string(), canonicalCode: z.string().nullable(), name: z.string().nullable(), rawIngredients: z.string().nullable(), nativeBrand: z.string().nullable().optional(), structuredVariant: VariantSchema.nullable().optional(), imageUrl: z.string().nullable().optional(), sourceQuantity: z.string().nullable().optional() });
const emptyPatch = (reasonCodes: string[] = []): PartOneResultPatch => ({ identity: 'unresolved', itemId: null, candidateIds: [], snapshotId: null, declarationId: null, declarationState: 'none', scope: null, packageConfirmation: 'unconfirmed', display: { resultRevision: 0, selectedIdentity: null, candidates: [], sections: [], sources: [], limitations: [] }, reasonCodes, conflictIds: [], evidenceIds: [], allowedActions: ['scan_ingredients', 'retry', 'rescan'], freshness: { observedAt: null, expiresAt: null, state: 'unknown' } });
const transient = (reply: LookupReply) => reply.status === 'unavailable' || reply.status === 'rate_limited';
// Conservative 24-hour bound applies to identity, partial and accepted material.
// This is also the maximum offline right-status lifetime; future refresh can be sooner.
const expires = (observedAt: string, policy: SourcePolicy) => new Date(Math.min(Date.parse(observedAt) + 86400000, Date.parse(policy.expiresAt!))).toISOString();
function validatePatch(job: PartOneLookupJob, patch: PartOneResultPatch, work: LookupPublication['work']) {
  ScanResultSchema.parse({ ...patch, schemaVersion: 1, requestId: job.id, scanId: job.id, generation: 0, resultRevision: patch.display.resultRevision, work, jobId: job.id, subscriptionId: null, nextCheckAfter: null });
}
function currentCatalog(patch: PartOneResultPatch, ports: PartOneLookupPorts): boolean {
  const now = Date.parse(ports.now());
  if (!['exact', 'candidate', 'ambiguous'].includes(patch.identity)) return false;
  if (patch.display.selectedIdentity && Date.parse(patch.display.selectedIdentity.expiresAt) <= now || patch.display.candidates.some(i => Date.parse(i.expiresAt) <= now)) return false;
  // readCatalog is an authenticated read adapter; also fail closed on every
  // exposed source/image/section policy instead of relying on cache age alone.
  const allowed = (id: string) => policyAllows(ports.policies.find(p => p.policyId === id), 'sharedDisplay', ports.now());
  if (patch.display.sources.some(s => Date.parse(s.expiresAt) <= now || !allowed(s.policyId)) || patch.display.sections.some(s => Date.parse(s.expiresAt) <= now || !allowed(s.policyId))) return false;
  if (patch.declarationState === 'accepted' && (patch.freshness.state !== 'fresh' || !patch.freshness.expiresAt || Date.parse(patch.freshness.expiresAt) <= now)) return false;
  return [...patch.display.candidates, ...patch.display.selectedIdentity ? [patch.display.selectedIdentity] : []].every(i => !i.image || Date.parse(i.image.expiresAt) > now && allowed(i.image.policyId) && ['hotlink', 'rehost'].some(op => policyAllows(ports.policies.find(p => p.policyId === i.image!.policyId), op as 'hotlink' | 'rehost', ports.now())));
}

/** Durable primary path: catalog -> Open Facts -> necessary UPC identity fallback
 * -> derived immutable evidence -> publication. No implicit network transport,
 * no health profile, no uploaded photo and no promotion of private corrections. */
export async function runPartOneLookup(job: PartOneLookupJob, ports: PartOneLookupPorts): Promise<LookupPublication> {
  const normalized = normalizeBarcode(job.input);
  const send = async (patch: PartOneResultPatch, work: LookupPublication['work'], nextEligibleAt: string | null = null) => {
    validatePatch(job, patch, work);
    const right = (id: string) => policyAllows(ports.policies.find(p => p.policyId === id), 'sharedDisplay', ports.now());
    if ([...patch.display.sources, ...patch.display.sections].some(s => Date.parse(s.expiresAt) <= Date.parse(ports.now()) || !right(s.policyId)) || [...patch.display.candidates, ...patch.display.selectedIdentity ? [patch.display.selectedIdentity] : []].some(i => Date.parse(i.expiresAt) <= Date.parse(ports.now()) || i.image && (Date.parse(i.image.expiresAt) <= Date.parse(ports.now()) || !right(i.image.policyId)))) throw new Error('source_policy_changed_before_publication');
    const publication: LookupPublication = { resultPatch: patch, work, nextEligibleAt };
    await ports.publish(publication); return publication;
  };
  if (!normalized.supported || normalized.namespace !== 'gtin' || job.input.canonicalKey !== `gtin:${normalized.canonicalGtin14}`) return send(emptyPatch(['unsupported_namespace']), 'failed_final');
  if (job.unknownReservations?.length) return send(emptyPatch(['unknown_provider_outcome']), (job.attempts ?? 1) >= (job.maxAttempts ?? 3) ? 'failed_final' : 'retry_wait', new Date(Date.parse(ports.now()) + 60000).toISOString());
  const catalog = await ports.readCatalog(job);
  let base = catalog && currentCatalog(catalog.resultPatch, ports) ? catalog.resultPatch : emptyPatch();
  if (base.declarationState === 'accepted' || base.identity === 'ambiguous' || base.identity === 'candidate') return send(base, 'complete');
  const catalogItem = catalog && base === catalog.resultPatch && catalog.item ? ItemSnapshotSchema.parse(catalog.item) : null;
  // A legacy identity-only record can be displayed, but without immutable item
  // bindings no provider formula is attached to it.
  if (base.identity === 'exact' && !catalogItem) return send({ ...base, reasonCodes: [...base.reasonCodes, 'catalog_binding_unavailable'] }, 'complete');
  const attempt = Math.max(1, job.attempts ?? 1);
  const budget: { current: LookupReservation | null } = { current: null };
  const policyFor = (provider: PrimaryProvider) => ports.policies.find(p => p.provider === provider);
  const lookup = async (provider: PrimaryProvider): Promise<LookupReply> => {
    const policy = policyFor(provider);
    const fields: Array<'identity' | 'ingredients'> = provider === 'open_facts' && policy?.retainedFields.includes('ingredients') ? ['identity', 'ingredients'] : ['identity'];
    if (!providerOperationPermitted(provider, policy, fields, ports.now())) return emptyProviderReply(provider, 'disallowed_by_source_policy', policy?.version);
    // Terminal response checkpoints survive attempts; transient failures do not
    // become negative-cache entries or suppress a bounded retry.
    for (const [stage, raw] of Object.entries(job.checkpoints).reverse()) {
      if (!stage.startsWith(`lookup.${provider}.`) || stage.includes('.redirect.')) continue;
      const checkpoint = raw as LookupCheckpoint;
      const parsed = LookupReplySchema.safeParse(checkpoint.reply);
      if (parsed.success && parsed.data.provider === provider && parsed.data.policyVersion === policy!.version) {
        if (!transient(parsed.data) && (parsed.data.status !== 'not_found' || checkpoint.checkedAt && Date.parse(checkpoint.checkedAt) + 6 * 3600000 > Date.parse(ports.now()))) return parsed.data;
        if (parsed.data.retryAfter && Date.parse(parsed.data.retryAfter) > Date.parse(ports.now())) return parsed.data;
      }
    }
    const stage = `lookup.${provider}.${attempt}`;
    // Configuration checks precede any quota reservation.
    if (!ports.configs[provider] || !ports.transport?.pinsResolvedAddresses) return emptyProviderReply(provider, 'configuration_required', policy!.version);
    const reservation = await ports.reserve(stage, provider);
    if (!reservation.reservationId) { budget.current = reservation; return emptyProviderReply(provider, 'rate_limited', policy!.version, reservation.nextEligibleAt ?? null); }
    const request: ProviderLookupRequest = { canonicalCode: normalized.canonicalCode!, originalCode: normalized.raw, symbology: normalized.symbology, nativeCode: normalized.nativeCode!, requestedMarket: job.input.requestedMarket, categoryHint: null, requestedFields: fields, jobId: job.id, stageId: ports.uuid(), reservationId: reservation.reservationId, deadlineAt: new Date(Date.parse(ports.now()) + 8000).toISOString() };
    const redirectReservations: Array<{ stage: string; id: string; hop: number }> = [];
    let resume: { url: string; redirectIndex: number } | undefined;
    for (const [key, raw] of Object.entries(job.checkpoints)) {
      const cp = raw as LookupCheckpoint;
      if (key.startsWith(`lookup.${provider}.`) && cp.redirectResume && cp.policyVersion === policy!.version && cp.checkedAt && Date.parse(cp.checkedAt) + 86400000 > Date.parse(ports.now())) resume = cp.redirectResume;
    }
    const firstHop = resume?.redirectIndex ?? 0;
    let currentReservation = reservation.reservationId;
    const settled = new Set<string>();
    let persistenceFailure: unknown;
    let unknownOutcome = false;
    const reply = await lookupPrimaryProvider(provider, request, policy, ports.configs[provider], ports.transport, { now: ports.now, hash: ports.hash, observationId: ports.uuid(), resume, afterRedirect: async (url, redirectIndex) => {
      const responseStage = `${stage}.redirect_response.${redirectIndex}`;
      const output: LookupCheckpoint = { status: 'found', parsedNegative: false, policyVersion: policy!.version, checkedAt: ports.now(), redirectResume: { url, redirectIndex } };
      await ports.checkpoint(responseStage, output, currentReservation);
      job.checkpoints[responseStage] = output;
      if (currentReservation) settled.add(currentReservation);
    }, onUnknownDispatch: () => { unknownOutcome = true; }, beforeRequest: async (_url, hop) => {
      try {
        if (hop === firstHop) return await ports.dispatch(reservation.reservationId!);
        const hopStage = `${stage}.redirect.${hop}`, r = await ports.reserve(hopStage, provider);
        if (!r.reservationId) { budget.current = r; return false; }
        const dispatched = await ports.dispatch(r.reservationId);
        if (dispatched) { redirectReservations.push({ stage: hopStage, id: r.reservationId, hop }); currentReservation = r.reservationId; }
        return dispatched;
      } catch (error) { persistenceFailure = error; throw error; }
    } });
    if (persistenceFailure !== undefined) throw persistenceFailure;
    // Once any request was dispatched, its outcome is durably checkpointed before
    // returning or publishing. A lost checkpoint leaves an unknown reservation.
    for (const hop of redirectReservations.filter(hop => !settled.has(hop.id))) await ports.checkpoint(hop.stage, { status: reply.status, parsedNegative: reply.status === 'not_found', retryAfter: reply.retryAfter, redirectHop: hop.hop, policyVersion: policy!.version }, unknownOutcome ? null : hop.id);
    const checkpoint = { status: reply.status, parsedNegative: reply.status === 'not_found', checkedAt: ports.now(), retryAfter: reply.retryAfter, reply };
    await ports.checkpoint(stage, checkpoint, unknownOutcome || settled.has(reservation.reservationId) ? null : reservation.reservationId);
    job.checkpoints[stage] = checkpoint;
    return reply;
  };
  const open = await lookup('open_facts');
  const usable = (reply: LookupReply) => reply.observations.filter(o => o.comparison === 'exact' && o.status === 'active' && PayloadSchema.parse(o.payload).name?.trim());
  let reply = open;
  let observations = usable(open);
  if (!catalogItem && base.identity !== 'exact' && (observations.length !== 1 || open.status === 'ambiguous') && needsUpcIdentityFallback(base.identity, open)) {
    reply = await lookup('upcitemdb'); observations = usable(reply);
  }
  // Multiple possible records require deliberate selection. They are not fused
  // into a guessed identity; adapter observations remain in durable checkpoints.
  if (observations.length !== 1 || reply.status === 'ambiguous') {
    const contradictions = reply.observations.filter(o => o.comparison === 'contradiction');
    if (catalogItem && contradictions.length) base = { ...base, declarationId: null, declarationState: 'conflict', conflictIds: contradictions.map(o => o.observationId), display: { ...base.display, sections: [] }, allowedActions: ['scan_ingredients', 'save_partial', 'rescan'] };
    const reasons = [...base.reasonCodes, reply.status === 'disallowed_by_source_policy' ? open.status === 'not_found' ? 'provider:not_found' : 'source_blocked' : `provider:${reply.status}`];
    if (reply.observations.some(o => o.comparison === 'contradiction')) reasons.push('identity_conflict');
    if (budget.current) return send({ ...base, reasonCodes: reasons }, budget.current.work ?? 'deferred_budget', budget.current.nextEligibleAt ?? null);
    const retry = transient(reply) ? reply : transient(open) ? open : null;
    if (retry) return send({ ...base, reasonCodes: [...reasons, `provider:${retry.status}`] }, attempt >= (job.maxAttempts ?? 3) ? 'failed_final' : 'retry_wait', retry.retryAfter ?? new Date(Date.parse(ports.now()) + 60000).toISOString());
    return send({ ...base, reasonCodes: reasons }, 'complete');
  }
  const observation = SourceObservationSchema.parse(observations[0]), policy = policyFor(reply.provider as PrimaryProvider)!;
  if (!providerOperationPermitted(reply.provider as PrimaryProvider, policy, ['identity'], ports.now())) return send({ ...base, reasonCodes: ['source_blocked'] }, 'complete');
  const payload = PayloadSchema.parse(observation.payload);
  const returned = normalizeBarcode({ raw: payload.nativeCode, symbology: payload.nativeCode.length === 8 ? 'ean8' : null, namespace: 'gtin', retailerId: null });
  if (!returned.supported || returned.canonicalCode !== normalized.canonicalCode || payload.canonicalCode !== returned.canonicalCode) return send({ ...base, reasonCodes: ['identity_conflict'] }, 'complete');
  if (observation.policyId !== policy.policyId || observation.policyVersion !== policy.version || Date.parse(observation.fetchedAt) > Date.parse(ports.now()) || Date.parse(expires(observation.fetchedAt, policy)) <= Date.parse(ports.now())) return send({ ...base, reasonCodes: ['expired_evidence'] }, 'complete');
  const contradictions = catalogItem ? compareVariant(catalogItem.variant, observation.variant).contradictions : [];
  if (contradictions.length || catalogItem?.conflictIds.length) return send({ ...base, declarationState: 'conflict', declarationId: null, conflictIds: [observation.observationId], reasonCodes: ['identity_conflict'], allowedActions: ['scan_ingredients', 'rescan', 'save_partial'] }, 'complete');
  const compositionStage = `composition.${observation.observationId}`;
  let plan: CompositionPlan;
  const stored = job.checkpoints[compositionStage] as LookupCheckpoint | undefined;
  if (stored?.plan) plan = PlanSchema.parse(stored.plan);
  else {
    const rawText = payload.rawIngredients ?? '';
    const entryCount = parseDeclarationSection({ sectionId: ports.uuid(), observationId: observation.observationId, imageId: null, sourceRevision: 1, rawText, sourceOffset: 0, kind: 'ingredients', startCovered: false, endCovered: false, lineCoverageComplete: false, entryId: () => ports.uuid() }).entries.length;
    plan = PlanSchema.parse({ observationId: observation.observationId, itemId: catalogItem?.itemId ?? ports.uuid(), snapshotId: ports.uuid(), declarationId: ports.uuid(), sectionId: ports.uuid(), entryIds: Array.from({ length: entryCount }, () => ports.uuid()), snapshotRevision: catalogItem ? catalogItem.revision + 1 : 1, supersedesSnapshotId: catalogItem?.snapshotId ?? null, extraction: reply.provider === 'open_facts' && payload.rawIngredients !== null ? ports.extractDeclaration?.(observation) ?? { category: 'unknown', complete: false, uncertaintyReasons: [] } : { category: 'unknown', complete: false, uncertaintyReasons: [] } });
    await ports.checkpoint(compositionStage, { status: 'found', parsedNegative: false, plan }, null);
    job.checkpoints[compositionStage] = { status: 'found', parsedNegative: false, plan };
  }
  if (plan.observationId !== observation.observationId || plan.itemId !== (catalogItem?.itemId ?? plan.itemId)) throw new Error('composition_binding_mismatch');
  const expiry = expires(observation.fetchedAt, policy);
  const item: ItemSnapshot = ItemSnapshotSchema.parse({ snapshotId: plan.snapshotId, itemId: plan.itemId, revision: plan.snapshotRevision, name: catalogItem?.name ?? payload.name!, variant: catalogItem?.variant ?? observation.variant, fieldEvidence: { ...catalogItem?.fieldEvidence, name: catalogItem?.fieldEvidence.name ?? [observation.observationId], variant: catalogItem?.fieldEvidence.variant ?? [observation.observationId] }, barcodeAssertions: [{ raw: payload.nativeCode, symbology: payload.nativeCode.length === 8 ? 'ean8' : null, namespace: 'gtin', canonical: payload.canonicalCode, evidenceId: observation.observationId }], requestedMarket: job.input.requestedMarket, sourceMarkets: observation.sourceMarkets, packageMarket: null, declarationIds: [], conflictIds: [], scope: 'public', supersedesId: plan.supersedesSnapshotId });
  const imageUrl = reply.provider === 'open_facts' ? permittedOpenFactsImage(payload.imageUrl ?? null, payload.nativeCode, policy, ports.now()) : null;
  const image = imageUrl ? { url: imageUrl, policyId: policy.policyId, evidenceId: observation.observationId, observedAt: observation.fetchedAt, expiresAt: expiry, sourceRevision: 1 } : null;
  const identityDisplay = { id: item.itemId, name: item.name, brand: item.variant.brand, variantText: [item.variant.form, item.variant.scent, item.variant.size && item.variant.unit ? `${item.variant.size} ${item.variant.unit}` : null, item.variant.packCount ? `${item.variant.packCount} pack` : null, payload.sourceQuantity].filter(Boolean).join(' · '), expiresAt: expiry, image };
  const sources = [{ observationId: observation.observationId, policyId: policy.policyId, label: policy.attribution ?? policy.provider, url: observation.sourceUrl, observedAt: observation.fetchedAt, sourceUpdatedAt: observation.sourceUpdatedAt, expiresAt: expiry }];
  let patch: PartOneResultPatch = { ...emptyPatch(), identity: 'exact', itemId: item.itemId, snapshotId: item.snapshotId, scope: 'public', display: { resultRevision: 0, selectedIdentity: identityDisplay, candidates: [], sections: [], sources, limitations: ['Catalog identity does not prove a timeless formula'] }, evidenceIds: [observation.observationId], allowedActions: ['scan_ingredients', 'add_photo', 'save_partial', 'rescan', 'view_source'], freshness: { observedAt: observation.fetchedAt, expiresAt: expiry, state: 'fresh' } };
  let admissions: readonly EvidenceAdmission[];
  if (reply.provider === 'open_facts' && payload.rawIngredients?.length && policy.retainedFields.includes('ingredients')) {
    const rawText = payload.rawIngredients;
    const section = parseDeclarationSection({ sectionId: plan.sectionId, observationId: observation.observationId, imageId: null, sourceRevision: 1, rawText, sourceOffset: 0, kind: 'ingredients', startCovered: plan.extraction.complete, endCovered: plan.extraction.complete, lineCoverageComplete: plan.extraction.complete, entryId: i => plan.entryIds[i], uncertaintyReasons: plan.extraction.uncertaintyReasons });
    const d: Declaration = { declarationId: plan.declarationId, revision: 1, itemId: item.itemId, snapshotId: item.snapshotId, observationIds: [observation.observationId], dependencyIds: [observation.observationId], rawText, textStructureHash: await ports.hash(JSON.stringify(section)), sections: [section], category: plan.extraction.category, completenessReasons: plan.extraction.complete ? [] : ['full_panel_not_established'], transcriptionUncertainty: plan.extraction.uncertaintyReasons, parserVersion: DECLARATION_PARSER_VERSION, aliasVersion: DECLARATION_ALIAS_VERSION, sourceRevision: 1, sourceUpdatedAt: observation.sourceUpdatedAt, observedAt: observation.fetchedAt, expiresAt: expiry, policyId: policy.policyId, scope: 'public', ownerId: null, packageObservationId: null, associationEvidenceIds: [observation.observationId], variant: observation.variant, sourceMarkets: observation.sourceMarkets, packageMarket: null, conflictIds: [], supersedesId: null, formulaEquivalence: 'unknown' };
    const evaluated = buildEvidenceAdmissions(observation, item, d, policy, ports.now(), { databasePolicy: { databasePolicyId: policy.provider, sourcePolicyId: policy.policyId, policyVersion: policy.version } });
    admissions = evaluated.admissions;
    const record = evaluated.admissions[1].payload;
    patch = { ...patch, declarationId: d.declarationId, declarationState: evaluated.selection.state, reasonCodes: evaluated.selection.reasons, display: { ...patch.display, sections: record.sections as ScanResult['display']['sections'] }, allowedActions: evaluated.selection.accepted ? ['save', 'scan_ingredients', 'view_source', 'rescan'] : patch.allowedActions };
  } else {
    // UPC fallback is identity-only even if an unrequested payload contains an
    // ingredient field. Never combine one source's identity with another's list.
    const common = { itemId: item.itemId, canonicalKey: job.input.canonicalKey, policyId: policy.provider, policyVersion: policy.version, scope: 'public' as const, expiresAt: expiry, observedAt: observation.fetchedAt };
    admissions = [EvidenceAdmissionSchema.parse({ ...common, id: observation.observationId, kind: 'observation', revision: 1, dependencies: observation.dependencyIds, supersedesId: null, payload: { ...observation } }), EvidenceAdmissionSchema.parse({ ...common, id: item.snapshotId, kind: 'snapshot', revision: item.revision, dependencies: [observation.observationId, ...Object.values(item.fieldEvidence).flat()], supersedesId: item.supersedesId, payload: { ...item, brand: item.variant.brand, variantText: identityDisplay.variantText, image: null } })];
    patch.reasonCodes = ['ingredients_missing'];
  }
  // The immutable snapshot retains exactly the permitted photo binding, independently of formula readiness.
  admissions = admissions.map(admission => admission.kind === 'snapshot' ? EvidenceAdmissionSchema.parse({ ...admission, payload: { ...admission.payload, variantText: identityDisplay.variantText, image } }) : admission);
  // RPC enforces policy version/dependencies again at ingestion and publication.
  // Persistence errors are never acknowledged as completed provider work.
  for (const admission of admissions) {
    if (!providerOperationPermitted(reply.provider as PrimaryProvider, policyFor(reply.provider as PrimaryProvider), admission.kind === 'declaration' ? ['identity', 'ingredients'] : ['identity'], ports.now())) throw new Error('source_policy_changed_before_admission');
    await ports.admit(admission);
  }
  return send(patch, 'complete');
}
