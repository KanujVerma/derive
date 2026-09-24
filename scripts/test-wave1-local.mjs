/** Mobile Wave-1 client orchestration against disposable local Supabase only. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { ensureLocalAnonymousSession, resetAuthAdapter, setAuthAdapter } from '../src/services/authClient.ts';
import { getFreeAccessState } from '../src/services/remote/freeAccess.ts';
import { searchCatalogProducts, getCatalogProductDetail, resolveCatalogIdentity } from '../src/services/productCatalog.ts';
import { resolveShellLanding, resolveShellPresentation } from '../src/utils/shellPresentation.ts';
import { resolveLocalAccessRoute } from '../src/utils/localAccessRouting.ts';
import { useFreeAccessStore } from '../src/stores/freeAccessStore.ts';
import { useAuthStore } from '../src/stores/authStore.ts';
import { deleteCurrentAccount } from '../src/services/accountDeletion.ts';
import { resetCustomerSessionData } from '../src/services/sessionReset.ts';

const cli = process.env.SUPABASE_CLI || 'supabase';
const status = JSON.parse(execFileSync(cli, ['status', '-o', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
assert.equal(status.API_URL, 'http://127.0.0.1:54321', 'Refuse non-local backend');
assert.equal(resolveShellPresentation({ buildFlavor: 'development', remoteEnabled: true, supabaseUrl: status.API_URL }), 'local_free_integration');
const options = { auth: { autoRefreshToken: false, persistSession: false } };
const guest = createClient(status.API_URL, status.ANON_KEY, options);
const permanent = createClient(status.API_URL, status.ANON_KEY, options);
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, options);
let firstId, secondId, permanentId, productId;
let firstDeleted = false;

setAuthAdapter({
  signInWithOtp: (email) => guest.auth.signInWithOtp({ email }),
  verifyOtp: (email, token) => guest.auth.verifyOtp({ email, token, type: 'email' }),
  signInAnonymously: () => guest.auth.signInAnonymously(),
  getSession: () => guest.auth.getSession(),
  signOut: (options) => guest.auth.signOut(options),
  onAuthStateChange: (callback) => guest.auth.onAuthStateChange(callback),
});

try {
  const ingested = execFileSync(process.execPath, [
    '--experimental-strip-types', 'scripts/catalog-ingest.mjs',
    '--file', 'docs/catalog-seeds/cerave-renewing-sa-cleanser.json', '--local', '--apply',
  ], { encoding: 'utf8', env: { ...process.env, SUPABASE_CLI: cli }, stdio: ['ignore', 'pipe', 'pipe'] });
  assert.ok(ingested.length > 0);
  const canonical = await admin.from('products').select('id').eq('brand', 'CeraVe').eq('name', 'Renewing SA Cleanser').single();
  assert.ifError(canonical.error);
  productId = canonical.data.id;

  assert.equal(useAuthStore.getState().sessionUserId, null);
  firstId = await ensureLocalAnonymousSession();
  assert.equal(useAuthStore.getState().sessionUserId, firstId);
  const access = await getFreeAccessState(guest);
  assert.equal(access.userId, firstId);
  assert.equal(access.identityKind, 'anonymous');
  assert.equal(access.managedAccess, false);
  const attempt = useFreeAccessStore.getState().start(firstId);
  assert.equal(useFreeAccessStore.getState().ready(access, attempt), true);
  assert.equal(resolveShellLanding('local_free_integration', 'free'), '/(tabs)/check');
  assert.equal(resolveLocalAccessRoute(['index'], access), '/(tabs)/check');
  assert.equal(resolveLocalAccessRoute(['check-in'], access), '/(tabs)/check');

  const found = await searchCatalogProducts('CeraVe SA Cleanser', guest);
  assert.equal(found[0]?.productId, productId);
  const detail = await getCatalogProductDetail(productId, guest);
  assert.equal(detail.sourceReference, 'https://www.cerave.com/skincare/cleansers/renewing-sa-cleanser');
  assert.equal(detail.formulaState, 'unverified');
  const typed = await resolveCatalogIdentity({ requestId: randomUUID(), consumer: 'scan', brand: 'CeraVe', productName: 'Renewing SA Cleanser' }, guest);
  assert.equal(typed.product?.productId, productId);
  assert.equal(typed.state, 'identified_formula_unverified');
  const barcode = await resolveCatalogIdentity({ requestId: randomUUID(), consumer: 'scan', barcode: '000000000000' }, guest);
  assert.equal(barcode.state, 'insufficient_evidence');
  const unknown = await resolveCatalogIdentity({ requestId: randomUUID(), consumer: 'scan', productName: `Unknown ${randomUUID()}` }, guest);
  assert.equal(unknown.state, 'insufficient_evidence');
  assert.deepEqual((await admin.from('memberships').select('id').eq('user_id', firstId)).data, []);

  const deletion = await deleteCurrentAccount(guest);
  assert.equal(deletion.success, true);
  firstDeleted = true;
  assert.equal(useFreeAccessStore.getState().access, null);
  assert.equal(useAuthStore.getState().sessionUserId, null);
  secondId = await ensureLocalAnonymousSession();
  assert.notEqual(secondId, firstId);
  const secondAccess = await getFreeAccessState(guest);
  assert.equal(secondAccess.userId, secondId);
  assert.equal(useFreeAccessStore.getState().access, null, 'old access never survives deletion');

  const email = `wave1-${randomUUID()}@example.test`;
  const password = `Wave1-${randomUUID()}!`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  assert.ifError(created.error);
  permanentId = created.data.user.id;
  assert.ifError((await permanent.auth.signInWithPassword({ email, password })).error);
  const permanentFree = await getFreeAccessState(permanent);
  assert.equal(permanentFree.identityKind, 'permanent');
  assert.equal(permanentFree.managedAccess, false);
  assert.equal(resolveLocalAccessRoute(['index'], permanentFree), '/(tabs)/check');
  assert.ifError((await admin.from('memberships').insert({ user_id: permanentId, tier: 'founding_beta', status: 'active' })).error);
  const managed = await getFreeAccessState(permanent);
  assert.equal(managed.managedAccess, true);
  assert.equal(resolveLocalAccessRoute(['index'], managed), '/(tabs)/plan');
  console.log('Wave-1 local mobile client: guest and permanent access, free Check/managed Plan, sourced catalog, typed/unknown barcode, deletion/new guest: PASS');
} finally {
  resetAuthAdapter();
  resetCustomerSessionData();
  if (firstId && !firstDeleted) await admin.auth.admin.deleteUser(firstId);
  if (secondId) await admin.auth.admin.deleteUser(secondId);
  if (permanentId) await admin.auth.admin.deleteUser(permanentId);
  if (productId) {
    await admin.from('product_search_aliases').delete().eq('product_id', productId);
    await admin.from('products').delete().eq('id', productId);
  }
}
