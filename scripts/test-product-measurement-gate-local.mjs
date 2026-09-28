/** Exercises default-off and explicitly enabled local Edge behavior in order. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const run = (mode) => new Promise((resolveRun, rejectRun) => {
  const child = spawn('node', ['scripts/test-product-measurement-local.mjs', mode], {
    cwd: root, stdio: 'inherit', env: { ...process.env, DO_NOT_TRACK: '1' },
  });
  child.once('error', rejectRun);
  child.once('exit', (code) => code === 0 ? resolveRun() : rejectRun(new Error(`${mode} harness failed: ${code}`)));
});

await run('disabled');
const server = spawn('supabase', [
  'functions', 'serve', 'product-measurement',
  '--env-file', resolve(root, 'scripts/fixtures/product-measurement-enabled.env'),
  ...(process.env.DERIVE_LOCAL_SUPABASE_WORKDIR
    ? ['--workdir', process.env.DERIVE_LOCAL_SUPABASE_WORKDIR] : []),
], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, DO_NOT_TRACK: '1' } });
let output = '';
let markReady;
let rejectReady;
const ready = new Promise((resolveReady, rejectEarly) => {
  markReady = resolveReady;
  rejectReady = rejectEarly;
});
for (const stream of [server.stdout, server.stderr]) {
  stream.on('data', (chunk) => {
    output = (output + String(chunk)).slice(-2000);
    if (output.includes('Serving functions on')) markReady();
  });
}
server.once('error', rejectReady);
server.once('exit', (code) => rejectReady(new Error(`function server exited ${code}: ${output}`)));
try {
  let timer;
  try {
    await Promise.race([
      ready,
      new Promise((_, rejectTimeout) => { timer = setTimeout(() => rejectTimeout(
        new Error(`function server did not become ready: ${output}`)), 20_000); }),
    ]);
  } finally { clearTimeout(timer); }
  await run('enabled');
  assert.equal(server.exitCode, null, `Supabase function server exited early: ${output}`);
} finally {
  server.kill('SIGTERM');
  await new Promise((resolveExit) => {
    if (server.exitCode !== null) return resolveExit();
    server.once('exit', resolveExit);
    setTimeout(resolveExit, 5000);
  });
}
