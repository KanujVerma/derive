/**
 * Disposable hosted proof that Build 7 uses the deployed delete-customer-account contract.
 * Does not mutate schema, deploy functions, or touch a real customer.
 */
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { deleteCurrentAccount } from '../src/services/accountDeletion.ts';
import { resetCustomerSessionData } from '../src/services/sessionReset.ts';

const PROJECT_REF = 'snojlbqovlawewwqbviz';
const url = process.env.H1_HOSTED_SUPABASE_URL;
const key = process.env.H1_HOSTED_SUPABASE_PUBLISHABLE_KEY;

assert.equal(process.env.AUTH_V1_HOSTED_ALLOW_DISPOSABLE_TESTS, 'YES', 'Explicit hosted opt-in required');
assert.equal(url, `https://${PROJECT_REF}.supabase.co`, 'Wrong hosted project');
assert.match(key ?? '', /^sb_publishable_[A-Za-z0-9_-]{22}_[A-Za-z0-9_-]{8}$/, 'Modern public key required');

const email = `build7-delete-${randomUUID()}@example.test`;
const password = `B7!${randomBytes(30).toString('base64url')}`;
const member = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
let userId = null;

try {
  const signup = await member.auth.signUp({
    email,
    password,
    options: { data: { full_name: 'Build Seven', first_name: 'Build', last_name: 'Seven' } },
  });
  assert.ifError(signup.error);
  assert.ok(signup.data.user?.id && signup.data.session?.access_token, 'Signup must return an immediate session');
  userId = signup.data.user.id;

  const profile = await member.from('profiles').select('id, full_name').eq('id', userId).single();
  assert.ifError(profile.error);
  assert.equal(profile.data.full_name, 'Build Seven');
  console.log('Hosted Build 7: disposable signup and profile PASS');

  const deleted = await deleteCurrentAccount(member);
  assert.equal(deleted.success, true, 'Server deletion must return deleted true before local cleanup');
  console.log('Hosted Build 7: delete-customer-account PASS');

  const retry = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const signIn = await retry.auth.signInWithPassword({ email, password });
  assert.ok(signIn.error, 'Deleted credentials must not sign in');
  assert.equal(signIn.data.session, null);
  console.log('Hosted Build 7: deleted login rejected PASS');

  const leftover = await member.from('profiles').select('id').eq('id', userId);
  assert.ok(leftover.error || (leftover.data ?? []).length === 0, 'Deleted profile must not remain readable');
  console.log('Hosted Build 7: profile cleanup PASS');
  userId = null;
} finally {
  resetCustomerSessionData();
  if (userId) {
    const fallback = await deleteCurrentAccount(member);
    if (!fallback.success) console.error('Manual cleanup needed for disposable auth user');
  }
}
