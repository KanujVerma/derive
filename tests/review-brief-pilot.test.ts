import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  REVIEW_BRIEF_AUDITED_ON, REVIEW_BRIEF_EDITIONS, REVIEW_BRIEF_PILOT,
  REVIEW_BRIEF_PILOT_V1, REVIEW_BRIEF_PILOT_VERSION, getOptionalReviewBrief,
  type ReviewBrief, type ReviewBriefSource,
} from '../src/data/reviewBriefPilot.ts';

test('current edition contains both ready, versioned U.S. non-SPF briefs', () => {
  assert.equal(REVIEW_BRIEF_PILOT_VERSION, '1.1.0');
  assert.equal(REVIEW_BRIEF_PILOT.length, 2);
  assert.deepEqual(REVIEW_BRIEF_PILOT.map(brief => brief.status), ['ready', 'ready']);
  for (const brief of REVIEW_BRIEF_PILOT) {
    assert.equal(brief.version, REVIEW_BRIEF_PILOT_VERSION);
    assert.equal(brief.auditedOn, REVIEW_BRIEF_AUDITED_ON);
    assert.equal(brief.identity.market, 'US');
    assert.equal(brief.formulaScope, 'historical_reports_not_formula_verified');
    assert.match(brief.selectionNotice, /not a representative review consensus/);
    assert.ok(brief.limits.length > 0);
    assert.ok(brief.observations.length >= 1 && brief.observations.length <= 2);
    assert.deepEqual(brief.gaps, []);
    assert.equal(getOptionalReviewBrief(brief.identity, true), brief);
  }
});

test('ready content still requires explicit opt-in', () => {
  for (const brief of REVIEW_BRIEF_PILOT) {
    assert.equal(getOptionalReviewBrief(brief.identity), undefined);
    assert.equal(getOptionalReviewBrief(brief.identity, false), undefined);
    assert.equal(getOptionalReviewBrief(brief.identity, true), brief);
  }
});

test('both products reject unknown markets, variants, brands and near names', () => {
  for (const brief of REVIEW_BRIEF_PILOT) {
    for (const mismatch of [
      { ...brief.identity, market: 'CA' }, { ...brief.identity, market: 'UK' },
      { ...brief.identity, market: 'unknown' }, { ...brief.identity, brand: 'Other' },
      { ...brief.identity, brand: brief.identity.brand.toLowerCase() },
      { ...brief.identity, variant: 'unknown' },
      { ...brief.identity, productName: brief.identity.productName + ' SPF 30' },
    ]) assert.equal(getOptionalReviewBrief(mismatch, true), undefined);
  }
  const vanicream = REVIEW_BRIEF_PILOT[0].identity;
  const pm = REVIEW_BRIEF_PILOT[1].identity;
  assert.equal(getOptionalReviewBrief({ ...vanicream, productName: 'Moisturizing Lotion' }, true), undefined);
  assert.equal(getOptionalReviewBrief({ ...vanicream, variant: 'SPF 30' }, true), undefined);
  assert.equal(getOptionalReviewBrief({ ...pm, productName: 'AM Facial Moisturizing Lotion', variant: 'AM SPF 30' }, true), undefined);
  assert.equal(getOptionalReviewBrief({ ...pm, productName: 'Moisturizing Lotion' }, true), undefined);
});

