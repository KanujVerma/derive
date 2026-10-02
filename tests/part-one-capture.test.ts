import assert from 'node:assert/strict';
import test from 'node:test';
import { MemoryLabelDraft, draftReadiness, mergeAlignedViews, compareRecognitionPasses } from '../src/presentation/part-one/capture.ts';
import type { CaptureBinding } from '../src/presentation/part-one/capture.ts';
import { LOCAL_OCR_MESSAGES, PART_ONE_OCR_RELEASE_ENABLED, localOcrAvailable, validateOcrObservation } from '../src/services/partOneOcr.ts';
import { createDraftCacheLifecycle, isAppCacheFileUri } from '../src/services/partOneOcr.ts';
import type { LocalOcrInput, LocalLabelRecognizer, OcrObservation } from '../src/services/partOneOcr.ts';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const binding: CaptureBinding = { ownerId: id(1), sheetSessionId: id(2), scanId: id(3), generation: 1,
  captureSessionId: id(4), packageObservationId: id(5), itemId: id(6), candidateId: null, deletionEpoch: 0 };
function observation(input: LocalOcrInput, text = 'Water, 1,2-Hexanediol; PEG-240/HDI Copolymer'): OcrObservation {
  return { evidenceId: input.evidenceId, captureSessionId: input.captureSessionId, generation: input.generation,
    recognizer: 'apple_vision_fixture', recognizerVersion: 'fixture-v1', languageConfig: input.languages,
    correctionEnabled: input.correctionEnabled, sourceWidth: 1200, sourceHeight: 1600,
    orientationTransform: [1, 0, 0, 0, 1, 0, 0, 0, 1],
    lines: [{ text, alternatives: [], region: [0.1, 0.2, 0.8, 0.2], confidence: 1 }], status: 'recognized' };
}
const fixture: LocalLabelRecognizer = { recognize: async input => observation(input) };
function setup(now = () => 0) {
  const draft = new MemoryLabelDraft(now); draft.begin(binding, 173);
  const ticket = draft.addPhoto(binding, id(7), 'file:///synthetic-label.jpg');
  if (ticket === 'cap_reached') throw new Error('Unexpected cap');
  return { draft, ticket };
}

test('A14 high confidence and Yes cannot clear cropped tail, hidden region or inactive section', async () => {
  const { draft, ticket } = setup(); await draft.recognize(ticket, fixture, () => binding);
  draft.setCoverage(binding, { startSeen: true, endSeen: false, missingRegions: ['right_edge_cut_off', 'glare_hidden_line'],
    requiredSections: ['active', 'inactive'], observedSections: ['active'], associationContradictions: [] });
  const current = draft.read(binding)!;
  const ready = draftReadiness(current, true);
  assert.equal(ready.state, 'partial'); assert.equal(ready.addPhoto, true); assert.equal(ready.canCommit, false);
  assert(ready.reasons.includes('missing_end')); assert(ready.reasons.includes('missing_section:inactive'));
  assert(ready.reasons.includes('glare_hidden_line'));
  draft.endSheet();
});

test('A15 exact evidenced overlap merges line regions without duplicating or guessing chemical tokens', () => {
  const input: LocalOcrInput = { uri: 'file:///a.jpg', evidenceId: id(8), captureSessionId: id(4), generation: 1,
    languages: ['en-US'], correctionEnabled: false };
  const a = observation(input); a.lines = ['Water,', 'Glycerin,', '1,2-Hexanediol,'].map(text => ({ ...a.lines[0], text }));
  const b = observation({ ...input, evidenceId: id(9) }); b.lines = ['1,2-Hexanediol,', 'PEG-240/HDI Copolymer.'].map(text => ({ ...b.lines[0], text }));
  const view = (obs: OcrObservation) => ({ binding, observation: obs, declarationAssociationId: id(10), sectionId: 'ingredients', language: 'en' });
  const merged = mergeAlignedViews(view(a), view(b), { aStart: 2, bStart: 0, length: 1 });
  assert.equal(merged.status, 'merged'); if (merged.status !== 'merged') throw new Error('Unexpected unmerged');
  assert.equal(merged.lines.length, 4); assert.equal(merged.lines[2].lineage.length, 2);
  assert.equal(merged.lines[2].text, '1,2-Hexanediol,');
  for (const changed of [{ ...view(b), language: 'fr' }, { ...view(b), sectionId: 'inactive' },
    { ...view(b), declarationAssociationId: id(11) }, { ...view(b), binding: { ...binding, packageObservationId: id(11) } }]) {
    assert.equal(mergeAlignedViews(view(a), changed, { aStart: 2, bStart: 0, length: 1 }).status, 'unmerged');
  }
  b.lines[0].text = '1,3-Hexanediol,';
  assert.equal(mergeAlignedViews(view(a), view(b), { aStart: 2, bStart: 0, length: 1 }).status, 'unmerged');
  assert.equal(mergeAlignedViews(view(a), view(b), null).status, 'unmerged');
});

