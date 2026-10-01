import assert from 'node:assert/strict';
import test from 'node:test';
import { personalDecisionFixtures } from '../src/fixtures/personal-decision/fixtures.ts';
import { describeDecisionVerdict, describeCheckVerdict, verdictLabels } from '../src/presentation/check/result-sheet/verdict.ts';
import { describeResultExample } from '../src/presentation/check/result-sheet/examples.ts';
import { resultSheetGeometry } from '../src/presentation/check/result-sheet/geometry.ts';
const fixture = (id: string) => JSON.parse(JSON.stringify(personalDecisionFixtures.find(f => f.id === id)!)) as (typeof personalDecisionFixtures)[number];
const states = { 'positive-role-match': 'good', redundancy: 'tradeoffs', 'routine-formula-overlap': 'tradeoffs', 'routine-experience': 'tradeoffs', caution: 'poor', 'prior-reaction': 'poor', 'missing-formula': 'unknown', 'partial-routine': 'unknown', 'unsupported-goal': 'unknown', reformulation: 'unknown' } as const;
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
