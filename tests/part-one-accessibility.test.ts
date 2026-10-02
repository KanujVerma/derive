import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { componentHarness, control, textContent, press } from './ux-profile-render.ts';
import type { ScanResult } from '../src/contracts/PartOne.ts';

test('A29 incomplete results expose named save, capture, retry and rescan actions with textual status', () => {
  const calls: string[] = [];
  const result = { scanId: 'fixture', declarationState: 'partial', identity: 'exact', work: 'retry_wait', snapshotId: 'snapshot',
    display: { selectedIdentity: { name: 'Synthetic Lotion', brand: 'Fixture', variantText: '100 ml', image: null }, candidates: [], sections: [], sources: [], limitations: ['Label tail is missing. Add a photo of the right edge.'] },
    freshness: { state: 'unknown', observedAt: null, expiresAt: null }, allowedActions: ['save_partial', 'retry', 'rescan'] } as unknown as ScanResult;
  const h = componentHarness('src/components/check/part-one/PartOneResultSheet.tsx', 'PartOneResultSheet', {
    view: { owner: 'fixture', result, saved: false, loading: false, error: null, scrollOffset: 0 },
    onClose: () => calls.push('rescan'), onSave: () => calls.push('save'), onCapture: () => calls.push('capture'),
    onRefresh: () => calls.push('retry'), onSelect() {}, onSearch() {}, onFullChange() {},
  }, { modules: {
    '../../ui/Button': { Button: 'Button' },
    '../result-sheet/ResultSheetSurface': { ResultSheetSurface: (props: any) => React.createElement('Surface', props, props.summary, props.compactActions, props.children) },
  } });
  const nodes = h.render();
  for (const label of ['Save product without verified ingredients', 'Scan ingredients', 'Check lookup status', 'Rescan']) press(control(nodes, label));
  assert.deepEqual(calls, ['save', 'capture', 'retry', 'rescan']);
  assert.match(textContent(nodes), /unverified|incomplete/i);
  assert.match(textContent(nodes), /right edge/);
  assert(nodes.some(node => node.props.accessibilityLiveRegion === 'polite'));
  assert(nodes.some(node => node.props.accessibilityRole === 'header'));
});

test('A26 expired accepted ingredients are purged from the rendered sheet before another server read', () => {
  const result = { scanId: 'fixture', declarationState: 'accepted', identity: 'exact', work: 'complete', snapshotId: 'snapshot',
    freshness: { state: 'fresh', observedAt: '2024-01-01T00:00:00Z', expiresAt: '2024-01-02T00:00:00Z' },
    display: { selectedIdentity: { name: 'Independent identity', brand: 'Fixture', variantText: '', image: null }, candidates: [], sections: [{ sectionId: 'private', kind: 'inci', text: 'EXPIRED INGREDIENT TEXT' }], sources: [], limitations: [] },
    allowedActions: ['save', 'retry', 'rescan'] } as unknown as ScanResult;
  const nodes = componentHarness('src/components/check/part-one/PartOneResultSheet.tsx', 'PartOneResultSheet', {
    view: { owner: 'fixture', result, saved: false, loading: false, error: null, scrollOffset: 0 },
    onClose() {}, onSave() {}, onCapture() {}, onRefresh() {}, onSelect() {}, onSearch() {}, onFullChange() {},
  }, { modules: {
    '../../ui/Button': { Button: 'Button' },
    '../result-sheet/ResultSheetSurface': { ResultSheetSurface: (props: any) => React.createElement('Surface', props, props.summary, props.compactActions, props.children) },
  } }).render();
  assert.match(textContent(nodes), /expired/); assert.match(textContent(nodes), /Independent identity/);
  assert(!textContent(nodes).includes('EXPIRED INGREDIENT TEXT'));
  assert(!nodes.some(node => node.props.label === 'Save product and evidence'));
  assert(control(nodes, 'Scan ingredients'));
});
