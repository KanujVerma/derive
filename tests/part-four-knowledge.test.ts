import assert from 'node:assert/strict';
import test from 'node:test';
import { APPROVED_CARD_TEXT } from '../src/domain/part-four/approved-card-text.ts';
import { APPROVED_37_INGREDIENT_KNOWLEDGE as APPROVED_INGREDIENT_KNOWLEDGE, ingredientKnowledgeHash, resolveIngredientKnowledge as resolveSelectedKnowledge, validateIngredientKnowledgeRelease } from '../src/domain/part-four/knowledge.ts';
import { analyzeFormula } from '../src/domain/part-four/formula.ts';
import { canonicalJson, sha256 } from '../src/domain/part-two/hash.ts';
import { LOCAL_DICTIONARY_RELEASE, lookupName } from '../src/domain/part-two/dictionary.ts';
import { normalize } from '../src/domain/part-two/index.ts';
import { boundDeclaration, p2metadata, p2now, p2expiry, sourceReading } from './fixtures/part-two-core.ts';
import { FormulaAnalysisSchema } from '../src/contracts/PartFour.ts';

const pack = APPROVED_INGREDIENT_KNOWLEDGE;
const opts = { now: p2now, knowledge:pack };
const resolveIngredientKnowledge: typeof resolveSelectedKnowledge = (name,value=pack,lifecycle={})=>resolveSelectedKnowledge(name,value,lifecycle);
const vanicream = ['Water','Squalane','Glycerin','Pentylene Glycol','Polyglyceryl-2 Stearate','Glyceryl Stearate','Stearyl Alcohol','Hyaluronic Acid','Ceramide EOP','Ceramide NG','Ceramide NP','Ceramide AS','Ceramide AP','Carnosine','Hydrogenated Lecithin','Phytosterols','Caprylyl Glycol','Polyacrylate Crosspolymer-11','1,2-Hexanediol'];
const cerave = ['Aqua / Water / Eau','Glycerin','Caprylic/Capric Triglyceride','Niacinamide','Cetearyl Alcohol','Potassium Phosphate','Ceramide NP','Ceramide AP','Ceramide EOP','Carbomer','Dimethicone','Ceteareth-20','Behentrimonium Methosulfate','Sodium Lauroyl Lactylate','Sodium Hyaluronate','Cholesterol','Phenoxyethanol','Disodium EDTA','Dipotassium Phosphate','Caprylyl Glycol','Phytosphingosine','Xanthan Gum','Polyglyceryl-3 Diisostearate','Ethylhexylglycerin'];
const ready = (raw: string, bound = true) => normalize(bound ? boundDeclaration(raw) : sourceReading(raw), LOCAL_DICTIONARY_RELEASE, p2metadata);

test('all 37 cards preserve the approved exact prose and sources with pinned provenance', () => {
  assert.equal(sha256(canonicalJson(APPROVED_CARD_TEXT)), '35c82db524c5ed8488c3f3d4df4fa3a609e1109fc0769eb9b01bc7aa5871ad18');
  assert.equal(pack.cards.length, 37);
  assert.equal(new Set(pack.cards.map(card => card.ingredientId)).size, 37);
  assert.equal(pack.contentHash, ingredientKnowledgeHash(pack));
  assert.equal(pack.provenance.libraryFileId, 'libfile_211e2d19dbe881918237cc72994ca091');
  assert.equal(pack.provenance.documentSha256, '454bed78398c483ef3224f03efc12fb2dd1478d6cc6f80c12d5a2e22392ddd8e');
  assert.equal(pack.provenance.handoffSha256, '2b6c2b0af8882a7c5d7fc92838c6ac489e1f2a718680b67f5b3d8f733420dc82');
  for (const [name, text] of Object.entries(APPROVED_CARD_TEXT)) {
    const card = resolveIngredientKnowledge(name)!;
    for (const field of ['short','label','body','detail','evidence'] as const) assert.equal(card[field], text[field]);
    assert.equal(pack.sources.find(source => source.id === card.sourceIds[0])?.url, text.source);
    const identity = LOCAL_DICTIONARY_RELEASE.identities.find(identity => lookupName(identity.preferredName).key === lookupName(name).key);
    if (identity) assert.equal(card.ingredientId, identity.ingredientId);
  }
  assert.ok(Object.isFrozen(pack.cards[0]));
});

