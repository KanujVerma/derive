import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import { componentHarness, control, press, textContent } from './ux-profile-render.ts';
import * as captureRuntime from '../src/presentation/part-one/capture.ts';
import * as ocrRuntime from '../src/services/partOneOcr.ts';
import { MemoryLabelDraft } from '../src/presentation/part-one/capture.ts';
import type { CaptureBinding } from '../src/presentation/part-one/capture.ts';
import * as captureReviewRuntime from '../src/presentation/part-one/captureReview.ts';
import { buildLocalDraftSummary, createCapturePhotoHandlers, createCaptureReviewHandlers, latestPhotoRefs } from '../src/presentation/part-one/captureReview.ts';
import type { LocalOcrInput, OcrObservation } from '../src/services/partOneOcr.ts';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const binding: CaptureBinding = { ownerId: id(1), sheetSessionId: id(2), scanId: id(3), generation: 1,
  captureSessionId: id(4), packageObservationId: id(5), itemId: id(6), candidateId: null, deletionEpoch: 0 };
function observation(input: LocalOcrInput, lines: string[]): OcrObservation {
  return { evidenceId: input.evidenceId, captureSessionId: input.captureSessionId, generation: input.generation,
    recognizer: 'sanitized_fixture', recognizerVersion: 'capture-ui-fixture-v1', languageConfig: input.languages,
    correctionEnabled: false, sourceWidth: 1000, sourceHeight: 1600, orientationTransform: [1, 0, 0, 0, 1, 0, 0, 0, 1],
    status: 'recognized', lines: lines.map((text, index) => ({ text, alternatives: [], region: [0.1, index / 10, 0.8, 0.05], confidence: 1 })) };
}
async function fixture(now = () => 0, arrays = [['Water,', 'Glycerin,', '1,2-Hexanediol,'], ['Glycerin,', '1,2-Hexanediol,', 'PEG-240/HDI Copolymer; CI 77891.']]) {
  const draft = new MemoryLabelDraft(now); draft.begin(binding, 173);
  for (const [index, lines] of arrays.entries()) {
    const ticket = draft.addPhoto(binding, id(10 + index), `file:///app-cache/managed-${index}.img`);
    if (ticket === 'cap_reached') throw new Error('unexpected cap');
    await draft.recognize(ticket, { recognize: async input => observation(input, lines) }, () => binding);
  }
  return draft;
}
const nativeHosts = { Image: 'Image', View: 'View', Text: 'Text', TextInput: 'TextInput', Pressable: 'Pressable',
  StyleSheet: { create: (value: unknown) => value } };
// The existing renderer has no source filename when transpiling .ts dependencies; use the real Node-loaded boundary.
const reviewModules = { 'react-native': nativeHosts, '../../../presentation/part-one/captureReview': captureReviewRuntime };

test('A14 live coverage controls preserve missing tail/glare after identity confirmation and local correction', async () => {
  const draft = await fixture(); let changes = 0;
  const ui = componentHarness('src/components/check/part-one/PartOneCaptureReview.tsx', 'PartOneCaptureReview',
    { draft, binding, onChange: () => changes++ }, { modules: reviewModules });
  let nodes = ui.render(); assert(!textContent(nodes).includes('declaration start')); press(control(nodes, 'Label options')); nodes = ui.render(); press(control(nodes, 'This is Drug Facts with active and inactive ingredients'));
  nodes = ui.render(); press(control(nodes, 'Report right edge missing or unreadable'));
  nodes = ui.render(); press(control(nodes, 'Report glare missing or unreadable'));
  nodes = ui.render(); press(control(nodes, 'Select all readable lines from photo 1'));
  nodes = ui.render(); press(control(nodes, 'Selected lines show the declaration start'));
  nodes = ui.render(); press(control(nodes, 'Correct photo 1 line 1'));
  nodes = ui.render(); control(nodes, 'Correction for photo 1 line 1').props.onChangeText('Water, 1,2-Hexanediol (as printed)');
  nodes = ui.render(); press(control(nodes, 'Apply local correction to photo 1 line 1'));
  const current = draft.read(binding)!;
  assert.equal(current.coverage.endSeen, false); assert(current.coverage.missingRegions.includes('right_edge')); assert(current.coverage.missingRegions.includes('glare'));
  assert.deepEqual(current.coverage.requiredSections, ['active', 'inactive']);
  assert.equal(current.shots[0].observations[0].lines[0].text, 'Water,');
  assert.equal(current.edits[0].actorOwnerId, binding.ownerId);
  assert.match(textContent(ui.render()), /Your correction/); assert.match(textContent(ui.render()), /Original recognition:/);
  assert.equal(buildLocalDraftSummary(current)!.canCommit, false); assert(changes > 0); draft.endSheet();
});

