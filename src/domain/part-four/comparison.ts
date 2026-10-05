import type { ContextProductReference } from '../../contracts/PersonalContext.ts';
import type { PersonalRoutineV2, PersonalRoutineItemV2, PurposeId, ApplicationSite, UseForm, Answer } from '../../contracts/PersonalContextV2.ts';
import type { PartFourComparison } from '../../contracts/PartFour.ts';
export interface RequestedUse { purpose: PurposeId|null; site: ApplicationSite|null; useForm: UseForm|null }
export const knownAnswer = <T>(answer: Answer<T>|undefined):T|null => answer?.state === 'known' ? answer.value : null;
export const activeRoutineItem = (item:PersonalRoutineItemV2):boolean => item.state==='current'||item.state==='occasional';
export function sameReportedUse(item:PersonalRoutineItemV2,use:RequestedUse):boolean {
 return use.purpose!==null&&use.site!==null&&use.useForm!==null&&knownAnswer(item.reportedPurpose?.answer)===use.purpose&&knownAnswer(item.applicationSite?.answer)===use.site&&knownAnswer(item.useForm?.answer)===use.useForm;
}
/** Exact catalog self recognition requires both variant and formula version. A
 * manual name match does not establish exact product identity. */
export function exactCatalogReference(a:ContextProductReference,b:ContextProductReference):boolean {
 return a.kind==='catalog'&&b.kind==='catalog'&&a.productId===b.productId&&a.variantId!==null&&a.formulaVersionId!==null&&a.variantId===b.variantId&&a.formulaVersionId===b.formulaVersionId;
}
/** Labels affect copy only. They never establish product/formula identity. */
export function routineItemLabel(item:PersonalRoutineItemV2,items:readonly PersonalRoutineItemV2[],labels?:Readonly<Record<string,string>>):string {
 const label=labels?.[item.id]??(item.reference.kind==='manual'?item.reference.name:null);
 if(label&&label!==item.id&&!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(label))return label;
 return `your current step ${Math.max(0,items.findIndex(i=>i.id===item.id))+1}`;
}
export interface ComparatorInput { routine:PersonalRoutineV2|null; requestedUse:RequestedUse; candidateRoutineItemId:string|null; selectedComparatorId:string|null; candidateReference?:ContextProductReference|null; routineLabels?:Readonly<Record<string,string>> }
export function selectCurrentComparator(input:ComparatorInput):PartFourComparison {
 if(!input.routine)return {state:'unavailable',routineItemId:null,candidateIds:[],explanation:'Current routine information is unavailable.'};
 const active=input.routine.items.filter(activeRoutineItem), compatible=active.filter(item=>sameReportedUse(item,input.requestedUse));
 const self=(item:PersonalRoutineItemV2)=>item.id===input.candidateRoutineItemId||!!input.candidateReference&&exactCatalogReference(item.reference,input.candidateReference);
 const eligible=compatible.filter(item=>!self(item)).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0), candidateIds=eligible.map(item=>item.id);
 if(input.selectedComparatorId){
  const item=compatible.find(item=>item.id===input.selectedComparatorId);
  if(!item)return {state:'unavailable',routineItemId:null,candidateIds,explanation:'The selected item is not an active routine item with the same reported purpose, site and use form.'};
  if(self(item))return {state:'self',routineItemId:item.id,candidateIds,explanation:'The selected routine item is the candidate itself; it is not a distinct comparison.'};
  return {state:'selected',routineItemId:item.id,candidateIds,explanation:`Compared with ${routineItemLabel(item,active,input.routineLabels)}, selected for the same reported purpose, site and use form.`};
 }
 if(eligible.length===1)return {state:'selected',routineItemId:eligible[0].id,candidateIds,explanation:`Automatically compared with ${routineItemLabel(eligible[0],active,input.routineLabels)} because its reported purpose, site and use form match.`};
 if(eligible.length>1)return {state:'ambiguous',routineItemId:null,candidateIds,explanation:'Several active routine items have the same reported use. Choose a comparison item; their ordering does not establish a winner.'};
 const own=compatible.find(self);
 if(own)return {state:'self',routineItemId:own.id,candidateIds,explanation:'Only the candidate itself has this reported use in the current routine.'};
 const unresolved=active.some(item=>knownAnswer(item.reportedPurpose?.answer)===null||knownAnswer(item.applicationSite?.answer)===null||knownAnswer(item.useForm?.answer)===null);
 if(unresolved||input.requestedUse.purpose===null||input.requestedUse.site===null||input.requestedUse.useForm===null||input.routine.completeness!=='complete')return {state:'unavailable',routineItemId:null,candidateIds,explanation:'No eligible comparison is established from the available routine and use information.'};
 return {state:'none',routineItemId:null,candidateIds,explanation:'No relevant current routine product to compare.'};
}

/** The original explicit choice stays in transport/storage. Canonical evaluation
 * receives only a distinct eligible selection; the same derivation is used by
 * the client's expected binding and the server's authoritative binding. */
export function resolveCurrentComparator(input:ComparatorInput):{comparison:PartFourComparison;comparatorId:string|null} {
 const comparison=selectCurrentComparator(input);
 return {comparison,comparatorId:comparison.state==='selected'?comparison.routineItemId:null};
}
