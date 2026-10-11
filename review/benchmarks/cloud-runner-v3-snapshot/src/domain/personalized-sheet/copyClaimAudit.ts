import type {DecisionBundleInput} from './jevDecisionBundle.ts';
import type {InsightProposal} from './insightPacket.ts';

export const COPY_AUDIT_VERSION='copy-claim-audit/v1';
export const COPY_AUDIT_ISSUES=['none','unsupported_causation','unsupported_generalization','unsupported_comparison','unsupported_instruction','other'] as const;
export interface CopyFieldAudit {field:string;text:string;supported:boolean;evidenceIds:string[];personalFactIds:string[];issue:typeof COPY_AUDIT_ISSUES[number]}
/** Exact visible-field coverage, not a claim that model judgments are correct. */
export function copyAuditFields(p:InsightProposal):Array<{field:string;text:string}>{
 const fields=[{field:'headline',text:p.headline},{field:'reason',text:p.reason},{field:'nextStep',text:p.nextStep}];
 for(const key of ['why','tradeoffs'] as const)p[key].forEach((point,index)=>{
  fields.push({field:`${key}.${index}.title`,text:point.title},{field:`${key}.${index}.body`,text:point.body});
 });
 return fields;
}
export const COPY_AUDIT_SCHEMA={type:'ARRAY',maxItems:13,items:{type:'OBJECT',properties:{
 field:{type:'STRING'},text:{type:'STRING'},supported:{type:'BOOLEAN'},
 evidenceIds:{type:'ARRAY',items:{type:'STRING'}},personalFactIds:{type:'ARRAY',items:{type:'STRING'}},
 issue:{type:'STRING',enum:[...COPY_AUDIT_ISSUES]},
},required:['field','text','supported','evidenceIds','personalFactIds','issue']}};
export function validateCopyAudit(input:DecisionBundleInput,p:InsightProposal,raw:unknown):CopyFieldAudit[]{
 const fields=copyAuditFields(p);
 if(!Array.isArray(raw)||raw.length!==fields.length||raw.length>13)throw Error('incomplete_copy_audit');
 const keys=['evidenceIds','field','issue','personalFactIds','supported','text'].join();
 for(const [index,value] of raw.entries()){
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join()!==keys
   ||value.field!==fields[index].field||value.text!==fields[index].text||typeof value.supported!=='boolean'
   ||!COPY_AUDIT_ISSUES.includes(value.issue)||value.supported!==(value.issue==='none'))throw Error('invalid_copy_audit');
  for(const [key,allowed] of [['evidenceIds',input.evidence.map(e=>e.id)],['personalFactIds',input.personalFacts.map(f=>f.id)]] as const){
   const ids=value[key];
   if(!Array.isArray(ids)||new Set(ids).size!==ids.length||ids.some(id=>typeof id!=='string'||!allowed.includes(id)))throw Error('invalid_copy_audit_reference');
  }
  const pointMatch=/^(why|tradeoffs)\.(\d+)\.(title|body)$/.exec(value.field);
  if(pointMatch){
   const point=p[pointMatch[1] as 'why'|'tradeoffs'][Number(pointMatch[2])];
   if(value.evidenceIds.some((id:string)=>!point.evidenceIds.includes(id))||value.personalFactIds.some((id:string)=>!point.personalFactIds.includes(id)))throw Error('copy_audit_citation_mismatch');
  }
  if(value.supported&&value.evidenceIds.length+value.personalFactIds.length===0)throw Error('unreferenced_copy_audit');
 }
 return structuredClone(raw) as CopyFieldAudit[];
}
