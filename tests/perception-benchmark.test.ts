import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { evaluatePerceptionBenchmark, parseFrozenPerceptionManifest, sha256, unpreparedPerceptionReport } from '../scripts/perception-benchmark.ts';

// Fabricated self-check inputs, NOT real images or provider accuracy evidence.
function fixture() {
  const manifest = { schemaVersion: 1, benchmarkId: 'synthetic-self-check', cases: [
    { id: 'front', imageFile: 'front.jpg', imageSha256: sha256('fabricated-front'), scenarios: ['clear_front'],
      rights: { sourceEvidenceRef: 'synthetic-source', permissionEvidenceRef: 'synthetic-permission', allowedUses: ['local_evaluation', 'provider_evaluation'] },
      goldEvidenceRef: 'synthetic-gold', gold: { schemaVersion: 1, evidenceId: 'front', role: 'front_label', outcome: 'candidate', brandText: 'Fiction', productNameText: 'Synthetic lotion', variantText: 'Small', numbers: [{ text: '0.1', unitText: '%', contextText: 'printed amount' }] } },
    { id: 'unknown', imageFile: 'unknown.jpg', imageSha256: sha256('fabricated-unknown'), scenarios: ['blur', 'low_light'],
      rights: { sourceEvidenceRef: 'synthetic-source', permissionEvidenceRef: 'synthetic-permission', allowedUses: ['local_evaluation', 'provider_evaluation'] },
      goldEvidenceRef: 'synthetic-gold', gold: { schemaVersion: 1, evidenceId: 'unknown', role: 'packaging', outcome: 'abstained', abstentionReason: 'unreadable' } },
  ], providers: [{ id: 'local-baseline', processing: 'local' }, { id: 'cloud-candidate', processing: 'cloud', privacyReviewRef: 'synthetic-review' }] };
  const json = JSON.stringify(manifest);
  const images = new Map(manifest.cases.map(row => [row.imageFile, row.imageSha256]));
  const run = { providerId: 'cloud-candidate', modelVersion: 'synthetic-version', adapterSha256: sha256('adapter'), promptSha256: sha256('prompt'),
    entries: manifest.cases.map(row => ({ caseId: row.id, imageSha256: row.imageSha256, output: row.gold as unknown, latencyMs: 10, costUsd: 0.001 })) };
  return { manifest, json, images, run };
}
function evaluate(value = fixture(), outputs: unknown = []) {
  return evaluatePerceptionBenchmark(value.json, sha256(value.json), value.images, outputs);
}

test('absent real corpus and absent provider outputs never become accuracy or a winner', () => {
  const empty = unpreparedPerceptionReport();
  assert.equal(empty.imageCount, 0);
  assert.equal(empty.status, 'CORPUS_NOT_READY');
  assert.equal(empty.realImageAccuracy, null);
  assert.equal(empty.latencyMs, null);
  assert.equal(empty.costUsd, null);
  assert.ok(empty.scenarios.every(row => row.status === 'NOT_RUN'));
  const report = evaluate();
  assert.equal(report.providerWinner, 'NONE_SELECTED');
  for (const provider of report.providers) {
    assert.equal(provider.status, 'NOT_RUN');
    assert.equal(provider.executed, 0);
    assert.equal(provider.notRun, 2);
    assert.equal(provider.exactCandidateRate, null);
    assert.equal(provider.meanLatencyMs, null);
    assert.equal(provider.totalCostUsd, null);
    assert.ok(Object.values(provider.metrics).every(metric => metric.rate === null));
  }
});

test('frozen identity binds manifest bytes, exact images and provider execution inputs', () => {
  const f = fixture();
  assert.throws(() => parseFrozenPerceptionManifest(f.json + ' ', sha256(f.json)));
  assert.throws(() => evaluatePerceptionBenchmark(f.json, sha256(f.json), new Map()));
  f.run.entries[0].imageSha256 = sha256('changed');
  assert.throws(() => evaluate(f, [f.run]));
});

test('rights, gold-source and cloud privacy review are required before replay', () => {
  for (const mutate of [
    (f: ReturnType<typeof fixture>) => { f.manifest.cases[0].rights.permissionEvidenceRef = ''; },
    (f: ReturnType<typeof fixture>) => { f.manifest.cases[0].goldEvidenceRef = ''; },
    (f: ReturnType<typeof fixture>) => { f.manifest.providers[1].privacyReviewRef = ''; },
  ]) {
    const f = fixture(); mutate(f); f.json = JSON.stringify(f.manifest);
    assert.throws(() => evaluate(f, [f.run]));
  }
  const f = fixture(); f.manifest.cases[0].rights.allowedUses = ['local_evaluation']; f.json = JSON.stringify(f.manifest);
  assert.throws(() => evaluate(f, [f.run]));
  f.run.providerId = 'local-baseline';
  assert.equal(evaluate(f, [f.run]).providers[0].passed, 2);
});

