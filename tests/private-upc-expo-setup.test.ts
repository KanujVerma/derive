import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { buildExpoEnvironment, parseArgs, privateIpv4, probePrivateEndpoint, selectLanIp } from '../scripts/start-private-upc-expo.mjs';

const jwt = (role: string) => `local.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.signature`;
const status = { API_URL: 'http://127.0.0.1:54321', DB_URL: 'postgresql://postgres:local@127.0.0.1:54322/postgres', ANON_KEY: jwt('anon'), SERVICE_ROLE_KEY: 'never-client' };

test('Private Expo: canonical private address and owned port arguments only', () => {
  for (const ip of ['10.0.0.2', '172.20.10.2', '192.168.1.68']) assert.equal(privateIpv4(ip), true);
  for (const ip of ['127.0.0.1', '8.8.8.8', '192.168.001.2', '192.168.1.256', '172.32.1.1', 'name.local', 'http://192.168.1.2']) assert.equal(privateIpv4(ip), false);
  assert.deepEqual(parseArgs(['--lan-ip', '192.168.1.68', '--port', '8090', '--check-only']), { ip: '192.168.1.68', port: 8090, checkOnly: true, help: false });
  for (const args of [['--lan-ip'], ['--port', '54321evil'], ['--port', '99999'], ['--hosted'], ['--port', '80']]) assert.throws(() => parseArgs(args));
});

test('Private Expo: selects active Wi-Fi only; refuses invented addresses and ambiguous adapters', () => {
  const interfaces = { en0: [{ family: 'IPv4', internal: false, address: '192.168.1.68' }], utun0: [{ family: 'IPv4', internal: false, address: '10.0.0.3' }] };
  assert.equal(selectLanIp(interfaces), '192.168.1.68');
  assert.equal(selectLanIp(interfaces, '10.0.0.3'), '10.0.0.3');
  assert.throws(() => selectLanIp(interfaces, '192.168.1.99'));
  assert.throws(() => selectLanIp({ en1: interfaces.en0, en2: interfaces.utun0 }));
});

test('Private Expo: does not inherit secrets, hosted URLs, unrelated public flags or dotenv', () => {
  const env = buildExpoEnvironment(status, '192.168.1.68', { PATH: '/bin', HOME: '/Users/test', GEMINI_API_KEY: 'secret', JEV_API_KEY: 'secret', SUPABASE_SERVICE_ROLE_KEY: 'secret', EXPO_PUBLIC_SUPABASE_URL: 'https://hosted.supabase.co', EXPO_PUBLIC_GEMINI_API_KEY: 'secret', EXPO_PUBLIC_PRODUCT_MEASUREMENT_ENABLED: 'true' });
  assert.equal(env.EXPO_NO_DOTENV, '1');
  assert.equal(env.EXPO_PUBLIC_SUPABASE_URL, 'http://192.168.1.68:54321');
  assert.equal(env.EXPO_PUBLIC_DEV_SUPABASE_LAN_URL, env.EXPO_PUBLIC_SUPABASE_URL);
  assert.equal(env.EXPO_PUBLIC_SUPABASE_ANON_KEY, status.ANON_KEY);
  assert.equal(env.EXPO_PUBLIC_BUILD_FLAVOR, 'development');
  assert.equal(env.EXPO_PUBLIC_PRIVATE_UPC_TEST_ENABLED, 'true');
  assert.equal(env.EXPO_PUBLIC_SCANNER_RELEASE_ENABLED, 'false');
  assert.equal(env.PATH, '/bin');
  assert.ok(!JSON.stringify(env).includes('secret'));
  assert.equal(env.EXPO_PUBLIC_PRODUCT_MEASUREMENT_ENABLED, undefined);
});

test('Private Expo: service-role keys, hosted or isolated databases cannot become app configuration', () => {
  assert.throws(() => buildExpoEnvironment({ ...status, ANON_KEY: jwt('service_role') }, '192.168.1.68'));
  assert.throws(() => buildExpoEnvironment({ ...status, API_URL: 'https://snojlbqovlawewwqbviz.supabase.co' }, '192.168.1.68'));
  assert.throws(() => buildExpoEnvironment({ ...status, API_URL: 'http://127.0.0.1:55431' }, '192.168.1.68'));
  assert.throws(() => buildExpoEnvironment({ ...status, DB_URL: 'postgresql://postgres:local@8.8.8.8:54322/postgres' }, '192.168.1.68'));
});

test('Private Expo: readiness probe uses invalid input, rejects disabled/gateway-only responses, spends no provider request', async () => {
  let requests = 0;
  await probePrivateEndpoint(status.API_URL, status.ANON_KEY, async (url, options) => {
    requests++;
    assert.equal(String(url), `${status.API_URL}/functions/v1/private-upc-lookup`);
    assert.equal(JSON.parse(String(options?.body)).barcode, 'not-a-barcode');
    return new Response(JSON.stringify({ code: 'UNAUTHORIZED' }), { status: 401 });
  });
  assert.equal(requests, 1);
  await assert.rejects(probePrivateEndpoint(status.API_URL, status.ANON_KEY, async () => new Response(JSON.stringify({ code: 'FEATURE_DISABLED' }), { status: 503 })), /disabled/);
  await assert.rejects(probePrivateEndpoint(status.API_URL, status.ANON_KEY, async () => new Response(JSON.stringify({ message: 'Invalid JWT' }), { status: 401 })), /authentication probe/);
  await assert.rejects(probePrivateEndpoint(status.API_URL, status.ANON_KEY, async () => new Response(JSON.stringify({ message: 'name resolution failed' }), { status: 503 })), /Start local functions/);
  await assert.rejects(probePrivateEndpoint(status.API_URL, status.ANON_KEY, async () => { throw new Error('network secret'); }), /not reachable/);
});

test('Private Expo: launcher does not reset, mutate auth, write files or enable hosted access', () => {
  const source = readFileSync(new URL('../scripts/start-private-upc-expo.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /writeFile|createUser|signInAnonymously|db reset|--linked|functions deploy|secrets set/);
  assert.match(source, /'start', '--go', '--lan'/);
  assert.match(source, /probePrivateEndpoint\(env.EXPO_PUBLIC_SUPABASE_URL/);
});
