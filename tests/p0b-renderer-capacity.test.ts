import assert from 'node:assert/strict';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { describePersonalDecision } from '../src/presentation/personal-decision/result.ts';
import { personalDecisionPacketSchema } from '../src/presentation/personal-decision/parse.ts';
import { personalDecisionFixtures } from '../src/fixtures/personal-decision/fixtures.ts';

// Unicode keeps this below the character ceiling while exceeding a 1 MiB UTF-8 byte budget.
test('P0-B transport rejects oversized UTF-8 JSON before accepting otherwise bounded arrays', () => {
  const packet = structuredClone(personalDecisionFixtures[0].packet);
  packet.evidenceNeeds = [];
  const base = packet.findings[0];
  packet.findings = Array.from({ length: 20 }, (_, index) => ({ ...base, id: `large:${index}`, evidenceNeedIds: [],
    uncertainty: Array.from({ length: 30 }, () => '界'.repeat(600)) }));
  packet.action.findingIds = packet.findings.map((finding) => finding.id);
  packet.action.primaryFindingId = packet.findings[0].id;
  const json = JSON.stringify(packet);
  assert.ok(json.length < 1_048_576);
  assert.ok(Buffer.byteLength(json, 'utf8') > 1_048_576);
  assert.equal(personalDecisionPacketSchema.safeParse(packet).success, false);
});

test('P0-B byte guard counts surrogate pairs and JSON-escaped lone surrogates without TextEncoder', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'TextEncoder');
  try {
    Object.defineProperty(globalThis, 'TextEncoder', { value: undefined, configurable: true, writable: true });
    for (const [character, count, expected] of [['🙂', 20, true], ['\ud800', 10, false]] as const) {
      const packet = structuredClone(personalDecisionFixtures[0].packet);
      packet.evidenceNeeds = [];
      const base = packet.findings[0];
      packet.findings = Array.from({ length: count }, (_, index) => ({ ...base, id: `unicode:${index}`, evidenceNeedIds: [],
        uncertainty: Array.from({ length: 30 }, () => character.repeat(character === '🙂' ? 300 : 600)) }));
      packet.action.findingIds = packet.findings.map((finding) => finding.id);
      packet.action.primaryFindingId = packet.findings[0].id;
      assert.equal(Buffer.byteLength(JSON.stringify(packet), 'utf8') <= 1_048_576, expected);
      assert.equal(personalDecisionPacketSchema.safeParse(packet).success, expected);
    }
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'TextEncoder', descriptor);
    else Reflect.deleteProperty(globalThis, 'TextEncoder');
  }
});

// Generated from the actual P0-B finding engine (p0b-findings/4), source commit 0556117777ae461f4379d9657be6229e20a2e65c.
// Input: 50 distinct UUID routine products; category match plus 2 overlap terms/item;
// reaction/ineffective × current/old/unknown formula classes/item; 10 Unicode sensitivities,
// reproductive/profile cautions, and 3 target-product reaction formula classes.
// This compression is only a test-source representation. Production packets remain flat JSON.
const generatedPacketGzip = [
  'H4sIAAAAAAAC/+19XXPsRpLdX2HwGdpBVdYHwH1aO2bDehlv7OzaEd5QMHhJXKkt3ibdJK+kmdA/8Kt/o/+G0d1kN5Ji43YWCoALdRQTGuFeNoGuwjknkScz',
  '8ffLp9ufmi83/63ZPK0e1pdXl4/tfz2sb+6/u2tuV9s/+9NXdVlcru7av6tf//lu9y+z/Vf1dvj2T/uzzdeb+5eb5+bun57bD+lSu+/K+jvt/q0sr3b/+x/t',
  'D31are9W6x8vr/5++fDLutl8vz3BTbn/57vdv8z2X9Xb4es/24t53Dzcvdw+/3V98/j008PzuR+1f/zovzZfV69ffPuLnx5eNrfNf3p4Wd/dbH5795evHz33',
  'bLr9yNebzepmffZHqP3I54fNl5f7tw0595Nmf32fV/dN56rP+KBrP7h5eHlerYUf9O0Hf1o9PT+wdTrjg9Xl7+3C7L/e03b7m/WP7dm3t1756bvP+9vi6U+7',
  'b/Rwv7r97fVv9gd/0vtv+j+b2+fXG3b7d/ut+e71znu9a9vzvP26y6v/+Pv+Hn5q1k+r59XX1fNvV2X7u35uf6L9403z+LBpb9nr9qc3zd2qWT9fd360/cGb',
  'x8f2Am4+re63x1eH4/tme+M07Tfa//ntzcvuyorL24f159Vds77dfrmnl8f9GbYL/nLf7Hb2SV83v97cvj/V9u+PiFQ7SL39ovZ7vF7y65e+/tz+gu0l3D48',
  'bk/0egNt/6TvJt+d//7mU3N/+KOk7vffi8NCtOv83Px6XIjjrbFHRPtnYorZyFHU3D5s7r6/65z39x+Ky5d21zbPN6v19ub4jx+OW/mXpml/entnXq7b/2xv',
  'xvYv71ZPj/c3v21h8frlOvfj6/fcsvHhD9ufKP/v//nf+fxvj6vdOnRQy/HztsTfr++aX5vtEpeF+uH37S3zBw5Q4ABwQPIcoMABAzhAgwPAAclzgAYHDOAA',
  'AgeAA5LnAAIHDOAAAw4AByTPAQYcMIADLDgAHJA8B1hwwAAOcOAAcEDyHODAAQM4wIMDwAHJc4AHBwzggAocAA5IngMqcMAADqjBAeCA5DmgBgcIOaD92P7e',
  'Xn1trhSvFDz8xdtyXx8BPRIFbJrn1fphdXfdPT1oYDk0cLzG7e9rfmlv2Nv7m9WX7Q2y/f9v3Qi7Hzq9fXftfdfeyG+/+7sn/dFeGvtZeU+NqSu6pVtdVaaq',
  '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',
].join('');

