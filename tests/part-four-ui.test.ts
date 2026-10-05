import assert from 'node:assert/strict';
import test from 'node:test';
import type { PartFourPacket } from '../src/contracts/PartFour.ts';
import { PartFourPacketSchema } from '../src/contracts/PartFour.ts';
import { normalize, LOCAL_DICTIONARY_RELEASE } from '../src/domain/part-two/index.ts';
import { authorizedPartFourPacket, formulaLimitationsForDisplay, ingredientTargets, ingredientRow, partFourDisclosureKey, partFourDisplayText, visiblePartFourInsights } from '../src/presentation/part-four/sections.ts';
import { boundDeclaration, sourceReading, p2metadata, p2now, p2expiry } from './fixtures/part-two-core.ts';
import { componentHarness, control, press, textContent } from './ux-profile-render.ts';

const component = 'src/components/check/part-four/PartFourSections.tsx';
const now = Date.parse(p2now);
test('OBF reuse attribution appears only in an authorized open source disclosure', () => {
  const value = packet('Water', true);
  value.formula.sourceRefs[0].sourceUrl = 'https://world.openbeautyfacts.org/product/123';
  const h = componentHarness(component, 'PartFourSections', { packet: value, now });
  assert(!textContent(h.render()).includes('Data licence and reuse'));
  press(control(h.render(), 'Part Four sources'));
  assert.match(textContent(h.render()), /Open Beauty Facts contributors · Database ODbL · Contents DbCL/);
  assert.equal(control(h.render(), 'Open Beauty Facts data licence and reuse').props.accessibilityRole, 'link');
  assert(!textContent(componentHarness(component, 'PartFourSections', { packet: value, now, withdrawn: true, sourcesExpanded: true }).render()).includes('Data licence and reuse'));
});
function packet(text = 'Glycerin, Glycerin, Water, Mystery compound', published = false): PartFourPacket {
  const normalized = normalize(published ? boundDeclaration(text, 'public') : sourceReading(text), LOCAL_DICTIONARY_RELEASE, p2metadata);
  assert.equal(normalized.state, 'ready');
  if (normalized.state !== 'ready') throw Error('Fixture requires ready Part Two');
  const reading = normalized.output.reading;
  return PartFourPacketSchema.parse({
    version: 'part-four-foundations/v1', releaseId: 'fixture-release', contextRevision: 1,
    formula: { version: 'formula-analysis/v1', knowledgeVersion: 'fixture-knowledge', knowledgeHash: 'c'.repeat(64),
      partTwoBindingKey: normalized.bindingKey, partTwoRevision: normalized.resultRevision, dependencyDigest: reading.binding.dependencyDigest,
      binding: reading.binding, versions: reading.versions, sourceRefs: reading.dependencyManifest.sourceRefs, facts: reading.facts,
      expiresAt: reading.expiresAt, scope: reading.scope, evidenceState: reading.evidenceState,
      ingredients: reading.occurrences.map(occurrence => {
        const ingredientId = occurrence.mapping.state === 'resolved' ? occurrence.mapping.ingredientId : null;
        return { occurrenceId: occurrence.occurrenceId, occurrence, observedName: occurrence.observedName, ingredientId,
          modality: occurrence.modality, quantityText: null, card: ingredientId ? {
            ingredientId, name: occurrence.observedName, aliases: [], short: `${occurrence.observedName} has an approved general ingredient explanation.`,
            label: 'Ingredient contribution', body: 'Approved general explanation; personal experience is unknown.',
            detail: 'The ingredient reference concerns general function.', evidence: 'Ingredient evidence does not establish a finished product result.',
            sourceIds: ['reference-1'], version: 'fixture-knowledge' } : null };
      }), sources: [{ id: 'reference-1', title: 'Approved ingredient reference', url: 'https://example.test/reference', reviewedAt: p2now, kind: 'approved_editorial' }],
      limitations: ['Formula evidence does not establish personal comfort.'] },
    insights: [{ id: 'insight-1', ruleId: 'F02', state: 'limited', title: 'Your supplied experience', explanation: 'Current benefit is not recorded.', action: null,
      contextRevisionIds: ['context-1'], factIds: [], occurrenceIds: [reading.occurrences[1]?.occurrenceId ?? reading.occurrences[0].occurrenceId], sourceIds: [] }],
    comparison: { state: 'none', routineItemId: null, explanation: 'No current routine item is available for direct comparison.', candidateIds: [] },
    reviews: { state: 'pending', explanation: 'An eligible aggregate review corpus is not available.', sourceIds: [] },
    value: { state: 'unavailable', explanation: 'No current eligible offer is available.', sourceIds: [] },
    requiredEvidence: ['G03', 'G04'], decisionState: 'pending', action: 'Review the available evidence.',
  });
}

