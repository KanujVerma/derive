import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {personalContextV2Schema} from '../src/contracts/PersonalContextV2Schema.ts';
import {RoutineFormulaEvidenceSchema} from '../src/contracts/RoutineFormula.ts';
import {PersonalResultV2Schema} from '../src/contracts/PersonalResultV2.ts';
import {planRoutineFormulaRequests,admitRoutineFormulaEvidence} from '../src/domain/part-four/routineFormula.ts';
import {canonicalJson,sha256} from '../src/domain/part-two/hash.ts';
const literal=value=>"'"+String(value).replaceAll("'","''")+"'";
/** Uses only the caller's dedicated 60721 synthetic stack. The catalog row is
 * explicitly linked to an independently admitted original public declaration;
 * barcode identity and catalog ingredient arrays do not authorize its formula.
 * The caller owns owner/catalog cleanup. Receipts expose counts and states only.
 */
export async function seedRoutineFormulaFixture({admin,sql,owner,fixtureProduct,normalize,edge,p3,baseSetup,candidateRequest,now,expiry}){
 const origin=new URL(admin.supabaseUrl??process.env.SUPABASE_URL??'');
 assert.equal(origin.origin,'http://127.0.0.1:60721','Dedicated synthetic Part Four stack required');
 let checks=0;const check=(actual,expected,message)=>{assert.deepEqual(actual,expected,message);checks++;};
 const product=await fixtureProduct({catalog:true,label:true,ingredientText:'Water, Glycerin',name:`Original synthetic routine lotion ${randomUUID().slice(0,8)}`});
 const normalized=await normalize(product.scan);check(normalized.state,'ready','Actual routine normalization is ready');
 assert.equal(normalized.output.kind,'bound');const facts=normalized.output.productFacts,binding=facts.binding;assert.equal(binding.kind,'declaration');
 check(facts.scope,'public','Routine fixture uses independently published original public input');
 check(binding.itemId,product.variantId,'Original admitted P1 item exactly matches the explicitly created catalog variant');
 const formulaId=randomUUID(),associationId=randomUUID(),routineItemId=randomUUID();
 const promoted=await admin.from('products').update({is_catalog_standard:true}).eq('id',product.catalogProductId);if(promoted.error)throw Error(`Synthetic routine catalog update ${promoted.error.code}`);
 const source='https://fixture.invalid/original-routine-formula';
 const seeded=await admin.from('product_formula_versions').insert({id:formulaId,variant_id:product.variantId,ingredients:['Water','Glycerin'],normalized_ingredient_fingerprint:sha256(canonicalJson(['Water','Glycerin'])),region_code:'US',provenance_type:'founder_review',source_reference:source,catalog_public_source_url:source,observed_at:now,verification_status:'verified'});
 if(seeded.error)throw Error(`Synthetic exact routine formula insert ${seeded.error.code}`);
 const prior=await edge('personal-context','',{operation:'read_context_v2'});
 const reference={kind:'catalog',productId:product.catalogProductId,variantId:product.variantId,formulaVersionId:formulaId};
 const originalItem=baseSetup.routine.items[0];assert(originalItem,'Base fixture needs one reported current use');
 const item={...structuredClone(originalItem),id:routineItemId,reference,state:'current'};
 const setup={...structuredClone(baseSetup),routine:{completeness:'partial',items:[item]},notes:baseSetup.notes.filter(note=>note.scope==='profile'),setupAnswers:{...baseSetup.setupAnswers,currentProducts:'reported'}};
 const written=await edge('personal-context','',{operation:'save_setup',requestId:randomUUID(),baseContextRevision:prior.revision,setup});
 check(written.contextRevision,prior.revision+1,'Exact routine reference is saved through the validated current-revision Edge path');
 const context=personalContextV2Schema.parse(await edge('personal-context','',{operation:'read_context_v2'}));
 const requests=planRoutineFormulaRequests(context).requests;check(requests.length,1,'One exact active routine formula request');
 const snapshotId=await sql(`select id from private.part_two_snapshots where owner_id=${literal(owner)}::uuid and binding_key=${literal(normalized.bindingKey)} and result_revision=${normalized.resultRevision};`);
 assert(/^[a-f0-9-]{36}$/i.test(snapshotId),'Exact stored P2 snapshot row is required');
 await sql(`update private.part_four_routine_authority set evaluate_allowed=true,display_allowed=true,store_allowed=true,revoked=false,expires_at=${literal(expiry)}::timestamptz,permission_evidence='Original dedicated local synthetic routine fixture only' where singleton;
 insert into private.part_four_routine_formula_associations(id,owner_id,product_id,variant_id,formula_version_id,part_one_item_id,part_one_snapshot_id,declaration_id,declaration_revision,part_two_snapshot_id,permitted,expires_at,permission_evidence)
 values(${literal(associationId)}::uuid,${literal(owner)}::uuid,${literal(reference.productId)}::uuid,${literal(reference.variantId)}::uuid,${literal(formulaId)}::uuid,${literal(binding.itemId)}::uuid,${literal(binding.snapshotId)}::uuid,${literal(binding.declarationId)}::uuid,${binding.declarationRevision},${literal(snapshotId)}::uuid,true,${literal(expiry)}::timestamptz,'Explicit original synthetic catalog formula to admitted P1 and stored P2 association');`);
 const sourceRefs=facts.dependencyManifest.sourceRefs;assert(sourceRefs.length);
 for(const ref of sourceRefs)await sql(`insert into private.part_four_routine_source_grants(association_id,observation_id,source_revision,policy_id,policy_version,evaluate_allowed,display_allowed,store_allowed,expires_at,permission_evidence)
 values(${literal(associationId)}::uuid,${literal(ref.observationId)}::uuid,${ref.sourceRevision},${literal(ref.policyId)},${literal(ref.policyVersion)},true,true,true,${literal(ref.expiresAt)}::timestamptz,'Independent original local routine source grant; no acquisition or external permission');`);
 const call=await admin.rpc('part_four_routine_formula_worker',{p_owner:owner,p_requests:requests});
 if(call.error)throw Error(`Actual routine formula worker failed ${call.error.code}`);
 const readyEvidence=call.data.map(e=>RoutineFormulaEvidenceSchema.parse(e));check(readyEvidence.map(e=>e.state),['ready'],'Actual SQL worker independently authorizes exact routine formula');
 // This host-side fixture and the isolated database have independent clocks.
 // The envelope is directly returned by the trusted SQL worker. Use its fresh
 // check time when the host lags by milliseconds; production pure admission
 // retains its strict future-timestamp rejection without a tolerance window.
 const admissionNow=new Date(Math.max(Date.now(),...readyEvidence.map(e=>Date.parse(e.authorization.checkedAt)))).toISOString();
 const admitted=admitRoutineFormulaEvidence(context,readyEvidence,{now:admissionNow});
 if(!admitted.qualified.length)console.error(JSON.stringify({stage:'routine-admission-diagnosis',states:admitted.items.map(item=>({state:item.state,reasons:item.reasonCodes})),clockDeltaMs:Date.parse(readyEvidence[0].authorization.checkedAt)-Date.parse(admissionNow)}));
 check(admitted.qualified.length,1,'Actual SQL envelope passes strict pure routine admission');
 const updatedRequest={...candidateRequest,requestId:randomUUID(),encounterId:randomUUID(),generation:1,comparatorId:null,candidateRoutineItemId:null,savedAssessmentId:null};
 const evaluated=await p3(updatedRequest);check(evaluated.kind,'result','Canonical P4 runtime publishes with exact routine formula');
 const result=PersonalResultV2Schema.parse(evaluated.result),coPresence=result.partFour.insights.filter(i=>i.ruleId==='F07'&&i.state==='supported');
 check(coPresence.length>=1,true,'Real injected routine snapshot supports exact declared ingredient co-presence');
 check(coPresence.every(i=>i.action===null&&/Session overlap is unknown/.test(i.explanation)&&/does not establish total dose, irritation or an interaction/.test(i.explanation)),true,'Unknown timing/amount limit dependent conclusions, not exact co-presence');
 check(result.partFour.routineEvidence.map(e=>e.state),['ready'],'Canonical packet retains only trusted worker envelopes');
 const saveRequest={operation:'save',requestId:randomUUID(),resultId:result.resultId,expectedResultRevision:result.resultRevision,expectedBindingHash:sha256(canonicalJson(result.binding)),expectedPacketHash:sha256(canonicalJson(result))};
 const saved=await p3(saveRequest);check(saved.kind,'saved','Routine evidence survives canonical exact-packet Save');
 const historical=await p3({operation:'read_saved',savedAssessmentId:saved.savedAssessmentId});check(historical.kind,'historical','Routine evidence reopens through authoritative saved projection');
 check(historical.assessmentWhenSaved.partFour.routineEvidence.map(e=>e.state),['ready'],'Saved routine evidence reauthorizes its pinned source basis');
 const worker=`public.part_four_routine_formula_worker(${literal(owner)}::uuid,${literal(JSON.stringify(requests))}::jsonb)`;
 // Bounded authority negative controls mutate only this synthetic association
 // within rollback transactions. No protected formula bytes are printed.
 const missing=await sql(`begin;delete from private.part_four_routine_formula_associations where id=${literal(associationId)}::uuid;select (${worker}->0->>'state');rollback;`);check(missing,'missing','Missing explicit association returns no guessed formula');
 const denied=await sql(`begin;update private.part_four_routine_source_grants set display_allowed=false where association_id=${literal(associationId)}::uuid;select (${worker}->0->>'state');rollback;`);check(denied,'denied','Denied retained source grant contributes no formula');
 const expired=await sql(`begin;update private.part_four_routine_source_grants set expires_at=clock_timestamp()+interval '300 milliseconds' where association_id=${literal(associationId)}::uuid;select pg_sleep(0.5);select (${worker}->0->>'state');rollback;`);check(expired,'stale','Routine source grant expiry uses wall clock even inside one long transaction');
 const conflict=await sql(`begin;insert into private.part_four_routine_formula_associations(owner_id,product_id,variant_id,formula_version_id,part_one_item_id,part_one_snapshot_id,declaration_id,declaration_revision,part_two_snapshot_id,permitted,expires_at,permission_evidence) select owner_id,product_id,variant_id,formula_version_id,part_one_item_id,part_one_snapshot_id,declaration_id,declaration_revision,part_two_snapshot_id,permitted,expires_at,permission_evidence from private.part_four_routine_formula_associations where id=${literal(associationId)}::uuid;select (${worker}->0->>'state');rollback;`);check(conflict,'conflict','Competing exact associations cannot win by ordering');
 // Exercise real P2 label withdrawal -> snapshot projection/deletion -> registry
 // cascade -> saved maintenance. It must not recursively rewrite a saved tuple.
 const sourcePolicy=sourceRefs[0].policyId;
 check(result.partFour.formula.sourceRefs.some(ref=>ref.policyId===sourcePolicy),true,'Candidate and routine use the shared original P1 policy for withdrawal controls');
 const policyExpiry=JSON.parse(await sql(`begin;set local statement_timeout='12s';update private.part_one_policies set expires_at=clock_timestamp()-interval '1 millisecond' where id=${literal(sourcePolicy)};
 select jsonb_build_object('currentRetired',not exists(select 1 from public.part_three_results where id=${literal(result.resultId)}::uuid and payload is not null),'savedRetired',not exists(select 1 from public.part_three_saved_assessments where id=${literal(saved.savedAssessmentId)}::uuid and packet is not null));rollback;`));
 check(policyExpiry.currentRetired,true,'Policy expiry alone physically retires copied current candidate bytes');
 check(policyExpiry.savedRetired,true,'Policy expiry alone physically retires copied saved candidate bytes');
 const p2ReleaseId=await sql(`select release_id from private.part_two_snapshots where id=${literal(snapshotId)}::uuid;`);assert(p2ReleaseId,'Original routine P2 release is required');
 const p2Withdrawal=JSON.parse(await sql(`begin;set local statement_timeout='12s';update private.part_two_releases set permitted=false where id=${literal(p2ReleaseId)};
 select jsonb_build_object('savedRetired',not exists(select 1 from public.part_three_saved_assessments where id=${literal(saved.savedAssessmentId)}::uuid and packet is not null),'noReadyRoutineBytes',not exists(select 1 from public.part_three_saved_assessments s cross join lateral jsonb_array_elements(coalesce(s.packet->'partFour'->'routineEvidence','[]')) e where s.id=${literal(saved.savedAssessmentId)}::uuid and e->>'state'='ready'));rollback;`));
 check(p2Withdrawal.savedRetired,true,'Direct P2 release denial physically retires copied saved candidate bytes');
 check(p2Withdrawal.noReadyRoutineBytes,true,'Direct P2 release denial leaves no ready copied routine bytes');
 const projection=await sql(`begin;set local statement_timeout='12s';update private.part_one_policies set label_assertion_kinds='{}'::text[] where id=${literal(sourcePolicy)};
 select jsonb_build_object('associationRemoved',not exists(select 1 from private.part_four_routine_formula_associations where id=${literal(associationId)}::uuid),'savedFormulaCleared',not exists(select 1 from public.part_three_saved_assessments s cross join lateral jsonb_array_elements(coalesce(s.packet->'partFour'->'routineEvidence','[]')) e where s.id=${literal(saved.savedAssessmentId)}::uuid and e->>'state'='ready'),'workerState',${worker}->0->>'state');rollback;`);
 const probe=JSON.parse(projection);check(probe.associationRemoved,true,'Actual P2 label recall removes the obsolete exact association');check(probe.savedFormulaCleared,true,'Cascade projects saved routine evidence without nested tuple mutation');check(probe.workerState,'missing','Recalled association never follows a new P2 projection automatically');
 const lockFixture={ownerId:owner,sourceObservationId:product.observationId,savedAssessmentId:saved.savedAssessmentId,resultId:result.resultId,requests};
 console.log(JSON.stringify({suite:'part-four-routine-formula-fixture',checks,synthetic:true,actualAuthEdgeSQL:true,providersCalled:false,status:'passed'}));
 return {context,updatedRequest,readyEvidence,lockFixture,result,savedAssessmentId:saved.savedAssessmentId,product,formulaId,associationId,checks};
}