test('only exact normalized approved aliases resolve and related identities remain distinct', () => {
  for (const name of ['Water','Aqua','Eau','Aqua / Water / Eau','  AQUA  ']) assert.equal(resolveIngredientKnowledge(name)?.ingredientId,'water');
  assert.equal(resolveIngredientKnowledge('Ceramide 1')?.ingredientId,resolveIngredientKnowledge('Ceramide EOP')?.ingredientId);
  assert.notEqual(resolveIngredientKnowledge('Hyaluronic Acid')?.ingredientId,resolveIngredientKnowledge('Sodium Hyaluronate')?.ingredientId);
  assert.equal(new Set(['EOP','NP','AP','NG','AS'].map(kind => resolveIngredientKnowledge(`Ceramide ${kind}`)?.ingredientId)).size,5);
  for (const name of ['Water/Squalane','Water / Aqua / Eau','Aqua (Water, Eau)','Ceramide 3','Ceramides','Squalene','Hyaluronic','Niacinamide 4%','1,2 Hexanediol','PEG-8','Vitamin B3']) assert.equal(resolveIngredientKnowledge(name),null,name);
});

test('release rejects changed prose, invalid source dependencies and alias collisions', () => {
  const changed = structuredClone(pack); changed.cards[0].body += ' Different';
  assert.throws(() => validateIngredientKnowledgeRelease(changed),/hash/i);
  const source = structuredClone(pack); source.cards[0].sourceIds = ['foreign']; source.contentHash = ingredientKnowledgeHash(source);
  assert.throws(() => validateIngredientKnowledgeRelease(source),/source/i);
  const collision = structuredClone(pack); collision.cards[1].aliases.push('Glycerin'); collision.contentHash = ingredientKnowledgeHash(collision);
  assert.throws(() => validateIngredientKnowledgeRelease(collision),/alias/i);
  const alias = structuredClone(pack); alias.cards[1].aliases.push('Squalene'); alias.contentHash = ingredientKnowledgeHash(alias);
  assert.throws(() => validateIngredientKnowledgeRelease(alias),/approved alias/i);
  const prose = structuredClone(pack); prose.cards[0].evidence = 'Proves this lotion works'; prose.contentHash = ingredientKnowledgeHash(prose);
  assert.throws(() => validateIngredientKnowledgeRelease(prose),/approved prose/i);
});

test('knowledge withdrawal and expiry remove cards without silently using another release', () => {
  assert.equal(resolveIngredientKnowledge('Glycerin',pack,{withdrawnDependencies:[pack.version]}),null);
  assert.equal(resolveIngredientKnowledge('Glycerin',pack,{withdrawnDependencies:['ingredient-reference:glycerin']}),null);
  const revoked = structuredClone(pack); revoked.provenance.revoked = true; revoked.contentHash = ingredientKnowledgeHash(revoked);
  assert.equal(resolveIngredientKnowledge('Glycerin',revoked),null);
  const expired = structuredClone(pack); expired.provenance.expiresAt = p2expiry; expired.contentHash = ingredientKnowledgeHash(expired);
  assert.equal(resolveIngredientKnowledge('Glycerin',expired,{now:p2expiry}),null);
});

test('all 43 literal formula positions stay ordered with metadata, shared cards and unknown amounts', () => {
  let count = 0;
  for (const names of [vanicream,cerave]) {
    const normalization = ready(names.join(', ')); assert.equal(normalization.state,'ready');
    if (normalization.state !== 'ready') throw Error('missing fixture');
    const formula = analyzeFormula(normalization,opts)!;
    assert.ok(formula); FormulaAnalysisSchema.parse(formula);
    assert.equal(formula.ingredients.length,names.length); count += formula.ingredients.length;
    assert.deepEqual(formula.ingredients.map(ingredient => ingredient.observedName),names);
    assert.ok(formula.ingredients.every(ingredient => ingredient.card));
    assert.deepEqual(formula.ingredients.map(ingredient => ingredient.occurrence),normalization.output.reading.occurrences);
    assert.equal(formula.partTwoBindingKey,normalization.bindingKey);
    assert.equal(formula.partTwoRevision,normalization.resultRevision);
    assert.equal(formula.dependencyDigest,normalization.output.reading.binding.dependencyDigest);
    assert.deepEqual(formula.sourceRefs,normalization.output.reading.dependencyManifest.sourceRefs);
    assert.deepEqual(formula.versions,normalization.output.reading.versions);
    assert.ok(formula.ingredients.every(ingredient => ingredient.quantityText === null));
    assert.ok(formula.limitations.includes('ingredient_concentrations_unknown'));
    assert.ok(formula.limitations.includes('reference_roles_not_finished_product_efficacy'));
  }
  assert.equal(count,43);
});