test('render fence pins the current Part Two authority and fails closed at all deadlines', () => {
  const value = packet();
  assert.equal(authorizedPartFourPacket(value, { now, expectedBindingKey: value.formula.partTwoBindingKey,
    expectedResultRevision: value.formula.partTwoRevision, expectedDependencyDigest: value.formula.dependencyDigest }), value);
  for (const fence of [{ withdrawn: true }, { expectedBindingKey: 'another binding' }, { expectedResultRevision: 900 },
    { expectedDependencyDigest: 'another digest' }, { now: Date.parse(p2expiry) }, { now: Number.NaN }]) {
    assert.equal(authorizedPartFourPacket(value, { now, ...fence }), null);
  }
  for (const mutate of [
    (p: PartFourPacket) => { p.formula.expiresAt = 'invalid'; },
    (p: PartFourPacket) => { p.formula.binding.expiresAt = p2now; },
    (p: PartFourPacket) => { p.formula.sourceRefs[0].expiresAt = p2now; },
    (p: PartFourPacket) => { p.formula.facts[0].validUntil = p2now; },
    (p: PartFourPacket) => { p.formula.evidenceState = 'blocked'; },
    (p: PartFourPacket) => { p.formula.binding.bindingKey = 'different authority'; },
  ]) { const copy = structuredClone(value); mutate(copy); assert.equal(authorizedPartFourPacket(copy, { now }), null); }
});

test('exact ingredient navigation retains repeated occurrences and rejects substring guessing', () => {
  const value = packet('Glycerin, Glycerin, Ceramide NP, Ceramide AP');
  const glycerin = value.formula.ingredients.slice(0, 2);
  assert.notEqual(glycerin[0].occurrenceId, glycerin[1].occurrenceId);
  assert.deepEqual(ingredientTargets(value.formula, { name: 'Glycerin' }), glycerin.map(i => i.occurrenceId));
  assert.deepEqual(ingredientTargets(value.formula, { ingredientId: glycerin[0].ingredientId! }), glycerin.map(i => i.occurrenceId));
  assert.deepEqual(ingredientTargets(value.formula, { occurrenceId: glycerin[1].occurrenceId }), [glycerin[1].occurrenceId]);
  assert.deepEqual(ingredientTargets(value.formula, { name: 'Ceramide' }), []);
  assert.deepEqual(ingredientTargets(value.formula, { name: 'glycerin' }), []);
  const jumps: string[] = [];
  const h = componentHarness(component, 'PartFourSections', { packet: value, now, onIngredientJump: (id: string) => jumps.push(id) });
  press(control(h.render(), 'Explore ingredient: Glycerin, position 2'));
  const nodes = h.render();
  assert.deepEqual(jumps, [glycerin[1].occurrenceId]);
  assert.equal(control(nodes, 'Ingredient details: Glycerin, position 1').props.accessibilityState.expanded, false);
  assert.equal(control(nodes, 'Ingredient details: Glycerin, position 2').props.accessibilityState.expanded, true);
  const detail = nodes.indexOf(control(nodes, 'Ingredient explanation, position 2'));
  assert(detail < nodes.indexOf(control(nodes, 'Ingredient details: Ceramide NP, position 3')));
});

