#!/usr/bin/env node
/** Exact-project read-only inventory. Never applies SQL, deploys, or changes Auth. */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readbackHostedMigrationInventory } from './readback-hosted-migration-inventory.mjs';
import { readbackHostedFunctionInventory } from './readback-hosted-function-inventory.mjs';
import { readbackHostedAuthConfig } from './readback-hosted-auth-config.mjs';
import { readbackCatalogEvidence } from './readback-catalog-evidence.mjs';

const exec = promisify(execFile);
export const PROJECT_REF = 'snojlbqovlawewwqbviz';
const COUNT_FIELDS = ['catalog_products_total', 'catalog_variants_total', 'catalog_identifiers_total', 'catalog_formulas_total'];
export const CATALOG_COUNTS_SQL = `select
 (select count(*)::integer from public.products where is_catalog_standard is true) as catalog_products_total,
 (select count(*)::integer from public.product_variants v join public.products p on p.id=v.product_id where p.is_catalog_standard is true) as catalog_variants_total,
 (select count(*)::integer from public.product_identifiers i join public.product_variants v on v.id=i.variant_id join public.products p on p.id=v.product_id where p.is_catalog_standard is true) as catalog_identifiers_total,
 (select count(*)::integer from public.product_formula_versions f join public.product_variants v on v.id=f.variant_id join public.products p on p.id=v.product_id where p.is_catalog_standard is true) as catalog_formulas_total;`;

export function sanitizeCatalogCounts(parsed) {
  if (!Array.isArray(parsed?.rows) || parsed.rows.length !== 1) throw new Error('INVALID_COUNT_RECEIPT');
  const row = parsed.rows[0];
  if (!row || COUNT_FIELDS.some(key => !Number.isSafeInteger(row[key]) || row[key] < 0)) throw new Error('INVALID_COUNT_RECEIPT');
  return Object.fromEntries(COUNT_FIELDS.map(key => [key, row[key]]));
}

/** Only changed Auth booleans are direct remote facts; absence is not proof of a default. */
export function sanitizeAuthDrift(parsed) {
  if (!Array.isArray(parsed?.changes)) throw new Error('INVALID_CONFIG_RECEIPT');
  const allow = new Set(['auth.enable_anonymous_sign_ins', 'auth.enable_signup', 'auth.email.enable_signup', 'auth.email.enable_confirmations', 'auth.email.smtp.enabled']);
  const observedFlags = {};
  for (const change of parsed.changes) {
    const key = Array.isArray(change?.path) ? change.path.join('.') : '';
    if (allow.has(key) && typeof change.remote === 'boolean') observedFlags[key] = change.remote;
  }
  return {
    observedFlags,
    signupConfiguration: Object.hasOwn(observedFlags, 'auth.enable_signup') ? 'OBSERVED_PARTIAL' : 'UNKNOWN',
    confirmationConfiguration: Object.hasOwn(observedFlags, 'auth.email.enable_confirmations') ? 'OBSERVED_PARTIAL' : 'UNKNOWN',
    customSmtp: Object.hasOwn(observedFlags, 'auth.email.smtp.enabled') ? (observedFlags['auth.email.smtp.enabled'] ? 'ENABLED' : 'DISABLED') : 'UNKNOWN',
    emailDeliveryTested: false,
    templateBodyVerified: false,
  };
}

/** Public Auth /settings is direct runtime authority for signup/confirmation flags, not SMTP delivery. */
export function summarizePublicAuthSettings(parsed) {
  if (!parsed || typeof parsed.disable_signup !== 'boolean' || typeof parsed.mailer_autoconfirm !== 'boolean'
    || typeof parsed.external?.email !== 'boolean' || typeof parsed.external?.anonymous_users !== 'boolean') throw new Error('INVALID_PUBLIC_AUTH_SETTINGS');
  return {
    signupEnabled: !parsed.disable_signup,
    mailerAutoconfirm: parsed.mailer_autoconfirm,
    confirmEmailEnabled: !parsed.mailer_autoconfirm,
    emailProviderEnabled: parsed.external.email,
    anonymousEnabled: parsed.external.anonymous_users,
    customSmtp: 'UNKNOWN', emailDeliveryTested: false, templateBodyVerified: false,
  };
}

