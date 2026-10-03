import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { ScanResultSchema } from '../src/contracts/PartOne.ts';
import { normalize, LOCAL_DICTIONARY_RELEASE } from '../src/domain/part-two/index.ts';
import { createPartTwoSavedTransport } from '../src/services/partTwoClient.ts';
import * as partTwoController from '../src/presentation/part-two/controller.ts';
import type { PrivateCaptureController } from '../src/presentation/part-one/privateCaptureController.ts';
import { boundDeclaration, p2metadata, p2id, p2now, p2expiry } from './fixtures/part-two-core.ts';
import { componentHarness, control, press, textContent } from './ux-profile-render.ts';

/** Actual My Stuff handlers pass their unchanged sheet props to the actual sheet,
 * canonical controller, saved transport and inline detail handlers. Each subtree
 * gets its own hook harness; native hosts and navigation are inert. All source,
 * save and recovery responses are synthetic, with no runtime grant activation. */
function mounted() {
  const input = boundDeclaration('Glycerin, Water', 'private_package');
  const ready = normalize(input, LOCAL_DICTIONARY_RELEASE, p2metadata);
  assert.equal(ready.state, 'ready');
  const result = ScanResultSchema.parse({ schemaVersion: 1, requestId: p2id(101), scanId: input.binding.scanId,
    generation: input.binding.generation, resultRevision: input.binding.evidenceRevision, identity: 'exact',
    itemId: input.binding.itemId, candidateIds: [], snapshotId: input.binding.snapshotId, declarationId: input.binding.declarationId,
    declarationState: 'partial', scope: 'private_package', packageConfirmation: 'user_bound', work: 'complete',
    jobId: null, subscriptionId: null, nextCheckAfter: null,
    display: { resultRevision: input.binding.evidenceRevision,
      selectedIdentity: { id: input.binding.itemId, name: 'Synthetic saved lotion', brand: 'Synthetic', variantText: 'Private package', expiresAt: p2expiry, image: null },
      candidates: [], sections: [{ sectionId: p2id(8), kind: 'ingredients', text: 'Glycerin, Water', evidenceIds: [p2id(7)], policyId: p2id(9), observedAt: p2now, expiresAt: p2expiry }],
      sources: [{ observationId: p2id(7), policyId: p2id(9), label: 'Synthetic saved P1 source', url: 'https://example.test/synthetic-source', observedAt: p2now, sourceUpdatedAt: null, expiresAt: p2expiry }], limitations: [] },
    reasonCodes: ['missing_tail'], conflictIds: [], evidenceIds: [p2id(7)], allowedActions: ['save_partial'],
    freshness: { observedAt: p2now, expiresAt: p2expiry, state: 'fresh' } });
  const record = { saveId: p2id(102), captureSessionId: input.binding.captureSessionId,
    snapshotAtSaveId: input.binding.snapshotId, createdAt: p2now, result };
  const evidenceId = p2id(103);
  const recovery = { capture: { captureSessionId: record.captureSessionId, scanId: result.scanId, generation: result.generation },
    result, boundResult: result, capturedSource: null, editable: false,
    assets: [{ asset: { evidenceId }, attestationId: p2id(104), expiresAt: p2expiry,
      signedAccess: { url: 'https://example.test/synthetic-private-photo', expiresAt: p2expiry } }],
    sourceObservations: [{ observationId: p2id(105), role: 'ingredients', observation: { evidenceId,
      recognizer: 'synthetic-only', correctionEnabled: false, lines: [{ text: 'Synthetic cached OCR secret' }] } }],
    edits: [], review: null };
  const privateState = { ownerId: input.binding.authenticatedOwnerId, stage: 'saved_partial', result, capture: recovery.capture,
    recovery, error: null, pendingEdits: [], photoRoles: {} } as unknown as ReturnType<PrivateCaptureController['getState']>;
  const controller = { subscribe: () => () => {}, getState: () => privateState, isCurrentOwner: () => true,
    setOwner() {}, close() { privateState.result = null; privateState.recovery = null; privateState.capture = null; privateState.stage = 'temporary'; },
    recover: async () => true, remove: async () => {} } as unknown as PrivateCaptureController;
  let phase: 'ready' | 'blocked' | 'withdrawn' | 'pending' | 'dictionary' | 'absent' | 'offline' = 'ready';
  const calls: { path: string; body: { saveId: string; requestId: string } }[] = [];
  const transport = createPartTwoSavedTransport(record.saveId, { enabled: () => true, invoke: async (path, body) => {
    const request = JSON.parse(body); calls.push({ path, body: request });
    if (phase === 'withdrawn') return { data: { result: null, withdrawn: true }, error: null };
    if (phase === 'absent') return { data: { result: null, withdrawn: false }, error: null };
    if (phase === 'offline') throw Error('Synthetic transient transport failure');
    const currentReady = normalize({ ...input, binding: { ...input.binding, requestId: request.requestId } }, LOCAL_DICTIONARY_RELEASE, p2metadata);
    assert.equal(currentReady.state, 'ready');
    const { output, ...base } = currentReady; void output;
    const response = phase === 'ready' ? currentReady
      : { ...base, state: phase === 'pending' ? 'pending' : 'blocked',
        resultRevision: phase === 'pending' ? 3 : 2, permittedText: null,
        ...(phase === 'pending' ? {} : { reasonCodes: [phase === 'dictionary' ? 'dictionary_release_not_approved' : 'source_evidence_unavailable'] }) };
    return { data: { result: response, withdrawn: false }, error: null };
  } });
  const saved = componentHarness('src/components/my-stuff/PartOneSavedProducts.tsx', 'PartOneSavedProducts',
    { ownerId: input.binding.authenticatedOwnerId }, { effects: true, modules: {
      'expo-router': { useFocusEffect() {} }, '../ui/Button': { Button: 'Button' },
      '../../stores/authStore': { useAuthStore: { getState: () => ({ sessionUserId: input.binding.authenticatedOwnerId }) } },
      '../../services/partOne': { listPartOneSaves: async () => [record], readPartOneSave: async () => record,
        deletePartOneSave: async () => { throw Error('Unexpected synthetic save deletion'); } },
      '../../services/partOnePrivate': { PART_ONE_PRIVATE_ENABLED: true, partOnePrivateTransport: { list: async () => [] } },
      '../../presentation/part-one/privateCaptureController': { createPrivateCaptureController: () => controller },
      '../check/part-one/PartOnePrivateCapturePanel': { PartOnePrivateCapturePanel: 'PrivatePanel' },
      '../../../modules/derive-label-ocr': { preparePrivateLabelUpload: async () => { throw Error('No native upload in synthetic composition'); } },
    } });
  let sequence = 110;
  let sheet: ReturnType<typeof componentHarness> | undefined;
  let panel: ReturnType<typeof componentHarness> | undefined;
  const panelNodes = (nodes: ReturnType<typeof saved.render>) => {
    const props = nodes.find(node => node.type === 'PrivatePanel')?.props;
    assert(props, 'the real My Stuff localDraft callback remains mounted');
    panel ??= componentHarness('src/components/check/part-one/PartOnePrivateCapturePanel.tsx', 'PartOnePrivateCapturePanel', props,
      { modules: { 'react-native': { View: 'View', Text: 'Text', Image: 'Image', TextInput: 'TextInput', Pressable: 'Pressable',
        StyleSheet: { create: (styles: unknown) => styles } } } });
    return { props, nodes: panel.render(props) };
  };
  return { record, calls, saved, setPhase(next: typeof phase) { phase = next; }, panelNodes,
    async open() {
      saved.render(); await new Promise(resolve => setImmediate(resolve));
      press(control(saved.render(), 'Open Synthetic saved lotion')); await new Promise(resolve => setImmediate(resolve));
      const props = saved.render().find(node => node.type === 'PartOneResultSheet')?.props;
      assert(props); assert.equal(props.savedInterpretationId, record.saveId);
      assert.equal(props.interpretationCaptureSessionId, record.captureSessionId);
      assert.equal(typeof props.localDraft, 'function');
      sheet = componentHarness('src/components/check/part-one/PartOneResultSheet.tsx', 'PartOneResultSheet', props,
        { effects: true, modules: { '../../ui/Button': { Button: 'Button' },
          '../../../services/productCatalog': { createCatalogRequestId: () => p2id(sequence++) },
          '../../../presentation/part-two/controller': partTwoController,
          '../../../services/partTwo': { PART_TWO_ENABLED: true, partTwoTransport: { normalize: async () => { throw Error('Saved record must use saved transport'); } },
            partTwoSavedTransport: (saveId: string) => { assert.equal(saveId, record.saveId); return transport; } },
          '../result-sheet/ResultSheetSurface': { ResultSheetSurface: (p: any) => React.createElement('Surface', p, p.summary, p.compactActions, p.children) },
        } });
      return sheet;
    }, dispose() { panel?.dispose(); sheet?.dispose(); saved.dispose(); } };
}

