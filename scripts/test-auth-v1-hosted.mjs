/**
 * Guarded hosted AUTH-V1 proof: password signup must return an immediate session,
 * create a canonical profile name, leave membership none, and allow returning login.
 * Disposable accounts only. Not OTP, Stripe, or billing proof.
 */
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import {
  createPasswordAccount,
  resetAuthAdapter,
  setAuthAdapter,
  signInWithPassword,
  signOutSession,
} from '../src/services/authClient.ts';
import { resetCustomerSessionData } from '../src/services/sessionReset.ts';
import { useAuthStore } from '../src/stores/authStore.ts';
import { useUserStore } from '../src/stores/userStore.ts';
import { mapDbBootstrapState } from '../src/services/remote/RemoteDeriveService.ts';

const PROJECT_REF = 'snojlbqovlawewwqbviz';
const PROJECT_URL = `https://${PROJECT_REF}.supabase.co`;
const url = process.env.H1_HOSTED_SUPABASE_URL;
const key = process.env.H1_HOSTED_SUPABASE_PUBLISHABLE_KEY;

assert.equal(process.env.AUTH_V1_HOSTED_ALLOW_DISPOSABLE_TESTS, 'YES', 'Explicit hosted opt-in required');
assert.equal(url, PROJECT_URL, 'Wrong hosted project');
assert.match(key ?? '', /^sb_publishable_[A-Za-z0-9_-]{22}_[A-Za-z0-9_-]{8}$/, 'Modern public key required');

const accounts = [];

function hostedAdapter(client) {
  const adapter = {
    async signInWithOtp() { return { data: null, error: new Error('OTP is not part of AUTH-V1 hosted proof') }; },
    async verifyOtp() { return { data: { session: null, user: null }, error: new Error('OTP is not part of AUTH-V1 hosted proof') }; },
    async signUp(input) {
      return client.auth.signUp({
        email: input.email,
        password: input.password,
        options: input.options,
      });
    },
    async signInWithPassword(input) {
      return client.auth.signInWithPassword({
        email: input.email,
        password: input.password,
      });
    },
    async getSession() { return client.auth.getSession(); },
    async signOut(options) { return client.auth.signOut(options); },
    onAuthStateChange(callback) { return client.auth.onAuthStateChange(callback); },
  };
  return adapter;
}

function client() {
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function deleteAccount(account) {
  if (account.deleted) return;
  const { data, error } = await account.client.functions.invoke('delete-customer-account', {
    body: { confirmation: 'DELETE_MY_DERIVE_ACCOUNT' },
  });
  assert.ifError(error);
  assert.equal(data?.deleted, true, 'Account deletion was not confirmed');
  account.deleted = true;
}

try {
  const first = client();
  const firstName = 'Ada';
  const lastName = 'Lovelace';
  const emailA = `authv1-a-${randomUUID()}@example.test`;
  const passwordA = `AV1!${randomBytes(30).toString('base64url')}`;
  accounts.push({ role: 'a', client: first, email: emailA, deleted: false });

  setAuthAdapter(hostedAdapter(first));
  resetCustomerSessionData();
  const signup = await createPasswordAccount({
    firstName,
    lastName,
    email: emailA,
    password: passwordA,
  });
  assert.equal(signup.success, true, 'Signup must return an authenticated session immediately');
  assert.ok(signup.userId);
  accounts[0].id = signup.userId;
  assert.equal(useAuthStore.getState().status, 'SIGNED_IN');
  assert.equal(useAuthStore.getState().sessionUserId, signup.userId);
  assert.equal(useUserStore.getState().membershipStatus, 'none');
  console.log('Hosted AUTH-V1: immediate password signup session PASS');

  const authUser = await first.auth.getUser();
  assert.ifError(authUser.error);
  assert.equal(authUser.data.user?.id, signup.userId);

  const profile = await first.from('profiles').select('id, full_name').eq('id', signup.userId).single();
  assert.ifError(profile.error);
  assert.equal(profile.data.id, signup.userId);
  assert.equal(profile.data.full_name, `${firstName} ${lastName}`);
  console.log('Hosted AUTH-V1: canonical profile full_name PASS');

  const memberships = await first.from('memberships').select('status').eq('user_id', signup.userId);
  assert.ifError(memberships.error);
  assert.equal(memberships.data.length, 0);
  const bootstrap = mapDbBootstrapState(signup.userId, { id: signup.userId }, { onboarding_completed: false }, memberships.data);
  assert.equal(bootstrap.membershipStatus, 'none');
  console.log('Hosted AUTH-V1: membership remains none PASS');

  const signedOut = await signOutSession();
  assert.equal(signedOut.success, true);
  assert.equal(useAuthStore.getState().status, 'SIGNED_OUT');

  const returned = await signInWithPassword(emailA, passwordA);
  assert.equal(returned.success, true);
  assert.equal(returned.userId, signup.userId);
  console.log('Hosted AUTH-V1: returning password login PASS');

  const second = client();
  const emailB = `authv1-b-${randomUUID()}@example.test`;
  const passwordB = `AV1!${randomBytes(30).toString('base64url')}`;
  accounts.push({ role: 'b', client: second, email: emailB, deleted: false });
  setAuthAdapter(hostedAdapter(second));
  const signupB = await createPasswordAccount({
    firstName: 'Grace',
    lastName: 'Hopper',
    email: emailB,
    password: passwordB,
  });
  assert.equal(signupB.success, true);
  accounts[1].id = signupB.userId;
  assert.notEqual(signupB.userId, signup.userId);
  assert.equal(useAuthStore.getState().sessionUserId, signupB.userId);
  assert.equal(useUserStore.getState().userId, signupB.userId);
  assert.equal(useUserStore.getState().membershipStatus, 'none');
  console.log('Hosted AUTH-V1: second-user session isolation PASS');

  await deleteAccount(accounts[1]);
  await deleteAccount(accounts[0]);
  const goneA = await first.from('profiles').select('id').eq('id', accounts[0].id);
  const goneB = await second.from('profiles').select('id').eq('id', accounts[1].id);
  assert.deepEqual(goneA.data ?? [], []);
  assert.deepEqual(goneB.data ?? [], []);
  console.log('Hosted AUTH-V1: disposable cleanup PASS');
} catch (error) {
  const failed = [];
  for (const account of [...accounts].reverse()) {
    try { await deleteAccount(account); }
    catch { failed.push(account.id ?? account.email); }
  }
  if (failed.length) console.error('Manual cleanup needed for disposable identifiers:', failed.join(', '));
  throw error;
} finally {
  resetAuthAdapter();
  resetCustomerSessionData();
}
