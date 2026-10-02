import type {DecisionBindingV2,FindingV2,EligibleQuestion} from '../../contracts/PersonalResultV2.ts';
import {EligibleMenuSchema,type EligibleMenu} from './provider.ts';
import {canonicalJson,sha256} from '../part-two/hash.ts';
/** Reviewed neutral descriptions; no raw notes, health report text or baseline rank. */
export function eligibleMenuFor(binding:DecisionBindingV2,findings:FindingV2[],question:EligibleQuestion|null):EligibleMenu|null {
 const optional=findings.filter(f=>f.consequence==='optional'&&!f.mandatoryVisibility).slice(0,8);
 const base={candidateSetId:`menu:${sha256(canonicalJson({...binding,refinement:null}))}`,jobs:[...(optional.length?[{id:'prioritize_tradeoff' as const,options:[{id:'none',description:'No optional tradeoff'},...optional.map(f=>({id:f.id,description:f.arguments.detail==='replacement'?'Selected replacement relation':'Supported optional routine tradeoff'}))]}]:[]),...(question?[{id:'select_question' as const,options:[{id:'none',description:'No optional question'},{id:question.id,description:'Clarify this encounter intent'}]}]:[])],compatiblePairs:[] as Array<[string|null,string|null]>};
 return base.jobs.length?EligibleMenuSchema.parse({...base,candidateSetHash:sha256(canonicalJson(base))}):null;
}
