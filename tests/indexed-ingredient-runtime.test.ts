import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {exactIngredientEvidence,IngredientCandidateLookupError} from '../supabase/functions/_shared/ingredient-candidates.ts';
import {resolveProductIdentity,type CatalogResolutionRecord} from '../supabase/functions/_shared/product-identity.ts';
const source=readFileSync(new URL('../supabase/functions/resolve-product-identity/index.ts',import.meta.url),'utf8');
const id='a1930000-0000-4000-8000-000000000001';
const variant='a1920000-0000-4000-8000-000000000001';
const product='a1910000-0000-4000-8000-000000000001';
class ServiceError extends Error {code:string;constructor(code:string,message:string){super(message);this.code=code;}}
// Execute the actual private hydration function without starting its Deno HTTP
// entrypoint or importing server credentials; injected reads are deterministic.
function loader(overrides:any={}) {
  const text=source.slice(source.indexOf('async function loadIngredientCatalog('),source.indexOf('\nasync function loadCatalog('));
  const factory=new Function('lookupIngredientCandidates','IngredientCandidateLookupError','ServiceError','loadPagedCatalogRows',
    'exactIngredientEvidence','keepVisibleProducts','projectCatalogRows',stripTypeScriptTypes(text)+';return loadIngredientCatalog;');
  const reads:any={ 'ingredient formulas':[{id,variant_id:variant,region_code:'CA',ingredients:['Water'],catalog_public_source_url:'https://example.org/formula'}],
    'ingredient variants':[{id:variant,product_id:product}], 'ingredient products':[{id:product,is_catalog_standard:true}] };
  const filters:any[]=[];
  const query:any={select:()=>query,in:(column:string,ids:string[])=>{filters.push([column,ids]);return query;},
    eq:()=>query,not:()=>query,order:()=>query,range:async()=>({data:[]})};
  const admin={from:()=>query};
  const fn=factory(overrides.lookup??(async()=>[{id,variant_id:variant,region_code:'CA',ingredients:['Water']}]),IngredientCandidateLookupError,ServiceError,
    async(label:string,fetch:any)=>{await fetch(0,1000);return overrides.reads?.[label]??reads[label];},exactIngredientEvidence,
    overrides.visible??(async(_a:any,_u:any,_f:any,rows:any)=>rows),(...args:any[])=>args);
  return {run:()=>fn(admin,'a1900000-0000-4000-8000-000000000099',true,['Water']),filters};
}
test('ingredient hydration uses exact IDs and preserves all-market evidence',async()=>{
  const result=loader();const rows=await result.run();
  assert.deepEqual(result.filters,[['id',[id]],['id',[variant]],['id',[product]]]);
  assert.equal(rows[2][0].region_code,'CA');assert.deepEqual(rows[3],[]);
});
test('missing, changed or private detached hydration fails rather than reducing ambiguity',async()=>{
  for(const row of [[],[{id,variant_id:variant,region_code:'US',ingredients:['Water']}],
    [{id,variant_id:variant,region_code:'CA',ingredients:['Water.']}],
    [{id,variant_id:null,region_code:'CA',ingredients:['Water'],catalog_public_source_url:null}]]) {
    await assert.rejects(loader({reads:{'ingredient formulas':row}}).run(),(error:any)=>error.code==='CATALOG_UNAVAILABLE');
  }
  await assert.rejects(loader({reads:{'ingredient variants':[]}}).run(),(error:any)=>error.code==='CATALOG_UNAVAILABLE');
  await assert.rejects(loader({visible:async()=>[]}).run(),(error:any)=>error.code==='CATALOG_UNAVAILABLE');
});
test('lookup overflow reaches the existing service error boundary',async()=>{
  await assert.rejects(loader({lookup:async()=>{throw new IngredientCandidateLookupError('CATALOG_TOO_LARGE');}}).run(),
    (error:any)=>error.code==='CATALOG_TOO_LARGE');
});
test('runtime union routes ingredient-only evidence without weakening label contradictions',()=>{
  const selection=source.slice(source.indexOf('const needsBroadRead ='),source.indexOf('const photoText ='));
  assert.doesNotMatch(selection.slice(0,selection.indexOf('const catalog =')),/ingredientList/);
  assert.match(selection,/request\.labelText \|\| request\.packagingText/);
  assert.match(selection,/loadIngredientCatalog\(admin, userId, !managedAccess, request\.ingredientList\)/);
  assert.match(source,/\.eq\("user_id", userId\)\.in\("product_id", privateIds\.slice/);
});
test('actual owner visibility read is bounded to requested private product batches',async()=>{
  const text=source.slice(source.indexOf('async function keepVisibleProducts'),source.indexOf('\nfunction optionalString'));
  const batches:string[][]=[];let current:string[]=[];
  const query:any={select:()=>query,eq:()=>query,in:(_column:string,ids:string[])=>{current=ids;batches.push(ids);return query;},order:()=>query,range:()=>query};
  const fn=new Function('loadPagedCatalogRows','MAX_EXACT_PRODUCTS',stripTypeScriptTypes(text)+';return keepVisibleProducts;')(
    async(_label:string,fetch:any)=>{await fetch(0,1000);return current.map(product_id=>({product_id}));},100);
  const rows=Array.from({length:205},(_,i)=>({id:String(i),is_catalog_standard:false}));
  assert.deepEqual(await fn({from:()=>query},'owner',false,rows),rows);
  assert.deepEqual(batches.map(ids=>ids.length),[100,100,5]);
});
test('union does not let exact ingredients override a contradictory verified barcode formula',()=>{
  const barcode:CatalogResolutionRecord={productId:product,variantId:variant,formulaVersionId:id,brand:'Fixture',name:'Wash',variantName:'US',regionCode:'US',
    identifierType:'gtin_12',identifierValue:'012345678905',identifierAuthority:'manufacturer',identifierVerifiedAt:'2026-09-29',identifierFormulaVersionId:id,
    formulaVerificationStatus:'verified',formulaSourceReference:'https://example.org/formula',formulaObservedAt:'2026-09-29',formulaIngredients:['Water'],formulaRegionCode:'US'};
  const other:CatalogResolutionRecord={formulaVersionId:'a1930000-0000-4000-8000-000000000002',formulaVerificationStatus:'verified',formulaIngredients:['Glycerin'],formulaRegionCode:'US'};
  const decision=resolveProductIdentity({barcode:'012345678905',ingredientList:['Glycerin']},[barcode,other]);
  assert.equal(decision.state,'identified_formula_unverified');assert.deepEqual(decision.conflicts,['ingredient_mismatch']);
  assert.equal(decision.selected?.productId,product);assert.equal(decision.selected?.formulaVersionId,undefined);
});
