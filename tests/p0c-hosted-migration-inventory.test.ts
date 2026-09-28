import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { compareMigrationInventory, PROJECT_REF } from '../scripts/readback-hosted-migration-inventory.mjs';

const REVISION = 'a'.repeat(40);
const sourcePaths = [
  'supabase/migrations/20260915_init.sql',
  'supabase/migrations/20260923180000_s_free_1_identity_boundary.sql',
  'supabase/migrations/20260924010000_s_free_3_context_history.sql',
];

test('reports unapplied migrations without claiming activation readiness', () => {
  const result = compareMigrationInventory({
    sourcePaths,
    hostedRows: [
      { local: '20260915', remote: '20260915' },
      { local: '20260923180000', remote: '20260923180000' },
      { local: '20260924010000', remote: '' },
    ],
    sourceRevision: REVISION,
  });
  assert.equal(result.hostedProjectRef, PROJECT_REF);
  assert.deepEqual(result.missingHosted, ['20260924010000']);
  assert.deepEqual(result.unexpectedHosted, []);
  assert.equal(result.localSourceMatchesCli, true);
  assert.equal(result.hostedVersionsMatchSource, false);
  assert.equal(result.activation.ready, false);
  assert.equal(result.activation.reason, 'MIGRATION_VERSION_DRIFT');
});

test('detects hosted-only and CLI-local drift independently', () => {
  const result = compareMigrationInventory({
    sourcePaths,
    hostedRows: [
      { local: '20260915', remote: '20260915' },
      { local: '20260923180000', remote: '20260923180000' },
      { local: '20260924010000', remote: '' },
      { local: '', remote: '20260925000000' },
    ],
    sourceRevision: REVISION,
  });
  assert.deepEqual(result.unexpectedHosted, ['20260925000000']);
  assert.deepEqual(result.missingCliLocal, []);
  assert.equal(result.hostedVersionsMatchSource, false);
});

test('source/CLI local mismatch blocks parity even if hosted versions appear equal', () => {
  const result = compareMigrationInventory({
    sourcePaths,
    hostedRows: [
      { local: '20260915', remote: '20260915' },
      { local: '', remote: '20260923180000' },
      { local: '20260924010000', remote: '20260924010000' },
    ],
    sourceRevision: REVISION,
  });
  assert.deepEqual(result.missingCliLocal, ['20260923180000']);
  assert.equal(result.localSourceMatchesCli, false);
  assert.equal(result.hostedVersionsMatchSource, false);
});

test('matching names are still version-only evidence', () => {
  const result = compareMigrationInventory({
    sourcePaths,
    hostedRows: sourcePaths.map((path) => {
      const version = path.split('/').at(-1)!.split('_')[0];
      return { local: version, remote: version };
    }),
    sourceRevision: REVISION,
  });
  assert.equal(result.hostedVersionsMatchSource, true);
  assert.equal(result.hostedSchemaVerified, false);
  assert.equal(result.activation.ready, false);
});

test('rejects empty, malformed and duplicate inventories', () => {
  const validRows = [{ local: '20260915', remote: '20260915' }];
  for (const input of [
    { sourcePaths: [], hostedRows: validRows, sourceRevision: REVISION },
    { sourcePaths: ['supabase/migrations/bad.sql'], hostedRows: validRows, sourceRevision: REVISION },
    { sourcePaths: [sourcePaths[0], sourcePaths[0]], hostedRows: validRows, sourceRevision: REVISION },
    { sourcePaths, hostedRows: [], sourceRevision: REVISION },
    { sourcePaths, hostedRows: [{ local: '', remote: '' }], sourceRevision: REVISION },
    { sourcePaths, hostedRows: [{ local: 'bad', remote: '' }], sourceRevision: REVISION },
    { sourcePaths, hostedRows: [validRows[0], validRows[0]], sourceRevision: REVISION },
    { sourcePaths, hostedRows: validRows, sourceRevision: 'not-a-revision' },
  ]) {
    assert.throws(() => compareMigrationInventory(input));
  }
});

test('readback is exact-project and cannot log raw CLI errors or source contents', () => {
  const script = readFileSync(new URL('../scripts/readback-hosted-migration-inventory.mjs', import.meta.url), 'utf8');
  assert.match(script, /'--project-ref', PROJECT_REF/);
  assert.doesNotMatch(script, /\bfetch\s*\(|\bwriteFile\b|\bprocess\.env\b|\bshell\s*:\s*(?:true|false)/);
  assert.doesNotMatch(script, /process\.stderr\.write\(.*(?:error|stderr)/);
});
