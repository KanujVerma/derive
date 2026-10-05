import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { componentHarness, control, textContent, press } from './ux-profile-render.ts';
import type { ScanResult } from '../src/contracts/PartOne.ts';

test('A29 incomplete results expose named save, capture, retry and rescan actions with textual status', () => {
  const calls: string[] = [];
  const result = { scanId: 'fixture', declarationState: 'partial', identity: 'exact', work: 'retry_wait', snapshotId: 'snapshot',
    display: { selectedIdentity: { name: 'Synthetic Lotion', brand: 'Fixture', variantText: '100 ml', expiresAt: '2099-01-01T00:00:00Z', image: null }, candidates: [], sections: [], sources: [], limitations: ['Label tail is missing. Add a photo of the right edge.'] },
    freshness: { state: 'unknown', observedAt: null, expiresAt: null }, allowedActions: ['save_partial', 'retry', 'rescan'] } as unknown as ScanResult;
  const h = componentHarness('src/components/check/part-one/PartOneResultSheet.tsx', 'PartOneResultSheet', {
    view: { owner: 'fixture', result, saved: false, loading: false, error: null, scrollOffset: 0 },
    onClose: () => calls.push('rescan'), onSave: () => calls.push('save'), onCapture: () => calls.push('capture'),
    onRefresh: () => calls.push('retry'), onSelect() {}, onSearch() {}, onFullChange() {},
  }, { modules: {
    '../../ui/Button': { Button: 'Button' },
    '../result-sheet/ResultSheetSurface': { ResultSheetSurface: (props: any) => React.createElement('Surface', props, props.summary, props.compactActions, props.footer, props.children) },
  } });
  const nodes = h.render();
  for (const label of ['Save', 'Scan ingredients', 'Retry']) press(control(nodes, label));
  for (const label of ['Scan ingredients', 'Retry', 'Search by name']) {
    assert(control(nodes, label).props.style.minHeight >= 44, `${label} must retain a 44pt touch target at small text sizes`);
  }
  assert.deepEqual(calls, ['save', 'capture', 'retry']);
  assert.match(textContent(nodes), /unverified|incomplete/i);
  assert.match(textContent(nodes), /right edge/);
  assert(nodes.some(node => node.props.accessibilityLiveRegion === 'polite'));
  assert(nodes.some(node => node.props.accessibilityRole === 'header'));
});

test('A26 expired accepted ingredients are purged from the rendered sheet before another server read', () => {
  const result = { scanId: 'fixture', declarationState: 'accepted', identity: 'exact', work: 'complete', snapshotId: 'snapshot',
    freshness: { state: 'fresh', observedAt: '2024-01-01T00:00:00Z', expiresAt: '2024-01-02T00:00:00Z' },
    display: { selectedIdentity: { name: 'Independent identity', brand: 'Fixture', variantText: '', expiresAt: '2099-01-01T00:00:00Z', image: null }, candidates: [], sections: [{ sectionId: 'private', kind: 'inci', text: 'EXPIRED INGREDIENT TEXT' }], sources: [], limitations: [] },
    allowedActions: ['save', 'retry', 'rescan'] } as unknown as ScanResult;
  const nodes = componentHarness('src/components/check/part-one/PartOneResultSheet.tsx', 'PartOneResultSheet', {
    view: { owner: 'fixture', result, saved: false, loading: false, error: null, scrollOffset: 0 },
    onClose() {}, onSave() {}, onCapture() {}, onRefresh() {}, onSelect() {}, onSearch() {}, onFullChange() {},
  }, { modules: {
    '../../ui/Button': { Button: 'Button' },
    '../result-sheet/ResultSheetSurface': { ResultSheetSurface: (props: any) => React.createElement('Surface', props, props.summary, props.compactActions, props.footer, props.children) },
  } }).render();
  assert.match(textContent(nodes), /expired/); assert.match(textContent(nodes), /Independent identity/);
  assert(!textContent(nodes).includes('EXPIRED INGREDIENT TEXT'));
  assert(!nodes.some(node => node.props.label === 'Save'));
  assert(control(nodes, 'Scan ingredients'));
});

