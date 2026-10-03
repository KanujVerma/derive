import assert from 'node:assert/strict';
import test from 'node:test';
import { planRoutineFormulaRequests, admitRoutineFormulaEvidence, type RoutineFormulaReadyEvidence } from '../src/domain/part-four/routineFormula.ts';
import { buildFoundationInsights } from '../src/domain/part-four/foundations.ts';
import { p3input, p3routine, p3revision } from './fixtures/part-three.ts';
import { boundDeclaration, p2id, p2metadata, p2now, p2expiry } from './fixtures/part-two-core.ts';
import { normalize, LOCAL_DICTIONARY_RELEASE } from '../src/domain/part-two/index.ts';
function fixture() {
 const x=p3input(), item=p3routine(p2id(301));item.reference={kind:'catalog',productId:p2id(302),variantId:p2id(303),formulaVersionId:p2id(304)};
 x.context.routine=p3revision(p2id(305),{completeness:'partial',items:[item]});
 const p=normalize(boundDeclaration('Glycerin','public'),LOCAL_DICTIONARY_RELEASE,p2metadata);
 if(p.state!=='ready'||p.output.kind!=='bound'||p.output.productFacts.binding.kind!=='declaration')throw Error('fixture');
 const request=planRoutineFormulaRequests(x.context).requests[0], b=p.output.productFacts.binding;
 const evidence:RoutineFormulaReadyEvidence={version:'routine-formula-evidence/v1',request,state:'ready',association:{id:p2id(306),revision:1,reference:request.reference,partOneItemId:b.itemId,partOneSnapshotId:b.snapshotId,declarationId:b.declarationId,declarationRevision:b.declarationRevision,partTwoSnapshotId:p2id(307),partTwoBindingKey:p.bindingKey,partTwoRevision:p.resultRevision,dependencyDigest:b.dependencyDigest,sourceDependencies:p.output.productFacts.dependencyManifest.sourceRefs.map(s=>s.observationId),validUntil:p2expiry,revoked:false},authorization:{authorityId:p2id(308),authorityRevision:1,checkedAt:p2now,validUntil:p2expiry,evaluate:true,display:true,store:true,revoked:false,withdrawnDependencies:[],sourcePermissions:p.output.productFacts.dependencyManifest.sourceRefs.map(s=>({observationId:s.observationId,sourceRevision:s.sourceRevision,policyId:s.policyId,policyVersion:s.policyVersion,grantId:p2id(309),grantVersion:'grant-v1',evaluate:true,display:true,store:true,revoked:false,validUntil:s.expiresAt}))},partTwo:p};
 return {x,item,evidence};
}
test('plans only active exact catalog references and pins routine item/use and shared knowledge',()=>{
 const f=fixture(), paused=p3routine(p2id(311));paused.state='paused';const manual=p3routine(p2id(312));const incomplete=p3routine(p2id(313));incomplete.reference={kind:'catalog',productId:p2id(302),variantId:p2id(303),formulaVersionId:null};f.x.context.routine!.data.items.push(paused,manual,incomplete);
 const plan=planRoutineFormulaRequests(f.x.context);assert.equal(plan.requests.length,1);assert.equal(plan.requests[0].routineRevisionId,f.x.context.routine!.id);assert.equal(plan.requests[0].contextRevision,f.x.context.revision);assert.match(plan.requests[0].routineItemHash,/^[a-f0-9]{64}$/);assert.equal(plan.items.length,3);assert.equal(plan.items.find(i=>i.routineItemId===manual.id)!.state,'missing');
 const old=plan.requests[0].routineItemHash;f.item.timing='am';assert.notEqual(planRoutineFormulaRequests(f.x.context).requests[0].routineItemHash,old);
});
test('admitted exact formula has explicit normalized/source/association dependencies and supports factual co-presence with unknown amount',()=>{
 const {x,item,evidence}=fixture(), result=admitRoutineFormulaEvidence(x.context,[evidence],{now:p2now});assert.equal(result.items[0].state,'ready');assert.equal(result.qualified.length,1);assert.equal(result.qualified[0].formula.ingredients[0].quantityText,null);assert(result.dependencyIds.includes(evidence.association.id));assert(result.dependencyIds.includes(evidence.authorization.sourcePermissions[0].grantId));assert.equal(Date.parse(result.validUntil!),Date.parse(p2expiry));
 const packet=buildFoundationInsights({context:x.context,partTwo:x.partTwo,requestedUse:x.requestedUse,intent:'add',candidateRoutineItemId:null,selectedComparatorId:null,routineFormulas:result.qualified,now:p2now});const finding=packet.insights.find(i=>i.ruleId==='F07'&&i.state==='supported');assert(finding);assert.match(finding.explanation,/Glycerin/);assert.match(finding.explanation,/Session overlap is unknown/);assert.equal(finding.action,null);assert(finding.contextRevisionIds.includes(x.context.routine!.id));assert(finding.occurrenceIds.length);assert(item.reference.kind==='catalog');
});
test('owner, variant, formula, routine revision, use hash, declaration and knowledge mismatches never feed rules',()=>{
 for(const mutate of [(e:RoutineFormulaReadyEvidence)=>e.request.ownerId=p2id(399),(e:RoutineFormulaReadyEvidence)=>e.request.reference.variantId=p2id(399),(e:RoutineFormulaReadyEvidence)=>e.association.reference.formulaVersionId=p2id(399),(e:RoutineFormulaReadyEvidence)=>e.request.routineRevisionId=p2id(399),(e:RoutineFormulaReadyEvidence)=>e.request.routineItemHash='f'.repeat(64),(e:RoutineFormulaReadyEvidence)=>e.association.declarationId=p2id(399),(e:RoutineFormulaReadyEvidence)=>e.request.knowledgeHash='f'.repeat(64)]){
  const f=fixture(), changed=structuredClone(f.evidence);mutate(changed);const result=admitRoutineFormulaEvidence(f.x.context,[changed],{now:p2now});assert.equal(result.qualified.length,0);assert.notEqual(result.items[0].state,'ready');
 }
});
test('stale authority or sources, denied operations and withdrawn dependencies preserve specific states without protected formula bytes',()=>{
 for(const [expected,mutate] of [['stale',(e:RoutineFormulaReadyEvidence)=>e.authorization.validUntil=p2now],['stale',(e:RoutineFormulaReadyEvidence)=>e.authorization.sourcePermissions[0].validUntil=p2now],['denied',(e:RoutineFormulaReadyEvidence)=>e.authorization.display=false],['denied',(e:RoutineFormulaReadyEvidence)=>e.authorization.sourcePermissions[0].evaluate=false],['denied',(e:RoutineFormulaReadyEvidence)=>e.authorization.withdrawnDependencies=[e.association.id]],['denied',(e:RoutineFormulaReadyEvidence)=>e.authorization.revoked=true]] as const){const f=fixture(),changed=structuredClone(f.evidence);mutate(changed);const r=admitRoutineFormulaEvidence(f.x.context,[changed],{now:p2now});assert.equal(r.items[0].state,expected);assert.deepEqual(r.qualified,[]);assert(!JSON.stringify(r).includes('Glycerin'));}
});
test('missing, pending, denied and conflicting worker results remain separate; duplicate formula packets conflict',()=>{
 const f=fixture();for(const state of ['missing','pending','denied','conflict','unavailable'] as const){const r=admitRoutineFormulaEvidence(f.x.context,[{version:'routine-formula-evidence/v1',request:f.evidence.request,state,reasonCodes:[`source_${state}`]}],{now:p2now});assert.equal(r.items[0].state,state);assert.deepEqual(r.qualified,[]);}
 assert.equal(admitRoutineFormulaEvidence(f.x.context,[],{now:p2now}).items[0].state,'missing');assert.equal(admitRoutineFormulaEvidence(f.x.context,[f.evidence,f.evidence],{now:p2now}).items[0].state,'conflict');
});
test('partial routine and unmatched supplied formula cannot earn absence or a clinical interaction conclusion',()=>{
 const f=fixture(), r=admitRoutineFormulaEvidence(f.x.context,[f.evidence],{now:p2now});f.item.state='stopped';assert.deepEqual(admitRoutineFormulaEvidence(f.x.context,[f.evidence],{now:p2now}).qualified,[]);
 const packet=buildFoundationInsights({context:f.x.context,partTwo:f.x.partTwo,requestedUse:f.x.requestedUse,intent:'add',candidateRoutineItemId:null,selectedComparatorId:null,routineFormulas:r.qualified,now:p2now});assert.equal(packet.insights.find(i=>i.ruleId==='F07')!.state,'unknown');
});
test('production admission rejects a future trusted-worker check without a clock tolerance',()=>{
 const f=fixture();f.evidence.authorization.checkedAt=new Date(Date.parse(p2now)+1).toISOString();
 const result=admitRoutineFormulaEvidence(f.x.context,[f.evidence],{now:p2now});
 assert.equal(result.items[0].state,'stale');assert.deepEqual(result.qualified,[]);
});
