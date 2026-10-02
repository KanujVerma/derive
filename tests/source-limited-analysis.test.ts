import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import type { PersonalContextSnapshot, PersonalProfileInput } from '../src/contracts/PersonalContext.ts';
import { buildSourceLimitedAnalysis, classifySourceLimitedProduct } from '../src/presentation/personal-decision/sourceLimitedAnalysis.ts';

const profile: PersonalProfileInput = { intent: 'unanswered', primaryGoal: null, secondaryGoals: [], skinBehavior: 'comfortable', reactivity: 'generally_tolerates',
  reproductive: { pregnancy: 'unanswered', nursing: 'unanswered', tryingToConceive: 'unanswered' },
  sensitivities: { status: 'unanswered', values: [] }, treatments: { status: 'unanswered', values: [] } };
function context(changes: Partial<PersonalProfileInput> = {}): PersonalContextSnapshot {
  return { version: 'personal-context-v1', ownerId: 'sam', revision: 2,
    profile: { id: 'p', ownerId: 'sam', revision: 2, recordedAt: '2026-10-01', provenance: 'self_report', supersedesRevisionId: null, data: { ...profile, ...changes } },
    routine: null, experiences: [], historyRevision: null, historyTruncated: false,
    legacy: { source: 'legacy_free_context', profile: null, products: [], experiences: [], truncated: false } };
}
const aveeno = { barcode: '0381370015314', name: 'Aveeno Stress Relief Body Lotion Lavender Scent 18 Fl oz', brand: 'Aveeno', size: '18 Fl oz' };
const oldSpice = { barcode: '0012044038840', name: 'Old Spice High Endurance Fresh Scent Deodorant for Men 3.0 Oz', brand: 'Old Spice', size: '3 oz' };
test('named skincare treatments remain supported without inferring an unknown gel or a shared routine role', () => {
  assert.equal(classifySourceLimitedProduct('Niacinamide Facial Serum'), 'skincare');
  assert.equal(classifySourceLimitedProduct('Salicylic Acid Acne Treatment'), 'skincare');
  assert.equal(classifySourceLimitedProduct('Facial Toner'), 'skincare');
  assert.equal(classifySourceLimitedProduct('Hair Serum'), 'other_personal_care');
  assert.equal(classifySourceLimitedProduct('Unknown Gel'), 'unsupported');
});
const analyze = (saved: PersonalContextSnapshot, query = aveeno, text: string | null = 'Water, Glycerin, Petrolatum, Fragrance') => buildSourceLimitedAnalysis({
  ownerId: 'sam', context: saved, query, lists: text ? [{ ingredientsText: text, sourceUrl: 'https://www.aveeno.com/product', sourceName: 'Manufacturer', retrievedAt: '2026-10-01' }] : [],
})!;
function reaction(saved: PersonalContextSnapshot, name: string) {
  saved.experiences.push({ id: 'history', ownerId: 'sam', revision: 2, recordedAt: '2026-10-01', provenance: 'self_report', supersedesRevisionId: null,
    data: { id: 'experience', reference: { kind: 'manual', name }, kind: 'reacted', occurred: { start: null, end: null }, useContext: null,
      symptoms: ['pit burns'], note: 'burning after use' } });
}

