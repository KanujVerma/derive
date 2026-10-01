import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import type { PersonalContextSnapshot, PersonalProfileInput } from '../src/contracts/PersonalContext.ts';
import type { PublishedIngredientEvidence } from '../src/contracts/ProductIngredientLookup.ts';
import { buildPersonalIngredientInsights } from '../src/presentation/external-products/personalIngredientInsights.ts';

const profile: PersonalProfileInput = { intent: 'unanswered', primaryGoal: null, secondaryGoals: [], skinBehavior: 'comfortable',
  reactivity: 'generally_tolerates', reproductive: { pregnancy: 'unanswered', tryingToConceive: 'unanswered', nursing: 'unanswered' },
  treatments: { status: 'unanswered', values: [] }, sensitivities: { status: 'unanswered', values: [] } };
const context = (changes: Partial<PersonalProfileInput> = {}): PersonalContextSnapshot => ({
  version: 'personal-context-v1', ownerId: 'owner', revision: 1, profile: { id: 'p', ownerId: 'owner', revision: 1,
    recordedAt: '2026-09-30', provenance: 'self_report', supersedesRevisionId: null, data: { ...profile, ...changes } },
  routine: null, experiences: [], historyTruncated: false, historyRevision: null,
  legacy: { source: 'legacy_free_context', profile: null, products: [], experiences: [], truncated: false },
});
const evidence = (ingredientsText: string): PublishedIngredientEvidence => ({
  source: 'open_beauty_facts', sourceUrl: 'https://world.openbeautyfacts.org/product/036000291452', sourceLicense: 'ODbL-1.0',
  retrievedAt: '2026-09-30T00:00:00Z', sourceModifiedAt: null, barcode: '036000291452', productName: 'Example lotion',
  brand: 'Example', quantity: null, ingredientsText, matchBasis: 'barcode', formulaVerified: false, canonicalProductId: null,
});

test('dry skin notes explain relevant moisturizer ingredients with full sentences and source uncertainty', () => {
  const result = buildPersonalIngredientInsights(context({ skinBehavior: 'dry_tight' }), [evidence('Water, Glycerin, Petrolatum')]);
  assert.equal(result.status, 'ready'); assert.equal(result.basis, 'local_rules');
  assert.deepEqual(result.ingredientNames, ['Glycerin', 'Petrolatum']);
  assert.match(result.sentences.join(' '), /reported dryness or tightness/);
  assert.match(result.sentences.join(' '), /finished product/);
  assert.match(result.sentences.join(' '), /unverified published list/);
  assert.ok(result.sentences.every((sentence) => sentence.endsWith('.')));
  assert.equal('score' in result, false);
});

test('reactive skin fragrance and denatured alcohol notes are cautions, not predicted reactions', () => {
  const result = buildPersonalIngredientInsights(context({ reactivity: 'reacts_easily' }), [evidence('Water, Parfum, Alcohol Denat.')]);
  assert.deepEqual(result.ingredientNames, ['Fragrance', 'Alcohol denat.']);
  assert.match(result.sentences.join(' '), /reported that your skin reacts easily/);
  assert.match(result.sentences.join(' '), /not proof/);
  assert.match(result.sentences.join(' '), /concentration and the full formula matter/);
  assert.match(result.sentences.join(' '), /do not identify the cause of a past reaction/);
});

test('missing ingredients and profiles have distinct actionable states and owner mismatch hides personalization', () => {
  assert.equal(buildPersonalIngredientInsights(context(), []).status, 'ingredients_missing');
  assert.equal(buildPersonalIngredientInsights(context(), [evidence(' ')]).status, 'ingredients_missing');
  assert.equal(buildPersonalIngredientInsights(null, [evidence('Glycerin')]).status, 'profile_missing');
  const noProfile = context(); noProfile.profile = null;
  assert.equal(buildPersonalIngredientInsights(noProfile, [evidence('Glycerin')]).status, 'profile_missing');
  const wrongOwner = context(); wrongOwner.profile!.ownerId = 'other';
  assert.equal(buildPersonalIngredientInsights(wrongOwner, [evidence('Glycerin')]).status, 'profile_missing');
});

test('lexical matches do not treat claims, substrings or fatty alcohols as exact ingredient names', () => {
  const result = buildPersonalIngredientInsights(context({ skinBehavior: 'dry_tight', reactivity: 'reacts_easily' }), [
    evidence('Fragrance-free, polyglycerin-3, cetyl alcohol, cetearyl alcohol, isopetrolatum, sodium glycerinate'),
  ]);
  assert.deepEqual(result.ingredientNames, []);
  assert.match(result.sentences[0], /not a compatibility verdict/);
});

