// DERIVE S5 local membership-commerce integration harness.
// Exercises Edge Function boundaries without contacting Stripe, then verifies
// webhook lifecycle projection directly through the service-role-only RPC.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

let localStatus;
function localValue(name) {
  if (!localStatus) {
    localStatus = execFileSync('supabase', ['status', '-o', 'env'], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    });
  }
  const line = localStatus.split('\n').find((candidate) => candidate.startsWith(`${name}=`));
  if (!line) throw new Error(`Supabase local status did not provide ${name}`);
  return line.slice(name.length + 1).replace(/^"|"$/g, '');
}

const SUPABASE_URL = process.env.SUPABASE_URL || localValue('API_URL');
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || localValue('ANON_KEY');
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || localValue('SERVICE_ROLE_KEY');

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const memberClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function responsePayload(error) {
  if (!error?.context?.clone) return null;
  return error.context.clone().json().catch(() => null);
}

async function run() {
  console.log('=== DERIVE S5 Local Membership Commerce Integration ===\n');
  const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `s5-${runId}@example.test`;
  const password = 'S5IntegrationPassword123!';
  let userId;

  try {
    console.log('1. Provisioning an isolated authenticated member...');
    const created = await admin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { full_name: 'S5 Member' },
    });
    assert.ifError(created.error);
    userId = created.data.user.id;
    assert.ifError((await memberClient.auth.signInWithPassword({ email, password })).error);
    console.log('   ✓ Auth and profile lifecycle are ready');

    console.log('2. Verifying checkout/portal/webhook request boundaries without contacting Stripe...');
    const invalidCheckout = await memberClient.functions.invoke('create-membership-checkout', { body: {} });
    assert.ok(invalidCheckout.error);
    assert.equal(invalidCheckout.error.context?.status, 400);
    assert.equal((await responsePayload(invalidCheckout.error))?.code, 'INVALID_PAYLOAD');

    const unauthenticated = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const portal = await unauthenticated.functions.invoke('create-membership-portal', { body: {} });
    assert.ok(portal.error);
    assert.equal(portal.error.context?.status, 401);

    const memberPortal = await memberClient.functions.invoke('create-membership-portal', { body: {} });
    assert.ok(memberPortal.error);
    assert.ok(
      memberPortal.error.context?.status === 503 || memberPortal.error.context?.status === 409,
      'authenticated portal must fail safely before any Stripe network call when billing is unconfigured or unbound',
    );

    const webhookResponse = await fetch(`${SUPABASE_URL}/functions/v1/stripe-membership-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    assert.equal(webhookResponse.status, 400);
    assert.equal((await webhookResponse.json()).code, 'INVALID_SIGNATURE');
    console.log('   ✓ Auth, payload, and Stripe-signature gates fail closed');

    console.log('3. Projecting signed-event fixtures through the service-only lifecycle RPC...');
    const customerId = `cus_s5${runId.replaceAll('-', '')}`;
    const subscriptionId = `sub_s5${runId.replaceAll('-', '')}`;
    const priceId = 'price_s5founding';
    const apply = async (eventId, at, status, explicitUserId = userId) => {
      const result = await admin.rpc('apply_stripe_membership_event', {
        p_event_id: eventId,
        p_event_type: status === 'canceled' ? 'customer.subscription.deleted' : 'customer.subscription.updated',
        p_event_created_at: at,
        p_user_id: explicitUserId,
        p_customer_email: email,
        p_stripe_customer_id: customerId,
        p_stripe_subscription_id: subscriptionId,
        p_stripe_subscription_status: status,
        p_stripe_price_id: priceId,
        p_cancel_at_period_end: false,
      });
      assert.ifError(result.error);
      return result.data;
    };

    const base = Date.now();
    const active = await apply(`evt_s5active${runId.replaceAll('-', '')}`, new Date(base).toISOString(), 'active');
    assert.equal(active.status, 'active');
    const duplicate = await apply(`evt_s5active${runId.replaceAll('-', '')}`, new Date(base + 1_000).toISOString(), 'canceled');
    assert.equal(duplicate.duplicate, true);
    const stale = await apply(`evt_s5stale${runId.replaceAll('-', '')}`, new Date(base - 1_000).toISOString(), 'canceled');
    assert.equal(stale.status, 'active');
    const paused = await apply(`evt_s5paused${runId.replaceAll('-', '')}`, new Date(base + 2_000).toISOString(), 'past_due', null);
    assert.equal(paused.status, 'paused');
    const cancelled = await apply(`evt_s5cancelled${runId.replaceAll('-', '')}`, new Date(base + 3_000).toISOString(), 'canceled', null);
    assert.equal(cancelled.status, 'cancelled');

    const membership = await admin.from('memberships')
      .select('tier, status, stripe_customer_id, stripe_subscription_id, stripe_price_id, stripe_subscription_status')
      .eq('user_id', userId)
      .single();
    assert.ifError(membership.error);
    assert.deepEqual(membership.data, {
      tier: 'founding_beta',
      status: 'cancelled',
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      stripe_price_id: priceId,
      stripe_subscription_status: 'canceled',
    });
    console.log('   ✓ active → paused → cancelled, duplicate delivery, and stale ordering are correct');

    console.log('\n=== ALL DERIVE S5 LOCAL MEMBERSHIP COMMERCE CHECKS PASSED ===\n');
  } finally {
    if (userId) await admin.auth.admin.deleteUser(userId);
  }
}

run().catch((error) => {
  console.error('\nS5 integration failed:', error);
  process.exitCode = 1;
});
