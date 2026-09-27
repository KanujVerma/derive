import { parseProductTruthSnapshot } from '../../../src/contracts/productTruthValidation.ts';
import { resolveCatalogFormula } from '../catalog-products/catalog.ts';
import type { DecisionDependencies, SavedAssessment } from './handler.ts';
import { DecisionServiceError } from './handler.ts';
import { fixtureSnapshot, FIXTURE_SNAPSHOT } from './fixtures.ts';
import type { TrustedSnapshotEnvelope } from '../../../src/presentation/personal-decision/truthAdapter.ts';
import type { TrustedRoutineFact } from '../../../src/presentation/personal-decision/contextAdapter.ts';
import type { PersonalContextSnapshot } from '../../../src/contracts/PersonalContext.ts';
/** Structural server client; never exposed to the application. */
type Admin = { rpc:(name:string,args:Record<string,unknown>)=>PromiseLike<{data:any;error:any}>;from:(table:string)=>any };
export function localFixtureAllowed(enabled:string|undefined,url:string):boolean {return enabled==='1'&&['http://kong:8000','http://127.0.0.1:54321','http://localhost:54321'].includes(url);}
async function assertionRevision(value:Record<string,unknown>):Promise<string>{const bytes=new TextEncoder().encode(JSON.stringify(value));return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');}
function checked(result:{data:any;error:any}):any {if(result.error){const code=result.error.message;if(['STALE_CONTEXT','IDEMPOTENCY_CONFLICT'].includes(code))throw new DecisionServiceError(code,409);throw new DecisionServiceError('DECISION_UNAVAILABLE',503);}return result.data;}
export function decisionDependencies(admin:Admin,options:{localFixture:boolean;readSnapshot?:(ownerId:string,request:any)=>Promise<TrustedSnapshotEnvelope|null>}):DecisionDependencies {
 return {runtime:options.localFixture?'local_fixture':'authoritative',now:()=>new Date().toISOString(),
 verifyCaseOwner:async(owner,caseId)=>!!checked(await admin.from('product_resolution_cases').select('id').eq('id',caseId).eq('user_id',owner).eq('consumer','scan').maybeSingle()),
 readSnapshot:options.readSnapshot??(async(owner,request)=>{
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  // Current P0-A storage keys are UUIDs; the transport/provider seam stays opaque.
  const row=uuid.test(request.snapshotId)?checked(await admin.from('product_truth_snapshots').select('id,user_id,case_id,case_revision,snapshot').eq('id',request.snapshotId).eq('user_id',owner).eq('case_id',request.caseId).maybeSingle()):null;
  if(row){
   let snapshot;try{snapshot=parseProductTruthSnapshot(row.snapshot);}catch{throw new DecisionServiceError('TRUTH_SNAPSHOT_UNAVAILABLE',503);}
   if(row.id!==snapshot.snapshotId||row.case_id!==snapshot.resolutionCaseId||row.case_revision!==snapshot.caseRevision)throw new DecisionServiceError('TRUTH_SNAPSHOT_UNAVAILABLE',503);
   const result:TrustedSnapshotEnvelope={snapshot,runtime:'authoritative'};
   if(snapshot.product&&snapshot.catalogReferences.productId===snapshot.product.productId){
    const product=checked(await admin.from('products').select('id,category,is_catalog_standard,catalog_verified_at,catalog_source_reference').eq('id',snapshot.product.productId).maybeSingle());
    if(product?.is_catalog_standard&&product.catalog_verified_at&&product.catalog_source_reference){
     const id=`category:${product.id}`;const revision=await assertionRevision({productId:product.id,category:product.category,verifiedAt:product.catalog_verified_at,sourceReference:product.catalog_source_reference});result.category={state:'known',value:product.category,sourceIds:[id]};result.categorySources=[{id,revision}];result.categoryBoundaryRevision=`catalog:${product.id}:${revision}`;result.categoryProvenance={productId:product.id,category:product.category,source_reference:product.catalog_source_reference,catalog_verified_at:product.catalog_verified_at};
    }
   }return result;
  }
  if(!options.localFixture||request.snapshotId!==FIXTURE_SNAPSHOT)return null;
  const owned=checked(await admin.from('product_resolution_cases').select('id,product_id,variant_id,formula_version_id').eq('id',request.caseId).eq('user_id',owner).eq('consumer','scan').maybeSingle());
  const fixture=fixtureSnapshot(request.caseId);
  if(!owned||owned.product_id!==fixture.catalogReferences.productId||owned.variant_id!==fixture.catalogReferences.variantId||owned.formula_version_id!==fixture.catalogReferences.formulaVersionId)return null;
  return {snapshot:fixture,runtime:'local_fixture',category:{state:'known',value:'moisturizer',sourceIds:['local-fixture:category']},categorySources:[{id:'local-fixture:category',revision:'1'}],categoryBoundaryRevision:'fixture-category/v1'};
 }),
 readContext:async owner=>checked(await admin.rpc('read_personal_context',{p_user_id:owner})),
 readHistory:async(owner,revision,productId,cursor)=>checked(await admin.rpc('read_personal_experience_history',{p_user_id:owner,p_at_revision:revision,p_limit:50,p_cursor:cursor,p_product_id:productId})),
 readRoutineFacts:async(context:PersonalContextSnapshot)=>{
  const facts:TrustedRoutineFact[]=[];
  for(const item of context.routine?.data.items??[]){const ref=item.reference;if((item.state!=='current'&&item.state!=='occasional')||ref.kind!=='catalog')continue;
   const product=checked(await admin.from('products').select('id,category,is_catalog_standard,catalog_verified_at,catalog_source_reference,catalog_observed_at').eq('id',ref.productId).maybeSingle());
   if(!product?.is_catalog_standard||!product.catalog_verified_at||!product.catalog_source_reference)continue;
   const sourceId=`routine:category:${ref.productId}`;const categoryRevision=await assertionRevision({productId:product.id,category:product.category,verifiedAt:product.catalog_verified_at,sourceReference:product.catalog_source_reference});const row:TrustedRoutineFact={itemId:item.id,productId:ref.productId,variantId:ref.variantId,formulaVersionId:ref.formulaVersionId,category:{state:'known',value:product.category,sourceIds:[sourceId]},ingredients:{state:'unknown',reason:'Exact routine formula unavailable'},sources:[{id:sourceId,revision:categoryRevision}],provenance:[{scope:'category',productId:product.id,source_reference:product.catalog_source_reference,observed_at:product.catalog_verified_at}]};
   if(ref.variantId&&ref.formulaVersionId){const variant=checked(await admin.from('product_variants').select('id,product_id,catalog_verification_status,lifecycle_status').eq('id',ref.variantId).eq('product_id',ref.productId).maybeSingle());
    const formula=checked(await admin.from('product_formula_versions').select('id,variant_id,verification_status,ingredients,observed_at,source_reference,provenance_type').eq('id',ref.formulaVersionId).eq('variant_id',ref.variantId).maybeSingle());
    const identifiers=checked(await admin.from('product_identifiers').select('variant_id,formula_version_id,source_authority,verified_at').eq('variant_id',ref.variantId).eq('formula_version_id',ref.formulaVersionId).not('verified_at','is',null));
    const accepted=variant?.catalog_verification_status==='verified'&&variant.lifecycle_status==='active'&&formula?resolveCatalogFormula(ref.variantId,[formula],identifiers??[]):{state:'unverified'};
    if(accepted.state==='verified'&&formula){const fid=`routine:formula:${formula.id}`;row.ingredients={state:'known',value:formula.ingredients,sourceIds:[fid]};row.sources.push({id:fid,revision:formula.observed_at});row.provenance!.push({scope:'formula',productId:product.id,formulaVersionId:formula.id,source_reference:formula.source_reference,observed_at:formula.observed_at,provenance_type:formula.provenance_type});}
   }facts.push(row);
  }return facts;
 },
 readAssessment:async(owner,requestId)=>{const value=checked(await admin.from('personal_decision_assessments').select('id,input,packet').eq('user_id',owner).eq('request_id',requestId).maybeSingle());return value?{assessmentId:value.id,input:value.input,packet:value.packet} as SavedAssessment:null;},
 persist:async(owner,requestId,input,packet)=>checked(await admin.rpc('persist_personal_decision_assessment',{p_user_id:owner,p_request_id:requestId,p_input:input,p_packet:packet,p_profile_revision_id:input.expectedBinding.profileRevision,p_routine_revision_id:input.expectedBinding.routineRevision,p_history_revision_id:input.expectedBinding.historyRevision,p_truth_projection_ref:`${packet.binding.productSnapshotId}:${packet.binding.productSnapshotRevision}`,p_schema_version:packet.schemaVersion,p_engine_version:packet.versions.engine,p_policy_version:packet.versions.policy}))};
}
