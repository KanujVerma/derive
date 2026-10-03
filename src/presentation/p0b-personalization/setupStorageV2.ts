import type { SetupBundle, CurrentProductFeedback } from './setup.ts';
import { currentProductFeedback } from './setup.ts';
import type { ContextDraft } from './draft.ts';
import { profileToStorage, referenceToStorage, experienceToStorage, routineToStorage } from './storageAdapter.ts';
import { migrateProfileV1, migrateReportedUseV1,migrateExperienceV1 } from '../../services/context/migrateV2.ts';
import type { SetupPayloadV2, PersonalExperienceV2 } from '../../contracts/PersonalContextV2.ts';
import { setupV2Schema } from '../../contracts/PersonalContextV2Schema.ts';
/** Explicit feedback only. Never converts liked or no reaction into helpfulness or satisfaction. */
export function setupToStorageV2(draft:ContextDraft,bundle:SetupBundle,createId:()=>string,assessedAt:string):SetupPayloadV2 {
 const profile=migrateProfileV1(profileToStorage(draft));
 if(draft.primaryGoal.state==='withheld'||draft.primaryGoal.state==='unsure')profile.primaryGoal={state:draft.primaryGoal.state};
 const oldRoutine=routineToStorage({completeness:bundle.previewOnly.currentProducts==='none'?'complete':bundle.products.length?'partial':'unknown',items:bundle.products});
 const routine={...oldRoutine,items:oldRoutine.items.map(item=>({...item,...migrateReportedUseV1(item),...bundle.reportedUse?.[item.id]}))};
 const experiences:PersonalExperienceV2[]=bundle.experiences.filter(e=>!bundle.previewOnly.pastReports.some(p=>p.id===e.id&&p.outcome==='helpful')).map(e=>{const stored=experienceToStorage(e);return migrateExperienceV1(stored);});
 const assessments:SetupPayloadV2['assessments']=[];
 for(const product of routine.items){
  const {id: _id,reference: _reference,state: _state,...useContext}=product;
  const feedback=currentProductFeedback(bundle,product.id);if(!feedback.length)continue;
  const helpful=feedback.includes('helpful'),negative=feedback.includes('not_helping')||feedback.includes('still_dry');
  assessments.push({id:createId(),reference:product.reference,useContext,reportingPeriod:{start:{state:'unanswered'},end:{state:'unanswered'}},goalOrPurpose:product.reportedPurpose?.answer??{state:'unanswered'},perceivedHelp:helpful&&negative?'mixed':helpful?'helps':feedback.includes('not_helping')?'not_helping':feedback.includes('still_dry')?'mixed':feedback.includes('not_sure')?'unsure':'unanswered',satisfaction:'unanswered',...(feedback.includes('too_heavy')?{textureExperience:{state:'known' as const,value:'too_heavy' as const}}:{}),assessedAt});
  const symptoms:Partial<Record<CurrentProductFeedback,string>>={stung:'Stinging',broke_out:'Breakouts',too_drying:'Dryness'};
  const noticed=feedback.flatMap(f=>symptoms[f]?[symptoms[f]!]:[]);
  if(noticed.length)experiences.push({id:createId(),reference:product.reference,kind:'reacted',occurred:{start:{state:'unanswered'},end:{state:'unanswered'}},useContext,symptoms:noticed,note:null});

 }
 // The accepted past-products stage describes an experience; no current exposure is inferred.
 for(const past of bundle.previewOnly.pastReports.filter(p=>p.outcome==='helpful'))assessments.push({id:createId(),reference:referenceToStorage(past.reference),useContext:migrateReportedUseV1({timing:'unknown',frequency:{kind:'unknown'},startedOn:null,stoppedOn:null,duration:null}),reportingPeriod:{start:{state:'unanswered'},end:{state:'unanswered'}},goalOrPurpose:{state:'unanswered'},perceivedHelp:'helps',satisfaction:'unanswered',assessedAt});
 const payload:SetupPayloadV2={profile,routine,experiences,preferences:bundle.preferences??[],assessments,notes:[...(bundle.additionalNote?[{id:createId(),scope:'profile' as const,targetRef:null,text:bundle.additionalNote}]:[]),...routine.items.filter(p=>currentProductFeedback(bundle,p.id).some(f=>f==='too_heavy'||f==='still_dry')).map(p=>({id:createId(),scope:'routine_item' as const,targetRef:p.id,text:currentProductFeedback(bundle,p.id).filter(f=>f==='too_heavy'||f==='still_dry').map(f=>f==='too_heavy'?'Reported texture: too heavy':'Reported: still feels dry').join(' · ')})),...bundle.previewOnly.pastReports.filter(p=>p.outcome==='too_heavy'||p.outcome==='not_sure').map(p=>({id:createId(),scope:'profile' as const,targetRef:null,text:`Past product report · ${p.reference.label}: ${p.outcome==='too_heavy'?'Too heavy':'Not sure'}`}))],setupAnswers:{currentProducts:bundle.previewOnly.currentProducts==='unknown'?'unsure':bundle.previewOnly.currentProducts,pastProducts:bundle.previewOnly.pastProducts==='unknown'?'unsure':bundle.previewOnly.pastProducts}};
 const parsed=setupV2Schema.safeParse(payload);if(!parsed.success)throw new Error('Save up to 20 current products, 20 experiences, 20 notes and notes of up to 2,000 characters. Review your entries.');return parsed.data;
}
