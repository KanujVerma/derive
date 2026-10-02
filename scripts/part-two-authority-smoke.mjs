#!/usr/bin/env node
// Synthetic local Auth + deployed Edge + SQL authoritative admission/ancestry/label grants.
// No global config, release selection, cleanup worker, or other fixture mutations.
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {writeFile,rm} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
import {buildEvidenceAdmissions} from '../src/domain/part-one/admission.ts';
import {parseDeclarationSection} from '../src/domain/part-one/parser.ts';
import {normalizeBarcode} from '../src/domain/part-one/barcode.ts';
import {ScanResultSchema} from '../src/contracts/PartOne.ts';
import {NormalizationResultSchema} from '../src/contracts/PartTwo.ts';
import {normalize as computeNormalization} from '../src/domain/part-two/index.ts';
import {PART_TWO_RELEASE_ID,authoritativeInput,LOCAL_DICTIONARY_RELEASE} from '../supabase/functions/_shared/part-two-runtime.ts';
const endpoint=process.env.SUPABASE_URL,anon=process.env.SUPABASE_ANON_KEY,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!endpoint||!anon||!key||!process.env.PART_ONE_DOCKER_CONFIG)throw Error('Explicit local credentials/config required');
const url=new URL(endpoint);if(url.protocol!=='http:'||!['127.0.0.1','localhost'].includes(url.hostname)||url.pathname!=='/'||url.search||url.hash)throw Error('Hosted/ambiguous endpoint refused');
const admin=createClient(endpoint,key,{auth:{persistSession:false,autoRefreshToken:false}}),client=createClient(endpoint,anon,{auth:{persistSession:false,autoRefreshToken:false}});
const byteProbe=process.argv.includes('--withdrawal-bytes-only');
const fixture=randomUUID(),databasePolicyId=`p2_label_${fixture.replaceAll('-','')}`,sourcePolicyId=randomUUID(),version='local-original-v1';let owner,token,ownerRemoved=false,checks=0;const ids=[];
const check=(a,b,message)=>{assert.deepEqual(a,b,message);checks++;};
const sql=query=>new Promise((resolve,reject)=>{const p=spawn('/opt/homebrew/bin/docker',['--config',process.env.PART_ONE_DOCKER_CONFIG,'exec','-i','supabase_db_derive-part-two-task','psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-Atq'],{stdio:['pipe','pipe','pipe']});let out='',failure='';p.stdout.on('data',b=>out+=b);p.stderr.on('data',b=>failure+=b);p.once('error',reject);p.once('close',c=>c===0?resolve(out.trim()):reject(Error(`Fixture SQL failure (${query.slice(0,query.indexOf(' '))}): ${failure.split('\n').find(line=>line.startsWith('ERROR:'))??'details omitted'}`)));p.stdin.end(query);});
async function edge(prefix,path,body){const r=await fetch(new URL(`/functions/v1/${prefix}${path}`,url),{method:'POST',headers:{apikey:anon,authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify(body)});if(!r.ok)throw Error(`Synthetic ${prefix} request failed ${r.status}; payload omitted`);return r.json();}
const now=new Date().toISOString(),expiry=new Date(Date.now()+3600000).toISOString();
const variant={brand:'Synthetic',line:'Original',form:'lotion',scent:'unscented',shade:'clear',spf:'not applicable',strength:'standard',size:'100',unit:'ml',packCount:1,packagingLevel:'each'};
const policy={policyId:sourcePolicyId,provider:databasePolicyId,version,permissionEvidence:'Original synthetic local identity and ingredient input; no external source',reviewedAt:now,expiresAt:expiry,revokedAt:null,operations:{lookup:true,process:true,retain:true,sharedDisplay:true,privateDisplay:false,ocr:false,cropThumbnail:false,rehost:false,hotlink:false,export:false},retainedFields:['identity','ingredients'],attribution:'Original synthetic local source',purgeObligations:['local fixture cleanup']};
async function fixtureProduct({ancestry=0,cycle=false,label=false}={}){
 const observationId=randomUUID(),declarationId=randomUUID(),snapshotId=randomUUID(),itemId=randomUUID(),sectionId=randomUUID();ids.push(observationId,declarationId,snapshotId);
 const base='0'+String(Math.floor(Math.random()*10**10)).padStart(10,'0');let sum=0;for(let i=10,w=3;i>=0;i--,w=w===3?1:3)sum+=Number(base[i])*w;const barcode=base+String((10-sum%10)%10),canonical=normalizeBarcode({raw:barcode,symbology:'upc_a',namespace:'gtin',retailerId:null}).canonicalCode;
 const ingredients='Water, Glycerin',full=label?ingredients+'\nClaim: fragrance-free\nUsage: Apply nightly':ingredients;
 const graph=Array.from({length:ancestry|| (cycle?4:0)},()=>randomUUID());ids.push(...graph);
 if(graph.length){const records=graph.map((id,i)=>{const deps=cycle?(i===0?[graph[1],graph[2]]:i===1||i===2?[graph[3]]:[graph[0]]):(graph[i+1]?[graph[i+1]]:[]);return `('${id}','observation',1,'${databasePolicyId}','${version}','{}',array[${deps.map(v=>`'${v}'::uuid`).join(',')}]::uuid[],now(),now()+interval '1 hour')`;});await sql(`insert into private.part_one_records(id,kind,revision,policy_id,policy_version,payload,dependencies,observed_at,expires_at) values ${records.join(',')};`);}
 const section=parseDeclarationSection({sectionId,observationId,imageId:null,sourceRevision:1,rawText:ingredients,sourceOffset:0,kind:'ingredients',startCovered:true,endCovered:true,lineCoverageComplete:true,entryId:()=>randomUUID()});
 const declaration={declarationId,revision:1,itemId,snapshotId,observationIds:[observationId],dependencyIds:[observationId],rawText:ingredients,textStructureHash:createHash('sha256').update(JSON.stringify(section)).digest('hex'),sections:[section],category:'cosmetic',completenessReasons:[],transcriptionUncertainty:[],parserVersion:'synthetic-spans-v1',aliasVersion:'unmapped-1',sourceRevision:1,sourceUpdatedAt:null,observedAt:now,expiresAt:expiry,policyId:sourcePolicyId,scope:'public',ownerId:null,packageObservationId:null,associationEvidenceIds:[observationId],variant,sourceMarkets:['US'],packageMarket:null,conflictIds:[],supersedesId:null,formulaEquivalence:'unknown'};
 const item={snapshotId,itemId,revision:1,name:'Original synthetic authority fixture',variant,fieldEvidence:{name:[observationId],variant:[observationId]},barcodeAssertions:[{raw:barcode,symbology:'upc_a',namespace:'gtin',canonical,evidenceId:observationId}],requestedMarket:'US',sourceMarkets:['US'],packageMarket:null,declarationIds:[declarationId],conflictIds:[],scope:'public',supersedesId:null};
 const observation={observationId,provider:databasePolicyId,providerRequestId:null,providerResponseId:null,comparison:'exact',fetchedAt:now,sourceUpdatedAt:null,adapterVersion:'local-fixture-v1',parserVersion:'local-fixture-v1',policyVersion:version,contentHash:createHash('sha256').update(full).digest('hex'),variant,sourceMarkets:['US'],sourceUrl:null,policyId:sourcePolicyId,status:'active',dependencyIds:graph.length?[graph[0]]:[],payload:{nativeCode:barcode,canonicalCode:canonical,name:item.name,rawIngredients:ingredients,nativeBrand:'Synthetic',structuredVariant:variant}};
 const admitted=buildEvidenceAdmissions(observation,item,declaration,policy,now,{databasePolicy:{databasePolicyId,sourcePolicyId,policyVersion:version}});check(admitted.selection.accepted,true,'actual production admission computes accepted original synthetic public declaration');
 const annotations=label?['claim','usage'].map(kind=>{const text=kind==='claim'?'fragrance-free':'Apply nightly',start=full.indexOf(text);return {assertionId:randomUUID(),assertionKind:kind,text,start,end:start+text.length,transcription:'clear',conditional:null};}):[];
 for(const record of admitted.admissions){const payload=record.kind==='observation'?{...record.payload,rawText:full,labelAssertions:annotations}:record.payload;const {error}=await admin.rpc('part_one_worker',{p_action:'admit',p_payload:{...record,payload}});if(error)throw Error(`Production admission failed ${error.code}`);}
 check(await sql(`select (payload ? 'fullItem')::text from private.part_one_records where id='${snapshotId}';`),'false','production snapshot remains ROOT ItemSnapshot with no nested fixture substitute');
 const scan=ScanResultSchema.parse(await edge('part-one','/scans',{schemaVersion:1,requestId:randomUUID(),clientScanId:randomUUID(),idempotencyKey:randomUUID(),generation:0,code:{raw:barcode,symbology:'upc_a',namespace:'gtin',retailerId:null},requestedMarket:'US',categoryHint:null}));
 return {scan,observationId,declarationId,snapshotId,annotations};
}
async function normalize(scan){
 const deadline=Date.now()+35000;let result;
 do{result=(byteProbe?value=>value:NormalizationResultSchema.parse)(await edge('part-two','/normalize',{schemaVersion:1,requestId:randomUUID(),scanId:scan.scanId,captureSessionId:null,expectedGeneration:scan.generation,expectedEvidenceRevision:scan.resultRevision}));if(result.state!=='pending'){if(result.state==='blocked'){const diagnosis=await admin.rpc('part_two_resolve',{p_owner:owner,p_payload:{schemaVersion:1,requestId:randomUUID(),scanId:scan.scanId,captureSessionId:null,expectedGeneration:scan.generation,expectedEvidenceRevision:scan.resultRevision}});const c=diagnosis.data?.context;console.error(JSON.stringify({stage:'synthetic_blocked_context',reasonCodes:result.reasonCodes,contextState:c?.state,dependencyCount:c?.dependencies?.length,currentReleaseMatches:c?.releaseId===PART_TWO_RELEASE_ID,contextVersions:c?.versions,captureRemoved:c?.capture?.removed}));}return result;}await new Promise(resolve=>setTimeout(resolve,500));}while(Date.now()<deadline);
 return result;
}
try{
 if(!byteProbe)check(await sql('select release_id from private.part_two_config where id=true;'),PART_TWO_RELEASE_ID,'exact frozen local release is active without selecting/changing it');
 const {data,error}=await client.auth.signInAnonymously();if(error||!data.user||!data.session)throw Error('Synthetic Auth failed');owner=data.user.id;token=data.session.access_token;
 await sql(`insert into private.part_one_policies(id,version,lookup_allowed,retain_allowed,display_allowed,export_allowed,permission_evidence,expires_at) values ('${databasePolicyId}','${version}',true,true,true,false,'Original local synthetic evidence only','${expiry}');`);
 const labels=await fixtureProduct({label:true}),without=await normalize(labels.scan);check(without.state,'ready','bound original evidence ready without assertion grant');check(without.output.productFacts.facts.filter(f=>f.kind==='product_label_assertion').length,0,'default policy cannot emit claims');
 await sql(`update private.part_one_policies set label_assertion_kinds=array['claim','usage'],label_assertion_permission_evidence='Reviewed original synthetic label claims and usage; local test only' where id='${databasePolicyId}';`);
 let qualified=await normalize(labels.scan);check(qualified.state,'ready','qualified literal assertion output ready');
 if(!byteProbe){
  await sql(`update private.part_two_current set result=null,build_key=null,state='expired',lease_token=null,lease_expires_at=null,result_revision=result_revision+1 where owner_id='${owner}' and binding_key='${qualified.bindingKey}';`);
  const req={schemaVersion:1,requestId:randomUUID(),scanId:labels.scan.scanId,captureSessionId:null,expectedGeneration:labels.scan.generation,expectedEvidenceRevision:labels.scan.resultRevision};
  const lease=await admin.rpc('part_two_resolve',{p_owner:owner,p_payload:req});if(lease.error||!lease.data.ticket)throw Error('Byte-publication lease unavailable');
  const input=authoritativeInput(lease.data.context,req),body=computeNormalization(input,LOCAL_DICTIONARY_RELEASE,{snapshotId:randomUUID(),createdAt:new Date().toISOString(),resultRevision:lease.data.resultRevision});check(body.state,'ready','server-only input produces strict projected ready output');
  const full=lease.data.context.observations.find(o=>o.id===labels.observationId).payload.rawText;
  const mutations=[
   b=>b.sourceText=full,b=>b.output.sourceText=full,
   b=>b.permittedText={sections:[{text:full}],expiresAt:b.expiresAt},
   b=>b.output.reading.labelAssertions[0].sourceText=full,
   b=>b.output.reading.labelAssertions[0].conditional='Apply nightly',
   b=>b.output.reading.labelAssertions[0].span.sectionId='Apply nightly',
   b=>b.output.reading.dependencyManifest.sourceText=full,
   b=>b.output.reading.dependencyManifest.sourceRefs[0].sourceText=full,
   b=>b.output.reading.dependencyManifest.labelAssertionPermissions[0].sourceText=full,
   b=>b.output.reading.literalSections[0].sourceText=full,
   b=>b.output.reading.literalSections[0].rawText=full,
   b=>b.output.productFacts.facts.find(f=>f.kind==='product_label_assertion').value.sourceText=full
  ];
  for(const mutate of mutations){const bad=structuredClone(body);mutate(bad);const attempted=await admin.rpc('part_two_worker',{p_action:'publish',p_payload:{...lease.data.ticket,result:bad}});check(attempted.error?.code,'P0001','actual publication rejects a full-source byte sink in a client container');}
  const published=await admin.rpc('part_two_worker',{p_action:'publish',p_payload:{...lease.data.ticket,result:body}});if(published.error)throw Error(`Valid projected publication failed ${published.error.code}`);check(published.data.published,true,'same authoritative lease can publish strict projected output after rejected probes');
  qualified=await normalize(labels.scan);
 }
 const asserted=qualified.output.productFacts.facts.filter(f=>f.kind==='product_label_assertion');check(asserted.length,2,'independently reviewed field grants emit claim and usage');check(asserted.find(f=>f.value.assertionKind==='claim').value.text,'fragrance-free','label says literal remains exact without absence assertion');
 const saved=await edge('part-two','/saves',{save:{scanId:labels.scan.scanId,expectedGeneration:labels.scan.generation,expectedResultRevision:labels.scan.resultRevision,selectedSnapshotId:labels.scan.snapshotId,selectedDeclarationId:labels.scan.declarationId,idempotencyKey:randomUUID()},bindingKey:qualified.bindingKey,expectedPartTwoRevision:qualified.resultRevision});check(typeof saved.saveId,'string','actual saved interpretation exists');
 const history=()=>edge('part-two','/saved-details',{saveId:saved.saveId,requestId:randomUUID()});check((await history()).withdrawn,false,'qualified label history reopens with live permission');
 const ingredients=qualified.output.productFacts.facts.filter(f=>f.kind!=='product_label_assertion');
 await sql(`update private.part_one_policies set label_assertion_kinds=array['claim'] where id='${databasePolicyId}';`);
 const narrowed=await history(),n=byteProbe?narrowed.result:NormalizationResultSchema.parse(narrowed.result);
 {const currentAfterUsageRevoke=await normalize(labels.scan);const customerResolve=await client.rpc('part_two_operation',{p_action:'resolve',p_payload:{schemaVersion:1,requestId:randomUUID(),scanId:labels.scan.scanId,captureSessionId:null,expectedGeneration:labels.scan.generation,expectedEvidenceRevision:labels.scan.resultRevision}});await writeFile(new URL('../../label-withdrawal-byte-response.json',import.meta.url),JSON.stringify({saved:narrowed,current:currentAfterUsageRevoke,customerResolve:{errorCode:customerResolve.error?.code??null,data:customerResolve.data}},null,2));check(customerResolve.error?.code,'42501','customer resolve is denied with no full context/ticket');check(customerResolve.data,null,'customer resolve contains no retained original bytes');const forgedResolve=await client.rpc('part_two_resolve',{p_owner:randomUUID(),p_payload:{}});check(forgedResolve.error?.code,'42501','customer forged-owner service resolver is denied');check(forgedResolve.data,null,'forged resolver returns no original context');check(JSON.stringify(narrowed).includes('Apply nightly'),false,'saved full JSON must not contain withdrawn usage literal');check(JSON.stringify(currentAfterUsageRevoke).includes('Apply nightly'),false,'current full JSON must not contain withdrawn usage literal');const directSaved=await client.rpc('part_two_operation',{p_action:'saves/read',p_payload:{saveId:saved.saveId}});check(directSaved.error,null,'direct authenticated saved-read is independently byte-safe');check(JSON.stringify(directSaved.data).includes('Apply nightly'),false,'direct customer saved-read contains no withdrawn usage bytes');}
check(narrowed.withdrawn,false,'field-only revoke retains readable saved ingredient interpretation');check(n.output.productFacts.facts.filter(f=>f.kind!=='product_label_assertion'),ingredients,'ingredient IDs/literals/quantities preserved through field recall');check(n.output.productFacts.facts.filter(f=>f.kind==='product_label_assertion'),asserted.filter(f=>f.value.assertionKind==='claim'),'still permitted claim retains original immutable fact ID');check(n.output.productFacts.labelAssertions.length,1,'withdrawn usage literal roots removed');check(n.resultRevision>qualified.resultRevision,true,'saved field recall has higher Part2 revision');check(n.output.productFacts.versions,qualified.output.productFacts.versions,'original parser/dictionary/explanation release pins preserved');
 const stable=NormalizationResultSchema.parse((await history()).result);check(stable.resultRevision,n.resultRevision,'repeated saved projection replay is stable');check(stable.output.productFacts.snapshotId,n.output.productFacts.snapshotId,'repeated read does not create fresh projection identity');
 await sql(`update private.part_one_policies set label_assertion_kinds='{}' where id='${databasePolicyId}';`);
 const recalled=NormalizationResultSchema.parse((await history()).result);check(recalled.output.productFacts.facts.filter(f=>f.kind==='product_label_assertion').length,0,'all recalled assertion facts unavailable');check(recalled.output.productFacts.labelAssertions,[],'all recalled copied assertion roots unavailable');check(recalled.output.productFacts.facts.filter(f=>f.kind!=='product_label_assertion'),ingredients,'all independent ingredient facts remain after final field recall');
 const recomputed=await normalize(labels.scan);check(recomputed.state,'ready','current independently permitted facts recompute');check(recomputed.output.productFacts.facts.filter(f=>f.kind==='product_label_assertion').length,0,'current facts cannot revive revoked label fields');
 const over=await fixtureProduct({ancestry:512}),limit=await normalize(over.scan);check(limit.state,'parse_limit','actual Edge enforces ID ancestry cap before source projection');check(limit.permittedText,null,'over-limit terminal response has no copied source text');check(await sql(`select cardinality(private.part_two_bounded_ancestry(array['${over.snapshotId}'::uuid]));`),'513','over-limit traversal discovers only513 unique IDs');
 const below=await fixtureProduct({ancestry:500}),bounded=await normalize(below.scan);check(bounded.state,'ready','below-cap actual bound runtime remains wired');check(bounded.output.productFacts.facts.filter(f=>f.kind==='declared_ingredient').length,2,'below-cap exact ingredient proof survives canonical authorization');
 const diamond=await fixtureProduct({cycle:true}),cycled=await normalize(diamond.scan);check(cycled.state,'ready','actual Edge handles ancestry diamond/cycle without dropping permission checks');check(await sql(`select cardinality(private.part_two_bounded_ancestry(array['${diamond.snapshotId}'::uuid]));`),'7','actual graph deduplicates diamond and cycle IDs');
 const deniedFixture=await fixtureProduct(),deniedBefore=await normalize(deniedFixture.scan);check(deniedBefore.state,'ready','source-denial fixture is actually authorized before retraction');
 await sql(`update private.part_one_record_status set status='retracted',status_revision=status_revision+1,reason='Original synthetic source withdrawal test' where record_id='${deniedFixture.observationId}';`);
 const denied=await normalize(deniedFixture.scan);check(denied.state,'blocked','actual retracted source is blocked');check(denied.reasonCodes.includes('source_evidence_unavailable'),true,'actual Edge distinguishes source denial from dictionary refusal');check(denied.permittedText,null,'actual source denial cannot retain copied ingredient text');
 if(process.argv.includes('--auth-delete-race')){
  const candidate=await fixtureProduct(),known=await normalize(candidate.scan);check(known.state,'ready','race fixture actual public interpretation is ready');
  await edge('part-two','/saves',{save:{scanId:candidate.scan.scanId,expectedGeneration:candidate.scan.generation,expectedResultRevision:candidate.scan.resultRevision,selectedSnapshotId:candidate.scan.snapshotId,selectedDeclarationId:candidate.scan.declarationId,idempotencyKey:randomUUID()},bindingKey:known.bindingKey,expectedPartTwoRevision:known.resultRevision});
  const req={schemaVersion:1,requestId:randomUUID(),scanId:candidate.scan.scanId,captureSessionId:null,expectedGeneration:candidate.scan.generation,expectedEvidenceRevision:candidate.scan.resultRevision};
  const resolvePayload=JSON.stringify(req).replaceAll("'","''");
  const waitFor=async predicate=>{for(let n=0;n<100;n++){if(await sql(`select count(*) from pg_locks l join pg_stat_activity a on a.pid=l.pid where l.locktype='advisory' and l.objid=40203 and not l.granted and ${predicate};`)!=='0')return true;await new Promise(r=>setTimeout(r,20));}return false;};
  // Deterministic same-owner Part1 owner initialization overlaps a real Part2 request.
  const ownerApplication=`p2_same_owner_${fixture.replaceAll('-','')}`;
  const ownerRead=sql(`set application_name='${ownerApplication}';begin;set local request.jwt.claim.sub='${owner}';do $$begin perform private.part_one_owner();end$$;select pg_sleep(2);select (public.part_one_operation('scans/read','{"scanId":"${candidate.scan.scanId}"}'::jsonb)->>'scanId')='${candidate.scan.scanId}';commit;`);
  for(let n=0;n<100;n++){if(await sql(`select count(*) from pg_locks l join pg_stat_activity a on a.pid=l.pid where a.application_name='${ownerApplication}' and l.locktype='advisory' and l.objid=40203 and l.granted;`)!=='0')break;if(n===99)throw Error('Same-owner race barrier unavailable');await new Promise(r=>setTimeout(r,20));}
  const ownerConcurrent=normalize(candidate.scan),ownerWaitApplication=`p2_owner_wait_${fixture.replaceAll('-','')}`;
  const ownerResolve=sql(`set application_name='${ownerWaitApplication}';set request.jwt.claim.sub='${owner}';select public.part_two_resolve('${owner}','${resolvePayload}'::jsonb)->>'state';`);
  check(await waitFor(`a.application_name='${ownerWaitApplication}'`),true,'same-owner Part2 resolver actually waits on 40203 before owner/rows');
  check((await ownerResolve).trim(),'ready','actual same-owner resolver survives observed lifecycle wait');
  check((await ownerRead).trim(),'t','actual Part1 owner initialization/read completes during Part2 request');check((await ownerConcurrent).state,'ready','same-owner Part2 request serializes without owner/global deadlock');
  // Actual cleanup-service dispatch for a nonexistent synthetic object carries no
  // global claim and touches no stored object; it exercises its 40203-first entry.
  const cleanupApplication=`p2_cleanup_${fixture.replaceAll('-','')}`,absentObject=randomUUID();
  const cleanupRead=sql(`set application_name='${cleanupApplication}';begin;select pg_advisory_xact_lock(40203);select pg_sleep(2);select public.part_one_private_service('cleanup/dispatch','{"objectId":"${absentObject}","leaseToken":"${randomUUID()}"}'::jsonb)->>'deleted';commit;`);
  for(let n=0;n<100;n++){if(await sql(`select count(*) from pg_locks l join pg_stat_activity a on a.pid=l.pid where a.application_name='${cleanupApplication}' and l.locktype='advisory' and l.objid=40203 and l.granted;`)!=='0')break;if(n===99)throw Error('Cleanup race barrier unavailable');await new Promise(r=>setTimeout(r,20));}
  const cleanupConcurrent=normalize(candidate.scan),cleanupWaitApplication=`p2_cleanup_wait_${fixture.replaceAll('-','')}`;
  const cleanupResolve=sql(`set application_name='${cleanupWaitApplication}';set request.jwt.claim.sub='${owner}';select public.part_two_resolve('${owner}','${resolvePayload}'::jsonb)->>'state';`);
  check(await waitFor(`a.application_name='${cleanupWaitApplication}'`),true,'actual Part2 resolver waits behind cleanup lifecycle before acquiring 40204');
  check((await cleanupResolve).trim(),'ready','Part2 resolver completes after observed cleanup wait');
  check((await cleanupRead).trim(),'true','actual Part1 cleanup service completes during Part2 request');check((await cleanupConcurrent).state,'ready','Part2 waits behind cleanup lifecycle without inverse lock deadlock');
  await sql(`update private.part_two_current set result=null,build_key=null,state='expired',lease_token=null,lease_expires_at=null,result_revision=result_revision+1 where owner_id='${owner}' and binding_key='${known.bindingKey}';`);

  const {data:resolved,error:resolveError}=await admin.rpc('part_two_resolve',{p_owner:owner,p_payload:req});if(resolveError||!resolved.ticket)throw Error('Actual race lease unavailable');
  const derived=computeNormalization(authoritativeInput(resolved.context,req),LOCAL_DICTIONARY_RELEASE,{snapshotId:randomUUID(),createdAt:new Date().toISOString(),resultRevision:resolved.resultRevision});check(derived.state,'ready','race computation uses exact actual authoritative mapper/core');
  const publication=JSON.stringify({...resolved.ticket,result:derived}).replaceAll("'","''"),application=`p2_owner_race_${fixture.replaceAll('-','')}`;
  const worker=sql(`set application_name='${application}';begin;do $$begin perform private.part_two_context('${owner}','${candidate.scan.scanId}',null);end$$;select pg_sleep(2);select public.part_two_worker('publish','${publication}'::jsonb)->>'published';commit;`);
  for(let attempt=0;attempt<100;attempt++){if(await sql(`select count(*) from pg_locks l join pg_stat_activity a on a.pid=l.pid where a.application_name='${application}' and l.locktype='advisory' and l.objid=40204 and l.granted;`)!=='0')break;if(attempt===99)throw Error('Publication race barrier unavailable');await new Promise(resolve=>setTimeout(resolve,20));}
  const deletionPending=admin.auth.admin.deleteUser(owner);
  const authWaitObserved=await waitFor("a.usename='supabase_auth_admin'");
  const deletion=await deletionPending;if(deletion.error){await worker.catch(()=>{});console.error(JSON.stringify({suite:'auth-delete-race-http',status:deletion.error.status,code:deletion.error.code,checks}));throw Error('Actual Auth Admin deletion failed while publication overlapped');}
  ownerRemoved=true;check(authWaitObserved,true,'actual Auth Admin deletion waits at statement lifecycle fence before auth.users row');
  check((await worker).trim(),'true','actual service worker publication completes before owner deletion fence');
  check(await sql(`select count(*) from auth.users where id='${owner}';`),'0','actual Auth Admin deletes owner with public saved records without manual save cleanup');
  check(await sql(`select count(*) from private.part_two_snapshots where owner_id='${owner}';`),'0','owner erasure purges every derived snapshot copy');
  check(await sql(`select count(*) from private.part_two_current where owner_id='${owner}';`),'0','owner erasure purges all current/leased jobs');
  check(await sql(`select count(*) from private.part_one_saves where owner_id='${owner}';`),'0','actual owner erasure cascades public saved rows');
  check(await sql(`select count(*) from private.part_one_records where id='${candidate.observationId}';`),'1','independent public proof survives actual account erasure');
  console.log(JSON.stringify({suite:'part-two-owner-publication-auth-race',status:'passed',actualAuthAdmin:true,manualPresaveCleanup:false,checks}));
 }
 if(process.argv.includes('--ui')){
  await sql(`update private.part_one_policies set label_assertion_kinds=array['claim','usage'],label_assertion_permission_evidence='Reviewed original synthetic claim/usage fixture; local native test only' where id='${databasePolicyId}';`);
  const native=await fixtureProduct({label:true});const ready=await normalize(native.scan);check(ready.state,'ready','native actual qualified literal fixture is ready');
  await writeFile(new URL('../../part-two-authority-ui-bootstrap.json',import.meta.url),JSON.stringify({ownerId:owner,token,apiKey:anon,serviceKey:key,result:native.scan,apiOrigin:url.origin,observationId:native.observationId}),{mode:0o600});
  console.log(JSON.stringify({suite:'part-two-authority-native-bootstrap',status:'ready',syntheticOnly:true,credentials:'private local mode600 file only'}));
  const hold=setInterval(()=>{},1000);await new Promise(resolve=>{process.once('SIGTERM',resolve);process.once('SIGINT',resolve);});clearInterval(hold);
 }
 console.log(JSON.stringify({suite:'part-two-authority-actual-local',checks,status:'passed',actualAuthEdgeSql:true,productionRootAdmission:true,syntheticOnly:true,externalProviderCalls:0}));
}catch(error){console.error(JSON.stringify({suite:'part-two-authority-main-error',message:error instanceof Error?error.message.slice(0,5000):'unknown error',checks}));throw error;}finally{
 await writeFile(new URL('../../part-two-authority-cleanup-refs.json',import.meta.url),JSON.stringify({ownerId:owner,databasePolicyId,ids}),{mode:0o600});
 if(process.argv.includes('--ui'))await rm(new URL('../../part-two-authority-ui-bootstrap.json',import.meta.url),{force:true});
 if(owner&&!ownerRemoved){await sql(`delete from private.part_one_saves where owner_id='${owner}';`);const {error}=await admin.auth.admin.deleteUser(owner);if(error){console.error(JSON.stringify({stage:'synthetic_owner_cleanup',code:error.code??'auth_cleanup_failed'}));await sql(`delete from auth.users where id='${owner}';`);}}
 if(ids.length)await sql(`delete from private.part_one_records where id=any(array[${ids.map(id=>`'${id}'::uuid`).join(',')}]);`);
 await sql(`delete from private.part_two_policy_epochs where policy_id='${databasePolicyId}';delete from private.part_one_policies where id='${databasePolicyId}';`);
}
