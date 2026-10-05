import assert from 'node:assert/strict';
import test from 'node:test';
import {normalize} from '../src/domain/part-two/index.ts';
import {ORDINARY_PART_THREE_RELEASE_SELECTION} from '../src/domain/part-three/release.ts';
import {ISOLATED_423_EDUCATION} from '../src/domain/part-four/knowledge423.ts';
import {boundDeclaration,p2metadata,p2now,p2id} from './fixtures/part-two-core.ts';
import {p3context} from './fixtures/part-three.ts';
import {componentHarness,control,press,textContent} from './ux-profile-render.ts';
const path='src/components/check/part-two/PartTwoIngredients.tsx';
const now=Date.parse(p2now);
// Synthetic reconstructions of the observed identity sets and failed association
// predicate. No owner identifier, profile answer or hosted packet is retained.
function fixture(text:string,associated=false){
 const input=boundDeclaration(text,'public');
 if(!associated){input.bundle.predicate.variantMarket={passed:false,evidenceIds:[p2id(7)],reasons:['variant_unknown:form','market_unknown']};input.declaration.category='unknown';}
 const result=normalize(input,ORDINARY_PART_THREE_RELEASE_SELECTION.dictionaryRelease,p2metadata);
 assert.equal(result.state,'ready');if(result.state!=='ready')throw Error('Fixture not ready');
 if(!associated)assert.equal(result.output.kind==='bound'&&result.output.productFacts.facts.length,0);
 const view={target:{ownerId:result.authenticatedOwnerId,scanId:result.scanId,captureSessionId:result.captureSessionId,generation:result.generation,evidenceRevision:result.evidenceRevision},result,loading:false,error:null};
 const context=p3context();context.profile!.id=p2id(900);
 return {view,context,education:{ownerId:context.ownerId,context,knowledge:ISOLATED_423_EDUCATION}};
}
function ui(f:ReturnType<typeof fixture>){return componentHarness(path,'PartTwoInlineView',{view:f.view,now,education:f.education});}

test('retained lotion shape uses source-only moisture roles with the existing For dryness despite no product facts or use answers',()=>{
 const f=fixture('Petrolatum, Sorbitol, Cetearyl Alcohol, Propylene Glycol');
 const h=ui(f);const text=textContent(h.render());
 assert.match(text,/Ingredient context/);assert.match(text,/For dryness/i);assert.match(text,/Petrolatum.*water loss|water loss.*Petrolatum/i);
 assert.match(text,/published.*list/i);assert.match(text,/package.*not confirmed/i);
 assert(!/worth considering|worth keeping|safe for|will improve|will irritate/i.test(text));
 assert.equal(f.view.result.output.kind==='bound'&&f.view.result.output.productFacts.facts.length,0);
 press(control(h.render(),'Ingredient details: Sorbitol'));assert.match(textContent(h.render()),/hold water.*glide|hold water.*spread/i);
});
test('deodorant source roles stay useful without a matching goal, and actual approved cautions stay reachable',()=>{
 const f=fixture('Propanediol, Cetyl Alcohol, Caprylyl Glycol, Sodium Chloride');f.context.profile!.data.primaryGoal={state:'known',value:'oiliness'};
 const h=ui(f);let text=textContent(h.render());assert.match(text,/Propanediol.*water.*dissolv/i);assert(!/oiliness goal|oil control|reduces oil/i.test(text));
 press(control(h.render(),'Ingredient details: Cetyl Alcohol'));text=textContent(h.render());assert.match(text,/waxy fatty alcohol/i);
 const old=fixture('Fragrance, Propylene Glycol, Tetrasodium EDTA, Water');old.context.profile!.data.primaryGoal={state:'known',value:'oiliness'};
 const o=ui(old);assert.match(textContent(o.render()),/Fragrance.*scent/i);press(control(o.render(),'Ingredient details: Propylene Glycol'));
 assert.match(textContent(o.render()),/patch testing.*confirmed.*allergy/i);
});
test('reported reactivity prioritizes the approved fragrance caution without predicting sensitivity or a product verdict',()=>{
 const f=fixture('Fragrance, Propylene Glycol, Water');f.context.profile!.data.reactivity='reacts_easily';
 const text=textContent(ui(f).render());assert.match(text,/Reactive skin/i);assert.match(text,/Fragrance.*reaction|Fragrance.*allerg/i);
 assert.match(text,/your response.*unknown/i);assert(!/avoid this product|unsafe|high risk|will irritate/i.test(text));
});
test('a reported exact sensitivity is a source-reading match, never an invented confirmed allergy or absence finding',()=>{
 const f=fixture('Propylene Glycol, Water');f.context.profile!.data.sensitivities={status:'reported',values:['Propylene Glycol']};
 const text=textContent(ui(f).render());assert.match(text,/reported sensitivity.*Propylene Glycol|Propylene Glycol.*reported sensitivity/i);
 assert.match(text,/Published list/i);assert(!/you are allergic|fragrance.free|does not contain/i.test(text));
 assert.match(text,/If patch testing has confirmed an allergy to propylene glycol/);
});
test('known eligible moisturizer still has useful source context and unknown names get no guessed role',()=>{
 const f=fixture('Glycerin, Water',true);assert.match(textContent(ui(f).render()),/For dryness/i);
 const unknown=fixture('Mystery Ingredient');const h=ui(unknown);const text=textContent(h.render());assert(!/For dryness|moisturiz|hydration benefit/i.test(text));
 press(control(h.render(),'Ingredient details: Mystery Ingredient'));assert.match(textContent(h.render()),/unavailable/i);
});
test('owner/profile changes, source expiry and conditional or unclear identities remove derived context immediately',()=>{
 const f=fixture('Petrolatum');const h=ui(f);assert.match(textContent(h.render()),/For dryness/i);
 const next=structuredClone(f.context);next.profile!.data.primaryGoal={state:'known',value:'oiliness'};next.revision++;next.profile!.revision=next.revision;
 assert(!/For dryness/i.test(textContent(h.render({education:{...f.education,context:next}}))));
 const foreign=structuredClone(next);foreign.ownerId=p2id(999);foreign.profile!.ownerId=foreign.ownerId;
 assert(!/Ingredient context|slows.*water|For dryness/i.test(textContent(h.render({education:{...f.education,context:foreign}}))));
 assert(!/Ingredient context/i.test(textContent(h.render({education:f.education,now:Date.parse(f.view.result.expiresAt)}))));
 for(const text of ['May contain: Petrolatum','Petrolatum or Water'])assert(!/For dryness/i.test(textContent(ui(fixture(text)).render())));
});
test('source-context copy stays compact while approved bodies and source disclosures remain expandable',()=>{
 const f=fixture('Petrolatum, Sorbitol, Cetearyl Alcohol, Propylene Glycol, Water');
 const h=ui(f);const nodes=h.render();const summary=nodes.find(n=>n.props.accessibilityLabel==='Ingredient context summary');assert(summary);
 assert(!textContent(nodes).includes('In a small study'));assert(!/F01|permission|epoch|registry|decision_candidate/.test(textContent(nodes)));
 assert(control(nodes,'Ingredient details: Petrolatum'));press(control(nodes,'Ingredient details: Petrolatum'));assert.match(textContent(h.render()),/greasy film/i);
});

