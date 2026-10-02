#!/usr/bin/env node
/** Actual isolated local Auth/RPC/Storage + production HTTP/coordinator/client/
 * controller. The only review authority is a pinned synthetic local gold fixture.
 * Run with Node22 --experimental-strip-types. --serve-fixture binds loopback8127
 * for the separate simulator view; SIGINT performs synthetic byte/user cleanup. */
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { createClient } from '@supabase/supabase-js';
import { handlePartOneRequest, normalizeDatabaseDates, PartOneHttpError, rpcErrorToHttp } from '../supabase/functions/_shared/part-one-runtime.ts';
import { uploadPrivateDerivative, recoverPrivateCapture, consumePrivateCleanupOnce } from '../supabase/functions/_shared/part-one-private-storage.ts';
import { createPrivateStoragePorts, privateService } from '../supabase/functions/_shared/part-one-private-supabase.ts';
import { commitPrivateCapture } from '../supabase/functions/_shared/part-one-private-commit.ts';
import { createReviewedFixtureAuthority } from '../supabase/functions/_shared/part-one-private-evidence.ts';
import { createPartOnePrivateTransport } from '../src/services/partOnePrivateClient.ts';
import { createPrivateCaptureController } from '../src/presentation/part-one/privateCaptureController.ts';
import { createSyntheticPrivateReviewBuilder, SYNTHETIC_PRIVATE_VARIANT, SYNTHETIC_PRIVATE_INGREDIENT_TEXT, SYNTHETIC_PRIVATE_EDIT_TEXT, SYNTHETIC_PRIVATE_PACKAGE_TEXT, syntheticPrivateLines } from '../tests/fixtures/part-one-private-review.ts';
import { ScanResultSchema, CaptureSessionSchema } from '../src/contracts/PartOne.ts';

