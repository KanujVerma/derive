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
test('category examples have distinct concrete facts, complementary findings and individual evidence', () => {
  for (const [id, feature] of [['cleanser', 'Non-foaming cream'], ['moisturizer', 'Rich cream'], ['sunscreen', 'Water resistant for 80 minutes']] as const) {
    const e = describeResultExample(id);
    assert.equal(e.verdict.state, 'good'); assert.match(e.verdict.reason, new RegExp(feature));
    assert.equal(e.verdict.findings.length, id === 'sunscreen' ? 2 : 1);
    assert.ok(e.verdict.findings.every(f => f.reason !== e.verdict.reason && f.evidence.length > 0));
    assert.ok(e.verdict.summaryFinding!.evidence.some(f => f.label === 'Your preference'));
    assert.ok(e.verdict.summaryFinding!.evidence.some(f => f.label === 'Package description'));
    assert.ok(e.verdict.summaryFinding!.limits.length > 0);
    assert.ok(e.verdict.findings.every(f => f.title !== 'Your goal'));
    assert.doesNotMatch(e.verdict.findings.map(f => f.reason).join(' '), /does not replace|different role|does not assess/);
    assert.equal(e.facts.formula, null); assert.equal(e.facts.source, null);
    assert.doesNotMatch(e.verdict.reason, /will (prevent|cure|protect|hydrate)|cerave|la roche|Reddit|clinical|research/i);
  }
  assert.equal(describeResultExample('moisturizer').verdict.reason, 'Rich cream · Your preferred texture');
  assert.equal(describeResultExample('moisturizer').verdict.findings[0].reason, 'Evening, after cleanser');
  assert.match(describeResultExample('cleanser').verdict.findings[0].reason, /Replaces your gel wash/);
  assert.match(describeResultExample('sunscreen').verdict.findings[1].reason, /Reapply after swimming or towel-drying.*not waterproof/);
  assert.equal(describeResultExample('redundancy').verdict.state, 'tradeoffs');
  assert.equal(describeResultExample('intent-unknown').verdict.state, 'unknown');
  assert.equal(describeResultExample('replacement').verdict.state, 'unknown');
});

test('only the repeated goal is removed; verdict evidence and distinct goal facts survive', () => {
  const f = fixture('positive-role-match');
  const goal = f.packet.findings[0];
  const v = describeDecisionVerdict(f.packet, f.binding);
  assert.equal(v.findings.some(row => row.id === goal.id), false);
  assert.equal(v.summaryFinding!.id, goal.id);
  assert.equal(v.summaryFinding!.evidence.length, goal.evidence.length);
  assert.ok(v.summaryFinding!.limits.some(limit => limit.includes('individual results or tolerance')));
  assert.doesNotMatch(v.reason, /preferred texture|rich cream/i, 'live facts do not carry a texture preference');
  f.packet.findings.push({ ...goal, id: 'another-goal', display: { kind: 'role_match', goal: 'maintain', category: 'moisturizer', evidenceIndexes: [0, 1] } });
  const distinct = describeDecisionVerdict(f.packet, f.binding);
  assert.ok(distinct.findings.some(row => row.id === 'another-goal' && row.reason.includes('maintaining your skin')));
  const caution = fixture('caution');
  const cautious = describeDecisionVerdict(caution.packet, caution.binding);
  assert.ok(cautious.findings.some(row => row.title === 'Your goal'), 'a goal distinct from the caution stays visible');
  assert.ok(cautious.findings.some(row => row.id === cautious.summaryFinding!.id), 'material caution stays in findings');
});
