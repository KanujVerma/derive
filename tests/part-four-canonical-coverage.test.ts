import assert from 'node:assert/strict';
import test from 'node:test';
import {normalize} from '../src/domain/part-two/index.ts';
import {lookupName,LOCAL_DICTIONARY_RELEASE} from '../src/domain/part-two/dictionary.ts';
import {ORDINARY_PART_THREE_RELEASE_SELECTION} from '../src/domain/part-three/release.ts';
import {ISOLATED_423_EDUCATION} from '../src/domain/part-four/knowledge423.ts';
import {analyzeFormula} from '../src/domain/part-four/formula.ts';
import {buildFoundationInsights} from '../src/domain/part-four/foundations.ts';
import {sourceReading,boundDeclaration,p2metadata,p2now} from './fixtures/part-two-core.ts';
import {p3input} from './fixtures/part-three.ts';
const bundle=ORDINARY_PART_THREE_RELEASE_SELECTION;
const dictionary=bundle.dictionaryRelease;
const names=new Set(ISOLATED_423_EDUCATION.cards.map(c=>lookupName(c.name).key));
test('every approved canonical423 name has its exact P2 identity and education, without a chemical-class inference',()=>{
 const failures:string[]=[];
 for(const card of ISOLATED_423_EDUCATION.cards){
  const p=normalize(sourceReading(card.name),dictionary,p2metadata);
  const formula=analyzeFormula(p,{knowledge:ISOLATED_423_EDUCATION,now:p2now});
  const row=formula?.ingredients[0];
  if(formula?.ingredients.length!==1||row?.occurrence.mapping.state!=='resolved'||row.ingredientId!==card.ingredientId||row.card?.ingredientId!==card.ingredientId)failures.push(card.name);
  assert.equal(p.state==='ready'&&p.output.reading.facts.some(f=>f.kind==='reference_function'),false);
 }
 assert.deepEqual(failures,[]);
 const originalIds=new Set(LOCAL_DICTIONARY_RELEASE.identities.map(i=>i.ingredientId));
 const added=dictionary.identities.filter(i=>!originalIds.has(i.ingredientId));
 assert.equal(added.length,409);assert(added.every(i=>i.identityClass==='unclassified_declared_name'&&i.externalReferences.length===0));
 assert.equal(dictionary.identities.length,429);assert.equal(dictionary.aliases.length,432);
});
test('all22 approved moisturizing cards reach limited F01 relevance only with bound clear unconditional presence',()=>{
 const cards=ISOLATED_423_EDUCATION.cards.filter(c=>c.label==='Helps moisturize');assert.equal(cards.length,22);
 const failures:string[]=[];
 for(const card of cards){const x=p3input();x.partTwo=normalize(boundDeclaration(card.name,'public'),dictionary,p2metadata);
  const out=buildFoundationInsights({...x,intent:'replace',selectedComparatorId:null,releaseSelection:bundle,knowledge:ISOLATED_423_EDUCATION,now:x.now});
  const insight=out.insights.find(i=>i.id==='foundation:F01:ingredient_relevance');
  if(!insight||insight.state!=='limited'||!insight.explanation.includes(card.name))failures.push(card.name);
  if(insight){assert.match(insight.explanation,/does not establish.*finished product.*tolerance.*superiority/);assert.equal(insight.factIds.length,1);}
 }
 assert.deepEqual(failures,[]);
 const x=p3input();x.partTwo=normalize(sourceReading('Squalane'),dictionary,p2metadata);
 assert(!buildFoundationInsights({...x,intent:'replace',selectedComparatorId:null,releaseSelection:bundle,knowledge:ISOLATED_423_EDUCATION,now:x.now}).insights.some(i=>i.id==='foundation:F01:ingredient_relevance'));
 x.partTwo=normalize(boundDeclaration('May contain: Squalane','public'),dictionary,p2metadata);
 assert(!buildFoundationInsights({...x,intent:'replace',selectedComparatorId:null,releaseSelection:bundle,knowledge:ISOLATED_423_EDUCATION,now:x.now}).insights.some(i=>i.id==='foundation:F01:ingredient_relevance'));
});
test('held record and all51 proposed aliases stay outside canonical admission; existing exact identities remain distinct',()=>{
 const proposals=ISOLATED_423_EDUCATION.cards.flatMap(c=>c.proposedAliases??[]);assert.equal(proposals.length,51);
 const approvedOriginalNames=new Set(LOCAL_DICTIONARY_RELEASE.aliases.map(a=>a.lookupKey));
 for(const name of ['Bacillus/Folic Acid Ferment Extract',...proposals.map(a=>a.name)]){
  if(names.has(lookupName(name).key)||approvedOriginalNames.has(lookupName(name).key))continue;
  const p=normalize(sourceReading(name),dictionary,p2metadata);assert.equal(p.state,'ready');if(p.state==='ready')assert(p.output.reading.occurrences.every(o=>o.mapping.state!=='resolved'),name);
 }
 const p=normalize(sourceReading('Hyaluronic Acid, Sodium Hyaluronate, Retinol, Retinyl Palmitate, Aloe Barbadensis Leaf Extract, Aloe Barbadensis Leaf Juice'),dictionary,p2metadata);
 assert.equal(p.state,'ready');if(p.state==='ready'){const ids=p.output.reading.occurrences.map(o=>o.mapping.state==='resolved'?o.mapping.ingredientId:null);assert.equal(new Set(ids).size,6);}
 assert.equal(new Set(dictionary.aliases.map(a=>a.lookupKey)).size,dictionary.aliases.length);
});