test('P0-B actual bounded engine corpus retains all material findings through parsing and templates', () => {
  const raw = gunzipSync(Buffer.from(generatedPacketGzip, 'base64'));
  assert.equal(createHash('sha256').update(raw).digest('hex'), '4741465cab67739ed973aa33506f491710799dfead8b6dc58163676776dd6045');
  assert.equal(raw.byteLength, 614023);
  assert.ok(raw.byteLength <= 1_048_576);
  const packet = JSON.parse(raw.toString('utf8'));
  // The archived engine fixture predates per-Check binding; its scenario explicitly used add.
  packet.binding.checkIntent = 'add';
  const parsed = personalDecisionPacketSchema.safeParse(packet);
  assert.equal(parsed.success, true);
  if (!parsed.success) return;
  assert.equal(parsed.data.findings.length, 471);
  assert.equal(parsed.data.routineImpacts.length, 150);
  assert.equal(parsed.data.action.findingIds.length, 471);
  assert.equal(Math.max(...parsed.data.evidenceNeeds.map((need) => need.findingIds.length)), 300);
  assert.deepEqual(parsed.data, packet);
  const view = describePersonalDecision(packet, packet.binding);
  assert.equal(view.kind, 'ready');
  if (view.kind === 'ready') {
    assert.equal(view.action, packet.action.kind);
    assert.equal(view.details.length, packet.findings.length);
    assert.ok(view.secondaryCautions.length > 0);
    assert.ok(view.unknowns.some((unknown) => unknown.critical));
  }
  for (const field of ['findings', 'routineImpacts'] as const) {
    const oversized = structuredClone(packet);
    const limit = field === 'findings' ? 512 : 200;
    while (oversized[field].length <= limit) oversized[field].push(oversized[field][0]);
    assert.equal(personalDecisionPacketSchema.safeParse(oversized).success, false);
  }
  const excessiveRefs = structuredClone(packet);
  excessiveRefs.action.findingIds = Array.from({ length: 513 }, () => packet.findings[0].id);
  assert.equal(personalDecisionPacketSchema.safeParse(excessiveRefs).success, false);
  const excessiveNeedRefs = structuredClone(packet);
  excessiveNeedRefs.evidenceNeeds[0].findingIds = [...excessiveRefs.action.findingIds];
  assert.equal(personalDecisionPacketSchema.safeParse(excessiveNeedRefs).success, false);
  const excessiveEvidence = structuredClone(packet);
  excessiveEvidence.findings[0].evidence = Array.from({ length: 101 }, () => packet.findings[0].evidence[0]);
  assert.equal(personalDecisionPacketSchema.safeParse(excessiveEvidence).success, false);
  const excessiveIndexes = structuredClone(packet);
  excessiveIndexes.findings[0].display.evidenceIndexes = Array.from({ length: 101 }, () => 0);
  assert.equal(personalDecisionPacketSchema.safeParse(excessiveIndexes).success, false);
});
