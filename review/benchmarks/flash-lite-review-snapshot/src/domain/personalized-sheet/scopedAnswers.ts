import {canonicalJson} from './evidenceAdmission.ts';
/** Pure persisted-answer reuse policy. Storage must authenticate the durable owner.
 * accountGeneration records the writing session, not the answer's owner lifetime.
 * Packet/current-account/in-flight authorization remains session-bound.
 * A model may propose a question; it cannot broaden its scope or write an answer. */
export type ProductScope = { category: string; site: string; useForm: 'leave_on'|'rinse_off'|'other' };
export type AnswerScope = ProductScope & (
  { kind:'preference'; preferenceKey:string } |
  { kind:'product_experience'; productId:string; variantId:string; formulaVersionId:string; experienceKey:string } |
  { kind:'product_use_experience'; productId:string; variantId:string; formulaVersionId:string|null; experienceKey:string } |
  { kind:'routine_tradeoff'; candidateProductId:string; comparatorItemId:string; routineRevision:string; tradeoffKey:string }
);
export type AnswerValue = {state:'known';optionId:string}|{state:'unsure'}|{state:'withheld'};
export interface ScopedQuestion {
 id:string; meaningVersion:string; prompt:string; scope:AnswerScope;
 options:readonly {id:string;label:string;outcomeKey:string}[];
}
export interface StoredScopedAnswer {
 ownerId:string; accountGeneration:number; id:string; revision:number;
 questionId:string; meaningVersion:string; scope:AnswerScope; value:AnswerValue;
 answeredAt:string; expiresAt:string|null; withdrawnAt:string|null;
 provenance:'explicit_user_answer';
}
const known=(s:unknown):s is string=>typeof s==='string'&&s.trim().length>0&&s.length<=200&&!['unknown','unsure','other','unanswered'].includes(s);
export function scopeKey(scope:AnswerScope):string {
 if(!known(scope.category)||!known(scope.site)||!['leave_on','rinse_off','other'].includes(scope.useForm))throw Error('incomplete_scope');
 const base=[scope.kind,scope.category,scope.site,scope.useForm];
 if(scope.kind==='product_use_experience'){
  const expected=['category','experienceKey','formulaVersionId','kind','productId','site','useForm','variantId'];
  const keys=Object.keys(scope).sort();
  if(keys.length!==expected.length||keys.some((key,index)=>key!==expected[index])
   ||![scope.productId,scope.variantId,scope.experienceKey].every(known)
   ||scope.formulaVersionId!==null&&!known(scope.formulaVersionId))throw Error('incomplete_scope');
  return JSON.stringify([...base,scope.productId,scope.variantId,scope.formulaVersionId,scope.experienceKey]);
 }
 const extra=scope.kind==='preference'?[scope.preferenceKey]:scope.kind==='product_experience'?[scope.productId,scope.variantId,scope.formulaVersionId,scope.experienceKey]:scope.kind==='routine_tradeoff'?[scope.candidateProductId,scope.comparatorItemId,scope.routineRevision,scope.tradeoffKey]:null;
 if(!extra||extra.some(v=>!known(v)))throw Error('incomplete_scope');
 return JSON.stringify([...base,...extra]);
}

export type AnswerScopeMatch='exact_scope'|'product_use_only'|'different';
/** Product/use history can remain relevant without proof of an identical formula.
 * Keep the ORIGINAL answer scope. This match never upgrades unknown identity or
 * turns a product experience into an ingredient/category-wide preference.
 * Existing scope kinds retain their exact-match semantics. */
export function answerScopeMatch(recorded:AnswerScope,current:AnswerScope):AnswerScopeMatch {
 const recordedKey=scopeKey(recorded),currentKey=scopeKey(current);
 if(recorded.kind!=='product_use_experience'||current.kind!=='product_use_experience')
  return recordedKey===currentKey?'exact_scope':'different';
 if(recorded.productId!==current.productId||recorded.variantId!==current.variantId
  ||recorded.category!==current.category||recorded.site!==current.site||recorded.useForm!==current.useForm
  ||recorded.experienceKey!==current.experienceKey)return 'different';
 if(recorded.formulaVersionId!==null&&current.formulaVersionId!==null)
  return recorded.formulaVersionId===current.formulaVersionId?'exact_scope':'different';
 return 'product_use_only';
}
export function validateQuestion(q:ScopedQuestion):ScopedQuestion {
 scopeKey(q.scope);
 if(!known(q.id)||!known(q.meaningVersion)||typeof q.prompt!=='string'||!q.prompt.trim()||q.prompt.length>240||!Array.isArray(q.options)||q.options.length<2||q.options.length>4)throw Error('invalid_question');
 if(q.options.some(o=>!known(o.id)||!known(o.outcomeKey)||!o.label?.trim()||o.label.length>80)||new Set(q.options.map(o=>o.id)).size!==q.options.length)throw Error('invalid_options');
 if(new Set(q.options.map(o=>o.outcomeKey)).size<2)throw Error('question_cannot_change_outcome');
 return q;
}
export function findReusableAnswer(input:{ownerId:string;accountGeneration:number;question:ScopedQuestion;answers:readonly StoredScopedAnswer[];now:string}):StoredScopedAnswer|null {
 const q=validateQuestion(input.question), now=Date.parse(input.now);
 if(!Number.isFinite(now))throw Error('invalid_clock');
 const matching=input.answers.filter(a=>{
  if(a.ownerId!==input.ownerId||a.questionId!==q.id||a.meaningVersion!==q.meaningVersion||a.provenance!=='explicit_user_answer'||!Number.isSafeInteger(a.revision)||a.revision<1)return false;
  try{if(answerScopeMatch(a.scope,q.scope)==='different')return false;}catch{return false;}
  return true;
 }).sort((a,b)=>b.revision-a.revision);
 if(matching.length>1&&matching.some(a=>a.revision===matching[0].revision&&canonicalJson(a)!==canonicalJson(matching[0])))throw Error('conflicting_answer_revision');
 const latest=matching[0];
 if(!latest||!Number.isFinite(Date.parse(latest.answeredAt))||Date.parse(latest.answeredAt)>now)return null;
 if(latest.expiresAt!==null&&!Number.isFinite(Date.parse(latest.expiresAt)))return null;
 if(latest.withdrawnAt!==null){
  const withdrawn=Date.parse(latest.withdrawnAt);
  if(!Number.isFinite(withdrawn)||withdrawn<Date.parse(latest.answeredAt)||withdrawn>now)return null;
  // Withdrawal suppresses automatic repetition until explicit editing. Expiry
  // applied to the retired value, not this tombstone; never return its old option.
  return {...latest,value:{state:'withheld'},expiresAt:null};
 }
 if(latest.expiresAt!==null&&Date.parse(latest.expiresAt)<=now)return null;
 const value=latest.value;
 if(value.state==='known'?!q.options.some(o=>o.id===value.optionId):value.state!=='unsure'&&value.state!=='withheld')return null;
 return latest;
}
export function resolveQuestion(input:Parameters<typeof findReusableAnswer>[0]):{kind:'ask';question:ScopedQuestion}|{kind:'answered';answer:StoredScopedAnswer;outcomeKey:string|null}{
 const answer=findReusableAnswer(input);
 if(!answer)return {kind:'ask',question:input.question};
 // Unsure and withheld suppress repetition but never become a negative preference.
 const value=answer.value;
 const outcome=value.state==='known'?input.question.options.find(o=>o.id===value.optionId)?.outcomeKey??null:null;
 return {kind:'answered',answer,outcomeKey:outcome};
}
