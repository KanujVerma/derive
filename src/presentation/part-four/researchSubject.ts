import type {DecisionBindingV2} from '../../contracts/PersonalResultV2.ts';
import type {ResearchBriefSubject} from '../../domain/part-four/researchBrief.ts';
/** Subject comes from current server-owned product authority, never the brief. */
export function researchSubjectFor(subject:DecisionBindingV2['subject']|undefined):ResearchBriefSubject|null {
 return subject?.kind==='declaration'&&subject.productId&&subject.variantId?{productId:subject.productId,variantId:subject.variantId,formulaVersionId:subject.formulaVersionId}:null;
}