test('actual saved private composition keeps separately authorized history through dictionary, absent and transport failures', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout', 'setInterval'], now: Date.parse(p2now) });
  for (const failure of ['dictionary', 'absent', 'offline'] as const) {
    const f = mounted();
    try {
      const sheet = await f.open(); sheet.render(); await settle(sheet);
      f.setPhase(failure); t.mock.timers.tick(15000); const nodes = await settle(sheet);
      assert.equal(f.calls.length, 2); assert.match(textContent(nodes), /Ingredient evidence unavailable/);
      assert.equal(f.panelNodes(nodes).props.sourceDenied, false, `${failure} must not imply private source withdrawal`);
      assert(textContent(f.panelNodes(nodes).nodes).includes('Synthetic cached OCR secret'));
      assert(f.panelNodes(nodes).nodes.some(node => node.type === 'Image'));
    } finally { f.dispose(); }
  }
});
const settle = async (h: ReturnType<typeof componentHarness>) => {
  for (let i = 0; i < 4; i++) { await new Promise(resolve => setImmediate(resolve)); h.render(); }
  return h.render();
};

for (const refusal of ['blocked', 'withdrawn'] as const) {
  test(`actual My Stuff saved private composition renders details and keeps ${refusal} originals withdrawn through retry`, async t => {
    t.mock.timers.enable({ apis: ['Date', 'setTimeout', 'setInterval'], now: Date.parse(p2now) });
    const f = mounted(); t.after(() => f.dispose());
    const sheet = await f.open();
    let nodes = sheet.render(); press(control(nodes, 'Source')); nodes = sheet.render();
    assert(textContent(nodes).includes('Synthetic saved P1 source'), 'independently permitted source starts available');
    assert.equal(f.panelNodes(nodes).props.sourceDenied, false);
    assert(textContent(f.panelNodes(nodes).nodes).includes('Synthetic cached OCR secret'));
    assert(f.panelNodes(nodes).nodes.some(node => node.type === 'Image'), 'permitted recovery starts with its signed photo');
    nodes = await settle(sheet);
    assert.equal(f.calls.length, 1); assert.equal(f.calls[0].path, 'part-two/saved-details');
    assert.equal(f.calls[0].body.saveId, f.record.saveId);
    assert(nodes.some(node => node.props.accessibilityLabel === 'Ingredient details: Glycerin'), textContent(nodes));
    press(control(nodes, 'Ingredient details: Glycerin')); nodes = sheet.render();
    assert.match(textContent(nodes), /Listed as: Glycerin.*reference humectant role/);
    press(control(nodes, 'Ingredient source and reference')); nodes = sheet.render();
    assert(textContent(nodes).includes('Synthetic private label'));
    f.setPhase(refusal); t.mock.timers.tick(15000); nodes = await settle(sheet);
    assert.equal(f.calls.length, 2); assert.match(textContent(nodes), /Ingredient evidence unavailable/);
    for (const literal of ['Glycerin', 'Synthetic private label', 'Synthetic saved P1 source', 'reference humectant role']) assert(!textContent(nodes).includes(literal), literal);
    assert.equal(f.panelNodes(nodes).props.sourceDenied, true, 'saved refusal reaches the actual My Stuff draft callback');
    assert(!textContent(f.panelNodes(nodes).nodes).includes('Synthetic cached OCR secret'));
    assert(!f.panelNodes(nodes).nodes.some(node => node.type === 'Image'), 'cached signed private photos are withdrawn');
    f.setPhase('pending'); t.mock.timers.tick(15000); nodes = await settle(sheet);
    assert.equal(f.calls.length, 3); assert.match(textContent(nodes), /Preparing ingredient details/);
    assert(!textContent(nodes).includes('Glycerin, Water')); assert(!textContent(nodes).includes('Synthetic saved P1 source'));
    assert.equal(f.panelNodes(nodes).props.sourceDenied, true, 'pending retry cannot restore private source permission');
    assert(!textContent(f.panelNodes(nodes).nodes).includes('Synthetic cached OCR secret'));
    assert(!f.panelNodes(nodes).nodes.some(node => node.type === 'Image'));
    press(control(nodes, 'Close ingredient detail'));
    sheet.render().find(node => node.type === 'Surface')!.props.onClose();
    assert(!f.saved.render().some(node => node.type === 'PartOneResultSheet'), 'the actual My Stuff close handler dismisses selection');
  });
}
