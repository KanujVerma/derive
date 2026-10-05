import assert from 'node:assert/strict';
import test from 'node:test';
import {partFourBindingRelease} from '../src/domain/part-four/release.ts';
import {analyzeFormula} from '../src/domain/part-four/formula.ts';
import {ISOLATED_423_EDUCATION} from '../src/domain/part-four/knowledge423.ts';
import {p3input} from './fixtures/part-three.ts';
import {normalize,LOCAL_DICTIONARY_RELEASE} from '../src/domain/part-two/index.ts';
import {boundDeclaration,sourceReading,p2metadata,p2now} from './fixtures/part-two-core.ts';
import {resolve423EducationalCard} from '../src/domain/part-four/knowledge423.ts';
test('explicit423 binding preserves ordinary37 selection and exact leaf release pin',()=>{
 assert.match(partFourBindingRelease().knowledgeVersion,/approved-37/);
 const binding=partFourBindingRelease('approved423' as any);
 assert.equal(binding.knowledgeHash,ISOLATED_423_EDUCATION.contentHash);
});
test('unknown canonical match preserves unresolved P2 identity; held and proposed aliases stay unknown',()=>{
 const p=normalize(sourceReading('Acetyl Glutamine, Petroleum Jelly, Bacillus/Folic Acid Ferment Extract'),LOCAL_DICTIONARY_RELEASE,p2metadata);
 const f=analyzeFormula(p,{knowledge:ISOLATED_423_EDUCATION,now:p2now});assert(f);
 assert.equal(f.ingredients[0].ingredientId,null);assert.equal(f.ingredients[0].card?.ingredientId,'acetyl-glutamine');assert(f.ingredients.slice(1).every(r=>r.card===null));
 assert(!f.facts.some(x=>x.kind==='reference_function'&&x.subject.ingredientId==='acetyl-glutamine'));
});
test('nullable copy and original duplicates/conditional quantities survive; expansion withdrawal leaves inherited education',()=>{
 const p=normalize(sourceReading('May contain: Acetyl Glutamine 2% w/w, Glycerin, Glycerin'),LOCAL_DICTIONARY_RELEASE,p2metadata);
 const f=analyzeFormula(p,{knowledge:ISOLATED_423_EDUCATION,now:p2now});assert(f);assert.equal(f.ingredients.length,3);assert.equal(f.ingredients[0].modality,'may_contain');assert.equal(f.ingredients[0].quantityText,'2% w/w');assert.equal(f.ingredients[0].card?.contributionKind,'unknown');
 const card=f.ingredients[0].card!;assert.equal(card.detail,ISOLATED_423_EDUCATION.cards.find(c=>c.ingredientId===card.ingredientId)!.detail);
 const omitted=analyzeFormula(p,{knowledge:ISOLATED_423_EDUCATION,now:p2now,withdrawnDependencies:[card.editorial!.documentSha256]});assert(omitted);assert.equal(omitted.ingredients[0].card,null);assert.equal(omitted.ingredients[1].card?.ingredientId,'glycerin');assert.deepEqual(omitted.facts,f.facts);
});
test('rehashing changed prose or activating an alias cannot admit a new423 release',()=>{
 for(const mutate of [(x:any)=>x.cards[50].body='Changed copy',(x:any)=>x.cards[50].aliases=['New unreviewed alias']]){const changed=structuredClone(ISOLATED_423_EDUCATION);mutate(changed);assert.equal(resolve423EducationalCard({literalName:changed.cards[50].name,mapping:{state:'unknown',ingredientId:null}},{explicitLocal423:true,expectedReleaseHash:changed.contentHash,now:p2now},changed),null);}
});
test('conflicting423 formula authority is unavailable without promoting its literal education',()=>{
 const p=structuredClone(normalize(boundDeclaration('Acetyl Glutamine'),LOCAL_DICTIONARY_RELEASE,p2metadata));assert.equal(p.state,'ready');if(p.state!=='ready')return;
 p.output.reading.evidenceState='conflict';assert.equal(analyzeFormula(p,{knowledge:ISOLATED_423_EDUCATION,now:p2now}),null);
});
test('423 education uses the canonical formula renderer contract with exact P2 identity unchanged',()=>{
 const x=p3input(),formula=analyzeFormula(x.partTwo,{knowledge:ISOLATED_423_EDUCATION as any,now:x.now});
 assert(formula,'423 candidate must be admitted as explicit local education');
 assert.equal(formula.knowledgeHash,ISOLATED_423_EDUCATION.contentHash);
 assert.deepEqual(formula.ingredients.map(x=>x.occurrence),x.partTwo.state==='ready'?x.partTwo.output.reading.occurrences:[]);
});