test('same lotion gives different reasons for dry and reactive profiles without inventing positive fit', () => {
  const dry = analyze(context({ primaryGoal: 'dryness', skinBehavior: 'dry_tight' }));
  const reactive = analyze(context({ reactivity: 'reacts_easily' }));
  assert.match(dry.verdict.findings.map(f => f.reason).join(' '), /Glycerin|Petrolatum/);
  assert.equal(dry.formulaVerified, false); assert.notEqual(dry.verdict.state, 'good');
  assert.equal(reactive.verdict.state, 'tradeoffs'); assert.match(reactive.verdict.reason, /fragrance.*reacts easily/i);
  assert.notEqual(dry.scopeKey, reactive.scopeKey);
});
test('Aqua Reef burning is used for Fresh without turning a same-brand report into an ingredient allergy', () => {
  const saved = context({ primaryGoal: 'dryness', skinBehavior: 'dry_tight' }); reaction(saved, 'Old Spice Aqua Reef deodorant');
  const result = analyze(saved, oldSpice, 'Water, Glycerin, Fragrance');
  assert.match(result.verdict.reason, /burning or stinging.*Aqua Reef.*different product/i);
  assert.equal(result.verdict.state, 'unknown');
  assert.match(result.verdict.findings.map(f => f.reason).join(' '), /facial skin goals do not establish/);
  assert.doesNotMatch(result.verdict.findings.map(f => f.reason).join(' '), /Glycerin helps|allergic to|fragrance caused/);
});
test('exact named product reaction is a caution even if ingredients are missing', () => {
  const saved = context(); reaction(saved, oldSpice.name);
  const result = analyze(saved, oldSpice, null);
  assert.equal(result.verdict.state, 'tradeoffs'); assert.match(result.verdict.reason, /reported a reaction to this named product/);
  assert.ok(result.verdict.findings.some(f => f.id === 'ingredients-missing'));
  assert.match(result.verdict.findings[0].limits.join(' '), /No ingredient allergy/);
});
test('earlier Free Context reaction observations remain useful but cannot establish formula identity', () => {
  const saved = context(); saved.legacy.experiences = [{ id: 'old', productName: 'Old Spice Aqua Reef', brand: 'Old Spice', kind: 'reacted', note: 'pit burns' }];
  assert.match(analyze(saved, oldSpice, null).verdict.reason, /Aqua Reef.*different product/);
});
test('legacy database product_name reports and either truncated-history flag remain visible and scoped', () => {
  const saved = context();
  saved.legacy.experiences = [{ id: 'old', product_name: 'Old Spice Aqua Reef', brand: 'Old Spice', kind: 'reacted', note: 'pit burns' }];
  const first = analyze(saved, oldSpice, null);
  assert.match(first.verdict.reason, /burning or stinging.*Aqua Reef.*different product/);
  saved.legacy.truncated = true;
  const legacyPartial = analyze(saved, oldSpice, null);
  assert.ok(legacyPartial.verdict.findings.some(f => f.id === 'history-partial'));
  assert.notEqual(first.scopeKey, legacyPartial.scopeKey);
  saved.legacy.truncated = false; saved.historyTruncated = true;
  const historyPartial = analyze(saved, oldSpice, null);
  assert.ok(historyPartial.verdict.findings.some(f => f.id === 'history-partial'));
  assert.notEqual(first.scopeKey, historyPartial.scopeKey);
});
test('bounded category classification retains generic skin cream and rejects oral, food and unidentified uses', () => {
  for (const name of ['CeraVe Cream', 'Aveeno body lotion', 'Face cleanser', 'Banana Boat SPF 50 sunscreen']) {
    assert.equal(classifySourceLimitedProduct(name), 'skincare', name);
  }
  for (const name of ['Old Spice Fresh deodorant', 'Shampoo', 'Hair conditioner']) {
    assert.equal(classifySourceLimitedProduct(name), 'other_personal_care', name);
  }
  for (const name of ['Crest toothpaste', 'Mouthwash', 'Monster energy drink', 'Ice cream', 'Cream soda', 'Laundry conditioner', 'Hair dryer', 'Brand product', '']) {
    assert.equal(classifySourceLimitedProduct(name), 'unsupported', name);
  }
});
test('oral, food and unknown identities never inherit facial moisture, breakout or reactivity advice', () => {
  for (const name of ['Crest Whitening Toothpaste', 'Cream soda', 'Unidentified brand product']) {
    const saved = context({ primaryGoal: 'breakouts', skinBehavior: 'dry_tight', reactivity: 'reacts_easily' });
    const result = analyze(saved, { ...aveeno, name }, 'Water, Glycerin, Fragrance, Salicylic Acid');
    assert.equal(result.verdict.state, 'unknown', name);
    assert.ok(result.verdict.findings.some(f => f.id === 'product-scope-limit'));
    assert.equal(result.verdict.findings.some(f => /^(ingredient-context|breakout-ingredient|goal-evidence-gap|routine-role)/.test(f.id)), false);
    assert.doesNotMatch(result.verdict.reason, /draw water|reacts easily|used in acne products/);
  }
  const cream = analyze(context({ skinBehavior: 'dry_tight' }), { ...aveeno, name: 'CeraVe Cream' }, 'Water, Glycerin');
  assert.match(cream.verdict.findings.map(f => f.reason).join(' '), /Glycerin helps draw water/);
});
test('UI derives category from the same bounded classifier before local comparison or cloud AI rendering', () => {
  const notes = readFileSync(new URL('../src/components/check/PersonalIngredientNotes.tsx', import.meta.url), 'utf8');
  const published = readFileSync(new URL('../src/components/check/PublishedProductIngredients.tsx', import.meta.url), 'utf8');
  assert.match(notes, /const category = classifySourceLimitedProduct\(query\?\.name \?\? productName\)/);
  assert.match(notes, /const results = contextReady && category !== 'unsupported'/);
  assert.match(notes, /const manual = contextReady && category !== 'unsupported'/);
  assert.match(notes, /category !== 'unsupported' && !missingProfile && results\.map/);
  assert.match(notes, /!lists\.length && category !== 'unsupported' &&/);
  assert.doesNotMatch(published, /category=\{/);
});
test('goals and named routine products change findings without assuming unrecorded ingredient overlap', () => {
  const saved = context({ primaryGoal: 'breakouts', secondaryGoals: ['texture'] });
  saved.routine = { id: 'r', ownerId: 'sam', revision: 2, recordedAt: 'today', provenance: 'self_report', supersedesRevisionId: null,
    data: { completeness: 'partial', items: [{ id: 'item', reference: { kind: 'manual', name: 'CeraVe moisturizer' }, state: 'current',
      timing: 'pm', frequency: { kind: 'unknown' }, startedOn: null, stoppedOn: null, duration: null }] } };
  const result = analyze(saved);
  assert.match(result.verdict.findings.find(f => f.id === 'goal-evidence-gap')!.reason, /primary goal is breakouts/);
  assert.match(result.verdict.findings.find(f => f.id === 'routine-role')!.reason, /replacement.*overlap has not been verified/);
  assert.equal(result.verdict.state, 'unknown');
});
test('conflicting source lists abstain and no cross-owner context is exposed', () => {
  const saved = context({ reactivity: 'reacts_easily' });
  const result = buildSourceLimitedAnalysis({ ownerId: 'sam', query: aveeno, context: saved,
    lists: [{ ingredientsText: 'Water, Fragrance' }, { ingredientsText: 'Water, Glycerin' }] })!;
  assert.equal(result.verdict.state, 'unknown'); assert.match(result.verdict.reason, /different ingredient lists/);
  assert.equal(buildSourceLimitedAnalysis({ ownerId: 'other', query: aveeno, context: saved, lists: [] }), null);
  saved.experiences.push({ ...context().profile!, data: { id: 'bad' } } as never);
  saved.experiences[0].ownerId = 'other'; assert.equal(analyze(saved), null);
});
test('owner, exact variant, evidence and context revisions bind analysis without invented scores or canonical packets', () => {
  const first = analyze(context()); const updated = context(); updated.revision++;
  assert.notEqual(first.scopeKey, analyze(updated).scopeKey);
  assert.notEqual(first.productKey, analyze(context(), { ...aveeno, name: 'Aveeno Unscented Lotion', size: '12 oz' }).productKey);
  assert.notEqual(first.scopeKey, analyze(context(), aveeno, 'Water, Petrolatum').scopeKey);
  assert.equal('score' in first, false); assert.equal('packet' in first, false);
});
test('single result surface receives automatic local analysis with stale owner and retry fences', () => {
  const notes = readFileSync(new URL('../src/components/check/PersonalIngredientNotes.tsx', import.meta.url), 'utf8');
  const published = readFileSync(new URL('../src/components/check/PublishedProductIngredients.tsx', import.meta.url), 'utf8');
  const fallback = readFileSync(new URL('../src/components/check/PrivateUpcFallback.tsx', import.meta.url), 'utf8');
  assert.match(notes, /buildSourceLimitedAnalysis/); assert.match(notes, /onAnalysis\(null\)/);
  assert.match(notes, /!onAnalysis && <IngredientFindings/);
  assert.match(published, /liveAnalysis\.current !== analysisScope/);
  assert.match(fallback, /verdict=\{verdict\}/); assert.match(fallback, /context\?\.revision === analysis\.contextRevision/);
});
