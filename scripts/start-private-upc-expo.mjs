import { execFileSync, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { networkInterfaces } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function privateIpv4(value) {
  if (typeof value !== 'string' || !/^\d{1,3}(?:\.\d{1,3}){3}$/.test(value)) return false;
  const parts = value.split('.');
  const n = parts.map(Number);
  if (n.some((part, i) => part > 255 || String(part) !== parts[i])) return false;
  return n[0] === 10 || (n[0] === 172 && n[1] >= 16 && n[1] <= 31) || (n[0] === 192 && n[1] === 168);
}

export function parseArgs(args) {
  const result = { ip: undefined, port: 8083, checkOnly: false, help: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--lan-ip') {
      result.ip = args[++i];
      if (!privateIpv4(result.ip)) throw new Error('--lan-ip must be a canonical private IPv4 address.');
    } else if (args[i] === '--port') {
      const value = args[++i];
      if (!value || !/^\d{4,5}$/.test(value) || Number(value) < 1024 || Number(value) > 65535) throw new Error('Choose a port from 1024 to 65535.');
      result.port = Number(value);
    } else if (args[i] === '--check-only') result.checkOnly = true;
    else if (args[i] === '--help') result.help = true;
    else throw new Error('Unknown option. Use --help.');
  }
  return result;
}

export function selectLanIp(interfaces, requested) {
  const addresses = Object.entries(interfaces).flatMap(([name, entries]) => (entries ?? [])
    .filter(entry => entry.family === 'IPv4' && !entry.internal && privateIpv4(entry.address))
    .map(entry => ({ name, address: entry.address })));
  if (requested) {
    if (!privateIpv4(requested) || !addresses.some(entry => entry.address === requested)) throw new Error('Requested LAN address is not active on this Mac.');
    return requested;
  }
  const wifi = addresses.filter(entry => entry.name === 'en0');
  if (wifi.length === 1) return wifi[0].address;
  const unique = [...new Set(addresses.map(entry => entry.address))];
  if (unique.length === 1) return unique[0];
  throw new Error('Connect the Mac to Wi-Fi, or choose its active private address with --lan-ip.');
}

/** @returns {Record<string, string>} */
export function buildExpoEnvironment(status, ip, incoming = {}) {
  if (!privateIpv4(ip)) throw new Error('Private LAN address required.');
  if (status.API_URL !== 'http://127.0.0.1:54321') throw new Error('Only the local derive API on port 54321 is supported.');
  let db;
  try { db = new URL(status.DB_URL); } catch { throw new Error('Local derive database status is unavailable.'); }
  if (db.protocol !== 'postgresql:' || db.hostname !== '127.0.0.1' || db.port !== '54322') throw new Error('Only the local derive database on port 54322 is supported.');
  const key = status.ANON_KEY;
  try {
    if (typeof key !== 'string' || key.split('.').length !== 3 || JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role !== 'anon') throw new Error();
  } catch { throw new Error('The local public anonymous key is missing or invalid. Never use a service-role key.'); }
  // Explicit operational allowlist: no provider/server secrets or unrelated public
  // build flags are inherited, and Expo is forbidden from reading .env files.
  const operational = ['PATH', 'HOME', 'USER', 'LOGNAME', 'SHELL', 'TMPDIR', 'LANG', 'LC_ALL', 'TERM', 'COLORTERM', 'EXPO_TOKEN', 'HTTP_PROXY', 'HTTPS_PROXY', 'NO_PROXY', 'SSL_CERT_FILE', 'NODE_EXTRA_CA_CERTS'];
  const env = Object.fromEntries(operational.filter(name => typeof incoming[name] === 'string').map(name => [name, incoming[name]]));
  return {
    ...env, EXPO_NO_DOTENV: '1', EXPO_NO_TELEMETRY: '1',
    REACT_NATIVE_PACKAGER_HOSTNAME: ip,
    EXPO_PUBLIC_BUILD_FLAVOR: 'development', EXPO_PUBLIC_USE_REMOTE_SERVICE: 'true',
    EXPO_PUBLIC_SCANNER_RELEASE_ENABLED: 'false', EXPO_PUBLIC_PRIVATE_UPC_TEST_ENABLED: 'true',
    EXPO_PUBLIC_SUPABASE_URL: `http://${ip}:54321`, EXPO_PUBLIC_DEV_SUPABASE_LAN_URL: `http://${ip}:54321`,
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '', EXPO_PUBLIC_SUPABASE_ANON_KEY: key,
  };
}

