import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createContributionDraft, validateContributionDraft, prepareContributionRequest,
  prepareContributionReview, type ContributionReviewAttempt,
} from '../src/presentation/catalog-contribution/draft.ts';

const REQUEST_ID = '33333333-3333-4333-8333-333333333333';
const EVIDENCE_ID = '44444444-4444-4444-8444-444444444444';

test('a missing product needs only brand and name, and preparation keeps explicit opt-in intent', () => {
  const draft = createContributionDraft({ brand: '  Example  ', name: '  Daily   Cream ' });
  const result = prepareContributionRequest(draft, REQUEST_ID);
  assert.deepEqual(result, { kind: 'ready', request: {
    version: 1, intent: 'help_add_product', requestId: REQUEST_ID,
    product: { brand: 'Example', name: 'Daily Cream' },
  } });
});

test('blank optional fields are absent, while exact observed barcode and details are retained', () => {
  const draft = createContributionDraft({ brand: 'Brand', name: 'Cream', gtin: '036000291452',
    variant: '  SPF 30 ', packageSize: ' 50 mL ', region: 'us',
  });
  const result = prepareContributionRequest(draft, REQUEST_ID);
  assert.equal(result.kind, 'ready');
  if (result.kind === 'ready') assert.deepEqual(result.request.product, {
    brand: 'Brand', name: 'Cream', gtin: '036000291452', variant: 'SPF 30', packageSize: '50 mL', region: 'US',
  });
});

test('missing names and malformed barcode stay in the draft with field-specific correction', () => {
  const draft = createContributionDraft({ brand: ' ', name: '', gtin: '036-000291452' });
  const errors = validateContributionDraft(draft);
  assert.equal(errors.brand, 'Add the brand.');
  assert.equal(errors.name, 'Add the product name.');
  assert.match(errors.gtin ?? '', /barcode/i);
  assert.equal(prepareContributionRequest(draft, REQUEST_ID).kind, 'invalid');
});

test('local photo URIs cannot become evidence references or a prepared request', () => {
  const draft = createContributionDraft({ brand: 'Brand', name: 'Cream',
    evidence: [{ evidenceId: 'file:///private/photo.jpg', role: 'front_label' }],
  });
  const result = prepareContributionRequest(draft, REQUEST_ID, { includePrivateEvidence: true });
  assert.equal(result.kind, 'invalid');
  if (result.kind === 'invalid') assert.match(result.errors.evidence ?? '', /photo/i);
});

test('private photo references are excluded until the customer explicitly includes them', () => {
  const draft = createContributionDraft({ brand: 'Brand', name: 'Cream',
    evidence: [{ evidenceId: EVIDENCE_ID, role: 'front_label' }],
  });
  const withoutPhotos = prepareContributionRequest(draft, REQUEST_ID);
  assert.equal(withoutPhotos.kind, 'ready');
  if (withoutPhotos.kind === 'ready') assert.equal(withoutPhotos.request.evidence, undefined);
  const result = prepareContributionRequest(draft, REQUEST_ID, { includePrivateEvidence: true });
  assert.equal(result.kind, 'ready');
  if (result.kind === 'ready') {
    assert.deepEqual(result.request.evidence, [{ evidenceId: EVIDENCE_ID, role: 'front_label' }]);
    assert.equal('ownerId' in result.request, false);
    assert.equal('imageReuseConsent' in result.request, false);
  }
});

test('invalid request IDs fail preparation without silently minting a different ID', () => {
  const result = prepareContributionRequest(createContributionDraft({ brand: 'Brand', name: 'Cream' }), 'retry');
  assert.equal(result.kind, 'invalid');
  if (result.kind === 'invalid') assert.match(result.errors.requestId ?? '', /request/i);
});

test('repeat review reuses one request ID for unchanged normalized details and rotates after a payload change', () => {
  const IDs = [
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
    '33333333-3333-4333-8333-333333333333',
  ];
  let next = 0;
  const mint = () => IDs[next++]!;
  const first = prepareContributionReview(createContributionDraft({ brand: ' Brand ', name: 'Cream' }), null, mint);
  assert.equal(first.kind, 'ready');
  if (first.kind !== 'ready') return;
  let attempt: ContributionReviewAttempt = first.attempt;
  assert.equal(first.request.requestId, IDs[0]);

  const repeated = prepareContributionReview(createContributionDraft({ brand: 'Brand', name: '  Cream  ' }), attempt, mint);
  assert.equal(repeated.kind, 'ready');
  if (repeated.kind !== 'ready') return;
  attempt = repeated.attempt;
  assert.equal(repeated.request.requestId, IDs[0]);
  assert.equal(next, 1);

  const changed = prepareContributionReview(createContributionDraft({ brand: 'Brand', name: 'Cream SPF 30' }), attempt, mint);
  assert.equal(changed.kind, 'ready');
  if (changed.kind !== 'ready') return;
  attempt = changed.attempt;
  assert.equal(changed.request.requestId, IDs[1]);

  const withPhoto = prepareContributionReview(createContributionDraft({ brand: 'Brand', name: 'Cream SPF 30',
    evidence: [{ evidenceId: EVIDENCE_ID, role: 'front_label' }],
  }), attempt, mint, { includePrivateEvidence: true });
  assert.equal(withPhoto.kind, 'ready');
  if (withPhoto.kind === 'ready') assert.equal(withPhoto.request.requestId, IDs[2]);
  assert.equal(next, 3);
});

test('invalid details do not mint a request ID', () => {
  let minted = false;
  const result = prepareContributionReview(createContributionDraft({ brand: '', name: 'Cream' }), null,
    () => { minted = true; return REQUEST_ID; });
  assert.equal(result.kind, 'invalid');
  assert.equal(minted, false);
});
