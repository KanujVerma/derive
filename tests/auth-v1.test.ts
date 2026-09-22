import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  composeFullName,
  createPasswordAccount,
  isValidEmail,
  isValidPassword,
  isValidPersonName,
  resetAuthAdapter,
  setAuthAdapter,
  signInWithPassword,
  signOutSession,
  type AuthAdapter,
} from '../src/services/authClient.ts';
import { resetCustomerSessionData } from '../src/services/sessionReset.ts';
import { CUSTOMER_ERROR_MESSAGES } from '../src/utils/customerErrors.ts';
import {
  shouldOfferStripeMembershipCheckout,
  usesConciergeMembershipAccess,
} from '../src/utils/membershipPresentation.ts';
import { useAuthStore } from '../src/stores/authStore.ts';
import { useUserStore } from '../src/stores/userStore.ts';
import { useRoutineStore } from '../src/stores/routineStore.ts';
import { useOnboardingStore } from '../src/stores/onboardingStore.ts';
import { mapDbBootstrapState } from '../src/services/remote/RemoteDeriveService.ts';

function unusedOtpAdapter(overrides: Partial<AuthAdapter> = {}): AuthAdapter {
  return {
    async signInWithOtp() { return { data: {}, error: null }; },
    async verifyOtp() { return { data: { session: null, user: null }, error: null }; },
    async getSession() { return { data: { session: null }, error: null }; },
    async signOut() { return { error: null }; },
    onAuthStateChange() { return { data: { subscription: { unsubscribe: () => {} } } }; },
    ...overrides,
  };
}

test('AUTH-V1: email validation is preserved', () => {
  assert.equal(isValidEmail('member@derive.skin'), true);
  assert.equal(isValidEmail('user.name+tag@gmail.com'), true);
  assert.equal(isValidEmail('invalid-email'), false);
  assert.equal(isValidEmail(''), false);
  assert.equal(isValidEmail('user@domain'), false);
});

test('AUTH-V1: first and last name are required and bounded', () => {
  assert.equal(isValidPersonName('Ada'), true);
  assert.equal(isValidPersonName(' Lovelace '), true);
  assert.equal(isValidPersonName(''), false);
  assert.equal(isValidPersonName('   '), false);
  assert.equal(isValidPersonName('x'.repeat(80)), true);
  assert.equal(isValidPersonName('x'.repeat(81)), false);
});

test('AUTH-V1: password minimum 8 is enforced locally and contents are not trimmed', () => {
  assert.equal(isValidPassword('short'), false);
  assert.equal(isValidPassword('1234567'), false);
  assert.equal(isValidPassword('12345678'), true);
  assert.equal(isValidPassword(' password'), true);
  assert.equal(isValidPassword('x'.repeat(72)), true);
  assert.equal(isValidPassword('x'.repeat(73)), false);
});

test('AUTH-V1: full_name is composed from trimmed first and last name', () => {
  assert.equal(composeFullName('  Ada  ', ' Lovelace '), 'Ada Lovelace');
});

test('AUTH-V1: signup sends canonical metadata and fails closed without a session', async () => {
  let captured: { email?: string; password?: string; data?: Record<string, string> } = {};
  const adapter = unusedOtpAdapter({
    async signUp(input) {
      captured = { email: input.email, password: input.password, data: input.options?.data };
      if (input.email === 'nosession@derive.skin') {
        return {
          data: { user: { id: 'usr_pending', email: input.email }, session: null },
          error: null,
        };
      }
      if (input.email === 'fail@derive.skin') {
        return {
          data: { user: null, session: null },
          error: { name: 'AuthApiError', message: 'User already registered' },
        };
      }
      return {
        data: {
          user: { id: 'usr_new', email: input.email },
          session: { access_token: 'tok_secret', refresh_token: 'ref_secret' },
        },
        error: null,
      };
    },
  });
  setAuthAdapter(adapter);
  try {
    const missingFirst = await createPasswordAccount({
      firstName: ' ',
      lastName: 'Lovelace',
      email: 'ada@derive.skin',
      password: 'correcthorse',
    });
    assert.equal(missingFirst.success, false);
    assert.equal(missingFirst.error, CUSTOMER_ERROR_MESSAGES.auth_invalid_name);

    const missingLast = await createPasswordAccount({
      firstName: 'Ada',
      lastName: '',
      email: 'ada@derive.skin',
      password: 'correcthorse',
    });
    assert.equal(missingLast.success, false);
    assert.equal(missingLast.error, CUSTOMER_ERROR_MESSAGES.auth_invalid_name);

    const shortPassword = await createPasswordAccount({
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@derive.skin',
      password: 'short',
    });
    assert.equal(shortPassword.success, false);
    assert.equal(shortPassword.error, CUSTOMER_ERROR_MESSAGES.auth_invalid_password);

    const created = await createPasswordAccount({
      firstName: ' Ada ',
      lastName: ' Lovelace ',
      email: ' ADA@DERIVE.SKIN ',
      password: ' correcthorse',
    });
    assert.equal(created.success, true);
    assert.equal(created.userId, 'usr_new');
    assert.equal(captured.email, 'ada@derive.skin');
    assert.equal(captured.password, ' correcthorse');
    assert.deepEqual(captured.data, {
      full_name: 'Ada Lovelace',
      first_name: 'Ada',
      last_name: 'Lovelace',
    });
    assert.equal(created.userId && 'access_token' in created, false);

    const missingSession = await createPasswordAccount({
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'nosession@derive.skin',
      password: 'correcthorse',
    });
    assert.equal(missingSession.success, false);
    assert.equal(missingSession.error, CUSTOMER_ERROR_MESSAGES.auth_signup_unconfirmed);
    assert.equal(missingSession.error?.toLowerCase().includes('email'), false);

    const backendFail = await createPasswordAccount({
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'fail@derive.skin',
      password: 'correcthorse',
    });
    assert.equal(backendFail.success, false);
    assert.equal(backendFail.error, CUSTOMER_ERROR_MESSAGES.auth_signup);
    assert.equal(backendFail.error?.includes('AuthApiError'), false);
    assert.equal(backendFail.error?.toLowerCase().includes('already registered'), false);
  } finally {
    resetAuthAdapter();
    resetCustomerSessionData();
  }
});