test('independent supplied outputs compare literal fields, retain partial NOT_RUN and observed measurements', () => {
  const f = fixture(); f.run.entries.pop();
  const provider = evaluate(f, [f.run]).providers[1];
  assert.equal(provider.passed, 1); assert.equal(provider.notRun, 1);
  assert.equal(provider.metrics.variantText.correct, 1);
  assert.equal(provider.metrics.orderedIngredients.rate, null);
  assert.equal(provider.meanLatencyMs, 10);
  assert.equal(provider.totalCostUsd, 0.001);
  assert.equal(provider.rows[1].status, 'NOT_RUN');
});

test('invented variants, changed decimals, unsupported non-abstention and authority fields fail', () => {
  const f = fixture();
  f.run.entries[0].output = { ...f.manifest.cases[0].gold, variantText: 'Invented', numbers: [{ text: '1', unitText: '%', contextText: 'printed amount' }] };
  f.run.entries[1].output = { schemaVersion: 1, evidenceId: 'unknown', role: 'packaging', outcome: 'candidate', brandText: 'Guessed' } as typeof f.run.entries[1]['output'];
  const report = evaluate(f, [f.run]).providers[1];
  assert.equal(report.failed, 2); assert.equal(report.unsupportedCandidateCount, 1);
  assert.ok(report.rows[0].errors.includes('variantText'));
  assert.ok(report.rows[0].errors.includes('numbers'));
  const malicious = structuredClone(f.run);
  (malicious.entries[0].output as Record<string, unknown>).verified = true;
  assert.deepEqual(evaluate(f, [malicious]).providers[1].rows[0].errors, ['INVALID_EXTRACTION_OUTPUT']);
});

test('rejects duplicates, unknown keys, path escape, unregistered providers and unmeasured executions', () => {
  const f = fixture();
  assert.throws(() => evaluate(f, [f.run, f.run]));
  assert.throws(() => evaluate(f, [{ ...f.run, entries: [f.run.entries[0], f.run.entries[0]] }]));
  assert.throws(() => evaluate(f, [{ ...f.run, providerId: 'unregistered' }]));
  assert.throws(() => evaluate(f, [{ ...f.run, secret: 'never-allowed' }]));
  assert.throws(() => evaluate(f, [{ ...f.run, entries: [{ ...f.run.entries[0], latencyMs: undefined }] }]));
  f.manifest.cases[0].imageFile = '../private.jpg'; f.json = JSON.stringify(f.manifest);
  assert.throws(() => evaluate(f));
});

test('reports contain metrics and opaque identity only, not gold, images, rights or output strings', () => {
  const f = fixture(); const serialized = JSON.stringify(evaluate(f, [f.run]));
  for (const prohibited of ['Synthetic lotion', 'synthetic-permission', 'synthetic-source', 'synthetic-review', 'front.jpg', 'printed amount']) assert.equal(serialized.includes(prohibited), false);
});

test('CLI verifies bounded image bytes and fails with sanitized diagnostics on tampering or symlinks', () => {
  const directory = mkdtempSync(join(tmpdir(), 'derive-perception-test-'));
  try {
    const f = fixture();
    for (const [index, row] of f.manifest.cases.entries()) {
      const bytes = Buffer.from([0xff, 0xd8, 0xff, 1, 2, 3, 4, 5, 6, 7, 8, index]);
      row.imageSha256 = sha256(bytes);
      writeFileSync(join(directory, row.imageFile), bytes);
    }
    f.json = JSON.stringify(f.manifest);
    const manifestPath = join(directory, 'manifest.json');
    writeFileSync(manifestPath, f.json);
    const command = (manifestInput = manifestPath, outputInput?: string) => spawnSync(process.execPath,
      ['--experimental-strip-types', 'scripts/perception-benchmark-cli.ts', manifestInput, directory, sha256(f.json), ...(outputInput ? [outputInput] : [])], { encoding: 'utf8' });
    const valid = command();
    assert.equal(valid.status, 0);
    assert.equal(JSON.parse(valid.stdout).providers[0].status, 'NOT_RUN');
    const manifestLink = join(directory, 'manifest-link.json');
    symlinkSync(manifestPath, manifestLink);
    const outputPath = join(directory, 'outputs.json');
    writeFileSync(outputPath, '[]');
    const outputLink = join(directory, 'output-link.json');
    symlinkSync(outputPath, outputLink);
    for (const rejected of [command(manifestLink), command(manifestPath, outputLink), command(directory), command(manifestPath, directory)]) {
      assert.equal(rejected.status, 1);
      assert.equal(rejected.stdout, '');
      assert.equal(rejected.stderr.includes(directory), false);
      assert.ok(rejected.stderr.includes('INVALID_PERCEPTION_BENCHMARK_INPUT'));
    }
    writeFileSync(join(directory, 'front.jpg'), Buffer.from('wrong bytes'));
    assert.equal(command().status, 1);
    rmSync(join(directory, 'front.jpg'));
    symlinkSync(join(directory, 'unknown.jpg'), join(directory, 'front.jpg'));
    const rejected = command();
    assert.equal(rejected.status, 1);
    assert.equal(rejected.stdout, '');
    assert.equal(rejected.stderr.includes(directory), false);
    assert.ok(rejected.stderr.includes('INVALID_PERCEPTION_BENCHMARK_INPUT'));
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
