import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  claimExternalBetaAccess,
  elevateRemoteStagingBetaAccess,
  resetExternalBetaClaimClientForTests,
  setExternalBetaClaimClientForTests,
  shouldAutoClaimExternalBeta,
} from '../src/services/freeBetaAccess.ts';
import { CUSTOMER_ERROR_MESSAGES } from '../src/utils/customerErrors.ts';
import type { CustomerBootstrapState } from '../src/domain/types.ts';

function state(overrides: Partial<CustomerBootstrapState> = {}): CustomerBootstrapState {
  return {
    userId: 'usr_none',
    profileExists: true,
    onboardingCompleted: false,
    membershipStatus: 'none',
    ...overrides,
  };
}

test('Build 9: only a remote-staging account with no membership auto-claims', () => {
  const base = {
    buildFlavor: 'remote-staging' as const,
    remoteEnabled: true,
    sessionUserId: 'usr_none',
    state: state(),
  };
  assert.equal(shouldAutoClaimExternalBeta(base), true);
  assert.equal(shouldAutoClaimExternalBeta({ ...base, buildFlavor: 'production' }), false);
  assert.equal(shouldAutoClaimExternalBeta({ ...base, buildFlavor: 'development' }), false);
  assert.equal(shouldAutoClaimExternalBeta({ ...base, remoteEnabled: false }), false);
  assert.equal(shouldAutoClaimExternalBeta({ ...base, sessionUserId: 'usr_other' }), false);
  assert.equal(shouldAutoClaimExternalBeta({ ...base, state: state({ membershipStatus: 'active' }) }), false);
  assert.equal(shouldAutoClaimExternalBeta({ ...base, state: state({ membershipStatus: 'paused' }) }), false);
  assert.equal(shouldAutoClaimExternalBeta({ ...base, state: state({ membershipStatus: 'cancelled' }) }), false);
  assert.equal(shouldAutoClaimExternalBeta({ ...base, state: state({ profileExists: false }) }), false);
});

test('Build 9: a none account re-reads canonical active access and does not invent it locally', async () => {
  let claims = 0;
  const reads: string[] = [];
  const result = await elevateRemoteStagingBetaAccess({
    buildFlavor: 'remote-staging',
    remoteEnabled: true,
    sessionUserId: 'usr_none',
    state: state(),
    claim: async () => {
      claims += 1;
      return { success: true };
    },
    reread: async () => {
      reads.push('usr_none');
      return state({ membershipStatus: 'active' });
    },
    isCurrent: () => true,
  });
  assert.equal(result.status, 'active');
  if (result.status === 'active') assert.equal(result.state.membershipStatus, 'active');
  assert.equal(claims, 1);
  assert.deepEqual(reads, ['usr_none']);
});

test('Build 9: active, paused, cancelled, production, and stale results do not unlock the wrong user', async () => {
  let claims = 0;
  const claim = async () => {
    claims += 1;
    return { success: true };
  };
  for (const membershipStatus of ['active', 'paused', 'cancelled'] as const) {
    const result = await elevateRemoteStagingBetaAccess({
      buildFlavor: 'remote-staging',
      remoteEnabled: true,
      sessionUserId: 'usr_none',
      state: state({ membershipStatus }),
      claim,
      reread: async () => state({ membershipStatus: 'active' }),
      isCurrent: () => true,
    });
    assert.equal(result.status, 'unchanged');
  }
  const production = await elevateRemoteStagingBetaAccess({
    buildFlavor: 'production',
    remoteEnabled: true,
    sessionUserId: 'usr_none',
    state: state(),
    claim,
    reread: async () => state({ membershipStatus: 'active' }),
    isCurrent: () => true,
  });
  assert.equal(production.status, 'unchanged');
  assert.equal(claims, 0);

  const stale = await elevateRemoteStagingBetaAccess({
    buildFlavor: 'remote-staging',
    remoteEnabled: true,
    sessionUserId: 'usr_none',
    state: state(),
    claim,
    reread: async () => state({ userId: 'usr_other', membershipStatus: 'active' }),
    isCurrent: () => true,
  });
  assert.equal(stale.status, 'stale');
});

test('Build 9: a failed or non-active reread stays closed', async () => {
  const failed = await elevateRemoteStagingBetaAccess({
    buildFlavor: 'remote-staging',
    remoteEnabled: true,
    sessionUserId: 'usr_none',
    state: state(),
    claim: async () => ({ success: false }),
    reread: async () => state({ membershipStatus: 'active' }),
    isCurrent: () => true,
  });
  assert.equal(failed.status, 'failed');

  const stillNone = await elevateRemoteStagingBetaAccess({
    buildFlavor: 'remote-staging',
    remoteEnabled: true,
    sessionUserId: 'usr_none',
    state: state(),
    claim: async () => ({ success: true }),
    reread: async () => state({ membershipStatus: 'none' }),
    isCurrent: () => true,
  });
  assert.equal(stillNone.status, 'failed');
});

test('Build 9: claim uses the authenticated RPC and hides backend errors', async () => {
  const calls: string[] = [];
  setExternalBetaClaimClientForTests({
    async rpc(name) {
      calls.push(name);
      return { data: { result: 'granted' }, error: null };
    },
  });
  const ok = await claimExternalBetaAccess();
  assert.equal(ok.success, true);
  assert.deepEqual(calls, ['claim_external_beta_access']);

  setExternalBetaClaimClientForTests({
    async rpc() {
      return { data: null, error: { name: 'PostgrestError' } };
    },
  });
  const hidden = await claimExternalBetaAccess();
  assert.equal(hidden.success, false);
  assert.equal(hidden.error, CUSTOMER_ERROR_MESSAGES.beta_access);
  assert.equal(hidden.error?.includes('Postgrest'), false);
  resetExternalBetaClaimClientForTests();
});

test('Build 9: fallback copy no longer waits for founder activation', () => {
  const membership = fs.readFileSync(path.resolve('app/membership/index.tsx'), 'utf8');
  const client = fs.readFileSync(path.resolve('src/services/deriveClient.ts'), 'utf8');
  assert.ok(membership.includes('Try Again'));
  assert.ok(membership.includes("We couldn't finish opening your beta access automatically."));
  assert.ok(!membership.includes('activated by the Derive team'));
  assert.ok(membership.includes('Delete Account'));
  assert.ok(membership.includes('PublicLegalLinks'));
  assert.ok(!membership.includes('$25'));
  assert.ok(client.includes('elevateRemoteStagingBetaAccess'));
  assert.ok(!client.includes("membershipStatus: 'active'"));
});
