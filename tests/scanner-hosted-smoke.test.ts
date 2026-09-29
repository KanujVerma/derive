import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

test('hosted-drill safety regressions run offline in the full application suite', () => {
  const result = spawnSync(process.execPath, ['--test', 'scripts/test-scanner-hosted.test.mjs'], {
    cwd: new URL('..', import.meta.url), encoding: 'utf8', timeout: 30_000,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /# fail 0/);
});
