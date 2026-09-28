/** Local-only Auth/Edge/database proof. Never accepts a hosted API target. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const enabled = process.argv[2] === 'enabled';
assert.ok(enabled || process.argv[2] === 'disabled', 'Choose enabled or disabled test mode');
const workdir = process.env.DERIVE_LOCAL_SUPABASE_WORKDIR;
const status = JSON.parse(execFileSync('supabase', [
  'status', '-o', 'json', ...(workdir ? ['--workdir', workdir] : []),
], {
  encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, DO_NOT_TRACK: '1' },
}));
assert.equal(new URL(status.API_URL).hostname, '127.0.0.1', 'Refuse non-local Supabase target');
const make = (key) => createClient(status.API_URL, key,
  { auth: { autoRefreshToken: false, persistSession: false } });
const admin = make(status.SERVICE_ROLE_KEY);
const first = make(status.ANON_KEY);
const second = make(status.ANON_KEY);
const event = { schemaVersion: 1, event: 'check_completed',
  properties: { inputMethod: 'barcode', outcome: 'useful', personalized: false } };
const call = async (client, payload) => {
  const { data, error } = await client.functions.invoke('product-measurement', { body: payload });
  const response = error?.context;
  if (response instanceof Response) {
    let failure;
    try { failure = await response.clone().json(); } catch { failure = null; }
    return { data: failure, status: response.status };
  }
  return { data, status: error?.context?.status ?? 202 };
};
let firstId, secondId;
try {
  const a = await first.auth.signInAnonymously();
  const b = await second.auth.signInAnonymously();
  assert.ifError(a.error); assert.ifError(b.error);
  firstId = a.data.user.id; secondId = b.data.user.id;
  let disabledProbe;
  for (let attempt = 0; attempt < (enabled ? 40 : 1); attempt += 1) {
    disabledProbe = await call(first, event);
    if (!enabled || disabledProbe.status !== 503 || disabledProbe.data?.code !== 'INGRESS_DISABLED') break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!enabled) {
    assert.equal(disabledProbe.status, 503, 'ingress is off without an explicit enable flag');
    assert.equal(disabledProbe.data.code, 'INGRESS_DISABLED');
    assert.deepEqual((await admin.from('product_measurement_events').select('id').eq('user_id', firstId)).data, []);
    console.log('Product measurement: default-off Edge gate passed');
  } else {
    const forged = await fetch(`${status.API_URL}/functions/v1/product-measurement`, {
      method: 'POST', headers: { apikey: status.ANON_KEY, authorization: 'Bearer invalid',
        'content-type': 'application/json' }, body: JSON.stringify(event),
    });
    assert.equal(forged.status, 401, 'an invalid JWT cannot record an event');
    assert.equal(disabledProbe.status, 202, 'authenticated event is accepted');
    assert.deepEqual(disabledProbe.data, { accepted: true });
    const { data: accepted, error: readError } = await admin.from('product_measurement_events')
      .select('user_id,event_name,properties,received_at').eq('user_id', firstId);
    assert.ifError(readError);
    assert.equal(accepted.length, 1);
    assert.equal(accepted[0].user_id, firstId, 'owner comes from verified JWT');
    assert.equal(accepted[0].event_name, 'check_completed');
    assert.deepEqual(accepted[0].properties, event.properties);
    assert.ok(Date.parse(accepted[0].received_at), 'receipt time is assigned by server');

    assert.equal((await call(first, { ...event, userId: secondId })).status, 400,
      'a client-asserted owner is rejected');
    assert.equal((await call(first, { ...event, properties: {
      ...event.properties, productName: 'Private product',
    } })).status, 400, 'private product text is rejected');
    assert.equal((await call(first, { ...event, properties: {
      ...event.properties, skinConcern: 'Private concern',
    } })).status, 400, 'sensitive skin text is rejected');
    assert.equal((await call(first, { ...event, properties: {
      ...event.properties, personalized: 'false',
    } })).status, 400, 'wrong property types are rejected');
    assert.equal((await call(first, { ...event, padding: 'x'.repeat(1200) })).status, 413,
      'oversized requests are rejected');
    assert.ok((await first.from('product_measurement_events').select('id')).error,
      'customer cannot directly read the private ledger');
    assert.ok((await first.from('product_measurement_events').insert({
      user_id: secondId, event_name: 'app_opened', properties: { platform: 'ios' },
    })).error, 'customer cannot directly insert an event for another owner');
    assert.equal((await call(second, { schemaVersion: 1, event: 'app_opened',
      properties: { platform: 'ios' } })).status, 202);
    const { data: secondRows } = await admin.from('product_measurement_events')
      .select('user_id').eq('user_id', secondId);
    assert.equal(secondRows.length, 1, 'second owner is isolated');

    // Fill the owner's minute window through the trusted local admin and
    // verify the Edge maps an atomic database rejection to a droppable 429.
    const fillers = Array.from({ length: 59 }, () => ({
      user_id: firstId, event_name: 'app_opened', properties: { platform: 'ios' },
    }));
    assert.ifError((await admin.from('product_measurement_events').insert(fillers)).error);
    const limited = await call(first, event);
    assert.equal(limited.status, 429);
    assert.equal(limited.data.code, 'RATE_LIMITED');
    const { count } = await admin.from('product_measurement_events')
      .select('*', { count: 'exact', head: true }).eq('user_id', firstId);
    assert.equal(count, 60, 'rate rejection does not create a row');

    const deletion = await first.functions.invoke('delete-customer-account',
      { body: { confirmation: 'DELETE_MY_DERIVE_ACCOUNT' } });
    assert.ifError(deletion.error); firstId = null;
    assert.deepEqual((await admin.from('product_measurement_events').select('id')
      .eq('user_id', a.data.user.id)).data, [], 'account deletion cascades events');
    console.log('Product measurement: verified owner, privacy shape, size, RLS, rate and cascade passed');
  }
} finally {
  if (firstId) await admin.auth.admin.deleteUser(firstId);
  if (secondId) await admin.auth.admin.deleteUser(secondId);
}
