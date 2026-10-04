#!/usr/bin/env node
// Synthetic local Auth + deployed Edge + SQL authoritative admission/ancestry/label grants.
// Dedicated Part4 stack only; bounded synthetic integration, no external provider calls.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {randomUUID,createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {writeFile,rm} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
import {buildEvidenceAdmissions} from '../src/domain/part-one/admission.ts';
import {parseDeclarationSection} from '../src/domain/part-one/parser.ts';
import {normalizeBarcode} from '../src/domain/part-one/barcode.ts';
import {ScanResultSchema} from '../src/contracts/PartOne.ts';
import {normalizeDatabaseDates} from '../supabase/functions/_shared/part-one-runtime.ts';
import {NormalizationResultSchema} from '../src/contracts/PartTwo.ts';
import {normalize as computeNormalization} from '../src/domain/part-two/index.ts';
import {preferenceSetup} from '../src/presentation/p0b-personalization/preferences.ts';
import {PART_TWO_RELEASE_ID,PART_TWO_VERSIONS,authoritativeInput,LOCAL_DICTIONARY_RELEASE} from '../supabase/functions/_shared/part-two-runtime.ts';
const endpoint=process.env.SUPABASE_URL,anon=process.env.SUPABASE_ANON_KEY,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!endpoint||!anon||!key||!process.env.PART_ONE_DOCKER_CONFIG)throw Error('Explicit local credentials/config required');
const url=new URL(endpoint);if(url.protocol!=='http:'||!['127.0.0.1','localhost'].includes(url.hostname)||url.pathname!=='/'||url.search||url.hash)throw Error('Hosted/ambiguous endpoint refused');
const admin=createClient(endpoint,key,{auth:{persistSession:false,autoRefreshToken:false}}),client=createClient(endpoint,anon,{auth:{persistSession:false,autoRefreshToken:false}});
const byteProbe=false;
const fixture=randomUUID(),databasePolicyId=`p2_label_${fixture.replaceAll('-','')}`,sourcePolicyId=randomUUID(),version='local-original-v1';let owner,token,ownerRemoved=false,checks=0;const ids=[],catalogProducts=[];
const check=(a,b,message)=>{assert.deepEqual(a,b,message);checks++;};
const sql=query=>new Promise((resolve,reject)=>{const p=spawn('/opt/homebrew/bin/docker',['--config',process.env.PART_ONE_DOCKER_CONFIG,'exec','-i','supabase_db_derive-part-four-lifecycle','psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-Atq'],{stdio:['pipe','pipe','pipe']});let out='',failure='';p.stdout.on('data',b=>out+=b);p.stderr.on('data',b=>failure+=b);p.once('error',reject);p.once('close',c=>c===0?resolve(out.trim()):reject(Error(`Fixture SQL failure (${query.slice(0,query.indexOf(' '))}): ${failure.split('\n').find(line=>line.startsWith('ERROR:'))??'details omitted'}`)));p.stdin.end(query);});
async function edge(prefix,path,body,requestToken=token){const r=await fetch(new URL(`/functions/v1/${prefix}${path}`,url),{method:'POST',headers:{apikey:anon,authorization:`Bearer ${requestToken}`,'content-type':'application/json'},body:JSON.stringify(body)});if(!r.ok){const failed=await r.json();console.error(JSON.stringify({stage:prefix,status:r.status,code:failed.code}));if(prefix==='part-one'){const direct=await client.rpc('part_one_operation',{p_action:'scans/create',p_payload:{idempotencyKey:body.idempotencyKey,request:body}});console.error(JSON.stringify({stage:'part1-direct',code:direct.error?.code,message:direct.error?.message}));}throw Error(`Synthetic ${prefix} request failed ${r.status}; payload omitted`);}return r.json();}
const now=new Date().toISOString(),expiry=new Date(Date.now()+3600000).toISOString();
const variant={brand:'Synthetic',line:'Original',form:'lotion',scent:'unscented',shade:'clear',spf:'not applicable',strength:'standard',size:'100',unit:'ml',packCount:1,packagingLevel:'each'};
const policy={policyId:sourcePolicyId,provider:databasePolicyId,version,permissionEvidence:'Original synthetic local identity and ingredient input; no external source',reviewedAt:now,expiresAt:expiry,revokedAt:null,operations:{lookup:true,process:true,retain:true,sharedDisplay:true,privateDisplay:false,ocr:false,cropThumbnail:false,rehost:false,hotlink:false,export:false},retainedFields:['identity','ingredients'],attribution:'Original synthetic local source',purgeObligations:['local fixture cleanup']};
async function fixtureProduct({ancestry=0,cycle=false,label=false,ingredientText='Water, Glycerin',ttlMilliseconds=3600000,name='Original synthetic authority fixture',catalog=false,requestedMarket='US',expectedAccepted=true}={}){
 const productExpiry=new Date(Date.now()+ttlMilliseconds).toISOString();
 const observationId=randomUUID(),declarationId=randomUUID(),snapshotId=randomUUID(),itemId=randomUUID(),sectionId=randomUUID();ids.push(observationId,declarationId,snapshotId);
 const base='0'+String(Math.floor(Math.random()*10**10)).padStart(10,'0');let sum=0;for(let i=10,w=3;i>=0;i--,w=w===3?1:3)sum+=Number(base[i])*w;const barcode=base+String((10-sum%10)%10),canonical=normalizeBarcode({raw:barcode,symbology:'upc_a',namespace:'gtin',retailerId:null}).canonicalCode;
 let catalogProductId=null;
 if(catalog){catalogProductId=randomUUID();catalogProducts.push(catalogProductId);const source='https://fixture.invalid/part-three-original';for(const [table,row] of [['products',{id:catalogProductId,brand:'Synthetic',name,category:'moisturizer',catalog_source_reference:source,catalog_public_source_url:source,catalog_observed_at:now,catalog_verified_at:now}],['product_variants',{id:itemId,product_id:catalogProductId,variant_name:'Original synthetic package',catalog_verification_status:'verified',catalog_source_reference:source,catalog_public_source_url:source,catalog_observed_at:now}],['product_identifiers',{variant_id:itemId,identifier_type:'gtin_12',identifier_value:barcode,source_authority:'founder',source_reference:source,observed_at:now,verified_at:now}]]){const r=await admin.from(table).insert(row);if(r.error)throw Error(`Synthetic catalog seed ${table}/${r.error.code}`);}}
 const ingredients=ingredientText,full=label?ingredients+'\nPurpose: Moisturizes facial skin. Leave on.':ingredients;
 const graph=Array.from({length:ancestry|| (cycle?4:0)},()=>randomUUID());ids.push(...graph);
 if(graph.length){const records=graph.map((id,i)=>{const deps=cycle?(i===0?[graph[1],graph[2]]:i===1||i===2?[graph[3]]:[graph[0]]):(graph[i+1]?[graph[i+1]]:[]);return `('${id}','observation',1,'${databasePolicyId}','${version}','{}',array[${deps.map(v=>`'${v}'::uuid`).join(',')}]::uuid[],now(),now()+interval '1 hour')`;});await sql(`insert into private.part_one_records(id,kind,revision,policy_id,policy_version,payload,dependencies,observed_at,expires_at) values ${records.join(',')};`);}
 const section=parseDeclarationSection({sectionId,observationId,imageId:null,sourceRevision:1,rawText:ingredients,sourceOffset:0,kind:'ingredients',startCovered:true,endCovered:true,lineCoverageComplete:true,entryId:()=>randomUUID()});
 const declaration={declarationId,revision:1,itemId,snapshotId,observationIds:[observationId],dependencyIds:[observationId],rawText:ingredients,textStructureHash:createHash('sha256').update(JSON.stringify(section)).digest('hex'),sections:[section],category:'cosmetic',completenessReasons:[],transcriptionUncertainty:[],parserVersion:'synthetic-spans-v1',aliasVersion:'unmapped-1',sourceRevision:1,sourceUpdatedAt:null,observedAt:now,expiresAt:productExpiry,policyId:sourcePolicyId,scope:'public',ownerId:null,packageObservationId:null,associationEvidenceIds:[observationId],variant,sourceMarkets:['US'],packageMarket:null,conflictIds:[],supersedesId:null,formulaEquivalence:'unknown'};
 const item={snapshotId,itemId,revision:1,name,variant,fieldEvidence:{name:[observationId],variant:[observationId]},barcodeAssertions:[{raw:barcode,symbology:'upc_a',namespace:'gtin',canonical,evidenceId:observationId}],requestedMarket,sourceMarkets:['US'],packageMarket:null,declarationIds:[declarationId],conflictIds:[],scope:'public',supersedesId:null};
 const observation={observationId,provider:databasePolicyId,providerRequestId:null,providerResponseId:null,comparison:'exact',fetchedAt:now,sourceUpdatedAt:null,adapterVersion:'local-fixture-v1',parserVersion:'local-fixture-v1',policyVersion:version,contentHash:createHash('sha256').update(full).digest('hex'),variant,sourceMarkets:['US'],sourceUrl:null,policyId:sourcePolicyId,status:'active',dependencyIds:graph.length?[graph[0]]:[],payload:{nativeCode:barcode,canonicalCode:canonical,name:item.name,rawIngredients:ingredients,nativeBrand:'Synthetic',structuredVariant:variant}};
 const admitted=buildEvidenceAdmissions(observation,item,declaration,{...policy,expiresAt:productExpiry},now,{databasePolicy:{databasePolicyId,sourcePolicyId,policyVersion:version}});check(admitted.selection.accepted,expectedAccepted,'actual production admission preserves the expected original synthetic declaration authority');
 if(!expectedAccepted){check(admitted.selection.state,'partial','unanswered market retains partial source evidence');check(admitted.selection.predicate.variantMarket.passed,false,'source market metadata does not assert requested/package market');check(admitted.selection.predicate.rightsFreshness.passed,true,'partial reading retains independently granted source rights');}
 const annotations=label?['purpose'].map(kind=>{const text='Moisturizes facial skin. Leave on.',start=full.indexOf(text);return {assertionId:randomUUID(),assertionKind:kind,text,start,end:start+text.length,transcription:'clear',conditional:null};}):[];
 for(const record of admitted.admissions){const payload=record.kind==='observation'?{...record.payload,rawText:full,labelAssertions:annotations}:record.payload;const {error}=await admin.rpc('part_one_worker',{p_action:'admit',p_payload:{...record,payload}});if(error)throw Error(`Production admission failed ${error.code}`);}
 check(await sql(`select (payload ? 'fullItem')::text from private.part_one_records where id='${snapshotId}';`),'false','production snapshot remains ROOT ItemSnapshot with no nested fixture substitute');
 const scan=ScanResultSchema.parse(await edge('part-one','/scans',{schemaVersion:1,requestId:randomUUID(),clientScanId:randomUUID(),idempotencyKey:randomUUID(),generation:0,code:{raw:barcode,symbology:'upc_a',namespace:'gtin',retailerId:null},requestedMarket,categoryHint:null}));
 return {scan,observationId,declarationId,snapshotId,annotations,catalogProductId,variantId:itemId,barcode};
}
async function normalize(scan,requestToken=token){
 const deadline=Date.now()+35000;let result;
 do{result=(byteProbe?value=>value:NormalizationResultSchema.parse)(await edge('part-two','/normalize',{schemaVersion:1,requestId:randomUUID(),scanId:scan.scanId,captureSessionId:null,expectedGeneration:scan.generation,expectedEvidenceRevision:scan.resultRevision},requestToken));if(result.state!=='pending'){if(result.state==='blocked'){const diagnosis=await admin.rpc('part_two_resolve',{p_owner:owner,p_payload:{schemaVersion:1,requestId:randomUUID(),scanId:scan.scanId,captureSessionId:null,expectedGeneration:scan.generation,expectedEvidenceRevision:scan.resultRevision}});const c=diagnosis.data?.context;console.error(JSON.stringify({stage:'synthetic_blocked_context',reasonCodes:result.reasonCodes,contextState:c?.state,dependencyCount:c?.dependencies?.length,currentReleaseMatches:c?.releaseId===PART_TWO_RELEASE_ID,contextVersions:c?.versions,captureRemoved:c?.capture?.removed}));}return result;}await new Promise(resolve=>setTimeout(resolve,500));}while(Date.now()<deadline);
 return result;
}
async function requestPart3(body,asToken=token){const r=await fetch(new URL('/functions/v1/part-three',url),{method:'POST',headers:{apikey:anon,authorization:`Bearer ${asToken}`,'content-type':'application/json'},body:JSON.stringify(body)});const bodyOut=await r.json();return {status:r.status,body:bodyOut};}
const p3=async(body,requestToken=token)=>{const r=await requestPart3(body,requestToken);if(r.status!==200){const payload={...body};delete payload.operation;const diagnosis=await admin.rpc('part_three_worker',{p_owner:owner,p_action:body.operation,p_payload:payload});console.error(JSON.stringify({stage:'p4-sql-diagnosis',action:body.operation,code:diagnosis.error?.code,message:diagnosis.error?.message}));throw Error(`Part3 synthetic ${body.operation} failed ${r.status}/${r.body.code??'unknown'}`);}return r.body;};
let savedId,secondOwner,secondToken,refreshToken,injectedAdapterCalls=0;
let lostResponseSaveReq = null, lostResponseSavedId = null;

