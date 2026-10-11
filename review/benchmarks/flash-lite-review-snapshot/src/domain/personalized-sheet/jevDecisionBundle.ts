import {canonicalJson,sha256} from '../part-two/hash.ts';
import {buildJevDecisionRequest,parseJevDecisionResponse,PERSONALIZED_JEV_MODEL,type JevDecision} from './jevDecisionProtocol.ts';
import {scopeKey,type AnswerScope} from './scopedAnswers.ts';
import {observedUseScopeKey,type ObservedUseScope} from './observedProductContinuity.ts';
import type {SafeModelInput} from './orchestrator.ts';

export const JEV_BUNDLE_PROTOCOL='facts-first-product-action/v3';
// This policy is scoped to versioned bundles. Standalone checkpoints retain their original protocol.
const BUNDLE_DECISION_POLICY="When the current product already meets the person's stated priority and they only want to switch for demonstrated improvement on that priority, keep the current product for now if the supplied evidence does not support that improvement. This default must not override reported adverse experiences with the current product, mandatory cautions, or another decisive constraint. It is a practical default, not a claim that comparative evidence cannot exist. Use verify_evidence when a specific missing fact prevents a grounded practical choice, rather than merely because the candidate's effects are unknown. A separately stated priority such as changing an unwanted feel may justify a trial without claiming better hydration or tolerance.";
/** Immutable server-authored templates. No action/outcome keys are supplied
 * before decision. Scope identity and semantic version are persisted with the
 * user's eventual answer, not inferred from model prose. */
export interface DecisionQuestionTemplate {
 id:string;
 meaningVersion:string;
 prompt:string;
 scope:AnswerScope|ObservedUseScope;
 scopeHash:string;
 relevantPersonalFactIds:readonly string[];
 options:readonly {
  id:string;label:string;
  assumption:{field:'current_product.skipped_due_to_feel'|'preference.moisturizer_finish'|'preference.change_priority';value:boolean|'light'|'rich'|'retain_known_benefit'|'change_feel'};
 }[];
}
/** Copy and option semantics are versioned together. Callers may select a
 * registered question, but cannot rewrite the meaning of its visible answers. */
