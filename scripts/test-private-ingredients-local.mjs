/** Real isolated Auth -> Edge -> client configuration smoke; never calls Google. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { ingredientQueryKey, requestPrivateIngredientSearch } from '../src/presentation/external-products/ingredientSearch.ts';

const workdir = process.argv[2];
assert.equal(process.argv[3], '--no-provider-request');
assert.ok(workdir?.startsWith('/Users/samibeg/Documents/Codex/derive-upc-proof.'));
assert.match(readFileSync(workdir + '/supabase/config.toml', 'utf8'), /project_id = "derive-upc-private-proof"/);
// This is the env file supplied to the isolated functions server, not a client secret file.
const env = readFileSync(workdir + '/ingredient-empty-key.env', 'utf8');
assert.match(env, /^GEMINI_API_KEY=\s*$/m, 'Smoke requires an explicitly empty provider key');
assert.match(env, /^DERIVE_GEMINI_INGREDIENT_TEST_ENABLED=true$/m);
assert.match(env, /^DERIVE_UPC_PRIVATE_TESTER_IDS=e7000000-0000-4000-8000-000000000003$/m);
const status = JSON.parse(execFileSync('supabase', ['status', '--workdir', workdir, '--output', 'json'], {
  encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
}));
assert.equal(status.API_URL, 'http://127.0.0.1:55431');
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const clients = [], owners = [], run = randomUUID();
const allowed = 'e7000000-0000-4000-8000-000000000003';
const denied = 'e7000000-0000-4000-8000-000000000004';
const query = { barcode: '0037000734130', name: 'Old Spice Captain Deodorant', brand: 'Old Spice', size: null };
const make = async id => {
  const email = `derive-ingredient-${id.slice(-4)}-${run}@example.invalid`, password = randomUUID() + '!Aa9';
  const created = await admin.auth.admin.createUser({ id, email, password, email_confirm: true,
    user_metadata: { derive_private_ingredient_run: run } });
  assert.equal(created.error, null);
  if (created.data.user?.id) owners.push(created.data.user.id);
  assert.equal(created.data.user?.id, id);
  const client = createClient(status.API_URL, status.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  clients.push(client);
  const signed = await client.auth.signInWithPassword({ email, password });
  assert.equal(signed.error, null); return client;
};
try {
  const noSession = await fetch(status.API_URL + '/functions/v1/private-ingredient-search', {
    method: 'POST', headers: { apikey: status.ANON_KEY, 'content-type': 'application/json' }, body: JSON.stringify(query),
  });
  assert.equal(noSession.status, 401);
  const client = await make(allowed), other = await make(denied);
  const forbidden = await other.functions.invoke('private-ingredient-search', { body: query });
  assert.equal(forbidden.error?.context?.status, 403);
  const invalid = await client.functions.invoke('private-ingredient-search', { body: { ...query, barcode: '12345678' } });
  assert.equal(invalid.error?.context?.status, 400);
  const missingKey = await client.functions.invoke('private-ingredient-search', { body: query });
  assert.equal(missingKey.error?.context?.status, 503);
  assert.deepEqual(await missingKey.error.context.clone().json(), { status: 'configuration_required' });
  const response = await requestPrivateIngredientSearch(query, allowed, () => allowed, () => ingredientQueryKey(query), client);
  assert.deepEqual(response, { status: 'configuration_required' });
  console.log(JSON.stringify({ scope: 'isolated_local_auth_edge_client_no_google', providerRequests: 0,
    checks: ['unauthenticated_401', 'non_tester_403', 'invalid_query_400', 'missing_key_503', 'typed_configuration_required'] }));
} finally {
  let failed = false;
  for (const id of owners) {
    const check = await admin.auth.admin.getUserById(id);
    if (check.data.user?.user_metadata?.derive_private_ingredient_run !== run) { failed = true; continue; }
    const deleted = await admin.auth.admin.deleteUser(id);
    const absent = await admin.auth.admin.getUserById(id);
    if (deleted.error || absent.error?.status !== 404) failed = true;
  }
  clients.forEach(client => client.auth.stopAutoRefresh());
  assert.equal(failed, false, 'Exact synthetic fixture cleanup must be independently confirmed');
  console.log('PASS: both exact tagged local ingredient test accounts removed and absence read back.');
}