test('each ready observation binds an attributed firsthand source and section', () => {
  for (const brief of REVIEW_BRIEF_PILOT) {
    for (const source of brief.sources) {
      assert.equal(source.permission.status, 'cleared');
      assert.equal(source.permission.display, 'original_summary_with_attribution');
      assert.deepEqual(source.acceptedReportIdentity, brief.identity);
      assert.equal(source.reportEvidence?.firsthand, true);
      assert.ok(source.reportEvidence?.attribution.trim());
      assert.ok(source.reportEvidence?.identity.length);
      assert.ok(source.reportEvidence?.sections.length);
      assert.ok(source.permission.useAssessment?.checkedUrls.length);
      assert.equal(source.permission.useAssessment?.kind, 'original_factual_paraphrase');
      assert.equal(source.reportEvidence?.formulaApplicability, 'historical_not_current_formula_verified');
    }
    for (const observation of brief.observations) {
      assert.ok(observation.summary.trim());
      assert.ok(observation.qualification.trim());
      assert.equal(observation.bindings?.length, observation.sourceIds.length);
      for (const binding of observation.bindings ?? []) {
        assert.ok(brief.sources.some(source => source.id === binding.sourceId));
        assert.ok(observation.sourceSections.includes(binding.section));
        assert.ok(brief.sources.find(source => source.id === binding.sourceId)?.reportEvidence?.sections.includes(binding.section));
      }
    }
  }
});

test('historical v1 preserves excluded leads and zero customer observations', () => {
  assert.equal(REVIEW_BRIEF_EDITIONS['1.0.0'], REVIEW_BRIEF_PILOT_V1);
  assert.equal(REVIEW_BRIEF_EDITIONS['1.1.0'], REVIEW_BRIEF_PILOT);
  for (const brief of REVIEW_BRIEF_PILOT_V1) {
    assert.equal(brief.version, '1.0.0');
    assert.equal(brief.status, 'withheld');
    assert.deepEqual(brief.observations, []);
    assert.equal(getOptionalReviewBrief(brief.identity, true, REVIEW_BRIEF_PILOT_V1), undefined);
    assert.ok(brief.gaps.length > 0);
    for (const source of brief.sources) {
      assert.equal(source.permission.status, 'explicit_restriction_pending_summary_review');
      assert.equal(source.permission.display, 'none');
      assert.equal(source.acceptedReportIdentity, null);
    }
  }
  assert.deepEqual(REVIEW_BRIEF_PILOT_V1.flatMap(brief => brief.sources.map(source => source.id)), [
    'fussy-mug-vanicream-daily', 'reddit-skinbarrier-vanicream-lead', 'artistry-by-t-cerave-pm',
  ]);
  assert.ok(REVIEW_BRIEF_PILOT.every(brief => !brief.sources.some(source =>
    REVIEW_BRIEF_PILOT_V1.some(old => old.sources.some(excluded => excluded.id === source.id)))));
});

test('v1 preserves AM contamination, unconfirmed market and distinct date evidence', () => {
  const artistry = REVIEW_BRIEF_PILOT_V1[1].sources[0];
  assert.match(artistry.identityCheck, /complaints belong to AM, not PM/);
  assert.match(artistry.identityCheck, /does not confirm a US-market package/);
  assert.equal(artistry.sourceDate.isoDate, '2023-10-31');
  assert.match(artistry.sourceDate.displayed, /confirmed in page metadata/);
  const vanicream = REVIEW_BRIEF_PILOT_V1[0].sources;
  assert.deepEqual(vanicream[0].sourceDate, {
    kind: 'updated', isoDate: '2024-08-22', displayed: 'Updated August 22, 2024',
  });
  assert.equal(vanicream[1].sourceDate.isoDate, null);
});

test('CeraVe retains unusual-feel qualification and honest historical indexed retrieval', () => {
  const pm = REVIEW_BRIEF_PILOT[1];
  assert.match(pm.observations[0].summary, /2016/);
  assert.match(pm.observations[0].summary, /unfamiliar surface feel/);
  assert.match(pm.observations[1].summary, /unusual feel/);
  assert.match(pm.observations[1].qualification, /sunscreen was not identified/i);
  assert.equal(pm.sources[0].sourceDate.isoDate, '2016-04-21');
  assert.equal(pm.sources[0].reportEvidence?.retrieval, 'indexed_primary_page');
  assert.match(pm.sources[0].identityCheck, /Kroger/);
  assert.match(pm.sources[0].identityCheck, /not dollar pricing/);
  assert.match(pm.limits.join(' '), /2016.*current formula.*not verified/);
  assert.match(pm.limits.join(' '), /429.*indexed text.*live revision.*unverified/);
});

