import { execFileSync, spawn } from 'node:child_process';
import { readFileSync, mkdtempSync, writeFileSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Generate a private runtime artifact. Never copy provider keys into the mobile project.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
if (args.length !== 4 || args[0] !== '--provider-env' || args[2] !== '--private-env') {
  throw Error('Provide the provider environment file and the existing private server environment file.');
}
const status = JSON.parse(execFileSync('supabase', ['status', '--output', 'json'], {
  cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 15000,
}));
if (status.API_URL !== 'http://127.0.0.1:54321' || new URL(status.DB_URL).port !== '54322') {
  throw Error('Only the existing local Derive stack is supported.');
}
const providers = readFileSync(resolve(args[1]), 'utf8');
const base = readFileSync(resolve(args[3]), 'utf8');
const value = name => {
  const matches = [...providers.matchAll(new RegExp('^' + name + '=(.*)$', 'gm'))];
  if (matches.length !== 1) throw Error('A required provider setting is missing or duplicated.');
  const raw = matches[0][1].trim();
  const result = /^(["']).*\1$/.test(raw) ? raw.slice(1, -1) : raw;
  if (!result || /[\x00-\x20\x7f]/.test(result) || result.length > 512) throw Error('A provider setting is invalid.');
  return result;
};
if (!/^DERIVE_UPC_PRIVATE_TEST_ENABLED=true$/m.test(base)
  || !/^DERIVE_UPC_PRIVATE_TESTER_IDS=[a-f\d,-]+$/im.test(base)) {
  throw Error('The existing private tester fence must be configured first.');
}
const updates = {
  GEMINI_API_KEY: value('GEMINI_API_KEY'), GEMINI_MODEL: value('GEMINI_MODEL'),
  SERPAPI_API_KEY: value('SERPAPI_API_KEY'), DERIVE_WEB_INGREDIENT_TEST_ENABLED: 'true',
  JEV_API_KEY: value('JEV_API_KEY'), JEV_MODEL: 'jev-latest',
  DERIVE_INGREDIENT_MODEL_PROVIDER: 'jev', DERIVE_JEV_INGREDIENT_TEST_ENABLED: 'true',
  // Founder approved minimal goals/type/reactivity on the existing explicit tap.
  // This does not enable automatic cloud analysis or sharing reaction history.
  DERIVE_JEV_PERSONAL_CONTEXT_APPROVED: 'true',
};
const retained = base.split(/\r?\n/).filter(line => !Object.keys(updates).some(name => line.startsWith(name + '=')));
const folder = mkdtempSync(join(tmpdir(), 'derive-private-ingredient-runtime-'));
const file = join(folder, 'server.env');
writeFileSync(file, retained.concat(Object.entries(updates).map(([key, setting]) => key + '=' + setting)).join('\n') + '\n', { mode: 0o600 });
const child = spawn('supabase', ['functions', 'serve', '--env-file', file], {
  cwd: root, stdio: 'inherit', env: { ...process.env, DO_NOT_TRACK: '1' },
});
console.log('Starting the local private ingredient server. Provider values are not displayed. Jev receives minimal skin context only on the approved explicit action. Photos and reaction history are not enabled for cloud processing.');
const cleanup = () => { rmSync(file, { force: true }); rmdirSync(folder); };
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => child.kill(signal));
child.once('error', () => { cleanup(); console.error('The local server could not start.'); process.exitCode = 1; });
child.once('exit', code => { cleanup(); process.exitCode = code ?? 1; });
