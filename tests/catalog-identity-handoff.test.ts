import assert from 'node:assert/strict';
import test from 'node:test';
import { assembleCanonicalContext } from '../supabase/functions/propose-routine/context.ts';
import { verifyCommittedCatalogIdentity, bindProposalToCommittedCatalog } from '../supabase/functions/propose-routine/catalog-identity.ts';

const catalogId = 'ef6b7fc6-fa95-47ec-a86b-edcf11a8ab66';

function intake(confirmedProducts: unknown[]) {
  return {
    primaryGoal: 'texture', routineComplexity: 'simple', costPreference: 'balanced',
    middayFeel: 'comfortable', safetyContext: { pregnancyStatus: 'no', sensitivitiesStatus: 'none_known' },
    confirmedProducts,
  };
}

test('committed intake context retains a selected catalog UUID and manual provenance', () => {
  const result = assembleCanonicalContext(null, intake([
    { id: catalogId, isCatalogStandard: true, brand: 'CeraVe', name: 'Renewing SA Cleanser', category: 'cleanser', keyActives: [] },
    { id: 'manual-1', isCatalogStandard: false, brand: 'Member Brand', name: 'Gentle Cream', category: 'moisturizer' },
  ]));
  assert.equal(result.valid, true);
  assert.equal(result.context?.confirmedProducts[0].submittedCatalogId, catalogId);
  assert.equal(result.context?.confirmedProducts[0].isCatalogStandard, true);
  assert.equal(result.context?.confirmedProducts[1].submittedCatalogId, undefined);
  assert.equal(result.context?.confirmedProducts[1].isCatalogStandard, false);
});

test('only a matching sourced catalog row can authorize the committed selection', () => {
  const raw = assembleCanonicalContext(null, intake([
    { id: catalogId, isCatalogStandard: true, brand: 'CeraVe', name: 'Renewing SA Cleanser', category: 'cleanser' },
    { id: 'manual-1', isCatalogStandard: false, brand: 'Member Brand', name: 'Gentle Cream', category: 'moisturizer' },
  ])).context!;
  const row = { id: catalogId, brand: 'CeraVe', name: 'Renewing SA Cleanser', category: 'cleanser', is_catalog_standard: true, catalog_verified_at: '2026-09-23T00:00:00Z' };
  const verified = verifyCommittedCatalogIdentity(raw, [row]);
  assert.equal(verified.confirmedProducts[0].catalogProductId, catalogId);
  assert.equal(verified.confirmedProducts[0].shelfRef, 'shelf-1');
  assert.equal(verified.confirmedProducts[1].catalogProductId, undefined);
  assert.equal(verified.confirmedProducts[1].shelfRef, 'shelf-2');
  assert.throws(() => verifyCommittedCatalogIdentity(raw, [{ ...row, name: 'A different cleanser' }]));
  assert.throws(() => verifyCommittedCatalogIdentity(raw, []));
});

function proposalWithRenamedSelection() {
  return {
    summarySentence: 'Keep the cleanser.', clarificationQuestions: [],
    catalogProducts: [
      { shelfRef: 'shelf-1', brand: 'CeraVe', name: 'SA Cleanser', category: 'cleanser', keyActives: [] },
      { brand: 'Member Brand', name: 'Gentle Cream', category: 'moisturizer', keyActives: [] },
    ],
    productDecisions: [
      { shelfRef: 'shelf-1', productId: 'a1100000-0000-4000-8000-000000000099', brand: 'CeraVe', productName: 'SA Cleanser', category: 'cleanser', action: 'KEEP', actionReason: 'Keep.' },
      { brand: 'Member Brand', productName: 'Gentle Cream', category: 'moisturizer', action: 'KEEP', actionReason: 'Keep.' },
    ],
    amSteps: [{ shelfRef: 'shelf-1', brand: 'CeraVe', productName: 'SA Cleanser', category: 'cleanser', order: 1, timing: 'am', amount: 'One pump', area: 'Face', days: [], purpose: 'Cleanse', whyChosen: 'Gentle wash.' }],
    pmSteps: [],
  } as any;
}

function verifiedIntake() {
  const raw = assembleCanonicalContext(null, intake([
    { id: catalogId, isCatalogStandard: true, brand: 'CeraVe', name: 'Renewing SA Cleanser', category: 'cleanser' },
    { id: 'manual-1', isCatalogStandard: false, brand: 'Member Brand', name: 'Gentle Cream', category: 'moisturizer' },
  ])).context!;
  return verifyCommittedCatalogIdentity(raw, [
    { id: catalogId, brand: 'CeraVe', name: 'Renewing SA Cleanser', category: 'cleanser', is_catalog_standard: true, catalog_verified_at: '2026-09-23T00:00:00Z' },
  ]);
}

test('provider wording cannot replace the committed catalog identity', () => {
  const bound = bindProposalToCommittedCatalog(proposalWithRenamedSelection(), verifiedIntake());
  assert.equal(bound.productDecisions[0].canonicalProductId, catalogId);
  assert.equal(bound.productDecisions[0].productName, 'Renewing SA Cleanser');
  assert.equal(bound.catalogProducts[0].canonicalProductId, catalogId);
  assert.equal(bound.catalogProducts[0].name, 'Renewing SA Cleanser');
  assert.equal(bound.amSteps[0].canonicalProductId, catalogId);
  assert.equal(bound.amSteps[0].productName, 'Renewing SA Cleanser');
  assert.equal(bound.productDecisions[1].canonicalProductId, undefined, 'manual product retains safe fallback');
});

test('cross-product reference substitution and missing references fail closed', () => {
  const swapped = proposalWithRenamedSelection();
  swapped.productDecisions[0].productName = 'Gentle Cream';
  swapped.productDecisions[0].brand = 'Member Brand';
  assert.throws(() => bindProposalToCommittedCatalog(swapped, verifiedIntake()));

  const missing = proposalWithRenamedSelection();
  delete missing.productDecisions[0].shelfRef;
  assert.throws(() => bindProposalToCommittedCatalog(missing, verifiedIntake()));

  const otherId = 'a1100000-0000-4000-8000-000000000002';
  const otherCatalog = proposalWithRenamedSelection();
  otherCatalog.catalogProducts[0].name = 'Other SA Cleanser';
  otherCatalog.productDecisions[0].productName = 'Other SA Cleanser';
  otherCatalog.amSteps[0].productName = 'Other SA Cleanser';
  assert.throws(() => bindProposalToCommittedCatalog(otherCatalog, verifiedIntake(), [
    { id: otherId, brand: 'CeraVe', name: 'Other SA Cleanser', category: 'cleanser', is_catalog_standard: true, catalog_verified_at: '2026-09-23T00:00:00Z' },
  ]));
});

test('provider receives an intake reference without a canonical UUID', async () => {
  const { buildGeminiPrompt } = await import('../supabase/functions/propose-routine/gemini-adapter.ts');
  const prompt = buildGeminiPrompt(verifiedIntake());
  assert.match(prompt, /shelf-1/);
  assert.doesNotMatch(prompt, new RegExp(catalogId));
  const { FixtureRoutineProvider } = await import('../supabase/functions/propose-routine/fixture-provider.ts');
  const proposal = await new FixtureRoutineProvider().generateProposal(verifiedIntake());
  assert.ok(proposal.productDecisions.some((decision) => decision.shelfRef === 'shelf-1'));
  assert.ok(proposal.catalogProducts.some((product) => product.shelfRef === 'shelf-1'));
  assert.ok([...proposal.amSteps, ...proposal.pmSteps].some((step) => step.shelfRef === 'shelf-1'));
});
