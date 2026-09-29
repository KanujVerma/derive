import type { CheckIntent, DecisionBinding, PersonalDecisionPacketV1 } from './PersonalDecision.ts';
/** Omitted intent is unanswered, irrespective of stored profile intent. */
export interface PersonalDecisionRequest { operation:'evaluate'; requestId:string; caseId:string; snapshotId:string; checkIntent?: CheckIntent }
export interface DecisionTruthRef {caseId:string;snapshotId:string;caseRevision:number;resolverVersion:string;sourceBoundaryRevision:string;categoryBoundaryRevision:string|null}
export interface PersonalDecisionResponse {
 kind:'ready'; assessmentId:string; ownerId:string; contextRevision:number;
 snapshotRef:{caseId:string;snapshotId:string}; truthRef:DecisionTruthRef; expectedBinding:DecisionBinding;
 packet:PersonalDecisionPacketV1; replayed:boolean; runtime:'authoritative'|'local_fixture';
}
