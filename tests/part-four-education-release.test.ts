import assert from 'node:assert/strict';
import test from 'node:test';
import { APPROVED47_SOURCE } from '../src/domain/part-four/approved47-source.ts';
import * as knowledge from '../src/domain/part-four/knowledge.ts';
import { analyzeFormula } from '../src/domain/part-four/formula.ts';
import { normalize, LOCAL_DICTIONARY_RELEASE } from '../src/domain/part-two/index.ts';
import { boundDeclaration, p2metadata, p2now } from './fixtures/part-two-core.ts';
import { PART_FOUR_RELEASE } from '../src/domain/part-four/release.ts';
import { authorizedPartFourPacket } from '../src/presentation/part-four/sections.ts';
import { componentHarness, control, press, textContent } from './ux-profile-render.ts';
import { PartFourPacketSchema } from '../src/contracts/PartFour.ts';
const source=APPROVED47_SOURCE;
const current=knowledge.APPROVED_INGREDIENT_KNOWLEDGE;
const normalized=(raw:string)=>normalize(boundDeclaration(raw),LOCAL_DICTIONARY_RELEASE,p2metadata);

test('selected local education release renders all47 exact approved cards without manufacturing ingredient dose or product efficacy',()=>{
 assert.equal(current.cards.length,47);
 for(const expected of source.cards){const e=expected.approvedEntry;const card=knowledge.resolveIngredientKnowledge(e.display_name)!;assert.ok(card,e.display_name);
  for(const [key,field] of [['short','function'],['label','proposed_label'],['body','short_intro'],['detail','depth'],['evidence','evidence_note']] as const)assert.equal(card[key],e[field]);
  const editorial=(card as any).editorial;assert.equal(editorial.caution,e.cautions.standalone_text);assert.equal(editorial.amountAndUse,e.concentration.amount_and_use_text);assert.equal(editorial.aliasNotes,e.aliases.notes_verbatim??null);assert.equal(editorial.distinctIngredients,e.aliases.distinct_ingredients_notes_verbatim??null);
  assert.equal(editorial.copySha256,e.copy_sha256);assert.equal(editorial.libraryVersion,e.source_document.library_version);
 }
 const formula=analyzeFormula(normalized('Retinol, Retinal, Urea, Mystery Name'),{now:p2now})!;assert.ok(formula);assert.deepEqual(formula.ingredients.map(i=>i.observedName),['Retinol','Retinal','Urea','Mystery Name']);assert.ok(formula.ingredients.slice(0,3).every(i=>i.card));assert.equal(formula.ingredients[3].card,null);assert.ok(formula.ingredients.every(i=>i.quantityText===null));
 assert.equal(PART_FOUR_RELEASE.productionApproved,false);
});

test('historical37 explicitly resolves unchanged while current pin binds revised copy and metadata',()=>{
 const historic=(knowledge as any).APPROVED_37_INGREDIENT_KNOWLEDGE;assert.ok(historic);assert.equal(historic.contentHash,'7d87dfb01c6039e26617802f36dbf6476992d6e6e7623d470aab7ed07b69715b');
 assert.equal(knowledge.resolveIngredientKnowledge('Retinal',historic),null);
 assert.notEqual(knowledge.resolveIngredientKnowledge('1,2-Hexanediol',historic)?.body,knowledge.resolveIngredientKnowledge('1,2-Hexanediol')?.body);
 const old=analyzeFormula(normalized('Carnosine'),{now:p2now,knowledge:historic})!;const fresh=analyzeFormula(normalized('Carnosine'),{now:p2now})!;assert.equal(old.knowledgeHash,historic.contentHash);assert.notEqual(old.knowledgeHash,fresh.knowledgeHash);assert.notEqual(old.ingredients[0].card?.short,fresh.ingredients[0].card?.short);
});

test('tamper-rehashed47 caution, source metadata, context and derivative alias cannot create another approved release',()=>{
 for(const mutate of [(x:any)=>x.cards.find((c:any)=>c.name==='Retinal').editorial.caution=null,(x:any)=>x.sources[0].editorial.rights='permitted',(x:any)=>x.educationContext[0].sections[0].paragraphs[0].text+=' extra',(x:any)=>x.cards.find((c:any)=>c.name==='Retinal').aliases.push('Retinaldehyde')]){
  const bad=structuredClone(current);mutate(bad);bad.contentHash=knowledge.ingredientKnowledgeHash(bad);assert.throws(()=>knowledge.validateIngredientKnowledgeRelease(bad));
 }
 for(const name of ['Retinaldehyde','Vitamin A','Retinoid','BHA','AHA','Vitamin C','D-Panthenol','Hydroxyethyl Urea'])assert.equal(knowledge.resolveIngredientKnowledge(name),null,name);
 assert.notEqual(knowledge.resolveIngredientKnowledge('Retinol')?.ingredientId,knowledge.resolveIngredientKnowledge('Retinal')?.ingredientId);
 assert.equal(knowledge.resolveIngredientKnowledge('Retinal',current,{withdrawnDependencies:['libfile_62fd53a648888191b30c8ff388128dc1']}),null);
});

