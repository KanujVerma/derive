import assert from 'node:assert/strict';
import test from 'node:test';
import { exactIngredientEvidence, ingredientEvidenceKey, lookupIngredientCandidates } from '../supabase/functions/_shared/ingredient-candidates.ts';
const OWNER = 'a1900000-0000-4000-8000-000000000099';
const ID = 'a1900000-0000-4000-8000-000000000001';
test('exact evidence retains punctuation, order and duplicates while normalizing Unicode and whitespace', () => {
  assert.equal(exactIngredientEvidence([' ＷＡＴＥＲ ', 'Niacinamide\u00a0 2.5%'], ['water', 'niacinamide 2.5%']), true);
  assert.equal(ingredientEvidenceKey('ΟΣ'), 'ος');
  for (const other of [['Glycerin', 'Water'], ['Water', 'Water', 'Glycerin'], ['Water', 'Glycerin/Water'], ['Water', 'Glycerin.']]) {
    assert.equal(exactIngredientEvidence(['Water', 'Glycerin'], other), false);
  }
});
test('sentinel abstains before a formula row fetch', async () => {
  let reads = 0;
  const admin = { rpc: async () => ({data:Array.from({length:101},(_,i)=>`a1900000-0000-4000-8000-${String(i).padStart(12,'0')}`)}), from: () => {reads++;} };
  await assert.rejects(lookupIngredientCandidates(admin, OWNER, true, ['Water']), /CATALOG_TOO_LARGE/);
  assert.equal(reads, 0);
});
test('retrieval passes owner and raw evidence, retains market mismatch, and fetches exact IDs only', async () => {
  const row = {id:ID, variant_id:null, ingredients:['water'], region_code:'CA'};
  const query:any = {select:()=>query, in:(field:string,ids:string[])=>{assert.equal(field,'id');assert.deepEqual(ids,[ID]);return query;}, eq:async()=>({data:[row]})};
  const admin = {rpc:async(name:string,args:any)=>{assert.equal(name,'lookup_ingredient_candidate_ids');assert.deepEqual(args,{p_ingredients:[' Water '],p_free_only:true,p_user_id:OWNER});return {data:[ID]};},from:()=>query};
  assert.deepEqual(await lookupIngredientCandidates(admin,OWNER,true,[' Water ']),[row]);
});
test('changed or inconsistent rows do not become a partial unique result', async () => {
  for (const data of [[],[null],[{id:ID,variant_id:null,ingredients:['Water/Glycerin'],region_code:null}]]) {
    const query:any={select:()=>query,in:()=>query,eq:async()=>({data})};
    const admin={rpc:async()=>({data:[ID]}),from:()=>query};
    await assert.rejects(lookupIngredientCandidates(admin,OWNER,false,['Water']),/CATALOG_UNAVAILABLE/);
  }
});
test('invalid RPC results and invalid inputs fail before bounded hydration', async () => {
  for (const data of [null, {}, ['not-a-uuid'], [ID, ID]]) {
    const admin = {rpc:async()=>({data}),from:()=>assert.fail('no hydration')};
    await assert.rejects(lookupIngredientCandidates(admin,OWNER,true,['Water']),/CATALOG_UNAVAILABLE/);
  }
  const admin = {rpc:async()=>assert.fail('invalid input must not query')};
  for (const ingredients of [[],['   '], Array(301).fill('Water'), ['x'.repeat(180001)]]) {
    await assert.rejects(lookupIngredientCandidates(admin,OWNER,true,ingredients),/CATALOG_UNAVAILABLE/);
  }
});
test('zero and multiple IDs retain unknown/ambiguity without selecting a winner', async () => {
  const second = 'a1900000-0000-4000-8000-000000000002';
  const rows = [ID,second].map(id=>({id,variant_id:null,ingredients:['Water'],region_code:null}));
  const query:any={select:()=>query,in:()=>query,eq:async()=>({data:rows})};
  assert.deepEqual(await lookupIngredientCandidates({rpc:async()=>({data:[]}),from:()=>assert.fail('zero reads')},OWNER,true,['Water']),[]);
  assert.deepEqual(await lookupIngredientCandidates({rpc:async()=>({data:[ID,second]}),from:()=>query},OWNER,true,['Water']),rows);
});