const QUESTION_DEFINITIONS = {
 'current-product-feel-consistency': {
  meaningVersion:'v1', prompt:'Does the heavy feel make you skip using it?',
  options:[
   {id:'yes',label:'Yes',assumption:{field:'current_product.skipped_due_to_feel',value:true}},
   {id:'no',label:'No',assumption:{field:'current_product.skipped_due_to_feel',value:false}},
  ],
 },
 'moisturizer-finish': {
  meaningVersion:'v1', prompt:'What feel do you prefer in a moisturizer?',
  options:[
   {id:'light',label:'Lightweight',assumption:{field:'preference.moisturizer_finish',value:'light'}},
   {id:'rich',label:'Rich',assumption:{field:'preference.moisturizer_finish',value:'rich'}},
  ],
 },
 'moisturizer-change-priority': {
  meaningVersion:'v2', prompt:'When changing moisturizers, what matters more to you?',
  options:[
   {id:'retain',label:'Keep what works',assumption:{field:'preference.change_priority',value:'retain_known_benefit'}},
   {id:'change',label:'A different feel',assumption:{field:'preference.change_priority',value:'change_feel'}},
  ],
 },
} as const;
export type DecisionQuestionId=keyof typeof QUESTION_DEFINITIONS;
export function createDecisionQuestionTemplate(args:{id:DecisionQuestionId;scope:DecisionQuestionTemplate['scope'];relevantPersonalFactIds:readonly string[]}):DecisionQuestionTemplate {
 const definition=QUESTION_DEFINITIONS[args.id];
 if(!definition)throw Error('unknown_question_template');
 const question=structuredClone({id:args.id,...definition,scope:args.scope,scopeHash:sha256(canonicalJson(args.scope)),relevantPersonalFactIds:args.relevantPersonalFactIds});
 validateDecisionQuestionTemplate(question);
 return question;
}
export interface DecisionBundleInput extends Omit<SafeModelInput,'questions'> {
 question:DecisionQuestionTemplate|null;
 comparatorScope:Extract<AnswerScope,{kind:'product_use_experience'}>|ObservedUseScope|null;
}
export interface JevDecisionBundle {
 version:typeof JEV_BUNDLE_PROTOCOL;
 inputHash:string;
 actual:JevDecision['action'];
 hypothetical:readonly {optionId:string;action:JevDecision['action']}[];
 /** Different actions are necessary, not proof of evidence support. Publication
  * also requires independent review of these branches and their assumptions. */
 materiallyDifferentQuestionId:string|null;
 resolvedModel:typeof PERSONALIZED_JEV_MODEL;
 usage:JevDecision['usage'];
}
const text=(v:unknown,max:number)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
export function validateDecisionQuestionTemplate(q:DecisionQuestionTemplate):void {
 const registered=q&&QUESTION_DEFINITIONS[q.id as DecisionQuestionId];
 if(!registered||q.meaningVersion!==registered.meaningVersion||q.prompt!==registered.prompt||canonicalJson(q.options)!==canonicalJson(registered.options))throw Error('unregistered_question_semantics');
 if(Object.keys(q).sort().join()!=='id,meaningVersion,options,prompt,relevantPersonalFactIds,scope,scopeHash'
  ||!Array.isArray(q.relevantPersonalFactIds)||q.relevantPersonalFactIds.length<1||q.relevantPersonalFactIds.length>10
  ||q.relevantPersonalFactIds.some(id=>!text(id,200))||new Set(q.relevantPersonalFactIds).size!==q.relevantPersonalFactIds.length)throw Error('invalid_question_template');
 if(q.scope.kind==='observed_product_use_experience')observedUseScopeKey(q.scope);else scopeKey(q.scope);
 if(q.scopeHash!==sha256(canonicalJson(q.scope)))throw Error('question_scope_hash_mismatch');
 const field=q.options[0].assumption.field;
 if(field==='current_product.skipped_due_to_feel'&&(!['product_use_experience','observed_product_use_experience'].includes(q.scope.kind)||!('experienceKey' in q.scope)||q.scope.experienceKey!=='skipped_due_to_feel')
  ||field==='preference.moisturizer_finish'&&(q.scope.kind!=='preference'||q.scope.preferenceKey!=='finish'||q.scope.category!=='moisturizer')
  ||field==='preference.change_priority'&&(q.scope.kind!=='preference'||q.scope.preferenceKey!=='change_priority'||q.scope.category!=='moisturizer'))throw Error('question_semantic_scope_mismatch');
}
function assertTemplate(input:DecisionBundleInput):void {
 const q=input.question;if(q===null)return;
 validateDecisionQuestionTemplate(q);
 if(!q||Object.keys(q).sort().join()!=='id,meaningVersion,options,prompt,relevantPersonalFactIds,scope,scopeHash'
  ||!text(q.id,200)||!text(q.meaningVersion,200)||!text(q.prompt,240)||!/^[a-f0-9]{64}$/.test(q.scopeHash)
  ||!Array.isArray(q.relevantPersonalFactIds)||q.relevantPersonalFactIds.length<1||q.relevantPersonalFactIds.length>10
  ||new Set(q.relevantPersonalFactIds).size!==q.relevantPersonalFactIds.length
  ||q.relevantPersonalFactIds.some(id=>!input.personalFacts.some(f=>f.id===id))
  ||!Array.isArray(q.options)||q.options.length<2||q.options.length>4)throw Error('invalid_question_template');
 if(q.scope.kind==='observed_product_use_experience')observedUseScopeKey(q.scope);else scopeKey(q.scope);
 if(q.scopeHash!==sha256(canonicalJson(q.scope)))throw Error('question_scope_hash_mismatch');
 const fields:Record<string,readonly unknown[]>={
  'current_product.skipped_due_to_feel':[true,false],
  'preference.moisturizer_finish':['light','rich'],
  'preference.change_priority':['retain_known_benefit','change_feel'],
 };
 for(const option of q.options){
  if(!option||Object.keys(option).sort().join()!=='assumption,id,label'||!text(option.id,200)||!text(option.label,80)
   ||!option.assumption||Object.keys(option.assumption).sort().join()!=='field,value'
   ||!Object.hasOwn(fields,option.assumption.field)||!fields[option.assumption.field].includes(option.assumption.value))throw Error('invalid_question_assumption');
 }
 if(q.scope.site!==input.productContext.site||q.scope.useForm!==input.productContext.useForm)throw Error('question_use_context_mismatch');
 const field=q.options[0].assumption.field;
 if(field==='current_product.skipped_due_to_feel'){
  const comparator=input.comparatorScope;
  if(!comparator||canonicalJson(comparator)!==canonicalJson(q.scope))throw Error('question_comparator_scope_mismatch');
 }
 if(field==='current_product.skipped_due_to_feel'&&(!['product_use_experience','observed_product_use_experience'].includes(q.scope.kind)||!('experienceKey' in q.scope)||q.scope.experienceKey!=='skipped_due_to_feel')
  ||field==='preference.moisturizer_finish'&&(q.scope.kind!=='preference'||q.scope.preferenceKey!=='finish'||q.scope.category!=='moisturizer')
  ||field==='preference.change_priority'&&(q.scope.kind!=='preference'||q.scope.preferenceKey!=='change_priority'||q.scope.category!=='moisturizer'))throw Error('question_semantic_scope_mismatch');
 if(field==='preference.change_priority'&&(input.productContext.purpose!=='moisturizing'||input.productContext.intent!=='replace'||input.productContext.comparatorName===null))throw Error('question_use_context_mismatch');
 if(q.options[0].assumption.field==='preference.moisturizer_finish'&&input.productContext.purpose!=='moisturizing'
  ||q.options[0].assumption.field==='current_product.skipped_due_to_feel'&&input.productContext.comparatorName===null)throw Error('question_use_context_mismatch');
 if(new Set(q.options.map(o=>o.id)).size!==q.options.length
  ||new Set(q.options.map(o=>o.assumption.field)).size!==1
  ||new Set(q.options.map(o=>canonicalJson(o.assumption))).size!==q.options.length)throw Error('ambiguous_question_options');
}
export function decisionBundleInputHash(input:DecisionBundleInput):string {
 assertTemplate(input);return sha256(canonicalJson({version:JEV_BUNDLE_PROTOCOL,input}));
}
/** One request contains the actual choice and, at most, one candidate question's
 * hypothetical choices. Each branch receives exactly one scoped assumption.
 * It is never a stored personal fact, evidence, or an executed user answer. */
