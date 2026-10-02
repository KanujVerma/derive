import {randomUUID} from 'node:crypto';
import {canonicalJson,sha256} from '../src/domain/part-two/hash.ts';
const literal=value=>"'"+String(value).replaceAll("'","''")+"'";
async function observe(sql,where,granted){for(let n=0;n<100;n++){if(await sql(`select count(*) from pg_locks l join pg_stat_activity a on a.pid=l.pid where l.locktype='advisory' and l.objid=40203 and l.granted=${granted?'true':'false'} and ${where};`)!=='0')return true;await new Promise(resolve=>setTimeout(resolve,20));}return false;}
/** Real transactions/API requests under observed lock waits. Sleep holds a test
 * fence, not an assumed race; every overlap is proven from pg_locks. */
export async function proveSaveContextErasureRace({owner,result,sql,erase,check}){
 const request={operation:'save',requestId:randomUUID(),resultId:result.resultId,expectedResultRevision:result.resultRevision,expectedBindingHash:sha256(canonicalJson(result.binding))};
 const application='p3_context_save_'+randomUUID().replaceAll('-','');
 const saving=sql(`set application_name=${literal(application)};begin;do $$begin perform private.part_three_owner(${literal(owner)});end$$;select pg_sleep(2);select public.part_three_worker(${literal(owner)},'save',${literal(JSON.stringify(request))}::jsonb)->>'kind';commit;`);
 check(await observe(sql,`a.application_name=${literal(application)}`,true),true,'Actual Part3 save owns 40203 lifecycle fence before context erase begins');
 const deletion=erase();const queued=await observe(sql,"a.query like '%delete_personal_context_record%'",false);
 const saved=await saving,erased=await deletion;check(queued,true,'Actual context erasure waits at lifecycle fence while exact assessment save is in flight');check(saved.trim(),'saved','Exact assessment save may commit first with its original current basis');check(erased.contextRevision,2,'Actual context erasure follows and acknowledges its next logical revision');
 check(await sql(`select count(*) from public.part_three_results where owner_id=${literal(owner)};`),'0','Context erasure removes every derived result after overlapping save');check(await sql(`select count(*) from public.part_three_saved_assessments where owner_id=${literal(owner)} and (packet is not null or request is not null or binding_hash is not null or result_revision is not null);`),'0','Overlapping save cannot resurrect body, enums, encounter choices or cached hash after erasure');
 console.log(JSON.stringify({suite:'part-three-save-context-erasure-race',status:'passed',observedLifecycleWait:true,actualEdgeContextDelete:true}));return erased;
}
export async function proveAuthSaveRace({owner,result,sql,admin,check}){
 const application='p3_auth_save_'+randomUUID().replaceAll('-','');
 const payload={operation:'save',requestId:randomUUID(),resultId:result.resultId,expectedResultRevision:result.resultRevision,expectedBindingHash:sha256(canonicalJson(result.binding))};
 const saving=sql(`set application_name=${literal(application)};begin;do $$begin perform private.part_three_owner(${literal(owner)});end$$;select pg_sleep(2);select public.part_three_worker(${literal(owner)},'save',${literal(JSON.stringify(payload))}::jsonb)->>'kind';commit;`);
 check(await observe(sql,`a.application_name=${literal(application)}`,true),true,'Actual Part3 save starts at approved global lifecycle lock order');
 const deletion=admin.auth.admin.deleteUser(owner);const queued=await observe(sql,"a.usename='supabase_auth_admin'",false);const saved=await saving,erased=await deletion;if(erased.error)throw Error('Actual synthetic Auth Admin deletion failed');check(queued,true,'Actual Auth Admin owner deletion waits before auth.users row while Part3 save holds lifecycle fence');check(saved.trim(),'saved','Part3 exact save completes before observed account erasure');
 for(const table of ['auth.users','public.part_three_results','public.part_three_saved_assessments','private.part_three_provider_attempts','private.part_three_encounters','public.personal_context_revisions'])check(await sql(`select count(*) from ${table} where ${table==='auth.users'?'id':table==='public.personal_context_revisions'?'user_id':'owner_id'}=${literal(owner)};`),'0',`Actual account deletion physically purges ${table}`);
 console.log(JSON.stringify({suite:'part-three-save-auth-erasure-race',status:'passed',actualAuthAdmin:true,observedLifecycleWait:true,manualPresaveCleanup:false}));
}
