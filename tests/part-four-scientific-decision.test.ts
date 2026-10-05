import assert from 'node:assert/strict';
import test from 'node:test';
import {p3input} from './fixtures/part-three.ts';
import {PENDING_SCIENTIFIC_RECORDS} from '../src/domain/part-four/science-candidates.ts';
import {claimSourcePin,scientificClaimHash} from '../src/domain/part-four/claimApplicability.ts';
import {ScientificClaimSchema} from '../src/contracts/ScientificClaim.ts';
import {handlePersonalRequest,type PartThreePorts} from '../supabase/functions/part-three/handler.ts';
import {p2id} from './fixtures/part-two-core.ts';
import {decisionCopy} from '../src/presentation/part-three/copy.ts';
import {evaluatePersonalResult} from '../src/domain/part-three/evaluate.ts';
import {partFourBindingRelease} from '../src/domain/part-four/release.ts';
const api=await import('../src/domain/part-four/scientificDecision.ts').catch(()=>null);
test('scientific decision composition exists upstream of canonical judgment',()=>assert(api,'Missing scientific decision integration'));
const claims=(PENDING_SCIENTIFIC_RECORDS as unknown[]).map(c=>ScientificClaimSchema.parse(c));
function fixture(){assert(api);const x=p3input();x.context.profile!.data.primaryGoal={state:'known',value:'oiliness'};x.context.profile!.data.secondaryGoals=['texture'];const c=claims.find(c=>c.id==='G02-01')!;
 const fixtureClaims=claims.map(c=>({...c,sourceRefs:c.sourceRefs.map(s=>({...s,retrievedAt:'2026-10-01'}))}));const c2=fixtureClaims.find(c=>c.id==='G02-01')!;
 const until=x.partTwo.expiresAt,manifest=api.buildScientificManifest(fixtureClaims,[{claimId:c.id,claimHash:scientificClaimHash(c2),status:'approved',reviewerId:'fixture:reviewer',qualificationRef:'fixture:qualification',reviewedAt:x.now,sourcePins:c2.sourceRefs.map(claimSourcePin),rights:{grantId:'fixture:grant',version:'1',process:true,store:true,display:true,export:true,validUntil:until,revoked:false},validUntil:until}]);
 // Research source date precedes this synthetic evaluation; no real rule release.
 const now=x.now;manifest.admissions[0].reviewedAt=now;manifest.contentHash=api.scientificManifestHash(manifest);
 const evidence={ownerId:x.context.ownerId,partTwoBindingKey:x.partTwo.bindingKey,partTwoRevision:x.partTwo.resultRevision,sourceDigest:x.binding.sourceDigest,contextRevision:x.context.revision,manifestHash:manifest.contentHash,claims:[{claimId:c.id,goal:'oiliness',features:Object.fromEntries(c.applicability.map(p=>[p.field,{state:'known',values:[p.expected[0]],factIds:['fixture:claim-fact'],contextRevisionIds:[],sourceIds:['fixture:claim-source'],validUntil:until}]))}]};
 for(const a of manifest.admissions){a.validUntil=until;a.rights.validUntil=a.validUntil;}manifest.contentHash=api.scientificManifestHash(manifest);evidence.manifestHash=manifest.contentHash;
 return {x,manifest,evidence,now};
}
test('exact synthetic evidence supports only its reported goal and keeps missing texture coverage visible',()=>{assert(api);const f=fixture();const r=api.assessScientificDecision({...f,context:f.x.context,partTwo:f.x.partTwo});assert.equal(r.assessments.find(a=>a.goal==='oiliness')?.assessment.state,'supported');assert(r.unresolvedGoals.includes('texture'));assert(!r.unresolvedGoals.includes('oiliness'));});
test('owner/context/formula/manifest substitution cannot consume trusted features',()=>{assert(api);const f=fixture();for(const key of ['ownerId','contextRevision','partTwoBindingKey','manifestHash']){const e={...f.evidence,[key]:key==='contextRevision'?99:'foreign'};assert.throws(()=>api!.assessScientificDecision({...f,evidence:e,context:f.x.context,partTwo:f.x.partTwo}),/binding|manifest|Invalid/);}});
test('oiliness evidence cannot earn a blemish or texture judgment and pending admission keeps the goal unresolved',()=>{assert(api);const f=fixture();f.x.context.profile!.data.primaryGoal={state:'known',value:'breakouts'};f.evidence.claims[0].goal='breakouts';const r=api.assessScientificDecision({...f,context:f.x.context,partTwo:f.x.partTwo});assert(r.unresolvedGoals.includes('breakouts'));assert(!r.assessments.some(a=>a.assessment.state==='supported'));});
async function canonical(pending=false,secondary:('texture')[]=[]){assert(api);const f=fixture();f.x.context.profile!.id=p2id(101);f.x.context.profile!.data.secondaryGoals=secondary;
 if(pending){f.manifest.admissions=[];f.manifest.contentHash=api.scientificManifestHash(f.manifest);f.evidence.manifestHash=f.manifest.contentHash;}
 const ports:PartThreePorts={partFourEnabled:true,ownerId:f.x.context.ownerId,now:()=>f.now,normalize:async()=>f.x.partTwo,context:async()=>f.x.context,history:async()=>({items:[],nextCursor:null,atRevision:1}),worker:async(action,payload)=>action==='encounter/read'?{}:action==='prepare'?{resultId:p2id(120),resultRevision:2,leaseToken:p2id(121)}:action==='publish'?{kind:'result',result:payload.result,replayed:false}:action==='provider/gate'?{allowed:false}:[]};
 (ports as any).partFourDecisionEvidence={manifest:f.manifest,load:async()=>f.evidence};
 const request={operation:'evaluate',requestId:p2id(110),encounterId:p2id(111),accountGeneration:1,generation:1,scanId:f.x.partTwo.scanId,captureSessionId:f.x.partTwo.captureSessionId,expectedPartOneGeneration:f.x.partTwo.generation,expectedPartOneRevision:f.x.partTwo.evidenceRevision,intent:'add',comparatorId:null,candidateRoutineItemId:null,selectedManualReportIds:[],use:f.x.requestedUse,savedAssessmentId:null};
 const r=await handlePersonalRequest(request,ports);assert.equal(r.kind,'result');if(r.kind!=='result')throw Error('no result');return r.result;
}
test('trusted local scientific mode participates in canonical judgment and visible reason; HTTP input cannot supply it',async()=>{
 const r=await canonical();assert(r.partFour?.scientificDecision,'Canonical packet lacks scientific assessment');assert.equal(r.summary?.judgment,'worth_considering');assert.equal(r.partFour.decisionState,'supported');assert.match(decisionCopy(r).reason,/oiliness/);assert.equal(r.binding.releases.partFour?.scientificManifestHash,r.partFour.scientificDecision.manifestHash);
});
test('actual pending records cannot earn a green judgment through the canonical local mode',async()=>{
 const r=await canonical(true);assert(r.partFour?.scientificDecision);assert.equal(r.partFour.decisionState,'pending');assert.notEqual(r.summary?.judgment,'worth_considering');assert(r.partFour.scientificDecision.unresolvedGoals.includes('oiliness'));
});
test('unresolved secondary goal keeps the canonical judgment pending with distinct goal and personal gaps',async()=>{
 const r=await canonical(false,['texture']);assert.equal(r.partFour?.decisionState,'pending');assert.notEqual(r.summary?.judgment,'worth_considering');assert(r.materialGaps.some(g=>g.affectedPropositionIds.includes('personal-candidacy')));assert(r.materialGaps.some(g=>g.affectedPropositionIds.includes('goal:texture')));
});
test('displayed reference prose and Sources cap the result lease at their own admission deadline',()=>{
 assert(api);const f=fixture();const claim=f.manifest.claims.find(c=>c.id==='G01-02')!;
 f.x.context.profile!.data.primaryGoal={state:'known',value:'dryness'};f.x.context.profile!.data.secondaryGoals=[];
 const until=new Date(Date.parse(f.now)+1000).toISOString();
 f.manifest.admissions=[{claimId:claim.id,claimHash:scientificClaimHash(claim),status:'approved',reviewerId:'fixture:reference-reviewer',qualificationRef:'fixture:reference-qualification',reviewedAt:f.now,sourcePins:claim.sourceRefs.map(claimSourcePin),rights:{grantId:'fixture:reference-grant',version:'1',process:true,store:true,display:true,export:true,validUntil:until,revoked:false},validUntil:until}];
 f.manifest.contentHash=api.scientificManifestHash(f.manifest);
 const evidence={...f.evidence,manifestHash:f.manifest.contentHash,claims:[{claimId:claim.id,goal:'dryness',features:Object.fromEntries(claim.applicability.map(p=>[p.field,{state:'known',values:[p.expected[0]],factIds:['fixture:reference-fact'],contextRevisionIds:[],sourceIds:['fixture:reference-source'],validUntil:f.x.partTwo.expiresAt}]))}]};
 const science=api.assessScientificDecision({...f,evidence,context:f.x.context,partTwo:f.x.partTwo});assert.equal(science.assessments.find(r=>r.assessment.claimId===claim.id)?.assessment.state,'reference');
 f.x.binding.releases.partFour=partFourBindingRelease(undefined,f.manifest.contentHash);
 const result=evaluatePersonalResult({...f.x,scientificDecision:science});assert.equal(result.validUntil,until);
 assert.throws(()=>evaluatePersonalResult({...f.x,now:until,scientificDecision:science}),/Displayed scientific evidence expired/);
});
