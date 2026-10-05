import assert from 'node:assert/strict';
import { handlePartTwoRequest, normalizeAuthorized, authoritativeInput, overlayRequest, LOCAL_DICTIONARY_RELEASE, PART_TWO_VERSIONS, PART_TWO_RELEASE_ID } from '../supabase/functions/_shared/part-two-runtime.ts';
import { NormalizationResultSchema } from '../src/contracts/PartTwo.ts';
import { sha256 } from '../src/domain/part-two/hash.ts';
const owner='f2000000-0000-4000-8000-000000000001',scan='f2000000-0000-4000-8000-000000000002',capture='f2000000-0000-4000-8000-000000000003',obs='f2000000-0000-4000-8000-000000000004';
const now='2026-10-02T01:00:00Z',expiresAt='2026-10-03T01:00:00Z';
const request={schemaVersion:1 as const,requestId:'f2000000-0000-4000-8000-000000000005',scanId:scan,captureSessionId:capture,expectedGeneration:0,expectedEvidenceRevision:2};
const observation={id:obs,kind:'observation' as const,revision:1,policyId:'private_capture',policyVersion:'fixture-1',ownerId:owner,scope:'private_package' as const,payload:{rawText:'Niacinamide, Mystery Name',privateKind:'ocr',role:'ingredients',observation:{status:'recognized'},uncertaintyReasons:[]},dependencies:[],identityDependencies:[],observedAt:now,expiresAt,status:'active' as const,statusRevision:1};
const ctx={ownerId:owner,scanId:scan,capture:{captureSessionId:capture,packageObservationId:'f2000000-0000-4000-8000-000000000006',captureRevision:1,generation:0,deletionEpoch:0,removed:false},generation:0,evidenceRevision:2,bindingRevision:2,policyEpoch:1,withdrawnExplanationDependencies:[],deletionEpoch:0,result:{packageConfirmation:'unconfirmed',display:{sections:[{sectionId:'section',kind:'ingredients',text:'Niacinamide, Mystery Name'}]}},declaration:null,snapshot:null,dependencies:[observation],observations:[observation],policies:[{id:'private_capture',version:'fixture-1',retainAllowed:true,displayAllowed:true,exportAllowed:false,epoch:1,expiresAt}],expiresAt,state:'pending' as const,releaseId:PART_TWO_RELEASE_ID,releaseHash:LOCAL_DICTIONARY_RELEASE.contentHash,versions:PART_TWO_VERSIONS,releaseEpoch:1,contextDigest:sha256('context'),dependencyDigest:sha256('deps'),bindingKey:sha256('owner:scan:capture')};
const ticket={bindingKey:ctx.bindingKey,leaseToken:'f2000000-0000-4000-8000-000000000007',contextDigest:ctx.contextDigest,expectedResultRevision:1};
let current:unknown=null,calls=0;
const ports={localFixtureApproved:true,authorize:async()=>owner,now:()=>now,operation:async()=>({context:ctx,resultRevision:current?2:1,state:current?'ready':'pending',reasonCodes:[],cached:current,ticket:current?null:ticket}),worker:async(_action:string,payload:Record<string,unknown>)=>{calls++;const body=payload.result as Record<string,unknown>;current={...body,resultRevision:2};return {published:true,result:current};}};
const ready=await normalizeAuthorized(request,owner,ports);
assert.equal(ready.state,'ready');
if(ready.state==='ready'){
 assert.equal(ready.output.kind,'reading_only');assert.equal(ready.output.reading.claimLimits.productPresenceAllowed,false);
 assert.equal(ready.output.reading.occurrences[0].mapping.state,'resolved');
 assert.equal(ready.output.reading.occurrences[1].mapping.state,'unresolved');
 assert(ready.output.reading.facts.every(f=>f.subject.kind!=='bound_declaration_entry'));
}
const replay=await normalizeAuthorized({...request,requestId:'new-request'},owner,ports);
assert.equal(replay.resultRevision,ready.resultRevision);assert.equal(replay.requestId,'new-request');assert.equal(calls,1,'reopen reuses deterministic saved snapshot');
assert.equal(NormalizationResultSchema.safeParse(replay).success,true);
assert.throws(()=>authoritativeInput({...ctx,observations:[{...observation,ownerId:'foreign'}],policies:[]},request));
const terminal=await normalizeAuthorized(request,owner,{...ports,operation:async()=>({context:{...ctx,state:'blocked'},state:'blocked',resultRevision:3,reasonCodes:['withdrawn'],cached:null,ticket:null})});
assert.equal(terminal.state,'blocked');assert(!('output'in terminal));assert.equal(terminal.authenticatedOwnerId,owner);
const stale=await normalizeAuthorized(request,owner,{...ports,operation:async()=>({context:ctx,state:'pending',resultRevision:1,reasonCodes:[],cached:null,ticket}),worker:async()=>({published:false,reason:'stale_work'})});
assert.equal(stale.state,'pending');assert(!('output'in stale));
const outage=await normalizeAuthorized(request,owner,{...ports,operation:async()=>({context:ctx,state:'pending',resultRevision:1,reasonCodes:[],cached:null,ticket}),worker:async()=>{throw new Error('local publication unavailable');}});
assert.equal(outage.state,'pending','durable pending work survives publication outage without fake facts');
assert.throws(()=>overlayRequest({...ready,authenticatedOwnerId:'foreign'},request));
for(const throws of [false,true]){
 let resolveCalls=0;
 const race=await normalizeAuthorized(request,owner,{...ports,operation:async()=>{resolveCalls++;return {context:resolveCalls===1?ctx:{...ctx,state:'blocked',dependencies:[],observations:[]},state:resolveCalls===1?'pending':'blocked',resultRevision:resolveCalls===1?1:3,reasonCodes:resolveCalls===1?[]:['withdrawn'],cached:null,ticket:resolveCalls===1?ticket:null};},worker:async()=>{if(throws)throw new Error('revoked while transport failed');return {published:false,reason:'stale_work'};}});
 assert.equal(resolveCalls,2,'publication refusal/error must reauthorize');assert.equal(race.state,'blocked');assert.equal(race.resultRevision,3);assert.equal(race.permittedText,null,'old private literal never returned after failure/revocation race');
}
let policyPublished=false;
const policyBlocked=await normalizeAuthorized(request,owner,{...ports,localFixtureApproved:false,operation:async()=>({context:ctx,state:'pending',resultRevision:1,reasonCodes:[],cached:null,ticket}),worker:async(_action,payload)=>{policyPublished=true;return {published:true,result:{...(payload.result as Record<string,unknown>),resultRevision:2}};}});
assert.equal(policyBlocked.state,'blocked');assert.equal(policyBlocked.resultRevision,2);assert.equal(policyPublished,true,'local release refusal publishes a monotonic terminal work state');
const response=await handlePartTwoRequest(new Request('http://localhost/part-two/normalize',{method:'POST',body:JSON.stringify({...request,productPresenceAllowed:true})}),ports);
assert.equal(response.status,400,'request rejects forged authority flags');
const malformed=await handlePartTwoRequest(new Request('http://localhost/part-two/normalize',{method:'POST',body:' '.repeat(17000)}),ports);assert.equal(malformed.status,413);
const foreign=await handlePartTwoRequest(new Request('http://localhost/part-two/normalize',{method:'POST',body:JSON.stringify(request)}),{...ports,authorize:async()=>'foreign'});assert.equal(foreign.status,503,'server output cannot hydrate a switched account');
console.log('Part 2 backend: authenticated runtime, strict states, unknowns, cache replay, race refusal and bounds passed');
