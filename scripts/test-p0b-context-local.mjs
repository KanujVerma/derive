/** Disposable local-only P0-B Auth/Edge/context acceptance. Never resets the shared stack. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
const status=JSON.parse(execFileSync(process.env.SUPABASE_CLI ?? 'supabase',['status','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
assert.equal(status.API_URL,'http://127.0.0.1:54321','Refuse non-local Supabase');
const client=key=>createClient(status.API_URL,key,{auth:{autoRefreshToken:false,persistSession:false}});
const admin=client(status.SERVICE_ROLE_KEY), a=client(status.ANON_KEY),b=client(status.ANON_KEY);
const call=async(c,body)=>{const {data,error}=await c.functions.invoke('personal-context',{body});return {data,error,status:error?.context?.status??200};};
const good=async(c,body)=>{const r=await call(c,body);assert.ifError(r.error);return r.data;};
let aid,bid,pid,vid,fid,newFid;
try {
  const sa=await a.auth.signInAnonymously(),sb=await b.auth.signInAnonymously();assert.ifError(sa.error);assert.ifError(sb.error);aid=sa.data.user.id;bid=sb.data.user.id;
  const noAuth=await fetch(`${status.API_URL}/functions/v1/personal-context`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation:'get_context'})});
  assert.equal(noAuth.status,401,'missing Authorization is rejected before context access');
  assert.equal((await good(a,{operation:'get_context'})).revision,0);
  for(const table of ['personal_context_heads','personal_context_revisions','personal_decision_assessments']) assert.equal((await a.from(table).select('*')).error?.code,'42501');
  const profile={intent:'add',primaryGoal:'dryness',secondaryGoals:['maintain'],skinBehavior:'dry_tight',reactivity:'unsure',reproductive:{pregnancy:'unanswered',tryingToConceive:'withheld',nursing:'no'},sensitivities:{status:'unanswered',values:[]},treatments:{status:'none',values:[]}};
  const request={operation:'save_profile',requestId:randomUUID(),baseRevision:0,profile};
  const concurrent=await Promise.all([good(a,request),good(a,request)]);assert.equal(concurrent[0].revision.id,concurrent[1].revision.id);assert.equal(concurrent.filter(v=>v.replayed).length,1);
  assert.equal((await call(a,{...request,profile:{...profile,intent:'replace'}})).status,409);
  assert.equal((await call(a,{...request,requestId:randomUUID()})).status,409);
  assert.equal((await call(b,{operation:'get_revision',revisionId:concurrent[0].revision.id})).status,404);
  assert.equal((await good(b,{operation:'get_context'})).profile,null);
  const item={id:randomUUID(),reference:{kind:'manual',name:'Retinol cleanser'},state:'occasional',timing:'unknown',frequency:{kind:'qualitative',value:'few_times_week'},startedOn:null,stoppedOn:null,duration:null};
  const routine={operation:'save_routine',requestId:randomUUID(),baseRevision:1,routine:{completeness:'partial',items:[item]}};
  const races=await Promise.all([call(a,routine),call(a,{...routine,requestId:randomUUID()})]);assert.deepEqual(races.map(v=>v.status).sort(),[200,409]);
  const snapshot=await good(a,{operation:'get_context'});assert.equal(snapshot.routine.data.completeness,'partial');assert.deepEqual(snapshot.routine.data.items[0].frequency,{kind:'qualitative',value:'few_times_week'});assert.equal(snapshot.routine.data.items[0].activeClasses,undefined);
  assert.equal((await call(a,{operation:'save_routine',requestId:randomUUID(),baseRevision:2,routine:{completeness:'complete',items:[{...item,reference:{kind:'catalog',productId:randomUUID(),variantId:null,formulaVersionId:null}}]}})).status,400);
  const now=new Date().toISOString();
  const pr=await admin.from('products').insert({brand:'P0B smoke',name:`Historical product ${randomUUID()}`,category:'moisturizer',is_catalog_standard:true,catalog_source_reference:'https://manufacturer.example/p0b',catalog_public_source_url:'https://manufacturer.example/p0b',catalog_observed_at:now,catalog_verified_at:now}).select('id').single();assert.ifError(pr.error);pid=pr.data.id;
  const vr=await admin.from('product_variants').insert({product_id:pid,variant_name:'Reviewed variant',catalog_verification_status:'verified',catalog_source_reference:'https://manufacturer.example/p0b',catalog_public_source_url:'https://manufacturer.example/p0b',catalog_observed_at:now}).select('id').single();assert.ifError(vr.error);vid=vr.data.id;
  const fr=await admin.from('product_formula_versions').insert({variant_id:vid,ingredients:['Water','Glycerin'],normalized_ingredient_fingerprint:'water|glycerin',provenance_type:'manufacturer',source_reference:'https://manufacturer.example/p0b',observed_at:now,verification_status:'verified'}).select('id').single();assert.ifError(fr.error);fid=fr.data.id;
  const experience={id:randomUUID(),reference:{kind:'catalog',productId:pid,variantId:vid,formulaVersionId:fid},kind:'no_reaction_reported',occurred:{start:null,end:null},useContext:null,symptoms:[],note:null};
  const exreq={operation:'append_experience',requestId:randomUUID(),baseRevision:2,supersedesRevisionId:null,experience};
  const original=await good(a,exreq);
  const reformulated=await admin.from('product_formula_versions').insert({variant_id:vid,ingredients:['Water','Ceramide NP'],normalized_ingredient_fingerprint:'water|ceramide np',provenance_type:'manufacturer',source_reference:'https://manufacturer.example/p0b-new',observed_at:now,verification_status:'verified',supersedes_id:fid}).select('id').single();assert.ifError(reformulated.error);newFid=reformulated.data.id;
  const corrected=await good(a,{...exreq,requestId:randomUUID(),baseRevision:3,supersedesRevisionId:original.revision.id,experience:{...experience,kind:'reacted',symptoms:['Stinging']}});
  assert.equal(corrected.revision.supersedesRevisionId,original.revision.id);
  assert.equal((await good(a,{operation:'get_revision',revisionId:original.revision.id})).revision.data.kind,'no_reaction_reported');
  const current=await good(a,{operation:'get_context'});assert.equal(current.experiences.length,1);assert.equal(current.experiences[0].data.kind,'reacted');assert.equal(current.experiences[0].data.reference.formulaVersionId,fid);
  assert.equal((await call(a,{...exreq,requestId:randomUUID(),baseRevision:4,supersedesRevisionId:original.revision.id})).status,409);
  assert.equal((await call(b,{...exreq,requestId:randomUUID(),baseRevision:0,supersedesRevisionId:corrected.revision.id})).status,409);
  for (let i=0;i<51;i++) {
    const newer={id:randomUUID(),reference:{kind:'manual',name:`Unrelated cream ${i}`},kind:'liked',occurred:{start:null,end:null},useContext:null,symptoms:[],note:null};
    assert.ifError((await admin.rpc('write_personal_context',{p_user_id:aid,p_request_id:randomUUID(),p_base_revision:4+i,p_section:'experience',p_payload:newer,p_supersedes_revision_id:null})).error);
  }
  const bounded=await good(a,{operation:'get_context'});assert.equal(bounded.historyTruncated,true);assert.equal(bounded.experiences.length,50);assert.equal(bounded.experiences.some(v=>v.data.reference.productId===pid),false);
  const relevant=await good(a,{operation:'get_experiences',atRevision:55,productId:pid});assert.equal(relevant.items.length,1);assert.equal(relevant.items[0].data.kind,'reacted');assert.equal(relevant.nextCursor,null);
  const historical=await good(a,{operation:'get_experiences',atRevision:3,productId:pid});assert.equal(historical.items[0].data.kind,'no_reaction_reported');
  const page1=await good(a,{operation:'get_experiences',atRevision:55,limit:50});assert.equal(page1.items.length,50);assert.ok(page1.nextCursor);
  const page2=await good(a,{operation:'get_experiences',atRevision:55,limit:50,cursor:page1.nextCursor});assert.equal(page2.items.length,2);assert.equal(page2.nextCursor,null);
  assert.equal((await call(b,{operation:'get_experiences',atRevision:0,cursor:page1.nextCursor})).status,404);
  assert.ifError((await admin.from('free_skin_profiles').insert({user_id:aid,goals:['dryness','maintain'],pregnancy_status:'yes'})).error);
  assert.ifError((await admin.from('free_saved_products').insert({user_id:aid,request_id:randomUUID(),name:'Legacy cream',source:'user_reported',state:'using'})).error);
  const legacy=(await good(a,{operation:'get_context'})).legacy;assert.equal(legacy.profile.combinedReproductiveStatus,'yes');assert.equal(legacy.profile.primaryGoal,undefined);assert.deepEqual(legacy.products[0].frequency,{kind:'unknown'});assert.equal(legacy.products[0].formulaVersionId,null);
  const assessmentArgs={p_user_id:aid,p_request_id:randomUUID(),p_input:{productId:pid,expectedContextRevision:55},p_packet:{fixture:true},p_profile_revision_id:current.profile.id,p_routine_revision_id:current.routine.id,p_history_revision_id:current.historyRevision,p_truth_projection_ref:'local-test-fixture',p_schema_version:'fixture-v1',p_engine_version:'fixture-v1',p_policy_version:'fixture-v1'};
  const assessment=await admin.rpc('persist_personal_decision_assessment',assessmentArgs);assert.ifError(assessment.error);
  const replay=await admin.rpc('persist_personal_decision_assessment',assessmentArgs);assert.ifError(replay.error);assert.equal(replay.data.assessmentId,assessment.data.assessmentId);assert.equal(replay.data.replayed,true);
  assert.equal((await admin.rpc('persist_personal_decision_assessment',{...assessmentArgs,p_user_id:bid,p_request_id:randomUUID(),p_input:{productId:pid,expectedContextRevision:0}})).error?.message,'ASSESSMENT_CONTEXT_OWNER_MISMATCH');
  await good(a,{operation:'save_routine',requestId:randomUUID(),baseRevision:55,routine:{completeness:'complete',items:[]}});
  assert.equal((await admin.rpc('persist_personal_decision_assessment',{...assessmentArgs,p_request_id:randomUUID()})).error?.message,'STALE_CONTEXT');
  const afterEditReplay=await admin.rpc('persist_personal_decision_assessment',assessmentArgs);assert.ifError(afterEditReplay.error);assert.equal(afterEditReplay.data.assessmentId,assessment.data.assessmentId);assert.equal(afterEditReplay.data.replayed,true);
  assert.ifError((await admin.auth.admin.deleteUser(aid)).error);aid=null;
  for(const table of ['personal_context_heads','personal_context_revisions','personal_decision_assessments']) {const q=await admin.from(table).select('*');assert.ifError(q.error);assert.equal(q.data.some(v=>v.user_id===sa.data.user.id),false);}
  console.log('P0-B local context smoke passed: owner isolation/deletion, replay/races/stale writes, immutable corrections, exact historical formula, legacy unknowns, assessment provenance');
} finally {
  if(aid) await admin.auth.admin.deleteUser(aid);if(bid) await admin.auth.admin.deleteUser(bid);
  if(newFid) await admin.from('product_formula_versions').delete().eq('id',newFid);if(fid) await admin.from('product_formula_versions').delete().eq('id',fid);if(vid) await admin.from('product_variants').delete().eq('id',vid);if(pid) await admin.from('products').delete().eq('id',pid);
}
