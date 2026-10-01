import assert from 'node:assert/strict';
import test from 'node:test';
import { personalDecisionFixtures } from '../src/fixtures/personal-decision/fixtures.ts';
import { describeDecisionVerdict, describeCheckVerdict, verdictLabels } from '../src/presentation/check/result-sheet/verdict.ts';
import { describeResultExample } from '../src/presentation/check/result-sheet/examples.ts';
import { resultSheetGeometry } from '../src/presentation/check/result-sheet/geometry.ts';
const fixture = (id: string) => JSON.parse(JSON.stringify(personalDecisionFixtures.find(f => f.id === id)!)) as (typeof personalDecisionFixtures)[number];
const states = { 'positive-role-match': 'good', redundancy: 'unknown', 'routine-formula-overlap': 'tradeoffs', 'routine-experience': 'tradeoffs', caution: 'poor', 'prior-reaction': 'poor', 'missing-formula': 'unknown', 'partial-routine': 'unknown', 'unsupported-goal': 'unknown', reformulation: 'unknown' } as const;
for (const [id, expected] of Object.entries(states)) test(`deterministic retained facts: ${id}`, () => {
  const f = fixture(id); const view = describeDecisionVerdict(f.packet, f.binding);
  assert.equal(view.state, expected); assert.equal(view.label, verdictLabels[expected]);
  assert.deepEqual(view, describeDecisionVerdict(f.packet, f.binding));
  assert.doesNotMatch(view.reason, /;|score|Reddit|community|Your experience/i);
  assert.ok(view.reason.length < 200, view.reason);
});
test('missing routine and unfamiliar-product tolerance do not become negative or an absence of use', () => {
  const f = fixture('positive-role-match'); f.binding.routineRevision = null; f.binding.historyRevision = null;
  f.packet.binding = f.binding;
  assert.equal(describeDecisionVerdict(f.packet, f.binding).state, 'good');
  assert.equal(describeDecisionVerdict(f.packet, { ...f.binding, ownerId: 'another-owner' }).state, 'unknown');
  const partial = fixture('partial-routine');
  const v = describeDecisionVerdict(partial.packet, partial.binding);
  assert.match(v.reason, /not fully recorded/); assert.doesNotMatch(v.reason, /no routine/);
  assert.ok(v.findings.flatMap(f => f.limits).some(l => l.includes('does not mean you have no routine')));
});
test('a limited role, model observation, or unbound snapshot cannot grant positive fit', () => {
  const f = fixture('positive-role-match'); f.packet.findings[0].confidence = 'limited';
  assert.equal(describeDecisionVerdict(f.packet, f.binding).state, 'unknown');
  f.packet.findings[0].confidence = 'supported'; f.packet.findings[0].evidence = [{ kind: 'observation', observationId: 'model', source: 'model' }];
  assert.equal(describeDecisionVerdict(f.packet, f.binding).state, 'unknown');
  assert.equal(describeCheckVerdict({ ownerId: f.binding.ownerId, snapshot: null, fit: { kind: 'canonical', packet: fixture('positive-role-match').packet, expectedBinding: f.binding } }).state, 'unknown');
});
test('material current-product caution wins over duplication, and exact-formula gaps remain visible', () => {
  const f = fixture('routine-experience'); const v = describeDecisionVerdict(f.packet, f.binding);
  assert.match(v.reason, /reaction to a product already in your routine/);
  assert.match(v.reason, /does not establish a reaction to this new product/);
  const red = fixture('prior-reaction'); assert.match(describeDecisionVerdict(red.packet, red.binding).reason, /unverified/);
});
test('measured fold grows with long copy and large text, then uses full-height scrolling', () => {
  const base = { height: 844, topInset: 44, bottomPadding: 34 };
  const short = resultSheetGeometry({ ...base, summaryHeight: 210 });
  const long = resultSheetGeometry({ ...base, summaryHeight: 400 });
  const large = resultSheetGeometry({ ...base, summaryHeight: 1000 });
  assert.ok(short.snapPoints[0] >= 210 + 44 + 34);
  assert.ok(long.snapPoints[0] > short.snapPoints[0]); assert.equal(large.needsFullHeight, true);
  for (const g of [short, long, large]) assert.ok(g.snapPoints[0] < g.snapPoints[1] && g.snapPoints[1] < g.snapPoints[2]);
});

test('development unfamiliar-product example with unprovided routine is affirmative only about its supported goal', () => {
  const example = describeResultExample('routine-not-provided');
  assert.equal(example.verdict.state, 'good');
  assert.ok(example.verdict.findings.some(f => f.reason.includes('overlap is still unknown')));
  assert.ok(example.verdict.findings.flatMap(f => f.limits).some(l => l.includes('does not mean')));
  assert.equal(example.facts.formula, null, 'semantic mock does not invent verified live product truth');
});

