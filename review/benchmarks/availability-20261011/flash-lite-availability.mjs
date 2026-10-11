import {mkdirSync,openSync,closeSync,writeFileSync,fsyncSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {createHash} from 'node:crypto';
const MODEL='gemini-3.5-flash-lite';
function syncDir(p){const fd=openSync(p,'r');try{fsyncSync(fd);}finally{closeSync(fd);}}
const statuses=['UNAVAILABLE','INVALID_ARGUMENT','RESOURCE_EXHAUSTED','PERMISSION_DENIED','UNAUTHENTICATED','NOT_FOUND','INTERNAL','DEADLINE_EXCEEDED','CANCELLED','UNKNOWN'];
const finishes=['STOP','MAX_TOKENS','SAFETY','RECITATION','OTHER','BLOCKLIST','PROHIBITED_CONTENT','SPII','MALFORMED_FUNCTION_CALL','IMAGE_SAFETY'];
export function requestFor(index){
 const generationConfig={temperature:0,candidateCount:1,maxOutputTokens:512,thinkingConfig:{thinkingLevel:'MINIMAL'}};
 if(index===1)Object.assign(generationConfig,{responseMimeType:'application/json',responseSchema:{type:'OBJECT',properties:{ok:{type:'BOOLEAN'}},required:['ok']}});
 if(index!==1)throw Error('invalid_diagnostic');
 return {contents:[{role:'user',parts:[{text:index===0?'Reply exactly OK.':'Return JSON with ok set to true.'}]}],generationConfig};
}
export async function runDiagnostic(index,directory,fetchImpl=fetch){
 const request=requestFor(index),key=process.env.GEMINI_API_KEY;
 if(!key)throw Error('missing_key');
 if(process.env.NODE_USE_ENV_PROXY!=='1')throw Error('proxy_not_enabled');
 const path=resolve(directory);mkdirSync(path,{recursive:true,mode:0o700});
 const claim=join(path,`flash-lite-availability-${index}.claimed`);
 const fd=openSync(claim,'wx',0o600);try{fsyncSync(fd);}finally{closeSync(fd);}syncDir(path);syncDir(dirname(path)); // One attempt per diagnostic, including failures.
 const body=JSON.stringify(request),started=Date.now();
 const record={diagnostic:index,model:MODEL,requestSha256:createHash('sha256').update(body).digest('hex'),requestBytes:Buffer.byteLength(body),startedAt:new Date(started).toISOString(),status:null,latencyMs:null,outcome:'unknown'};
 const timeoutSignal=AbortSignal.timeout(45000);
 try{
  const response=await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json','x-goog-api-key':key},body,signal:timeoutSignal});
  record.status=response.status;
  const reader=response.body?.getReader();let size=0,parts=[];
  if(reader){while(true){const r=await reader.read();if(r.done)break;size+=r.value.byteLength;if(size>131072){await reader.cancel();throw Error('response_budget');}parts.push(Buffer.from(r.value));}}
  record.responseBytes=size;
  let raw;try{raw=JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{record.outcome='non_json_response';return record;}
  record.hasError=!!raw?.error;
  record.providerErrorStatus=statuses.includes(raw?.error?.status)?raw.error.status:raw?.error?'UNRECOGNIZED':null;
  record.candidateCount=Array.isArray(raw?.candidates)?raw.candidates.length:0;
  record.finishReasons=Array.isArray(raw?.candidates)?raw.candidates.slice(0,4).map(c=>finishes.includes(c.finishReason)?c.finishReason:'UNRECOGNIZED'):[];
  record.usage={};for(const k of ['promptTokenCount','candidatesTokenCount','totalTokenCount','thoughtsTokenCount','cachedContentTokenCount']){const v=raw?.usageMetadata?.[k];if(Number.isSafeInteger(v)&&v>=0&&v<=1e9)record.usage[k]=v;}
  const text=raw?.candidates?.[0]?.content?.parts?.filter(p=>typeof p.text==='string'&&!p.thought).map(p=>p.text).join('')??'';
  record.expectedAnswer=false;
  if(index===0)record.expectedAnswer=text.trim()==='OK';else try{record.expectedAnswer=JSON.parse(text).ok===true;}catch{}
  record.outcome=response.ok?'http_success':'http_error';return record;
 }catch(e){record.outcome=(timeoutSignal.aborted||e?.name==='TimeoutError')?'request_timeout':e?.message==='response_budget'?'response_budget':record.status!==null?'invalid_provider_response':'network_or_request_error';return record;}
 finally{record.latencyMs=Date.now()-started;writeFileSync(join(path,`flash-lite-availability-${index}.json`),JSON.stringify(record,null,2)+'\n',{flag:'wx',mode:0o600});}
}
if(process.argv[1]&&resolve(process.argv[1])===new URL(import.meta.url).pathname){
 const index=Number(process.argv[2]);const directory=process.argv[3];if(!directory)throw Error('missing_evidence_directory');
 console.log(JSON.stringify(await runDiagnostic(index,directory)));
}