test('A16 correction off remains attributable and assisted disagreement blocks dependent acceptance', () => {
  const input: LocalOcrInput = { uri: 'file:///a.jpg', evidenceId: id(8), captureSessionId: id(4), generation: 1,
    languages: ['en-US'], correctionEnabled: false };
  const original = observation(input, 'PPG-6-Decyltetradeceth-30');
  const assisted = observation({ ...input, correctionEnabled: true }, 'PPG-6-Decyltetradeceth-3O');
  const compared = compareRecognitionPasses(original, assisted);
  assert.equal(compared.dependentAcceptanceBlocked, true);
  assert.equal(compared.observations[0].correctionEnabled, false); assert.equal(compared.observations[1].correctionEnabled, true);
  assert.equal(compared.observations[0].lines[0].text, original.lines[0].text);
  assert(!('customWords' in compared.observations[0]));
});

test('A17 denial, picker cancellation, unsupported script and absent model have distinct recovery without network', async () => {
  assert.notEqual(LOCAL_OCR_MESSAGES.camera_denied, LOCAL_OCR_MESSAGES.picker_cancelled);
  assert.notEqual(LOCAL_OCR_MESSAGES.model_unavailable, LOCAL_OCR_MESSAGES.no_text);
  for (const status of ['unsupported_script', 'model_unavailable', 'no_text', 'failed'] as const) {
    const { draft, ticket } = setup();
    await draft.recognize(ticket, { recognize: async input => ({ ...observation(input), lines: [], status }) }, () => binding);
    assert.equal(draft.read(binding)!.shots[0].observation!.status, status);
    assert.equal(draft.back(binding), 173); draft.remove();
  }
  assert.equal(PART_ONE_OCR_RELEASE_ENABLED, false);
  assert.equal(localOcrAvailable({ evaluationEnabled: true, platform: 'android', nativeAvailable: true }), false);
  assert.equal(localOcrAvailable({ evaluationEnabled: true, platform: 'ios', nativeAvailable: false }), false);
});

test('A18 Back/cancel retains sheet scroll; cap preserves partial; inactivity, sheet end and removal purge', () => {
  let now = 0; const { draft } = setup(() => now);
  assert.equal(draft.back(binding), 173);
  for (let n = 8; n <= 12; n++) assert.notEqual(draft.addPhoto(binding, id(n), `file:///label-${n}.jpg`), 'cap_reached');
  assert.equal(draft.addPhoto(binding, id(13), 'file:///label-13.jpg'), 'cap_reached');
  assert.equal(draft.read(binding)!.shots.length, 6); assert.equal(draftReadiness(draft.read(binding)!, true).state, 'partial');
  draft.removePhoto(binding, id(12)); assert.equal(draft.read(binding)!.shots.length, 5);
  now = 30 * 60 * 1000; assert.equal(draft.read(binding), null);
  draft.begin(binding, 173); draft.remove(); assert.equal(draft.read(binding), null);
  draft.begin(binding, 173); draft.endSheet(); assert.equal(draft.read(binding), null);
});

