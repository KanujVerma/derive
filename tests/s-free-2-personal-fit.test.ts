import assert from 'node:assert/strict';
import test from 'node:test';
import type { FreeSkinProfileInput } from '../src/contracts/FreePersonalFit.ts';
import { getFreeSkinProfile, getPersonalFit, saveFreeSkinProfile } from '../src/services/remote/freePersonalFit.ts';
import { determinePersonalFit, parseFreePersonalFitRequest } from '../supabase/functions/free-personal-fit/fit.ts';

const profile: FreeSkinProfileInput = {
  goals: ['dryness'], skinBehavior: 'dry_tight', reactivity: 'generally_tolerates',
  pregnancyStatus: 'no', sensitivitiesStatus: 'none_known', knownSensitivities: [],
  treatmentStatus: 'none', currentTreatments: [],
};
const formula = {
  productId: 'f1200000-0000-4000-8000-000000000001',
  variantId: 'f1300000-0000-4000-8000-000000000001',
  formulaVersionId: 'f1400000-0000-4000-8000-000000000001',
  category: 'moisturizer', ingredients: ['Water', 'Glycerin'],
};

test('S-FREE-2: strict profile request preserves unknown safety states', () => {
  const unknown: FreeSkinProfileInput = { ...profile, pregnancyStatus: 'prefer_not_to_say',
    sensitivitiesStatus: 'unanswered', treatmentStatus: 'unanswered' };
  assert.deepEqual(parseFreePersonalFitRequest({ operation: 'save_profile', profile: unknown }), {
    operation: 'save_profile', profile: unknown,
  });
  assert.deepEqual(parseFreePersonalFitRequest({ operation: 'fit', productId: formula.productId }), {
    operation: 'fit', productId: formula.productId,
  });
  for (const bad of [
    { ...profile, pregnancyStatus: 'maybe' },
    { ...profile, goals: ['dryness', 'dryness'] },
    { ...profile, goals: ['dryness', 'breakouts', 'redness', 'texture'] },
    { ...profile, sensitivitiesStatus: 'reported' },
    { ...profile, knownSensitivities: ['Fragrance'] },
    { ...profile, treatmentStatus: 'reported' },
    { ...profile, currentTreatments: ['topical_retinoid'] },
    { ...profile, updatedAt: 'client cannot choose this' },
  ]) assert.throws(() => parseFreePersonalFitRequest({ operation: 'save_profile', profile: bad }));
  assert.throws(() => parseFreePersonalFitRequest({ operation: 'fit', productId: formula.productId, userId: 'other' }));
});

test('S-FREE-2: absent profile or exact verified formula fails closed', () => {
  assert.equal(determinePersonalFit(null, formula).reason, 'profile_missing');
  const unknown = determinePersonalFit(profile, { ...formula, formulaVersionId: null, ingredients: null });
  assert.equal(unknown.label, 'NOT_ENOUGH_INFORMATION');
  assert.equal(unknown.reason, 'formula_unverified');
  assert.deepEqual(unknown.missingEvidence, ['verified_variant_formula']);
  assert.equal(determinePersonalFit(profile, { ...formula, variantId: null }).label, 'NOT_ENOUGH_INFORMATION');
});

test('S-FREE-2: exact reported ingredient overlap warns without inventing allergy causation', () => {
  const reported: FreeSkinProfileInput = { ...profile, sensitivitiesStatus: 'reported', knownSensitivities: [' Glycerin '] };
  const match = determinePersonalFit(reported, formula);
  assert.equal(match.label, 'USE_WITH_CAUTION');
  assert.equal(match.reason, 'reported_ingredient_sensitivity');
  assert.ok(!match.explanation.includes('allergic to'));
  const substring = determinePersonalFit({ ...reported, knownSensitivities: ['Glycer'] }, formula);
  assert.equal(substring.reason, 'sensitivity_unresolved');
  assert.equal(substring.label, 'NOT_ENOUGH_INFORMATION');
});

test('S-FREE-2: retinoid context never yields an unqualified positive label', () => {
  const withRetinol = { ...formula, ingredients: ['Water', 'Retinol'] };
  const pregnant = determinePersonalFit({ ...profile, pregnancyStatus: 'yes' }, withRetinol);
  assert.equal(pregnant.reason, 'retinoid_pregnancy_context');
  assert.equal(pregnant.label, 'USE_WITH_CAUTION');
  assert.equal(pregnant.sources.length, 1);
  const combined = determinePersonalFit({ ...profile, pregnancyStatus: 'yes',
    sensitivitiesStatus: 'reported', knownSensitivities: ['Retinol'] }, withRetinol);
  assert.equal(combined.reason, 'multiple_cautions');
  assert.ok(combined.evidenceUsed.includes('user_reported_sensitivity'));
  for (const state of ['unanswered', 'prefer_not_to_say'] as const) {
    const result = determinePersonalFit({ ...profile, pregnancyStatus: state }, withRetinol);
    assert.equal(result.label, 'NOT_ENOUGH_INFORMATION');
    assert.equal(result.reason, 'profile_context_missing');
  }
  const overlap = determinePersonalFit({ ...profile, treatmentStatus: 'reported', currentTreatments: ['topical_retinoid'] }, withRetinol);
  assert.equal(overlap.reason, 'active_overlap');
  assert.equal(determinePersonalFit({ ...profile, reactivity: 'reacts_easily' }, withRetinol).reason, 'reactive_active');
  const unknownTreatment = determinePersonalFit({ ...profile, treatmentStatus: 'unanswered' }, withRetinol);
  assert.equal(unknownTreatment.label, 'NOT_ENOUGH_INFORMATION');
  assert.ok(unknownTreatment.missingEvidence.includes('current_treatments'));
  const annotated = determinePersonalFit({ ...profile, pregnancyStatus: 'yes' },
    { ...formula, ingredients: ['Water', 'Retinol (0.3%)'] });
  assert.equal(annotated.reason, 'retinoid_pregnancy_context');
});

test('S-FREE-2: narrow role match and unsupported cases are distinct', () => {
  const match = determinePersonalFit(profile, formula);
  assert.equal(match.label, 'COULD_WORK');
  assert.deepEqual(match.evidenceUsed, [`verified_formula:${formula.formulaVersionId}`, 'verified_product_category', 'reported_goal', 'reported_skin_behavior']);
  assert.ok(match.missingEvidence.includes('individual_tolerance'));
  assert.equal(determinePersonalFit(profile, { ...formula, category: 'serum' }).label, 'NOT_ENOUGH_INFORMATION');
  assert.equal(determinePersonalFit({ ...profile, skinBehavior: 'comfortable' }, formula).label, 'NOT_ENOUGH_INFORMATION');
  assert.equal(determinePersonalFit({ ...profile, goals: [] }, formula).label, 'NOT_ENOUGH_INFORMATION');
});

test('S-FREE-2: remote wrapper only accepts shaped responses', async () => {
  const client = (response: unknown) => ({ functions: { invoke: async (name: string) => {
    assert.equal(name, 'free-personal-fit');
    return { data: response, error: null };
  } } });
  assert.equal(await getFreeSkinProfile(client({ profile: null })), null);
  const saved = { ...profile, updatedAt: '2026-09-23T00:00:00Z' };
  assert.deepEqual(await saveFreeSkinProfile(profile, client({ profile: saved })), saved);
  await assert.rejects(getPersonalFit(formula.productId, formula.variantId, client({ fit: { label: 'GREAT_FIT' } })), /unavailable/);
});
