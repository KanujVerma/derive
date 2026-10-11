import {canonicalJson,sha256} from '../../../src/domain/part-two/hash.ts';
import {createDecisionQuestionTemplate,prepareJevDecisionBundle,type DecisionBundleInput,type JevDecisionBundle} from '../../../src/domain/personalized-sheet/jevDecisionBundle.ts';
import {buildBundleCopyRequest,validateBundleCopy,prepareBundleReview,assembleReviewedBundle,type BundleReview} from '../../../src/domain/personalized-sheet/decisionBundleCopy.ts';
import type {InsightProposal} from '../../../src/domain/personalized-sheet/insightPacket.ts';

export const RUN_VERSION='derive-facts-first-five-case/v2';
export const REVISED_RUN_VERSION='derive-facts-first-six-case/v3';
export const RUN_LIMITS=Object.freeze({maximumProviderCalls:15,maximumCostMicrousd:100000,automaticRetries:0});
export const CASE_IDS=Object.freeze(['heavy-current-material-question','superiority-required','reported-irritation-same-product','cropped-label-ambiguous-product','sunscreen-preference-stays-scoped']);
export const REVISED_CASE_IDS=Object.freeze([...CASE_IDS,'moisturizer-change-priority']);
export type BenchmarkPhase='decision'|'copy'|'review';
interface Fixture {
 id:string;preflight:'eligible_fixture'|'identity_input_required';candidate:string|null;current:string|null;
 use?:{intent:'replace'|'add';purpose:'moisturizing';category:'moisturizer';site:'face';useForm:'leave_on'};
 personalFacts?:{id:string;text:string;scope?:{category:string;site:string;useForm:string;preferenceKey:string}}[];
 sourceFacts?:{id:string;source:string;kind:'manufacturer_description';text:string}[];
 questionTemplateId:'current-product-feel-consistency'|'moisturizer-change-priority'|null;
 oracle:Record<string,unknown>;
}
/** Synthetic identifiers describe fixture context only. They are never inserted
 * into the catalog, owner registry or production personal profile. */
export function projectFixture(fixture:Fixture):DecisionBundleInput|null {
 if(!REVISED_CASE_IDS.includes(fixture.id))throw Error('unregistered_fixture');
 if(fixture.preflight==='identity_input_required'){
  if(fixture.id!=='cropped-label-ambiguous-product'||fixture.candidate!==null||fixture.questionTemplateId!==null)throw Error('invalid_preflight_fixture');
  return null;
 }
 if(fixture.preflight!=='eligible_fixture'||!fixture.candidate||!fixture.use||!fixture.personalFacts?.length||!fixture.sourceFacts?.length)throw Error('incomplete_fixture');
 const comparatorScope=fixture.current?{kind:'product_use_experience' as const,productId:'synthetic-current-product',variantId:'synthetic-current-variant',formulaVersionId:null,category:fixture.use.category,site:fixture.use.site,useForm:fixture.use.useForm,experienceKey:'skipped_due_to_feel'}:null;
 const personalFacts=fixture.personalFacts.map(f=>({id:f.id,text:f.scope?f.text+' This preference is scoped only to '+canonicalJson(f.scope)+'.':f.text}));
 const input:DecisionBundleInput={purpose:'personalized_product_decision',dataMode:'synthetic',
  productContext:{candidateName:fixture.candidate,comparatorName:fixture.current,intent:fixture.use.intent,purpose:fixture.use.purpose,site:fixture.use.site,useForm:fixture.use.useForm},
  personalFacts,evidence:fixture.sourceFacts.map(f=>({id:f.id,kind:f.kind,quote:f.text,scope:'manufacturer product description',applicability:{sourceUrl:f.source,evidenceClass:'manufacturer_description',independentComparison:false}})),
  allowedActions:fixture.current?['keep_current','try_replacement','skip_candidate','verify_evidence']:['try_replacement','skip_candidate','verify_evidence'],mandatoryCautionIds:[],comparatorScope,
  question:fixture.questionTemplateId&&comparatorScope?createDecisionQuestionTemplate({id:fixture.questionTemplateId,scope:fixture.questionTemplateId==='moisturizer-change-priority'?{kind:'preference',category:fixture.use.category,site:fixture.use.site,useForm:fixture.use.useForm,preferenceKey:'change_priority'}:comparatorScope,relevantPersonalFactIds:['current-benefit','current-feel']}):null};
 if(fixture.questionTemplateId&&!input.question)throw Error('invalid_fixture_question');
 return input;
}
export interface FixtureDataset {version:string;dataMode:string;maximumProviderCalls:number;maximumCostMicrousd:number;automaticRetries:number;cases:Fixture[]}
export function validateDataset(dataset:FixtureDataset):void {
 const ids=dataset.version===RUN_VERSION?CASE_IDS:dataset.version===REVISED_RUN_VERSION?REVISED_CASE_IDS:null;
 if(!ids||dataset.dataMode!=='synthetic'||dataset.maximumProviderCalls!==RUN_LIMITS.maximumProviderCalls||dataset.maximumCostMicrousd!==RUN_LIMITS.maximumCostMicrousd||dataset.automaticRetries!==0||canonicalJson(dataset.cases.map(c=>c.id))!==canonicalJson(ids))throw Error('unreviewed_dataset');
 for(const fixture of dataset.cases)projectFixture(fixture);
}
export type PhaseCheckpoint={phase:'decision';value:JevDecisionBundle}|{phase:'copy';value:InsightProposal}|{phase:'review';value:BundleReview};
/** This function has no provider or SQL access. Its input checkpoints must be
 * loaded from settled rows in the isolated run, bound to the exact dataset hash.
 * A claim is consumed before dispatch and is never reused after uncertainty. */
