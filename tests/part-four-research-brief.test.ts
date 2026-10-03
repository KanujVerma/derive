import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import type { PartFourPacket, ProductResearchBrief } from '../src/contracts/PartFour.ts';
import { admitResearchBrief, researchBriefHash, type ResearchBriefSubject } from '../src/domain/part-four/researchBrief.ts';
import { canonicalJson } from '../src/domain/part-two/hash.ts';
import { componentHarness, control, press, textContent } from './ux-profile-render.ts';
import { p3input } from './fixtures/part-three.ts';
import { evaluatePersonalResult } from '../src/domain/part-three/evaluate.ts';
import { assembleFoundation } from '../src/domain/part-four/assemble.ts';

const now = '2026-10-02T10:00:00Z';
const subject: ResearchBriefSubject = { productId: 'synthetic-product', variantId: 'synthetic-variant', formulaVersionId: 'synthetic-formula' };
const component = 'src/components/check/part-four/ResearchBrief.tsx';

/** Every observation and association below is synthetic validation data. URLs
 * test public URL shape/deduplication; no source was acquired or market claim
 * established by these tests. This fixture is never exported into runtime. */
function fixture(): ProductResearchBrief {
  const source = (id: string, url: string) => ({ id, title: 'Synthetic validation source metadata', url,
    kind: 'personal_anecdote' as const, retrievedAt: '2026-10-01T10:00:00Z', publishedAt: '2026-09-30T10:00:00Z',
    matching: 'exact_formula' as const, ...subject, coverageLimit: 'Synthetic source association; not market evidence.',
    permission: { grantId: `synthetic-grant-${id}`, version: 'synthetic-full-fields/v1', process: true as const,
      store: true as const, display: true as const, export: true as const, revoked: false as const, validUntil: '2026-10-04T10:00:00Z' } });
  const value: ProductResearchBrief = {
    version: 'product-research-brief/v1', revision: 'synthetic-brief-revision', contentHash: '0'.repeat(64), ...subject,
    observations: [{ id: 'synthetic-observation', text: 'Selected reports describe a light feel; another describes a richer feel.',
      kind: 'reported_experience', scope: 'feel_context', sourceIds: ['synthetic-source-1'], opposingSourceIds: ['synthetic-source-2'] }],
    sources: [source('synthetic-source-1', 'https://www.reddit.com/r/SkincareAddiction/comments/synthetic1/example/'),
      source('synthetic-source-2', 'https://www.reddit.com/r/SkincareAddiction/comments/synthetic2/example/')],
    coverageLimit: 'Synthetic validation fixture; not market evidence. Selected sources do not establish consensus or predict your experience.',
    reviewedAt: '2026-10-01T12:00:00Z', reviewerId: 'synthetic-reviewer', reviewDecision: 'approved_local_fixture', validUntil: '2026-10-03T10:00:00Z',
  };
  return seal(value);
}
function seal(value: ProductResearchBrief): ProductResearchBrief { value.contentHash = researchBriefHash(value); return value; }
const admit = (value: unknown) => admitResearchBrief(value, { now, expectedSubject: subject, allowLocalFixture: true });

function foundation(): PartFourPacket {
  const input = p3input();
  const result = evaluatePersonalResult(input);
  const packet = assembleFoundation({ context: input.context, partTwo: input.partTwo, requestedUse: input.requestedUse,
    intent: input.binding.intent, candidateRoutineItemId: null, selectedComparatorId: null }, result);
  assert(packet);
  return packet;
}

test('admission retains exact reviewed observations and checks canonical bytes with an independent SHA-256 implementation', () => {
  const value = fixture();
  const { contentHash, ...content } = value;
  assert.equal(contentHash, createHash('sha256').update(canonicalJson(content)).digest('hex'));
  const admitted = admit(value);
  assert(admitted);
  assert.deepEqual(admitted, value);
  assert.equal(admitted.observations[0].text, value.observations[0].text);
  assert(Object.isFrozen(admitted));
  value.observations[0].text = 'Changed after review';
  assert.equal(admit(value), null, 'Altered prose cannot reuse a reviewed hash');
  assert.notEqual(admitted.observations[0].text, value.observations[0].text, 'Admission must not retain a mutable caller object');
});