test('Vanicream contains its own exact-package 2023 firsthand account, not an excluded draft', () => {
  const brief = REVIEW_BRIEF_PILOT[0];
  assert.equal(brief.observations.length, 1);
  assert.equal(brief.sources[0].id, 'isabelxmarie-vanicream-daily-2023');
  assert.equal(brief.sources[0].sourceDate.isoDate, '2023-06-07');
  assert.equal(brief.sources[0].reportEvidence?.retrieval, 'direct_primary_page');
  assert.match(brief.sources[0].url, /^https:\/\/www\.isabelxmarie\.com\/affordable-skincare-routine-for-dry-skin\/$/);
  assert.ok(brief.sources[0].reportEvidence?.sections.includes('Morning Routine, Vanicream Daily Facial Moisturizer paragraph'));
  assert.match(JSON.stringify(brief), /2023/);
  assert.match(JSON.stringify(brief), /current formula|current-formula/i);
});

/** Fictional contract exercise only, never customer-facing pilot content. */
function permittedFixture(): ReviewBrief {
  const baseline = REVIEW_BRIEF_PILOT[1];
  const sourceId = 'fictional-consenting-tester';
  const section = 'Fictional test report only';
  return {
    ...baseline,
    sources: [{
      ...baseline.sources[0], id: sourceId,
      url: 'https://example.invalid/consent-fixture', publisher: 'Fictional fixture only',
      acceptedReportIdentity: baseline.identity,
      reportEvidence: {
        firsthand: true, attribution: 'Fictional tester only', retrieval: 'direct_primary_page',
        sections: [section],
        identity: [{ url: 'https://example.invalid/consent-fixture', section, finding: 'Synthetic exact identity proof.' }],
        formulaApplicability: 'historical_not_current_formula_verified',
      },
      permission: {
        status: 'cleared', basisUrl: 'https://example.invalid/consent-fixture',
        basis: 'Synthetic test permission, not a real permission grant.',
        retain: ['original summary'], display: 'original_summary_with_attribution',
        useAssessment: {
          kind: 'written_permission', reviewedOn: '2026-10-04',
          checkedUrls: ['https://example.invalid/consent-fixture'], restrictions: 'Fictional test scope only.',
          quotations: false, copiedReviews: false, images: false, bulkCollection: false,
        },
      },
    }],
    observations: [{
      topic: 'layering', summary: 'Fictional tester A reports smooth layering.',
      qualification: 'Fictional tester B reports pilling with a different routine. Cause unknown.',
      sourceIds: [sourceId], sourceSections: [section], bindings: [{ sourceId, section }],
    }],
  };
}

function assertRejected(brief: ReviewBrief) {
  assert.equal(getOptionalReviewBrief(brief.identity, true, [brief]), undefined);
}

test('fully documented synthetic fixture passes only in tests, never runtime editions', () => {
  const fixture = permittedFixture();
  assert.equal(getOptionalReviewBrief(fixture.identity, true, [fixture]), fixture);
  assert.equal(getOptionalReviewBrief(fixture.identity, false, [fixture]), undefined);
  assert.doesNotMatch(JSON.stringify(REVIEW_BRIEF_EDITIONS), /fictional|synthetic|example\.invalid/i);
});

test('withheld states, gaps and missing or excessive observations cannot display', () => {
  const fixture = permittedFixture();
  for (const invalid of [
    { ...fixture, status: 'withheld' as const }, { ...fixture, gaps: ['Needs identity review'] },
    { ...fixture, observations: [] },
    { ...fixture, observations: [...fixture.observations, ...fixture.observations, ...fixture.observations] },
    { ...fixture, limits: [] }, { ...fixture, limits: [' '] },
    { ...fixture, version: ' ' }, { ...fixture, selectionNotice: ' ' },
  ]) assertRejected(invalid);
});