test('A26 partial text, source links and package images each expire locally while identity survives', () => {
  const now = Date.now; Date.now = () => Date.parse('2026-10-02T12:00:02Z');
  try {
    const result = { scanId: 'fixture', declarationState: 'partial', identity: 'exact', work: 'complete', snapshotId: 'snapshot',
      freshness: { state: 'fresh', observedAt: '2026-10-02T12:00:00Z', expiresAt: '2026-10-02T13:00:00Z' },
      display: { selectedIdentity: { name: 'Independent identity', brand: 'Fixture', variantText: '', expiresAt: '2099-01-01T00:00:00Z', image: { url: 'https://fixture.invalid/expired.png', expiresAt: '2026-10-02T12:00:01Z' } }, candidates: [],
        sections: [{ sectionId: 'expired', kind: 'ingredients', text: 'EXPIRED PARTIAL TEXT', expiresAt: '2026-10-02T12:00:01Z' }, { sectionId: 'fresh', kind: 'inactive', text: 'CURRENT PARTIAL TEXT', expiresAt: '2026-10-02T13:00:00Z' }],
        sources: [{ observationId: 'old', label: 'EXPIRED SOURCE', observedAt: '2026-10-02T12:00:00Z', expiresAt: '2026-10-02T12:00:01Z', url: 'https://fixture.invalid/expired' }], limitations: [] }, allowedActions: ['save_partial'] } as unknown as ScanResult;
    const nodes = componentHarness('src/components/check/part-one/PartOneResultSheet.tsx', 'PartOneResultSheet', {
      view: { owner: 'fixture', result, saved: false, loading: false, error: null, scrollOffset: 0 }, onClose() {}, onSave() {}, onCapture() {}, onRefresh() {}, onSelect() {}, onSearch() {}, onFullChange() {},
    }, { modules: { '../../ui/Button': { Button: 'Button' }, '../result-sheet/ResultSheetSurface': { ResultSheetSurface: (props: any) => React.createElement('Surface', props, props.summary, props.compactActions, props.footer, props.children) } } }).render();
    assert(!textContent(nodes).includes('EXPIRED PARTIAL TEXT'));
    assert(!textContent(nodes).includes('EXPIRED SOURCE'));
    assert(textContent(nodes).includes('CURRENT PARTIAL TEXT'));
    assert(textContent(nodes).includes('Independent identity'));
    assert(!nodes.some(n => n.props.source?.uri === 'https://fixture.invalid/expired.png'));
    assert.match(textContent(nodes), /expired/);
  } finally { Date.now = now; }
});

test('Offline identity and unselected candidates expire even when no declaration is ready', () => {
  const result = { scanId: 'fixture', declarationState: 'none', identity: 'ambiguous', work: 'complete', snapshotId: null,
    freshness: { state: 'unknown', observedAt: null, expiresAt: null },
    display: { selectedIdentity: null, candidates: [{ id: 'old', name: 'EXPIRED CANDIDATE', brand: null, variantText: 'old', image: null, expiresAt: '2024-01-01T00:00:00Z' }], sections: [], sources: [], limitations: [] }, allowedActions: ['choose_candidate'] } as unknown as ScanResult;
  const h = componentHarness('src/components/check/part-one/PartOneResultSheet.tsx', 'PartOneResultSheet', {
    view: { owner: 'fixture', result, saved: false, loading: false, error: null, scrollOffset: 0 }, onClose() {}, onSave() {}, onCapture() {}, onRefresh() {}, onSelect() {}, onSearch() {}, onFullChange() {},
  }, { modules: { '../../ui/Button': { Button: 'Button' }, '../result-sheet/ResultSheetSurface': { ResultSheetSurface: (props: any) => React.createElement('Surface', props, props.summary, props.compactActions, props.footer, props.children) } } });
  assert(!textContent(h.render()).includes('EXPIRED CANDIDATE'));
  result.snapshotId = 'old-snapshot'; result.identity = 'exact'; result.display.selectedIdentity = { ...result.display.candidates[0], name: 'EXPIRED IDENTITY' }; result.display.candidates = []; result.allowedActions = ['save_partial'];
  assert(!textContent(h.render()).includes('EXPIRED IDENTITY'));
  assert(!h.render().some(n => n.props.label === 'Save'));
});

test('single Save cannot fall back to a second product save during personal read loading or after confirmation', () => {
  const result = { scanId:'fixture',declarationState:'partial',identity:'exact',work:'complete',snapshotId:'snapshot',display:{selectedIdentity:{name:'Synthetic lotion',brand:'Fixture',variantText:'',expiresAt:'2099-01-01T00:00:00Z',image:null},candidates:[],sections:[],sources:[],limitations:[]},freshness:{state:'fresh',observedAt:'2026-10-01T00:00:00Z',expiresAt:'2099-01-01T00:00:00Z'},allowedActions:['save_partial'] } as unknown as ScanResult;
  const personal = {enabled:true,context:null,choices:{},view:{target:null,result:null,historical:null,question:null,savedAssessmentId:null as string|null,savedAt:null,loading:true,saving:false,error:null,pendingSave:false},interact(){},refresh(){}};
  const h=componentHarness('src/components/check/part-one/PartOneResultSheet.tsx','PartOneResultSheet',{view:{owner:'fixture',result,saved:false,loading:false,error:null,scrollOffset:0},onClose(){},onSave(){throw Error('Wrong product save');},onCapture(){},onRefresh(){},onSelect(){},onSearch(){},onFullChange(){}},{modules:{
    '../part-three/usePartThreeCheck':{usePartThreeCheck:()=>personal},
    '../../ui/Button':{Button:'Button'},
    '../result-sheet/ResultSheetSurface':{ResultSheetSurface:(p:any)=>React.createElement('Surface',p,p.summary,p.compactActions,p.footer,p.children)},
  }});
  assert.equal(h.render().filter(n=>n.props.label==='Save'||n.props.label==='Saved').length,0,'A loading assessment does not expose product Save');
  personal.view.savedAssessmentId='confirmed-assessment';
  let nodes=h.render();assert.equal(nodes.filter(n=>n.props.label==='Saved').length,1);assert(control(nodes,'Saved').props.disabled);assert(!nodes.some(n=>n.props.label==='Save'));
  personal.view.loading=false;nodes=h.render();assert.equal(nodes.filter(n=>n.props.label==='Saved').length,1);assert(!nodes.some(n=>n.props.label==='Save'),'Confirmed assessment cannot become a duplicate product Save');
});