test('all formula positions, short explanations and long copy remain readable in the v7 section order', () => {
  const value = packet(['Glycerin', ...Array.from({ length: 42 }, (_, index) => `Unmapped ingredient ${index + 1}`)].join(', '));
  const longName = 'Unmapped ingredient with an unusually long literal name '.repeat(15);
  value.formula.ingredients[42].observedName = longName;
  value.formula.ingredients[0].card!.short = 'Approved short explanation '.repeat(50);
  value.formula.ingredients[0].card!.body = 'Full explanation remains readable. '.repeat(80);
  const h = componentHarness(component, 'PartFourSections', { packet: value, now });
  let nodes = h.render();
  assert.equal(nodes.filter(node => node.type === 'Pressable' && String(node.props.accessibilityLabel).startsWith('Ingredient details:')).length, 43);
  assert(textContent(nodes).includes(longName));
  assert(textContent(nodes).includes(value.formula.ingredients[0].card!.short));
  assert(nodes.filter(node => node.type === 'Text').every(node => node.props.numberOfLines === undefined));
  assert.deepEqual(nodes.filter(node => node.type === 'Text' && node.props.accessibilityRole === 'header').map(node => node.props.children),
    ['Relevant to your profile', 'Ingredients']);
  press(control(nodes, 'Ingredient details: Glycerin, position 1')); nodes = h.render();
  assert(textContent(nodes).includes(value.formula.ingredients[0].card!.body));
  assert.match(textContent(nodes), /43 listed/);
  assert.match(textContent(nodes), /Amount in this formula: not disclosed/);
  assert(!textContent(nodes).includes('Approved ingredient reference'), 'Sources starts closed');
  press(control(nodes, 'View sources for Glycerin, position 1')); nodes = h.render();
  assert(control(nodes, 'Part Four sources').props.accessibilityState.expanded);
  assert.match(textContent(nodes), /Approved ingredient reference.*Reviewed 2026-10-02/);
  assert(nodes.indexOf(control(nodes, 'Part Four sources')) > nodes.indexOf(control(nodes, `Ingredient details: ${longName}, position 43`)));
});

test('ingredient buttons expose their visible function, presence qualifiers and material amount limits to accessibility', () => {
  const value = packet('Glycerin, Mystery compound');
  const nodes = componentHarness(component, 'PartFourSections', { packet: value, now }).render();
  const known = control(nodes, 'Ingredient details: Glycerin, position 1').props.accessibilityLabel;
  assert.match(known, /Glycerin has an approved general ingredient explanation/);
  assert.match(known, /Ingredient contribution/);
  assert.match(known, /Amount in this formula: not disclosed/);
  assert.match(control(nodes, 'Ingredient details: Mystery compound, position 2').props.accessibilityLabel,
    /An explanation is unavailable for this name.*Knowledge unavailable.*Amount in this formula: not disclosed/);
  const conditional = packet('May contain (+/-): CI 77491');
  const conditionalNodes = componentHarness(component, 'PartFourSections', { packet: conditional, now }).render();
  assert.match(control(conditionalNodes, 'Ingredient details: CI 77491, position 1').props.accessibilityLabel,
    /May contain · Definite presence is not established/);
  const printed = packet('Salicylic Acid (2%)');
  const printedNodes = componentHarness(component, 'PartFourSections', { packet: printed, now }).render();
  assert.match(control(printedNodes, 'Ingredient details: Salicylic Acid, position 1').props.accessibilityLabel,
    /Printed amount: 2%.*does not specify whether this amount is by weight or volume/);
});

test('conditional, unclear, unmapped and quantity entries preserve Part Two wording instead of becoming presence claims', () => {
  const value = packet('Salicylic Acid (2% w/w), Mystery compound');
  const conditionalPacket = packet('May contain (+/-): CI 77491, CI 77492');
  const h = componentHarness(component, 'PartFourSections', { packet: value, now });
  let nodes = h.render();
  assert.match(textContent(nodes), /Printed amount: 2% w\/w/);
  assert.match(textContent(componentHarness(component, 'PartFourSections', { packet: conditionalPacket, now }).render()), /May contain · Definite presence is not established/);
  assert.match(textContent(nodes), /An explanation is unavailable for this name/);
  const id = value.formula.ingredients[0].occurrenceId;
  press(control(nodes, 'Ingredient details: Salicylic Acid, position 1')); nodes = h.render();
  assert.match(textContent(nodes), /Listed as: Salicylic Acid \(2% w\/w\)/);
  assert.equal(control(nodes, 'Ingredient details: Salicylic Acid, position 1').props.accessibilityState.expanded, true);
  const mismatch = structuredClone(value.formula.ingredients[0]); mismatch.card!.ingredientId = 'different-ingredient';
  assert.equal(ingredientRow(mismatch).card, null, 'An editorial card cannot be attached to another identity');
  const conditional = conditionalPacket.formula.ingredients.find(i => i.modality === 'may_contain')!;
  assert.equal(ingredientTargets(conditionalPacket.formula, { occurrenceId: conditional.occurrenceId })[0], conditional.occurrenceId);
  const changed = structuredClone(value); changed.formula.ingredients[0].modality = 'alternative'; changed.formula.ingredients[0].occurrence.transcription = 'uncertain';
  assert.match(ingredientRow(changed.formula.ingredients[0]).qualifiers.join(' '), /Alternative entry.*Text unclear/);
  assert(id);
});

