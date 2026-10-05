import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import path from 'node:path';
import ts from 'typescript';
import {OBF_REUSE_METHOD} from '../supabase/functions/_shared/obf-reuse-method.ts';
import {canonicalJson,sha256} from '../src/domain/part-two/hash.ts';
import {boundDeclaration,p2metadata} from './fixtures/part-two-core.ts';
import {isOpenBeautyFactsSource} from '../src/presentation/part-one/sourceReuse.ts';

function offeredModules(){
  const files=new Map<string,string>(OBF_REUSE_METHOD.methods.map(file=>[file.path,file.content]));
  const cache=new Map<string,any>(),external=createRequire(import.meta.url);
  function load(id:string):any {
    if(cache.has(id))return cache.get(id);
    const source=files.get(id);assert(source,`Offered method dependency missing: ${id}`);
    const exports:any={};cache.set(id,exports);
    const compiled=ts.transpileModule(source,{fileName:id,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
    new Function('require','exports',compiled)((dependency:string)=>dependency.startsWith('.')?load(path.posix.normalize(path.posix.join(path.posix.dirname(id),dependency)).replace(/(?<!\.ts)$/u,'.ts')):external(dependency),exports);
    return exports;
  }
  return load;
}

test('published alteration method executes normalization using its complete added vocabulary',()=>{
  const {contentHash,...body}=OBF_REUSE_METHOD;assert.equal(contentHash,sha256(canonicalJson(body)));
  const load=offeredModules();
  const result=load('src/domain/part-two/index.ts').normalize(boundDeclaration('Water, NIACINAMIDE, Mystery Name','public'),OBF_REUSE_METHOD.additionalContents,p2metadata);
  assert.equal(result.state,'ready');
  assert.deepEqual(result.output.reading.occurrences.map((o:any)=>o.mapping.state),['resolved','resolved','unresolved']);
  assert.deepEqual(result.output.reading.occurrences.map((o:any)=>o.observedName),['Water','NIACINAMIDE','Mystery Name']);
  assert.equal(result.output.reading.occurrences[1].mapping.ingredientId,'niacinamide');
});
test('source reuse disclosure identifies only the actual HTTPS source host',()=>{
  assert(isOpenBeautyFactsSource('https://world.openbeautyfacts.org/product/123'));
  for(const value of [null,'http://world.openbeautyfacts.org/product/123','https://world.openbeautyfacts.org.evil.invalid','https://user@world.openbeautyfacts.org/'])assert.equal(isOpenBeautyFactsSource(value),false);
});

test('only offered assets turn an original OBF-shaped record into public P1 display and faithful P2 fields',async()=>{
  const load=offeredModules();
  const record={status:1,product:{code:'3606000537538',product_name:'Original method fixture lotion',brands:'Original fixture',ingredients_text:'Water, NIACINAMIDE, Niacinamide, Mystery Name',quantity:'50 ml',countries_tags:['en:united-states'],last_modified_t:1791100800}};
  const recipe=load('public-recipe/public-obf-reading.ts');
  const value=await recipe.reproducePublicObf(record,OBF_REUSE_METHOD);
  assert.equal(value.publication.resultPatch.identity,'exact');
  assert.equal(value.publication.resultPatch.display.selectedIdentity.name,record.product.product_name);
  assert.equal(value.publication.resultPatch.display.selectedIdentity.brand,record.product.brands);
  assert.equal(value.publication.resultPatch.display.sections[0].text,record.product.ingredients_text);
  assert.equal(value.publication.resultPatch.display.selectedIdentity.image,null);
  assert.equal(value.normalization.state,'ready');
  assert.deepEqual(value.normalization.output.reading.occurrences.map((o:any)=>o.observedName),['Water','NIACINAMIDE','Niacinamide','Mystery Name']);
  assert.deepEqual(value.normalization.output.reading.occurrences.map((o:any)=>o.mapping.state),['resolved','resolved','resolved','unresolved']);
  assert.equal(new URL(value.input.sourceRefs[0].sourceUrl).pathname,'/api/v2/product/3606000537538.json');
  assert.deepEqual(value.input.labelAssertions,[]);
  assert.equal(value.input.binding.packageConfirmation,'unconfirmed');
  // Independent comparison to the production public projection, never used to
  // execute the offered recipe; no repository fixture constructs its input.
  const {authoritativeInput}=await import('../supabase/functions/_shared/part-two-runtime.ts');
  assert.deepEqual(value.input,authoritativeInput(value.context,{requestId:value.input.binding.requestId} as any));
  const missing=await recipe.reproducePublicObf({status:1,product:{...record.product,ingredients_text:undefined}},OBF_REUSE_METHOD);
  assert.equal(missing.normalization,null);assert.equal(missing.publication.resultPatch.declarationId,null);
});

// Supabase's dependency loader scans the serialized offer; embedded modules
// must remain data. Decoding still yields executable offered reproduction code.
test('published offer cannot introduce embedded payload imports into the Edge module graph',()=>{
 const source=readFileSync(new URL('../supabase/functions/_shared/obf-reuse-method.ts',import.meta.url),'utf8');
 const payload=source.slice(source.indexOf('= ')+2,source.lastIndexOf(' as const'));
 assert.doesNotMatch(payload,/\bimport(?:\s|\()/);
 assert.doesNotMatch(payload,/\bexport\s/);
 assert.deepEqual(JSON.parse(payload),OBF_REUSE_METHOD);
});

// Every advertised digest binds the decoded source bytes, independently of
// the whole-offer canonical digest and executable reproduction checks.
test('all published method entries match their advertised source content digests',()=>{
 for(const file of OBF_REUSE_METHOD.methods)assert.equal(file.sha256,createHash('sha256').update(file.content,'utf8').digest('hex'),file.path);
});
