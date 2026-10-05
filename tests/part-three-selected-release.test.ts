import assert from 'node:assert/strict';
import test from 'node:test';
import { PART_THREE_RELEASE,selectedPartThreeRelease,ordinaryPartThreeRelease,ORDINARY_PART_THREE_RELEASE_SELECTION,type PartThreeSemanticRelease } from '../src/domain/part-three/release.ts';
import { LOCAL_DICTIONARY_RELEASE,dictionaryReleaseHash } from '../src/domain/part-two/dictionary.ts';
import { canonicalJson,sha256 } from '../src/domain/part-two/hash.ts';
import { normalize } from '../src/domain/part-two/index.ts';
import { evaluatePersonalResult } from '../src/domain/part-three/evaluate.ts';
import { purposeFacts } from '../src/domain/part-three/projection.ts';
import { buildFoundationInsights } from '../src/domain/part-four/foundations.ts';
import { partThreeTarget } from '../src/presentation/part-three/target.ts';
import { createPartThreeController } from '../src/presentation/part-three/controller.ts';
import { handlePersonalRequest,type PartThreePorts } from '../supabase/functions/part-three/handler.ts';
import { p3input } from './fixtures/part-three.ts';
import { boundLabelDeclaration,p2metadata,p2id } from './fixtures/part-two-core.ts';
import { confirmedPreference } from '../src/presentation/p0b-personalization/preferences.ts';
import {componentHarness,control,press,textContent} from './ux-profile-render.ts';