test('A15 live section/language/package and assembly controls preserve exact unique overlap and region lineage', async () => {
  const draft = await fixture();
  const ui = componentHarness('src/components/check/part-one/PartOneCaptureReview.tsx', 'PartOneCaptureReview',
    { draft, binding, onChange() {} }, { modules: reviewModules });
  let nodes = ui.render(); press(control(nodes, 'Label options')); nodes = ui.render(); press(control(nodes, 'This is a cosmetic ingredients label'));
  for (const photo of [1, 2]) {
    nodes = ui.render(); control(nodes, `Observed language for photo ${photo}`).props.onChangeText('en');
    nodes = ui.render(); press(control(nodes, `Apply observed language to photo ${photo}`));
    nodes = ui.render(); press(control(nodes, `Photo ${photo} is from this same physical package`));
    nodes = ui.render(); press(control(nodes, `Photo ${photo} all readable lines are Ingredients`));
    nodes = ui.render(); press(control(nodes, `Select all readable lines from photo ${photo}`));
  }
  nodes = ui.render(); press(control(nodes, 'These views overlap on the same declaration of this physical package'));
  nodes = ui.render(); press(control(nodes, 'Assemble selected overlapping views locally'));
  const assembly = draft.read(binding)!.review.assemblies[0];
  assert.deepEqual(assembly.lines.map(line => line.text), ['Water,', 'Glycerin,', '1,2-Hexanediol,', 'PEG-240/HDI Copolymer; CI 77891.']);
  assert.equal(assembly.lines[1].sources.length, 2); assert.equal(assembly.lines[2].sources.length, 2);
  assert.deepEqual(assembly.lines[2].sources.map(value => [value.evidenceId, value.observationIndex, value.lineIndex]), [[id(10), 0, 2], [id(11), 0, 1]]);
  assert.deepEqual(assembly.lines[2].sources[0].region, [0.1, 0.2, 0.8, 0.05]);
  const summary = componentHarness('src/components/check/part-one/PartOneLocalDraftSummary.tsx', 'PartOneLocalDraftSummary', { draft, binding }, { modules: reviewModules });
  assert(!textContent(summary.render()).includes('recognition 1')); press(control(summary.render(), 'Label reading source')); const rendered = textContent(summary.render()); assert.match(rendered, /overlapping views reviewed by you/); assert.match(rendered, /Photo 1/); assert.match(rendered, /recognition 1/);
  draft.endSheet();
});

test('A15 actual assembly handler rejects incompatible language/active section, isolated/repeated tokens and package conflicts', async () => {
  for (const fault of ['language', 'section', 'repeated', 'single_token', 'package_conflict'] as const) {
    const arrays = fault === 'repeated' ? [['Water,', 'Water,'], ['Water,', 'Water,', 'Glycerin,']] :
      fault === 'single_token' ? [['Water,', 'Glycerin,'], ['Glycerin,', 'Other,']] : undefined;
    const draft = await fixture(() => 0, arrays); const h = createCaptureReviewHandlers(draft, () => binding);
    h.setMode('drug_facts'); const current = draft.read(binding)!, a = latestPhotoRefs(current, id(10)), b = latestPhotoRefs(current, id(11));
    h.confirmPackage(id(10), true); h.confirmPackage(id(11), true);
    h.assignLines(a, 'active', 'en'); h.assignLines(b, fault === 'section' ? 'inactive' : 'active', fault === 'language' ? 'fr' : 'en');
    if (fault === 'package_conflict') { h.reportPackageConflict(id(11)); h.confirmPackage(id(11), true); }
    const result = h.assemble([...a, ...b], true);
    assert.equal(result.ok, false, fault); assert.equal(draft.read(binding)!.review.assemblies.length, 0);
    if (!result.ok && fault === 'package_conflict') assert.equal(result.reason, 'package_conflict');
    draft.endSheet();
  }
});

