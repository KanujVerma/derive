import { z } from 'zod';
import { PartTwoExplanationPolicySchema } from '../../contracts/PartTwo.ts';
import { canonicalJson, sha256 } from './hash.ts';
import { GLYCERIN_REFERENCE_POLICY, GLYCERIN_REFERENCE_EXPLANATION } from './reference-inputs.ts';

const id = z.string().min(1).max(200);
const date = z.iso.datetime({ offset: false });
export const DictionaryReleaseSchema = z.strictObject({
  schemaVersion: z.literal(1), version: id, contentHash: z.string().regex(/^[a-f0-9]{64}$/), releaseGate: z.enum(['local_only', 'reviewed_public']), explanationVersion: id,
  provenance: z.strictObject({ source: z.string(), sourceUrl: z.url().nullable(), sourceRevision: id, importVersion: id, allowedFields: z.array(z.string()), policyId: id, operations: z.strictObject({ process: z.boolean(), store: z.boolean(), display: z.boolean(), export: z.boolean() }), attribution: z.string(), reviewedAt: date, reviewDecision: z.enum(['local_fixture_only', 'approved']), releaseOwner: id, rightsOwner: id, expiresAt: date.nullable(), revoked: z.boolean() }),
  identities: z.array(z.strictObject({ ingredientId: id, preferredName: z.string().min(1).max(2000), identityClass: z.enum(['substance', 'polymer', 'botanical_preparation', 'mixture', 'opaque_label_group']), nameSystem: z.string(), status: z.enum(['active', 'quarantined', 'superseded']), supersedesIds: z.array(id), externalReferences: z.array(z.strictObject({ namespace: z.enum(['CAS', 'EC', 'UNII', 'PubChem']), identifier: id, sourceUrl: z.url(), sourceRevision: id, relationship: z.enum(['same_declared_identity', 'related', 'definition_unverified']) })) })).max(10000),
  aliases: z.array(z.strictObject({ aliasRecordId: id, surface: z.string().min(1).max(2000), lookupKey: z.string(), ingredientId: id, language: z.string().nullable(), nameSystem: z.string(), relationship: z.literal('same_declared_identity'), rule: z.enum(['exact_name', 'reviewed_parenthetical_equivalence']), evidenceSource: id, reviewDecision: z.enum(['local_fixture_only', 'approved']), release: id, status: z.enum(['active', 'quarantined']) })).max(20000),
  explanationPolicies: z.array(PartTwoExplanationPolicySchema).max(1000),
  explanations: z.array(z.strictObject({ explanationId: id, revision: z.number().int().nonnegative(), ingredientId: id, language: z.string(), roleId: id, sentence: z.string().min(1).max(500), sourceUrl: z.url(), evidenceKind: z.enum(['source_inventory', 'reviewed_editorial']), ruleId: id, reviewDate: date, state: z.enum(['active', 'withdrawn']), policyId: id, dependencies: z.array(id), expiresAt: date, permissionApproved: z.boolean() })).max(10000),
});
export type DictionaryRelease = z.infer<typeof DictionaryReleaseSchema>;
export const LOOKUP_VERSION = 'lookup-nfc-case-space-v1';
export function lookupName(raw: string): { key: string; offsetMap: { normalizedStart: number; normalizedEnd: number; sourceStart: number; sourceEnd: number }[] } {
  const offsetMap: { normalizedStart: number; normalizedEnd: number; sourceStart: number; sourceEnd: number }[] = [];
  let key = '', cursor = 0;
  // Group combining marks with their preceding code point before NFC. Every
  // normalized UTF-16 unit points back to a complete original source cluster.
  const clusters = raw.matchAll(/\P{M}\p{M}*|\p{M}+/gu);
  let pendingSpaceStart = -1, pendingSpaceEnd = -1;
  for (const cluster of clusters) {
    const sourceStart = cluster.index!, sourceEnd = sourceStart + cluster[0].length;
    if (/^\s+$/u.test(cluster[0])) { if (key) { if (pendingSpaceStart < 0) pendingSpaceStart = sourceStart; pendingSpaceEnd = sourceEnd; } continue; }
    if (pendingSpaceStart >= 0) { offsetMap.push({ normalizedStart: cursor, normalizedEnd: cursor + 1, sourceStart: pendingSpaceStart, sourceEnd: pendingSpaceEnd }); key += ' '; cursor++; pendingSpaceStart = -1; pendingSpaceEnd = -1; }
    const normalized = cluster[0].normalize('NFC').toLowerCase();
    offsetMap.push({ normalizedStart: cursor, normalizedEnd: cursor + normalized.length, sourceStart, sourceEnd }); key += normalized; cursor += normalized.length;
  }
  return { key, offsetMap };
}
export function dictionaryReleaseHash(release: DictionaryRelease): string { const { contentHash: _hash, ...content } = release; return sha256(canonicalJson(content)); }
export function validateDictionaryRelease(value: unknown): DictionaryRelease {
  const release = DictionaryReleaseSchema.parse(value);
  if (release.contentHash !== dictionaryReleaseHash(release)) throw new Error('Dictionary content hash mismatch');
  if (release.provenance.revoked || !Object.values(release.provenance.operations).every(Boolean)) throw new Error('Dictionary permissions unavailable');
  if (release.releaseGate === 'reviewed_public' && release.provenance.reviewDecision !== 'approved') throw new Error('Public dictionary requires approved provenance');
  const identityIds = new Set(release.identities.map(i => i.ingredientId));
  if (identityIds.size !== release.identities.length || new Set(release.aliases.map(a => a.aliasRecordId)).size !== release.aliases.length) throw new Error('Duplicate dictionary record');
  const keys = new Map<string, string>();
  for (const alias of release.aliases) {
    if (!identityIds.has(alias.ingredientId) || alias.release !== release.version || alias.lookupKey !== lookupName(alias.surface).key) throw new Error('Invalid exact alias dependency');
    if (release.releaseGate === 'reviewed_public' && alias.reviewDecision !== 'approved') throw new Error('Unreviewed public alias');
    if (alias.status === 'active') { const prior = keys.get(alias.lookupKey); if (prior && prior !== alias.ingredientId) throw new Error('Alias collision quarantines release'); keys.set(alias.lookupKey, alias.ingredientId); }
  }
  for (const policy of release.explanationPolicies) { const { policyHash: _hash, ...content } = policy; if (sha256(canonicalJson(content)) !== policy.policyHash) throw new Error('Explanation policy hash mismatch'); }
  for (const explanation of release.explanations) if (!identityIds.has(explanation.ingredientId) || !release.explanationPolicies.some(policy => policy.policyId === explanation.policyId) || !explanation.dependencies.includes(explanation.policyId) || !explanation.dependencies.every(dep => identityIds.has(dep) || release.aliases.some(a => a.aliasRecordId === dep) || release.explanationPolicies.some(policy => policy.policyId === dep))) throw new Error('Missing explanation dependency');
  return deepFreeze(release);
}
export function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) deepFreeze(child); Object.freeze(value); } return value;
}