test('source identity, firsthand evidence and explicit usable scope are mandatory', () => {
  const fixture = permittedFixture();
  const source = fixture.sources[0];
  const evidence = source.reportEvidence!;
  const invalidSources: ReviewBriefSource[] = [
    { ...source, acceptedReportIdentity: null },
    { ...source, acceptedReportIdentity: { ...fixture.identity, market: 'CA' } },
    { ...source, acceptedReportIdentity: { ...fixture.identity, variant: 'AM SPF 30' } },
    { ...source, reportEvidence: undefined },
    { ...source, reportEvidence: { ...evidence, attribution: ' ' } },
    { ...source, reportEvidence: { ...evidence, identity: [] } },
    { ...source, reportEvidence: { ...evidence, sections: [] } },
    { ...source, reportEvidence: { ...evidence, sections: [' '] } },
    { ...source, reportEvidence: { ...evidence, identity: [{ ...evidence.identity[0], finding: ' ' }] } },
    { ...source, reportEvidence: { ...evidence, identity: [{ ...evidence.identity[0], section: ' ' }] } },
    { ...source, identityCheck: ' ' },
    { ...source, permission: { ...source.permission, status: 'explicit_restriction_pending_summary_review' } },
    { ...source, permission: { ...source.permission, display: 'none' } },
  ];
  for (const invalid of invalidSources) assertRejected({ ...fixture, sources: [invalid] });
  assertRejected({ ...fixture, sources: [{ ...source, reportEvidence: { ...evidence, firsthand: false } }] } as unknown as ReviewBrief);
  assertRejected({ ...fixture, sources: [{ ...source, reportEvidence: { ...evidence, formulaApplicability: 'verified_current' } }] } as unknown as ReviewBrief);
});

test('a cleared label does not replace missing or blank use assessment', () => {
  const fixture = permittedFixture();
  const source = fixture.sources[0];
  const use = source.permission.useAssessment!;
  for (const permission of [
    { ...source.permission, basis: ' ' }, { ...source.permission, useAssessment: undefined },
    { ...source.permission, useAssessment: { ...use, restrictions: ' ' } },
    { ...source.permission, useAssessment: { ...use, checkedUrls: [] } },
  ]) assertRejected({ ...fixture, sources: [{ ...source, permission }] });
  for (const activity of ['quotations', 'copiedReviews', 'images', 'bulkCollection']) {
    assertRejected({ ...fixture, sources: [{ ...source, permission: {
      ...source.permission, useAssessment: { ...use, [activity]: true },
    } }] } as unknown as ReviewBrief);
  }
});

test('source, permission, identity and audited-use URLs must be safe HTTPS', () => {
  const fixture = permittedFixture();
  const source = fixture.sources[0];
  for (const badUrl of ['not a URL', 'http://example.invalid/report', 'javascript:alert(1)', 'https://user:pass@example.invalid/report']) {
    assertRejected({ ...fixture, sources: [{ ...source, url: badUrl }] });
    assertRejected({ ...fixture, sources: [{ ...source, permission: { ...source.permission, basisUrl: badUrl } }] });
    assertRejected({ ...fixture, sources: [{ ...source, permission: {
      ...source.permission, useAssessment: { ...source.permission.useAssessment!, checkedUrls: [badUrl] },
    } }] });
    assertRejected({ ...fixture, sources: [{ ...source, reportEvidence: {
      ...source.reportEvidence!, identity: [{ ...source.reportEvidence!.identity[0], url: badUrl }],
    } }] });
  }
});