export function buildJevDecisionBundleRequest(input:DecisionBundleInput){
 input=structuredClone(input);assertTemplate(input);
 const {question,...facts}=input;
 const base=buildJevDecisionRequest({...facts,questions:[]});
 base.questions.action.instructions+=' '+BUNDLE_DECISION_POLICY;
 const questions:Record<string,typeof base.questions.action>={action:{...base.questions.action,instructions:base.questions.action.instructions+' The question template describes possible unanswered options, not known personal facts. Do not apply any hypothetical option to this actual choice.'}};
 for(const [index,option] of (question?.options??[]).entries()){
  questions[`hypothetical_${index}`]={type:'choice',criteria:{...base.questions.action.criteria},
   instructions:base.questions.action.instructions+' This is a separate hypothetical choice. Use the unchanged actual facts plus only this hypothetical answer: '+canonicalJson({questionId:question!.id,meaningVersion:question!.meaningVersion,scopeHash:question!.scopeHash,optionId:option.id,assumption:option.assumption})+'. Do not treat another option as true. This does not update the actual choice or the person’s saved profile.'};
 }
 return {...base,state:{input:{...base.state.input,version:JEV_BUNDLE_PROTOCOL,inputHash:decisionBundleInputHash(input),questionTemplate:question}},questions};
}
function parseJevDecisionBundleResponse(raw:unknown,input:DecisionBundleInput):JevDecisionBundle {
 input=structuredClone(input);assertTemplate(input);
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).sort().join()!=='answers,model,usage')throw Error('invalid_decision_bundle');
 const response=raw as Record<string,unknown>,answers=response.answers;
 if(!answers||typeof answers!=='object'||Array.isArray(answers))throw Error('invalid_decision_bundle');
 const expected=['action',...(input.question?.options??[]).map((_,i)=>`hypothetical_${i}`)].sort();
 if(Object.keys(answers).sort().join()!==expected.join())throw Error('unbound_question_branches');
 const map=answers as Record<string,unknown>;
 const decode=(name:string)=>parseJevDecisionResponse({model:response.model,usage:response.usage,answers:{action:map[name]}},input.allowedActions);
 const actual=decode('action');
 const hypothetical=(input.question?.options??[]).map((option,index)=>({optionId:option.id,action:decode(`hypothetical_${index}`).action}));
 return {version:JEV_BUNDLE_PROTOCOL,inputHash:decisionBundleInputHash(input),actual:actual.action,hypothetical,
  materiallyDifferentQuestionId:input.question&&new Set(hypothetical.map(b=>b.action)).size>1?input.question.id:null,
  resolvedModel:actual.resolvedModel,usage:actual.usage};
}

/** Capture once before authorization/dispatch. Decoding never accepts a new
 * input that could rename positional branches from an older response. The
 * caller must separately bind this request hash to its canonical operation and
 * recheck current dependencies before publication. */
export function prepareJevDecisionBundle(input:DecisionBundleInput){
 const captured=structuredClone(input);
 const inputHash=decisionBundleInputHash(captured);
 const freeze=(value:unknown):void=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}};
 freeze(captured);
 const request=buildJevDecisionBundleRequest(captured);freeze(request);
 return Object.freeze({inputHash,request,parseResponse:(raw:unknown)=>parseJevDecisionBundleResponse(raw,captured)});
}
