import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import type { PersonalContextSnapshot, PersonalProfileInput } from '../src/contracts/PersonalContext.ts';
import { compareReactionIngredients, reactionProducts } from '../src/presentation/personal-decision/reactionIngredientComparison.ts';
import { buildSourceLimitedAnalysis } from '../src/presentation/personal-decision/sourceLimitedAnalysis.ts';
import { hasSupportedExplanationCue } from '../src/domain/ingredient-explanation-eligibility.ts';
const profile: PersonalProfileInput = { intent: 'unanswered', primaryGoal: 'redness', secondaryGoals: [],
  skinBehavior: 'comfortable', reactivity: 'generally_tolerates',
  reproductive: { pregnancy: 'unanswered', nursing: 'unanswered', tryingToConceive: 'unanswered' },
  sensitivities: { status: 'unanswered', values: [] }, treatments: { status: 'unanswered', values: [] } };
const context: PersonalContextSnapshot = { version: 'personal-context-v1', ownerId: 'sam', revision: 3,
  profile: { id: 'p', ownerId: 'sam', revision: 3, recordedAt: 'today', provenance: 'self_report', supersedesRevisionId: null, data: profile },
  routine: null, experiences: [], historyTruncated: false, historyRevision: null,
  legacy: { source: 'legacy_free_context', profile: null, products: [], truncated: false,
    experiences: [{ product_name: 'Old Spice Aqua Reef deodorant', kind: 'reacted', note: 'PRIVATE SYMPTOMS', brand: 'Old Spice' }] } };
const query = { barcode: '0012044038840', name: 'Old Spice High Endurance Fresh Deodorant', brand: 'Old Spice', size: '3 oz' };
const source = { productName: 'Old Spice Aqua Reef deodorant', ingredientsText: 'Water, Propylene Glycol, Parfum',
  sourceUrl: 'https://oldspice.com/products/aqua-reef', sourceName: 'Manufacturer', retrievedAt: '2026-10-01T00:00:00.000Z',
  basis: 'published_web' as const, formulaVerified: false as const };