if(url.origin!=='http://127.0.0.1:60741')throw Error('Dedicated Part4 stack required');
try{
 const {data,error}=await client.auth.signInAnonymously();if(error||!data.user||!data.session)throw Error('Synthetic Auth failed');owner=data.user.id;token=data.session.access_token;refreshToken=data.session.refresh_token;
 const {PART_THREE_RELEASE_HASH}=await import('../src/domain/part-three/release.ts');
 const {PART_FOUR_RELEASE_HASH,partFourBindingRelease}=await import('../src/domain/part-four/release.ts');const tuple=partFourBindingRelease();
 for(const [action,payload] of [['release/register',{releaseId:PART_TWO_RELEASE_ID,releaseHash:LOCAL_DICTIONARY_RELEASE.contentHash,versions:PART_TWO_VERSIONS,reviewEvidence:'Original synthetic local fixture only'}],['release/select',{releaseId:PART_TWO_RELEASE_ID}]]){const r=await admin.rpc('part_two_worker',{p_action:action,p_payload:payload});if(r.error)throw Error('Part2 local fixture release failed');}
 await sql(`insert into private.part_one_policies(id,version,lookup_allowed,retain_allowed,display_allowed,export_allowed,permission_evidence,expires_at,label_assertion_kinds,label_assertion_permission_evidence) values ('${databasePolicyId}','${version}',true,true,true,false,'Original synthetic local evidence only','${expiry}',array['purpose'],'Exact original synthetic cosmetic purpose fixture; local only');`);
 const candidate=await fixtureProduct({label:true,ingredientText:'Water, Glycerin, Mystery Name',catalog:false});const normalized=await normalize(candidate.scan);
 check(normalized.state,'ready','actual local Edge normalization ready');
 const {PersonalResultV2Schema}=await import('../src/contracts/PersonalResultV2.ts');
 const {canonicalJson,sha256}=await import('../src/domain/part-two/hash.ts');
 const currentId=randomUUID(),assessmentId=randomUUID(),noteId=randomUUID(),experienceId=randomUUID();
 const reference={kind:'manual',name:'Original synthetic current cream'};
 const use={timing:'pm',frequency:{kind:'exact',count:3,unit:'week'},startedOn:{state:'known',value:{value:'2026-01',precision:'month'}},stoppedOn:{state:'unsure'},duration:null,reportedPurpose:{answer:{state:'known',value:'moisturizing'},provenance:'self_report'},applicationSite:{answer:{state:'known',value:'face'},provenance:'self_report'},useForm:{answer:{state:'known',value:'leave_on'},provenance:'self_report'}};
 const setup={profile:{intent:'unanswered',primaryGoal:{state:'known',value:'dryness'},secondaryGoals:['simplify','maintain'],skinBehavior:'unanswered',reactivity:'unanswered',reproductive:{pregnancy:'withheld',tryingToConceive:'unanswered',nursing:'unanswered'},sensitivities:{status:'none_known',values:[]},treatments:{status:'none',values:[]}},routine:{completeness:'partial',items:[{id:currentId,reference,state:'current',...use}]},experiences:[{id:experienceId,reference,kind:'liked',occurred:{start:{state:'known',value:{value:'2020',precision:'year'}},end:{state:'unsure'}},useContext:null,symptoms:[],note:null}],preferences:[],assessments:[{id:assessmentId,reference,useContext:use,reportingPeriod:{start:{state:'unsure'},end:{state:'unanswered'}},goalOrPurpose:{state:'known',value:'moisturizing'},perceivedHelp:'helps',satisfaction:'dissatisfied',assessedAt:now}],notes:[{id:noteId,scope:'profile',targetRef:null,text:'Original synthetic private note, not a structured fact.'}],setupAnswers:{currentProducts:'reported',pastProducts:'reported'}};
 const setupReq={operation:'save_setup',requestId:randomUUID(),baseContextRevision:0,setup};
 const write=await edge('personal-context','',setupReq);check(write.contextRevision,1,'actual validated Edge atomic setup commits');check((await edge('personal-context','',setupReq)).replayed,true,'exact setup retry is idempotent');
 const read=await edge('personal-context','',{operation:'read_context_v2'});const legacyHistory=await edge('personal-context','',{operation:'get_experiences',atRevision:1,limit:20});check(legacyHistory.items[0].data.occurred.start,null,'Actual paged legacy report projects year precision to nullable date, never a V2 object');check(legacyHistory.items[0].data.useContext,null,'Actual paged legacy report preserves nullable use context');check(read.routine.data.items[0].frequency,use.frequency,'exact three-times-week survives actual SQL projection');check(read.routine.data.items[0].startedOn,use.startedOn,'month precision survives actual Edge SQL projection');
 const req={operation:'evaluate',requestId:randomUUID(),encounterId:randomUUID(),accountGeneration:1,generation:1,scanId:candidate.scan.scanId,captureSessionId:null,expectedPartOneGeneration:candidate.scan.generation,expectedPartOneRevision:candidate.scan.resultRevision,intent:'add',comparatorId:null,candidateRoutineItemId:null,selectedManualReportIds:[],use:{purpose:'moisturizing',site:'face',useForm:'leave_on'},savedAssessmentId:null};

 const registered=await admin.rpc('part_three_worker',{p_owner:owner,p_action:'release/register',p_payload:{releaseHash:PART_THREE_RELEASE_HASH,localFixture:true}});if(registered.error)throw Error('Part3 fixture release failed');
 await sql(`update private.part_four_release set permitted=true,release_hash='${tuple.releaseHash}',knowledge_version='${tuple.knowledgeVersion}',knowledge_hash='${tuple.knowledgeHash}',scientific_manifest_hash=null where id=true;`);
 const response=await p3(req);check(response.kind,'result','actual canonical P4 Edge publishes');
 const result=PersonalResultV2Schema.parse(response.result);
 check(result.partFour.formula.ingredients.map(i=>i.observedName),['Water','Glycerin','Mystery Name'],'all actual formula positions preserve order');
 check(result.partFour.formula.ingredients[0].card.short.length>0,true,'approved human ingredient explanation reaches actual packet');
 check(result.partFour.formula.ingredients[2].card,null,'unknown ingredient remains explicit');
 check(result.partFour.decisionState,'pending','missing efficacy evidence cannot become supported goal verdict');
 check(result.partFour.reviews.state,'unavailable','real source reports remain gated');
 check(result.partFour.value.state,'unavailable','real offers remain gated');
 check(result.refinementStatus,'off','model calls remain disabled');
 const saveReq={operation:'save',requestId:randomUUID(),resultId:result.resultId,expectedResultRevision:result.resultRevision,expectedBindingHash:sha256(canonicalJson(result.binding)),expectedPacketHash:sha256(canonicalJson(result))};
 const saved=await p3(saveReq);check(saved.kind,'saved','actual full packet Save commits');savedId=saved.savedAssessmentId;
 check((await p3(saveReq)).savedAssessmentId,savedId,'original full packet receipt replays after retention projection');
 const historical=await p3({operation:'read_saved',savedAssessmentId:savedId});
 check(historical.kind,'historical','actual saved packet reopens');check(historical.assessmentWhenSaved.partFour.formula,result.partFour.formula,'stable formula knowledge survives save projection');
 check(JSON.stringify(historical).includes('Original synthetic private note'),false,'raw unused profile note not copied into saved packet');
 check(historical.assessmentWhenSaved.partFour.retainedEvidence.fields.length,0,'no fake offer or report corpus retained');

 await writeFile('../integration-p4-lifecycle-private/save-baseline.json',JSON.stringify({owner,token,refreshToken,req,saveReq,savedId,result}),{mode:0o600});
 console.log(JSON.stringify({suite:'part-four-lifecycle-baseline',checks,actualAuthEdgeSQL:true,providersCalled:false,ownerRetained:true,status:'passed'}));
}finally{
 if(owner)await writeFile('../integration-p4-lifecycle-private/owner-receipt.json',JSON.stringify({owner,retained:true,endpoint:url.origin}),{mode:0o600});
}
