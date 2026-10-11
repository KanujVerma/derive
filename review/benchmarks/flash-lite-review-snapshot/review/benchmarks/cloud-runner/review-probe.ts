import {openSync,closeSync,fsyncSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {geminiBody} from '../facts-first-v2/execute.ts';
import {prepareFixturePhase,scoreFixture} from '../facts-first-v2/protocol.ts';
import dataset from '../facts-first-v3/cases.json' with {type:'json'};
import evidence from '../../../tests/heavy-settled.json' with {type:'json'};
import {createFrameWriter} from './frame-log.ts';
// One separate diagnostic over immutable settled synthetic inputs. Never updates the old run.
export const prepared=prepareFixturePhase(dataset as any,evidence.caseId,'review',evidence.checkpoints as any);
if(prepared.requestHash!=='37164dbe8078227b511e57648d137605f21e34cb6cc1bdda2653b16b45f57e8d'||evidence.sourceRun!=='3a11bffe-775d-4a96-8a96-00a2bbb93d95')throw Error('unreviewed_probe_input');
export async function probe(fetchImpl:typeof fetch=fetch){
 const requestKey=process.env.GEMINI_API_KEY;
 if(!requestKey||process.env.NODE_USE_ENV_PROXY!=='1')throw Error('missing_approved_environment');
 const sanitizeError=(text:string)=>text.split(requestKey).join('[REDACTED]').replace(/AIza[0-9A-Za-z_-]{20,}/g,'[REDACTED]').replace(/[A-Za-z0-9_\-+/=]{24,}/g,'[REDACTED]');
 const cwd=process.cwd(),claim=join(cwd,'.heavy-review-v8-lite-probe.claimed');
 const fd=openSync(claim,'wx',0o600);try{fsyncSync(fd);}finally{closeSync(fd);}const d=openSync(cwd,'r');try{fsyncSync(d);}finally{closeSync(d);}
 const writer=createFrameWriter(cwd,()=>{}),started=Date.now(),signal=AbortSignal.timeout(45000);
 const result:any={kind:'separate_flash_lite_review_v8_diagnostic',sourceRun:evidence.sourceRun,caseId:evidence.caseId,requestHash:prepared.requestHash,startedAt:new Date(started).toISOString(),status:null,outcome:'unknown',latencyMs:null};
 writer.write({kind:'request',requestHash:prepared.requestHash,request:prepared.request});
 try{
  const r=await fetchImpl('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent',{method:'POST',redirect:'error',headers:{'content-type':'application/json','x-goog-api-key':requestKey},body:JSON.stringify(prepared.request),signal});
  result.status=r.status;
  const reader=r.body?.getReader();let size=0;const chunks:Uint8Array[]=[];if(reader)while(true){const p=await reader.read();if(p.done)break;size+=p.value.byteLength;if(size>65536){await reader.cancel();throw Error('response_budget');}chunks.push(p.value);}
  const bodyText=Buffer.concat(chunks).toString('utf8');
  if(!r.ok){result.outcome='http_error';try{const e=JSON.parse(bodyText).error;result.errorCode=Number.isSafeInteger(e?.code)?e.code:null;result.errorStatus=typeof e?.status==='string'?sanitizeError(e.status).slice(0,80):null;result.errorMessage=typeof e?.message==='string'?sanitizeError(e.message).slice(0,600):null;}catch{}return result;}
  writer.write({kind:'original_synthetic_provider_body',bodyText:bodyText.split(requestKey).join('[REDACTED]')});
  const raw=JSON.parse(bodyText),decoded=geminiBody(raw);
  result.usage=decoded.usage;if(decoded.usage.outputTokens>4096)throw Error('output_budget');
  const value=decoded.value;
  const cp=prepared.parseResponse(value);result.outcome='parsed';result.score=scoreFixture(dataset as any,evidence.caseId,[...evidence.checkpoints,cp] as any);return result;
 }catch(e){const allowed=['unreferenced_copy_audit','invalid_copy_audit','invalid_copy_audit_reference','copy_audit_citation_mismatch','incomplete_copy_audit','inconsistent_copy_audit','invalid_bundle_review','unbound_bundle_review_branches','response_budget','output_budget','invalid_usage','provider_safety_block','invalid_response'];result.outcome=signal.aborted?'request_timeout':e instanceof Error&&allowed.includes(e.message)?e.message:'invalid_or_unknown_response';return result;}
 finally{result.latencyMs=Date.now()-started;writer.write(result);writeFileSync(join(cwd,'.heavy-review-v8-lite-result.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx',mode:0o600});}
}
if(process.argv[1]&&resolve(process.argv[1])===new URL(import.meta.url).pathname)console.log(JSON.stringify(await probe()));
