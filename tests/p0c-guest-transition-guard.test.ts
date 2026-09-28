import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createPasswordAccount,
  resetAuthAdapter,
  sendEmailOtp,
  setAuthAdapter,
  signInWithPassword,
  verifyEmailOtp,
  type AuthAdapter,
} from '../src/services/authClient.ts';
import { resetCustomerSessionData } from '../src/services/sessionReset.ts';
import { useAuthStore } from '../src/stores/authStore.ts';
import { useRoutineStore } from '../src/stores/routineStore.ts';
import { CUSTOMER_ERROR_MESSAGES } from '../src/utils/customerErrors.ts';

function adapterForSession(user: unknown, counters: { calls: number }): AuthAdapter {
  return {
    async getSession() { return { data: { session: user ? { user } : null }, error: null }; },
    async signInWithOtp() { counters.calls++; return { data: {}, error: null }; },
    async verifyOtp() {
      counters.calls++;
      return { data: { session: { user: { id: 'other' } }, user: { id: 'other' } }, error: null };
    },
    async signUp() {
      counters.calls++;
      return { data: { session: { user: { id: 'other' } }, user: { id: 'other' } }, error: null };
    },
    async signInWithPassword() {
      counters.calls++;
      return { data: { session: { user: { id: 'other' } }, user: { id: 'other' } }, error: null };
    },
    async signOut() { return { error: null }; },
    onAuthStateChange() { return { data: { subscription: { unsubscribe() {} } } }; },
  };
}

test('anonymous guest cannot enter any ordinary account-replacement flow', async () => {
  const counters = { calls: 0 };
  resetCustomerSessionData();
  useAuthStore.getState().setSession('guest-1', null);
  useRoutineStore.getState().loadArthurDemoRoutine();
  const routineBefore = useRoutineStore.getState().routine;
  setAuthAdapter(adapterForSession({ id: 'guest-1', is_anonymous: true }, counters));
  try {
    const password = await signInWithPassword('member@example.com', 'password1');
    const otpRequest = await sendEmailOtp('member@example.com');
    const otpVerify = await verifyEmailOtp('member@example.com', '123456');
    const signup = await createPasswordAccount({
      firstName: 'Sami', lastName: 'Beg', email: 'member@example.com', password: 'password1',
    });
    for (const result of [password, otpRequest, otpVerify]) {
      assert.equal(result.success, false);
      assert.equal(result.code, 'GUEST_SESSION_ACTIVE');
      assert.equal(result.error, CUSTOMER_ERROR_MESSAGES.auth_guest_switch_blocked);
    }
    assert.equal(signup.success, false);
    assert.equal(signup.code, 'GUEST_UPGRADE_REQUIRED');
    assert.equal(signup.error, CUSTOMER_ERROR_MESSAGES.auth_guest_upgrade_required);
    assert.equal(counters.calls, 0, 'no Auth API may create or replace an identity');
    assert.equal(useAuthStore.getState().sessionUserId, 'guest-1');
    assert.equal(useRoutineStore.getState().routine, routineBefore);
  } finally {
    resetAuthAdapter();
    resetCustomerSessionData();
  }
});

test('unknown current identity or provider lookup failure blocks account replacement', async () => {
  const counters = { calls: 0 };
  try {
    setAuthAdapter(adapterForSession({ id: 'identity-without-claim' }, counters));
    const unknown = await signInWithPassword('member@example.com', 'password1');
    assert.equal(unknown.code, 'CURRENT_SESSION_UNKNOWN');
    assert.equal(unknown.error, CUSTOMER_ERROR_MESSAGES.auth_session_unknown);

    setAuthAdapter({
      ...adapterForSession(null, counters),
      async getSession() { return { data: { session: null }, error: new Error('backend failed') }; },
    });
    const failed = await sendEmailOtp('member@example.com');
    assert.equal(failed.code, 'CURRENT_SESSION_UNKNOWN');

    setAuthAdapter({
      ...adapterForSession(null, counters),
      async getSession() { throw new Error('backend failed'); },
    });
    const threw = await createPasswordAccount({
      firstName: 'Sami', lastName: 'Beg', email: 'member@example.com', password: 'password1',
    });
    assert.equal(threw.code, 'CURRENT_SESSION_UNKNOWN');
    assert.equal(counters.calls, 0);
  } finally {
    resetAuthAdapter();
    resetCustomerSessionData();
  }
});

test('no session and confirmed permanent user preserve existing sign-in behavior', async () => {
  const counters = { calls: 0 };
  try {
    setAuthAdapter(adapterForSession(null, counters));
    assert.equal((await signInWithPassword('member@example.com', 'password1')).success, true);
    setAuthAdapter(adapterForSession({ id: 'member-1', is_anonymous: false }, counters));
    assert.equal((await signInWithPassword('member@example.com', 'password1')).success, true);
    assert.equal(counters.calls, 2);
  } finally {
    resetAuthAdapter();
    resetCustomerSessionData();
  }
});
