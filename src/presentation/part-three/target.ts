import { resolveCurrentComparator } from '../../domain/part-four/comparison.ts';
import { partFourBindingRelease } from '../../domain/part-four/release.ts';
import type { PersonalContextV2 } from '../../contracts/PersonalContextV2.ts';
import type { NormalizationResult } from '../../contracts/PartTwo.ts';
import type { DecisionBindingV2 } from '../../contracts/PersonalResultV2.ts';
import type { PartThreeEvaluateRequest, CandidateIdentity } from '../../contracts/PartThreeService.ts';
import { PART_THREE_RELEASE, PART_THREE_RELEASE_HASH } from '../../domain/part-three/release.ts';
export type PartThreeChoices = Pick<PartThreeEvaluateRequest, 'intent' | 'comparatorId' | 'candidateRoutineItemId' | 'selectedManualReportIds' | 'use'>;
export const emptyPartThreeChoices = (): PartThreeChoices => ({ intent: 'unanswered', comparatorId: null, candidateRoutineItemId: null, selectedManualReportIds: [], use: { purpose: null, site: null, useForm: null } });
export interface PartThreeTarget {
    request: Omit<PartThreeEvaluateRequest, 'operation' | 'requestId'>;
    binding: Omit<DecisionBindingV2, 'attemptId'>;
}
export function partThreeTarget(c: PersonalContextV2, p: NormalizationResult, session: {
    ownerId: string;
    accountGeneration: number;
    encounterId: string;
    generation: number;
}, choices: PartThreeChoices, savedAssessmentId: string | null = null, identity: CandidateIdentity | null = null, partFourEnabled = false): PartThreeTarget | null {
    if (p.state !== 'ready' || c.ownerId !== session.ownerId || p.authenticatedOwnerId !== session.ownerId)
        return null;
    const s = p.output.reading, d = p.output.kind === 'bound' ? p.output.productFacts.binding : null;
    const subject: DecisionBindingV2['subject'] = d?.kind === 'declaration' ? { kind: 'declaration', itemId: d.itemId, snapshotId: d.snapshotId, declarationId: d.declarationId, declarationRevision: d.declarationRevision, productId: identity?.catalogReference?.productId ?? null, variantId: identity?.catalogReference?.variantId ?? null, formulaVersionId: identity?.catalogReference?.formulaVersionId ?? null, packageScope: d.packageConfirmation === 'unconfirmed' ? 'published_version' : 'confirmed_package' } : { kind: 'source_reading', captureSessionId: p.captureSessionId!, observationId: s.dependencyManifest.sourceRefs[0].observationId };
    // Request preserves the user's choice; binding pins the deterministic
    // evaluated selection, independently recomputed from live context server-side.
    const comparatorId = partFourEnabled ? resolveCurrentComparator({routine:c.routine?.data??null,requestedUse:choices.use,candidateRoutineItemId:choices.candidateRoutineItemId,selectedComparatorId:choices.comparatorId,candidateReference:identity?.catalogReference?{kind:'catalog',...identity.catalogReference}:null}).comparatorId : choices.comparatorId;
    const refs = (rows: {
        id: string;
    }[]) => [...new Set(rows.map(r => r.id))];
    return { request: { encounterId: session.encounterId, accountGeneration: session.accountGeneration, generation: session.generation, scanId: p.scanId, captureSessionId: p.captureSessionId, expectedPartOneGeneration: p.generation, expectedPartOneRevision: p.evidenceRevision, ...choices, savedAssessmentId }, binding: { ...session, encounterInputs: { candidateRoutineItemId: choices.candidateRoutineItemId, selectedManualReportIds: choices.selectedManualReportIds, use: choices.use }, intent: choices.intent, comparatorId, subject, scanId: p.scanId, captureSessionId: p.captureSessionId, partOneGeneration: p.generation, partOneRevision: p.evidenceRevision, partTwoRevision: p.resultRevision, partTwoBindingKey: p.bindingKey, sourceDigest: s.dependencyManifest.dependencyDigest, fieldPermissionEpoch: s.dependencyManifest.policyEpoch, deletionEpoch: s.dependencyManifest.deletionEpoch, policyEpoch: s.dependencyManifest.policyEpoch, dictionaryEpoch: s.dependencyManifest.dictionaryEpoch, contextRevision: c.revision, profileRevision: c.profile?.id ?? null, routineRevision: c.routine?.id ?? null, historyRevision: c.historyRevision, assessmentRevisions: refs(c.assessments), preferenceRevisions: refs(c.preferences), noteRevisions: refs(c.notes), overlayRevision: null, releases: { releaseHash: PART_THREE_RELEASE_HASH, rule: PART_THREE_RELEASE.rule, evidence: PART_THREE_RELEASE.evidence, question: PART_THREE_RELEASE.question, template: PART_THREE_RELEASE.template, policy: PART_THREE_RELEASE.policy, dictionary: s.versions.dictionary, locale: 'en', ...(partFourEnabled?{partFour:partFourBindingRelease()}:{}) }, refinement: null } };
}