test('A16 live corrections keep supersedes history and invalidate a previously assembled preview', async () => {
  const draft = await fixture(), h = createCaptureReviewHandlers(draft, () => binding);
  const current = draft.read(binding)!, a = latestPhotoRefs(current, id(10)), b = latestPhotoRefs(current, id(11));
  h.setMode('cosmetic'); for (const idValue of [id(10), id(11)]) h.confirmPackage(idValue, true);
  h.assignLines(a, 'ingredients', 'en'); h.assignLines(b, 'ingredients', 'en'); assert.equal(h.assemble([...a, ...b], true).ok, true);
  const ui = componentHarness('src/components/check/part-one/PartOneCaptureReview.tsx', 'PartOneCaptureReview',
    { draft, binding, onChange() {} }, { modules: reviewModules });
  press(control(ui.render(), 'Label options'));
  for (const text of ['Water (Aqua),', 'Aqua (Water, Eau),']) {
    let nodes = ui.render(); press(control(nodes, 'Correct photo 1 line 1'));
    nodes = ui.render(); control(nodes, 'Correction for photo 1 line 1').props.onChangeText(text);
    nodes = ui.render(); press(control(nodes, 'Apply local correction to photo 1 line 1'));
  }
  assert.equal(draft.read(binding)!.edits[1].supersedesRevision, 1);
  assert.equal(draft.read(binding)!.shots[0].observations[0].lines[0].text, 'Water,');
  const summary = buildLocalDraftSummary(draft.read(binding))!;
  assert.equal(summary.assemblies[0].stale, true); assert(summary.reasons.includes('assembly_needs_review'));
  assert.match(textContent(ui.render()), /supersedes 1/); assert.match(textContent(ui.render()), /Original recognition:.*Water,/); draft.endSheet();
});

test('A18/A19 live-handler import, review and retry tickets cannot cross remove/expiry or owner replacement; fresh handlers recover', async () => {
  for (const reason of ['remove', 'expiry', 'owner'] as const) {
    let now = 0, actual = binding, recognitions = 0, nextId = 30;
    const draft = await fixture(() => now); const photo = () => createCapturePhotoHandlers(draft, () => actual, {
      stage: (_uri, evidenceId) => `file:///app-cache/${evidenceId}.img`, createEvidenceId: () => id(nextId++),
      recognizer: { recognize: async input => { recognitions++; return observation(input, ['Readable,']); } }, onChange() {} });
    const stalePhoto = photo(), staleReview = createCaptureReviewHandlers(draft, () => actual);
    if (reason === 'remove') draft.remove();
    if (reason === 'expiry') { now = 30 * 60 * 1000; draft.read(binding); }
    if (reason === 'owner') { actual = { ...binding, ownerId: id(80) }; draft.accountChanged(); }
    draft.begin(actual, 173);
    assert.equal(await stalePhoto.importPhoto('file:///app-cache/late-picker.jpg'), 'stale');
    assert.equal(await stalePhoto.retry(id(10)), 'stale');
    assert.equal(staleReview.markBoundary('end', [{ evidenceId: id(10), observationIndex: 0, lineIndex: 0 }]).ok, false);
    assert.equal(draft.read(actual)!.shots.length, 0); assert.equal(recognitions, 0);
    assert.equal(await photo().importPhoto('file:///app-cache/new-picker.jpg'), 'applied');
    assert.equal(draft.read(actual)!.shots.length, 1); assert.equal(recognitions, 1); draft.endSheet();
  }
});

