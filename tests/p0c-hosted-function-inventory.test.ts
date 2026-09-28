import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { compareFunctionInventory, PROJECT_REF } from '../scripts/readback-hosted-function-inventory.mjs';

const REVISION = 'a'.repeat(40);
const sourcePaths = [
  'supabase/functions/access-state/index.ts',
  'supabase/functions/scan-product/index.ts',
];

test('exact name parity remains inventory only, never release approval', () => {
  const result = compareFunctionInventory({ sourcePaths, hostedRows: [{ slug: 'scan-product' }, { slug: 'access-state' }], sourceRevision: REVISION });
  assert.equal(result.hostedProjectRef, PROJECT_REF);
  assert.equal(result.functionNamesMatch, true);
  assert.equal(result.hostedFunctionRevisionsVerified, false);
  assert.deepEqual(result.missingHosted, []);
  assert.equal(result.activation.ready, false);
  assert.equal(result.activation.status, 'BLOCKED');
});

test('missing and unexpected hosted functions are both exposed by name', () => {
  const result = compareFunctionInventory({ sourcePaths, hostedRows: [{ slug: 'scan-product' }, { slug: 'old-function' }], sourceRevision: REVISION });
  assert.equal(result.functionNamesMatch, false);
  assert.deepEqual(result.missingHosted, ['access-state']);
  assert.deepEqual(result.unexpectedHosted, ['old-function']);
});

test('malformed, duplicate and empty inventories fail closed', () => {
  for (const input of [
    { sourcePaths: [], hostedRows: [], sourceRevision: REVISION },
    { sourcePaths, hostedRows: [{ slug: 'scan-product' }, { slug: 'scan-product' }], sourceRevision: REVISION },
    { sourcePaths, hostedRows: [{ slug: 'scan-product' }, { slug: 'SECRET=abc' }], sourceRevision: REVISION },
    { sourcePaths, hostedRows: [{ slug: 'scan-product' }], sourceRevision: 'not-a-revision' },
    { sourcePaths: [...sourcePaths, sourcePaths[0]], hostedRows: [{ slug: 'scan-product' }], sourceRevision: REVISION },
  ]) {
    assert.throws(() => compareFunctionInventory(input));
  }
});

test('readback code uses only the exact project and never prints raw command errors', () => {
  const script = readFileSync(new URL('../scripts/readback-hosted-function-inventory.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(script, /\bfetch\s*\(|\bwriteFile\b|\bprocess\.env\b|\bshell\s*:\s*(?:true|false)/);
  assert.match(script, /'--project-ref', PROJECT_REF/);
  assert.doesNotMatch(script, /process\.stderr\.write\(.*(?:error|stderr)/);
});