test('dryness goal supports bounded notes but absent ingredient flags are never safety clearance', () => {
  const result = buildPersonalIngredientInsights(context({ primaryGoal: 'dryness' }), [evidence('Inactive ingredients: glycerin, dimethicone, sodium hyaluronate')]);
  assert.deepEqual(result.ingredientNames, ['Glycerin', 'Dimethicone', 'Hyaluronic acid']);
  assert.match(result.sentences[0], /reported dryness/);
  const none = buildPersonalIngredientInsights(context({ reactivity: 'reacts_easily' }), [evidence('Water, Sodium chloride')]);
  assert.match(none.sentences[0], /does not mean the product is irritation-free/);
});

test('source lists are not combined into a fictional formula and input work is bounded', () => {
  const result = buildPersonalIngredientInsights(context({ reactivity: 'reacts_easily' }), [evidence('Glycerin'), evidence('Parfum')]);
  assert.deepEqual(result.ingredientNames, ['Glycerin']);
  assert.doesNotMatch(result.sentences.join(' '), /list includes fragrance/);
  assert.equal(buildPersonalIngredientInsights(context(), [evidence('x'.repeat(24_001))]).status, 'ingredients_missing');
});

test('medical disclosures and past-reaction contents neither alter nor enter ingredient notes', () => {
  const baseline = buildPersonalIngredientInsights(context({ skinBehavior: 'dry_tight' }), [evidence('Glycerin, Parfum')]);
  const privateContext = context({ skinBehavior: 'dry_tight', reproductive: { pregnancy: 'yes', tryingToConceive: 'yes', nursing: 'yes' },
    treatments: { status: 'reported', values: ['other_prescription'] }, sensitivities: { status: 'reported', values: ['SECRET_ALLERGY'] } });
  Object.defineProperty(privateContext, 'experiences', { get: () => { throw new Error('history must not be read'); } });
  assert.deepEqual(buildPersonalIngredientInsights(privateContext, [evidence('Glycerin, Parfum')]), baseline);
  const source = readFileSync(new URL('../src/presentation/external-products/personalIngredientInsights.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /fetch\(|GEMINI|\.experiences|\.reproductive|\.treatments|\.sensitivities|analytics\./);
});

test('user-pasted labels receive truthful local source wording without fabricated published metadata', () => {
  const result = buildPersonalIngredientInsights(context({ skinBehavior: 'dry_tight', reactivity: 'reacts_easily' }),
    [{ ingredientsText: 'Water, Glycerin, Parfum' }], 'user_label');
  assert.equal(result.status, 'ready');
  assert.match(result.sentences.join(' '), /ingredient text you pasted/);
  assert.doesNotMatch(result.sentences.join(' '), /published list/);
  assert.match(result.sentences.join(' '), /not a formula verified by Derive/);
});

test('other personal care ignores facial dryness goals/type while retaining general reactivity', () => {
  const facial = context({ primaryGoal: 'dryness', skinBehavior: 'dry_tight' });
  const before = JSON.stringify(facial);
  const result = buildPersonalIngredientInsights(facial, [evidence('Glycerin, Parfum, Alcohol Denat.')],
    'published', 'other_personal_care');
  assert.equal(result.status, 'ready');
  assert.match(result.sentences[0], /no specific ingredient note/);
  assert.doesNotMatch(result.sentences.join(' '), /reported dryness|moisturizing formulas|finished product/);
  assert.equal(JSON.stringify(facial), before);

  const reactive = buildPersonalIngredientInsights(context({ primaryGoal: 'dryness', skinBehavior: 'dry_tight',
    reactivity: 'reacts_easily' }), [{ ingredientsText: 'Glycerin, Parfum, Alcohol Denat.' }],
  'user_label', 'other_personal_care');
  assert.match(reactive.sentences.join(' '), /reported that your skin reacts easily/);
  assert.match(reactive.sentences.join(' '), /ingredient text you pasted/);
  assert.doesNotMatch(reactive.sentences.join(' '), /reported dryness|moisturizing formulas|finished product/);
  assert.match(reactive.sentences.join(' '), /not proof that this product will irritate you/);
});

test('local notes UI scopes pasted state to owner and product and has no provider/persistence operations', () => {
  const source = readFileSync(new URL('../src/components/check/PersonalIngredientNotes.tsx', import.meta.url), 'utf8');
  assert.match(source, /useSyncExternalStore\(customerController.subscribe, customerController.getState\)/);
  assert.match(source, /JSON.stringify\(\[ownerId, identity\]\)/);
  assert.match(source, /pasted\?\.scope === scope/);
  assert.match(source, /useEffect\(\(\) => \{ setPasted\(null\); \}, \[scope\]\)/);
  assert.match(source, /currentCustomerOwner\(\) === ownerId/);
  assert.match(source, /maxLength=\{24_000\}/);
  assert.match(source, /buildPersonalIngredientInsights\(context, \[item\](?:, 'published', category)?\)/);
  assert.match(source, /'user_label'/);
  assert.doesNotMatch(source, /fetch\(|\.invoke\(|AsyncStorage|saveFreeProduct|GEMINI|\.experiences|analytics\./);
});
