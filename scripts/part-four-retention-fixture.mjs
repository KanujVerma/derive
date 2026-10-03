import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir,chmod} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {PersonalResultV2Schema} from '../src/contracts/PersonalResultV2.ts';
import {PartThreeResponseSchema} from '../src/contracts/PartThreeService.ts';
import {evaluateBalancedValue,OFFER_FIELDS} from '../src/domain/part-four/value.ts';
import {createRetainedEvidence} from '../src/domain/part-four/retainedEvidence.ts';
import {researchBriefHash} from '../src/domain/part-four/researchBrief.ts';
import {canonicalJson,sha256} from '../src/domain/part-two/hash.ts';
import {createPartThreeSaveRecoveryStore,saveRecoveryStorageKey} from '../src/presentation/part-three/saveRecovery.ts';
const literal=value=>"'"+String(value).replaceAll("'","''")+"'";
const secret='738.402916';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const timing=(stage,validUntil,artifacts)=>{
 const at=Date.now(),sourceRetainUntil=artifacts.value.unitPrices[0].rights.fields.find(g=>g.field==='price').retention.until;
 console.log(JSON.stringify({suite:'part-four-retention-stage',stage,at:new Date(at).toISOString(),currentLeaseUntil:validUntil,sourceRetainUntil,currentRemainingMs:Date.parse(validUntil)-at,sourceRemainingMs:Date.parse(sourceRetainUntil)-at}));
};

/** Original synthetic field fixtures. No acquired source, provider or catalog
 * retail price is read. Values pass the same exact offer evaluator as runtime. */
