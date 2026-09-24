import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createPersonalizationDraft } from '../src/presentation/personalization/draft.ts';
import type { FreeSkinProfile } from '../src/contracts/FreePersonalFit.ts';

const mapping = await import('../src/presentation/personalization/mapping.ts').catch(() => ({} as Record<string, unknown>));

test('K2/S2 maps every presentation goal and behavior into the canonical profile', () => {
  assert.equal(typeof mapping.toFreeSkinProfileInput, 'function');
  const convert = mapping.toFreeSkinProfileInput as (draft: ReturnType<typeof createPersonalizationDraft>) => Record<string, unknown>;
  const pairs = [
    ['breakouts', 'breakouts'], ['dark_marks', 'dark_spots'], ['dryness_barrier', 'dryness'],
    ['redness_sensitivity', 'redness'], ['texture', 'texture'], ['oiliness', 'oiliness'],
    ['aging_fine_lines', 'fine_lines'], ['simplify', 'simplify'], ['maintain', 'maintain'],
  ] as const;
  for (const [presentation, canonical] of pairs) {
    assert.deepEqual(convert({ ...createPersonalizationDraft(), goals: [presentation] }).goals, [canonical]);
  }
  for (const [presentation, canonical] of [
    ['dry_tight', 'dry_tight'], ['balanced', 'comfortable'], ['combination', 'combination'],
    ['oily', 'oily_shiny'], ['unsure', 'unsure'],
  ] as const) {
    assert.equal(convert({ ...createPersonalizationDraft(), skinBehavior: presentation }).skinBehavior, canonical);
  }
});

test('K2/S2 preserves unanswered, explicit none, privacy choice, and reported ingredient names', () => {
  const convert = mapping.toFreeSkinProfileInput as (draft: ReturnType<typeof createPersonalizationDraft>) => Record<string, unknown>;
  assert.equal(typeof convert, 'function');
  const blank = convert(createPersonalizationDraft());
  assert.equal(blank.pregnancyStatus, 'unanswered');
  assert.equal(blank.sensitivitiesStatus, 'unanswered');
  assert.equal(blank.treatmentStatus, 'unanswered');
  assert.deepEqual(blank.currentTreatments, []);
  const explicit = convert({ ...createPersonalizationDraft(), pregnancy: 'prefer_not_to_say',
    sensitivityOrAllergy: 'no', treatmentStatus: 'none' });
  assert.equal(explicit.pregnancyStatus, 'prefer_not_to_say');
  assert.equal(explicit.sensitivitiesStatus, 'none_known');
  assert.equal(explicit.treatmentStatus, 'none');
  const reported = convert({ ...createPersonalizationDraft(), sensitivityOrAllergy: 'yes',
    knownSensitivities: [' Niacinamide ', 'Fragrance'], treatments: ['retinoids', 'acids'], treatmentStatus: 'reported' });
  assert.deepEqual(reported.knownSensitivities, ['Niacinamide', 'Fragrance']);
  assert.deepEqual(reported.currentTreatments, ['topical_retinoid', 'exfoliating_acid']);
  assert.throws(() => convert({ ...createPersonalizationDraft(), sensitivityOrAllergy: 'yes' }));
  assert.throws(() => convert({ ...createPersonalizationDraft(), treatmentStatus: 'reported' }));
});

test('K2/S2 loads a complete canonical snapshot without losing its supported vocabulary', () => {
  const convert = mapping.fromFreeSkinProfile as (profile: FreeSkinProfile) => ReturnType<typeof createPersonalizationDraft>;
  assert.equal(typeof convert, 'function');
  const profile: FreeSkinProfile = {
    goals: ['simplify', 'maintain', 'dark_spots'], skinBehavior: 'comfortable',
    reactivity: 'reacts_easily', pregnancyStatus: 'prefer_not_to_say',
    sensitivitiesStatus: 'reported', knownSensitivities: ['Fragrance'],
    treatmentStatus: 'reported', currentTreatments: ['topical_retinoid', 'exfoliating_acid'],
    updatedAt: '2026-09-24T00:00:00.000Z',
  };
  assert.deepEqual(convert(profile), { goals: ['simplify', 'maintain', 'dark_marks'],
    skinBehavior: 'balanced', reactivity: 'reacts_easily', pregnancy: 'prefer_not_to_say',
    sensitivityOrAllergy: 'yes', knownSensitivities: ['Fragrance'],
    treatmentStatus: 'reported', treatments: ['retinoids', 'acids'] });
});

test('K2/S2 pregnancy question matches the stored context and keeps all four answer states', () => {
  const flow = readFileSync(new URL('../src/components/personalization/PersonalizationFlow.tsx', import.meta.url), 'utf8');
  assert.match(flow, /Pregnant or nursing\?/);
  assert.doesNotMatch(flow, /trying to conceive/i);
  const convert = mapping.toFreeSkinProfileInput as (draft: ReturnType<typeof createPersonalizationDraft>) => Record<string, unknown>;
  for (const [answer, expected] of [
    [null, 'unanswered'], ['yes', 'yes'], ['no', 'no'], ['prefer_not_to_say', 'prefer_not_to_say'],
  ] as const) {
    assert.equal(convert({ ...createPersonalizationDraft(), pregnancy: answer }).pregnancyStatus, expected);
  }
});

test('K2/S2 sensitivity prompt asks for reported ingredient reactions', () => {
  const flow = readFileSync(new URL('../src/components/personalization/PersonalizationFlow.tsx', import.meta.url), 'utf8');
  assert.match(flow, /Known ingredient reactions/);
  assert.match(flow, /Which ingredients\?/);
  assert.doesNotMatch(flow, /Known sensitivity or allergy/);
});
