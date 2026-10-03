import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { componentHarness, textContent } from './ux-profile-render.ts';
import { p3input, p3revision } from './fixtures/part-three.ts';
import { p2id } from './fixtures/part-two-core.ts';
import { evaluatePersonalResult } from '../src/domain/part-three/evaluate.ts';
import { assembleFoundation } from '../src/domain/part-four/assemble.ts';
import type { PartThreeView } from '../src/presentation/part-three/controller.ts';

// Removing canonical details when P4 is present must lose these independently
// declared dates/use qualifiers, rather than merely changing a component name.
function fixture() {
  const x = p3input();
  if (x.binding.subject.kind !== 'declaration') throw Error('Declaration fixture required');
  x.binding.subject.productId = p2id(50);
  const period = { start: { state: 'known' as const, value: { value: '2020', precision: 'year' as const } }, end: { state: 'unsure' as const } };
  const use = { timing: 'unknown' as const, frequency: { kind: 'unknown' as const }, startedOn: { state: 'withheld' as const }, stoppedOn: { state: 'unsure' as const }, duration: null };
  x.context.experiences = [
    p3revision(p2id(51), { id: p2id(52), reference: { kind: 'catalog' as const, productId: p2id(50), variantId: null, formulaVersionId: null }, kind: 'reacted' as const, occurred: period, useContext: use, symptoms: [], note: null }),
    p3revision(p2id(53), { id: p2id(54), reference: { kind: 'manual' as const, name: 'Previously tried lotion' }, kind: 'ineffective' as const, occurred: period, useContext: use, symptoms: [], note: null }),
  ];
  x.selectedManualReportIds = [p2id(54)];
  x.binding.encounterInputs.selectedManualReportIds = [...x.selectedManualReportIds];
  x.history.activeRevisionIds = x.context.experiences.map(report => report.id);
  const result = evaluatePersonalResult(x);
  result.partFour = assembleFoundation({ context: x.context, partTwo: x.partTwo, requestedUse: x.requestedUse, intent: x.binding.intent, candidateRoutineItemId: null, selectedComparatorId: null }, result)!;
  const view: PartThreeView = { target: null, result, question: null, historical: null, savedAssessmentId: null, savedAt: null, loading: false, saving: false, error: null };
  const check = { enabled: true, view, context: null, choices: { intent: 'add', comparatorId: null, candidateRoutineItemId: null, selectedManualReportIds: [], use: x.requestedUse }, displayLabels: {}, interact() {}, exposeQuestion() {}, save() {}, refresh() {} };
  return { x, result, view, check };
}
const surface = { ResultSheetSurface: (props: any) => React.createElement('Surface', props, props.summary, props.compactActions, props.children) };
function assertReports(copy: string) {
  assert.match(copy, /reaction with this product family/);
  assert.match(copy, /did not help for the report you selected/);
  assert.match(copy, /Reported period: 2020 \(year precision\) to unsure/);
  assert.match(copy, /product family; its formula version is unconfirmed/);
  assert.match(copy, /Manual report association; exact formula identity is unconfirmed/);
  assert.match(copy, /frequency unknown; started withheld; stopped unsure/);
}

test('mounted current P4 Check retains canonical family/manual report periods and uncertain use', t => {
  const f = fixture();
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse(f.x.now) });
  const details = { target: { ownerId: f.x.context.ownerId, scanId: f.x.partTwo.scanId, captureSessionId: null, generation: f.x.partTwo.generation, evidenceRevision: f.x.partTwo.evidenceRevision }, result: f.x.partTwo, loading: false, error: null };
  const p1 = { scanId: f.x.partTwo.scanId, generation: f.x.partTwo.generation, resultRevision: f.x.partTwo.evidenceRevision, declarationState: 'partial', identity: 'exact', work: 'complete', snapshotId: p2id(12), declarationId: p2id(10), scope: 'public', freshness: { state: 'fresh', observedAt: f.x.now, expiresAt: f.x.partTwo.expiresAt }, display: { selectedIdentity: null, candidates: [], sections: [], sources: [], limitations: [] }, allowedActions: [] };
  const h = componentHarness('src/components/check/part-one/PartOneResultSheet.tsx', 'PartOneResultSheet', { view: { owner: f.x.context.ownerId, result: p1, saved: false, loading: false, error: null }, onClose() {}, onRefresh() {}, onSelect() {}, onSave() {}, onSearch() {}, onFullChange() {} }, { modules: {
    '../result-sheet/ResultSheetSurface': surface,
    '../part-three/usePartThreeCheck': { usePartThreeCheck: () => f.check },
    '../part-two/PartTwoIngredients': { usePartTwoView: () => details, PartTwoIngredientsView: 'PartTwoIngredientsView' },
    '../../ui/Button': { Button: 'Button' }, '../../ui/ChoiceChip': { ChoiceChip: 'ChoiceChip' },
  } });
  assertReports(textContent(h.render()));
  f.check.view = { ...f.view, result: null };
  assert(!textContent(h.render()).includes('2020 (year precision)'), 'Withdrawn current result must remove report bytes');
});

test('saved P4 sheet retains historical report qualifiers independently of current reassessment', t => {
  const f = fixture();
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse(f.x.now) });
  f.check.view = { ...f.view, result: null, historical: { kind: 'historical', savedAssessmentId: p2id(80), savedAt: f.x.now, assessmentWhenSaved: f.result, currentAssessment: 'unavailable' } };
  const h = componentHarness('src/components/check/part-three/PartThreeSavedAssessmentSheet.tsx', 'PartThreeSavedAssessmentSheet', { ownerId: f.x.context.ownerId, savedAssessmentId: p2id(80), onClose() {} }, { modules: {
    '../result-sheet/ResultSheetSurface': surface, './usePartThreeCheck': { usePartThreeCheck: () => f.check },
    '../../ui/Button': { Button: 'Button' }, '../../ui/ChoiceChip': { ChoiceChip: 'ChoiceChip' },
  } });
  const copy = textContent(h.render());
  assert.match(copy, /Assessment when saved/);
  assertReports(copy);
  f.check.view = { ...f.view, result: null };
  assert(!textContent(h.render()).includes('2020 (year precision)'), 'Refused historical read must remove report bytes');
});