test('A18 cancelled mounted acquisition discards late images and does not silently alter a retained draft', async () => {
  const draft = await fixture(); let active = true, calls = 0;
  const photo = createCapturePhotoHandlers(draft, () => binding, { stage: uri => uri, createEvidenceId: () => id(95),
    recognizer: { recognize: async input => { calls++; return observation(input, ['No late commit']); } }, onChange() {}, isActive: () => active });
  const before = draft.read(binding); active = false;
  assert.equal(await photo.importPhoto('file:///app-cache/late-after-back.jpg'), 'stale'); assert.equal(calls, 0);
  assert.deepEqual(draft.read(binding), before); draft.endSheet();
});

test('A18/A25 wrong-owner read never purges another draft; delayed expiry notifies mounted subscriptions asynchronously', async () => {
  let now = 0; const draft = await fixture(() => now); await Promise.resolve();
  let notices = 0; const unsubscribe = draft.subscribe(() => notices++);
  assert.equal(draft.read({ ...binding, ownerId: id(99) }), null); assert.equal(draft.read(binding)!.shots.length, 2);
  await Promise.resolve(); assert.equal(notices, 0);
  now = 30 * 60 * 1000; assert.equal(draft.read(binding), null); assert.equal(notices, 0, 'No setState during render/read');
  await Promise.resolve(); assert.equal(notices, 1); unsubscribe(); draft.begin(binding, 0); await Promise.resolve(); assert.equal(notices, 1); draft.endSheet();
});

test('A18 mounted result-sheet summary subscribes to expiry and clears text/corrections without focus or capture restoration', async () => {
  let now = 0; const draft = await fixture(() => now); await Promise.resolve();
  const h = createCaptureReviewHandlers(draft, () => binding); h.correctLine(latestPhotoRefs(draft.read(binding)!, id(10))[0], 'Aqua (Water, Eau),');
  await Promise.resolve();
  const slots: any[] = []; let cursor = 0, rendersRequested = 0; const effects: Array<() => void> = [];
  const react = { ...React, useState(initial: any) { const at = cursor++; if (!(at in slots)) slots[at] = typeof initial === 'function' ? initial() : initial;
    return [slots[at], (value: any) => { slots[at] = typeof value === 'function' ? value(slots[at]) : value; rendersRequested++; }]; },
    useEffect(effect: () => (() => void), dependencies: unknown[]) { const at = cursor++;
      if (!slots[at]) { slots[at] = dependencies; effects.push(() => { slots[at] = effect(); }); } } };
  const ui = componentHarness('src/components/check/part-one/PartOneLocalDraftSummary.tsx', 'PartOneLocalDraftSummary', { draft, binding },
    { modules: { ...reviewModules, react } });
  cursor = 0; assert.match(textContent(ui.render()), /Aqua \(Water, Eau\),/); for (const effect of effects) effect();
  now = 30 * 60 * 1000; draft.read(binding); assert.equal(rendersRequested, 0); await Promise.resolve(); assert.equal(rendersRequested, 1);
  cursor = 0; assert.equal(textContent(ui.render()), '');
  for (const slot of slots) if (typeof slot === 'function') slot(); draft.endSheet();
});

test('A18 actual retained edit control cannot write after Remove or expiry; freshly rendered controls recover', async () => {
  for (const reason of ['remove', 'expiry'] as const) {
    let now = 0; const draft = await fixture(() => now);
    const ui = componentHarness('src/components/check/part-one/PartOneCaptureReview.tsx', 'PartOneCaptureReview',
      { draft, binding, onChange() {} }, { modules: reviewModules });
    let nodes = ui.render(); press(control(nodes, 'Correct photo 1 line 1'));
    nodes = ui.render(); control(nodes, 'Correction for photo 1 line 1').props.onChangeText('Old control must not write');
    const staleApply = control(ui.render(), 'Apply local correction to photo 1 line 1');
    if (reason === 'remove') draft.remove(); else { now = 30 * 60 * 1000; draft.read(binding); }
    draft.begin(binding, 173);
    const ticket = draft.addPhoto(binding, id(61), 'file:///app-cache/fresh.img');
    if (ticket === 'cap_reached') throw new Error('unexpected cap');
    await draft.recognize(ticket, { recognize: async input => observation(input, ['Fresh original,']) }, () => binding);
    press(staleApply); assert.equal(draft.read(binding)!.edits.length, 0);
    nodes = ui.render(); press(control(nodes, 'Correct photo 1 line 1'));
    nodes = ui.render(); control(nodes, 'Correction for photo 1 line 1').props.onChangeText('Fresh corrected,');
    press(control(ui.render(), 'Apply local correction to photo 1 line 1'));
    assert.equal(draft.read(binding)!.edits[0].text, 'Fresh corrected,'); draft.endSheet();
  }
});

