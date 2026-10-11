import {openSync,closeSync,fsyncSync,writeFileSync} from 'node:fs';import {join,resolve} from 'node:path';
import {calibration,calibrationHash} from '../../../tests/field-role-calibration.ts';
import {geminiBody} from '../facts-first-v2/execute.ts';import {createFrameWriter} from './frame-log.ts';
if(calibrationHash!=='55907dc7472abfbf838df2765b0e3eaa583071381e4154da7a9c6e30fdb3f226'||calibration.length!==6)throw Error('unreviewed_calibration');
export async function calibrationProbe(fetchImpl:typeof fetch=fetch,sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms)),now=()=>performance.now()){
 const key=process.env.GEMINI_API_KEY;if(!key||process.env.NODE_USE_ENV_PROXY!=='1')throw Error('missing_approved_environment');
 const cwd=process.cwd(),fd=openSync(join(cwd,'.review-v9-field-role-calibration.claimed'),'wx',0o600);try{fsyncSync(fd);}finally{closeSync(fd);}const d=openSync(cwd,'r');try{fsyncSync(d);}finally{closeSync(d);}
 const writer=createFrameWriter(cwd,()=>{}),results:any[]=[];let lastStart=-Infinity;
 const report:any={kind:'field_role_calibration',version:'v9',calibrationHash,maximumCalls:6,results,summary:null};
 try{
  for(const c of calibration){
   let wait=25000-(now()-lastStart);while(wait>0){await sleep(wait);wait=25000-(now()-lastStart);}
   const body=JSON.stringify(c.prepared.request);if(Buffer.byteLength(body)>32768)throw Error('request_budget');
   const record:any={id:c.id,expectedSupported:c.expectedSupported,targetField:c.targetField,requestHash:c.requestHash,status:null,outcome:'unknown',latencyMs:null};
   writer.write({kind:'dispatch',requestHash:c.requestHash,request:c.prepared.request});lastStart=now();record.startedAt=new Date().toISOString();const signal=AbortSignal.timeout(45000);let stage='transport';
   try{
    const r=await fetchImpl('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent',{method:'POST',redirect:'error',headers:{'content-type':'application/json','x-goog-api-key':key},body,signal});record.status=r.status;
    if(!r.ok){await r.body?.cancel();record.outcome='http_error';record.failureKind='transport';break;}
    const reader=r.body?.getReader(),chunks:Uint8Array[]=[];let size=0;if(reader)while(true){const x=await reader.read();if(x.done)break;size+=x.value.byteLength;if(size>65536){await reader.cancel();throw Error('response_budget');}chunks.push(x.value);}
    const text=Buffer.concat(chunks).toString('utf8');stage='persistence';writer.write({kind:'original_synthetic_provider_body',id:c.id,bodyText:text.split(key).join('[REDACTED]')});
    stage='contract';const decoded=geminiBody(JSON.parse(text));record.usage=decoded.usage;if(decoded.usage.outputTokens>4096)throw Error('output_budget');
    const review=c.prepared.parseResponse(decoded.value),target=review.fieldChecks.find(f=>f.field===c.targetField)!;
    stage='persistence';writer.write({kind:'review',id:c.id,review});record.outcome='parsed';record.actualSupported=review.actualSupported;record.copySupported=review.copySupported;record.targetSupported=target.supported;record.issue=target.issue;record.matchesExpected=target.supported===c.expectedSupported;
    record.otherUnsupportedFields=review.fieldChecks.filter(f=>!f.supported&&f.field!==c.targetField).map(f=>({field:f.field,issue:f.issue}));
   }catch(e){record.failureKind=stage;const msg=e instanceof Error?e.message:'';record.outcome=signal.aborted?'request_timeout':/^(invalid_|incomplete_|unreferenced_|copy_audit_|inconsistent_|unbound_|response_budget|output_budget|provider_safety_block)/.test(msg)?msg:'invalid_or_unknown_response';break;}
   finally{record.latencyMs=now()-lastStart;writer.write({kind:'calibration_result',...record});results.push(record);}
  }
  const parsed=results.filter(r=>r.outcome==='parsed');report.summary={attempted:results.length,parsed:parsed.length,correct:parsed.filter(r=>r.matchesExpected).length,falsePositives:parsed.filter(r=>!r.expectedSupported&&r.targetSupported).length,falseNegatives:parsed.filter(r=>r.expectedSupported&&!r.targetSupported).length,transportFailures:results.filter(r=>r.failureKind==='transport').length,contractFailures:results.filter(r=>r.failureKind==='contract').length,persistenceFailures:results.filter(r=>r.failureKind==='persistence').length,completed:results.length===6&&parsed.length===6,decisionComparisonCount:parsed.length,decisionJudgmentStable:parsed.length>=2?new Set(parsed.map(r=>r.actualSupported)).size===1:null};return report;
 }finally{writer.write(report);writeFileSync(join(cwd,'.review-v9-field-role-calibration-result.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});}
}
if(process.argv[1]&&resolve(process.argv[1])===new URL(import.meta.url).pathname)console.log(JSON.stringify(await calibrationProbe()));
