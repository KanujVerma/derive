import { hasVerifiedPackageFormula } from '../../contracts/ProductTruthSnapshot.ts';
import type { DecisionTruthRef } from '../../contracts/PersonalDecisionService.ts';
import { projectTrustedSnapshot } from './truthAdapter.ts';
import { describePersonalDecision } from './result.ts';
import type { PersonalContextRequest, PersonalContextSnapshot, PersonalContextWriteResult, PersonalExperiencePage } from '../../contracts/PersonalContext.ts';
import type { DecisionBinding, PersonalDecisionPacketV1 } from '../../contracts/PersonalDecision.ts';
import type { ProductTruthSnapshotV1 } from '../../contracts/ProductTruthSnapshot.ts';
export type CustomerWrite = { operation: 'save_profile'; profile: Extract<PersonalContextRequest, { operation: 'save_profile' }>['profile'] }
  | { operation: 'save_routine'; routine: Extract<PersonalContextRequest, { operation: 'save_routine' }>['routine'] }
  | { operation: 'append_experience'; experience: Extract<PersonalContextRequest, { operation: 'append_experience' }>['experience']; supersedesRevisionId: string | null };
export type CustomerDecision = { kind: 'idle' | 'loading' } | { kind: 'unavailable'; reason: string } | { kind: 'ready'; packet: PersonalDecisionPacketV1; expectedBinding: DecisionBinding; truthRef: DecisionTruthRef; contextRevision: number };
export interface CustomerGateway {
  load(ownerId: string): Promise<PersonalContextSnapshot>;
  write(ownerId: string, request: Exclude<PersonalContextRequest, { operation: 'get_context' | 'get_revision' | 'get_experiences' }>): Promise<PersonalContextWriteResult>;
  history?(ownerId: string, request: { operation: 'get_experiences'; atRevision: number; limit: number; cursor?: string }): Promise<PersonalExperiencePage>;
  evaluate(ownerId: string, request: { operation: 'evaluate'; requestId: string; caseId: string; snapshotId: string }): Promise<{ kind: 'unavailable'; reason: string } | { kind: 'ready'; assessmentId: string; ownerId: string; contextRevision: number; snapshotRef: { caseId: string; snapshotId: string }; packet: PersonalDecisionPacketV1; expectedBinding: DecisionBinding; runtime: 'authoritative' | 'local_fixture'; truthRef: { caseId: string; snapshotId: string; caseRevision: number; resolverVersion: string; sourceBoundaryRevision: string; categoryBoundaryRevision: string | null } }>;
}
export interface CustomerState { originReference: { kind: 'catalog'; label: string; productId: string; variantId: string | null; formulaVersionId: string | null } | null; ownerId: string | null; context: PersonalContextSnapshot | null; status: 'idle' | 'loading' | 'ready' | 'saving' | 'error'; error: string | null; decision: CustomerDecision }
/** Host-owned authenticated controller. No persistent client context or snapshot promotion. */
export class CustomerController {
  private state: CustomerState = { originReference: null, ownerId: null, context: null, status: 'idle', error: null, decision: { kind: 'idle' } };
  private generation = 0; private loadSequence = 0; private evaluationSequence = 0;
  private listeners = new Set<() => void>();
  private historyCursor: string | null | undefined = undefined;
  private pendingAssessment: { key: string; request: Parameters<CustomerGateway['evaluate']>[1] } | null = null;
  private writingGeneration: number | null = null;
  private pending: { key: string; request: Parameters<CustomerGateway['write']>[1] } | null = null;
  private gateway: CustomerGateway; private createId: () => string;
  constructor(gateway: CustomerGateway, createId: () => string) { this.gateway = gateway; this.createId = createId; }
  getState = (): CustomerState => this.state;
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(patch: Partial<CustomerState>) { this.state = { ...this.state, ...patch }; this.listeners.forEach(listener => listener()); }
  setOwner(ownerId: string | null) { if (ownerId === this.state.ownerId) return; this.generation++; this.pending = null; this.pendingAssessment = null; this.historyCursor = undefined; this.publish({ originReference: null, ownerId, context: null, status: 'idle', error: null, decision: { kind: 'idle' } }); }
  setOriginSnapshot(ownerId: string | null, snapshot: ProductTruthSnapshotV1 | null) {
    const refs = snapshot?.catalogReferences;
    this.publish({ originReference: ownerId && this.state.ownerId === ownerId && refs?.productId && snapshot?.product ? { kind: 'catalog', label: [snapshot.product.brand, snapshot.product.name].filter(Boolean).join(' '), productId: refs.productId, variantId: refs.variantId, formulaVersionId: refs.formulaVersionId } : null });
  }
  async load(): Promise<boolean> {
    const owner = this.state.ownerId, generation = this.generation, sequence = ++this.loadSequence;
    if (!owner) return false;
    this.publish({ status: 'loading', error: null, decision: { kind: 'idle' } });
    try { const context = await this.gateway.load(owner); if (generation !== this.generation || sequence !== this.loadSequence) return false; if (context.ownerId !== owner || context.profile && context.profile.ownerId !== owner || context.routine && context.routine.ownerId !== owner || context.experiences.some(item => item.ownerId !== owner)) throw new Error('OWNER_MISMATCH'); this.historyCursor = context.historyTruncated ? undefined : null; this.publish({ context, status: 'ready' }); return true; }
    catch { if (generation === this.generation && sequence === this.loadSequence) this.publish({ context: null, status: 'error', error: 'Your context could not be loaded. Please try again.' }); return false; }
  }
  async loadMoreHistory(): Promise<boolean> {
    const owner = this.state.ownerId, context = this.state.context, generation = this.generation;
    if (!owner || !context || !this.gateway.history || this.historyCursor === null || this.state.status === 'loading' || this.state.status === 'saving') return false;
    this.publish({ status: 'loading', error: null });
    try { const page = await this.gateway.history(owner, { operation: 'get_experiences', atRevision: context.revision, limit: 50, ...(this.historyCursor ? { cursor: this.historyCursor } : {}) });
      if (generation !== this.generation || this.state.context?.revision !== context.revision) return false;
      if (page.atRevision !== context.revision || page.items.some(item => item.ownerId !== owner)) throw new Error('STALE_HISTORY');
      const records = new Map(context.experiences.map(item => [item.data.id, item])); page.items.forEach(item => records.set(item.data.id, item)); this.historyCursor = page.nextCursor;
      this.publish({ context: { ...context, experiences: [...records.values()], historyTruncated: Boolean(page.nextCursor) }, status: 'ready' }); return true;
    } catch { if (generation === this.generation) this.publish({ status: 'error', error: 'More history could not be loaded. Please try again.' }); return false; }
  }
  async save(input: CustomerWrite): Promise<boolean> {
    const owner = this.state.ownerId, context = this.state.context, generation = this.generation;
    if (!owner || !context || context.ownerId !== owner || context.profile && context.profile.ownerId !== owner || context.routine && context.routine.ownerId !== owner || context.experiences.some(item => item.ownerId !== owner) || this.writingGeneration === generation) return false;
    this.writingGeneration = generation;
    const key = JSON.stringify(input);
    if (!this.pending || this.pending.key !== key) this.pending = { key, request: { ...JSON.parse(key), requestId: this.createId(), baseRevision: context.revision } };
    const request = this.pending.request;
    this.publish({ status: 'saving', error: null, decision: { kind: 'idle' } });
    try { const result = await this.gateway.write(owner, request); if (generation !== this.generation) return false; if (result.revision.ownerId !== owner) throw new Error('OWNER_MISMATCH'); this.pending = null; await this.load(); return generation === this.generation; }
    catch (error) { if (generation !== this.generation) return false; const code = (error as { code?: string }).code;
      if (code === 'REVISION_CONFLICT' || code === 'CONTEXT_REVISION_CONFLICT' || code === 'STALE_CONTEXT' || code === 'IDEMPOTENCY_CONFLICT' || code === 'EXPERIENCE_CORRECTION_CONFLICT') { this.pending = null; await this.load(); if (generation === this.generation) this.publish({ error: 'Your context changed elsewhere. The latest version is loaded; review it before trying again.' }); }
      else this.publish({ status: 'error', error: 'That change was not confirmed. Try again to retry the same request.' });
      return false;
    } finally { if (this.writingGeneration === generation) this.writingGeneration = null; }
  }
  async assess(snapshot: ProductTruthSnapshotV1 | null): Promise<void> {
    const owner = this.state.ownerId, context = this.state.context, generation = this.generation, sequence = ++this.evaluationSequence;
    if (!owner || !context || context.ownerId !== owner || context.profile && context.profile.ownerId !== owner || context.routine && context.routine.ownerId !== owner || context.experiences.some(item => item.ownerId !== owner) || !snapshot) { this.publish({ decision: { kind: 'unavailable', reason: 'Authoritative product evidence is not available. Product facts remain useful.' } }); return; }
    const key = JSON.stringify([owner, context.revision, snapshot.resolutionCaseId, snapshot.snapshotId]);
    if (!this.pendingAssessment || this.pendingAssessment.key !== key) this.pendingAssessment = { key, request: { operation: 'evaluate', requestId: this.createId(), caseId: snapshot.resolutionCaseId, snapshotId: snapshot.snapshotId } };
    const request = this.pendingAssessment.request;
    this.publish({ decision: { kind: 'loading' } });
    try { const result = await this.gateway.evaluate(owner, request);
      if (generation !== this.generation || sequence !== this.evaluationSequence || this.state.context?.revision !== context.revision) return;
      if (result.kind !== 'ready') { this.publish({ decision: result }); return; }
      const binding = result.expectedBinding, truth = result.truthRef;
      const projected = projectTrustedSnapshot({ snapshot });
      const identity = projected.identity.state === 'known' ? projected.identity.value : null;
      const formula = projected.formula.state === 'known' ? projected.formula.value : null;
      const boundary = `p0a/v1:${snapshot.resolverVersion}` + (truth.categoryBoundaryRevision ? `:category:${truth.categoryBoundaryRevision}` : '');
      // Independent server-loaded source binding is checked against the live owner/context and originating immutable envelope.
      if (truth.caseId !== snapshot.resolutionCaseId || truth.snapshotId !== snapshot.snapshotId || truth.caseRevision !== snapshot.caseRevision || truth.resolverVersion !== snapshot.resolverVersion || truth.sourceBoundaryRevision !== boundary || binding.sourceBoundaryRevision !== boundary || binding.productSnapshotRevision !== String(snapshot.caseRevision)
        || result.runtime !== 'authoritative' || result.ownerId !== owner || result.contextRevision !== context.revision || result.snapshotRef.caseId !== snapshot.resolutionCaseId || result.snapshotRef.snapshotId !== snapshot.snapshotId
        || binding.ownerId !== owner || binding.productSnapshotId !== snapshot.snapshotId || binding.profileRevision !== (context.profile?.id ?? null) || binding.routineRevision !== (context.routine?.id ?? null) || binding.historyRevision !== context.historyRevision
        || binding.productId !== (identity?.productId ?? null) || binding.variantId !== (identity?.variantId ?? null) || binding.formulaVersionId !== (formula?.formulaVersionId ?? null)) throw new Error('STALE_DECISION');
      if (result.packet.id !== request.requestId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(result.assessmentId)) throw new Error('ASSESSMENT_MISMATCH');
      if (describePersonalDecision(result.packet, binding).kind !== 'ready') throw new Error('INVALID_PACKET');
      this.pendingAssessment = null;
      this.publish({ decision: { kind: 'ready', packet: result.packet, expectedBinding: { ...binding }, truthRef: { ...truth }, contextRevision: result.contextRevision } });
    } catch { if (generation === this.generation && sequence === this.evaluationSequence) this.publish({ decision: { kind: 'unavailable', reason: 'A current personal decision is unavailable. Product facts remain useful.' } }); }
  }
}

