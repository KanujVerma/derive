import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { publicLegalLinks } from '../src/config/environment.ts';
import {
  deriveVersionLabel,
  getAccountSettingsPresentation,
} from '../src/components/account/accountSettingsPresentation.ts';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('preview, anonymous, and permanent account settings stay distinct', () => {
  const preview = getAccountSettingsPresentation({ kind: 'preview' });
  assert.equal(preview.accountTitle, 'No account connected');
  assert.match(preview.accountSubtitle, /development preview/);
  assert.equal(preview.showSignOut, false);
  assert.equal(preview.showDelete, false);

  const anonymous = getAccountSettingsPresentation({ kind: 'anonymous' });
  assert.equal(anonymous.accountTitle, 'Using Derive without an account');
  assert.match(anonymous.accountFooter ?? '', /may not be recoverable/);
  assert.equal(anonymous.showSignOut, false);
  assert.equal(anonymous.deleteLabel, 'Delete Derive data');

  const permanent = getAccountSettingsPresentation({ kind: 'permanent', email: 'member@example.com' });
  assert.equal(permanent.accountTitle, 'member@example.com');
  assert.equal(permanent.accountSubtitle, 'Signed in');
  assert.equal(permanent.showSignOut, true);
  assert.equal(permanent.deleteLabel, 'Delete account');

  const unsigned = getAccountSettingsPresentation({ kind: 'permanent', email: '  ' });
  assert.equal(unsigned.accountTitle, 'Signed in');
  assert.equal(unsigned.accountSubtitle, '');
});

test('account links and version use the configured Derive surfaces', () => {
  const preview = read('src/components/account/PreviewAccountShell.tsx');
  const free = read('src/components/account/FreeAccountShell.tsx');
  const shell = read('src/components/account/AccountSettingsShell.tsx');
  const profile = read('app/profile/index.tsx');
  for (const source of [preview, free]) {
    assert.match(source, /publicLegalLinks\.privacyUrl/);
    assert.match(source, /publicLegalLinks\.privacyChoicesUrl/);
    assert.match(source, /publicLegalLinks\.supportUrl/);
  }
  assert.equal(publicLegalLinks.privacyUrl, 'https://derive-beta-site.vercel.app/privacy');
  assert.equal(publicLegalLinks.privacyChoicesUrl, 'https://derive-beta-site.vercel.app/privacy-choices');
  assert.equal(publicLegalLinks.supportUrl, 'https://derive-beta-site.vercel.app/support');
  assert.match(shell, /expoConfig\?\.version/);
  assert.doesNotMatch(shell, /nativeApplicationVersion|nativeBuildVersion/);
  assert.equal(deriveVersionLabel('1.0.0'), 'Derive 1.0.0');
  assert.match(profile, /scanner_first_preview'\) return <PreviewAccountShell/);
  assert.match(profile, /FreeAccountShell/);
  assert.match(profile, /LegacyProfileScreen/);
  assert.doesNotMatch(read('src/components/account/accountSettingsPresentation.ts'), /Save your account|Save account/);
});
