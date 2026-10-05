import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeAuthorized, PART_TWO_VERSIONS, type PartTwoPorts } from '../supabase/functions/_shared/part-two-runtime.ts';
import { LOCAL_DICTIONARY_RELEASE, dictionaryReleaseHash, type DictionaryRelease } from '../src/domain/part-two/dictionary.ts';
import { canonicalJson, sha256 } from '../src/domain/part-two/hash.ts';

// Synthetic server/storage boundary only; this grants no operational release.
const dictionary:DictionaryRelease=structuredClone(LOCAL_DICTIONARY_RELEASE);
dictionary.version='selected-test-only-v1';dictionary.explanationVersion='no-explanation-test-v1';
dictionary.releaseGate='reviewed_public';dictionary.provenance.reviewDecision='approved';
dictionary.explanations=[];dictionary.explanationPolicies=[];
dictionary.aliases=dictionary.aliases.map(a=>({...a,release:dictionary.version,reviewDecision:'approved'}));
dictionary.aliases.push({...dictionary.aliases.find(a=>a.ingredientId==='niacinamide')!,aliasRecordId:'test-only-surface',surface:'Test Selected Surface',lookupKey:'test selected surface'});
dictionary.contentHash=dictionaryReleaseHash(dictionary);
const versions={...PART_TWO_VERSIONS,dictionary:dictionary.version,explanation:dictionary.explanationVersion};
const releaseId=`part-two:${sha256(canonicalJson({dictionaryHash:dictionary.contentHash,versions}))}`;
const owner='f2000000-0000-4000-8000-000000000001',scan='f2000000-0000-4000-8000-000000000002',capture='f2000000-0000-4000-8000-000000000003',obs='f2000000-0000-4000-8000-000000000004';
const now='2026-10-02T01:00:00Z',expiresAt='2026-10-03T01:00:00Z';
const request={schemaVersion:1 as const,requestId:'selected-release-request',scanId:scan,captureSessionId:capture,expectedGeneration:0,expectedEvidenceRevision:2};
const observation={id:obs,kind:'observation',revision:1,policyId:'private_capture',policyVersion:'fixture-1',ownerId:owner,scope:'private_package',payload:{rawText:'Test Selected Surface, Mystery Name',privateKind:'ocr',role:'ingredients',observation:{status:'recognized'},uncertaintyReasons:[]},dependencies:[],identityDependencies:[],observedAt:now,expiresAt,status:'active',statusRevision:1};
const context={ownerId:owner,scanId:scan,capture:{captureSessionId:capture,packageObservationId:'f2000000-0000-4000-8000-000000000006',captureRevision:1,generation:0,deletionEpoch:0,removed:false},generation:0,evidenceRevision:2,bindingRevision:2,policyEpoch:1,withdrawnExplanationDependencies:[],deletionEpoch:0,result:{packageConfirmation:'unconfirmed',display:{sections:[{sectionId:'section',kind:'ingredients',text:'Test Selected Surface, Mystery Name'}]}},declaration:null,snapshot:null,dependencies:[observation],observations:[observation],policies:[{id:'private_capture',version:'fixture-1',retainAllowed:true,displayAllowed:true,exportAllowed:false,epoch:1,expiresAt}],expiresAt,state:'pending',releaseId,releaseHash:dictionary.contentHash,versions,releaseEpoch:1,contextDigest:sha256('context'),dependencyDigest:sha256('deps'),bindingKey:sha256('owner:scan:capture')};
function ports(selected:DictionaryRelease,override:Partial<typeof context>={}):PartTwoPorts & {dictionaryRelease:DictionaryRelease}{
 return {dictionaryRelease:selected,authorize:async()=>owner,now:()=>now,operation:async()=>({context:{...context,...override},resultRevision:1,state:'pending',reasonCodes:[],cached:null,ticket:{bindingKey:context.bindingKey,leaseToken:'selected-ticket',contextDigest:context.contextDigest,expectedResultRevision:1}}),worker:async(_action,payload)=>({published:true,result:payload.result})};
}
test('fresh server-selected release resolves its exact surface and pins its own dictionary without fixture approval',async()=>{
 const result=await normalizeAuthorized(request,owner,ports(dictionary));
 assert.equal(result.state,'ready');if(result.state!=='ready')return;
 const reading=result.output.reading;
 assert.equal(reading.occurrences[0].mapping.state,'resolved');
 if(reading.occurrences[0].mapping.state==='resolved')assert.equal(reading.occurrences[0].mapping.ingredientId,'niacinamide');
 assert.equal(reading.occurrences[1].mapping.state,'unresolved');
 assert.equal(reading.versions.dictionary,'selected-test-only-v1');
 assert.equal(reading.dependencyManifest.dictionaryHash,dictionary.contentHash);
 assert.equal(reading.claimLimits.productPresenceAllowed,false);
 assert.equal(reading.facts.some(f=>f.kind==='reference_function'),false);
});
test('selected release cannot normalize a registry tuple from another dictionary',async()=>{
 const result=await normalizeAuthorized(request,owner,ports(dictionary,{releaseHash:LOCAL_DICTIONARY_RELEASE.contentHash}));
 assert.equal(result.state,'failed');assert(!('output'in result));
});
test('selected local fixture still needs explicit local approval',async()=>{
 const result=await normalizeAuthorized(request,owner,ports(LOCAL_DICTIONARY_RELEASE));
 assert.equal(result.state,'blocked');assert(!('output'in result));
});
test('changing selected bytes without recomputing hash cannot produce facts',async()=>{
 const changed=structuredClone(dictionary);changed.identities[0].preferredName='Tampered';
 const result=await normalizeAuthorized(request,owner,ports(changed));
 assert.notEqual(result.state,'ready');assert(!('output'in result));
});
test('selected release cannot use registry versions from the fixture',async()=>{
 const result=await normalizeAuthorized(request,owner,ports(dictionary,{versions:PART_TWO_VERSIONS}));
 assert.equal(result.state,'failed');assert(!('output'in result));
});
test('expired selected provenance produces no fresh normalized facts',async()=>{
 const expired=structuredClone(dictionary);expired.provenance.expiresAt='2026-10-01T00:00:00Z';expired.contentHash=dictionaryReleaseHash(expired);
 const result=await normalizeAuthorized(request,owner,ports(expired,{releaseHash:expired.contentHash,releaseId:`part-two:${sha256(canonicalJson({dictionaryHash:expired.contentHash,versions}))}`}));
 assert.equal(result.state,'blocked');assert(!('output'in result));
});
test('cached facts cannot bypass a newly selected dictionary or its withdrawal',async()=>{
 const cached=await normalizeAuthorized(request,owner,ports(dictionary));assert.equal(cached.state,'ready');
 for(const change of ['different','withdrawn'] as const){const selected=structuredClone(dictionary);
  if(change==='different'){selected.version='another-test-release';selected.aliases=selected.aliases.map(a=>({...a,release:selected.version}));}else selected.provenance.revoked=true;
  selected.contentHash=dictionaryReleaseHash(selected);const host=ports(selected);host.operation=async()=>({context,resultRevision:1,state:'ready',reasonCodes:[],cached,ticket:null});
  const result=await normalizeAuthorized(request,owner,host);assert.notEqual(result.state,'ready',change);assert(!('output'in result));
 }
});
test('cached snapshot dictionary pins must match the current selected registry tuple',async()=>{
 const cached=await normalizeAuthorized(request,owner,ports(dictionary));assert.equal(cached.state,'ready');if(cached.state!=='ready')return;
 const changed=structuredClone(cached);changed.output.reading.dependencyManifest.dictionaryHash='0'.repeat(64);
 const host=ports(dictionary);host.operation=async()=>({context,resultRevision:1,state:'ready',reasonCodes:[],cached:changed,ticket:null});
 const result=await normalizeAuthorized(request,owner,host);assert.notEqual(result.state,'ready');assert(!('output'in result));
});
test('cached selection is rechecked after publication fails during a withdrawal race',async()=>{
 const cached=await normalizeAuthorized(request,owner,ports(dictionary));const host=ports(dictionary);let resolves=0;
 host.operation=async()=>{resolves++;return {context,resultRevision:1,state:resolves===1?'pending':'ready',reasonCodes:[],cached:resolves===1?null:cached,ticket:resolves===1?{bindingKey:context.bindingKey,leaseToken:'selected-ticket',contextDigest:context.contextDigest,expectedResultRevision:1}:null};};
 host.worker=async()=>{const withdrawn=structuredClone(dictionary);withdrawn.provenance.revoked=true;withdrawn.contentHash=dictionaryReleaseHash(withdrawn);host.dictionaryRelease=withdrawn;return {published:false};};
 const result=await normalizeAuthorized(request,owner,host);assert.notEqual(result.state,'ready');assert(!('output'in result));
});