test('AUTH-V1: successful signup projects authenticated stores without activating membership', async () => {
  setAuthAdapter(unusedOtpAdapter({
    async signUp() {
      return {
        data: {
          user: { id: 'usr_signup', email: 'new@derive.skin' },
          session: { access_token: 'tok', refresh_token: 'ref' },
        },
        error: null,
      };
    },
  }));
  try {
    resetCustomerSessionData();
    const result = await createPasswordAccount({
      firstName: 'New',
      lastName: 'Member',
      email: 'new@derive.skin',
      password: 'correcthorse',
    });
    assert.equal(result.success, true);
    assert.equal(useAuthStore.getState().status, 'SIGNED_IN');
    assert.equal(useAuthStore.getState().sessionUserId, 'usr_signup');
    assert.equal(useAuthStore.getState().sessionEmail, 'new@derive.skin');
    assert.equal(useUserStore.getState().userId, 'usr_signup');
    assert.equal(useUserStore.getState().email, 'new@derive.skin');
    assert.equal(useUserStore.getState().membershipStatus, 'none');
    assert.equal(useUserStore.getState().tier, '');
  } finally {
    resetAuthAdapter();
    resetCustomerSessionData();
  }
});

test('AUTH-V1: password sign-in normalizes email and hides backend failures', async () => {
  let capturedEmail = '';
  setAuthAdapter(unusedOtpAdapter({
    async signInWithPassword(input) {
      capturedEmail = input.email;
      if (input.email === 'wrong@derive.skin') {
        return {
          data: { user: null, session: null },
          error: { name: 'AuthApiError', message: 'Invalid login credentials' },
        };
      }
      return {
        data: {
          user: { id: 'usr_login', email: input.email },
          session: { access_token: 'tok', refresh_token: 'ref' },
        },
        error: null,
      };
    },
  }));
  try {
    resetCustomerSessionData();
    const invalid = await signInWithPassword('not-an-email', 'correcthorse');
    assert.equal(invalid.success, false);
    assert.equal(invalid.error, CUSTOMER_ERROR_MESSAGES.auth_password_signin);

    const failed = await signInWithPassword('wrong@derive.skin', 'nope');
    assert.equal(failed.success, false);
    assert.equal(failed.error, CUSTOMER_ERROR_MESSAGES.auth_password_signin);
    assert.equal(failed.error?.includes('AuthApiError'), false);
    assert.equal(failed.error?.toLowerCase().includes('invalid login'), false);

    const ok = await signInWithPassword(' MEMBER@DERIVE.SKIN ', 'correcthorse');
    assert.equal(ok.success, true);
    assert.equal(capturedEmail, 'member@derive.skin');
    assert.equal(useAuthStore.getState().status, 'SIGNED_IN');
    assert.equal(useAuthStore.getState().sessionUserId, 'usr_login');
    assert.equal(useUserStore.getState().membershipStatus, 'none');
  } finally {
    resetAuthAdapter();
    resetCustomerSessionData();
  }
});

test('AUTH-V1: A to B account switch purges prior customer state and sign-out remains fail closed', async () => {
  setAuthAdapter(unusedOtpAdapter({
    async signInWithPassword(input) {
      const id = input.email.startsWith('a@') ? 'usr_a' : 'usr_b';
      return {
        data: {
          user: { id, email: input.email },
          session: { access_token: 'tok', refresh_token: 'ref' },
        },
        error: null,
      };
    },
  }));
  try {
    resetCustomerSessionData();
    await signInWithPassword('a@derive.skin', 'password1');
    useUserStore.getState().setUser('usr_a', 'a@derive.skin', 'Member A');
    useRoutineStore.getState().loadArthurDemoRoutine();
    useOnboardingStore.getState().loadArthurDemoState();
    assert.notEqual(useRoutineStore.getState().routine, null);

    await signInWithPassword('b@derive.skin', 'password2');
    assert.equal(useAuthStore.getState().sessionUserId, 'usr_b');
    assert.equal(useUserStore.getState().userId, 'usr_b');
    assert.equal(useUserStore.getState().fullName, '');
    assert.equal(useUserStore.getState().membershipStatus, 'none');
    assert.equal(useRoutineStore.getState().routine, null);
    assert.equal(useOnboardingStore.getState().isCompleted, false);

    const signedOut = await signOutSession();
    assert.equal(signedOut.success, true);
    assert.equal(useAuthStore.getState().status, 'SIGNED_OUT');
    assert.equal(useAuthStore.getState().sessionUserId, null);
    assert.equal(useUserStore.getState().userId, '');
  } finally {
    resetAuthAdapter();
    resetCustomerSessionData();
  }
});

