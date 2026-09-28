import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { PROJECT_REF, readbackHostedAuthConfig, summarizeHostedAuthConfig } from '../scripts/readback-hosted-auth-config.mjs';

const config = {
  disable_signup: false,
  external_anonymous_users_enabled: false,
  rate_limit_anonymous_users: 30,
  security_captcha_enabled: false,
  security_captcha_provider: 'turnstile',
  security_captcha_secret: 'must-never-appear',
  smtp_pass: 'also-secret',
};

test('reports only safe fields and never equates observed settings with activation', () => {
  const result = summarizeHostedAuthConfig(config);
  assert.equal(result.hostedProjectRef, PROJECT_REF);
  assert.equal(result.anonymousEnabled, false);
  assert.equal(result.anonymousHourlyIpLimit, 30);
  assert.equal(result.captchaProvider, 'NOT_APPLICABLE');
  assert.equal(result.activation.ready, false);
  assert.doesNotMatch(JSON.stringify(result), /must-never-appear|also-secret|smtp|security_captcha_secret/);
});

test('enabled CAPTCHA reports only a known provider, without claiming challenge proof', () => {
  const enabled = summarizeHostedAuthConfig({ ...config, security_captcha_enabled: true });
  assert.equal(enabled.captchaProvider, 'turnstile');
  assert.equal(enabled.challengeTested, false);
  assert.equal(summarizeHostedAuthConfig({ ...config, security_captcha_enabled: true, security_captcha_provider: 'future-provider' }).captchaProvider, 'UNKNOWN');
});

test('missing or malformed safety fields fail closed', () => {
  for (const bad of [
    null, [], {},
    { ...config, disable_signup: 'false' },
    { ...config, external_anonymous_users_enabled: null },
    { ...config, security_captcha_enabled: undefined },
    { ...config, rate_limit_anonymous_users: -1 },
    { ...config, rate_limit_anonymous_users: 1.5 },
  ]) assert.throws(() => summarizeHostedAuthConfig(bad));
});

test('uses one fixed read-only endpoint and never returns raw sensitive response', async () => {
  let calls = 0;
  const result = await readbackHostedAuthConfig({
    token: 'private-test-token',
    fetchImpl: async (url: URL | RequestInfo, options?: RequestInit) => {
      calls++;
      assert.equal(String(url), `https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`);
      assert.equal(options?.method, 'GET');
      assert.equal(options?.redirect, 'error');
      assert.equal((options?.headers as Record<string, string>).Authorization, 'Bearer private-test-token');
      return new Response(JSON.stringify(config), { status: 200 });
    },
  });
  assert.equal(calls, 1);
  assert.doesNotMatch(JSON.stringify(result), /private-test-token|must-never-appear|also-secret/);
});

test('missing token, HTTP errors, malformed and oversized responses do not become observations', async () => {
  await assert.rejects(readbackHostedAuthConfig({ token: '' }));
  for (const response of [
    new Response('secret auth error', { status: 403 }),
    new Response('{not json', { status: 200 }),
    new Response(JSON.stringify({ ...config, smtp_pass: 'x'.repeat(300_000) }), { status: 200 }),
  ]) {
    await assert.rejects(readbackHostedAuthConfig({ token: 'test', fetchImpl: async () => response }));
  }
});

test('CLI source has no hosted write path or raw response logging', () => {
  const source = readFileSync(new URL('../scripts/readback-hosted-auth-config.mjs', import.meta.url), 'utf8');
  assert.match(source, /method: 'GET'/);
  assert.match(source, /PROJECT_REF = 'snojlbqovlawewwqbviz'/);
  assert.doesNotMatch(source, /method: 'PATCH'|method: 'POST'|writeFile|console\.log|console\.error/);
});
