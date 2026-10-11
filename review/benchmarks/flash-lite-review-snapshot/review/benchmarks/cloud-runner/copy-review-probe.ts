import {openSync,closeSync,fsyncSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {geminiBody} from '../facts-first-v2/execute.ts';
import {prepareFixturePhase,scoreFixture} from '../facts-first-v2/protocol.ts';
import {canonicalJson,sha256} from '../../../src/domain/part-two/hash.ts';
import dataset from '../facts-first-v3/cases.json' with {type:'json'};
import evidence from '../../../tests/heavy-settled.json' with {type:'json'};
import {createFrameWriter} from './frame-log.ts';
const decision=evidence.checkpoints.filter(c=>c.phase==='decision');
export const copyPrepared=prepareFixturePhase(dataset as any,evidence.caseId,'copy',decision as any);
if(decision.length!==1||evidence.sourceRun!=='3a11bffe-775d-4a96-8a96-00a2bbb93d95'||copyPrepared.requestHash!=='4ceab2521b97c3401f34b7abd17251fea9c3443770da2ef263bd845b229c39b7')throw Error('unreviewed_probe_input');
export async function copyReviewProbe(fetchImpl:typeof fetch=fetch,makeWriter:typeof createFrameWriter=createFrameWriter){
 const key=process.env.GEMINI_API_KEY;if(!key||process.env.NODE_USE_ENV_PROXY!=='1')throw Error('missing_approved_environment');
 const cwd=process.cwd(),fd=openSync(join(cwd,'.heavy-copy-v7-review-v9-lite.claimed'),'wx',0o600);
 try{fsyncSync(fd);}finally{closeSync(fd);}const dir=openSync(cwd,'r');try{fsyncSync(dir);}finally{closeSync(dir);}
 const writer=makeWriter(cwd,()=>{}),checkpoints:any[]=[...decision];
 const result:any={kind:'fresh_copy_review_diagnostic',sourceRun:evidence.sourceRun,caseId:evidence.caseId,decisionHash:sha256(canonicalJson(decision[0])),phases:[],score:null};
 const sanitize=(s:string)=>s.split(key).join('[REDACTED]').replace(/AIza[0-9A-Za-z_-]{20,}/g,'[REDACTED]').replace(/[A-Za-z0-9_\-+/=]{24,}/g,'[REDACTED]');
 try{
  for(const phase of ['copy','review'] as const){
   const p=phase==='copy'?copyPrepared:prepareFixturePhase(dataset as any,evidence.caseId,phase,checkpoints);
   const body=JSON.stringify(p.request);if(Buffer.byteLength(body)>32768)throw Error('request_budget');
   const record:any={phase,requestHash:p.requestHash,status:null,outcome:'unknown',latencyMs:null};result.phases.push(record);
   // Persist the phase and full synthetic request before the sole fetch.
   writer.write({kind:'dispatch',phase,requestHash:p.requestHash,request:p.request});
   const start=Date.now(),signal=AbortSignal.timeout(45000);
   try{
    const r=await fetchImpl('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent',{method:'POST',redirect:'error',headers:{'content-type':'application/json','x-goog-api-key':key},body,signal});record.status=r.status;
    const reader=r.body?.getReader(),chunks:Uint8Array[]=[];let size=0;if(reader)while(true){const x=await reader.read();if(x.done)break;size+=x.value.byteLength;if(size>65536){await reader.cancel();throw Error('response_budget');}chunks.push(x.value);}
    const text=Buffer.concat(chunks).toString('utf8');
    if(!r.ok){record.outcome='http_error';try{const e=JSON.parse(text).error;record.errorMessage=typeof e?.message==='string'?sanitize(e.message).slice(0,600):null;}catch{}break;}
    writer.write({kind:'original_synthetic_provider_body',phase,bodyText:text.split(key).join('[REDACTED]')});
    const decoded=geminiBody(JSON.parse(text));record.usage=decoded.usage;
    if(decoded.usage.outputTokens>(phase==='copy'?3072:4096))throw Error('output_budget');
    const cp=p.parseResponse(decoded.value);writer.write({kind:'checkpoint',phase,checkpoint:cp});checkpoints.push(cp);record.outcome='parsed';
   }catch(e){const message=e instanceof Error?e.message:'';const allowed=['request_budget','response_budget','output_budget','invalid_usage','provider_safety_block','invalid_response','invalid_bundle_copy','invalid_bundle_copy_reference','duplicate_bundle_insight','incomplete_copy_audit','invalid_copy_audit','invalid_copy_audit_reference','unreferenced_copy_audit','copy_audit_citation_mismatch','inconsistent_copy_audit','invalid_bundle_review','unbound_bundle_review_branches'];record.outcome=signal.aborted?'request_timeout':allowed.includes(message)?message:'invalid_or_unknown_response';break;}
   finally{record.latencyMs=Date.now()-start;writer.write({kind:'phase_result',...record});}
  }
  if(checkpoints.length===3&&result.phases.length===2&&result.phases.every((p:any)=>p.outcome==='parsed'))result.score=scoreFixture(dataset as any,evidence.caseId,checkpoints);
  return result;
 }finally{writer.write(result);writeFileSync(join(cwd,'.heavy-copy-v7-review-v9-lite-result.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx',mode:0o600});}
}
if(process.argv[1]&&resolve(process.argv[1])===new URL(import.meta.url).pathname)console.log(JSON.stringify(await copyReviewProbe()));
