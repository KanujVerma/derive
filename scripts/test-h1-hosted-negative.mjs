/**
 * Hosted H1 negative boundary smoke using two disposable password-auth users.
 * This does not verify email OTP, Stripe, Gemini, or the primary customer path.
 * It needs only the hosted project URL and its public publishable key.
 */
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const PROJECT_REF = 'snojlbqovlawewwqbviz';
const url = process.env.H1_HOSTED_SUPABASE_URL;
const key = process.env.H1_HOSTED_SUPABASE_PUBLISHABLE_KEY;

assert.equal(process.env.H1_HOSTED_ALLOW_DISPOSABLE_TESTS, 'YES',
  'Explicit disposable hosted-test opt-in required');
assert.equal(url, `https://${PROJECT_REF}.supabase.co`, 'Wrong hosted project');
assert.match(key ?? '', /^sb_publishable_[A-Za-z0-9_-]{22}_[A-Za-z0-9_-]{8}$/, 'Modern public key required');

const accounts = [];
const client = () => createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function createDisposable(label) {
  const member = client();
  const email = `h1-${label}-${randomUUID()}@example.test`;
  const password = `H1!${randomBytes(30).toString('base64url')}`;
  const { data, error } = await member.auth.signUp({ email, password });
  assert.ifError(error);
  assert.ok(data.user?.id, 'Auth did not create the disposable user');
  accounts.push({ id: data.user.id, member, deleted: false });
  assert.ok(data.session?.access_token,
    'Hosted password signup did not return a session; stop without treating this as OTP proof');
  return accounts.at(-1);
}

async function statusOf(member, name, body) {
  const { error } = await member.functions.invoke(name, { body });
  return error?.context?.status ?? 200;
}

async function deleteDisposable(account) {
  if (account.deleted) return;
  const { data, error } = await account.member.functions.invoke('delete-customer-account', {
    body: { confirmation: 'DELETE_MY_DERIVE_ACCOUNT' },
  });
  assert.ifError(error);
  assert.equal(data?.deleted, true, 'Account deletion was not confirmed');
  account.deleted = true;
}

try {
  const a = await createDisposable('a');
  const b = await createDisposable('b');

  for (const account of [a, b]) {
    const own = await account.member.from('profiles').select('id').eq('id', account.id).single();
    assert.ifError(own.error);
    assert.equal(own.data.id, account.id);
    const membership = await account.member.from('memberships').select('status').eq('user_id', account.id);
    assert.ifError(membership.error);
    assert.equal(membership.data.length, 0);
  }
  console.log('Hosted H1 negative: two disposable Auth users have profiles and no membership');

  const foreign = await a.member.from('profiles').select('id').eq('id', b.id);
  assert.ifError(foreign.error);
  assert.deepEqual(foreign.data, [], 'Customer A must not read B profile');
  const reverse = await b.member.from('profiles').select('id').eq('id', a.id);
  assert.ifError(reverse.error);
  assert.deepEqual(reverse.data, [], 'Customer B must not read A profile');
  console.log('Hosted H1 negative: cross-user profile reads denied');

  const premium = [
    ['prepare-onboarding', {}],
    ['onboard-customer', {}],
    ['propose-routine', {}],
    ['scan-product', { productName: 'Test Cleanser' }],
    ['ask-derive', { userId: a.id, question: 'Can I use this cleanser?' }],
    ['infer-ingredient-signals', {}],
    ['submit-checkin', { userId: a.id, skinState: 'same', irritation: 'none' }],
  ];
  for (const [name, body] of premium) {
    assert.equal(await statusOf(a.member, name, body), 403,
      `${name} must deny inactive Auth users in hosted Remote`);
  }
  assert.equal(await statusOf(a.member, 'founder-operations', { action: 'list_review_queue' }), 403,
    'Ordinary customer must not access founder operations');
  console.log('Hosted H1 negative: seven paid functions and founder operations denied');

  const forged = await a.member.from('memberships').insert({
    user_id: a.id, tier: 'founding_beta', status: 'active',
  });
  assert.ok(forged.error, 'Customer cannot create an active membership');
  const afterForgery = await a.member.from('memberships').select('status').eq('user_id', a.id);
  assert.ifError(afterForgery.error);
  assert.deepEqual(afterForgery.data, []);

  const pixelPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==',
    'base64',
  );
  const upload = await a.member.storage.from('customer-skin-photos').upload(
    `${a.id}/h1-inactive-test.png`, pixelPng, { contentType: 'image/png', upsert: false },
  );
  assert.ok(upload.error, 'Inactive user cannot upload a private photo');
  assert.equal(Number(upload.error.statusCode), 403,
    'Inactive upload must fail at the authorization boundary');
  console.log('Hosted H1 negative: self-activation and inactive photo upload denied');

  await deleteDisposable(b);
  await deleteDisposable(a);
  console.log('Hosted H1 negative: both disposable accounts self-deleted');
} finally {
  const failures = [];
  for (const account of accounts.filter((entry) => !entry.deleted)) {
    try { await deleteDisposable(account); }
    catch { failures.push(account.id); }
  }
  if (failures.length > 0) {
    console.error('Manual cleanup required for disposable Auth user IDs:', failures.join(', '));
    process.exitCode = 1;
  }
}
