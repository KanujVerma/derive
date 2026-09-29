/** Local-only actual HTTP scanner ingredient lookup at >12k formula scale. */
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createClient} from '@supabase/supabase-js';
const status=JSON.parse(execFileSync('supabase',['status','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
assert.equal(status.API_URL,'http://127.0.0.1:54321','Refuse hosted target');
const make=key=>createClient(status.API_URL,key,{auth:{persistSession:false,autoRefreshToken:false}});
const admin=make(status.SERVICE_ROLE_KEY),guest=make(status.ANON_KEY),other=make(status.ANON_KEY),owner=make(status.ANON_KEY);
const run=randomUUID(),reference=`internal://indexed-ingredient-smoke/${run}`,publicUrl='https://example.org/synthetic-ingredient-smoke';
const prefix=`Synthetic-${run}`,now=new Date().toISOString();
let guestId,otherId,ownerId,productId,variantId;
const invoke=async(client,body)=>client.functions.invoke('resolve-product-identity',{body:{requestId:randomUUID(),consumer:'scan',...body}});
const detached=async(ingredients,extra={})=>{
 const result=await admin.from('product_formula_versions').insert({ingredients,normalized_ingredient_fingerprint:'wrong-legacy-key',provenance_type:'manufacturer',
  source_reference:reference,catalog_public_source_url:publicUrl,observed_at:now,verification_status:'verified',...extra}).select('id').single();
 assert.ifError(result.error);return result.data.id;
};
try {
 for(const [client,set]of[[guest,id=>guestId=id],[other,id=>otherId=id]]){const result=await client.auth.signInAnonymously();assert.ifError(result.error);set(result.data.user.id);}
 const password=`Synthetic-${randomUUID()}!`,email=`indexed-${run}@example.test`;
 const account=await admin.auth.admin.createUser({email,password,email_confirm:true});assert.ifError(account.error);ownerId=account.data.user.id;
 assert.ifError((await owner.auth.signInWithPassword({email,password})).error);
 assert.ifError((await admin.from('memberships').insert({user_id:ownerId,tier:'founding_beta',status:'active'})).error);
 // A full-catalog reader would exceed its old 10k ceiling. Generated labels are
 // synthetic and deliberately have the same incorrect legacy fingerprint.
 const sql=`insert into public.product_formula_versions(ingredients,normalized_ingredient_fingerprint,provenance_type,source_reference,catalog_public_source_url,observed_at,verification_status)
 select array['${prefix}','Unique '||n],'wrong-legacy-key','manufacturer','${reference}','${publicUrl}',now(),'verified' from generate_series(1,12001) n;`;
 execFileSync('docker',['exec','supabase_db_derive','psql','-U','postgres','-v','ON_ERROR_STOP=1','-qc',sql],{stdio:['ignore','pipe','pipe']});
 const target={ingredientList:[prefix.toUpperCase(),' unique 12001 ']};
 const exact=await invoke(guest,target);assert.ifError(exact.error);assert.equal(exact.data.state,'formula_only');
 assert.equal(exact.data.truthSnapshot.formula.appliesToSelectedVariant,false);
 assert.equal(exact.data.truthSnapshot.formula.publicSourceUrl,publicUrl);
 assert.equal(exact.data.product,undefined);assert.doesNotMatch(JSON.stringify(exact.data),/internal:\/\//);
 for(const ingredientList of [['Unique 12001',prefix],[prefix,'Unique 12001.'],[prefix,'Unique 12001','Unique 12001']]) {
  const miss=await invoke(guest,{ingredientList});assert.ifError(miss.error);assert.equal(miss.data.state,'insufficient_evidence');
 }
 const repeatId=randomUUID(),repeatBody={requestId:repeatId,consumer:'scan',ingredientList:target.ingredientList};
 const first=await guest.functions.invoke('resolve-product-identity',{body:repeatBody});assert.ifError(first.error);
 const replay=await guest.functions.invoke('resolve-product-identity',{body:repeatBody});assert.ifError(replay.error);assert.deepEqual(replay.data.truthSnapshot,first.data.truthSnapshot);
 await detached([prefix,'Unique 12001']);
 const ambiguous=await invoke(guest,target);assert.ifError(ambiguous.error);assert.equal(ambiguous.data.state,'ambiguous_candidates');
 assert.equal(ambiguous.data.candidates.length,2);
 // Keep both immutable candidate formulas until final owner/case cleanup.
 const marketIngredients=[prefix,'Market'];await detached(marketIngredients,{region_code:'CA'});
 const mismatch=await invoke(guest,{ingredientList:marketIngredients,regionCode:'US'});assert.ifError(mismatch.error);
 assert.equal(mismatch.data.state,'insufficient_evidence');assert.equal(mismatch.data.truthSnapshot.conflicts[0].code,'region_mismatch');
 const privateIngredients=[prefix,'Private'];
 const product=await admin.from('products').insert({brand:'Synthetic',name:`Private ${run}`,category:'cleanser',is_catalog_standard:false}).select('id').single();
 assert.ifError(product.error);productId=product.data.id;
 const variant=await admin.from('product_variants').insert({product_id:productId,variant_name:'Private US',region_code:'US'}).select('id').single();
 assert.ifError(variant.error);variantId=variant.data.id;
 await detached(privateIngredients,{variant_id:variantId,catalog_public_source_url:null,provenance_type:'founder_review'});
 assert.ifError((await admin.from('user_products').insert({user_id:ownerId,product_id:productId,action:'KEEP'})).error);
 const hidden=await invoke(other,{ingredientList:privateIngredients});assert.ifError(hidden.error);assert.equal(hidden.data.state,'insufficient_evidence');
 const visible=await invoke(owner,{ingredientList:privateIngredients});assert.ifError(visible.error);assert.equal(visible.data.state,'formula_only');
 // Verify the union retains identifier contradiction rather than promoting the
 // ingredient match as a different verified product.
 assert.ifError((await admin.from('products').update({is_catalog_standard:true,catalog_source_reference:reference,catalog_public_source_url:publicUrl,catalog_observed_at:now,catalog_verified_at:now}).eq('id',productId)).error);
 assert.ifError((await admin.from('product_variants').update({catalog_verification_status:'verified',catalog_source_reference:reference,catalog_public_source_url:publicUrl,catalog_observed_at:now}).eq('id',variantId)).error);
 const barcodeFormula=await detached([prefix,'Barcode'],{variant_id:variantId,region_code:'US'});
 assert.ifError((await admin.from('product_identifiers').insert({variant_id:variantId,formula_version_id:barcodeFormula,identifier_type:'gtin_12',identifier_value:'012345678905',source_authority:'manufacturer',source_reference:reference,verified_at:now})).error);
 const conflict=await invoke(guest,{barcode:'012345678905',ingredientList:target.ingredientList});assert.ifError(conflict.error);
 assert.equal(conflict.data.state,'identified_formula_unverified');assert.equal(conflict.data.truthSnapshot.formula,null);
 assert.equal(conflict.data.truthSnapshot.conflicts[0].code,'ingredient_mismatch');assert.equal(conflict.data.product.productId,productId);
 const overflowIngredients=[prefix,'Overflow'];
 const formulas=Array.from({length:102},()=>({ingredients:overflowIngredients,normalized_ingredient_fingerprint:'wrong',provenance_type:'manufacturer',source_reference:reference,catalog_public_source_url:publicUrl,observed_at:now,verification_status:'verified'}));
 assert.ifError((await admin.from('product_formula_versions').insert(formulas)).error);
 const overflow=await invoke(guest,{ingredientList:overflowIngredients});assert.equal(overflow.error?.context?.status,503);
 assert.equal((await overflow.error.context.json()).code,'CATALOG_TOO_LARGE');
 console.log('PASS: actual Edge ingredient-only >12001 formulas; punctuation/order/duplicates; replay; ambiguity; market mismatch; private ownership; barcode contradiction; 101 overflow.');
} finally {
 for(const userId of[guestId,otherId,ownerId])if(userId)await admin.auth.admin.deleteUser(userId);
 if(variantId)await admin.from('product_identifiers').delete().eq('variant_id',variantId);
 await admin.from('product_formula_versions').delete().eq('source_reference',reference);
 if(variantId)await admin.from('product_variants').delete().eq('id',variantId);
 if(productId)await admin.from('products').delete().eq('id',productId);
}
