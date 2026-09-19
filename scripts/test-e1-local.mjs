// E1 local entitlement lifecycle. No live Stripe calls or hosted credentials.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { RemoteDeriveService } from '../src/services/remote/RemoteDeriveService.ts';
import { getAuthRedirectRoute, resolveAuthRoute } from '../src/utils/authRouting.ts';

const status = execFileSync('supabase', ['status', '-o', 'env'], {
  encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
});
function value(name) {
  const line = status.split('\n').find((candidate) => candidate.startsWith(`${name}=`));
  if (!line) throw new Error(`Missing local ${name}`);
  return line.slice(name.length + 1).replace(/^"|"$/g, '');
}

const url = value('API_URL');
const admin = createClient(url, value('SERVICE_ROLE_KEY'), {
  auth: { autoRefreshToken: false, persistSession: false },
});
const member = createClient(url, value('ANON_KEY'), {
  auth: { autoRefreshToken: false, persistSession: false },
});
const remote = new RemoteDeriveService(member);

async function expectRoute(userId, expectedType, expectedRoute) {
  const state = await remote.getCustomerBootstrapState(userId);
  const destination = resolveAuthRoute({
    remoteEnabled: true,
    authStatus: 'SIGNED_IN',
    sessionUserId: userId,
    resolvedUserId: userId,
    profileResolution: state.onboardingCompleted ? 'READY' : 'NEEDS_ONBOARDING',
    bootstrapState: state,
  });
  assert.deepEqual(destination, { type: expectedType, route: expectedRoute });
  return destination;
}

async function functionStatus(name, body) {
  const { error } = await member.functions.invoke(name, { body });
  return error?.context?.status ?? 200;
}

const email = `e1-${Date.now()}@example.test`;
const password = 'E1LocalEntitlementPassword123!';
let userId;
try {
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  assert.ifError(created.error);
  userId = created.data.user.id;
  assert.ifError((await member.auth.signInWithPassword({ email, password })).error);

  const profile = await member.from('profiles').select('id').eq('id', userId).single();
  assert.ifError(profile.error);
  assert.equal(profile.data.id, userId);
  const noMembership = await member.from('memberships').select('status').eq('user_id', userId);
  assert.ifError(noMembership.error);
  assert.equal(noMembership.data.length, 0);
  const inactiveRoute = await expectRoute(userId, 'REMOTE_MEMBERSHIP', '/membership');
  assert.equal(getAuthRedirectRoute(['(tabs)', 'index'], inactiveRoute), '/membership');
  console.log('E1: Auth provisions identity without creating paid membership');

  const premiumRequests = [
    ['prepare-onboarding', {}],
    ['onboard-customer', {}],
    ['propose-routine', {}],
    ['scan-product', { productName: 'Test Cleanser' }],
    ['ask-derive', { userId, question: 'Can I use this cleanser?' }],
    ['infer-ingredient-signals', {}],
    ['submit-checkin', { userId, skinState: 'same', irritation: 'none' }],
  ];
  for (const [name, body] of premiumRequests) {
    assert.equal(await functionStatus(name, body), 403, `${name} must require active membership`);
  }
  console.log('E1: inactive member cannot call paid onboarding, intelligence, or check-in functions');

  const forged = await member.from('memberships').insert({ user_id: userId, tier: 'founding_beta', status: 'active' });
  assert.ok(forged.error, 'member cannot self-activate through Data API');

  const activated = await admin.from('memberships').insert({
    user_id: userId, tier: 'founding_beta', status: 'active',
  });
  assert.ifError(activated.error);
  await expectRoute(userId, 'REMOTE_ONBOARDING', '/(onboarding)/1-welcome');
  const prepared = await member.functions.invoke('prepare-onboarding', { body: {} });
  assert.ifError(prepared.error);
  assert.equal(prepared.data.submissionStatus, 'draft');
  const scanAfterActivation = await functionStatus('scan-product', { productName: 'Test Cleanser' });
  assert.notEqual(scanAfterActivation, 403, 'active member reaches the existing profile/model boundary');
  console.log('E1: server-owned activation unlocks onboarding eligibility');

  const completed = await admin.from('skin_profiles').insert({
    user_id: userId,
    primary_goal: 'breakouts', secondary_goals: [],
    routine_complexity: 'simple', cost_preference: 'balanced', midday_feel: 'comfortable',
    known_sensitivities: [], sensitivities_status: 'none_known', active_prescriptions: [],
    pregnancy_status: 'no', onboarding_completed: true,
  });
  assert.ifError(completed.error);
  await expectRoute(userId, 'REMOTE_TABS', '/(tabs)');
  console.log('E1: active membership plus completed onboarding unlocks member tabs');

  const paused = await admin.from('memberships').update({ status: 'paused' }).eq('user_id', userId);
  assert.ifError(paused.error);
  const pausedRoute = await expectRoute(userId, 'REMOTE_MEMBERSHIP', '/membership');
  assert.equal(getAuthRedirectRoute(['check-in'], pausedRoute), '/membership');
  for (const [name, body] of premiumRequests) {
    assert.equal(await functionStatus(name, body), 403, `${name} must be revoked after pause`);
  }
  const historical = await member.from('memberships').select('status').eq('user_id', userId).single();
  assert.ifError(historical.error);
  assert.equal(historical.data.status, 'paused');
  console.log('E1: pause revokes paid calls while canonical billing status remains owner-readable');

  const resumed = await admin.from('memberships').update({ status: 'active' }).eq('user_id', userId);
  assert.ifError(resumed.error);
  await expectRoute(userId, 'REMOTE_TABS', '/(tabs)');
  const readiness = await member.from('skin_profiles').select('onboarding_completed').eq('user_id', userId).single();
  assert.ifError(readiness.error);
  assert.equal(readiness.data.onboarding_completed, true);
  console.log('E1: resumed active membership and completed onboarding remain independent');
} finally {
  if (userId) {
    const removed = await admin.auth.admin.deleteUser(userId);
    assert.ifError(removed.error);
  }
}