test('approval, reviewer, chronology and all lifecycle deadlines are required', () => {
  for (const mutate of [
    (v: ProductResearchBrief) => { v.reviewDecision = 'unreviewed' as ProductResearchBrief['reviewDecision']; },
    (v: ProductResearchBrief) => { v.reviewerId = ' '; },
    (v: ProductResearchBrief) => { v.reviewedAt = '2026-10-03T10:00:00Z'; },
    (v: ProductResearchBrief) => { v.sources[0].retrievedAt = '2026-10-01T13:00:00Z'; },
    (v: ProductResearchBrief) => { v.sources[0].publishedAt = '2026-10-01T11:00:00Z'; },
    (v: ProductResearchBrief) => { v.validUntil = now; },
    (v: ProductResearchBrief) => { v.sources[0].permission.validUntil = now; },
    (v: ProductResearchBrief) => { v.sources[0].permission.validUntil = '2026-10-02T11:00:00Z'; },
  ]) { const value = fixture(); mutate(value); assert.equal(admit(seal(value)), null); }
  assert.equal(admitResearchBrief(fixture(), { now: 'invalid', expectedSubject: subject, allowLocalFixture: true }), null);
  assert.equal(admitResearchBrief(fixture(), { now: fixture().validUntil, expectedSubject: subject, allowLocalFixture: true }), null);
});

test('full source JSON permission and revocation fail closed, including supporting and opposing sources', () => {
  for (const field of ['process', 'store', 'display', 'export'] as const) {
    const value = fixture(); value.sources[0].permission[field] = false as true;
    assert.equal(admit(seal(value)), null, field);
  }
  for (const index of [0, 1]) { const value = fixture(); value.sources[index].permission.revoked = true as false; assert.equal(admit(seal(value)), null); }
  const value = fixture();
  for (const dependency of [value.revision, value.contentHash, value.productId, value.variantId, value.formulaVersionId!,
    ...value.sources.flatMap(source => [source.id, source.permission.grantId, source.permission.version])]) {
    assert.equal(admitResearchBrief(value, { now, expectedSubject: subject, withdrawnDependencies: [dependency], allowLocalFixture: true }), null, dependency);
  }
});

test('the brief and every source must associate with the current exact product, variant and formula', () => {
  for (const field of ['productId', 'variantId', 'formulaVersionId'] as const) {
    const value = fixture(); value[field] = 'foreign'; assert.equal(admit(seal(value)), null);
    const sourceMismatch = fixture(); sourceMismatch.sources[1][field] = 'foreign'; assert.equal(admit(seal(sourceMismatch)), null);
    assert.equal(admitResearchBrief(fixture(), { now, expectedSubject: { ...subject, [field]: 'foreign' }, allowLocalFixture: true }), null);
  }
  const noFormula = fixture(); noFormula.sources[0].formulaVersionId = null;
  assert.equal(admit(seal(noFormula)), null, 'Exact-formula matching cannot omit the formula identity');
  assert.equal(admitResearchBrief(fixture(), { now, expectedSubject: { ...subject, formulaVersionId: null }, allowLocalFixture: true }), null);
});

test('formula-unknown exact variant sources permit only reviewed feel context', () => {
  const value = fixture(); value.formulaVersionId = null;
  for (const source of value.sources) { source.formulaVersionId = null; source.matching = 'exact_variant'; }
  assert(admit(seal(value)), 'Variant feel context can be used without a formula assertion');
  assert(admitResearchBrief(value, { now, expectedSubject: { ...subject, formulaVersionId: null }, allowLocalFixture: true }));
  value.observations[0].scope = 'formula_context';
  assert.equal(admit(seal(value)), null, 'Unknown formula cannot support formula-specific context');
  const mixed = fixture(); mixed.sources[1].matching = 'exact_variant'; mixed.sources[1].formulaVersionId = null;
  mixed.observations[0].scope = 'formula_context';
  assert.equal(admit(seal(mixed)), null, 'Opposing as well as supporting formula references require exact formula matching');
});

