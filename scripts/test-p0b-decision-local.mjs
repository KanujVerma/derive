/** Explicit server-fixture acceptance against disposable local Auth/context/persistence. Never resets/serves the shared stack. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
const status=JSON.parse(execFileSync(process.env.SUPABASE_CLI??'supabase',['status','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
assert.equal(status.API_URL,'http://127.0.0.1:54321','Refuse non-local Supabase');
const make=key=>createClient(status.API_URL,key,{auth:{autoRefreshToken:false,persistSession:false}});
const admin=make(status.SERVICE_ROLE_KEY),a=make(status.ANON_KEY),b=make(status.ANON_KEY);
let CASE='11111111-1111-4111-8111-111111111111';const SNAPSHOT='22222222-2222-4222-8222-222222222222';
const PRODUCT='33333333-3333-4333-8333-333333333333',VARIANT='44444444-4444-4444-8444-444444444444',FORMULA='55555555-5555-4555-8555-555555555555';
const call=async(client,name,body)=>{const {data,error}=await client.functions.invoke(name,{body});let code=null;if(error?.context)try{code=(await error.context.clone().json()).code;}catch{}return {data,error,status:error?.context?.status??200,code};};
const good=async(client,name,body)=>{const r=await call(client,name,body);assert.equal(r.status,200,`${name} ${body.operation??'request'}: ${r.code}`);return r.data;};
const get=()=>good(a,'personal-context',{operation:'get_context'});
let aid,bid,seededProduct=false,seededVariant=false,seededFormula=false,identifierId=null;
try{
 const sa=await a.auth.signInAnonymously(),sb=await b.auth.signInAnonymously();assert.ifError(sa.error);assert.ifError(sb.error);aid=sa.data.user.id;bid=sb.data.user.id;
 const request={operation:'evaluate',requestId:randomUUID(),caseId:CASE,snapshotId:SNAPSHOT};
 assert.equal((await call(make(status.ANON_KEY),'personal-decision',request)).status,401);
 assert.equal((await call(a,'personal-decision',{...request,ownerId:bid})).code,'INVALID_PAYLOAD');

 const now=new Date().toISOString();
 assert.ifError((await admin.from('products').insert({id:PRODUCT,brand:'Explicit local fixture',name:'P0-B fixture moisturizer',category:'moisturizer',is_catalog_standard:true,catalog_source_reference:'https://fixture.invalid/p0b',catalog_public_source_url:'https://fixture.invalid/p0b',catalog_observed_at:now,catalog_verified_at:now})).error);seededProduct=true;
 assert.ifError((await admin.from('product_variants').insert({id:VARIANT,product_id:PRODUCT,variant_name:'Fixture package',catalog_verification_status:'verified',catalog_source_reference:'https://fixture.invalid/p0b',catalog_public_source_url:'https://fixture.invalid/p0b',catalog_observed_at:now})).error);seededVariant=true;
 assert.ifError((await admin.from('product_formula_versions').insert({id:FORMULA,variant_id:VARIANT,ingredients:['Water','Glycerin'],normalized_ingredient_fingerprint:'water|glycerin',provenance_type:'founder_review',source_reference:'https://fixture.invalid/p0b',catalog_public_source_url:'https://fixture.invalid/p0b',observed_at:now,verification_status:'verified'})).error);seededFormula=true;
 const identifier=await admin.from('product_identifiers').insert({variant_id:VARIANT,formula_version_id:FORMULA,identifier_type:'gtin_12',identifier_value:'012345678905',source_authority:'founder',source_reference:'https://fixture.invalid/p0b',observed_at:now,verified_at:now}).select('id').single();assert.ifError(identifier.error);identifierId=identifier.data.id;
 const resolved=await good(a,'resolve-product-identity',{requestId:randomUUID(),consumer:'scan',barcode:'012345678905'});assert.equal(resolved.product.productId,PRODUCT);assert.equal(resolved.state,'verified_product_formula');assert.equal(resolved.product.variantId,VARIANT);assert.equal(resolved.formula.formulaVersionId,FORMULA);CASE=resolved.caseId;request.caseId=CASE;
 const unavailable=await call(a,'personal-decision',{...request,snapshotId:'opaque:unregistered-fixture'});assert.equal(unavailable.code,'TRUTH_SNAPSHOT_UNAVAILABLE');
 const factual=await good(a,'personal-decision',request);assert.equal(factual.runtime,'local_fixture','Enable P0B_LOCAL_FIXTURES only in the exact-local function process');assert.equal(factual.packet.action.kind,'NOT_ENOUGH_INFORMATION');assert.equal(factual.ownerId,aid);
 const profile={intent:'add',primaryGoal:'dryness',secondaryGoals:[],skinBehavior:'dry_tight',reactivity:'generally_tolerates',reproductive:{pregnancy:'no',nursing:'no',tryingToConceive:'no'},sensitivities:{status:'none_known',values:[]},treatments:{status:'none',values:[]}};
 await good(a,'personal-context',{operation:'save_profile',requestId:randomUUID(),baseRevision:0,profile});
 await good(a,'personal-context',{operation:'save_routine',requestId:randomUUID(),baseRevision:1,routine:{completeness:'complete',items:[]}});
 const roleRequest={...request,requestId:randomUUID()};const role=await good(a,'personal-decision',roleRequest);assert.equal(role.packet.action.kind,'COULD_WORK');assert.equal(role.contextRevision,2);assert.equal(role.packet.id,roleRequest.requestId);
 const item={id:randomUUID(),reference:{kind:'catalog',productId:PRODUCT,variantId:VARIANT,formulaVersionId:FORMULA},state:'current',timing:'pm',frequency:{kind:'qualitative',value:'few_times_week'},startedOn:null,stoppedOn:null,duration:null};
 await good(a,'personal-context',{operation:'save_routine',requestId:randomUUID(),baseRevision:2,routine:{completeness:'complete',items:[item]}});
 const redundant=await good(a,'personal-decision',{...request,requestId:randomUUID()});assert.equal(redundant.packet.action.kind,'KEEP_CURRENT');assert(redundant.packet.routineImpacts.some(i=>i.kind==='duplicates_role'));assert(redundant.packet.findings.some(f=>f.evidence.some(e=>e.kind==='routine_product_fact')));
 const replay=await good(a,'personal-decision',roleRequest);assert.equal(replay.replayed,true);assert.equal(replay.contextRevision,2);assert.deepEqual(replay.packet,role.packet);
 const experience={id:randomUUID(),reference:item.reference,kind:'no_reaction_reported',occurred:{start:null,end:null},useContext:null,symptoms:[],note:null};
 const original=await good(a,'personal-context',{operation:'append_experience',requestId:randomUUID(),baseRevision:3,supersedesRevisionId:null,experience});
 const corrected=await good(a,'personal-context',{operation:'append_experience',requestId:randomUUID(),baseRevision:4,supersedesRevisionId:original.revision.id,experience:{...experience,kind:'reacted',symptoms:['Stinging']}});
 for(let n=0;n<51;n++){assert.ifError((await admin.rpc('write_personal_context',{p_user_id:aid,p_request_id:randomUUID(),p_base_revision:5+n,p_section:'experience',p_payload:{...experience,id:randomUUID(),reference:{kind:'manual',name:`Unrelated fixture ${n}`},kind:'liked'},p_supersedes_revision_id:null})).error);}
 const current=await get();assert.equal(current.historyTruncated,true);
 const reaction=await good(a,'personal-decision',{...request,requestId:randomUUID()});assert.equal(reaction.packet.action.kind,'USE_WITH_CAUTION');assert(reaction.packet.findings.some(f=>f.kind==='prior_product_reaction'&&f.evidence.some(e=>e.kind==='context_fact'&&e.recordId===corrected.revision.id)));assert.equal(reaction.contextRevision,56);
 const ownerB=await call(b,'personal-decision',{...request,requestId:randomUUID()});assert.equal(ownerB.code,'CASE_NOT_FOUND');assert.equal(ownerB.data,null);
 for(const table of ['personal_context_heads','personal_context_revisions','personal_decision_assessments'])assert.equal((await a.from(table).select('*')).error?.code,'42501');
 const stored=await admin.from('personal_decision_assessments').select('id,input,packet').eq('id',reaction.assessmentId).single();assert.ifError(stored.error);assert.equal(stored.data.input.expectedContextRevision,56);assert.equal(stored.data.input.expectedBinding.ownerId,aid);
 const stale=await admin.rpc('persist_personal_decision_assessment',{p_user_id:aid,p_request_id:randomUUID(),p_input:{...stored.data.input,expectedContextRevision:55},p_packet:stored.data.packet,p_profile_revision_id:current.profile.id,p_routine_revision_id:current.routine.id,p_history_revision_id:current.historyRevision,p_truth_projection_ref:'fixture:stale',p_schema_version:'personal-decision/v1',p_engine_version:reaction.packet.versions.engine,p_policy_version:reaction.packet.versions.policy});assert.equal(stale.error?.message,'STALE_CONTEXT');
 assert.ifError((await admin.auth.admin.deleteUser(aid)).error);aid=null;
 assert.equal((await admin.from('personal_decision_assessments').select('id').eq('user_id',sa.data.user.id)).data.length,0);
 console.log('P0-B server-fixture Edge smoke passed: JWT/strict requests, unavailable truth, role fit, sourced redundancy, immutable replay, corrected paged reaction, owner isolation, stale guard and deletion. Real P0-A reader/customer physical acceptance remain separate.');
}finally{
 if(aid)await admin.auth.admin.deleteUser(aid);if(bid)await admin.auth.admin.deleteUser(bid);
 if(identifierId)await admin.from('product_identifiers').delete().eq('id',identifierId);
 if(seededFormula)await admin.from('product_formula_versions').delete().eq('id',FORMULA);if(seededVariant)await admin.from('product_variants').delete().eq('id',VARIANT);if(seededProduct)await admin.from('products').delete().eq('id',PRODUCT);
}