test('unknown, invalid-calendar and malformed dates cannot authorize display', () => {
  const fixture = permittedFixture();
  const source = fixture.sources[0];
  assertRejected({ ...fixture, sources: [{ ...source, sourceDate: { ...source.sourceDate, isoDate: null } }] });
  for (const badDate of ['', '2026-02-30', '2026-13-01', '2026-1-4', 'not a date']) {
    assertRejected({ ...fixture, auditedOn: badDate });
    assertRejected({ ...fixture, sources: [{ ...source, auditedOn: badDate }] });
    assertRejected({ ...fixture, sources: [{ ...source, sourceDate: { ...source.sourceDate, isoDate: badDate } }] });
    assertRejected({ ...fixture, sources: [{ ...source, permission: {
      ...source.permission, useAssessment: { ...source.permission.useAssessment!, reviewedOn: badDate },
    } }] });
  }
});

test('report, source-audit and use-review dates cannot be later than their owning audit', () => {
  const fixture = permittedFixture();
  const source = fixture.sources[0];
  assertRejected({ ...fixture, sources: [{ ...source, sourceDate: { ...source.sourceDate, isoDate: '2026-10-05' } }] });
  assertRejected({ ...fixture, sources: [{ ...source, auditedOn: '2026-10-05' }] });
  assertRejected({ ...fixture, sources: [{ ...source, permission: {
    ...source.permission, useAssessment: { ...source.permission.useAssessment!, reviewedOn: '2026-10-05' },
  } }] });
});

test('runtime enum mismatches cannot bypass source or observation guards', () => {
  const fixture = permittedFixture();
  const source = fixture.sources[0];
  const invalid = [
    { ...fixture, formulaScope: 'verified_current_formula' },
    { ...fixture, observations: [{ ...fixture.observations[0], topic: 'recommendation' }] },
    { ...fixture, sources: [{ ...source, id: ' ', }], observations: [{
      ...fixture.observations[0], sourceIds: [' '], bindings: [{ sourceId: ' ', section: fixture.observations[0].sourceSections[0] }],
    }] },
    { ...fixture, sources: [{ ...source, sourceDate: { ...source.sourceDate, kind: 'guessed' } }] },
    { ...fixture, sources: [{ ...source, reportEvidence: { ...source.reportEvidence!, retrieval: 'generated_by_model' } }] },
    { ...fixture, sources: [{ ...source, permission: {
      ...source.permission, useAssessment: { ...source.permission.useAssessment!, kind: 'public_means_permitted' },
    } }] },
  ];
  for (const brief of invalid) assertRejected(brief as unknown as ReviewBrief);
});

test('duplicate sources, unknown references and duplicate cited IDs are rejected', () => {
  const fixture = permittedFixture();
  const observation = fixture.observations[0];
  assertRejected({ ...fixture, sources: [] });
  assertRejected({ ...fixture, sources: [fixture.sources[0], fixture.sources[0]] });
  assertRejected({ ...fixture, sources: [...fixture.sources, { ...fixture.sources[0], id: 'unused-source' }] });
  assertRejected({ ...fixture, observations: [{ ...observation, sourceIds: ['unknown-source'] }] });
  assertRejected({ ...fixture, observations: [{ ...observation, sourceIds: [] }] });
  assertRejected({ ...fixture, observations: [{ ...observation, sourceIds: [...observation.sourceIds, ...observation.sourceIds] }] });
});