test('source references are complete and independent; duplicate IDs, aliases and invented URLs cannot create plurality', () => {
  for (const mutate of [
    (v: ProductResearchBrief) => { v.observations[0].sourceIds = []; },
    (v: ProductResearchBrief) => { v.observations[0].sourceIds = ['missing']; },
    (v: ProductResearchBrief) => { v.observations[0].opposingSourceIds = ['missing']; },
    (v: ProductResearchBrief) => { v.observations[0].opposingSourceIds = ['synthetic-source-1']; },
    (v: ProductResearchBrief) => { v.sources[1].id = v.sources[0].id; },
    (v: ProductResearchBrief) => { v.sources[1].url = 'https://old.reddit.com/r/SkincareAddiction/comments/synthetic1/other_title/?utm_source=duplicate'; },
    (v: ProductResearchBrief) => { v.sources[1].url = 'https://www.reddit.com/r/SkincareAddiction/comments/%73ynthetic1/encoded_alias/'; },
    (v: ProductResearchBrief) => { v.sources[1].url = 'https://example.test/fictional'; },
    (v: ProductResearchBrief) => { v.sources[1].url = 'http://www.reddit.com/r/SkincareAddiction/comments/synthetic2/'; },
    (v: ProductResearchBrief) => { v.sources[1].url = 'https://user:secret@www.reddit.com/r/SkincareAddiction/comments/synthetic2/'; },
    (v: ProductResearchBrief) => { v.sources[1].url = 'https://127.0.0.1/source'; },
    (v: ProductResearchBrief) => { v.sources.push({ ...v.sources[1], id: 'unreferenced', url: 'https://www.reddit.com/r/SkincareAddiction/comments/synthetic3/' }); },
  ]) { const value = fixture(); mutate(value); assert.equal(admit(seal(value)), null); }
});

test('source types cannot relabel manufacturer claims as personal reports', () => {
  const value = fixture(); value.sources[0].kind = 'manufacturer';
  assert.equal(admit(seal(value)), null);
  value.observations[0].kind = 'editorial_observation';
  assert(admit(seal(value)), 'Manufacturer observations remain available as clearly labelled editorial observations');
  value.sources[0].kind = 'personal_anecdote';
  assert.equal(admit(seal(value)), null, 'An editorial observation needs an editorial or manufacturer source');
});

test('one eligible source is admitted with reviewed coverage and a visible mechanical limit; fixture opt-in is explicit', () => {
  const value = fixture();
  value.sources = value.sources.slice(0, 1); value.observations[0].opposingSourceIds = [];
  value.observations[0].text = 'This selected synthetic report describes a light feel.';
  value.coverageLimit = 'Synthetic validation fixture; broader coverage is unavailable. Not market evidence.';
  seal(value);
  assert(admit(value));
  assert.equal(admitResearchBrief(value, { now, expectedSubject: subject }), null, 'Fixtures are refused by default');
  const blocked = componentHarness(component, 'ResearchBrief', { brief: value, state: 'ready', now: Date.parse(now), expectedSubject: subject });
  assert.equal(textContent(blocked.render()), 'Selected-source reports are unavailable.');
  const visible = componentHarness(component, 'ResearchBrief', { brief: value, state: 'ready', now: Date.parse(now), expectedSubject: subject, allowLocalFixture: true });
  assert.match(textContent(visible.render()), /One selected source · Broader source coverage is unavailable/);
  assert.match(textContent(visible.render()), /Synthetic validation example · Not market evidence/);
});

test('the brief has one or two observations; duplicate or blank approved observations are rejected', () => {
  for (const mutate of [
    (v: ProductResearchBrief) => { v.observations = []; },
    (v: ProductResearchBrief) => { v.observations.push({ ...v.observations[0] }); },
    (v: ProductResearchBrief) => { v.observations[0].text = ' '; },
    (v: ProductResearchBrief) => { v.coverageLimit = ' '; },
    (v: ProductResearchBrief) => { v.sources[0].coverageLimit = ' '; },
  ]) { const value = fixture(); mutate(value); assert.equal(admit(seal(value)), null); }
  const value = fixture(); value.observations.push({ ...value.observations[0], id: 'second-observation', text: 'This second synthetic observation preserves the same source limits.' });
  assert(admit(seal(value)));
  value.observations.push({ ...value.observations[0], id: 'third-observation' }); assert.equal(admit(seal(value)), null);
});

test('brief rendering preserves approved text and visible coverage without turning fixtures into market claims', () => {
  const value = fixture(); let sourcePresses = 0;
  const h = componentHarness(component, 'ResearchBrief', { brief: value, state: 'ready', now: Date.parse(now), expectedSubject: subject, allowLocalFixture: true, onViewSources: () => sourcePresses++ });
  const nodes = h.render(); const copy = textContent(nodes);
  assert.match(copy, /What people report/);
  assert(copy.includes(value.observations[0].text));
  assert(copy.includes(value.coverageLimit));
  assert.match(copy, /Based on selected sources/);
  assert.match(copy, /Synthetic validation example · Not market evidence/);
  assert(!copy.includes(value.reviewerId)); assert(!copy.includes(value.sources[0].permission.grantId));
  assert(!copy.includes('%')); assert(!copy.includes('review count')); assert(!copy.includes('average rating'));
  press(control(nodes, 'View research brief sources')); assert.equal(sourcePresses, 1);
  assert(nodes.filter(node => node.type === 'Text').every(node => node.props.numberOfLines === undefined));
});

