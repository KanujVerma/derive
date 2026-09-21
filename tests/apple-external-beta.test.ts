import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { resolvePublicLegalLinks } from '../src/config/environment.ts';
import {
  showsProviderBetaFeatures,
  shouldOfferStripeMembershipCheckout,
  shouldOfferStripeMembershipManagement,
  usesFreeExternalBetaPresentation,
} from '../src/utils/membershipPresentation.ts';

const read = (rel: string) => fs.readFileSync(path.resolve(rel), 'utf8');

test('Build 8: remote-staging is a free beta and production keeps Stripe', () => {
  assert.equal(usesFreeExternalBetaPresentation('remote-staging'), true);
  assert.equal(showsProviderBetaFeatures('remote-staging'), false);
  assert.equal(shouldOfferStripeMembershipCheckout('remote-staging'), false);
  assert.equal(shouldOfferStripeMembershipManagement('remote-staging', true), false);
  assert.equal(usesFreeExternalBetaPresentation('production'), false);
  assert.equal(showsProviderBetaFeatures('production'), true);
  assert.equal(shouldOfferStripeMembershipCheckout('production'), true);
  assert.equal(shouldOfferStripeMembershipManagement('development', false), false);

  const links = resolvePublicLegalLinks('remote-staging');
  assert.equal(links.privacyUrl, 'https://derive-beta-site.vercel.app/privacy');
  assert.equal(links.supportUrl, 'https://derive-beta-site.vercel.app/support');
  assert.throws(
    () => resolvePublicLegalLinks('remote-staging', {
      privacyUrl: '',
      supportUrl: 'https://derive-beta-site.vercel.app/support',
      privacyChoicesUrl: '',
    }),
    /privacy URL/,
  );
  assert.throws(
    () => resolvePublicLegalLinks('remote-staging', {
      privacyUrl: 'http://example.com/privacy',
      supportUrl: 'https://derive-beta-site.vercel.app/support',
      privacyChoicesUrl: '',
    }),
    /HTTPS/,
  );
});

test('Build 8: inactive and active account surfaces can delete an account', () => {
  const membership = read('app/membership/index.tsx');
  const profile = read('app/profile/index.tsx');
  assert.ok(membership.includes('Delete Account'));
  assert.ok(membership.includes('confirmAndDeleteAccount'));
  assert.ok(profile.includes('Delete Account'));
  assert.ok(profile.includes('Delete your account?'));
  assert.ok(read('src/services/accountDeletion.ts').includes('DELETE_MY_DERIVE_ACCOUNT'));
  assert.ok(!membership.toLowerCase().includes('zelle'));
  assert.ok(!profile.toLowerCase().includes('venmo'));
});

test('Build 8: remote-staging hides price, Ask, and Scan entry points', () => {
  const files = [
    'app/membership/index.tsx',
    'app/profile/index.tsx',
    'app/(onboarding)/10-summary.tsx',
    'app/(tabs)/shop.tsx',
    'app/(tabs)/index.tsx',
    'app/(tabs)/_layout.tsx',
    'app/insights/[id].tsx',
    'app/(auth)/login.tsx',
    'app/(auth)/signup.tsx',
  ].map(read).join('\n');
  assert.ok(files.includes('usesFreeExternalBetaPresentation') || files.includes('showsProviderBetaFeatures') || files.includes('conciergeAccess'));
  assert.ok(read('app/(tabs)/_layout.tsx').includes('href: hideAsk ? null'));
  assert.ok(read('app/(tabs)/shop.tsx').includes('showProviderFeatures'));
  assert.ok(read('app/(tabs)/index.tsx').includes('showsProviderBetaFeatures'));
  assert.ok(read('app/profile/index.tsx').includes("freeBeta ? 'Support'"));
  assert.ok(!read('app/profile/index.tsx').includes("router.push('/(tabs)/ask')") || read('app/profile/index.tsx').includes('if (freeBeta)'));
  assert.ok(read('app/(auth)/login.tsx').includes('PublicLegalLinks'));
  assert.ok(read('app/membership/index.tsx').includes('PublicLegalLinks'));
  const eas = JSON.parse(read('eas.json'));
  assert.equal(eas.build['remote-staging'].env.EXPO_PUBLIC_USE_REMOTE_SERVICE, 'true');
  assert.equal(eas.build.production.env.EXPO_PUBLIC_USE_REMOTE_SERVICE, 'false');
  assert.equal(eas.build.development.env.EXPO_PUBLIC_USE_REMOTE_SERVICE, 'false');
});
