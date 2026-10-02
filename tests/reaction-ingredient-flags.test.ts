import assert from 'node:assert/strict';
import test from 'node:test';
import { reactionIngredientFlags, REACTION_INGREDIENT_POLICY_VERSION } from '../src/domain/reactionIngredientFlags.ts';

test('exact entries produce source-attributed flags, not guessed causation', () => {
  const flags = reactionIngredientFlags('Water, Cocos Nucifera Water, Fragrance, Linalool, Glycerin');
  assert.deepEqual(flags.map(flag => flag.label), ['Fragrance', 'Linalool']);
  for (const flag of flags) {
    assert.equal(flag.kind, 'contact_allergen');
    assert.equal(flag.policyVersion, REACTION_INGREDIENT_POLICY_VERSION);
    assert.ok(flag.sources.some(source => source.url.startsWith('https://www.fda.gov/')));
    assert.match(flag.explanation, /does not (?:identify|establish)/);
    assert.doesNotMatch(flag.explanation, /probably caused|you are allergic|dangerous|toxic|safe for you|\d+%/i);
  }
});
test('fragrance aliases deduplicate while named allergens remain chemically distinct', () => {
  const flags = reactionIngredientFlags('Ingredients: Parfum, Fragrance, Perfume, Benzyl Alcohol, Cetyl Alcohol');
  assert.deepEqual(flags.map(flag => flag.label), ['Fragrance', 'Benzyl Alcohol']);
  assert.equal(flags[0].matchedLabel, 'Parfum');
  assert.deepEqual(reactionIngredientFlags('Fragrance (Parfum)').map(flag => flag.id), ['fragrance']);
});
test('preservatives and explicit formaldehyde releasers are bounded exact names', () => {
  const flags = reactionIngredientFlags('Water; Methylisothiazolinone; Methylchloroisothiazolinone; DMDM Hydantoin; Diazolidinyl Urea; Quaternium-15');
  assert.equal(flags.length, 5);
  assert.deepEqual(reactionIngredientFlags('Urea, Polyquaternium-10, Hydantoin, Sodium Glycinate'), []);
  assert.deepEqual(reactionIngredientFlags('2-bromo-2-nitropropane-1,3-diol').map(flag => flag.label), ['Bronopol']);
  assert.deepEqual(reactionIngredientFlags('5-bromo-5-nitro-1,3-dioxane').map(flag => flag.label), ['5-bromo-5-nitro-1,3-dioxane']);
});
test('propylene glycol has separate bounded evidence and no polymer generalization', () => {
  const flags = reactionIngredientFlags('Propylene Glycol, PPG-3 Myristyl Ether, PEG-40 Hydrogenated Castor Oil');
  assert.equal(flags.length, 1);
  assert.equal(flags[0].kind, 'irritation_potential');
  assert.match(flags[0].explanation, /patients referred for patch testing/);
  assert.equal(flags[0].sources[0].url, 'https://pubmed.ncbi.nlm.nih.gov/19321115/');
});
test('marketing negations, symptoms, substrings and unsupported natural ingredients are not flags', () => {
  for (const value of ['Fragrance-free, no parfum', 'No fragrance', 'No added fragrance',
    'Water, Fragrance free (Parfum)', 'This product without fragrance caused redness',
    'Coconut Water, Aloe Vera, Natural Gel', 'Cetyl Alcohol, Cetearyl Alcohol, Stearyl Alcohol',
    'Alcohol Denat., Ethanol, Phenoxyethanol', 'Methylisothiazolinone-free', 'Essential Oils']) {
    assert.deepEqual(reactionIngredientFlags(value), [], value);
  }
});
test('malformed, non-string and oversized input fail closed without claiming an all-clear', () => {
  for (const value of [null, undefined, 42, [], {}, 'Fragrance\x00', 'Fragrance (Parfum',
    'Fragrance), Water', `${'Water,'.repeat(257)}Fragrance`, 'Fragrance'.padEnd(12_001, ' ')]) {
    assert.deepEqual(reactionIngredientFlags(value), []);
  }
});
test('results cannot mutate the evidence policy or other calls', () => {
  const first = reactionIngredientFlags('Fragrance');
  first[0].sources[0].url = 'https://invalid.test/';
  assert.equal(reactionIngredientFlags('Fragrance')[0].sources[0].url, 'https://www.fda.gov/cosmetics/cosmetic-ingredients/allergens-cosmetics');
});
