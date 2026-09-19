// Verify that local Supabase sends the six-digit code required by the app.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { createClient } from '@supabase/supabase-js';

const status = execFileSync('supabase', ['status', '-o', 'env'], {
  encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
});
function localValue(name) {
  const line = status.split('\n').find((candidate) => candidate.startsWith(`${name}=`));
  if (!line) throw new Error(`Supabase local status did not provide ${name}`);
  return line.slice(name.length + 1).replace(/^"|"$/g, '');
}

const url = localValue('API_URL');
const admin = createClient(url, localValue('SERVICE_ROLE_KEY'), {
  auth: { autoRefreshToken: false, persistSession: false },
});
const client = createClient(url, localValue('ANON_KEY'), {
  auth: { autoRefreshToken: false, persistSession: false },
});
const mailpitUrl = localValue('MAILPIT_URL');

async function findEmail(toAddress) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const listResponse = await fetch(`${mailpitUrl}/api/v1/messages`);
    assert.equal(listResponse.status, 200);
    const list = await listResponse.json();
    const match = list.messages?.find((message) =>
      message.To?.some((recipient) => recipient.Address === toAddress)
    );
    if (match) {
      const response = await fetch(`${mailpitUrl}/api/v1/message/${match.ID}`);
      assert.equal(response.status, 200);
      return response.json();
    }
    await delay(250);
  }
  throw new Error('Local OTP email was not delivered');
}

const email = `auth-otp-${Date.now()}@example.test`;
let userId;
try {
  const created = await admin.auth.admin.createUser({ email, email_confirm: true });
  assert.ifError(created.error);
  userId = created.data.user.id;

  const sent = await client.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
  assert.ifError(sent.error);
  const message = await findEmail(email);
  const token = message.Text?.match(/\b\d{6}\b/)?.[0];
  assert.ok(token, 'The local sign-in email must contain a six-digit OTP');

  const verified = await client.auth.verifyOtp({ email, token, type: 'email' });
  assert.ifError(verified.error);
  assert.equal(verified.data.user?.id, userId);
  assert.ok(verified.data.session?.access_token);
  console.log('Local six-digit email OTP sign-in passed');
} finally {
  if (userId) {
    const removed = await admin.auth.admin.deleteUser(userId);
    assert.ifError(removed.error);
  }
}