test('withdrawal and binding replacement hide expanded private content immediately without cache resurrection', () => {
  const value = packet();
  const h = componentHarness(component, 'PartFourSections', { packet: value, now });
  press(control(h.render(), 'Ingredient details: Glycerin, position 1'));
  press(control(h.render(), 'View sources for Glycerin, position 1'));
  assert.match(textContent(h.render()), /Synthetic private label/);
  for (const props of [{ withdrawn: true }, { withdrawn: false, packet: null, loading: true }, { loading: false, packet: value, expectedBindingKey: 'new binding' },
    { expectedBindingKey: undefined, now: Date.parse(p2expiry) }]) {
    const nodes = h.render(props);
    for (const secret of ['Glycerin', 'Synthetic private label', 'Approved ingredient reference', 'Current benefit', 'example.test']) assert(!textContent(nodes).includes(secret));
    assert(!nodes.some(node => node.props.accessibilityRole === 'link'));
  }
  const next = structuredClone(value); next.contextRevision++;
  assert.notEqual(partFourDisclosureKey(next), partFourDisclosureKey(value));
  const nodes = h.render({ packet: next, now, expectedBindingKey: undefined, withdrawn: false });
  assert.equal(control(nodes, 'Ingredient details: Glycerin, position 1').props.accessibilityState.expanded, false);
  assert.equal(control(nodes, 'Part Four sources').props.accessibilityState.expanded, false);
});

test('authorized routine hints precede ingredients and only supplied actions are rendered', () => {
  const value = packet();
  value.insights.push({ ...value.insights[0], id: 'routine', ruleId: 'F03', title: 'Current routine step', explanation: 'No replacement intent has been supplied.', action: null });
  const h = componentHarness(component, 'PartFourSections', { packet: value, now });
  let copy = textContent(h.render());
  assert(copy.indexOf('In your routine') < copy.indexOf('Ingredients'));
  assert(!copy.includes(value.action), 'The single primary verdict/action belongs to the root decision block');
  value.insights[1].action = 'If you switch, replace the selected evening item.';
  copy = textContent(h.render({ packet: value }));
  assert(copy.includes(value.insights[1].action));
  value.insights[1].state = 'inapplicable';
  assert(!textContent(h.render({ packet: value })).includes('Current routine step'));
});

test('optional review and price states use honest supplied evidence with no invented numbers or anecdotes', () => {
  for (const state of ['pending', 'unavailable', 'conflict'] as const) {
    const value = packet(); value.reviews.state = state; value.value.state = state;
    const nodes = componentHarness(component, 'PartFourSections', { packet: value, now }).render();
    assert(!textContent(nodes).includes('Price & value'));
    assert(!textContent(nodes).includes('No current eligible offer is available'));
    assert(!textContent(nodes).includes('An eligible aggregate review corpus is not available.'));
    assert(!textContent(nodes).includes('$'));
    assert(!textContent(nodes).includes('/100'));
  }
  const priced = packet(); priced.value.state = 'ready'; priced.value.explanation = 'The supplied offer remains current.';
  assert.match(textContent(componentHarness(component, 'PartFourSections', { packet: priced, now }).render()), /The supplied offer remains current/);
  const value = packet(); value.comparison.state = 'ambiguous';
  assert.match(textContent(componentHarness(component, 'PartFourSections', { packet: value, now }).render()), /More than one current item could apply/);
});

test('internal formula codes stay out of product copy and detailed evidence limits use the bottom Sources disclosure', () => {
  const value = packet();
  value.formula.limitations = ['approved_editorial_local_only', 'reference_roles_not_finished_product_efficacy',
    'ingredient_order_not_concentration', 'ingredient_concentrations_unknown', 'unrecognized_internal_policy_code',
    'Formula evidence does not establish personal comfort.'];
  const limits = formulaLimitationsForDisplay(value.formula);
  assert.deepEqual(limits, ['Ingredient references describe general functions; they do not establish the finished product’s results.',
    'Ingredient order does not establish percentages or effective amounts.', 'Some ingredient amounts are not disclosed.',
    'Formula evidence does not establish personal comfort.']);
  const h = componentHarness(component, 'PartFourSections', { packet: value, now });
  assert.match(textContent(h.render()), /Partial list · Missing text remains unknown/);
  assert(!textContent(h.render()).includes(limits[1]), 'Detailed concentration limits do not precede the full list');
  press(control(h.render(), 'Part Four sources'));
  const copy = textContent(h.render());
  for (const limit of limits) assert(copy.includes(limit));
  for (const code of value.formula.limitations.filter(limit => limit.includes('_'))) assert(!copy.includes(code));
});