test('sources render actual supplied URLs, dates, source kinds and each limitation only from a current admitted brief', () => {
  const value = fixture(); const opened: string[] = [];
  const h = componentHarness(component, 'ResearchBriefSources', { brief: value, expectedSubject: subject, now: Date.parse(now), allowLocalFixture: true }, {
    modules: { 'react-native': { View: 'View', Text: 'Text', Pressable: 'Pressable', StyleSheet: { create: (s: unknown) => s }, Linking: { openURL: async (url: string) => { opened.push(url); } } } },
  });
  let nodes = h.render(); const copy = textContent(nodes);
  assert.match(copy, /Personal experience report/); assert.match(copy, /Retrieved 2026-10-01/); assert.match(copy, /Published 2026-09-30/);
  for (const source of value.sources) assert(copy.includes(source.coverageLimit));
  press(control(nodes, 'Open research brief source 1')); assert.deepEqual(opened, [value.sources[0].url]);
  nodes = h.render({ now: Date.parse(value.validUntil) }); assert.equal(textContent(nodes), '');
  assert(!nodes.some(node => node.props.accessibilityRole === 'link'));
});

test('expiry, source withdrawal, absent subject and pending state immediately remove approved observations and links', () => {
  const value = fixture();
  const h = componentHarness(component, 'ResearchBrief', { brief: value, state: 'ready', now: Date.parse(now), expectedSubject: subject, allowLocalFixture: true });
  assert(textContent(h.render()).includes(value.observations[0].text));
  for (const props of [ { now: Date.parse(value.validUntil) }, { now: Date.parse(now), withdrawnDependencies: [value.sources[1].id] },
    { withdrawnDependencies: [], expectedSubject: null }, { expectedSubject: subject, state: 'pending' }, { state: 'unavailable' }, { state: 'conflict' } ]) {
    const nodes = h.render(props); assert(!textContent(nodes).includes(value.observations[0].text));
    assert(!nodes.some(node => node.props.accessibilityRole === 'link'));
    assert.equal(nodes.filter(node => node.type === 'Text').length, 1, 'Unavailable evidence is one readable line');
  }
});

test('inert text formatting never executes brief text or turns arbitrary content into links', () => {
  const value = fixture(); value.observations[0].text = 'Reported feel\u202e <script>alert(1)</script>'; seal(value);
  const nodes = componentHarness(component, 'ResearchBrief', { brief: value, state: 'ready', expectedSubject: subject, now: Date.parse(now), allowLocalFixture: true }).render();
  assert.match(textContent(nodes), /\[U\+202E\]/); assert(textContent(nodes).includes('<script>alert(1)</script>'));
  assert(!nodes.some(node => node.props.dangerouslySetInnerHTML));
});

test('admitted brief is first below the recommendation and shares the existing bottom Sources disclosure', () => {
  const packet = foundation(); const brief = fixture();
  packet.reviews = { state: 'ready', evidenceKind: 'limited_research_brief', brief, explanation: 'Selected checked sources provide a limited brief.', sourceIds: brief.sources.map(source => source.id) };
  const h = componentHarness('src/components/check/part-four/PartFourSections.tsx', 'PartFourSections', { packet, researchSubject: subject, now: Date.parse(now), allowLocalResearchFixture: true });
  let nodes = h.render(); let copy = textContent(nodes);
  assert(copy.indexOf('What people report') < copy.indexOf('Compared with your current routine'));
  assert(!copy.includes('Review themes · Available evidence'), 'The research card is not duplicated in the old optional section');
  press(control(nodes, 'View research brief sources')); nodes = h.render(); copy = textContent(nodes);
  assert.equal(nodes.filter(node => node.type === 'Pressable' && node.props.accessibilityLabel === 'Part Four sources').length, 1);
  assert(control(nodes, 'Part Four sources').props.accessibilityState.expanded);
  assert(copy.includes(brief.sources[0].url));
  assert(nodes.indexOf(control(nodes, 'Part Four sources')) < nodes.indexOf(control(nodes, 'Open research brief source 1')));
  assert(!textContent(h.render({ researchSubject: { ...subject, variantId: 'foreign' } })).includes(brief.observations[0].text));
});
