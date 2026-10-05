import assert from 'node:assert/strict';
import test from 'node:test';
import { componentHarness, control, textContent } from './ux-profile-render.ts';
import { normalize, LOCAL_DICTIONARY_RELEASE } from '../src/domain/part-two/index.ts';
import { sourceReading, p2metadata, p2id, p2now } from './fixtures/part-two-core.ts';
import * as privateController from '../src/presentation/part-one/privateCaptureController.ts';
import type { PrivateCaptureController } from '../src/presentation/part-one/privateCaptureController.ts';
import type { PartTwoInvoke } from '../src/services/partTwoClient.ts';

/** Previously authorized synthetic Part 1 history; actual Panel, projection,
 * private interpretation, transport, strict controller and polling all run. */
function mounted(invoke: PartTwoInvoke, managed = false) {
  const input = sourceReading('Glycerin'), ready = normalize(input, LOCAL_DICTIONARY_RELEASE, p2metadata);
  assert.equal(ready.state, 'ready');
  const binding = input.binding, evidenceId = p2id(201);
  const result = { scope: 'private_package', scanId: binding.scanId, generation: binding.generation, resultRevision: binding.evidenceRevision,
    declarationState: 'partial', conflictIds: [], freshness: { state: 'fresh', expiresAt: binding.expiresAt },
    display: { sections: [{ sectionId: p2id(8), kind: 'ingredients', text: 'Private original Glycerin', expiresAt: binding.expiresAt }], limitations: [] } };
  const recovery = { capture: { captureSessionId: binding.captureSessionId, scanId: binding.scanId, generation: binding.generation },
    boundResult: result, result, editable: true, capturedSource: null,
    assets: [{ asset: { evidenceId }, attestationId: p2id(202), expiresAt: binding.expiresAt, signedAccess: { url: 'https://example.test/private-secret-photo', expiresAt: binding.expiresAt } }],
    sourceObservations: [{ observationId: p2id(203), role: 'ingredients', observation: { evidenceId, recognizer: 'synthetic_fixture', correctionEnabled: false,
      lines: [{ text: 'Private observation secret' }] } }], edits: [],
    review: { coverage: { startSeen: true, endSeen: false, missingRegions: ['Private missing-region secret'] }, reviewState: { assemblies: [{ revision: 1, section: 'ingredients', language: 'en',
      lines: [{ text: 'Private assembly secret', sources: [{ evidenceId }] }] }] } } };
  const state = { ownerId: binding.ownerId, stage: 'saved_partial', recovery, capture: recovery.capture, result, error: null, pendingEdits: [], photoRoles: {} };
  const controller = { subscribe: () => () => {}, getState: () => state, isCurrentOwner: () => true, recover: async () => true, remove: async () => {} } as unknown as PrivateCaptureController;
  let request = 210;
  const h = componentHarness('src/components/check/part-one/PartOnePrivateCapturePanel.tsx', 'PartOnePrivateCapturePanel', { controller, ownerId: binding.ownerId, ingredientDetailsManagedBySheet: managed }, {
    effects: true, modules: { '../../../presentation/part-one/privateCaptureController': privateController,
      '../../../services/partTwo': { PART_TWO_ENABLED: true, invokePartTwo: invoke }, '../../../services/productCatalog': { createCatalogRequestId: () => p2id(request++) },
      '../../ui/Button': { Button: 'Button' }, 'react-native': { View: 'View', Text: 'Text', TextInput: 'TextInput', Image: 'Image', Pressable: 'Pressable',
        Linking: { openURL: async () => {} }, AppState: { addEventListener: () => ({ remove() {} }) }, StyleSheet: { create: (v: unknown) => v } } } });
  return { h, state, binding, ready };
}
const settle = async (h: ReturnType<typeof mounted>['h']) => { for (let i = 0; i < 5; i++) { await new Promise(resolve => setImmediate(resolve)); h.render(); } return h.render(); };
const privateLiterals = ['Private original Glycerin', 'Private observation secret', 'Private assembly secret', 'Private missing-region secret'];
function noHistory(nodes: ReturnType<ReturnType<typeof mounted>['h']['render']>) {
  const text = textContent(nodes);
  for (const literal of privateLiterals) assert(!text.includes(literal), literal);
  assert(!nodes.some(node => node.type === 'Image'), 'cached signed photos disappear');
  assert(!nodes.some(node => String(node.props.accessibilityLabel).startsWith('Correct saved')), 'correction controls disappear');
  control(nodes, 'Reopen saved private label evidence'); control(nodes, 'Remove saved private label evidence');
}