test('A19 recognition completing after mounted capture closes cannot apply its late transcript', async () => {
  const draft = await fixture(); let active = true;
  let resolve!: (result: OcrObservation) => void, started!: LocalOcrInput;
  const pending = new Promise<OcrObservation>(done => { resolve = done; });
  const photo = createCapturePhotoHandlers(draft, () => binding, { stage: uri => uri, createEvidenceId: () => id(62),
    recognizer: { recognize: input => { started = input; return pending; } }, onChange() {}, isActive: () => active });
  const reading = photo.importPhoto('file:///app-cache/closing.img'); active = false;
  resolve(observation(started, ['Late recognized text must remain absent']));
  assert.equal(await reading, 'stale'); assert.equal(draft.read(binding)!.shots.find(shot => shot.evidenceId === id(62))!.observation, null);
  assert.equal(draft.read(binding)!.shots.slice(0, 2).every(shot => shot.observations.length === 1), true); draft.endSheet();
});

test('A18 expired mounted capture still supports Back, Cancel and system dismissal without restoring private data', async () => {
  let now = 0, closed = 0; const draft = await fixture(() => now);
  class CacheDirectory { uri: string; exists = false; constructor(root: { uri: string }, name: string) { this.uri = `${root.uri}${name}/`; } create() {} delete() {} }
  const modules = { ...reviewModules,
    'react-native': { ...nativeHosts, Modal: 'Modal', ScrollView: 'ScrollView', ActivityIndicator: 'ActivityIndicator', Platform: { OS: 'ios' } },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    'expo-camera': { CameraView: 'CameraView', useCameraPermissions: () => [{ granted: false }, async () => ({ granted: false })] },
    'expo-image-picker': { launchImageLibraryAsync: async () => ({ canceled: true, assets: [] }) },
    'expo-file-system': { Directory: CacheDirectory, File: class {}, Paths: { cache: { uri: 'file:///synthetic-cache/' } } },
    '../../../../modules/derive-label-ocr': { isNativeLabelOcrAvailable: false, appleVisionLabelRecognizer: { recognize: async () => { throw new Error('unexpected recognition'); } } },
    '../../../services/productCatalog': { createCatalogRequestId: () => id(99) },
    '../../../services/partOneOcr': ocrRuntime,
    '../../../presentation/part-one/capture': captureRuntime,
  };
  const ui = componentHarness('src/components/check/part-one/PartOneLabelCapture.tsx', 'PartOneLabelCapture',
    { draft, binding, onChange() {}, onClose: () => closed++ }, { modules });
  ui.render(); now = 30 * 60 * 1000;
  const nodes = ui.render(); assert.match(textContent(nodes), /temporary draft has ended/);
  press(control(nodes, 'Back to product result')); press(control(nodes, 'Cancel ingredient capture and return to product'));
  nodes.find(node => node.type === 'Modal')!.props.onRequestClose();
  assert.equal(closed, 3); assert.equal(draft.read(binding), null); draft.endSheet();
});

