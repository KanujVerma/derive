import {handlePersonalRequest} from '../supabase/functions/part-three/handler.ts';
const literal=value=>"'"+String(value).replaceAll("'","''")+"'";
/** Trusted live host, actual SQL admission/leases, deterministic synthetic
 * source withdrawal between prepare and publication. No provider is composed. */
export async function proveSourceWithdrawalRace({owner,admin,sql,request,context,normalize,observationId,check,mode='withdrawal'}){
 let withdrawn=false,leaseId=null;
 const rpc=async(action,payload)=>{const r=await admin.rpc('part_three_worker',{p_owner:owner,p_action:action,p_payload:payload});if(r.error)throw Error(`Source-race SQL ${action} ${r.error.code}`);return r.data;};
 const result=await handlePersonalRequest(request,{ownerId:owner,now:()=>new Date().toISOString(),normalize,context,history:async revision=>({items:[],nextCursor:null,atRevision:revision}),worker:async(action,payload)=>{
  if(action==='publish'&&!withdrawn){withdrawn=true;check(await sql(`select count(*) from public.part_three_results where id=${literal(leaseId)} and lease_token is not null;`),'1','Actual pending publication lease exists before original source withdrawal');if(mode==='withdrawal'){await sql(`update private.part_one_record_status set status='revoked',status_revision=status_revision+1,changed_at=now(),reason='Synthetic source-withdrawal race' where record_id=${literal(observationId)};`);check(await sql(`select count(*) from public.part_three_results where id=${literal(leaseId)};`),'0','Original withdrawal erases pending derived output before late publication');}else{const expiresAt=await sql(`select expires_at from private.part_one_records where id=${literal(observationId)};`);const remaining=Date.parse(expiresAt)-Date.now();check(remaining>0&&remaining<20000,true,'Dedicated short original source lease is still current at actual prepare');await new Promise(resolve=>setTimeout(resolve,Math.max(1,remaining+100)));check(await sql(`select (expires_at<now())::text from private.part_one_records where id=${literal(observationId)};`),'true','Original immutable source lease expires before successful publication transport');}}
  const value=await rpc(action,payload);if(action==='prepare')leaseId=value.resultId;return value;
 }});
 check(withdrawn,true,'Actual original source withdrawal ran between authoritative prepare and publish');check(result.kind,'unavailable','Late host publication cannot resurrect output from withdrawn original source');
 check((await rpc('read',{resultId:leaseId})).kind,'unavailable','Read cannot restore withdrawn result bytes after late publication');
 check(await sql(`select count(*) from public.part_three_results where id=${literal(leaseId)};`),'0','Invalid current read physically purges expired or withdrawn derived packet');
 console.log(JSON.stringify({suite:'part-three-original-source-publication-race',status:'passed',mode,actualOriginalStatusWithdrawal:mode==='withdrawal',actualImmutableSourceExpiry:mode==='expiry',injectedModelCalls:0}));
}