test('actual private Panel withdraws only source-denied originals and keeps the child mounted through pending retry', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout', 'setInterval'], now: Date.parse(p2now) });
  let calls = 0;
  const f = mounted(async (path, body) => {
    if (path !== 'part-two/normalize') return { data: { result: null, withdrawn: false, interpretationId: null }, error: null };
    const request = JSON.parse(body), { output, ...base } = f.ready; void output;
    return { data: ++calls === 1 ? { ...base, requestId: request.requestId, state: 'blocked', resultRevision: 2, reasonCodes: ['source_evidence_unavailable'], permittedText: null }
      : { ...base, requestId: request.requestId, state: 'pending', resultRevision: 3, permittedText: null }, error: null };
  });
  try {
    assert(textContent(f.h.render()).includes('Private observation secret'));
    let nodes = await settle(f.h); noHistory(nodes); assert.match(textContent(nodes), /Ingredient evidence unavailable/);
    t.mock.timers.tick(15000); nodes = await settle(f.h); assert.equal(calls, 2); noHistory(nodes); assert.match(textContent(nodes), /Preparing ingredient details/);
    f.state.recovery.boundResult = { ...f.state.recovery.boundResult, resultRevision: f.binding.evidenceRevision + 1 };
    assert(textContent(f.h.render()).includes('Private observation secret'), 'a new authorized Part 1 revision starts its own source gate');
  } finally { f.h.dispose(); }
});

test('dictionary-only refusal and transport failure keep independently permitted Part 1 private history', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse(p2now) });
  for (const failTransport of [false, true]) {
    const f = mounted(async (path, body) => {
      if (path !== 'part-two/normalize') return { data: { result: null, withdrawn: false, interpretationId: null }, error: null };
      if (failTransport) throw Error('synthetic provider failure');
      const { output, ...base } = f.ready; void output;
      return { data: { ...base, requestId: JSON.parse(body).requestId, state: 'blocked', resultRevision: 2, reasonCodes: ['dictionary_release_not_approved'], permittedText: null }, error: null };
    });
    try { f.h.render(); const nodes = await settle(f.h); const text = textContent(nodes); assert(text.includes('Private observation secret')); assert(text.includes('Private assembly secret')); assert(nodes.some(n => n.type === 'Image')); }
    finally { f.h.dispose(); }
  }
});

test('foreign current-response binding cannot withdraw private originals', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse(p2now) });
  const f = mounted(async (path, body) => {
    if (path !== 'part-two/normalize') return { data: { result: null, withdrawn: false, interpretationId: null }, error: null };
    const { output, ...base } = f.ready; void output;
    return { data: { ...base, requestId: JSON.parse(body).requestId, captureSessionId: p2id(299), state: 'blocked', resultRevision: 2, reasonCodes: ['source_evidence_unavailable'], permittedText: null }, error: null };
  });
  try { f.h.render(); const nodes = await settle(f.h); assert(textContent(nodes).includes('Private observation secret')); assert(nodes.some(n => n.type === 'Image')); }
  finally { f.h.dispose(); }
});

test('saved Sheet-qualified source denial removes Panel originals while recovery actions remain', t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse(p2now) });
  const f = mounted(async () => ({ data: null, error: null }), true);
  try { assert(textContent(f.h.render()).includes('Private observation secret')); noHistory(f.h.render({ sourceDenied: true })); }
  finally { f.h.dispose(); }
});
