import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const run = (script: string, args: string[]) => execFileSync(process.execPath, ['--experimental-strip-types', script, ...args], { cwd: root, encoding: 'utf8', env: { ...process.env, SUPABASE_CLI: '/does-not-exist/p0d-no-service' } });
test('local help and dry-run do not invoke Supabase or invent live/binary proof', () => {
 assert.match(run('scripts/test-p0d-customer-flow-local.mjs', ['--help']), /lease/);
 const result = JSON.parse(run('scripts/test-p0d-customer-flow-local.mjs', ['--dry-run']));
 assert.equal(result.status, 'NOT_RUN'); assert.equal(result.binary, null); assert.equal(result.fixtureMode, 'synthetic_catalog'); assert(result.intendedChecks.includes('repeat_check'));
});
test('release metadata reports configured app version without fabricating installed build identity', () => {
 const result = JSON.parse(run('scripts/preflight-customer-release.mjs', []));
 assert.equal(result.status, 'METADATA_ONLY'); assert.equal(result.configuration.configuredVersion, '1.0.0');
 assert.equal(result.configuration.buildNumberSource, 'remote'); assert.equal(result.binary, undefined); assert(result.gates.every((gate: { status: string }) => gate.status === 'missing'));
});
test('unrecognized local arguments stop before acquiring keys or touching services', () => {
 const result = spawnSync(process.execPath, ['--experimental-strip-types', 'scripts/test-p0d-customer-flow-local.mjs', '--run', '--hosted'], { cwd: root, encoding: 'utf8', env: { ...process.env, SUPABASE_CLI: '/does-not-exist/p0d-no-service' } });
 assert.equal(result.status, 1); assert.match(result.stderr, /Expected --dry-run/); assert.doesNotMatch(result.stderr, /spawnSync.*ENOENT/);
});