// Original fixture vocabulary only. No external glossary/registry/card database
// was imported. Production activation requires a separately adjudicated release.
const names: [string, string, DictionaryRelease['identities'][number]['identityClass']][] = [
  ['water', 'Aqua', 'substance'], ['niacinamide', 'Niacinamide', 'substance'], ['glycerin', 'Glycerin', 'substance'], ['hexanediol', '1,2-Hexanediol', 'substance'], ['retinol', 'Retinol', 'substance'], ['retinyl-palmitate', 'Retinyl Palmitate', 'substance'], ['hyaluronic-acid', 'Hyaluronic Acid', 'substance'], ['sodium-hyaluronate', 'Sodium Hyaluronate', 'substance'], ['alcohol', 'Alcohol', 'substance'], ['alcohol-denat', 'Alcohol Denat.', 'mixture'], ['cetyl-alcohol', 'Cetyl Alcohol', 'substance'], ['benzyl-alcohol', 'Benzyl Alcohol', 'substance'], ['parfum', 'Parfum', 'opaque_label_group'], ['peg-8', 'PEG-8', 'polymer'], ['peg-80', 'PEG-80', 'polymer'], ['salicylic-acid', 'Salicylic Acid', 'substance'], ['ci-77491', 'CI 77491', 'substance'], ['ci-77492', 'CI 77492', 'substance'], ['acrylates-crosspolymer', 'Acrylates/C10-30 Alkyl Acrylate Crosspolymer', 'polymer'], ['aloe-leaf-extract', 'Aloe Barbadensis Leaf Extract', 'botanical_preparation'],
];
const releaseVersion = 'derive-local-exact-v2';
const aliases: DictionaryRelease['aliases'] = names.map(([ingredientId, surface]) => ({ aliasRecordId: `name:${ingredientId}`, surface, lookupKey: lookupName(surface).key, ingredientId, language: null, nameSystem: 'literal_label_fixture', relationship: 'same_declared_identity', rule: 'exact_name', evidenceSource: 'derive-original-fixture-v1', reviewDecision: 'local_fixture_only', release: releaseVersion, status: 'active' }));
for (const surface of ['Water', 'Eau', 'Aqua (Water, Eau)']) aliases.push({ ...aliases[0], aliasRecordId: `water:${surface}`, surface, lookupKey: lookupName(surface).key, rule: surface.includes('(') ? 'reviewed_parenthetical_equivalence' : 'exact_name' });
const localRelease = { schemaVersion: 1, version: releaseVersion, contentHash: '0000000000000000000000000000000000000000000000000000000000000000', releaseGate: 'local_only', explanationVersion: 'glycerin-reference-v1', provenance: { source: 'Derive original synthetic exact-name fixture vocabulary; no external import', sourceUrl: null, sourceRevision: 'derive-original-fixture-v1', importVersion: 'no-import-v1', allowedFields: ['names', 'exact_aliases'], policyId: 'local-fixture-only-v1', operations: { process: true, store: true, display: true, export: true }, attribution: 'Derive original synthetic fixture vocabulary', reviewedAt: '2026-10-02T00:00:00Z', reviewDecision: 'local_fixture_only', releaseOwner: 'pending-founder-adjudication', rightsOwner: 'pending-source-release-review', expiresAt: null, revoked: false }, identities: names.map(([ingredientId, preferredName, identityClass]) => ({ ingredientId, preferredName, identityClass, nameSystem: 'literal_label_fixture', status: 'active', supersedesIds: [], externalReferences: [] })), aliases, explanationPolicies: [GLYCERIN_REFERENCE_POLICY], explanations: [GLYCERIN_REFERENCE_EXPLANATION] } satisfies DictionaryRelease;
localRelease.contentHash = dictionaryReleaseHash(localRelease);
export const LOCAL_DICTIONARY_RELEASE = validateDictionaryRelease(localRelease);
