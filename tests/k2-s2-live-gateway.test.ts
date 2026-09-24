import assert from 'node:assert/strict';
import test from 'node:test';
import { createPersonalizationDraft } from '../src/presentation/personalization/draft.ts';
import type { FreeSkinProfile, PersonalFitResult } from '../src/contracts/FreePersonalFit.ts';

const live = await import('../src/presentation/personalization/liveGateway.ts').catch(() => ({} as Record<string, unknown>));
const profile: FreeSkinProfile = {
  goals: ['dryness'], skinBehavior: 'dry_tight', reactivity: 'unsure',
  pregnancyStatus: 'prefer_not_to_say', sensitivitiesStatus: 'reported',
  knownSensitivities: ['Fragrance'], treatmentStatus: 'none', currentTreatments: [],
  updatedAt: '2026-09-24T00:00:00Z',
};
const fit: PersonalFitResult = {
  productId: 'p1', variantId: 'v1', formulaVersionId: 'f1', label: 'COULD_WORK',
  reason: 'goal_role_match', explanation: 'This verified moisturizer could support your dryness goal.',
  evidenceUsed: ['verified_formula:f1', 'dryness_goal'], missingEvidence: [], sources: [],
};

test('K2/S2 loads an existing owner profile, replaces it, and clears status on owner change', async () => {
  assert.equal(typeof live.createLivePersonalizationGateway, 'function');
  let stored: FreeSkinProfile | null = profile;
  const calls: string[] = [];
  const gateway = (live.createLivePersonalizationGateway as Function)({
    getFreeSkinProfile: async () => { calls.push('load'); return stored; },
    saveFreeSkinProfile: async (input: Omit<FreeSkinProfile, 'updatedAt'>) => {
      calls.push('save'); stored = { ...input, updatedAt: profile.updatedAt }; return stored;
    },
    getPersonalFit: async () => fit,
  });
  const loaded = await gateway.loadProfile('owner-A');
  assert.equal(loaded.kind, 'ready');
  assert.equal(loaded.scope, 'owner_bound');
  assert.deepEqual(loaded.profile.knownSensitivities, ['Fragrance']);
  const draft = { ...createPersonalizationDraft(loaded.profile), goals: ['breakouts'], pregnancy: 'no' };
  assert.deepEqual(await gateway.saveProfile('owner-A', draft), { kind: 'ready', scope: 'owner_bound' });
  assert.deepEqual(stored?.goals, ['breakouts']);
  assert.equal(stored?.pregnancyStatus, 'no');
  assert.deepEqual(calls, ['load', 'save']);
  assert.equal(gateway.lastSaveStatus('owner-A')?.kind, 'ready');
  assert.equal(gateway.lastSaveStatus('owner-B'), null);
});

test('K2/S2 never creates a profile for no owner or a skipped editor', async () => {
  assert.equal(typeof live.createLivePersonalizationGateway, 'function');
  let saves = 0;
  const gateway = (live.createLivePersonalizationGateway as Function)({
    getFreeSkinProfile: async () => null,
    saveFreeSkinProfile: async () => { saves++; return profile; },
    getPersonalFit: async () => fit,
  });
  assert.deepEqual(await gateway.loadProfile('owner-A'), { kind: 'empty' });
  assert.equal(gateway.lastSaveStatus('owner-A'), null);
  assert.equal((await gateway.saveProfile(null, createPersonalizationDraft())).kind, 'unavailable');
  assert.equal(saves, 0);
});

test('K2/S2 requests authoritative fit with exact variant and maps unknown without local promotion', async () => {
  assert.equal(typeof live.createLivePersonalizationGateway, 'function');
  const targets: unknown[][] = [];
  const gateway = (live.createLivePersonalizationGateway as Function)({
    getFreeSkinProfile: async () => profile,
    saveFreeSkinProfile: async () => profile,
    getPersonalFit: async (...args: unknown[]) => { targets.push(args); return targets.length === 1 ? fit : {
      ...fit, variantId: null, formulaVersionId: null,
      label: 'NOT_ENOUGH_INFORMATION', reason: 'formula_unverified',
      explanation: 'We cannot assess personal fit until this exact product formula is verified.',
      evidenceUsed: [], missingEvidence: ['verified_variant_formula'],
    }; },
  });
  assert.deepEqual(await gateway.getFit('owner-A', 'p1', 'v1'), {
    kind: 'supported', fit: { label: 'COULD WORK', explanation: fit.explanation,
      evidenceUsed: [], uncertainty: null },
  });
  assert.deepEqual(await gateway.getFit('owner-A', 'p1'), {
    kind: 'insufficient', message: 'We cannot assess personal fit until this exact product formula is verified.',
  });
  assert.deepEqual(targets, [['p1', 'v1'], ['p1', undefined]]);
  assert.equal((await gateway.getFit(null, 'p1', 'v1')).kind, 'unavailable');
  assert.equal(targets.length, 2);
});

test('K2/S2 does not carry an in-flight save status across an Auth owner change', async () => {
  let finishSave: ((value: FreeSkinProfile) => void) | undefined;
  const gateway = (live.createLivePersonalizationGateway as Function)({
    getFreeSkinProfile: async () => null,
    saveFreeSkinProfile: () => new Promise<FreeSkinProfile>((resolve) => { finishSave = resolve; }),
    getPersonalFit: async () => fit,
  });
  const pending = gateway.saveProfile('owner-A', createPersonalizationDraft());
  assert.equal(gateway.lastSaveStatus('owner-B'), null);
  finishSave?.(profile);
  await pending;
  assert.equal(gateway.lastSaveStatus('owner-B'), null);
});