test('unknown reactions and texture preferences do not become personal forecasts; source summaries stay short for dryness and retain mandatory cautions',()=>{
 const f=fixture('Petrolatum, Sorbitol, Propylene Glycol, Fragrance');f.context.profile!.data.reactivity='reacts_easily';
 const h=ui(f);const nodes=h.render();const summary=nodes.find(n=>n.props.accessibilityLabel==='Ingredient context summary')!;
 const words=(value:any):string=>Array.isArray(value)?value.map(words).join(' '):typeof value==='string'?value:value?.props?words(value.props.children):'';
 assert(words(summary).includes(ISOLATED_423_EDUCATION.cards.find(c=>c.ingredientId==='propylene-glycol')!.editorial!.caution!),'mandatory caution must remain visible');
 const simple=ui(fixture('Petrolatum, Sorbitol')).render().find(n=>n.props.accessibilityLabel==='Ingredient context summary')!;
 assert(words(simple).trim().split(/\s+/).length<=35,'simple ingredient context exceeds 35 words');
 assert.match(words(simple),/For dryness: Petrolatum slows water loss\. Sorbitol helps hold water\./);
 assert.equal((words(simple).match(/unknown/g)??[]).length,1,'one shared uncertainty line');
 f.context.profile!.data.texturePreference={state:'known',value:'lightweight'};f.context.profile!.data.primaryGoal={state:'known',value:'oiliness'};f.context.profile!.data.reactivity='generally_tolerates';
 const text=textContent(h.render({education:f.education}));assert.match(text,/lightweight.*product.s feel/i);
 assert(!/will feel greasy|you will tolerate|irritation.free|reduces redness/i.test(text));
 f.context.profile!.data.primaryGoal={state:'known',value:'dryness'};
 const cautionFirst=textContent(h.render({education:f.education}));assert.match(cautionFirst,/For dryness/);
 assert.match(cautionFirst,/If patch testing has confirmed an allergy to propylene glycol/,'texture observation must not displace the caution');
});
test('source revocation and education expiry remove card copy, and different ingredient sensitivities never become an exact match',()=>{
 const f=fixture('Propanediol');f.context.profile!.data.sensitivities={status:'reported',values:['Propylene Glycol']};
 const h=ui(f);assert(!/reported sensitivity/.test(textContent(h.render())));
 const revoked=structuredClone(f.view);(revoked.result.output.reading.dependencyManifest.sourceRefs[0] as {permitted:boolean}).permitted=false;
 assert(!/Ingredient context|Holds water/.test(textContent(h.render({view:revoked}))));
 const knowledge={...ISOLATED_423_EDUCATION,provenance:{...ISOLATED_423_EDUCATION.provenance,revoked:true}};
 assert(!/Ingredient context|Holds water/.test(textContent(h.render({view:f.view,education:{...f.education,knowledge}}))));
});
test('expanded approved education keeps its own source attribution and qualifications separate from the ingredient-list source',()=>{
 const f=fixture('Sorbitol');const h=ui(f);press(control(h.render(),'Ingredient details: Sorbitol'));press(control(h.render(),'Ingredient source and reference'));
 assert.match(textContent(h.render()),/Ingredient reference source/);
 assert.match(textContent(h.render()),/No specific caution is listed\. This does not establish safety\./);
 assert.match(textContent(h.render()),/Synthetic private label/);
});
