/** One real provider request through isolated Auth -> Edge -> quota -> phone parser. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { requestPrivateUpcLookup } from '../src/presentation/external-products/privateLookup.ts';

const workdir = process.argv[2];
assert.equal(process.argv[3], '--allow-one-provider-request');
assert.ok(workdir?.startsWith('/Users/samibeg/Documents/Codex/derive-upc-proof.') || workdir?.startsWith('/private/tmp/derive-upc-proof.'));
assert.match(readFileSync(workdir + '/supabase/config.toml', 'utf8'), /project_id = "derive-upc-private-proof"/);
const status = JSON.parse(execFileSync('supabase', ['status', '--workdir', workdir, '--output', 'json'], {
  encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
}));
assert.equal(status.API_URL, 'http://127.0.0.1:55431');
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const clients = [], owners = [], run = randomUUID();
const allowed = 'e6000000-0000-4000-8000-000000000003';
const denied = 'e6000000-0000-4000-8000-000000000004';
const make = async id => {
  const email = `derive-upc-${id.slice(-4)}-${run}@example.invalid`, password = randomUUID() + '!Aa9';
  const created = await admin.auth.admin.createUser({ id, email, password, email_confirm: true,
    user_metadata: { derive_private_upc_run: run } });
  assert.equal(created.error, null);
  if (created.data.user?.id) owners.push(created.data.user.id);
  assert.equal(created.data.user?.id, id);
  const client = createClient(status.API_URL, status.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  clients.push(client);
  const signed = await client.auth.signInWithPassword({ email, password });
  assert.equal(signed.error, null); return client;
};
try {
  const client = await make(allowed), other = await make(denied);
  const forbidden = await other.functions.invoke('private-upc-lookup', { body: { barcode: '0037000734130' } });
  assert.equal(forbidden.error?.context?.status, 403);
  const invalid = await client.functions.invoke('private-upc-lookup', { body: { barcode: '12345678' } });
  assert.equal(invalid.error?.context?.status, 400);
  const response = await requestPrivateUpcLookup('0037000734130', allowed, () => allowed, client);
  assert.equal(response.status, 'found');
  assert.match(response.candidates[0].name, /Old Spice.*Captain/i);
  assert.equal(response.candidates[0].formulaVerified, false);
  assert.equal(response.candidates[0].canonicalProductId, null);
  const limited = await client.functions.invoke('private-upc-lookup', { body: { barcode: '0037000734130' } });
  assert.equal(limited.error?.context?.status, 429);
  console.log(JSON.stringify({ scope: 'isolated_local_auth_edge_real_provider_client_parser',
    realProviderRequests: 1, barcode: response.candidates[0].observedBarcode,
    product: response.candidates[0].name, formulaVerified: false,
    checks: ['non_tester_403', 'invalid_barcode_400', 'real_identity_returned', 'immediate_repeat_429'] }));
} finally {
  let failed = false;
  for (const id of owners) {
    const check = await admin.auth.admin.getUserById(id);
    if (check.data.user?.user_metadata?.derive_private_upc_run !== run) { failed = true; continue; }
    const deleted = await admin.auth.admin.deleteUser(id);
    const absent = await admin.auth.admin.getUserById(id);
    if (deleted.error || absent.error?.status !== 404) failed = true;
  }
  clients.forEach(client => client.auth.stopAutoRefresh());
  assert.equal(failed, false, 'Exact synthetic fixture cleanup must be independently confirmed');
  console.log('PASS: both exact tagged local test accounts removed and absence read back.');
}