test('actual expanded ingredient renderer keeps attributed caution, amount/form distinction and shared research limitations readable',()=>{
 const formula=analyzeFormula(normalized('Retinal, 1,2-Hexanediol'),{now:p2now})!;
 const packet=PartFourPacketSchema.parse({version:'part-four-foundations/v1',releaseId:PART_FOUR_RELEASE.id,formula,insights:[],comparison:{state:'none',routineItemId:null,explanation:'No current item supplied.',candidateIds:[]},reviews:{state:'unavailable',explanation:'Unavailable.',sourceIds:[]},value:{state:'unavailable',explanation:'Unavailable.',sourceIds:[]},requiredEvidence:[],decisionState:'pending',action:'Review unresolved evidence.',contextRevision:1});
 const ui=componentHarness('src/components/check/part-four/PartFourSections.tsx','PartFourSections',{packet,now:Date.parse(p2now)});press(control(ui.render(),'Ingredient details: Retinal, position 1'));let text=textContent(ui.render());const e=source.cards.find(c=>c.approvedEntry.display_name==='Retinal')!.approvedEntry;assert.ok(e.cautions.standalone_text);assert.ok(e.concentration.amount_and_use_text);assert.ok(e.aliases.distinct_ingredients_notes_verbatim);
 assert.ok(text.includes(e.cautions.standalone_text));assert.ok(text.includes(e.concentration.amount_and_use_text));assert.ok(text.includes(e.aliases.distinct_ingredients_notes_verbatim));assert.ok(text.includes('Amount in this formula: not disclosed.'));
 press(control(ui.render(),'Part Four sources'));text=textContent(ui.render());assert.ok(text.includes('PH DOCTOR partly funded the study'));assert.ok(text.includes('Copy approved'));assert.ok(text.includes('remote source revision unverified'));
 const retired=ui.render({packet:null,withdrawn:true});assert.ok(!textContent(retired).includes(e.cautions.standalone_text));
});

test('knowledge deadline withdraws the mounted formula before its source lease, without restamping historical packets',()=>{
 const expiring=structuredClone(current);expiring.provenance.expiresAt='2026-10-02T10:00:01Z';expiring.contentHash=knowledge.ingredientKnowledgeHash(expiring);
 const formula=analyzeFormula(normalized('Retinal'),{now:p2now,knowledge:expiring})!;assert.equal(Date.parse(formula.expiresAt),Date.parse('2026-10-02T10:00:01Z'));
 const packet=PartFourPacketSchema.parse({version:'part-four-foundations/v1',releaseId:PART_FOUR_RELEASE.id,formula,insights:[],comparison:{state:'none',routineItemId:null,explanation:'No current item.',candidateIds:[]},reviews:{state:'unavailable',explanation:'Unavailable.',sourceIds:[]},value:{state:'unavailable',explanation:'Unavailable.',sourceIds:[]},requiredEvidence:[],decisionState:'pending',action:'Pending.',contextRevision:1});
 assert.ok(authorizedPartFourPacket(packet,{now:Date.parse(p2now)}));assert.equal(authorizedPartFourPacket(packet,{now:Date.parse('2026-10-02T10:00:02Z')}),null);
});

test('customer context preserves source limits without exposing editorial worksheet or importer commands',()=>{
 const formula=analyzeFormula(normalized('Retinal, Water'),{now:p2now})!;const payload=JSON.stringify(formula);
 for(const unwanted of ['Decisions for this review','Review decisions','Labels to change:','this package does not activate alias rules','No percentages inferred or normalized'])assert.ok(!payload.includes(unwanted),unwanted);
 assert.ok(payload.includes('those different figures and bases are not reconciled here'));assert.ok(payload.includes('PH DOCTOR partly funded the study'));assert.ok(payload.includes('Different ceramides stay separate'));
});
