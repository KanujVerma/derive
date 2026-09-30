import assert from 'node:assert/strict';
import test from 'node:test';
import { profileToStorage } from '../src/presentation/p0b-personalization/storageAdapter.ts';
import { createContextDraft } from '../src/presentation/p0b-personalization/draft.ts';
import { addCurrentProduct, addSetupExperience, catalogFamilyReference, createSetupBundle, currentUseItem, experienceFromNotice, manualUnverifiedReference, removeSetupProduct, replaceSetupOwner, setAdditionalNote } from '../src/presentation/p0b-personalization/setup.ts';

const id = '00000000-0000-4000-8000-000000000010';

test('using-now products stay current and manual names stay unverified', () => {
  const manual = manualUnverifiedReference('My wash');
  assert.equal(manual.verification, 'unverified');
  const item = currentUseItem(id, manual);
  assert.equal(item.status, 'current');
  const catalog = catalogFamilyReference({ productId: 'p1', brand: 'CeraVe', name: 'Moisturizer' });
  assert.equal(catalog.variantId, null);
  assert.equal(catalog.formulaVersionId, null);
  let bundle = addCurrentProduct(createSetupBundle('owner'), item);
  bundle = addCurrentProduct(bundle, currentUseItem(id, manual));
  assert.equal(bundle.products.length, 1);
  bundle = addCurrentProduct(bundle, { ...currentUseItem('00000000-0000-4000-8000-000000000011', catalog), status: 'paused' });
  assert.equal(bundle.products.length, 1, 'a non-current status is not saved from this stage');
  bundle = removeSetupProduct(bundle, id);
  assert.equal(bundle.products.length, 0);
});

test('product notices keep canonical kinds and do not invent an allergy', () => {
  const reference = manualUnverifiedReference('Acid wash');
  const irritated = experienceFromNotice(id, reference, 'irritated');
  const brokeOut = experienceFromNotice(id, reference, 'broke_out');
  const drying = experienceFromNotice(id, reference, 'too_drying');
  assert.equal(irritated.kind, 'reacted');
  assert.deepEqual(irritated.symptoms, []);
  assert.equal(brokeOut.kind, 'reacted');
  assert.deepEqual(brokeOut.symptoms, ['Breakouts']);
  assert.equal(drying.kind, 'reacted');
  assert.deepEqual(drying.symptoms, ['Dryness']);
  assert.equal(experienceFromNotice(id, reference, 'didnt_help').kind, 'ineffective');
  assert.equal(experienceFromNotice(id, reference, 'liked').kind, 'liked');
  const bundle = addSetupExperience(createSetupBundle(), brokeOut);
  assert.equal(bundle.experiences[0].symptoms.join(' '), 'Breakouts');
  assert.equal(JSON.stringify(bundle).includes('allergy'), false);
});

test('an extra note stays raw context and an owner change drops the draft', () => {
  const profile = createContextDraft();
  profile.behavior = { state: 'answered', value: 'dry_tight' };
  profile.reactivity = { state: 'answered', value: 'reacts_easily' };
  const stored = profileToStorage(profile);
  assert.equal('additionalNote' in stored, false);
  let bundle = setAdditionalNote(createSetupBundle('a'), '  I use a prescription sometimes  ');
  assert.equal(bundle.additionalNote, 'I use a prescription sometimes');
  bundle = setAdditionalNote(bundle, '   ');
  assert.equal(bundle.additionalNote, null);
  const filled = addCurrentProduct(createSetupBundle('a'), currentUseItem(id, manualUnverifiedReference('Cream')));
  assert.equal(replaceSetupOwner(filled, 'b').products.length, 0);
  assert.equal(replaceSetupOwner(filled, 'a').products.length, 1);
});

test('the same product reaches different supported context for two personas', () => {
  const reactive = createContextDraft();
  reactive.primaryGoal = { state: 'answered', value: 'dryness' };
  reactive.behavior = { state: 'answered', value: 'dry_tight' };
  reactive.reactivity = { state: 'answered', value: 'reacts_easily' };
  const tolerant = createContextDraft();
  tolerant.primaryGoal = { state: 'answered', value: 'oiliness' };
  tolerant.behavior = { state: 'answered', value: 'oily' };
  tolerant.reactivity = { state: 'answered', value: 'generally_tolerates' };
  const left = profileToStorage(reactive);
  const right = profileToStorage(tolerant);
  assert.equal(left.skinBehavior, 'dry_tight');
  assert.equal(left.reactivity, 'reacts_easily');
  assert.equal(right.skinBehavior, 'oily_shiny');
  assert.equal(right.reactivity, 'generally_tolerates');
  const history = experienceFromNotice(id, catalogFamilyReference({ productId: 'wash', brand: 'Brand', name: 'Wash' }), 'irritated');
  assert.equal(history.kind, 'reacted');
  assert.equal(history.reference.kind === 'catalog' && history.reference.formulaVersionId, null);
});