test('A19 stale OCR after product, generation, capture, owner, session, deletion epoch or removal cannot restore A', async () => {
  for (const change of [{ ...binding, itemId: id(20), generation: 2 }, { ...binding, captureSessionId: id(21) },
    { ...binding, ownerId: id(22) }, { ...binding, sheetSessionId: id(23) }, { ...binding, candidateId: id(24) }, { ...binding, deletionEpoch: 1 }, null]) {
    const { draft, ticket } = setup(); let current = binding; let release!: (value: OcrObservation) => void;
    let pendingInput!: LocalOcrInput;
    const pending = draft.recognize(ticket, { recognize: input => { pendingInput = input; return new Promise(resolve => { release = resolve; }); } }, () => current);
    if (change) { current = change; draft.begin(current, 99); } else { draft.remove(); draft.begin(binding, 99); }
    release(observation(pendingInput)); assert.equal(await pending, 'stale');
    assert.equal(draft.read(current)!.shots.length, 0); assert.equal(draft.read(current)!.scrollOffset, 99); draft.remove();
  }
});

test('A25 same GTIN owners remain isolated, edits retain immutable original and deletion does not alter another owner', async () => {
  const a = setup(); const other = { ...binding, ownerId: id(40), captureSessionId: id(41), packageObservationId: id(42) };
  const b = new MemoryLabelDraft(() => 0); b.begin(other, 0);
  const bt = b.addPhoto(other, id(43), 'file:///other-label.jpg'); if (bt === 'cap_reached') throw new Error('Unexpected cap');
  await a.draft.recognize(a.ticket, fixture, () => binding); await b.recognize(bt, fixture, () => other);
  a.draft.edit(binding, id(7), 'Water, correction attributed to owner A');
  a.draft.edit(binding, id(7), 'Second attributed correction');
  assert.equal(a.draft.read(binding)!.edits[1].supersedesRevision, 1);
  assert.equal(a.draft.read(binding)!.shots[0].observation!.lines[0].text, 'Water, 1,2-Hexanediol; PEG-240/HDI Copolymer');
  const bBefore = b.read(other); a.draft.accountChanged(); assert.equal(a.draft.read(binding), null);
  assert.deepEqual(b.read(other), bBefore); b.remove();
});

test('OCR boundary rejects malformed or stale outputs and runs one image at a time', async () => {
  const { draft, ticket } = setup(); let release!: (value: OcrObservation) => void; let input!: LocalOcrInput;
  const first = draft.recognize(ticket, { recognize: value => { input = value; return new Promise(resolve => { release = resolve; }); } }, () => binding);
  assert.equal(await draft.recognize(ticket, fixture, () => binding), 'busy');
  release(observation(input)); assert.equal(await first, 'applied');
  assert.throws(() => validateOcrObservation({ ...observation(input), captureSessionId: id(99) }, input), /stale_ocr_binding/);
  assert.throws(() => validateOcrObservation({ ...observation(input), confidence: undefined }, input));
  assert.throws(() => validateOcrObservation({ ...observation(input), sourceWidth: 0 }, input));
  assert.equal(validateOcrObservation({ ...observation(input), status: 'failed', lines: [], sourceWidth: 0, sourceHeight: 0 }, input).status, 'failed');
  assert.throws(() => draft.addPhoto(binding, id(99), 'https://example.com/photo.jpg'), /local_photo_required/); draft.remove();
});

test('A27 evaluation has no upload/save path; local derivative metadata proof is a separate native gate', () => {
  const { draft } = setup(); assert.equal(draftReadiness(draft.read(binding)!, true).canCommit, false);
  assert.equal(draftReadiness(draft.read(binding)!, true).canPublish, false);
  assert.equal('upload' in draft, false); assert.equal('serialize' in draft, false); draft.remove();
});

test('A18/A27 lifecycle cleanup deletes each app-owned temporary copy once on all purge routes', async () => {
  for (const reason of ['remove', 'endSheet', 'accountChanged', 'expiry', 'binding_changed'] as const) {
    let time = 0; const removed: string[] = [];
    const draft = new MemoryLabelDraft(() => time, async uri => { removed.push(uri); }); draft.begin(binding, 10);
    draft.addPhoto(binding, id(70), 'file:///app-cache/owned-label.jpg');
    if (reason === 'expiry') { time = 30 * 60 * 1000; draft.read(binding); }
    else if (reason === 'binding_changed') draft.read({ ...binding, generation: 2 });
    else draft[reason]();
    draft.remove(); await draft.flushCleanup();
    assert.deepEqual(removed, ['file:///app-cache/owned-label.jpg']);
  }
});

