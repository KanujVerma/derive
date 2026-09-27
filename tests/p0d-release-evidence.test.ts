import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { inspectCustomerRelease, REQUIRED_CHECKS, assertLocalRun } from '../scripts/acceptance/p0d/releaseEvidence.ts';
const sha = 'a'.repeat(40);
const binary = { buildId: 'candidate-id', version: '1.0.0', buildNumber: '11', bundleIdentifier: 'com.derive.skincare' };
const target = { sourceSha: sha, environment: { kind: 'hosted', apiUrl: 'https://example.supabase.co' }, binary };
const dir = mkdtempSync(join(tmpdir(), 'p0d-evidence-'));
const artifact = (kind: string, edits: object = {}) => {
 const report = { version: 1, kind, source: { sha, dirty: false }, environment: target.environment, binary, observedAt: '2026-09-27T12:00:00Z', fixtureMode: 'none', checks: (REQUIRED_CHECKS[kind] ?? []).map(id => ({ id, outcome: 'passed', observation: `Observed ${id} through actual target.` })), ...edits };
 const bytes = JSON.stringify(report); const path = join(dir, `${kind}.json`); writeFileSync(path, bytes);
 return { kind, path, sha256: createHash('sha256').update(bytes).digest('hex') };
};
after(() => rmSync(dir, { recursive: true, force: true }));
 test('absent evidence leaves every release gate pending; a clean SHA alone is source metadata', () => {
  const result = inspectCustomerRelease({ version: 1, target, evidence: [] }, { sha, dirty: false });
  assert.equal(result.status, 'INCOMPLETE'); assert(result.gates.every(g => g.status === 'missing'));
 });
 test('self declared passed flags do not replace pinned artifacts', () => {
  assert.throws(() => inspectCustomerRelease({ version: 1, target, evidence: [{ kind: 'physical', passed: true }] }, { sha, dirty: false }), /artifact/i);
 });
 test('a simulator or fixture receipt cannot clear physical or hosted acceptance', () => {
  const sim = artifact('simulator');
  const result = inspectCustomerRelease({ version: 1, target, evidence: [sim] }, { sha, dirty: false });
  assert.equal(result.gates.find(g => g.kind === 'physical')?.status, 'missing');
  const fixture = artifact('hosted', { fixtureMode: 'development_ui' });
  assert.throws(() => inspectCustomerRelease({ version: 1, target, evidence: [fixture] }, { sha, dirty: false }), /fixture/i);
 });
 test('modified artifacts, stale source, mismatched binary and incomplete observations fail closed', () => {
  const stale = artifact('physical', { source: { sha: 'b'.repeat(40), dirty: false } });
  assert.throws(() => inspectCustomerRelease({ version: 1, target, evidence: [stale] }, { sha, dirty: false }), /source/i);
  const wrong = artifact('testflight', { binary: { ...binary, buildNumber: '10' } });
  assert.throws(() => inspectCustomerRelease({ version: 1, target, evidence: [wrong] }, { sha, dirty: false }), /binary/i);
  const incomplete = artifact('hosted', { checks: [] });
  assert.throws(() => inspectCustomerRelease({ version: 1, target, evidence: [incomplete] }, { sha, dirty: false }), /checks/i);
  const changed = artifact('source'); writeFileSync(changed.path, '{}');
  assert.throws(() => inspectCustomerRelease({ version: 1, target, evidence: [changed] }, { sha, dirty: false }), /hash/i);
 });
 test('all pinned gates produce review required, never automatic release authorization', () => {
  const evidence = Object.keys(REQUIRED_CHECKS).map(kind => artifact(kind, kind === 'local_api' ? { environment: { kind: 'local', apiUrl: 'http://127.0.0.1:54321' }, binary: null, fixtureMode: 'synthetic_catalog' } : {}));
  const result = inspectCustomerRelease({ version: 1, target, evidence }, { sha, dirty: false });
  assert.equal(result.status, 'REVIEW_REQUIRED');
  assert.equal(result.gates.find(g => g.kind === 'local_api')?.fixtureMode, 'synthetic_catalog');
 });
 test('dirty checkout and other target source cannot validate a candidate', () => {
  assert.throws(() => inspectCustomerRelease({ version: 1, target, evidence: [] }, { sha, dirty: true }), /clean/i);
  assert.throws(() => inspectCustomerRelease({ version: 1, target, evidence: [] }, { sha: 'b'.repeat(40), dirty: false }), /source/i);
 });
 test('local runner requires exact loopback base URL and an explicit execution choice', () => {
  assert.doesNotThrow(() => assertLocalRun('http://127.0.0.1:54321', true));
  for (const url of ['https://example.supabase.co', 'http://127.0.0.1:54321/path', 'http://user@127.0.0.1:54321', 'http://127.0.0.1:54321?x=1']) assert.throws(() => assertLocalRun(url, true), /local/i);
  assert.throws(() => assertLocalRun('http://127.0.0.1:54321', false), /--run/i);
 });

 test('hosted proof cannot name a local backend even when the candidate target is local', () => {
  const local = { kind: 'local', apiUrl: 'http://127.0.0.1:54321' };
  const receipt = artifact('hosted', { environment: local });
  assert.throws(() => inspectCustomerRelease({ version: 1, target: { ...target, environment: local }, evidence: [receipt] }, { sha, dirty: false }), /hosted/i);
 });