export async function probePrivateEndpoint(apiUrl, anonKey, fetcher = fetch) {
  // Invalid input and an anonymous key deliberately cannot reserve a provider
  // request. The handler's UNAUTHORIZED response proves the private flag and
  // nonempty tester allowlist were checked; it does not authorize a phone owner.
  let response;
  try {
    response = await fetcher(`${apiUrl}/functions/v1/private-upc-lookup`, {
      method: 'POST', headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ barcode: 'not-a-barcode' }), signal: AbortSignal.timeout(5000),
    });
    const body = await response.json();
    if (response.status === 401 && body.code === 'UNAUTHORIZED') return;
    if (body.code === 'FEATURE_DISABLED') throw new Error('Private endpoint is disabled or has no approved tester IDs.');
    if ([404, 502, 503].includes(response.status)) throw new Error('Private endpoint is not reachable. Start local functions with the reviewed private-test configuration first.');
    throw new Error('Private endpoint did not pass its no-provider authentication probe.');
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Private endpoint')) throw error;
    throw new Error('Private endpoint is not reachable. Start local functions with the reviewed private-test configuration first.');
  }
}

async function assertPortFree(port) {
  await new Promise((complete, reject) => {
    const server = createServer();
    server.once('error', () => reject(new Error(`Port ${port} is busy. Choose --port without terminating another app's server.`)));
    server.listen(port, '0.0.0.0', () => server.close(complete));
  });
}

export async function main(args = process.argv.slice(2)) {
  const options = parseArgs(args);
  if (options.help) {
    console.log('Private local scanner: node scripts/start-private-upc-expo.mjs [--lan-ip 192.168.x.x] [--port 8083] [--check-only]\nUses the existing local derive project only. No reset, migrations, Auth changes, .env writes, hosted calls or provider requests.\nFirst serve private-upc-lookup locally with DERIVE_UPC_PRIVATE_TEST_ENABLED=true and DERIVE_UPC_PRIVATE_TESTER_IDS containing only approved phone-owner UUIDs.');
    return;
  }
  if (!/^project_id\s*=\s*"derive"\s*$/m.test(readFileSync(resolve(ROOT, 'supabase/config.toml'), 'utf8'))) throw new Error('This launcher requires the local derive project configuration.');
  let status;
  try { status = JSON.parse(execFileSync('supabase', ['status', '--output', 'json'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 15000 })); }
  catch { throw new Error('Cannot read local Supabase status. Start the existing derive stack; do not reset its data.'); }
  const ip = selectLanIp(networkInterfaces(), options.ip);
  const env = buildExpoEnvironment(status, ip, process.env);
  await probePrivateEndpoint(status.API_URL, status.ANON_KEY);
  await probePrivateEndpoint(env.EXPO_PUBLIC_SUPABASE_URL, status.ANON_KEY);
  await assertPortFree(options.port);
  console.log(`Local backend ready at http://${ip}:54321. Phone owner must be in the private tester allowlist.\nConnect iPhone and Mac to the same Wi-Fi. Open exp://${ip}:${options.port} in Expo Go.\nNo .env files were read or changed. Product coverage is provider-dependent; no match remains unknown.`);
  if (options.checkOnly) return;
  const child = spawn(process.execPath, [resolve(ROOT, 'node_modules/expo/bin/cli'), 'start', '--go', '--lan', '--port', String(options.port), '--clear'], { cwd: ROOT, env, stdio: 'inherit' });
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => child.kill(signal));
  child.once('error', () => { console.error('Expo could not start. Check dependencies and Expo login.'); process.exitCode = 1; });
  child.once('exit', code => { process.exitCode = code ?? 1; });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error instanceof Error ? error.message : 'Private scanner setup failed.'); process.exitCode = 1; });
}
