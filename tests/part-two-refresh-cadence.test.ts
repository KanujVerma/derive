import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { normalize, LOCAL_DICTIONARY_RELEASE } from '../src/domain/part-two/index.ts';
import { boundDeclaration, p2metadata, p2id, p2now } from './fixtures/part-two-core.ts';
import { componentHarness, control } from './ux-profile-render.ts';

/** Real sheet/hook/controller with inert native hosts and synthetic source only. */
test('unchanged Part 1 refreshes preserve ready P2 details until its own authority poll; new evidence rebinds immediately', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout', 'setInterval'], now: Date.parse(p2now) });
  const input = boundDeclaration('Glycerin', 'public'); let calls = 0, sequence = 150;
  const transport = { normalize: async (request: { requestId: string; expectedEvidenceRevision: number }) => {
    calls++;
    return normalize({ ...input, binding: { ...input.binding, requestId: request.requestId,
      evidenceRevision: request.expectedEvidenceRevision } }, LOCAL_DICTIONARY_RELEASE, p2metadata);
  } };
  const result = { scanId: input.binding.scanId, requestId: input.binding.requestId, generation: input.binding.generation,
    resultRevision: input.binding.evidenceRevision, declarationState: 'partial', identity: 'exact', work: 'complete',
    snapshotId: input.binding.snapshotId, declarationId: input.binding.declarationId, scope: 'public',
    freshness: { state: 'fresh', observedAt: p2now, expiresAt: input.binding.expiresAt }, allowedActions: [],
    display: { selectedIdentity: null, candidates: [], sections: [], sources: [], limitations: [] } };
  const view = { owner: input.binding.authenticatedOwnerId, result, saved: false, loading: false, error: null, scrollOffset: 0 };
  const h = componentHarness('src/components/check/part-one/PartOneResultSheet.tsx', 'PartOneResultSheet',
    { view, onClose() {}, onSave() {}, onSelect() {}, onSearch() {}, onRefresh() {}, onFullChange() {} },
    { effects: true, modules: { '../../ui/Button': { Button: 'Button' },
      '../../../services/productCatalog': { createCatalogRequestId: () => p2id(sequence++) },
      '../../../services/partTwo': { PART_TWO_ENABLED: true, partTwoTransport: transport },
      '../result-sheet/ResultSheetSurface': { ResultSheetSurface: (p: any) => React.createElement('Surface', p, p.summary, p.compactActions, p.children, p.overlay) },
    } });
  t.after(() => h.dispose());
  const settle = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); return h.render(); };
  h.render(); assert.equal(calls, 1); assert(control(await settle(), 'Ingredient details: Glycerin'));
  const overlay = React.createElement('LabelCapture', { draft: 'retained synthetic draft' });
  let nodes = h.render({ captureContent: overlay });
  assert.equal(nodes.find(node => node.type === 'Surface')!.props.overlay, overlay);
  assert(nodes.some(node => node.type === 'LabelCapture')); assert(control(nodes, 'Ingredient details: Glycerin'));
  nodes = h.render({ captureContent: null });
  assert(!nodes.some(node => node.type === 'LabelCapture')); assert(control(nodes, 'Ingredient details: Glycerin'));
  assert.equal(calls, 1, 'capture open/close does not rebind canonical ingredient evidence');
  h.render({ view: { ...view, result: structuredClone(result), scrollOffset: 40 } });
  t.mock.timers.tick(10000); assert.equal(calls, 1, 'unchanged evidence and parent refresh do not reset readiness or normalize');
  assert(control(h.render(), 'Ingredient details: Glycerin'));
  t.mock.timers.tick(5000); assert.equal(calls, 2, 'the intentional P2 authority refresh still runs at fifteen seconds');
  assert(control(await settle(), 'Ingredient details: Glycerin'));
  h.render({ view: { ...view, result: { ...result, resultRevision: result.resultRevision + 1 } } });
  assert.equal(calls, 3, 'a changed authoritative evidence revision must not reuse the earlier interpretation');
  assert(control(await settle(), 'Ingredient details: Glycerin'));
});