const endpoint=process.env.SUPABASE_URL,anon=process.env.SUPABASE_ANON_KEY,serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!endpoint||!anon||!serviceKey)throw new Error('Explicit isolated local stack environment required');
const target=new URL(endpoint);
if(target.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(target.hostname)||target.username||target.password||target.pathname!=='/'||target.search||target.hash)throw new Error('Hosted or ambiguous stack URL refused');
if(process.env.PART_ONE_DB_CONTAINER!=='supabase_db_derive-part-one-task6'||process.env.DOCKER_HOST!=='unix:///Users/kanuj/.colima/default/docker.sock'||!process.env.PART_ONE_DOCKER_CONFIG)throw new Error('Explicit task-isolated database and Docker engine required');
const docker=process.env.PART_ONE_DOCKER_BIN||'/opt/homebrew/bin/docker';
const serve=process.argv.includes('--serve-fixture'),fixture=randomUUID(),bucket=`part-one-private-${fixture}`,policyId=randomUUID();
const pub={observation:randomUUID(),declaration:randomUUID(),snapshot:randomUUID(),item:randomUUID()};
const admin=createClient(endpoint,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
const originalAdminRpc=admin.rpc.bind(admin);admin.rpc=async(...args)=>{const result=await originalAdminRpc(...args);if(result.error)console.error(JSON.stringify({stage:'synthetic_service_rpc',action:args[1]?.p_action,code:result.error.code,tag:result.error.message?.match(/PART_ONE_[A-Z_]+/)?.[0],constraint:result.error.message?.match(/constraint "([^"]+)"/)?.[1]}));return result;};
const storage=createPrivateStoragePorts(admin),service=privateService(admin);
const owners=[],captures=new Set(),jobs=new Set(),reviewIds=new Set(),lastSeeds=new Map(),commitRequests=new Map();let checks=0,savedConfig,savedPolicy,server,heartbeat,cleaned=false,maintenancePending,byteCleanupPending,maintenanceFailed=false,delayNextCommit=false,fixtureDelayObserver;
const hash=async text=>createHash('sha256').update(text).digest('hex');
const manifest=JSON.parse(await readFile(new URL('../tests/fixtures/part-one-private-gold/manifest.json',import.meta.url),'utf8'));
const gold={},ownerBGold=new Uint8Array(await readFile(new URL('../tests/fixtures/part-one-private-gold/ingredients-owner-b.jpg',import.meta.url)));
assert.equal(await hash(ownerBGold),manifest.ownerB.sanitizedAssetHash,'distinct B fixedartifact hash');
for(const role of ['ingredients','package']){gold[role]=new Uint8Array(await readFile(new URL(`../tests/fixtures/part-one-private-gold/${role}.jpg`,import.meta.url)));assert.equal(await hash(gold[role]),manifest.assetsByRole[role].sanitizedAssetHash,'fixed artifact hash');}
const now=new Date().toISOString(),expiry=new Date(Date.now()+3600000).toISOString();
const authorityPolicy={policyId,version:'private-gold-v1',enabled:true,mode:'synthetic_local_only',permissionEvidence:'Synthetic local fixture: pinned generated JPEG/package/transcript review',reviewedAt:now,expiresAt:expiry,revokedAt:null};
const buildReceipt=createSyntheticPrivateReviewBuilder({sanitizedAssetHash:manifest.assetsByRole.ingredients.sanitizedAssetHash,width:1280,height:1440,assetsByRole:manifest.assetsByRole,sanitizerVersion:'part-one-jpeg-verified-1',recognizer:'synthetic_fixture',recognizerVersion:'private-gold-v1',hash,authorityPolicy});
function check(actual,expected,message){assert.deepEqual(actual,expected,message);checks++;}
async function sql(query){return new Promise((resolve,reject)=>{const child=spawn(docker,['--config',process.env.PART_ONE_DOCKER_CONFIG,'exec','-i',process.env.PART_ONE_DB_CONTAINER,'psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-Atq'],{stdio:['pipe','pipe','pipe']});let out='';child.stdout.on('data',b=>out+=b);child.stderr.resume();child.on('error',()=>reject(new Error('Isolated SQL transport unavailable')));child.on('close',code=>code===0?resolve(out.trim()):reject(new Error('Synthetic SQL failed; payload omitted')));child.stdin.end(query);});}
const literal=value=>"'"+JSON.stringify(value).replaceAll("'","''")+"'::jsonb";
async function operation(owner,action,payload){const {data,error}=await owner.client.rpc('part_one_operation',{p_action:action,p_payload:payload});if(error){console.error(JSON.stringify({stage:'synthetic_owner_rpc',action,code:error.code,tag:error.message?.match(/PART_ONE_[A-Z_]+/)?.[0],constraint:error.message?.match(/constraint "([^"]+)"/)?.[1]}));throw rpcErrorToHttp(error.code,error.message);}return normalizeDatabaseDates(data);}
async function evidencePorts(context){
 if(!context.reviewRequest||!reviewIds.has(context.reviewRequest.reviewId))return{hash};
 try{return{hash,authority:createReviewedFixtureAuthority(authorityPolicy,[await buildReceipt(context)])};}catch{return{hash};}
}
function portsFor(owner){return{
 authorize:async request=>{const token=request.headers.get('authorization')?.replace(/^Bearer /,'');if(!token)throw new PartOneHttpError('unauthorized',401);const {data,error}=await admin.auth.getUser(token);if(error||data.user?.id!==owner.id)throw new PartOneHttpError('unauthorized',401);},
 operation:(action,payload)=>operation(owner,action,payload),
 privateUpload:(request,id,binding)=>uploadPrivateDerivative(request,{captureSessionId:id,...binding},{ownerId:owner.id,operation:(action,payload)=>operation(owner,action,payload),service,storage}),
 privateRecover:id=>recoverPrivateCapture(id,{operation:(action,payload)=>operation(owner,action,payload),storage}),
 privateCommit:(id,request)=>{commitRequests.set(`${owner.id}:${id}`,structuredClone(request));return commitPrivateCapture(id,request,{ownerId:owner.id,operation:(action,payload)=>operation(owner,action,payload),service,evidencePorts});},
};}
async function http(owner,path,options={}){const request=new Request(`http://127.0.0.1:8127/part-one${path}`,{method:options.method??'GET',headers:{authorization:`Bearer ${owner.token}`,...options.headers},...(options.body===undefined?{}:{body:typeof options.body==='string'||options.body instanceof ArrayBuffer||options.body instanceof Uint8Array?options.body:JSON.stringify(options.body)}),...(options.signal?{signal:options.signal}:{})});return handlePartOneRequest(request,portsFor(owner));}
function transportFor(owner,network=false){return createPartOnePrivateTransport({enabled:()=>true,invoke:async(path,options)=>{const response=network?await fetch(`http://127.0.0.1:8127/${path}`,{...options,headers:{authorization:`Bearer ${owner.token}`,...options.headers}}):await http(owner,path.slice('part-one'.length),options);return response.ok?{data:await response.json(),error:null}:{data:null,error:{context:response}};}});}
async function json(owner,path,method='GET',body){const response=await http(owner,path,{method,body,headers:body===undefined?{}:{'content-type':'application/json'}});if(!response.ok)throw new Error(`Synthetic HTTP ${path.replace(/[a-f0-9-]{36}/g,'[id]')} status${response.status}; payload omitted`);return response.json();}
function newReview(){const id=randomUUID();reviewIds.add(id);return id;}
async function bootstrap(owner,resume=false){
 if(resume){const previous=lastSeeds.get(owner.id);if(!previous)throw new PartOneHttpError('fixture_missing',404);const response=await http(owner,`/captures/${previous.capture.captureSessionId}`);if(!response.ok)throw new PartOneHttpError('fixture_missing',404);const capture=CaptureSessionSchema.parse(await response.json()),result=ScanResultSchema.parse(await json(owner,`/scans/${capture.scanId}`));return{...previous,capture,result};}
 const result=ScanResultSchema.parse(await json(owner,'/scans','POST',{schemaVersion:1,requestId:randomUUID(),clientScanId:randomUUID(),idempotencyKey:randomUUID(),generation:0,code:{raw:'3606000537538',symbology:'ean13',namespace:'gtin',retailerId:null},requestedMarket:'US',categoryHint:null}));
 if(result.jobId)jobs.add(result.jobId);
 const capture=CaptureSessionSchema.parse(await json(owner,`/scans/${result.scanId}/captures`,'POST',{expectedGeneration:result.generation,expectedResultRevision:result.resultRevision}));captures.add(capture.captureSessionId);
 const current=ScanResultSchema.parse(await json(owner,`/scans/${result.scanId}`));
 const seed={ownerId:owner.id,capture,result:current,reviewId:newReview(),token:owner.token,photos:['ingredients','package'].map(role=>({evidenceId:randomUUID(),base64:Buffer.from(gold[role]).toString('base64'),text:role==='ingredients'?SYNTHETIC_PRIVATE_INGREDIENT_TEXT:SYNTHETIC_PRIVATE_PACKAGE_TEXT,role}))};lastSeeds.set(owner.id,seed);return seed;
}
function draftFrom(seed){return{binding:{ownerId:seed.ownerId,sheetSessionId:randomUUID(),scanId:seed.capture.scanId,generation:seed.capture.generation,captureSessionId:seed.capture.captureSessionId,packageObservationId:seed.capture.packageObservationId,itemId:seed.capture.itemId,candidateId:null,deletionEpoch:seed.capture.deletionEpoch},captureEpoch:1,scrollOffset:120,shots:seed.photos.map(photo=>{const observation={evidenceId:photo.evidenceId,captureSessionId:seed.capture.captureSessionId,generation:seed.capture.generation,recognizer:'synthetic_fixture',recognizerVersion:'private-gold-v1',languageConfig:['en'],correctionEnabled:false,sourceWidth:1280,sourceHeight:1440,orientationTransform:[1,0,0,0,1,0,0,0,1],lines:syntheticPrivateLines(photo.text),status:'recognized'};return{evidenceId:photo.evidenceId,uri:`gold:${photo.role}`,observation,observations:[observation]};}),edits:[],coverage:{startSeen:true,endSeen:true,missingRegions:[],requiredSections:['ingredients'],observedSections:['ingredients'],associationContradictions:[]},review:{active:false,revision:0,assemblyRevision:0,mode:'unknown',samePackagePhotoIds:[],assignments:[],packageConflicts:[],gaps:[],boundaries:{start:[],end:[]},assemblies:[]},lastActivityAt:Date.now()};}
function controllerFor(owner,seed,draft,transport=transportFor(owner)){let currentOwner=owner.id,reviewId=seed.reviewId;const controller=createPrivateCaptureController({enabled:true,transport,sanitize:async uri=>{const role=uri.split(':')[1];return{bytes:new Uint8Array(Buffer.from(seed.photos.find(photo=>photo.role===role).base64,'base64')),mimeType:'image/jpeg',width:1280,height:1440,sourceWidth:1280,sourceHeight:1440,orientationTransform:[1,0,0,0,1,0,0,0,1],cropRegion:[0,0,1,1],recipeVersion:'derive-private-jpeg-v1'};},currentOwner:()=>currentOwner,currentDraft:()=>draft,createId:randomUUID,reviewId:()=>reviewId});controller.bind(owner.id,seed.capture,seed.result);for(const photo of seed.photos)controller.setPhotoRole(photo.evidenceId,photo.role);return{controller,newReview:()=>reviewId=newReview(),switchOwner:id=>{currentOwner=id;controller.setOwner(id);}};}
async function cleanupBytes(){
 if(byteCleanupPending)return byteCleanupPending;
 byteCleanupPending=(async()=>{for(let i=0;i<100;i++){const result=await consumePrivateCleanupOnce({service,storage});if(!result.claimed)return;if(result.blocked||result.deleted===false)throw new Error('Actual private byte cleanup blocked');}throw new Error('Private cleanup bound exceeded');})();
 try{await byteCleanupPending;}finally{byteCleanupPending=undefined;}
}
// A heartbeat belongs to an actual bounded consumer. Never overlap claims, and
// stop accepting fixture writes if consumption fails rather than reporting a
// healthy consumer which cannot meet the disclosed sixty-second byte deadline.
async function maintenance(){
 if(cleaned||maintenanceFailed)return;
 maintenancePending=(async()=>{await service('cleanup/heartbeat',{consumerVersion:'private-gold-local-smoke'});await cleanupBytes();})();
 try{await maintenancePending;}catch{maintenanceFailed=true;process.exitCode=1;console.error('Synthetic private cleanup consumer failed; fixture requests now fail closed.');}
 finally{maintenancePending=undefined;if(!cleaned&&!maintenanceFailed){heartbeat=setTimeout(maintenance,10000);heartbeat.unref();}}
}
async function setup(){
 check(await sql("select count(*) from private.part_one_records where canonical_key='gtin:03606000537538' and scope='public';"),'0','fixed synthetic catalog key must be unused');
 assert.equal(await sql("select count(*) from private.part_one_jobs where input->>'canonicalKey'='gtin:03606000537538';"),'0','fixed synthetic job key must be unused');
 savedConfig=JSON.parse(await sql('select row_to_json(c) from private.part_one_private_config c where id=true;'));savedPolicy=JSON.parse(await sql("select row_to_json(p) from private.part_one_policies p where id='private_capture';"));
 const {error}=await admin.storage.createBucket(bucket,{public:false,fileSizeLimit:2097152,allowedMimeTypes:['image/jpeg']});if(error)throw new Error('Synthetic private bucket unavailable');
 await sql(`update private.part_one_policies set version='private-gold-v1',retain_allowed=true,display_allowed=true,permission_evidence='Synthetic local fixture: private JPEG/text retention only',expires_at=(${literal(expiry)}#>>'{}')::timestamptz where id='private_capture';update private.part_one_private_config set enabled=true,policy_version='private-gold-v1',process_allowed=true,ocr_allowed=true,upload_allowed=true,private_display_allowed=true,bucket_id='${bucket}',retention_seconds=3600,deletion_deadline_seconds=60,approval_evidence='Synthetic local fixture: isolated private upload/retention',reviewed_at=now(),expires_at=(${literal(expiry)}#>>'{}')::timestamptz where id=true;insert into private.part_one_review_authorities(policy_id,version,enabled,mode,permission_evidence,expires_at) values('${policyId}','private-gold-v1',true,'synthetic_local_only',(${literal(authorityPolicy.permissionEvidence)}#>>'{}'),(${literal(expiry)}#>>'{}')::timestamptz);`);
 await maintenance();if(maintenanceFailed)throw new Error('Synthetic private cleanup consumer unavailable');
 const item={snapshotId:pub.snapshot,itemId:pub.item,revision:1,name:'Example Daily toner',variant:SYNTHETIC_PRIVATE_VARIANT,fieldEvidence:{name:[pub.observation]},barcodeAssertions:[{raw:'3606000537538',symbology:'ean13',namespace:'gtin',canonical:'03606000537538',evidenceId:pub.observation}],requestedMarket:'US',sourceMarkets:['US'],packageMarket:null,declarationIds:[pub.declaration],conflictIds:[],scope:'public',supersedesId:null};
 const bad={state:'conflict',rawText:'Carbonated water, Sugar',sections:[],sources:[],predicate:{association:{passed:true},noContradiction:{passed:false},variantMarket:{passed:false},completeness:{passed:false},rightsFreshness:{passed:true}}};
 const snapshot={name:item.name,brand:'Example',variantText:'Daily toner 100 ml',image:null,declarationIds:[pub.declaration],requestedMarket:'US',sourceMarkets:['US'],packageMarket:null,fullItem:item};
 for(const record of [{id:pub.observation,kind:'observation',payload:{provider:'synthetic',rawText:'Example Daily toner identity only'}},{id:pub.declaration,kind:'declaration',payload:bad},{id:pub.snapshot,kind:'snapshot',payload:snapshot}])await sql(`insert into private.part_one_records(id,kind,item_id,revision,canonical_key,policy_id,policy_version,payload,dependencies,observed_at,expires_at) values('${record.id}','${record.kind}','${pub.item}',1,${record.kind==='snapshot'?"'gtin:03606000537538'":'null'},'derive_catalog','1',${literal(record.payload)},${record.kind==='observation'?"'{}'":"array['"+pub.observation+"'::uuid]"},now(),(${literal(expiry)}#>>'{}')::timestamptz);`);
 for(let i=0;i<2;i++){const client=createClient(endpoint,anon,{auth:{persistSession:false,autoRefreshToken:false}});const {data,error}=await client.auth.signInAnonymously();if(error||!data.user||!data.session)throw new Error('Synthetic anonymous auth unavailable');owners.push({client,id:data.user.id,token:data.session.access_token});}
}
async function cleanup(){if(cleaned)return;cleaned=true;clearTimeout(heartbeat);server?.close();await maintenancePending?.catch(()=>{});
 try{for(const owner of owners)for(const capture of captures){await operation(owner,'captures/delete',{id:capture}).catch(()=>{});}await cleanupBytes();
 for(const owner of owners){const {error}=await admin.auth.admin.deleteUser(owner.id);if(error)throw new Error('Synthetic owner cleanup failed');}await cleanupBytes();
 if(jobs.size)await sql(`delete from private.part_one_reservations where job_id in (${[...jobs].map(id=>`'${id}'`).join(',')});delete from private.part_one_jobs where id in (${[...jobs].map(id=>`'${id}'`).join(',')});`);
 assert.equal(await sql("select count(*) from private.part_one_jobs where input->>'canonicalKey'='gtin:03606000537538';"),'0','all and only tracked synthetic jobs were removed');
 await sql(`delete from private.part_one_review_authorities where policy_id='${policyId}';delete from private.part_one_records where id in ('${pub.snapshot}','${pub.declaration}','${pub.observation}');`);
 if(savedConfig)await sql(`delete from private.part_one_private_config where id=true;insert into private.part_one_private_config select * from jsonb_populate_record(null::private.part_one_private_config,${literal(savedConfig)});`);
 if(savedPolicy)await sql(`with original as(select * from jsonb_populate_record(null::private.part_one_policies,${literal(savedPolicy)})) update private.part_one_policies p set version=o.version,lookup_allowed=o.lookup_allowed,retain_allowed=o.retain_allowed,display_allowed=o.display_allowed,export_allowed=o.export_allowed,expires_at=o.expires_at,permission_evidence=o.permission_evidence from original o where p.id=o.id;`);
 await sql(`delete from private.part_one_upload_tickets where bucket_id='${bucket}' and state='deleted';delete from private.part_one_private_cleanup where bucket_id='${bucket}' and state='deleted';`);
 const {error}=await admin.storage.deleteBucket(bucket);if(error)throw new Error('Synthetic bucket cleanup failed');
 }catch{console.error('Synthetic private cleanup failed; reset isolated stack before reuse.');process.exitCode=1;}}
async function suite(){
 const a=owners[0],b=owners[1],seedA=await bootstrap(a),seedB=await bootstrap(b);
 check(seedA.result.identity,'exact','actual catalog identity bound');check(seedA.result.declarationState,'none','contradictory public source not accepted');check(seedA.result.snapshotId,seedB.result.snapshotId,'same GTIN starts with same public identity');
 const draftA=draftFrom(seedA),aFlow=controllerFor(a,seedA,draftA),ctrl=aFlow.controller;
 check(await ctrl.discloseDraft(draftA),true,'production controller gets approved local disclosure');ctrl.cancelDisclosure();check(ctrl.getState().stage,'temporary','back from disclosure preserves temporary state');check(draftA.shots.length,2,'back preserves original draft photos');
 check(await ctrl.discloseDraft(draftA),true,'retry disclosure uses current owner/package');ctrl.acceptDisclosure(true);
 check(await ctrl.confirmSave(),true,'actual upload/commit/review/save/recovery succeeds');check(ctrl.getState().stage,'saved_accepted','production controller accepted private state');
 const accepted=ctrl.getState().result,recovery=ctrl.getState().recovery,saveId=ctrl.getState().saveId;
 check(accepted.scope,'private_package','accepted declaration owner-private');check(accepted.packageConfirmation,'photo_supported','trusted package proof recorded separately from confirmation');check(accepted.conflictIds,[],'bad public ingredients not copied into private proof');check(recovery.assets.length,2,'both actual Storage assets recovered');check(recovery.sourceObservations.length,2,'immutable original source observations recovered');check(Boolean(saveId),true,'actual save ID issued');
 check(recovery.assets.every(asset=>asset.signedAccess&&new URL(asset.signedAccess.url).origin===new URL(endpoint).origin),true,'signed asset access only local private Storage');
 for(const asset of recovery.assets){const response=await fetch(asset.signedAccess.url);check(response.status,200,'actual private bytes readable via short signed access');check(createHash('sha256').update(new Uint8Array(await response.arrayBuffer())).digest('hex'),asset.asset.contentHash,'actual persisted JPEG byte hash matches attestation');}
 const unchanged=JSON.parse(await sql(`select payload from private.part_one_records where id='${pub.snapshot}';`));check(unchanged.fullItem.scope,'public','shared catalog unchanged');check(unchanged.declarationIds,[pub.declaration],'private declaration never promoted');check(await sql(`select payload->>'rawText' from private.part_one_records where id='${pub.declaration}';`),'Carbonated water, Sugar','wrong public formula never repaired or overwritten');
 const saved=await json(a,`/saves/${saveId}`);check(saved.result.declarationId,accepted.declarationId,'actual saved immutable declaration selected');
 const initialRequest=structuredClone(commitRequests.get(`${a.id}:${seedA.capture.captureSessionId}`));const preReplay=await sql(`select count(*) from private.part_one_records where owner_id='${a.id}';`);const replay=await transportFor(a).commit(seedA.capture.captureSessionId,initialRequest);check(replay.result.declarationId,accepted.declarationId,'actual source/review replay returns original accepted declaration');check(await sql(`select count(*) from private.part_one_records where owner_id='${a.id}';`),preReplay,'idempotent source/review replay adds no copies');
 const foreign=await http(b,`/captures/${seedA.capture.captureSessionId}/evidence`);check(foreign.status,403,'other owner cannot recover private capture');
 const stalePayload={schemaVersion:2,idempotencyKey:randomUUID(),expectedGeneration:seedA.capture.generation,expectedResultRevision:seedA.result.resultRevision,expectedCaptureRevision:seedA.capture.captureRevision,expectedDeletionEpoch:seedA.capture.deletionEpoch,packageObservationId:seedA.capture.packageObservationId,assets:[],sourceObservations:[],edits:[],review:null,reviewId:null};
 const beforeCount=await sql(`select count(*) from private.part_one_records where owner_id='${a.id}';`);check((await http(a,`/captures/${seedA.capture.captureSessionId}/observations`,{method:'POST',body:JSON.stringify(stalePayload),headers:{'content-type':'application/json'}})).status,409,'stale result/capture CAS rejects');check(await sql(`select count(*) from private.part_one_records where owner_id='${a.id}';`),beforeCount,'stale commit has no durable sideeffects');
 const draftBAccepted=draftFrom(seedB),bAcceptedFlow=controllerFor(b,seedB,draftBAccepted);
 check(await bAcceptedFlow.controller.discloseDraft(draftBAccepted),true,'owner B independently approves disclosure');bAcceptedFlow.controller.acceptDisclosure(true);check(await bAcceptedFlow.controller.confirmSave(),true,'second owner independently commits reviewed gold package');check(bAcceptedFlow.controller.getState().stage,'saved_accepted','B requires own reviewed package graph');check(bAcceptedFlow.controller.getState().result.declarationId===accepted.declarationId,false,'same GTIN reviewed graphs have distinct private IDs');
 const seedBDifferent=await bootstrap(b);const bPhoto=seedBDifferent.photos.find(photo=>photo.role==='ingredients');bPhoto.base64=Buffer.from(ownerBGold).toString('base64');bPhoto.text=manifest.ownerB.text;
 const draftB=draftFrom(seedBDifferent),bFlow=controllerFor(b,seedBDifferent,draftB);
 check(await bFlow.controller.discloseDraft(draftB),true,'B different physical fixture label explicitly disclosed');bFlow.controller.acceptDisclosure(true);check(await bFlow.controller.confirmSave(),true,'B distinct JPEG/transcript commits without invented reviewed authority');check(bFlow.controller.getState().stage,'saved_partial','B different photographed formula cannot inherit A readiness');check(bFlow.controller.getState().recovery.sourceObservations.find(o=>o.role==='ingredients').observation.lines[0].text,manifest.ownerB.text,'distinct B label source text retained verbatim');check(bFlow.controller.getState().recovery.assets.some(asset=>asset.asset.contentHash===manifest.ownerB.sanitizedAssetHash),true,'distinct B actual Storage image hash proven');
 const reopened=createPrivateCaptureController({enabled:true,transport:transportFor(a),sanitize:async()=>{throw new Error('No reupload on recovery');},currentOwner:()=>a.id,createId:randomUUID});check(await reopened.recover(a.id,seedA.capture.captureSessionId),true,'process recreation reopens durable accepted proof');check(reopened.getState().stage,'saved_accepted','accepted state survives recovery');
 // Editing reuses original immutable asset/OCR and requires a NEW independent
 // registry receipt for the fixed separately reviewed synthetic edited text.
 check(ctrl.correctLine({evidenceId:seedA.photos.find(p=>p.role==='ingredients').evidenceId,observationIndex:0,lineIndex:0},SYNTHETIC_PRIVATE_EDIT_TEXT),true,'production controller builds attributed edit');aFlow.newReview();check(await ctrl.discloseChanges(),true,'edit has separate explicit disclosure');ctrl.acceptDisclosure(true);check(await ctrl.confirmSave(),true,'actual edited private graph and newreview committed');check(ctrl.getState().stage,'saved_accepted','independently reviewed correction accepted');check(ctrl.getState().recovery.edits.length,1,'original-plus-edit provenance recovered');check(ctrl.getState().recovery.sourceObservations.find(o=>o.role==='ingredients').observation.lines[0].text,SYNTHETIC_PRIVATE_INGREDIENT_TEXT,'original OCR remains immutable');check(ctrl.getState().recovery.edits[0].text,SYNTHETIC_PRIVATE_EDIT_TEXT,'attributed correction exact');check(ctrl.getState().result.declarationId===accepted.declarationId,false,'edit creates new immutable declaration');const historical=await json(a,`/saves/${saveId}`);check(historical.snapshotAtSaveId,accepted.snapshotId,'original snapshot-at-save identity retained');check(historical.result.declarationState==='accepted',false,'changed transcript retracts old accepted readiness');check(await sql(`select payload->>'rawText' from private.part_one_records where id='${accepted.declarationId}';`),SYNTHETIC_PRIVATE_INGREDIENT_TEXT,'original declaration remains immutable historical text');
check((await transportFor(b).recover(seedBDifferent.capture.captureSessionId)).boundResult.declarationId,bFlow.controller.getState().result.declarationId,'A edit leaves B declaration unchanged');
 const locations=JSON.parse(await sql(`select coalesce(json_agg(json_build_object('bucketId',bucket_id,'objectName',object_name,'id',object_id)),'[]') from private.part_one_upload_tickets where owner_id='${a.id}';`));
 check(await ctrl.remove(),true,'explicit proof removal succeeds through production controller');check(ctrl.getState().stage,'removed','removal clears controller cache');
 check((await http(a,`/captures/${seedA.capture.captureSessionId}/observations`,{method:'POST',body:JSON.stringify(stalePayload),headers:{'content-type':'application/json'}})).status,409,'deletion fence rejects old outbox replay');
 check(await sql(`select count(*) from private.part_one_records where owner_id='${a.id}' and (payload ? 'rawText' or payload ? 'structuredSections' or payload ? 'fullItem' or payload ? 'variant' or payload ? 'observation' or payload ? 'assetBindings' or payload::text like '%Hexanediol%');`),'0','every private transcript/variant/asset/derived proof copy erased; only nonidentifying replay tombstones may remain');await cleanupBytes();
 for(const location of locations){check(await storage.inspect(location.bucketId,location.objectName),null,'actual Storage object absent after cleanup executor');}
 for(const asset of recovery.assets){check((await fetch(asset.signedAccess.url)).status===200,false,'old signed locator cannot retrieve deleted bytes');}
 const ownerB=await transportFor(b).recover(seedBDifferent.capture.captureSessionId);check(ownerB.sourceObservations.find(o=>o.role==='ingredients').observation.lines[0].text,manifest.ownerB.text,'A deletion leaves B evidence unchanged');check(ownerB.assets.length,2,'A deletion leaves B bytes intact');
 const sharedAgain=await bootstrap(a);check(sharedAgain.result.snapshotId,pub.snapshot,'independent public identity remains after private deletion');check(sharedAgain.result.declarationState,'none','private proof never creates public readiness');
 aFlow.switchOwner(b.id);check(ctrl.getState().recovery,null,'account switch drops all private controller state');
 console.log(`Part1 actual local private HTTP/RPC/Storage/controller smoke: ${checks} checks passed; zero live provider/model calls. Optical recognition accuracy and physical panel coverage remain unrun.`);
}
async function verifyFixtureControls(){
 const initialChecks=checks,owner=owners[0],seed=await bootstrap(owner),draft=draftFrom(seed),flow=controllerFor(owner,seed,draft,transportFor(owner,true));
 check(await flow.controller.discloseDraft(draft),true,'network fixture controller disclosure');flow.controller.acceptDisclosure(true);
 const arm=await fetch('http://127.0.0.1:8127/delay-next-commit');check(await arm.json(),{armed:true,delayMs:5000},'one-shot route arms exact bounded delay');
 let startedResolve,finishedResolve;
 const started=new Promise(resolve=>startedResolve=resolve),finished=new Promise(resolve=>finishedResolve=resolve);
 fixtureDelayObserver={started:startedResolve,finished:finishedResolve};
 const timeout=async(promise,ms)=>{let timer;try{return await Promise.race([promise,new Promise((_,reject)=>timer=setTimeout(()=>reject(new Error('Synthetic fixture control timeout')),ms))]);}finally{clearTimeout(timer);}};
 const saving=flow.controller.confirmSave();await timeout(started,10000);
 const startedAt=Date.now(),locations=JSON.parse(await sql(`select coalesce(json_agg(json_build_object('bucketId',bucket_id,'objectName',object_name)),'[]') from private.part_one_upload_tickets where capture_id='${seed.capture.captureSessionId}';`));
 check(locations.length,2,'actual JPEG uploads precede delayed private commit');
 check(await flow.controller.remove(),true,'cancel removes uploaded package during server delay');
 check(await saving,false,'aborted controller transaction cannot report saved');
 check(await timeout(finished,7000),409,'late unchanged production handler rejects deletion fence');
 check(Date.now()-startedAt>=4500,true,'handler was actually delayed');
 check(flow.controller.getState().stage,'removed','late response never restores removed controller');
 check(await sql(`select count(*) from private.part_one_records where owner_id='${owner.id}';`),'0','late commit created no private evidence copies');
 const deadline=Date.now()+20000;let present=true;
 while(present&&Date.now()<deadline){present=(await Promise.all(locations.map(location=>storage.inspect(location.bucketId,location.objectName)))).some(Boolean);if(present)await new Promise(resolve=>setTimeout(resolve,250));}
 check(present,false,'periodic real consumer deletes canceled JPEG bytes without manual cleanup');fixtureDelayObserver=undefined;
 console.log(`Part1 actual fixture delayed-cancel/periodic-cleanup smoke: ${checks-initialChecks} checks passed; no late private restoration.`);
}
async function serveFixture(){
 server=createServer(async(req,res)=>{try{
  if(req.headers.host!=='127.0.0.1:8127'&&req.headers.host!=='localhost:8127'){res.writeHead(403);res.end();return;}
  const url=new URL(req.url,'http://127.0.0.1:8127');res.setHeader('cache-control','no-store');
  if(maintenanceFailed)throw new PartOneHttpError('fixture_cleanup_unavailable',503);
  if(url.pathname==='/delay-next-commit'&&req.method==='GET'){delayNextCommit=true;res.setHeader('content-type','application/json');res.end(JSON.stringify({armed:true,delayMs:5000}));return;}
  if(url.pathname==='/bootstrap'){const index=Number(url.searchParams.get('owner')??0);if(index!==0&&index!==1)throw new Error('fixture owner');const seed=await bootstrap(owners[index],url.searchParams.get('resume')==='1');res.setHeader('content-type','application/json');res.end(JSON.stringify({...seed,photos:seed.photos.map(photo=>({...photo,...manifest.assetsByRole[photo.role]}))}));return;}
  if(url.pathname==='/review-id'){res.setHeader('content-type','application/json');res.end(JSON.stringify({reviewId:newReview()}));return;}
  const token=req.headers.authorization?.replace(/^Bearer /,''),owner=owners.find(o=>o.token===token);if(!owner){res.writeHead(401);res.end();return;}
  const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>3*1024*1024)throw new Error('fixture request size');chunks.push(chunk);}
  const request=new Request(`http://127.0.0.1:8127${req.url}`,{method:req.method,headers:req.headers,...(chunks.length?{body:Buffer.concat(chunks)}:{})});
  const ports=portsFor(owner);
  let delayed=false;
  if(delayNextCommit&&req.method==='POST'&&/^\/part-one\/captures\/[a-f0-9-]{36}\/observations$/.test(url.pathname)){
   // Buffer and verify the real synthetic JWT before spending the one-shot
   // delay. The unchanged production handler revalidates auth and deletion/CAS
   // after the delay; disconnecting the client never grants a late commit.
   await ports.authorize(request.clone());delayNextCommit=false;delayed=true;fixtureDelayObserver?.started();
   await new Promise(resolve=>setTimeout(resolve,5000));
  }
  const response=await handlePartOneRequest(request,ports);if(delayed)fixtureDelayObserver?.finished(response.status);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch(error){res.writeHead(error instanceof PartOneHttpError?error.status:503,{'content-type':'application/json'});res.end(JSON.stringify({code:error instanceof PartOneHttpError?error.code:'fixture_unavailable'}));}});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(8127,'127.0.0.1',resolve);});
 if(process.argv.includes('--verify-fixture-control'))await verifyFixtureControls();
 if(process.argv.includes('--exit-after-verify')){
  if(!process.argv.includes('--verify-fixture-control'))throw new Error('Fixture exit requires actual control verification');
  return;
 }
 console.log('Synthetic private fixture server ready on http://127.0.0.1:8127; default production authority remains absent. SIGINT removes fixture users and bytes.');
 await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});
}
try{await setup();if(serve)await serveFixture();else await suite();}finally{await cleanup();}
