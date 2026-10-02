import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { componentHarness, control, press, textContent } from './ux-profile-render.ts';
import * as captureRuntime from '../src/presentation/part-one/capture.ts';
import * as flow from '../src/presentation/part-one/captureFlow.ts';
import * as review from '../src/presentation/part-one/captureReview.ts';
import * as ocrRuntime from '../src/services/partOneOcr.ts';
import type { LocalOcrInput } from '../src/services/partOneOcr.ts';
const id = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
const binding = { ownerId: id(1), scanId: id(2), sheetSessionId: id(2), generation: 1, captureSessionId: id(3),
  packageObservationId: id(4), itemId: null, candidateId: null, deletionEpoch: 0 };
const unresolved = { scanId: binding.scanId, generation: 1, itemId: null, display: { selectedIdentity: null } };
const identified = { ...unresolved, itemId: id(20), display: { selectedIdentity: { id: id(20), brand: 'Synthetic', name: 'New identity', variantText: '50 ml' } } };
const hosts = { View: 'View', Text: 'Text', TextInput: 'TextInput', Image: 'Image', Pressable: 'Pressable', ScrollView: 'ScrollView', Modal: 'Modal',
  ActivityIndicator: 'ActivityIndicator', Platform: { OS: 'ios' }, StyleSheet: { create: (value: unknown) => value } };

test('A18/A19 production mounted capture and actual pending picker survive same-generation identity improvement without adopting the item', async () => {
  const previous = process.env.EXPO_PUBLIC_PART_ONE_OCR_EVALUATION; process.env.EXPO_PUBLIC_PART_ONE_OCR_EVALUATION = 'true';
  const draft = new captureRuntime.MemoryLabelDraft(() => 0); draft.begin(binding, 73);
  const productLabel = flow.localCaptureProductLabel(binding, unresolved);
  const active = componentHarness('src/components/check/part-one/PartOneActiveCapture.tsx', 'PartOneActiveCapture',
    { open: true, draft, binding, owner: binding.ownerId, result: unresolved, productLabel, onClose() {}, onChange() {} },
    { modules: { '../../../presentation/part-one/captureFlow': flow } });
  const before = active.render().find(node => node.type === 'PartOneLabelCapture')!; assert(before);
  let selected!: (result: { canceled: boolean; assets: { uri: string }[] }) => void, pickerCalls = 0, recognitions = 0, staged = 0;
  class Directory { uri: string; exists = false; constructor(root: { uri: string }, name: string) { this.uri = `${root.uri}${name}/`; } create() {} delete() {} }
  class File { uri: string; exists = false; constructor(uri: string) { this.uri = uri; } move() { staged++; } delete() {} }
  const capture = componentHarness('src/components/check/part-one/PartOneLabelCapture.tsx', 'PartOneLabelCapture', before.props, { modules: {
    'react-native': hosts, 'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    'expo-camera': { CameraView: 'CameraView', useCameraPermissions: () => [{ granted: false }, async () => ({ granted: false })] },
    'expo-image-picker': { launchImageLibraryAsync: () => { pickerCalls++; return new Promise(resolve => { selected = resolve; }); } },
    'expo-file-system': { Directory, File, Paths: { cache: { uri: 'file:///synthetic-cache/' } } },
    '../../../../modules/derive-label-ocr': { isNativeLabelOcrAvailable: true, appleVisionLabelRecognizer: { recognize: async (input: LocalOcrInput) => {
      recognitions++; return { evidenceId: input.evidenceId, captureSessionId: input.captureSessionId, generation: input.generation,
        recognizer: 'sanitized_fixture', recognizerVersion: 'mounted-picker-v1', languageConfig: input.languages, correctionEnabled: false,
        sourceWidth: 1000, sourceHeight: 2000, orientationTransform: [1, 0, 0, 0, 1, 0, 0, 0, 1], status: 'recognized',
        lines: [{ text: 'Synthetic: 1,2-Hexanediol.', alternatives: [], region: [.1, .1, .8, .1], confidence: .9 }] };
    } } }, '../../../services/productCatalog': { createCatalogRequestId: () => id(30) },
    '../../../services/partOneOcr': ocrRuntime, '../../../presentation/part-one/capture': captureRuntime,
    '../../../presentation/part-one/captureReview': review,
  } });
  try {
    press(control(capture.render(), 'Choose ingredient photo')); assert.equal(pickerCalls, 1);
    const during = active.render({ result: identified }).find(node => node.type === 'PartOneLabelCapture')!;
    assert(during, 'The real mount boundary must not unmount the pending picker');
    assert.equal(during.props.binding.itemId, null); assert.equal(during.props.productLabel, productLabel);
    assert.match(textContent(capture.render(during.props)), /Unresolved product/); assert(!textContent(capture.render()).includes('New identity'));
    selected({ canceled: false, assets: [{ uri: 'file:///synthetic-cache/selected.jpg' }] });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(staged, 1); assert.equal(recognitions, 1); const retained = draft.read(binding)!;
    assert.equal(retained.binding.itemId, null); assert.equal(retained.shots[0].observation!.lines[0].text, 'Synthetic: 1,2-Hexanediol.');
    assert.deepEqual(flow.resumeLocalCapture(draft, binding, binding.ownerId, identified, 73), binding);
    assert.equal(active.render({ owner: id(99) }).length, 0);
    assert.equal(active.render({ owner: binding.ownerId, result: { ...identified, generation: 2 } }).length, 0);
    assert.equal(active.render({ result: { ...identified, scanId: id(99) } }).length, 0);
  } finally { draft.remove(); if (previous === undefined) delete process.env.EXPO_PUBLIC_PART_ONE_OCR_EVALUATION; else process.env.EXPO_PUBLIC_PART_ONE_OCR_EVALUATION = previous; }
});

test('A19 exact capture still rejects item rebind and late creation cannot silently adopt published identity', () => {
  assert.equal(flow.captureMatchesCurrentResult({ ...binding, itemId: id(20) }, binding.ownerId, { ...identified, itemId: id(21) }), false);
  assert.equal(flow.captureResponseMatchesRequest(binding.ownerId, binding.ownerId, unresolved, binding, identified), true);
  assert.equal(flow.captureResponseMatchesRequest(binding.ownerId, binding.ownerId, unresolved, { ...binding, itemId: id(20) }, identified), false);
  assert.equal(flow.captureResponseMatchesRequest(binding.ownerId, id(99), unresolved, binding, identified), false);
  assert.equal(flow.captureResponseMatchesRequest(binding.ownerId, binding.ownerId, unresolved, { ...binding, generation: 2 }, { ...identified, generation: 2 }), false);
  assert.equal(flow.captureResponseMatchesRequest(binding.ownerId, binding.ownerId, unresolved, binding, null), false);
});

test('Real Check uses the tested capture mount boundary and freezes label at explicit creation', () => {
  const source = readFileSync(new URL('../src/components/check/CheckProductScreen.tsx', import.meta.url), 'utf8');
  assert.match(source, /<PartOneActiveCapture open=\{labelCaptureOpen\}/);
  assert.match(source, /productLabel=\{labelProductLabel\}/);
  assert.match(source, /setLabelProductLabel\(localCaptureProductLabel\(binding, result\)\)/);
  assert.match(source, /captureResponseMatchesRequest\(owner, currentLiveCheckOwner\(\), result, capture, current\)/);
  assert(!source.includes('productLabel={[partOneView.result'));
});