test('routine-role finding does not assume adding intent or manufacture amber', () => {
  const f = fixture('redundancy');
  for (const options of [{}, { intent: 'replace' as const }, { intent: 'check_current' as const }]) {
    const v = describeDecisionVerdict(f.packet, f.binding, options);
    assert.equal(v.state, 'unknown'); assert.match(v.reason, /could replace it rather than add another step/);
    assert.doesNotMatch(v.reason, /would add|Adding this/);
  }
  const added = describeDecisionVerdict(f.packet, f.binding, { intent: 'add' });
  assert.equal(added.state, 'tradeoffs'); assert.match(added.reason, /Adding this would duplicate/);
  assert.equal(describeDecisionVerdict(f.packet, { ...f.binding, ownerId: 'stale' }, { intent: 'add' }).state, 'unknown');
});
const categoryCopy = {
  moisturizer: {
    summary: 'A dry-skin moisturizer for your evening routine.',
    rows: [['For your dryness', 'Labelled to moisturize dry skin.'],
      ['In your routine', 'Adds an evening moisturizer after your cleanser.'],
      ['Texture', 'Rich cream, matching your stated preference.']],
  },
  cleanser: {
    summary: 'A cream cleanser for your dry-skin routine.',
    rows: [['For dry skin', 'Labelled for dry skin. Your current wash leaves your skin feeling tight.'],
      ['In your routine', 'Replaces your evening gel cleanser.'],
      ['Texture', 'Non-foaming cream, your preferred cleanser type.']],
  },
  sunscreen: {
    summary: 'SPF 50 with water resistance for outdoor swims.',
    rows: [['Protection', 'Broad-spectrum SPF 50.'],
      ['For swimming', 'Water resistant for 80 minutes. Reapply after swimming or towel drying, following the label.'],
      ['In your routine', 'Replaces your morning sunscreen on swim days.']],
  },
};
test('category examples expose specific label, profile and routine facts without new authority', () => {
  for (const [id, expected] of Object.entries(categoryCopy)) {
    const e = describeResultExample(id);
    assert.equal(e.verdict.state, 'good'); assert.equal(e.verdict.reason, expected.summary);
    assert.deepEqual(e.verdict.findings.map(f => [f.title, f.reason]), expected.rows);
    assert.ok(e.verdict.findings.every(f => f.evidence.length > 0));
    assert.equal(e.facts.formula, null); assert.equal(e.facts.source, null);
    assert.doesNotMatch(JSON.stringify(e.verdict), /will (prevent|cure|protect|hydrate)|cerave|la roche|Reddit|clinical|research|absorption|pore effects/i);
  }
  const moisturizer = describeResultExample('moisturizer').verdict;
  assert.deepEqual(moisturizer.findings[0].evidence.map(row => row.detail), ['Moisturizer for dry skin', 'Dry skin']);
  assert.deepEqual(moisturizer.findings[2].evidence.map(row => row.detail), ['Rich cream', 'Rich texture']);
  assert.ok(moisturizer.findings[1].evidence.some(row => row.detail.includes('Check intent: add')));
  const swimming = describeResultExample('sunscreen').verdict.findings[1];
  assert.match(swimming.limits.join(' '), /80 minutes.*immediately.*every 2 hours.*Not waterproof/);
  assert.ok(swimming.evidence.some(row => row.detail.includes('immediately after towel drying')));
  assert.equal(describeResultExample('redundancy').verdict.state, 'tradeoffs');
  assert.equal(describeResultExample('intent-unknown').verdict.state, 'unknown');
  assert.equal(describeResultExample('replacement').verdict.state, 'unknown');
});

test('bound live goal facts, uncertainties and material cautions stay in the visible finding list', () => {
  const f = fixture('positive-role-match');
  const goal = f.packet.findings[0];
  const v = describeDecisionVerdict(f.packet, f.binding);
  const row = v.findings.find(row => row.id === goal.id)!;
  assert.equal(row.evidence.length, goal.evidence.length);
  assert.ok(row.limits.some(limit => limit.includes('individual results or tolerance')));
  assert.doesNotMatch(v.reason, /preferred texture|rich cream|labelled to moisturize/i, 'live facts do not borrow fixture preferences or label claims');
  goal.evidence.push({ kind: 'reviewed_claim', claimId: 'fixture-claim', claimRevision: '1', sourceId: 'fixture-review', sourceRevision: '1', applicability: 'applicable', limitations: ['Applicability is limited to the reviewed context.'] });
  const reviewed = describeDecisionVerdict(f.packet, f.binding).findings.find(row => row.id === goal.id)!;
  assert.ok(reviewed.limits.includes('Applicability is limited to the reviewed context.'), 'reviewed limitations cannot be hidden in Source');
  assert.ok(reviewed.evidence.some(row => row.detail.includes('Publication details were not supplied')));
  f.packet.findings.push({ ...goal, id: 'another-goal', display: { kind: 'role_match', goal: 'maintain', category: 'moisturizer', evidenceIndexes: [0, 1] } });
  const distinct = describeDecisionVerdict(f.packet, f.binding);
  assert.ok(distinct.findings.some(row => row.id === 'another-goal' && row.reason.includes('maintaining your skin')));
  const caution = fixture('caution');
  const cautious = describeDecisionVerdict(caution.packet, caution.binding);
  assert.ok(cautious.findings.some(row => row.title === 'Your goal'));
  assert.ok(cautious.findings.some(row => row.id === 'prior-reaction' && row.reason.includes('reported a reaction')));
});

test('fictional category sources contain only the facts supporting their finding', () => {
  const cleanser = describeResultExample('cleanser').verdict.findings;
  assert.deepEqual(cleanser[0].evidence.map(row => row.detail), ['Cleanser for dry skin', 'Dry skin; current wash leaves skin feeling tight']);
  assert.deepEqual(cleanser[2].evidence.map(row => row.detail), ['Non-foaming cream', 'Cream cleanser']);
  const sunscreen = describeResultExample('sunscreen').verdict.findings;
  assert.deepEqual(sunscreen[0].evidence.map(row => row.detail), ['Broad-spectrum SPF 50']);
  assert.deepEqual(sunscreen[1].evidence.slice(0, 2).map(row => row.detail), ['Water resistant for 80 minutes', 'Outdoor swimming for about one hour']);
  assert.match(sunscreen[1].evidence[2].detail, /immediately after towel drying/);
  for (const id of ['moisturizer', 'cleanser', 'sunscreen']) {
    const findings = describeResultExample(id).verdict.findings;
    assert.ok(findings.flatMap(row => row.evidence).every(source => /Fictional/.test(source.label + source.detail)), 'fictional provenance stays explicit');
  }
});
