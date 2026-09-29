import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeAuthDrift, sanitizeCatalogCounts, summarizePublicAuthSettings, PROJECT_REF } from './readback-scanner-hosted-readiness.mjs';

test('fixed target and catalog counts omit arbitrary returned fields', () => {
  assert.equal(PROJECT_REF, 'snojlbqovlawewwqbviz');
  assert.deepEqual(sanitizeCatalogCounts({ rows: [{ catalog_products_total: 1, catalog_variants_total: 0, catalog_identifiers_total: 0, catalog_formulas_total: 0, secret: 'must-not-leave' }] }), { catalog_products_total: 1, catalog_variants_total: 0, catalog_identifiers_total: 0, catalog_formulas_total: 0 });
});
test('invalid, negative, missing and multiple count rows fail closed', () => {
  for (const value of [{ rows: [] }, { rows: [{}, {}] }, { rows: [{ catalog_products_total: -1 }] }, { rows: [{ catalog_products_total: '1' }] }]) assert.throws(() => sanitizeCatalogCounts(value));
});
test('Auth drift emits only exact allowed booleans, never host/password/template', () => {
  const result = sanitizeAuthDrift({ changes: [
    { path: ['auth', 'enable_anonymous_sign_ins'], remote: false },
    { path: ['auth', 'email', 'smtp', 'host'], remote: 'private-host' },
    { path: ['auth', 'email', 'smtp', 'pass'], remote: 'private-password' },
    { path: ['auth', 'email', 'template', 'magic_link', 'content'], remote: 'private-template' },
    { path: ['auth', 'email', 'smtp', 'enabled'], remote: 'true' },
  ] });
  assert.deepEqual(result.observedFlags, { 'auth.enable_anonymous_sign_ins': false });
  assert.equal(result.customSmtp, 'UNKNOWN');
  assert.doesNotMatch(JSON.stringify(result), /private-/);
});
test('absence of drift never asserts signup, confirmations, or SMTP delivery readiness', () => {
  const result = sanitizeAuthDrift({ changes: [] });
  assert.equal(result.signupConfiguration, 'UNKNOWN'); assert.equal(result.confirmationConfiguration, 'UNKNOWN');
  assert.equal(result.customSmtp, 'UNKNOWN'); assert.equal(result.emailDeliveryTested, false); assert.equal(result.templateBodyVerified, false);
});
test('observed custom SMTP boolean stays separate from end-to-end delivery', () => {
  const result = sanitizeAuthDrift({ changes: [{ path: ['auth', 'email', 'smtp', 'enabled'], remote: true }] });
  assert.equal(result.customSmtp, 'ENABLED'); assert.equal(result.emailDeliveryTested, false);
});
test('direct public Auth settings invert autoconfirm without inferring delivery', () => {
  const result = summarizePublicAuthSettings({ disable_signup: false, mailer_autoconfirm: true, external: { email: true, anonymous_users: false }, secret: 'must-not-leave' });
  assert.equal(result.signupEnabled, true); assert.equal(result.mailerAutoconfirm, true); assert.equal(result.confirmEmailEnabled, false);
  assert.equal(result.emailProviderEnabled, true); assert.equal(result.anonymousEnabled, false); assert.equal(result.customSmtp, 'UNKNOWN'); assert.equal(result.emailDeliveryTested, false);
  assert.doesNotMatch(JSON.stringify(result), /must-not-leave/);
});
test('direct confirmation-required and signup-disabled settings remain explicit', () => {
  const result = summarizePublicAuthSettings({ disable_signup: true, mailer_autoconfirm: false, external: { email: false, anonymous_users: true } });
  assert.equal(result.signupEnabled, false); assert.equal(result.confirmEmailEnabled, true); assert.equal(result.emailProviderEnabled, false); assert.equal(result.anonymousEnabled, true);
});
test('malformed public Auth settings do not default to a usable signup flow', () => {
  for (const value of [null, {}, { disable_signup: 'false', mailer_autoconfirm: true }, { disable_signup: false, mailer_autoconfirm: true, external: { email: true } }]) assert.throws(() => summarizePublicAuthSettings(value));
});
