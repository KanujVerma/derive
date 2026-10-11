import {copyAuditFields,COPY_AUDIT_ISSUES} from './copyClaimAudit.ts';
import type {DecisionBundleInput} from './jevDecisionBundle.ts';
import type {InsightProposal} from './insightPacket.ts';
/** The reviewer emits one classification, not contradictory classification and
 * boolean fields. 'none' means no unsupported proposition was found. This is a
 * wire adapter, not a factual endorsement; independent runtime checks still run. */
export function decodeReviewAuditWire(raw:unknown):unknown {
 if(!Array.isArray(raw)||raw.length>13)throw Error('invalid_copy_audit');
 return raw.map(row=>{
  if(!row||typeof row!=='object'||Array.isArray(row)||Object.keys(row).sort().join()!=='evidenceIds,field,issue,personalFactIds,text'
   ||!COPY_AUDIT_ISSUES.includes(row.issue))throw Error('invalid_copy_audit');
  return {...row,supported:row.issue==='none'};
 });
}
/** Bind each row's literal field/text and allowed references to its own point.
 * No references are inserted or repaired after model generation. */
export function buildReviewAuditWireSchema(input:DecisionBundleInput,proposal:InsightProposal){
 const fields=copyAuditFields(proposal);
 const variants=fields.flatMap(f=>{
  const m=/^(why|tradeoffs)\.(\d+)\.(title|body)$/.exec(f.field);
  const point=m?proposal[m[1] as 'why'|'tradeoffs'][Number(m[2])]:null;
  const es=point?.evidenceIds??input.evidence.map(e=>e.id);
  const ps=point?.personalFactIds??input.personalFacts.map(p=>p.id);
  const refs=(ids:readonly string[],minimum:number)=>({type:'ARRAY',items:ids.length?{type:'STRING',enum:[...ids]}:{type:'STRING'},minItems:minimum,maxItems:ids.length});
  const row=(issues:readonly string[],emin=0,pmin=0)=>({type:'OBJECT',properties:{
   field:{type:'STRING',enum:[f.field]},text:{type:'STRING',enum:[f.text]},
   evidenceIds:refs(es,emin),personalFactIds:refs(ps,pmin),issue:{type:'STRING',enum:[...issues]},
  },required:['field','text','evidenceIds','personalFactIds','issue']});
  return [...(es.length?[row(['none'],1,0)]:[]),...(ps.length?[row(['none'],0,1)]:[]),row(COPY_AUDIT_ISSUES.filter(i=>i!=='none'))];
 });
 return {type:'ARRAY',minItems:fields.length,maxItems:fields.length,items:{type:'OBJECT',anyOf:variants}};
}