test('every cited source requires its own nonblank section binding', () => {
  const fixture = permittedFixture();
  const observation = fixture.observations[0];
  for (const invalidObservation of [
    { ...observation, summary: ' ' }, { ...observation, qualification: ' ' },
    { ...observation, sourceSections: [] }, { ...observation, sourceSections: [' '] },
    { ...observation, bindings: undefined }, { ...observation, bindings: [] },
    { ...observation, bindings: [{ sourceId: 'unknown-source', section: observation.sourceSections[0] }] },
    { ...observation, bindings: [{ sourceId: observation.sourceIds[0], section: 'Another source’s section' }] },
    { ...observation, bindings: [{ sourceId: observation.sourceIds[0], section: ' ' }] },
  ]) assertRejected({ ...fixture, observations: [invalidObservation] });
  const second = { ...fixture.sources[0], id: 'fictional-second-source', reportEvidence: {
    ...fixture.sources[0].reportEvidence!, sections: ['Second fictional section'],
  } };
  const twoSources: ReviewBrief = {
    ...fixture, sources: [fixture.sources[0], second], observations: [{
      ...observation, sourceIds: [fixture.sources[0].id, second.id],
      sourceSections: [observation.sourceSections[0], 'Second fictional section'],
      bindings: [...observation.bindings!, { sourceId: second.id, section: 'Second fictional section' }],
    }],
  };
  assert.equal(getOptionalReviewBrief(twoSources.identity, true, [twoSources]), twoSources);
  assertRejected({ ...twoSources, observations: [{ ...twoSources.observations[0], bindings: [
    ...observation.bindings!, ...observation.bindings!,
  ] }] });
  assertRejected({ ...twoSources, observations: [{ ...twoSources.observations[0], bindings: [
    { sourceId: fixture.sources[0].id, section: 'Second fictional section' },
    { sourceId: second.id, section: observation.sourceSections[0] },
  ] }] });
});

test('new and retained editions are deeply immutable and never mutate identity inputs', () => {
  for (const edition of [REVIEW_BRIEF_PILOT_V1, REVIEW_BRIEF_PILOT]) {
    const retained = edition[0];
    const before = JSON.stringify(retained);
    const identity = Object.freeze({ ...retained.identity });
    getOptionalReviewBrief(identity, true, edition);
    assert.throws(() => Object.assign(retained, { version: '2.0.0' }), TypeError);
    assert.throws(() => Object.assign(retained.identity, { market: 'CA' }), TypeError);
    assert.throws(() => (retained.observations as unknown as unknown[]).push({}), TypeError);
    assert.throws(() => Object.assign(retained.sources[0].permission, { status: 'invalid' }), TypeError);
    assert.equal(JSON.stringify(retained), before);
    assert.deepEqual(identity, retained.identity);
  }
  assert.throws(() => Object.assign(REVIEW_BRIEF_EDITIONS, { '1.0.0': REVIEW_BRIEF_PILOT }), TypeError);
  assert.throws(() => Object.assign(REVIEW_BRIEF_PILOT[1].sources[0].reportEvidence!, { attribution: 'Changed' }), TypeError);
  assert.throws(() => Object.assign(REVIEW_BRIEF_PILOT[1].observations[0].bindings![0], { sourceId: 'other' }), TypeError);
});

test('later observations do not mutate a retained assessment or erase disagreement', () => {
  const old = permittedFixture();
  const retained = getOptionalReviewBrief(old.identity, true, [old]);
  const next = { ...old, version: '2.0.0', observations: [{ ...old.observations[0], summary: 'Changed fictional report.' }] };
  assert.equal(getOptionalReviewBrief(next.identity, true, [next]), next);
  assert.equal(retained?.version, '1.1.0');
  assert.equal(retained?.observations[0].summary, 'Fictional tester A reports smooth layering.');
  assert.match(retained?.observations[0].qualification ?? '', /B reports pilling/);
  assert.equal(getOptionalReviewBrief(REVIEW_BRIEF_PILOT_V1[1].identity, true, REVIEW_BRIEF_EDITIONS['1.0.0']), undefined);
});

test('module remains standalone with no app, decision, persistence or provider dependencies', () => {
  const source = readFileSync(new URL('../src/data/reviewBriefPilot.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /^\s*import\s/m);
  assert.doesNotMatch(source, /\b(?:fetch|localStorage|AsyncStorage|supabase|setTimeout)\s*[.(]/);
  assert.doesNotMatch(source, /\b(?:score|verdict|recommendation|reviewCount|percentage)\s*:/);
});