test('AUTH-V1: Friday login and signup UI use password auth, not OTP', () => {
  const login = fs.readFileSync(path.resolve('app/(auth)/login.tsx'), 'utf8');
  const signup = fs.readFileSync(path.resolve('app/(auth)/signup.tsx'), 'utf8');
  const layout = fs.readFileSync(path.resolve('app/(auth)/_layout.tsx'), 'utf8');

  assert.ok(signup.includes('Create Account'));
  assert.ok(signup.includes('FIRST NAME'));
  assert.ok(signup.includes('LAST NAME'));
  assert.ok(signup.includes('EMAIL ADDRESS'));
  assert.ok(signup.includes('PASSWORD'));
  assert.ok(signup.includes('createPasswordAccount'));
  assert.ok(!signup.includes('sendEmailOtp'));
  assert.ok(!signup.includes('verify-otp'));

  assert.ok(login.includes('signInWithPassword'));
  assert.ok(login.includes('Sign In'));
  assert.ok(login.includes('New to Derive? Create account'));
  assert.ok(!login.includes('sendEmailOtp'));
  assert.ok(!login.includes('verify-otp'));
  assert.ok(!login.includes('6-digit'));
  assert.ok(!login.includes('No password needed'));
  assert.ok(!login.includes('Forgot password'));

  assert.ok(layout.includes('signup'));
});

test('AUTH-V1: new accounts map to membership none and cannot self-activate', () => {
  const mapped = mapDbBootstrapState('usr_new', { id: 'usr_new' }, { onboarding_completed: false }, []);
  assert.equal(mapped.membershipStatus, 'none');
  assert.equal(mapped.profileExists, true);

  const authClient = fs.readFileSync(path.resolve('src/services/authClient.ts'), 'utf8');
  assert.ok(!authClient.includes("membershipStatus: 'active'"));
  assert.ok(!authClient.includes('createMembershipCheckout'));

  const membershipScreen = fs.readFileSync(path.resolve('app/membership/index.tsx'), 'utf8');
  assert.ok(membershipScreen.includes('refreshCustomerBootstrap'));
  assert.ok(membershipScreen.includes('usesConciergeMembershipAccess'));
  assert.ok(membershipScreen.includes('Try Again'));
  assert.ok(!membershipScreen.toLowerCase().includes('zelle'));
  assert.ok(!membershipScreen.toLowerCase().includes('venmo'));
  assert.ok(!membershipScreen.toLowerCase().includes('cash app'));
  assert.ok(membershipScreen.includes('createMembershipCheckoutSession'));
});

test('AUTH-V1: remote-staging uses concierge access; production keeps Stripe presentation', () => {
  assert.equal(usesConciergeMembershipAccess('remote-staging'), true);
  assert.equal(shouldOfferStripeMembershipCheckout('remote-staging'), false);
  assert.equal(usesConciergeMembershipAccess('production'), false);
  assert.equal(shouldOfferStripeMembershipCheckout('production'), true);
  assert.equal(usesConciergeMembershipAccess('development'), false);
  assert.equal(shouldOfferStripeMembershipCheckout('development'), true);

  const eas = JSON.parse(fs.readFileSync(path.resolve('eas.json'), 'utf8'));
  assert.equal(eas.build['remote-staging'].env.EXPO_PUBLIC_USE_REMOTE_SERVICE, 'true');
  assert.equal(eas.build['remote-staging'].environment, 'preview');
  assert.equal(eas.build.development.env.EXPO_PUBLIC_USE_REMOTE_SERVICE, 'false');
  assert.equal(eas.build.production.env.EXPO_PUBLIC_USE_REMOTE_SERVICE, 'false');
});

test('AUTH-V1: password and token values are not logged', () => {
  const files = [
    'src/services/authClient.ts',
    'app/(auth)/login.tsx',
    'app/(auth)/signup.tsx',
    'src/utils/customerErrors.ts',
  ];
  for (const relPath of files) {
    const source = fs.readFileSync(path.resolve(relPath), 'utf8');
    for (const line of source.split('\n')) {
      if (!line.includes('console.')) continue;
      assert.ok(
        !/\b(input\.password|\bpassword)\s*[,)]/.test(line),
        `${relPath} must not log password values: ${line.trim()}`,
      );
      assert.ok(
        !/\b(access_token|refresh_token)\s*[,)]/.test(line),
        `${relPath} must not log tokens: ${line.trim()}`,
      );
    }
  }
});
