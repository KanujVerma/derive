import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { gunzipSync } from 'node:zlib';
import { describePersonalDecision } from '../src/presentation/personal-decision/result.ts';
import type { DecisionDetailGroup } from '../src/presentation/personal-decision/disclosure.ts';
import { decisionPage } from '../src/presentation/personal-decision/disclosure.ts';
import { personalDecisionFixtures } from '../src/fixtures/personal-decision/fixtures.ts';

function actualPacket() {
  const source = readFileSync(new URL('./p0b-renderer-capacity.test.ts', import.meta.url), 'utf8');
  const block = source.split('const generatedPacketGzip = [')[1].split("].join('');")[0];
  const compressed = [...block.matchAll(/'([A-Za-z0-9+/=]+)'/g)].map(match => match[1]).join('');
  const packet = JSON.parse(gunzipSync(Buffer.from(compressed, 'base64')).toString('utf8'));
  // Explicit add precondition of the archived capacity scenario.
  packet.binding.checkIntent = 'add';
  return packet;
}

test('P0-B maximum corpus groups displayed meanings while retaining every finding and source', () => {
  const packet = actualPacket(), before = JSON.stringify(packet);
  const view = describePersonalDecision(packet, packet.binding);
  assert.equal(view.kind, 'ready'); if (view.kind !== 'ready') return;
  assert.equal(view.details.length, 471);
  assert.equal(view.detailGroups.filter(group => /ingredient you reported as a sensitivity/.test(group.reason)).length, 10);
  assert.ok(view.detailGroups.length < view.details.length);
  assert.deepEqual(new Set(view.detailGroups.flatMap(group => group.findingIds)), new Set(packet.findings.map((finding: { id: string }) => finding.id)));
  for (const finding of packet.findings) for (const source of finding.evidence) {
    assert.ok(view.detailGroups.flatMap(group => group.evidence).some(row => row.findingIds.includes(finding.id) && isDeepStrictEqual(row.source, source)));
  }
  const first = decisionPage(view.detailGroups, 0);
  assert.ok(first.items.length <= 10);
  for (let page = 0; page < first.pageCount; page++) {
    const groups: DecisionDetailGroup[] = decisionPage(view.detailGroups, page).items;
    assert.ok(groups.length <= 10);
    for (const group of groups) {
      const evidence = decisionPage(group.evidence, 0);
      assert.ok(evidence.items.length <= 10);
      const all = Array.from({ length: evidence.pageCount }, (_, index) => decisionPage(group.evidence, index).items).flat();
      assert.deepEqual(all, group.evidence);
    }
  }
  assert.equal(JSON.stringify(packet), before);
  assert.ok(view.unknowns.some(unknown => unknown.critical));
});

test('P0-B three reaction formula classes do not repeat the primary caution as secondary copy', () => {
  const { packet, binding } = structuredClone(personalDecisionFixtures.find(fixture => fixture.id === 'caution')!);
  const original = packet.findings.find(finding => finding.kind === 'prior_product_reaction')!;
  if (original.display?.kind === 'prior_reaction') original.display.historicalFormulaVersionId = binding.formulaVersionId;
  for (const suffix of ['old', 'unknown']) {
    const finding = structuredClone(original); finding.id += ':' + suffix;
    if (finding.display?.kind === 'prior_reaction') { finding.display.historyEventId += ':' + suffix; finding.display.historicalFormulaVersionId = suffix === 'old' ? 'fixture-formula:old' : null; }
    for (const evidence of finding.evidence) if (evidence.kind === 'context_fact') evidence.recordId += ':' + suffix;
    packet.findings.push(finding); packet.action.findingIds.push(finding.id);
  }
  const view = describePersonalDecision(packet, binding);
  assert.equal(view.kind, 'ready'); if (view.kind !== 'ready') return;
  assert.ok(!view.secondaryCautions.includes(view.primaryReason));
  assert.equal(view.details.length, packet.findings.length);
  assert.equal(view.detailGroups.filter(group => group.reason === view.primaryReason).length, 3);
});

test('P0-B paging remains bounded for invalid or arbitrarily advanced page requests', () => {
  const values = Array.from({ length: 471 }, (_, index) => index);
  for (const requested of [-1, 0, 1, 999999, Number.NaN]) {
    const page = decisionPage(values, requested, 1000);
    assert.ok(page.items.length <= 10);
    assert.ok(page.page >= 0 && page.page < page.pageCount);
  }
});

test('P0-B known blockers remain mandatory while optional secondary caution review is bounded', () => {
  const { packet, binding } = structuredClone(personalDecisionFixtures.find(fixture => fixture.id === 'caution')!);
  packet.action.primaryFindingId = 'goal-role';
  packet.findings.find(finding => finding.kind === 'prior_product_reaction')!.severity = 'blocker';
  const view = describePersonalDecision(packet, binding);
  assert.equal(view.kind, 'ready'); if (view.kind !== 'ready') return;
  assert.ok(view.criticalCautions.some(text => /reported a reaction/i.test(text)));
  assert.ok(view.unknowns.length > 0);
});