export function prepareFixturePhase(dataset:FixtureDataset,caseId:string,phase:BenchmarkPhase,checkpoints:readonly PhaseCheckpoint[]){
 dataset=structuredClone(dataset);checkpoints=structuredClone(checkpoints);
 validateDataset(dataset);
 const datasetHash=sha256(canonicalJson(dataset));
 const fixture=dataset.cases.find(c=>c.id===caseId);if(!fixture)throw Error('unknown_fixture');
 const input=projectFixture(fixture);if(!input)throw Error('preflight_case_has_no_provider_phase');
 const required=phase==='decision'?[]:phase==='copy'?['decision']:['decision','copy'];
 if(canonicalJson(checkpoints.map(c=>c.phase))!==canonicalJson(required))throw Error('invalid_phase_checkpoint_order');
 const inputHash=prepareJevDecisionBundle(input).inputHash;
 let body:unknown,parse:(raw:unknown)=>PhaseCheckpoint;
 if(phase==='decision'){
  const prepared=prepareJevDecisionBundle(input);body=prepared.request;
  parse=raw=>({phase,value:prepared.parseResponse(raw)});
 }else{
  const bundle=checkpoints[0].value as JevDecisionBundle;
  if(phase==='copy'){
   body=buildBundleCopyRequest(input,bundle);parse=raw=>({phase,value:validateBundleCopy(input,bundle,raw)});
  }else{
   const copy=checkpoints[1].value as InsightProposal,prepared=prepareBundleReview(input,bundle,copy);body=prepared.request;
   parse=raw=>({phase,value:prepared.parseResponse(raw)});
  }
 }
 const request=structuredClone(body),freeze=(value:unknown):void=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}};freeze(request);
 return Object.freeze({datasetHash,caseId,phase,inputHash,provider:phase==='decision'?'jev' as const:'gemini' as const,request,requestHash:sha256(canonicalJson(request)),parseResponse:parse});
}
/** Oracle values are consulted only after provider output has been settled.
 * Automatic structural checks are not a claim of independently established
 * medical correctness or proof that the phone flow works. */
export function scoreFixture(dataset:FixtureDataset,caseId:string,checkpoints:readonly PhaseCheckpoint[]){
 validateDataset(dataset);const fixture=dataset.cases.find(c=>c.id===caseId);if(!fixture)throw Error('unknown_fixture');
 const input=projectFixture(fixture);
 if(!input){if(checkpoints.length)throw Error('preflight_must_not_dispatch');return {kind:'preflight' as const,providerCalls:0,uiState:'request_clearer_product_or_label',modelQuality:'not_tested' as const};}
 if(canonicalJson(checkpoints.map(c=>c.phase))!==canonicalJson(['decision','copy','review']))throw Error('incomplete_benchmark_case');
 const bundle=checkpoints[0].value as JevDecisionBundle,copy=checkpoints[1].value as InsightProposal,review=checkpoints[2].value as BundleReview;
 let admitted:InsightProposal|null=null;try{admitted=assembleReviewedBundle(input,bundle,copy,review);}catch{/* Record rejection, never substitute a successful-looking answer. */}
 const oracle=fixture.oracle;
 const required=oracle.requiredPersonalFactIds as string[];
 const referenced=new Set([...copy.why,...copy.tradeoffs].flatMap(p=>p.personalFactIds));
 return {kind:'model_case' as const,actionAcceptable:(oracle.acceptableActualActions as string[]).includes(bundle.actual),
  publicationAdmitted:admitted!==null,requiredPersonalFactsReferenced:required.every(id=>referenced.has(id)),
  questionExpectationMatched:admitted!==null&&(admitted.selectedQuestionId!==null)===(oracle.materialQuestionExpected==='when_branches_differ'?bundle.materiallyDifferentQuestionId!==null&&review.questionRelevant&&review.branches.every(b=>b.supported&&!b.contradicted&&b.scopeMatched):oracle.materialQuestionExpected),
  actualAction:bundle.actual,questionId:admitted?.selectedQuestionId??null,
  semanticAssessment:'automated_model_review' as const,
  unscoredOracleCriteria:{status:'not_automatically_scored' as const,forbiddenClaims:structuredClone(oracle.forbiddenClaims),qualityRequirements:structuredClone(oracle.qualityRequirements)},
  proposal:admitted,review};
}
