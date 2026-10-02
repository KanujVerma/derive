import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalJson, sha256 } from '../src/domain/part-two/hash.ts';
import { createJevProvider, type AuthorizedProjection, type EligibleMenu, type JevTransport, type NormalizedSelection } from '../src/domain/part-three/provider.ts';
import { PART_THREE_EVALUATION, PART_THREE_EVALUATION_HASH, evaluationMenuVariant, scoreEvaluationSelection } from '../src/domain/part-three/evaluation.ts';
const base = { candidateSetId: 'synthetic-menu', jobs: [
    {id: 'prioritize_tradeoff' as const, options: [{id:'none',description:'No tradeoff'},{id:'trade-a',description:'Selected replacement relation'},{id:'trade-b',description:'Optional burden difference'}]},
    {id: 'select_question' as const, options: [{id:'none',description:'No question'},{id:'ask-a',description:'Clarify intent'},{id:'ask-b',description:'Clarify site'}]},
], compatiblePairs: [[null,null],['trade-a','ask-a'],['trade-b',null]] as Array<[string|null,string|null]> };
const menu:EligibleMenu={...base,candidateSetHash:sha256(canonicalJson(base))};
const projection:AuthorizedProjection={version:'part-three-provider-projection/v1',purpose:'optional_content_selection',approvalId:'synthetic-only',fields:[{id:'intent',value:'unknown',externalOperationGrant:'synthetic-grant',sourceFieldId:'synthetic-field'}]};
function transport(choose:(description:string)=>boolean):JevTransport {
 return {async send(request) {
    assert.equal(request.model,PART_THREE_EVALUATION.provider.configuredModel);
    assert.equal(JSON.stringify(request).includes('synthetic-grant'),false);
    assert.equal(JSON.stringify(request).includes('synthetic-only'),false);
    const answers=Object.fromEntries(Object.entries(request.questions).map(([id,q])=>{
        assert.equal(q.instructions,PART_THREE_EVALUATION.provider.instructions[id as keyof typeof PART_THREE_EVALUATION.provider.instructions]);
        const entries=Object.entries(q.criteria),choice=entries.find(([,description])=>choose(description))?.[0];
        assert(choice);return [id,{type:'choice',choice,probabilities:Object.fromEntries(entries.map(([key])=>[key,key===choice?1:0])),confidence:1}];
    }));
    return JSON.stringify({model:request.model,answers,usage:{input_tokens:100,output_tokens:10}});
 }};
}
async function replay(value:EligibleMenu, choose:(description:string)=>boolean=(description:string)=>description==='Selected replacement relation'||description==='Clarify intent') {
    return createJevProvider(transport(choose),PART_THREE_EVALUATION.provider.configuredModel).evaluate(projection,value,new AbortController().signal,Date.now()+1500);
}
test('proposed manifest is deeply frozen, content-addressed, balanced and grants no evaluation or processing permission',()=>{
 assert.equal(PART_THREE_EVALUATION_HASH,sha256(canonicalJson(PART_THREE_EVALUATION)));
 assert.equal(PART_THREE_EVALUATION_HASH,'ef41abd4b741cb82d58b09d65e6bbc5e9910daa59fe8b0737980de0d8c8beb3a','A changed proposal requires an explicit new freeze/version');
 assert.equal(Object.values(PART_THREE_EVALUATION.corpus.developmentStrata).reduce((a,b)=>a+b,0),80);
 assert.equal(Object.values(PART_THREE_EVALUATION.corpus.holdoutStrata).reduce((a,b)=>a+b,0),240);
 assert.equal(PART_THREE_EVALUATION.corpus.authored,0);assert.equal(PART_THREE_EVALUATION.corpus.corpusHash,null);
 assert.equal(PART_THREE_EVALUATION.gates.credentialedCallsAllowed,false);assert.equal(PART_THREE_EVALUATION.gates.approvedSpendMinorUnits,0);
 assert.equal(PART_THREE_EVALUATION.results.liveEvaluationRuns,0);
 assert.throws(()=>Object.assign(PART_THREE_EVALUATION.provider.protocol,{maxAttempts:99}),TypeError);
 assert.throws(()=>Object.assign(PART_THREE_EVALUATION.tasks[0],{maxCandidates:99}),TypeError);
});
test('semantic selection survives every job/order/neutral-ID combination through the real adapter with injected responses',async()=>{
 const before=canonicalJson(menu);
 for(const reverseJobs of [false,true])for(const reverseOptions of [false,true])for(const renameNeutralIds of [false,true]){
    const variant=evaluationMenuVariant(menu,{reverseJobs,reverseOptions,renameNeutralIds});
    const selected=variant.restore(await replay(variant.menu));
    assert.equal(selected.outcome,'accepted');assert.equal(selected.selectedTradeoffId,'trade-a');assert.equal(selected.selectedQuestionId,'ask-a');
    assert.notEqual(variant.menu.candidateSetHash,menu.candidateSetHash);
    if(renameNeutralIds)assert(!JSON.stringify(variant.menu).includes('trade-a'));
    assert.deepEqual(scoreEvaluationSelection({acceptableVectors:[['trade-a','ask-a']]},selected),{prioritizeTradeoff:1,selectQuestion:1,wholeVector:1,outcome:'accepted'});
 }
 assert.equal(canonicalJson(menu),before);
});
test('incompatible independent choices remain rejected after neutral renaming and order changes',async()=>{
 const variant=evaluationMenuVariant(menu,{reverseJobs:true,reverseOptions:true,renameNeutralIds:true});
 const selected=await replay(variant.menu,description=>description==='Optional burden difference'||description==='Clarify intent');
 assert.equal(selected.outcome,'invalid');assert.deepEqual([selected.selectedTradeoffId,selected.selectedQuestionId],[null,null]);
 assert.equal(scoreEvaluationSelection({acceptableVectors:[[null,null]]},variant.restore(selected)).wholeVector,0);
 assert.throws(()=>variant.restore({...selected,selectedQuestionId:'unknown-neutral'}),/transformed job/);
});
test('abstention, multiple acceptable vectors and failed attempts have distinct fair scores',()=>{
 const choice:NormalizedSelection={selectedTradeoffId:null,selectedQuestionId:null,provider:'injected',resolvedModel:'jev-1.13.0',usage:{inputTokens:1,outputTokens:1},elapsedMs:0,contractVersion:'part-three-selection/v1',outcome:'abstained'};
 assert.equal(scoreEvaluationSelection({acceptableVectors:[[null,null]]},choice).wholeVector,1);
 assert.equal(scoreEvaluationSelection({acceptableVectors:[['trade-a','ask-a']]},choice).wholeVector,0);
 const crossed={...choice,outcome:'accepted' as const,selectedTradeoffId:'trade-a',selectedQuestionId:null};
 assert.deepEqual(scoreEvaluationSelection({acceptableVectors:[['trade-a','ask-a'],['trade-b',null]]},crossed),{prioritizeTradeoff:1,selectQuestion:1,wholeVector:0,outcome:'accepted'});
 for(const outcome of ['invalid','timeout','unavailable','disallowed'] as const)assert.equal(scoreEvaluationSelection({acceptableVectors:[[null,null]]},{...choice,outcome}).wholeVector,0);
 assert.equal(scoreEvaluationSelection({acceptableVectors:[['trade-a',null]]},{...choice,selectedTradeoffId:'trade-a'}).wholeVector,0);
 assert.throws(()=>scoreEvaluationSelection({acceptableVectors:[]},choice),/adjudicated/);
});
