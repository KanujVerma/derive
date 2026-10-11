import {openSync,closeSync,fsyncSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {geminiBody} from '../facts-first-v2/execute.ts';
import {prepareFixturePhase,scoreFixture} from '../facts-first-v2/protocol.ts';
import dataset from '../facts-first-v3/cases.json' with {type:'json'};
import evidence from '../../../tests/heavy-settled.json' with {type:'json'};
import {createFrameWriter} from './frame-log.ts';
// One separate diagnostic over immutable settled synthetic inputs. Never updates the old run.
export const prepared=prepareFixturePhase(dataset as any,evidence.caseId,'review',evidence.checkpoints as any);
if(prepared.requestHash!=='cea8739ae2e5864128935e718770ace214afa6476eaef35c3f4a9a0df7b30e89'||evidence.sourceRun!=='3a11bffe-775d-4a96-8a96-00a2bbb93d95')throw Error('unreviewed_probe_input');
export async function probe(fetchImpl:typeof fetch=fetch){
 if(!process.env.GEMINI_API_KEY||process.env.NODE_USE_ENV_PROXY!=='1')throw Error('missing_approved_environment');
 const cwd=process.cwd(),claim=join(cwd,'.heavy-review-v4-probe.claimed');
 const fd=openSync(claim,'wx',0o600);try{fsyncSync(fd);}finally{closeSync(fd);}const d=openSync(cwd,'r');try{fsyncSync(d);}finally{closeSync(d);}
 const writer=createFrameWriter(cwd,()=>{}),started=Date.now(),signal=AbortSignal.timeout(45000);
 const result:any={kind:'separate_review_diagnostic',sourceRun:evidence.sourceRun,caseId:evidence.caseId,requestHash:prepared.requestHash,startedAt:new Date(started).toISOString(),status:null,outcome:'unknown',latencyMs:null};
 writer.write({kind:'request',requestHash:prepared.requestHash,request:prepared.request});
 try{
  const r=await fetchImpl('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent',{method:'POST',redirect:'error',headers:{'content-type':'application/json','x-goog-api-key':process.env.GEMINI_API_KEY!},body:JSON.stringify(prepared.request),signal});
  result.status=r.status;if(!r.ok){await r.body?.cancel();result.outcome='http_error';return result;}
  const reader=r.body?.getReader();let size=0;const chunks:Uint8Array[]=[];if(reader)while(true){const p=await reader.read();if(p.done)break;size+=p.value.byteLength;if(size>65536){await reader.cancel();throw Error('response_budget');}chunks.push(p.value);}
  const bodyText=Buffer.concat(chunks).toString('utf8');writer.write({kind:'original_synthetic_provider_body',bodyText});
  const raw=JSON.parse(bodyText),decoded=geminiBody(raw);
  result.usage=decoded.usage;if(decoded.usage.outputTokens>4096)throw Error('output_budget');
  const value=decoded.value;
  const cp=prepared.parseResponse(value);result.outcome='parsed';result.score=scoreFixture(dataset as any,evidence.caseId,[...evidence.checkpoints,cp] as any);return result;
 }catch(e){const allowed=['unreferenced_copy_audit','invalid_copy_audit','invalid_copy_audit_reference','copy_audit_citation_mismatch','incomplete_copy_audit','inconsistent_copy_audit','invalid_bundle_review','unbound_bundle_review_branches','response_budget','output_budget','invalid_usage','provider_safety_block','invalid_response'];result.outcome=signal.aborted?'request_timeout':e instanceof Error&&allowed.includes(e.message)?e.message:'invalid_or_unknown_response';return result;}
 finally{result.latencyMs=Date.now()-started;writer.write(result);writeFileSync(join(cwd,'.heavy-review-v4-result.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx',mode:0o600});}
}
if(process.argv[1]&&resolve(process.argv[1])===new URL(import.meta.url).pathname)console.log(JSON.stringify(await probe()));