test('A16/A17 explicit local retry appends original observations and disagreements remain uncertain', async () => {
  const { draft, ticket } = setup();
  await draft.recognize(ticket, fixture, () => binding);
  await draft.recognize(ticket, { recognize: async input => observation(input, 'Water, PEG-24O/HDI Copolymer') }, () => binding);
  const current = draft.read(binding)!;
  assert.equal(current.shots[0].observations.length, 2);
  assert.equal(current.shots[0].observations[0].lines[0].text, 'Water, 1,2-Hexanediol; PEG-240/HDI Copolymer');
  assert(draftReadiness(current, true).reasons.includes('recognition_disagreement'));
  draft.remove();
});

test('A27 cleanup failure attempts other files and retries retained app-cache cleanup without restoring a draft', async () => {
  let fail = true; const deleted: string[] = [];
  const draft = new MemoryLabelDraft(() => 0, async uri => {
    if (uri.endsWith('first.jpg') && fail) throw new Error('synthetic file deletion failure');
    deleted.push(uri);
  });
  draft.begin(binding, 0); draft.addPhoto(binding, id(81), 'file:///app-cache/first.jpg');
  draft.addPhoto(binding, id(82), 'file:///app-cache/second.jpg'); draft.remove();
  await assert.rejects(draft.flushCleanup(), /local_capture_cleanup_failed/);
  assert.deepEqual(deleted, ['file:///app-cache/second.jpg']); assert.equal(draft.read(binding), null);
  fail = false; draft.remove(); await draft.flushCleanup();
  assert.deepEqual(deleted, ['file:///app-cache/second.jpg', 'file:///app-cache/first.jpg']);
});

test('A18/A27 next process purges only task-managed photo copies before capture; library originals are rejected', () => {
  const files = new Set(['file:///app-cache/profile-photo.jpg', 'file:///library/original.heic']);
  let purges = 0;
  const manager = () => createDraftCacheLifecycle({ cacheRoot: 'file:///app-cache/', draftRoot: 'file:///app-cache/derive-part-one-drafts-v1/',
    removeDraftDirectory: () => { purges++; for (const file of files) if (file.startsWith('file:///app-cache/derive-part-one-drafts-v1/')) files.delete(file); },
    createDraftDirectory: () => {}, moveFile: (source, destination) => { assert(files.has(source)); files.delete(source); files.add(destination); } });
  const firstProcess = manager(); assert.equal(firstProcess.initialize(), true); assert.equal(firstProcess.initialize(), true); assert.equal(purges, 1);
  files.add('file:///app-cache/ImagePicker/new-label.heic');
  const owned = firstProcess.stage('file:///app-cache/ImagePicker/new-label.heic', id(91));
  assert(files.has(owned)); assert.equal(files.has('file:///app-cache/ImagePicker/new-label.heic'), false);
  assert.throws(() => firstProcess.stage('file:///library/original.heic', id(92)), /app_cache_photo_required/);
  assert.throws(() => firstProcess.stage('file:///app-cache/%2e%2e/library/original.heic', id(92)), /app_cache_photo_required/);
  const secondProcess = manager(); assert.equal(secondProcess.initialize(), true); assert.equal(purges, 2); assert.equal(files.has(owned), false);
  assert(files.has('file:///library/original.heic')); assert(files.has('file:///app-cache/profile-photo.jpg'));
  assert.equal(isAppCacheFileUri('https://example.com/photo.jpg', 'file:///app-cache/'), false);
});

test('A27 failed next-launch cache cleanup blocks new photo acquisition', () => {
  let moves = 0;
  const manager = createDraftCacheLifecycle({ cacheRoot: 'file:///app-cache/', draftRoot: 'file:///app-cache/derive-part-one-drafts-v1/',
    removeDraftDirectory: () => { throw new Error('synthetic directory deletion failure'); },
    createDraftDirectory: () => {}, moveFile: () => { moves++; } });
  assert.equal(manager.initialize(), false);
  assert.throws(() => manager.stage('file:///app-cache/picker.jpg', id(93)), /local_capture_cache_unavailable/); assert.equal(moves, 0);
});