test('comparison preserves material constraints without repeating every generic unknown foundation', () => {
  const value = packet();
  value.insights = (['F01', 'F02', 'F03', 'F04', 'F05', 'F06', 'F07', 'F08', 'F09', 'F10'] as const)
    .map(ruleId => ({ ...value.insights[0], id: ruleId, ruleId, title: `Title for ${ruleId}`, state: 'unknown' }));
  assert.deepEqual(visiblePartFourInsights(value).comparison.map(insight => insight.ruleId), ['F01', 'F02']);
  assert.deepEqual(visiblePartFourInsights(value).routine, []);
  value.comparison.state = 'selected';
  assert.deepEqual(visiblePartFourInsights(value).comparison.map(insight => insight.ruleId), ['F01', 'F02', 'F04', 'F07']);
  assert.deepEqual(visiblePartFourInsights(value).routine.map(insight => insight.ruleId), ['F06']);
  value.insights.find(insight => insight.ruleId === 'F05')!.state = 'conflict';
  assert(visiblePartFourInsights(value).comparison.some(insight => insight.ruleId === 'F05'), 'Conflict remains visible');
  value.insights.find(insight => insight.ruleId === 'F03')!.state = 'supported';
  assert(visiblePartFourInsights(value).routine.some(insight => insight.ruleId === 'F03'), 'Supported routine action remains visible');
});

test('published Part Two attribution and control characters remain explicit and source links allow only HTTPS', () => {
  const value = packet('Glycerin', true);
  value.formula.ingredients[0].observedName = 'Gly\u202ecerin';
  value.formula.sources[0].url = 'javascript:alert(1)';
  const h = componentHarness(component, 'PartFourSections', { packet: value, now });
  const nodes = h.render();
  assert.match(textContent(nodes), /Published list · Package not confirmed/);
  assert.match(textContent(nodes), /Gly\[U\+202E\]cerin/);
  assert(!textContent(nodes).includes('\u202e'));
  assert.equal(partFourDisplayText('Exact Water name'), 'Exact Water name');
  press(control(nodes, 'Part Four sources'));
  assert(!h.render().some(node => node.props.accessibilityRole === 'link'));
});


test('ingredient detail omits a duplicate alias paragraph and keeps an explicit unavailable caution',()=>{
 const p=packet('Water');const card=p.formula.ingredients[0].card!;card.evidence='Water is also called Aqua.';card.editorial={amountAndUse:null,caution:null,aliasNotes:'Water is also called Aqua.',distinctIngredients:null,qualifications:[],copySha256:'synthetic',documentId:'synthetic',libraryFileId:'synthetic',libraryVersion:0,documentSha256:'synthetic'};
 const h=componentHarness(component,'PartFourSections',{packet:p,now});press(control(h.render(),'Explore ingredient: Water, position 1'));const copy=textContent(h.render());assert.equal(copy.split('Water is also called Aqua.').length-1,1);assert.match(copy,/No specific caution.*reference/i);
});

test('absent caution is qualified once while distinct scientific limits and approved copy remain',()=>{
 const p=packet('Glycerin');const card=p.formula.ingredients[0].card!;
 card.editorial={amountAndUse:null,caution:null,aliasNotes:null,distinctIngredients:null,qualifications:['A null caution is not a universal safety assertion.','No standalone caution was written in this approved entry; this is not an assurance of universal tolerance.','The study tested one formula, not this finished product.'],copySha256:'synthetic',documentId:'synthetic',libraryFileId:'synthetic',libraryVersion:0,documentSha256:'synthetic'};
 const before=JSON.stringify(card);const h=componentHarness(component,'PartFourSections',{packet:p,now});press(control(h.render(),'Ingredient details: Glycerin, position 1'));const copy=textContent(h.render());
 assert.equal((copy.match(/No specific caution/g)??[]).length,1);assert.match(copy,/does not establish how the finished product will affect your skin/);
 assert(!copy.includes('This does not establish safety.'));assert(!copy.includes('Ingredient information does not establish'));
 for(const approved of [card.body,card.detail!,card.evidence!,'The study tested one formula, not this finished product.'])assert(copy.includes(approved));
 assert.equal(JSON.stringify(card),before);
 card.editorial.caution='Avoid if you have a confirmed allergy to this ingredient.';
 const cautioned=textContent(h.render());assert(cautioned.includes(card.editorial.caution));assert(!cautioned.includes('No specific caution'));assert(cautioned.includes('The study tested one formula, not this finished product.'));
});
