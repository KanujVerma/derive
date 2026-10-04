import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  REVIEW_BRIEF_AUDITED_ON,
  REVIEW_BRIEF_PILOT,
  REVIEW_BRIEF_PILOT_VERSION,
  getOptionalReviewBrief,
  type ReviewBrief,
} from '../src/data/reviewBriefPilot.ts';

test('review brief pilot has two explicitly versioned US non-SPF products', () => {
  assert.equal(REVIEW_BRIEF_PILOT.length, 2);
  for (const brief of REVIEW_BRIEF_PILOT) {
    assert.equal(brief.version, REVIEW_BRIEF_PILOT_VERSION);
    assert.equal(brief.auditedOn, REVIEW_BRIEF_AUDITED_ON);
    assert.equal(brief.identity.market, 'US');
    assert.equal(brief.formulaScope, 'historical_reports_not_formula_verified');
    assert.match(brief.selectionNotice, /not a representative review consensus/);
    assert.ok(brief.limits.length > 0);
  }
});

test('unapproved leads contribute no report text and never reach optional display', () => {
  for (const brief of REVIEW_BRIEF_PILOT) {
    assert.equal(brief.status, 'withheld');
    assert.deepEqual(brief.observations, []);
    assert.equal(getOptionalReviewBrief(brief.identity, true), undefined);
    assert.ok(brief.gaps.length > 0);
    for (const source of brief.sources) {
      assert.equal(source.permission.status, 'explicit_restriction_pending_summary_review');
      assert.equal(source.permission.display, 'none');
      assert.match(source.permission.basisUrl, /^https:\/\//);
      assert.ok(source.permission.retain.every((item) => !/raw|image|comment text|summary/.test(item)));
    }
  }
});

test('missing, disabled, wrong-market and lookalike identities omit the section', () => {
  const pm = REVIEW_BRIEF_PILOT[1].identity;
  for (const identity of [
    pm,
    { ...pm, market: 'CA' },
    { ...pm, market: 'unknown' },
    { ...pm, productName: 'AM Facial Moisturizing Lotion', variant: 'AM SPF 30' },
    { ...pm, productName: 'PM Facial Moisturizing Lotion SPF 30' },
    { ...pm, brand: 'Other brand' },
    { ...pm, variant: 'unknown' },
  ]) {
    assert.equal(getOptionalReviewBrief(identity), undefined);
    assert.equal(getOptionalReviewBrief(identity, true), undefined);
  }
});

test('AM/SPF contamination and unconfirmed market are recorded; date comes from metadata', () => {
  const pm = REVIEW_BRIEF_PILOT[1];
  const source = pm.sources[0];
  assert.match(source.identityCheck, /complaints belong to AM, not PM/);
  assert.match(source.identityCheck, /does not confirm a US-market package/);
  assert.equal(source.sourceDate.isoDate, '2023-10-31');
  assert.match(source.sourceDate.displayed, /confirmed in page metadata/);
});

test('source update date is not invented as a publication or package-formula date', () => {
  const sources = REVIEW_BRIEF_PILOT[0].sources;
  assert.deepEqual(sources[0].sourceDate, {
    kind: 'updated', isoDate: '2024-08-22', displayed: 'Updated August 22, 2024',
  });
  assert.equal(sources[1].sourceDate.isoDate, null);
  assert.match(sources[0].identityCheck, /current formula equivalence are not established/);
});

test('data is deeply immutable and lookup neither mutates caller nor retained snapshots', () => {
  const retained = REVIEW_BRIEF_PILOT[0];
  const before = JSON.stringify(retained);
  const identity = Object.freeze({ ...retained.identity });
  getOptionalReviewBrief(identity, true);
  assert.throws(() => Object.assign(retained, { version: '2.0.0' }), TypeError);
  assert.throws(() => Object.assign(retained.identity, { market: 'CA' }), TypeError);
  assert.throws(() => (retained.observations as unknown as unknown[]).push({}), TypeError);
  assert.throws(() => Object.assign(retained.sources[0].permission, { status: 'cleared' }), TypeError);
  assert.equal(JSON.stringify(retained), before);
  assert.deepEqual(identity, retained.identity);
});

/** Entirely fictional reports/permission for testing the proposed contract, not pilot content. */
function permittedFixture(): ReviewBrief {
  const baseline = REVIEW_BRIEF_PILOT[1];
  return {
    ...baseline,
    status: 'ready',
    gaps: [],
    sources: [{
      ...baseline.sources[0],
      id: 'fictional-consenting-tester',
      url: 'https://example.invalid/consent-fixture',
      publisher: 'Fictional fixture only',
      acceptedReportIdentity: baseline.identity,
      permission: {
        status: 'cleared',
        basisUrl: 'https://example.invalid/consent-fixture',
        basis: 'Synthetic test permission, not a real permission grant.',
        retain: ['original summary'],
        display: 'original_summary_with_attribution',
      },
    }],
    observations: [{
      topic: 'layering',
      summary: 'Fictional tester A reports smooth layering.',
      qualification: 'Fictional tester B reports pilling with a different routine. Cause unknown.',
      sourceIds: ['fictional-consenting-tester'],
      sourceSections: ['Fictional test report only'],
    }],
  };
}

test('permitted synthetic brief returns only for an enabled exact product/variant/market', () => {
  const fixture = permittedFixture();
  assert.equal(getOptionalReviewBrief(fixture.identity, true, [fixture]), fixture);
  assert.equal(getOptionalReviewBrief(fixture.identity, false, [fixture]), undefined);
  for (const mismatch of [
    { ...fixture.identity, market: 'CA' },
    { ...fixture.identity, brand: 'Other' },
    { ...fixture.identity, productName: 'AM Facial Moisturizing Lotion' },
    { ...fixture.identity, variant: 'AM SPF 30' },
  ]) assert.equal(getOptionalReviewBrief(mismatch, true, [fixture]), undefined);
});

test('unknown source, restricted source, missing limits or invalid observation count cannot display', () => {
  const fixture = permittedFixture();
  for (const invalid of [
    { ...fixture, status: 'withheld' as const },
    { ...fixture, observations: [] },
    { ...fixture, observations: [...fixture.observations, ...fixture.observations, ...fixture.observations] },
    { ...fixture, sources: [] },
    { ...fixture, sources: REVIEW_BRIEF_PILOT[1].sources },
    { ...fixture, sources: [{ ...fixture.sources[0], acceptedReportIdentity: null }] },
    { ...fixture, sources: [{ ...fixture.sources[0], acceptedReportIdentity: { ...fixture.identity, variant: 'AM SPF 30' } }] },
    { ...fixture, limits: [] },
    { ...fixture, observations: [{ ...fixture.observations[0], qualification: '' }] },
    { ...fixture, observations: [{ ...fixture.observations[0], sourceSections: [] }] },
  ]) assert.equal(getOptionalReviewBrief(fixture.identity, true, [invalid]), undefined);
});

test('new edition does not replace an earlier retained brief or its disagreement', () => {
  const old = permittedFixture();
  const retained = getOptionalReviewBrief(old.identity, true, [old]);
  const next = { ...old, version: '2.0.0', observations: [{ ...old.observations[0], summary: 'Changed fictional report.' }] };
  assert.equal(getOptionalReviewBrief(next.identity, true, [next]), next);
  assert.equal(retained?.version, REVIEW_BRIEF_PILOT_VERSION);
  assert.equal(retained?.observations[0].summary, 'Fictional tester A reports smooth layering.');
  assert.match(retained?.observations[0].qualification ?? '', /B reports pilling/);
});

test('module remains standalone with no app, decision, persistence or provider dependencies', () => {
  const source = readFileSync(new URL('../src/data/reviewBriefPilot.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /^\s*import\s/m);
  assert.doesNotMatch(source, /\b(?:fetch|localStorage|AsyncStorage|supabase|setTimeout)\s*[.(]/);
  assert.doesNotMatch(source, /\b(?:score|verdict|recommendation|reviewCount|percentage)\s*:/);
});
