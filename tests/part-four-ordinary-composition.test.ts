import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {parsePartFourClientSelection,ordinaryPartFourClientSelection} from '../src/domain/part-four/clientRelease.ts';
import {ORDINARY_PART_THREE_RELEASE_SELECTION} from '../src/domain/part-three/release.ts';
import {REVIEWED_PUBLIC_USEFULNESS_MANIFEST} from '../src/domain/part-four/reviewedHostedUsefulness.ts';
import {partFourClientBinding} from '../src/domain/part-four/clientRelease.ts';
import {projectScientificFeatures} from '../src/domain/part-four/featureProjection.ts';
import {fixture,check} from './fixtures/part-four-usefulness-composition.ts';

// Execute the real deployment entrypoint. Only SDK I/O and the handler boundary
// are replaced; this checks composition selection, not Auth/SQL acceptance.
function entry(science:string|undefined){
 const index=new URL('../supabase/functions/part-three/index.ts',import.meta.url),require=createRequire(index);
 const env:Record<string,string|undefined>={SUPABASE_URL:'https://snojlbqovlawewwqbviz.supabase.co',SUPABASE_ANON_KEY:'fixture',SUPABASE_SERVICE_ROLE_KEY:'fixture',DERIVE_CHECK_RELEASE:'derive-original-personal-v1',DERIVE_PART_FOUR_SCIENCE:science};
 let handler!:(r:Request)=>Promise<Response>,ports:any=null;
 const output=ts.transpileModule(readFileSync(index,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','exports','Deno','EdgeRuntime',output)((id:string)=>id==='npm:@supabase/supabase-js@2.116.0'?{createClient:()=>({auth:{getUser:async()=>({data:{user:{id:'fixture-owner'}},error:null})}})}:id==='./handler.ts'?{PartThreeError:class extends Error{},handlePersonalRequest:async(_raw:unknown,p:any)=>{ports=p;return {kind:'unavailable',reason:'fixture_no_SQL'};}}:require(id),{},{env:{get:(k:string)=>env[k]},serve:(fn:typeof handler)=>handler=fn},{waitUntil(){throw Error('No background work expected');}});
 return {invoke:()=>handler(new Request('https://derive.invalid',{method:'POST',headers:{authorization:'Bearer synthetic'},body:'{}'})),ports:()=>ports};
}
// Isolate the actual service selection initializer from network/session side
// effects. Executing the expression catches a hardcoded ordinary science branch.
function client(science:string|undefined){
 const path=new URL('../src/services/partThree.ts',import.meta.url),source=readFileSync(path,'utf8'),ast=ts.createSourceFile(path.pathname,source,ts.ScriptTarget.Latest,true);
 let initializer='';const visit=(n:ts.Node)=>{if(ts.isVariableDeclaration(n)&&n.name.getText(ast)==='PART_FOUR_CLIENT_SELECTION')initializer=n.initializer!.getText(ast);ts.forEachChild(n,visit);};visit(ast);
 return new Function('parsePartFourClientSelection','ordinaryPartFourClientSelection','PART_ONE_ORDINARY_RELEASE','process',`return (${initializer});`)(parsePartFourClientSelection,ordinaryPartFourClientSelection,ORDINARY_PART_THREE_RELEASE_SELECTION,{env:{EXPO_PUBLIC_PART_FOUR_SCIENCE:science}});
}
test('ordinary explicit usefulness selection reaches the handler with public scoped factual admissions',async()=>{
 const f=entry('reviewed_public_usefulness');assert.equal((await f.invoke()).status,200);
 assert.equal(f.ports().partFourComposition,'reviewed_usefulness');
 assert.equal(f.ports().partFourEducation,'approved423');
 assert.deepEqual(f.ports().partFourDecisionEvidence.manifest.admissions.map((a:any)=>a.rights.grantId),['derive-original-public-usefulness-facts-v1','derive-original-public-usefulness-facts-v1','derive-original-public-usefulness-facts-v1']);
 assert(f.ports().partFourDecisionEvidence.manifest.admissions.every((a:any)=>a.review.reviewer.credentialEvidenceRef===null));
 assert.deepEqual(client('reviewed_public_usefulness'),{education:'approved423',science:'reviewed_public_usefulness'});
});
test('ordinary unselected science keeps pending behavior; unknown selection fails before handler work',async()=>{
 const unset=entry(undefined);await unset.invoke();assert.equal(unset.ports().partFourComposition,undefined);assert.equal(unset.ports().partFourDecisionEvidence.manifest.admissions.length,0);assert.deepEqual(client(undefined),{education:'approved423',science:'pending_candidates'});
 const invalid=entry('invented');const response=await invalid.invoke();assert.deepEqual(await response.json(),{kind:'unavailable',reason:'configuration_required'});assert.equal(invalid.ports(),null);assert.throws(()=>client('invented'));
});
test('public usefulness handler preserves reference limits and applicable AHA guidance under the new exact tuple',async()=>{
 const evaluatedAt='2026-10-04T20:00:00.000Z',manifest=REVIEWED_PUBLIC_USEFULNESS_MANIFEST;
 const configure=(ports:any)=>{ports.now=()=>evaluatedAt;ports.partFourDecisionEvidence={manifest,load:async(binding:any,input:any)=>projectScientificFeatures({manifest,binding,...input,now:evaluatedAt})};};
 const moisturizer=fixture('Niacinamide, Glycerin, Water','Moisturizes facial skin. Leave on.');moisturizer.context.profile!.data.primaryGoal={state:'known',value:'dryness'};
 const result=await check(moisturizer,[],'composition',null,'replace',configure);
 const reference=result.partFour!.scientificDecision!.assessments.find(r=>r.assessment.claimId==='G01-03-reviewed-barrier-reference-v1')!.assessment;
 assert.equal(reference.state,'reference');assert.equal(reference.action,null);assert.match(reference.reason!,/not a test of this product/);assert.equal(result.partFour!.decisionState,'pending');
 assert.deepEqual(result.binding.releases.partFour,partFourClientBinding(client('reviewed_public_usefulness')));
 assert(result.partFour!.retainedEvidence!.fields.filter(f=>f.kind==='scientific_claim'&&f.state==='retained').every(f=>f.grants.every(g=>g.policyId==='derive-original-public-usefulness-facts-v1')));
 const exfoliant=await check(fixture(),[],'composition',null,'replace',configure);
 const aha=exfoliant.partFour!.scientificDecision!.assessments.find(r=>r.assessment.claimId==='G05-03-reviewed-AHA-sun-plan-v1')!.assessment;
 assert.equal(aha.state,'supported');assert.match(aha.action!,/sunscreen/);assert.equal(exfoliant.summary!.judgment,'check_first');
});
