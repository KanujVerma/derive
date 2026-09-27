import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
/** Specific P0-D observations. Evidence completeness is a review input, never release authorization. */
export const LOCAL_CHECKS = ['guest_free_entry', 'catalog_search', 'useful_unknown', 'immutable_facts', 'optional_context', 'personal_decision', 'routine_history', 'explicit_my_stuff', 'repeat_check', 'owner_isolation', 'customer_deletion', 'fixture_cleanup'] as const;
const customer = ['fresh_install', 'guest_free_entry', 'single_camera_search', 'supported_facts_unknown', 'optional_personalization', 'personal_decision', 'routine_history', 'my_stuff_repeat_check', 'account_privacy_support'] as const;
export const REQUIRED_CHECKS: Record<string, readonly string[]> = {
 source: ['full_tests', 'app_types', 'test_types', 'web_export', 'scope_secret_review', 'exact_head_ci'],
 local_api: LOCAL_CHECKS,
 binary: ['build_identity', 'embedded_environment', 'no_dev_fixtures', 'adult_scope_offer'],
 simulator: customer,
 physical: [...customer, 'camera_permission_cancel_retry', 'small_screen_large_text'],
 hosted: ['guest_lifecycle', 'owner_isolation', 'private_evidence', 'customer_deletion', 'service_journey', 'support_privacy_reachable'],
 testflight: ['installed_candidate', 'embedded_environment', 'customer_journey'],
 human: ['eligible_unassisted_session', 'recommendation_understood', 'reason_understood', 'routine_change_understood', 'uncertainty_understood', 'next_step_understood'],
};
interface ObjectValue { [key: string]: unknown }
const object = (value: unknown, label: string): ObjectValue => { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`); return value as ObjectValue; };
const text = (value: unknown, label: string): string => { if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required`); return value; };
const sha = (value: unknown): string => { const result = text(value, 'source SHA'); if (!/^[a-f0-9]{40}$/.test(result)) throw new Error('source SHA must be a full commit'); return result; };
export function assertLocalRun(url: string, run: boolean): void {
 if (!run) throw new Error('Explicit --run is required; obtain the shared local-service lease first.');
 if (url !== 'http://127.0.0.1:54321') throw new Error('Refuse non-local or non-base Supabase URL.');
}
function environment(value: unknown): ObjectValue {
 const env = object(value, 'environment');
 if (env.kind === 'local') assertLocalRun(text(env.apiUrl, 'local API URL'), true);
 else if (env.kind === 'hosted') {
  const url = new URL(text(env.apiUrl, 'hosted API URL'));
  if (url.protocol !== 'https:' || !/^[a-z0-9-]+\.supabase\.co$/.test(url.hostname) || url.port || url.pathname !== '/' || url.search || url.hash || url.username || url.password) throw new Error('Expected exact hosted Supabase base URL');
 } else throw new Error('environment kind must be local or hosted');
 return env;
}
function binary(value: unknown): ObjectValue {
 const result = object(value, 'binary identity');
 for (const field of ['buildId', 'version', 'buildNumber', 'bundleIdentifier']) text(result[field], `binary ${field}`);
 return result;
}
function sameFields(left: ObjectValue, right: ObjectValue, fields: string[], label: string) { if (fields.some(field => left[field] !== right[field])) throw new Error(`${label} does not match intended candidate`); }
export function inspectCustomerRelease(manifestValue: unknown, current: { sha: string; dirty: boolean }, readArtifact: (path: string) => Uint8Array = readFileSync) {
 const manifest = object(manifestValue, 'manifest');
 if (manifest.version !== 1 || !Array.isArray(manifest.evidence)) throw new Error('Expected P0-D manifest version 1 and evidence array');
 const target = object(manifest.target, 'target'); const sourceSha = sha(target.sourceSha);
 if (current.dirty) throw new Error('A clean checkout is required to validate candidate evidence');
 if (current.sha !== sourceSha) throw new Error('Target source does not match inspected checkout');
 const targetEnvironment = environment(target.environment), targetBinary = binary(target.binary);
 const reports = new Map<string, { kind: string; status: string; fixtureMode: string; path: string; sha256: string; observedAt: string }>();
 for (const value of manifest.evidence) {
  const entry = object(value, 'artifact'); const kind = text(entry.kind, 'artifact kind');
  if (!Object.hasOwn(REQUIRED_CHECKS, kind) || reports.has(kind)) throw new Error('Unknown or duplicate artifact kind');
  const path = text(entry.path, 'artifact path'), hash = text(entry.sha256, 'artifact hash');
  if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error('artifact hash must be SHA-256');
  const bytes = readArtifact(path);
  if (createHash('sha256').update(bytes).digest('hex') !== hash) throw new Error(`artifact hash mismatch: ${kind}`);
  const report = object(JSON.parse(Buffer.from(bytes).toString('utf8')), 'artifact report');
  if (report.version !== 1 || report.kind !== kind) throw new Error(`artifact kind/version mismatch: ${kind}`);
  const source = object(report.source, 'artifact source');
  if (sha(source.sha) !== sourceSha || source.dirty !== false) throw new Error(`artifact source mismatch: ${kind}`);
  const observedAt = text(report.observedAt, 'observation date');
  if (!Number.isFinite(Date.parse(observedAt))) throw new Error('Invalid observation date');
  const fixtureMode = text(report.fixtureMode, 'fixture mode');
  if (kind === 'local_api') {
   const env = environment(report.environment); if (env.kind !== 'local' || report.binary !== null) throw new Error('local_api must identify actual local API and no binary');
   if (!['none', 'synthetic_catalog'].includes(fixtureMode)) throw new Error('local_api fixture mode must identify catalog fixtures');
  } else {
   if (fixtureMode !== 'none') throw new Error(`fixture evidence cannot clear ${kind}`);
   if (kind === 'hosted' && environment(report.environment).kind !== 'hosted') throw new Error('hosted evidence must name the actual hosted backend');
   if (kind !== 'source') {
    sameFields(environment(report.environment), targetEnvironment, ['kind', 'apiUrl'], 'artifact environment');
    sameFields(binary(report.binary), targetBinary, ['buildId', 'version', 'buildNumber', 'bundleIdentifier'], 'artifact binary');
   }
  }
  if (!Array.isArray(report.checks)) throw new Error('artifact checks missing');
  const checks = report.checks.map(value => object(value, 'check'));
  if (checks.some(check => typeof check.id !== 'string') || new Set(checks.map(check => check.id)).size !== checks.length) throw new Error('Duplicate or malformed checks');
  for (const id of REQUIRED_CHECKS[kind]) {
   const check = checks.find(check => check.id === id);
   if (!check || check.outcome !== 'passed' || typeof check.observation !== 'string' || !check.observation.trim()) throw new Error(`Required checks lack passed observations: ${kind}/${id}`);
  }
  reports.set(kind, { kind, status: 'evidence_present', fixtureMode, path, sha256: hash, observedAt });
 }
 const gates = Object.keys(REQUIRED_CHECKS).map(kind => reports.get(kind) ?? { kind, status: 'missing', fixtureMode: null });
 return { status: reports.size === Object.keys(REQUIRED_CHECKS).length ? 'REVIEW_REQUIRED' : 'INCOMPLETE', target, gates, limitation: 'Pinned records require independent review. This report does not authorize release or verify the truth of human observations.' };
}