/** A synchronous render gate prevents a previous product's decision flashing under a new heading. */
export function selectVisibleCustomerDecision(state: CustomerState, ownerId: string | null, snapshot: ProductTruthSnapshotV1 | null): Extract<CustomerDecision, { kind: 'ready' }> | null {
  if (!ownerId || !snapshot || state.ownerId !== ownerId || state.context?.ownerId !== ownerId || state.decision.kind !== 'ready') return null;
  const decision = state.decision, binding = decision.expectedBinding, truth = decision.truthRef;
  const projected = projectTrustedSnapshot({ snapshot });
  const identity = projected.identity.state === 'known' ? projected.identity.value : null;
  const formula = projected.formula.state === 'known' ? projected.formula.value : null;
  const boundary = `p0a/v1:${snapshot.resolverVersion}` + (truth.categoryBoundaryRevision ? `:category:${truth.categoryBoundaryRevision}` : '');
  if (decision.contextRevision !== state.context.revision || binding.ownerId !== ownerId || binding.productSnapshotId !== snapshot.snapshotId || binding.productSnapshotRevision !== String(snapshot.caseRevision) || binding.sourceBoundaryRevision !== boundary || truth.sourceBoundaryRevision !== boundary
    || truth.snapshotId !== snapshot.snapshotId || truth.caseId !== snapshot.resolutionCaseId || truth.caseRevision !== snapshot.caseRevision || truth.resolverVersion !== snapshot.resolverVersion
    || binding.profileRevision !== (state.context.profile?.id ?? null) || binding.routineRevision !== (state.context.routine?.id ?? null) || binding.historyRevision !== state.context.historyRevision
    || binding.productId !== (identity?.productId ?? null) || binding.variantId !== (identity?.variantId ?? null) || binding.formulaVersionId !== (formula?.formulaVersionId ?? null)) return null;
  return decision;
}

export interface CustomerCheckFacts { brand: string; name: string; categoryLabel: string; formula: { ingredients: string[]; provenanceType: string; observedAt: string } | null; source: string | null }
/** Personal results show the originating immutable facts, even if the live catalog has changed. */
export function selectCustomerCheckFacts(snapshot: ProductTruthSnapshotV1 | null, catalog: CustomerCheckFacts): CustomerCheckFacts {
  if (!snapshot) return catalog;
  const formula = hasVerifiedPackageFormula(snapshot) ? snapshot.formula : null;
  return { brand: snapshot.product?.brand ?? 'Unconfirmed identity', name: snapshot.product?.name ?? 'Product identity needs confirmation', categoryLabel: 'Product formula evidence', formula: formula ? { ingredients: [...formula.ingredients], provenanceType: formula.provenanceType, observedAt: formula.observedAt } : null, source: formula?.publicSourceUrl ?? null };
}