async function readbackPublicAuthSettings(cwd) {
  const keys = await command(['projects', 'api-keys', '--project-ref', PROJECT_REF, '--output', 'json'], cwd);
  if (!Array.isArray(keys)) throw new Error('PUBLIC_KEY_UNAVAILABLE');
  // CLI may return other keys. Never expose, persist or use a service-role key.
  const publicKey = keys.find(row => row?.name === 'anon' || row?.type === 'publishable')?.api_key;
  if (typeof publicKey !== 'string' || !publicKey) throw new Error('PUBLIC_KEY_UNAVAILABLE');
  const response = await fetch(`https://${PROJECT_REF}.supabase.co/auth/v1/settings`, {
    method: 'GET', headers: { apikey: publicKey }, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15000),
  });
  if (!response.ok || !response.body) throw new Error('PUBLIC_AUTH_READBACK_FAILED');
  const reader = response.body.getReader(); const chunks = []; let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      bytes += value.byteLength; if (bytes > 65536) throw new Error('PUBLIC_AUTH_RESPONSE_TOO_LARGE'); chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  return summarizePublicAuthSettings(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))));
}

async function command(args, cwd) {
  const { stdout } = await exec('supabase', args, { cwd, timeout: 60000, maxBuffer: 1024 * 1024, encoding: 'utf8' });
  return JSON.parse(stdout);
}
async function safeRead(reader) {
  try { return { readback: 'OBSERVED', receipt: await reader() }; }
  catch { return { readback: 'UNKNOWN' }; } // CLI/API errors can contain private config: never echo.
}

export async function scannerHostedReadiness(cwd = process.cwd()) {
  const { stdout: revision } = await exec('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' });
  if (!/^[a-f\d]{40}\s*$/i.test(revision)) throw new Error('INVALID_SOURCE_REVISION');
  const [migrations, functions, auth, authDrift, publicAuth] = await Promise.all([
    safeRead(() => readbackHostedMigrationInventory(cwd)),
    safeRead(() => readbackHostedFunctionInventory(cwd)),
    safeRead(() => readbackHostedAuthConfig()),
    safeRead(async () => sanitizeAuthDrift(await command(['config', 'diff', '--project-ref', PROJECT_REF, '--output-format', 'json'], cwd))),
    safeRead(() => readbackPublicAuthSettings(cwd)),
  ]);
  // CLI database reads use an ephemeral login role. Keep them sequential to avoid role cleanup races.
  const catalogEvidence = await safeRead(() => readbackCatalogEvidence(PROJECT_REF, cwd));
  const catalogCounts = await safeRead(async () => sanitizeCatalogCounts(await command(['db', 'query', '--linked', '--project-ref', PROJECT_REF, '--output-format', 'json', CATALOG_COUNTS_SQL], cwd)));
  return {
    schemaVersion: 1, scope: 'READ_ONLY_SCANNER_HOSTED_INVENTORY_NOT_ACTIVATION_APPROVAL',
    hostedProjectRef: PROJECT_REF, sourceRevision: revision.trim(), observedAt: new Date().toISOString(),
    migrations, functions, catalogEvidence, catalogCounts, auth, authDrift, publicAuth,
    activation: { ready: false, status: 'BLOCKED', reason: 'SCHEMA_RUNTIME_EMAIL_COVERAGE_AND_PHYSICAL_GATES_REQUIRE_SEPARATE_ACCEPTANCE' },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.length !== 3 || process.argv[2] !== '--read-only') {
    process.stdout.write('Usage: node scripts/readback-scanner-hosted-readiness.mjs --read-only\n');
    process.exitCode = 2;
  } else {
    try { process.stdout.write(`${JSON.stringify(await scannerHostedReadiness(), null, 2)}\n`); }
    catch { process.stdout.write('{"readback":"UNKNOWN","activation":{"ready":false,"status":"BLOCKED"}}\n'); process.exitCode = 2; }
  }
}