test('A16 removing a photo cannot reuse local correction or assembly revision identifiers', async () => {
  const arrays = [['Water,', 'Glycerin,', '1,2-Hexanediol,'], ['Glycerin,', '1,2-Hexanediol,', 'Tail,']];
  const draft = await fixture(() => 0, [...arrays, ...arrays]); let h = createCaptureReviewHandlers(draft, () => binding);
  let current = draft.read(binding)!;
  h.correctLine(latestPhotoRefs(current, id(10))[0], 'Water (Aqua),');
  h.correctLine(latestPhotoRefs(current, id(12))[0], 'Water (Aqua),');
  h.setMode('cosmetic');
  for (const photo of [10, 11, 12, 13]) {
    current = draft.read(binding)!; h.confirmPackage(id(photo), true); h.assignLines(latestPhotoRefs(current, id(photo)), 'ingredients', 'en');
  }
  current = draft.read(binding)!;
  assert.equal(h.assemble([...latestPhotoRefs(current, id(10)), ...latestPhotoRefs(current, id(11))], true).ok, true);
  assert.equal(h.assemble([...latestPhotoRefs(current, id(12)), ...latestPhotoRefs(current, id(13))], true).ok, true);
  h.removePhoto(id(10)); h = createCaptureReviewHandlers(draft, () => binding); current = draft.read(binding)!;
  h.correctLine(latestPhotoRefs(current, id(12))[0], 'Aqua (Water),');
  assert.deepEqual(draft.read(binding)!.edits.map(edit => edit.revision), [2, 3]);
  current = draft.read(binding)!;
  assert.equal(h.assemble([...latestPhotoRefs(current, id(12)), ...latestPhotoRefs(current, id(13))], true).ok, true);
  assert.deepEqual(draft.read(binding)!.review.assemblies.map(assembly => assembly.revision), [2, 3]);
  assert.equal(draft.read(binding)!.review.assemblies[1].supersedesRevision, 2); draft.endSheet();
});

test('A15 live language reassignment retracts assembly readiness while retaining its original association', async () => {
  const draft = await fixture(), h = createCaptureReviewHandlers(draft, () => binding);
  let current = draft.read(binding)!; h.setMode('cosmetic');
  for (const photo of [10, 11]) { h.confirmPackage(id(photo), true); h.assignLines(latestPhotoRefs(current, id(photo)), 'ingredients', 'en'); }
  assert.equal(h.assemble([...latestPhotoRefs(current, id(10)), ...latestPhotoRefs(current, id(11))], true).ok, true);
  const ui = componentHarness('src/components/check/part-one/PartOneCaptureReview.tsx', 'PartOneCaptureReview',
    { draft, binding, onChange() {} }, { modules: reviewModules });
  let nodes = ui.render(); press(control(nodes, 'Label options')); nodes = ui.render(); control(nodes, 'Observed language for photo 1').props.onChangeText('fr');
  press(control(ui.render(), 'Apply observed language to photo 1'));
  const model = buildLocalDraftSummary(draft.read(binding))!;
  assert.equal(model.assemblies[0].stale, true); assert.equal(model.assemblies[0].language, 'en');
  assert(model.reasons.includes('assembly_needs_review')); draft.endSheet();
});
test('compact capture retains package warnings and section meaning while hiding provenance again', async () => {
  const draft = await fixture(), h = createCaptureReviewHandlers(draft, () => binding);
  let current = draft.read(binding)!; h.setMode('drug_facts');
  for (const photo of [10,11]) { h.confirmPackage(id(photo),true); h.assignLines(latestPhotoRefs(current,id(photo)), 'active', 'en'); }
  assert.equal(h.assemble([...latestPhotoRefs(current,id(10)),...latestPhotoRefs(current,id(11))],true).ok,true);
  const summary = componentHarness('src/components/check/part-one/PartOneLocalDraftSummary.tsx','PartOneLocalDraftSummary',{draft,binding},{modules:reviewModules});
  assert.match(textContent(summary.render()),/Active ingredients/); assert(!textContent(summary.render()).includes('recognition 1'));
  h.reportPackageConflict(id(10));
  assert.match(textContent(summary.render()),/package.*mismatch|different.*package|package.*conflict/i);
  const ui = componentHarness('src/components/check/part-one/PartOneCaptureReview.tsx','PartOneCaptureReview',{draft,binding,onChange(){}},{modules:reviewModules});
  press(control(ui.render(),'Label options'));
  press(control(ui.render(),'Show original recognition history for photo 1'));
  assert.match(textContent(ui.render()),/sanitized_fixture/);
  press(control(ui.render(),'Hide label options'));
  assert(!textContent(ui.render()).includes('sanitized_fixture')); draft.endSheet();
});