test('quantities and retained reference functions never become dose or efficacy assertions', () => {
  const normalization = ready('Glycerin 2% w/w, Niacinamide 4%, Unknown Extract');
  assert.equal(normalization.state,'ready'); if (normalization.state !== 'ready' || normalization.output.kind !== 'bound') throw Error('missing fixture');
  const formula = analyzeFormula(normalization,opts)!;
  assert.equal(formula.ingredients[0].quantityText,'2% w/w');
  assert.equal(formula.ingredients[1].quantityText,null);
  assert.deepEqual(formula.ingredients.map(ingredient => ingredient.occurrence.quantities),normalization.output.reading.occurrences.map(occurrence => occurrence.quantities));
  assert.equal(formula.ingredients[2].card,null);
  assert.deepEqual(formula.facts,normalization.output.productFacts.facts);
  assert.ok(formula.facts.some(fact => fact.kind === 'reference_function'));
  assert.ok(formula.limitations.includes('ingredient_concentrations_unknown'));
});

test('conditional, disputed and ambiguous reading entries stay unresolved at the formula boundary', () => {
  const source = sourceReading('Niacinamide'); source.sections[0].transcription = 'uncertain';
  const uncertain = normalize(source,LOCAL_DICTIONARY_RELEASE,p2metadata);
  assert.equal(analyzeFormula(uncertain,opts)?.ingredients[0].card,null);
  const normalization = ready('May contain: Niacinamide, Glycerin',false);
  const formula = analyzeFormula(normalization,opts)!;
  assert.ok(formula.ingredients.every(ingredient => ingredient.modality === 'may_contain'));
  assert.ok(formula.limitations.includes('reading_only_not_product_presence'));
  const ambiguous = structuredClone(ready('Niacinamide'));
  if (ambiguous.state !== 'ready' || ambiguous.output.kind !== 'bound') throw Error('missing fixture');
  for (const snapshot of [ambiguous.output.reading,ambiguous.output.productFacts]) {
    snapshot.occurrences[0].mapping = {state:'ambiguous',candidateIds:['niacinamide','glycerin']};
    snapshot.facts = snapshot.facts.filter(fact => fact.kind !== 'resolved_ingredient_identity');
  }
  assert.equal(analyzeFormula(ambiguous,opts)?.ingredients[0].card,null);
});

test('formula refuses stale, withdrawn, foreign binding or tampered normalization', () => {
  const normalization = ready('Niacinamide');
  assert.equal(analyzeFormula(normalization,{now:p2expiry}),null);
  assert.equal(analyzeFormula(normalization,{...opts,withdrawnDependencies:[pack.version]}),null);
  assert.equal(analyzeFormula(normalization,{...opts,expectedBinding:{bindingKey:'foreign',resultRevision:1,dependencyDigest:'a'.repeat(64)}}),null);
  const tampered = structuredClone(normalization); if (tampered.state !== 'ready') throw Error('missing fixture');
  tampered.output.reading.occurrences[0].observedName = 'Glycerin';
  assert.equal(analyzeFormula(tampered,opts),null);
});

test('group and alternative quantities remain literal without constituent amount or identity inference', () => {
  for (const raw of ['Glycerin + Water 2% w/w','Retinol or Retinyl Palmitate 20 mg/g']) {
    const normalization = ready(raw,false); assert.equal(normalization.state,'ready');
    if (normalization.state !== 'ready') throw Error('missing fixture');
    const formula = analyzeFormula(normalization,opts)!;
    assert.deepEqual(formula.ingredients.map(ingredient => ingredient.occurrence),normalization.output.reading.occurrences);
    assert.ok(formula.ingredients.every(ingredient => ingredient.quantityText === null));
    assert.ok(formula.limitations.includes('ingredient_concentrations_unknown'));
  }
});
