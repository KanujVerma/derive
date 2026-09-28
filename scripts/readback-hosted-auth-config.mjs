#!/usr/bin/env node
/** Read-only, sanitized Auth settings inventory for the one intended hosted project. */
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const PROJECT_REF = 'snojlbqovlawewwqbviz';
const CONFIG_URL = `https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`;
const MAX_RESPONSE_BYTES = 256 * 1024;

function booleanField(config, name) {
  if (typeof config[name] !== 'boolean') throw new Error('INVALID_AUTH_CONFIG');
  return config[name];
}

/** The Management API also returns secrets. Project only these non-secret fields. */
export function summarizeHostedAuthConfig(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error('INVALID_AUTH_CONFIG');
  }
  const signupDisabled = booleanField(config, 'disable_signup');
  const anonymousEnabled = booleanField(config, 'external_anonymous_users_enabled');
  const captchaEnabled = booleanField(config, 'security_captcha_enabled');
  const anonymousHourlyIpLimit = config.rate_limit_anonymous_users;
  if (!Number.isSafeInteger(anonymousHourlyIpLimit) || anonymousHourlyIpLimit < 0) {
    throw new Error('INVALID_AUTH_CONFIG');
  }
  const knownProvider = config.security_captcha_provider;
  return {
    schemaVersion: 1,
    scope: 'READ_ONLY_HOSTED_AUTH_SETTINGS_NOT_CHALLENGE_OR_RELEASE_PROOF',
    hostedProjectRef: PROJECT_REF,
    authConfigReadback: 'OBSERVED',
    signupDisabled,
    anonymousEnabled,
    anonymousHourlyIpLimit,
    captchaEnabled,
    captchaProvider: captchaEnabled
      ? (knownProvider === 'turnstile' || knownProvider === 'hcaptcha' ? knownProvider : 'UNKNOWN')
      : 'NOT_APPLICABLE',
    challengeTested: false,
    endpointAbuseTested: false,
    activation: { ready: false, status: 'BLOCKED', reason: 'OTHER_HOSTED_AND_PHYSICAL_GATES_NOT_EVALUATED' },
  };
}

async function boundedJson(response) {
  if (!response.ok || !response.body) throw new Error('AUTH_CONFIG_READBACK_FAILED');
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) throw new Error('AUTH_CONFIG_TOO_LARGE');
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
}

export async function readbackHostedAuthConfig({
  token = process.env.SUPABASE_ACCESS_TOKEN,
  fetchImpl = fetch,
} = {}) {
  if (typeof token !== 'string' || !token.trim()) throw new Error('AUTH_READ_TOKEN_REQUIRED');
  const response = await fetchImpl(CONFIG_URL, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    redirect: 'error',
    cache: 'no-store',
    signal: AbortSignal.timeout(20_000),
  });
  return summarizeHostedAuthConfig(await boundedJson(response));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    process.stdout.write(`${JSON.stringify(await readbackHostedAuthConfig(), null, 2)}\n`);
  } catch {
    // Never print raw Management API responses/errors; Auth config may include secrets.
    process.stdout.write(`${JSON.stringify({
      schemaVersion: 1,
      scope: 'READ_ONLY_HOSTED_AUTH_SETTINGS',
      hostedProjectRef: PROJECT_REF,
      authConfigReadback: 'UNKNOWN',
      activation: { ready: false, status: 'BLOCKED' },
    })}\n`);
    process.exitCode = 2;
  }
}