test('history projection is bounded, deduplicated, private and correction aware', () => {
  assert.equal(JSON.stringify(reactionProducts(context, query)).includes('PRIVATE SYMPTOMS'), false);
  assert.equal(reactionProducts(context, query)[0].name, source.productName);
  const noSeparateBrand = structuredClone(context);
  delete noSeparateBrand.legacy.experiences[0].brand;
  assert.equal(reactionProducts(noSeparateBrand, query)[0].brand, 'Old Spice');
  const clone = structuredClone(context);
  clone.legacy.experiences.push({ productName: source.productName, kind: 'reacted' });
  assert.equal(reactionProducts(clone, query).length, 1);
  clone.legacy.experiences = Array.from({ length: 20 }, (_, i) => ({ product_name: `Brand product ${i} lotion`, kind: 'reacted' }));
  assert.equal(reactionProducts(clone, query).length, 2);
});
test('only explicit aliases match and shared fragrance is not an identical fragrance formula', () => {
  const result = compareReactionIngredients('Aqua, Glycerin, Fragrance', 'Water, Glycerol, Parfum, Citric Acid');
  assert.deepEqual(result.shared, ['Aqua', 'Glycerin', 'Fragrance']);
  assert.deepEqual(result.flagged, ['Fragrance']);
  assert.deepEqual(compareReactionIngredients('Water, Cetyl Alcohol', 'Water, Alcohol Denat.').flagged, []);
  assert.deepEqual(compareReactionIngredients('Water, Citric Acid', 'Water, Sodium Citrate').shared, ['Water']);
});
test('published reaction-product comparison names overlap, cites both lists and does not infer allergy', () => {
  const product = reactionProducts(context, query)[0];
  const result = buildSourceLimitedAnalysis({ ownerId: 'sam', query, context, lists: [{ ingredientsText: 'Water, Fragrance, Glycerin', sourceUrl: 'https://oldspice.com/products/fresh' }],
    reactionIngredients: [{ product, status: 'found', evidence: source }] })!;
  assert.equal(result.verdict.state, 'tradeoffs');
  assert.match(result.verdict.reason, /both include Fragrance/);
  assert.match(result.verdict.reason, /does not identify what caused/);
  const finding = result.verdict.findings.find(f => f.id.startsWith('reaction-ingredients-'))!;
  assert.equal(finding.evidence.length, 4);
  assert.ok(finding.evidence.some(e => e.detail.includes('fda.gov')));
  assert.match(finding.limits.join(' '), /different undisclosed mixtures/);
  assert.equal(result.formulaVerified, false);
});
test('no flagged overlap does not claim no irritants, no reaction or safety', () => {
  const result = buildSourceLimitedAnalysis({ ownerId: 'sam', query, context, lists: [{ ingredientsText: 'Water, Glycerin' }],
    reactionIngredients: [{ product: reactionProducts(context, query)[0], status: 'found', evidence: source }] })!;
  const reason = result.verdict.findings.find(f => f.id.startsWith('reaction-ingredients-'))!.reason;
  assert.match(reason, /did not find shared entries in our current research flags/);
  assert.match(reason, /does not rule out other triggers/);
  assert.doesNotMatch(reason, /no irritants|will not react|safe for you/);
});
test('missing or conflicting formulas never imply absence of shared triggers', () => {
  const initial = buildSourceLimitedAnalysis({ ownerId: 'sam', query, context, lists: [{ ingredientsText: 'Water, Fragrance' }] })!;
  const missingReason = initial.verdict.findings.find(f => f.id.startsWith('reaction-comparison-'))!.reason;
  assert.match(missingReason, /ingredient overlap cannot be assessed without both lists/);
  assert.doesNotMatch(missingReason, /includes its type and variant/);
  const conflicting = buildSourceLimitedAnalysis({ ownerId: 'sam', query, context,
    lists: [{ ingredientsText: 'Water, Fragrance' }, { ingredientsText: 'Water, Glycerin' }],
    reactionIngredients: [{ product: reactionProducts(context, query)[0], status: 'found', evidence: source }] })!;
  assert.equal(conflicting.verdict.findings.some(f => f.id.startsWith('reaction-ingredients-')), false);
  assert.equal(conflicting.verdict.state, 'unknown');
});
test('genuinely different remembered products request a choice rather than a manually expanded name', () => {
  const product = reactionProducts(context, query)[0];
  const result = buildSourceLimitedAnalysis({ ownerId: 'sam', query, context, lists: [{ ingredientsText: 'Water, Fragrance' }],
    reactionIngredients: [{ product, status: 'ambiguous', candidates: [
      { name: 'Old Spice Aqua Reef Deodorant', brand: 'Old Spice' },
      { name: 'Old Spice Aqua Reef Body Wash', brand: 'Old Spice' },
    ] }] })!;
  const reason = result.verdict.findings.find(f => f.id.startsWith('reaction-comparison-'))!.reason;
  assert.match(reason, /Choose the one you used in your saved product report/);
  assert.doesNotMatch(reason, /includes its type and variant|no shared triggers|safe for you/);
  assert.equal(result.verdict.findings.some(f => f.id.startsWith('reaction-ingredients-')), false);
});
test('a goal evidence gap is not neutral or proof of no worsening', () => {
  const result = buildSourceLimitedAnalysis({ ownerId: 'sam', query: { ...query, name: 'Aveeno Body Lotion', brand: 'Aveeno' }, context,
    lists: [{ ingredientsText: 'Water, Glycerin' }] })!;
  assert.equal(result.verdict.label, 'No clear goal match');
  assert.match(result.verdict.reason, /do not have product specific evidence/);
  assert.doesNotMatch(result.verdict.reason, /neutral|will not worsen|does not affect redness/);
  const missing = buildSourceLimitedAnalysis({ ownerId: 'sam', query, context, lists: [] })!;
  assert.equal(missing.verdict.label, 'Not enough information');
});
test('AI action is offered only for an eligible ingredient plus actual saved context', () => {
  const skin = { goals: ['redness' as const], skinBehavior: 'comfortable' as const, reactivity: 'generally_tolerates' as const };
  assert.equal(hasSupportedExplanationCue('Water, Glycerin, Fragrance', 'skincare', skin), false);
  assert.equal(hasSupportedExplanationCue('Water, Fragrance', 'skincare', { ...skin, reactivity: 'reacts_easily' }), true);
  assert.equal(hasSupportedExplanationCue('Water, Glycerin', 'skincare', { ...skin, goals: ['dryness'] }), true);
  assert.equal(hasSupportedExplanationCue('Water, Glycerin', 'other_personal_care', { ...skin, goals: ['dryness'] }), false);
  assert.equal(hasSupportedExplanationCue('Water, Fragrance', 'skincare', null), false);
});
test('client reaction lookup and AI scope cannot publish after owner, profile, product or unmount changes', () => {
  const hook = readFileSync(new URL('../src/components/check/useReactionIngredientComparison.ts', import.meta.url), 'utf8');
  assert.match(hook, /context\.revision, webProductIngredientKey\(query\)/);
  assert.match(hook, /context\?\.ownerId === ownerId && currentCustomerOwner\(\) === ownerId/);
  assert.match(hook, /reactionResearch\.record\(ownerId, product\)/);
  const runtime = readFileSync(new URL('../src/services/reactionIngredientResearch.ts', import.meta.url), 'utf8');
  assert.match(runtime, /name: product\.name, brand: product\.brand, size: null/);
  assert.match(runtime, /current\(\) && currentCustomerOwner\(\) === owner/);
  assert.doesNotMatch(hook, /symptoms|\.note|sendHistory/);
});