// Detached synthetic bundles. No operational registration or rights admission.
const semanticRelease:PartThreeSemanticRelease={...structuredClone(PART_THREE_RELEASE),id:'selected-semantic-test-v1',rule:'selected-rule-test-v1',evidence:'selected-purpose-test-v1',reviewScope:'local_engineering_fixture',refinement:{...PART_THREE_RELEASE.refinement,projection:'part-three-provider-projection/v1'},rules:[...PART_THREE_RELEASE.rules],purposes:[{...PART_THREE_RELEASE.purposes[0],id:'selected-label-test-v1',literal:'Synthetic selected facial moisturizing use.'}]};
const dictionaryRelease=structuredClone(LOCAL_DICTIONARY_RELEASE);dictionaryRelease.version='selected-dictionary-test-v1';dictionaryRelease.aliases=dictionaryRelease.aliases.map(a=>({...a,release:dictionaryRelease.version}));dictionaryRelease.contentHash=dictionaryReleaseHash(dictionaryRelease);
const releaseSelection={semanticRelease,dictionaryRelease};
const releaseHash=sha256(canonicalJson(semanticRelease));
function input(){const x=p3input();x.partTwo=normalize(boundLabelDeclaration(semanticRelease.purposes[0].literal,'purpose','public'),dictionaryRelease,p2metadata);assert.equal(x.partTwo.state,'ready');x.binding.releases={...x.binding.releases,releaseHash,rule:semanticRelease.rule,evidence:semanticRelease.evidence,dictionary:dictionaryRelease.version};return {...x,releaseSelection};}
test('selected semantic purpose and versions reach deterministic findings and foundation explanation',()=>{
 const x=input(),result=evaluatePersonalResult(x);
 assert.equal(result.summary!.judgment,'worth_considering');
 assert.equal(result.findings.find(f=>f.kind==='purpose_value')!.ruleVersion,'selected-rule-test-v1');
 assert(result.findings.every(f=>f.dependencies.releaseIds.includes(releaseHash)));
 const purposes=purposeFacts(x.partTwo,x.binding,Date.parse(x.now),releaseSelection);
 assert.equal(purposes[0].mappingVersion,'selected-purpose-test-v1');assert.deepEqual(purposes[0].dependencies.releaseIds,[releaseHash]);
 const foundation=buildFoundationInsights({context:x.context,partTwo:x.partTwo,requestedUse:x.requestedUse,intent:'add',candidateRoutineItemId:null,selectedComparatorId:null,now:x.now,releaseSelection});
 assert.equal(foundation.insights.find(i=>i.title==='Moisturizing purpose relevance')!.state,'supported');
});
test('selected dictionary mismatch cannot reinterpret a normalization snapshot',()=>{
 const x=input();x.partTwo=p3input().partTwo;
 assert.throws(()=>evaluatePersonalResult(x),/dictionary|release|binding/i);
});
test('selected semantic tuple mismatch is refused even with the matching release hash',()=>{
 const x=input();x.binding.releases.evidence=PART_THREE_RELEASE.evidence;
 assert.throws(()=>evaluatePersonalResult(x),/release|binding/i);
});
test('a selected manifest cannot omit an implemented mandatory rule',()=>{
 const x=input();x.releaseSelection={...releaseSelection,semanticRelease:{...semanticRelease,rules:semanticRelease.rules.filter(r=>r!=='exact-avoidance')}};
 x.binding.releases.releaseHash=sha256(canonicalJson(x.releaseSelection.semanticRelease));
 assert.throws(()=>evaluatePersonalResult(x),/semantic release|rule/i);
});
test('explicit preference validation uses the selected dictionary rather than fixture identity membership',()=>{
 const dictionary=structuredClone(dictionaryRelease);dictionary.identities=[{...dictionary.identities[0],ingredientId:'synthetic-selected-only',preferredName:'Synthetic selected only'}];dictionary.aliases=[];dictionary.explanations=[];dictionary.explanationPolicies=[];dictionary.contentHash=dictionaryReleaseHash(dictionary);
 const choice={id:p2id(810),kind:'avoid_ingredient' as const,target:{kind:'ingredient' as const,identity:{kind:'resolved' as const,ingredientId:'synthetic-selected-only'}},strength:'decisive' as const,confirmed:true,confirmedAt:p3input().now,dictionaryRelease:dictionary};
 assert.doesNotThrow(()=>confirmedPreference(choice));
 assert.throws(()=>confirmedPreference({...choice,target:{kind:'ingredient',identity:{kind:'resolved',ingredientId:'niacinamide'}}}),/reviewed exact/i);
});
test('mounted preference chooser offers the selected vocabulary only',()=>{
 const dictionary=structuredClone(dictionaryRelease);dictionary.identities=[{...dictionary.identities[0],ingredientId:'synthetic-selected-only',preferredName:'Synthetic selected only'}];dictionary.aliases=[];dictionary.explanations=[];dictionary.explanationPolicies=[];dictionary.contentHash=dictionaryReleaseHash(dictionary);
 const view=componentHarness('src/components/p0b-personalization/PreferenceChoices.tsx','PreferenceChoices',{dictionaryRelease:dictionary,preferences:[],createId:()=>p2id(811),onChange:()=>{}},{modules:{'../ui/Button':{Button:'Button'},'../ui/ChoiceChip':{ChoiceChip:'ChoiceChip'},'../ui/QuestionGroup':{QuestionGroup:'QuestionGroup'}}});
 try{press(control(view.render(),'Add a confirmed preference'));const nodes=view.render();assert(control(nodes,'Choose exact ingredient: Synthetic selected only'));assert.doesNotMatch(textContent(nodes),/Choose exact ingredient: Niacinamide/);}finally{view.dispose();}
});
test('ordinary composition refuses fixture approval, unapproved semantics and a different hosted target',()=>{
 const deployment={url:'https://snojlbqovlawewwqbviz.supabase.co',selectedReleaseId:semanticRelease.id};
 assert.throws(()=>selectedPartThreeRelease(releaseSelection,deployment),/ordinary|reviewed/i);
 const dictionary=structuredClone(dictionaryRelease);dictionary.releaseGate='reviewed_public';dictionary.provenance.reviewDecision='approved';dictionary.aliases=dictionary.aliases.map(a=>({...a,reviewDecision:'approved'}));dictionary.contentHash=dictionaryReleaseHash(dictionary);
 const approved={dictionaryRelease:dictionary,semanticRelease:{...semanticRelease,productionApproved:true,reviewScope:'reviewed_original_semantics' as const}};
 assert.throws(()=>selectedPartThreeRelease(approved,{...deployment,url:'https://other.supabase.co'}),/ordinary|target/i);
 assert.throws(()=>selectedPartThreeRelease(approved,{...deployment,selectedReleaseId:'different'}),/ordinary|release/i);
 assert.doesNotThrow(()=>selectedPartThreeRelease(approved,deployment));
});
test('compiled original bundle enters only the exact ordinary selector and carries no inherited function permission',()=>{
 const bundle=ORDINARY_PART_THREE_RELEASE_SELECTION;assert(bundle);const selected=ordinaryPartThreeRelease('https://snojlbqovlawewwqbviz.supabase.co',bundle.semanticRelease.id);assert(selected);
 assert.equal(ordinaryPartThreeRelease('https://other.supabase.co',bundle.semanticRelease.id),null);assert.equal(ordinaryPartThreeRelease('https://snojlbqovlawewwqbviz.supabase.co','unknown'),null);assert.equal(ordinaryPartThreeRelease('https://snojlbqovlawewwqbviz.supabase.co',undefined),null);
 assert.equal(bundle.dictionaryRelease.explanations.length,0);assert.equal(bundle.dictionaryRelease.explanationPolicies.length,0);assert(bundle.dictionaryRelease.identities.every(i=>i.externalReferences.length===0));
 const result=normalize(boundLabelDeclaration('Moisturizes facial skin. Leave on.','purpose','public'),bundle.dictionaryRelease,p2metadata);assert.equal(result.state,'ready');if(result.state==='ready'){assert.equal(result.output.reading.occurrences[0].mapping.state,'resolved');assert.equal(result.output.reading.facts.some(f=>f.kind==='reference_function'),false);}
 assert.equal(LOCAL_DICTIONARY_RELEASE.releaseGate,'local_only');assert.equal(PART_THREE_RELEASE.productionApproved,false);
});
test('client and handler agree on selected semantic pins through exact Save',async()=>{
 const x=input();x.context.profile!.id=p2id(800);
 const target=partThreeTarget(x.context,x.partTwo,{ownerId:x.context.ownerId,accountGeneration:1,encounterId:p2id(801),generation:1},{intent:'add',comparatorId:null,candidateRoutineItemId:null,selectedManualReportIds:[],use:x.requestedUse},null,null,false,undefined,releaseSelection)!;
 assert.equal(target.binding.releases.releaseHash,releaseHash);
 let packet:any=null,saved:any=null;
 const host:PartThreePorts & {releaseSelection:typeof releaseSelection}={releaseSelection,ownerId:x.context.ownerId,now:()=>x.now,normalize:async()=>x.partTwo,context:async()=>x.context,history:async()=>({items:[],nextCursor:null,atRevision:x.context.revision}),worker:async(action,payload)=>{if(action==='encounter/read')return {};if(action==='prepare')return {resultId:p2id(802),resultRevision:1,leaseToken:p2id(803)};if(action==='provider/gate')return {allowed:false};if(action==='publish'){packet=payload.result;return {kind:'result',result:packet,replayed:false};}if(action==='read')return {kind:'result',result:packet,replayed:true};if(action==='save'){saved=payload;return {kind:'saved',savedAssessmentId:p2id(804),resultRevision:1,replayed:false};}throw Error(action);}};
 const controller=createPartThreeController({request:r=>handlePersonalRequest(r,host)},()=>p2id(805),()=>{},()=>Date.parse(x.now));controller.bind(target);
 assert.equal(await controller.evaluate(),true);assert.equal(controller.getView().result!.binding.releases.releaseHash,releaseHash);
 assert.equal(await controller.save(),p2id(804));assert.ok(saved.expectedBindingHash);
 const wrong={...target,binding:{...target.binding,releases:{...target.binding.releases,releaseHash:'0'.repeat(64)}}};controller.bind(wrong);assert.equal(await controller.evaluate(),false);assert.equal(controller.getView().result,null);
});