export function retentionArtifacts({id,subject,now,expiry,priceUntil=expiry,omit=false,exportAllowed=true}){
 const choices=['candidate','comparator'].map((choice,i)=>{
  const sourceId=`retention-${id}-${choice}`,merchantId=`merchant-${id}`,merchant='Original synthetic direct merchant';
  const expected={productId:subject.productId??subject.itemId,variantId:subject.variantId??subject.itemId,formulaVersionId:subject.formulaVersionId??`original-synthetic-formula-${id}`,brandId:`synthetic-brand-${id}`,skuId:`synthetic-sku-${choice}-${id}`,packCount:'1',size:{amount:'50',unit:'mL'}};
  const sourceUrl=`https://fixture.invalid/original-${choice}?synthetic=${secret}`;
  const fieldGrants=OFFER_FIELDS.map(field=>({sourceId,field,policyId:`retention-${id}-${choice}-${field}`,policyVersion:`retention-${id}-v1`,validUntil:expiry,operations:{process:true,store:!(omit&&field==='price'),display:true,export:field==='price'?exportAllowed:true},retention:{mode:omit&&field==='price'?'omit':'retain_until',until:omit&&field==='price'?null:field==='price'?priceUntil:expiry}}));
  const sellerGrant=fieldGrants.find(g=>g.field==='seller');
  const offer={...expected,offerId:`original-synthetic-offer-${choice}-${id}`,sourceId,sourceUrl,amount:`${secret}${i+1}`,currency:'USD',market:'US',merchantId,merchant,seller:{id:merchantId,name:merchant,relationship:'retailer_direct',evidence:{kind:'retailer_direct_listing',qualification:'documented',sourceId,url:sourceUrl,sellerId:merchantId,sellerName:merchant,merchantId,brandId:null,observedAt:now,validUntil:expiry,grant:sellerGrant}},fulfillment:{id:`warehouse-${id}`,name:'Original synthetic fulfillment',shipsFrom:'US',prime:false},condition:'new',availability:'in_stock',priceKind:'ordinary',observedAt:now,validUntil:expiry,qualification:'eligible',conditions:[],conditionsSatisfied:true,fieldGrants};
  return{id:choice,eligibility:'suitable',expected,offer};
 });
 const value=evaluateBalancedValue({now,primaryGoal:null,candidate:choices[0],comparator:choices[1],advantage:{state:'unknown'}});
 assert.equal(value.state,'ready','Synthetic exact offers pass real eligibility evaluator');
 const sourceId=`retention-${id}-brief`,briefSecret=`ORIGINAL_SYNTHETIC_BRIEF_${id}`;
 const brief={version:'product-research-brief/v1',revision:`retention-${id}-brief-v1`,contentHash:'0'.repeat(64),productId:subject.productId??subject.itemId,variantId:subject.variantId??subject.itemId,formulaVersionId:subject.formulaVersionId,observations:[{id:`retention-${id}-observation`,text:briefSecret,kind:'reported_experience',scope:'feel_context',sourceIds:[sourceId],opposingSourceIds:[]}],sources:[{id:sourceId,title:'Original synthetic report source',url:`https://fixture.invalid/original-report-${id}`,kind:'personal_anecdote',retrievedAt:now,publishedAt:null,matching:'exact_variant',productId:subject.productId??subject.itemId,variantId:subject.variantId??subject.itemId,formulaVersionId:subject.formulaVersionId,coverageLimit:'Original local synthetic retention acceptance only',permission:{grantId:`retention-${id}-brief-policy`,version:`retention-${id}-v1`,process:true,store:true,display:true,export:true,revoked:false,validUntil:expiry}}],coverageLimit:'Original local synthetic retention acceptance only',reviewDecision:'approved_local_fixture',reviewedAt:now,reviewerId:`retention-${id}-reviewer`,validUntil:expiry};
 brief.contentHash=researchBriefHash(brief);
 return{value,brief,briefSecret,priceSecret:secret,retainedEvidence:createRetainedEvidence({value,brief},{now}),withdrawalIds:[...value.sourceIds,sourceId]};
}
async function fileStorage(directory){
 await mkdir(directory,{recursive:true,mode:0o700});await chmod(directory,0o700);
 const path=key=>join(directory,sha256(key)+'.json');
 return{getItem:async key=>{try{return await readFile(path(key),'utf8');}catch(e){if(e.code==='ENOENT')return null;throw e;}},setItem:async(key,value)=>{await writeFile(path(key),value,{mode:0o600});await chmod(path(key),0o600);}};
}
async function coldReplay(input){
 const child=spawn(process.execPath,['--experimental-strip-types',fileURLToPath(import.meta.url),'--recover'],{stdio:['pipe','pipe','pipe']});
 let stdout='',stderr='';child.stdout.on('data',x=>stdout+=x);child.stderr.on('data',x=>stderr+=x);
 child.stdin.end(JSON.stringify(input));
 const timer=setTimeout(()=>child.kill('SIGKILL'),20000);
 try{return await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',code=>{if(code!==0)return reject(Error('Fresh recovery process failed; no credentials or journal content emitted'));try{resolve(JSON.parse(stdout));}catch{reject(Error('Fresh recovery receipt invalid'));}});});}finally{clearTimeout(timer);}
}
async function recoverProcess(){
 let input='';for await(const chunk of process.stdin)input+=chunk;
 const {endpoint,anon,token,directory,scope,expected}=JSON.parse(input);
 assert.equal(new URL(endpoint).origin,'http://127.0.0.1:60721');
 const store=createPartThreeSaveRecoveryStore(await fileStorage(directory),()=>({ownerId:scope.ownerId,accountGeneration:scope.accountGeneration}));
 const recovered=await store.recover(scope);assert.deepEqual(recovered,expected,'Fresh process retains exact original Save tuple/hash');
 const response=await fetch(new URL('/functions/v1/part-three',endpoint),{method:'POST',headers:{apikey:anon,authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify(recovered)});
 assert.equal(response.status,200,'Fresh process retries real Edge Save');
 const saved=PartThreeResponseSchema.parse(await response.json());assert.equal(saved.kind,'saved');
 await store.complete(scope,recovered);assert.equal(await store.recover(scope),null);
 process.stdout.write(JSON.stringify({savedAssessmentId:saved.savedAssessmentId,replayed:saved.replayed,exactRequestRecovered:true,journalCompleted:true}));
}

/** Caller supplies the dedicated local fixture's current owner and canonical
 * result before context mutation. Only trusted prepare/publish use admin RPC;
 * Save/read/replay use actual authenticated Edge p3. Caller owns cleanup. */
export async function seedRetentionFixture({admin,sql,owner,p3,req,result,now,expiry,recovery}){
 assert.equal(new URL(admin.supabaseUrl).origin,'http://127.0.0.1:60721','Dedicated synthetic Part Four stack required');
 const base=PersonalResultV2Schema.parse(result);assert.equal(base.binding.ownerId,owner);assert.equal(base.binding.subject.kind,'declaration');
 let checks=0;const check=(a,b,message)=>{assert.deepEqual(a,b,message);checks++;};
 const worker=async(action,payload)=>{const reply=await admin.rpc('part_three_worker',{p_owner:owner,p_action:action,p_payload:payload});if(reply.error)throw Error(`Synthetic retention worker ${action} failed ${reply.error.code}`);return reply.data;};
 const contextRefs=JSON.parse(await sql(`select to_json(context_dependencies)::text from public.part_three_results where id=${literal(base.resultId)}::uuid and owner_id=${literal(owner)}::uuid;`));
 const publish=async({omit=false,shortPrice=false,shortLease=false,exportAllowed=true,storageProbe=false}={})=>{
  const fixtureId=randomUUID(),evaluatedAt=new Date().toISOString(),request={...req,requestId:randomUUID(),encounterId:randomUUID()},binding={...base.binding,encounterId:request.encounterId,attemptId:request.requestId};
  const validUntil=new Date(Math.min(Date.parse(base.validUntil),Date.now()+(shortLease?4000:60000))).toISOString();
  assert(Date.parse(validUntil)>Date.now()+2000,'Fixture requires at least two seconds of current truth authority');
  const artifacts=retentionArtifacts({id:fixtureId,subject:binding.subject,now:evaluatedAt,expiry,omit,exportAllowed,priceUntil:shortPrice?new Date(Date.now()+8000).toISOString():expiry});
  if(shortPrice)timing('before_prepare',validUntil,artifacts);
  const prepared=await worker('prepare',{request,binding,validUntil,contextRefs,pinnedSnapshotId:null});
  assert(prepared.leaseToken,'Real prepare must return a new authorized lease');checks++;
  if(shortPrice)timing('after_prepare',validUntil,artifacts);
  const packet=PersonalResultV2Schema.parse({...base,resultId:prepared.resultId,resultRevision:prepared.resultRevision,binding,evaluatedAt,validUntil,partFour:{...base.partFour,value:{state:omit?'unavailable':'ready',explanation:omit?'Source price is unavailable for durable use.':`Original synthetic derived price explanation ${secret}`,sourceIds:omit?[]:artifacts.value.sourceIds},reviews:{state:'ready',evidenceKind:'limited_research_brief',explanation:'Original synthetic report summary',sourceIds:artifacts.brief.sources.map(s=>s.id),brief:artifacts.brief},retainedEvidence:artifacts.retainedEvidence}});
  if(storageProbe){
   const denied=structuredClone(packet);
   for(const row of denied.partFour.retainedEvidence.fields)for(const grant of row.grants)if(grant.field==='price')grant.operations.store=false;
   PersonalResultV2Schema.parse(denied);
   const refusal=await worker('publish',{resultId:prepared.resultId,leaseToken:prepared.leaseToken,result:denied});
   check(refusal.kind,'unavailable','Actual publication refuses raw retained payload with denied source storage');
   check(await sql(`select (payload is null)::text from public.part_three_results where id=${literal(prepared.resultId)}::uuid and owner_id=${literal(owner)}::uuid;`),'true','Refused source payload is never written to current-result storage');
  }
  const published=await worker('publish',{resultId:prepared.resultId,leaseToken:prepared.leaseToken,result:packet});check(published.kind,'result','Real publication admits canonical synthetic source packet');check(published.result,packet,'Publication preserves original visible packet');
  if(shortPrice)timing('after_publish',validUntil,artifacts);
  const saveRequest={operation:'save',requestId:randomUUID(),resultId:packet.resultId,expectedResultRevision:packet.resultRevision,expectedBindingHash:sha256(canonicalJson(packet.binding)),expectedPacketHash:sha256(canonicalJson(packet))};
  return{packet,artifacts,saveRequest};
 };
 const bytes=async id=>JSON.parse(await sql(`select jsonb_build_object('packet',packet,'originalHash',original_packet_hash,'count',(select count(*) from public.part_three_saved_assessments q where q.owner_id=${literal(owner)}::uuid and q.request_id=s.request_id))::text from public.part_three_saved_assessments s where id=${literal(id)}::uuid and owner_id=${literal(owner)}::uuid;`));
 const lease=await publish({shortLease:true,exportAllowed:false,storageProbe:true});
 const scope={ownerId:owner,accountGeneration:base.binding.accountGeneration,encounterId:lease.packet.binding.encounterId,scanId:base.binding.scanId,captureSessionId:base.binding.captureSessionId};
 let recoveryStore,directory;
 if(recovery){
  directory=resolve(recovery.journalDirectory);const storage=await fileStorage(directory);
  recoveryStore=createPartThreeSaveRecoveryStore(storage,()=>({ownerId:owner,accountGeneration:scope.accountGeneration}));await recoveryStore.retain(scope,lease.saveRequest);
  const journal=await storage.getItem(saveRecoveryStorageKey(owner));
  check(JSON.parse(journal).attempts,[{scope,request:lease.saveRequest}],'Private journal stores only exact recovery scope and Save metadata');
  check(journal.includes(secret)||journal.includes(lease.artifacts.briefSecret)||journal.includes(recovery.token),false,'Private recovery journal contains no protected packet or authentication bytes');
 }
 // Commit occurs, but the receipt is deliberately not delivered to the journal.
 const committed=await p3(lease.saveRequest);check(committed.kind,'saved','Actual Save commits before simulated response loss');
 const stored=await bytes(committed.savedAssessmentId);check(stored.originalHash,lease.saveRequest.expectedPacketHash,'Original visible packet hash is retained separately from projected bytes');check(stored.count,1,'One saved receipt after response loss');check(Boolean(stored.packet.partFour.reviews.brief),false,'Raw report artifact is absent from durable packet');check(stored.packet.partFour.value.state,'unavailable','Derived price explanation is replaced with safe generic saved text');
 const exported=JSON.parse(await sql(`select private.part_four_retained_packet(packet,'export',clock_timestamp(),'{}')::text from public.part_three_saved_assessments where id=${literal(committed.savedAssessmentId)}::uuid;`));check(JSON.stringify(exported).includes(secret),false,'Export independently omits protected price and dependent URL');check(JSON.stringify((await bytes(committed.savedAssessmentId)).packet).includes(secret),true,'Export does not erase otherwise retained displayed source price');
 await pause(Math.max(0,Date.parse(lease.packet.validUntil)-Date.now()+150));
 let replay;
 if(recovery){replay=await coldReplay({...recovery,directory,scope,expected:lease.saveRequest});check(replay.exactRequestRecovered,true,'Fresh Node process recovers exact metadata-only Save');check(replay.journalCompleted,true,'Fresh process completes recovery only after real Edge receipt');check(await recoveryStore.recover(scope),null,'Completed cold recovery is observable from original process');}
 else replay=await p3(lease.saveRequest);
 check(replay.savedAssessmentId,committed.savedAssessmentId,'Original exact packet hash replays after current-result lease');check(replay.replayed,true,'Replay is idempotent after current lease');
 const historical=await p3({operation:'read_saved',savedAssessmentId:committed.savedAssessmentId});check(historical.kind,'historical','Actual saved source projection reopens after current lease');check(historical.assessmentWhenSaved.partFour.formula,base.partFour.formula,'Independent ingredient formula facts survive historical retention');check(JSON.stringify(historical).includes(secret),true,'Allowed price remains historically visible');
 const omitted=await publish({omit:true});const omittedSave=await p3(omitted.saveRequest);check(omittedSave.kind,'saved','Canonical omitted-source packet saves');check(JSON.stringify((await bytes(omittedSave.savedAssessmentId)).packet).includes(secret),false,'Omitted price cannot hide in URL or copied value explanation');check((await p3(omitted.saveRequest)).savedAssessmentId,omittedSave.savedAssessmentId,'Original hash of source-free omission metadata replays exactly');
 const finite=await publish({shortPrice:true});timing('before_save',finite.packet.validUntil,finite.artifacts);
 const finiteSave=await p3(finite.saveRequest);timing('after_save',finite.packet.validUntil,finite.artifacts);check(finiteSave.kind,'saved','Short source-retention fixture saves while current-result lease remains valid');
 const priceUntil=finite.artifacts.value.unitPrices[0].rights.fields.find(g=>g.field==='price').retention.until;await pause(Math.max(0,Date.parse(priceUntil)-Date.now()+150));
 const finiteRead=await p3({operation:'read_saved',savedAssessmentId:finiteSave.savedAssessmentId});check(JSON.stringify(finiteRead).includes(secret),false,'Retain deadline removes price and dependent URL on authoritative read');check(JSON.stringify((await bytes(finiteSave.savedAssessmentId)).packet).includes(secret),false,'Authoritative read physically persists erased source bytes');check(finiteRead.assessmentWhenSaved.partFour.formula,base.partFour.formula,'Source deadline preserves independent formula facts');
 await sql(`insert into private.part_four_source_withdrawals(dependency_id) values ${lease.artifacts.withdrawalIds.map(id=>`(${literal(id)})`).join(',')};`);
 const withdrawn=await bytes(committed.savedAssessmentId);check(JSON.stringify(withdrawn.packet).includes(secret),false,'Registry withdrawal immediately purges persisted price bytes');check(JSON.stringify(withdrawn.packet).includes(lease.artifacts.briefSecret),false,'Registry withdrawal immediately purges persisted report bytes');check(withdrawn.packet.partFour.formula,base.partFour.formula,'Withdrawal preserves unrelated formula knowledge');
 const withdrawnRead=await p3({operation:'read_saved',savedAssessmentId:committed.savedAssessmentId});check(withdrawnRead.kind,'historical','Withdrawn historical receipt remains readable');check(JSON.stringify(withdrawnRead).includes(lease.artifacts.briefSecret),false,'Transport does not restore erased report');check((await p3(lease.saveRequest)).savedAssessmentId,committed.savedAssessmentId,'Original hash replay never resurrects withdrawn bytes');check((await bytes(committed.savedAssessmentId)).count,1,'All replay paths keep exactly one receipt');
 console.log(JSON.stringify({suite:'part-four-retention-durable-fixture',checks,synthetic:true,actualAuthEdgeSQL:true,providersCalled:false,coldProcessRecovery:Boolean(recovery),responseLossModel:'simulated_receipt_withholding_after_real_edge_commit',tcpFaultInjected:false,nativeRestartClaimed:false,status:'passed'}));
 return{checks,savedAssessmentIds:[committed.savedAssessmentId,omittedSave.savedAssessmentId,finiteSave.savedAssessmentId],coldProcessRecovery:Boolean(recovery)};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)&&process.argv.includes('--recover'))await recoverProcess();
