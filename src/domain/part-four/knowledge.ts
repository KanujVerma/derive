import { z } from 'zod';
import { IngredientKnowledgeCardSchema, PartFourSourceSchema, type IngredientKnowledgeCard } from '../../contracts/PartFour.ts';
import { LOCAL_DICTIONARY_RELEASE, deepFreeze, lookupName } from '../part-two/dictionary.ts';
import { canonicalJson, sha256 } from '../part-two/hash.ts';
import { APPROVED_CARD_TEXT } from './approved-card-text.ts';

export const INGREDIENT_KNOWLEDGE_VERSION = 'approved-37-v7/editorial-v1';
const digest = z.string().regex(/^[a-f0-9]{64}$/);
export const IngredientKnowledgeReleaseSchema = z.strictObject({
  version: z.string().min(1), contentHash: digest, releaseGate: z.literal('local_only'),
  provenance: z.strictObject({
    libraryFileId: z.literal('libfile_211e2d19dbe881918237cc72994ca091'), libraryVersion: z.literal(1),
    documentSha256: digest, handoffSha256: digest, ingredientSourceSha256: digest,
    sourceRevision: z.string().min(1), approvedOn: z.iso.date(), importVersion: z.literal('exact-approved-prose/v1'),
    reviewScope: z.literal('approved_editorial_local_only'), expiresAt: z.iso.datetime().nullable(), revoked: z.boolean(),
  }),
  cards: z.array(IngredientKnowledgeCardSchema).max(1000),
  contributionKinds: z.record(z.string(), z.enum(['benefit','support','unknown'])),
  sources: z.array(PartFourSourceSchema).max(1000),
});
export type IngredientKnowledgeRelease = z.infer<typeof IngredientKnowledgeReleaseSchema>;
export interface KnowledgeLifecycle { now?: string; withdrawnDependencies?: readonly string[] }
const validatedReleases = new WeakSet<IngredientKnowledgeRelease>();

export function ingredientKnowledgeHash(release: IngredientKnowledgeRelease): string {
  const { contentHash: _hash, ...content } = release;
  return sha256(canonicalJson(content));
}

/** The local pack authorizes original approved prose, not a new clinical review.
 * IDs already in Part 2 are reused; new identities use literal name slugs. */
export function validateIngredientKnowledgeRelease(value: unknown): IngredientKnowledgeRelease {
  if (value && typeof value === 'object' && validatedReleases.has(value as IngredientKnowledgeRelease)) return value as IngredientKnowledgeRelease;
  const release = IngredientKnowledgeReleaseSchema.parse(value);
  if (release.contentHash !== ingredientKnowledgeHash(release)) throw Error('Ingredient knowledge content hash mismatch');
  const ids = new Set(release.cards.map(card => card.ingredientId));
  const sources = new Set(release.sources.map(source => source.id));
  if (ids.size !== release.cards.length || sources.size !== release.sources.length) throw Error('Duplicate ingredient/source record');
  const names = new Map<string,string>();
  for (const card of release.cards) {
    if (card.version !== release.version || !card.sourceIds.length || card.sourceIds.some(source => !sources.has(source))) throw Error('Invalid card version/source dependency');
    if (!(card.ingredientId in release.contributionKinds)) throw Error('Missing contribution kind');
    for (const surface of [card.name,...card.aliases]) {
      const key = lookupName(surface).key;
      const prior = names.get(key);
      if (prior && prior !== card.ingredientId) throw Error('Ingredient alias collision');
      names.set(key,card.ingredientId);
    }
  }
  if (Object.keys(release.contributionKinds).some(id => !ids.has(id))) throw Error('Foreign contribution identity');
  // Rehashing data does not constitute editorial approval. This import is scoped
  // to the exact 37-card source; new prose or aliases require a reviewed importer.
  if (release.cards.length !== Object.keys(APPROVED_CARD_TEXT).length || release.sources.length !== release.cards.length) throw Error('Incomplete approved source coverage');
  for (const card of release.cards) {
    const approved = APPROVED_CARD_TEXT[card.name as keyof typeof APPROVED_CARD_TEXT];
    if (!approved || card.ingredientId !== idFor(card.name) || ['short','label','body','detail','evidence'].some(field => card[field as 'body'] !== approved[field as 'body'])) throw Error('Card differs from exact approved prose/identity');
    const allowed = new Set(aliasesFor(card.name).map(surface => lookupName(surface).key));
    if (card.aliases.some(surface => !allowed.has(lookupName(surface).key))) throw Error('Unapproved alias in editorial release');
    if (release.contributionKinds[card.ingredientId] !== approved.kind || canonicalJson(card.sourceIds) !== canonicalJson([`ingredient-reference:${card.ingredientId}`]) || release.sources.find(source => source.id === card.sourceIds[0])?.url !== approved.source) throw Error('Card differs from approved source/contribution');
  }
  deepFreeze(release);
  validatedReleases.add(release);
  return release;
}

const aliasesFor = (name: string) => name === 'Water' ? ['Aqua','Eau','Aqua / Water / Eau'] : name === 'Ceramide EOP' ? ['Ceramide 1'] : [];
const idFor = (name: string) => name === 'Water' ? 'water' :
  LOCAL_DICTIONARY_RELEASE.identities.find(identity => lookupName(identity.preferredName).key === lookupName(name).key)?.ingredientId ??
  lookupName(name).key.replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const cards: IngredientKnowledgeCard[] = Object.entries(APPROVED_CARD_TEXT).map(([name, text]) => ({
  ingredientId: idFor(name), name, aliases: aliasesFor(name), short: text.short, label: text.label,
  body: text.body, detail: text.detail, evidence: text.evidence,
  sourceIds: [`ingredient-reference:${idFor(name)}`], version: INGREDIENT_KNOWLEDGE_VERSION,
}));
const release: IngredientKnowledgeRelease = {
  version: INGREDIENT_KNOWLEDGE_VERSION, contentHash: '0'.repeat(64), releaseGate: 'local_only',
  provenance: {
    libraryFileId: 'libfile_211e2d19dbe881918237cc72994ca091', libraryVersion: 1,
    documentSha256: '454bed78398c483ef3224f03efc12fb2dd1478d6cc6f80c12d5a2e22392ddd8e',
    handoffSha256: '2b6c2b0af8882a7c5d7fc92838c6ac489e1f2a718680b67f5b3d8f733420dc82',
    ingredientSourceSha256: 'a73cdd8a544e1c8246a75367c26a7668873f533e13e15f4c2bc2bd845a8ec35a',
    sourceRevision: '3a8546597643cf3869e891b4ba03aae17723c276', approvedOn: '2026-10-03',
    importVersion: 'exact-approved-prose/v1', reviewScope: 'approved_editorial_local_only', expiresAt: null, revoked: false,
  },
  cards,
  contributionKinds: Object.fromEntries(Object.entries(APPROVED_CARD_TEXT).map(([name,text]) => [idFor(name),text.kind])),
  sources: Object.entries(APPROVED_CARD_TEXT).map(([name,text]) => ({
    id: `ingredient-reference:${idFor(name)}`, title: `${name} ingredient reference`, url: text.source,
    // Day boundary encodes the accepted reference day; no new source review occurred.
    reviewedAt: '2026-10-03T00:00:00Z', kind: 'approved_editorial' as const,
  })),
};
release.contentHash = ingredientKnowledgeHash(release);
export const APPROVED_INGREDIENT_KNOWLEDGE = validateIngredientKnowledgeRelease(release);

export function ingredientKnowledgeAvailable(release: IngredientKnowledgeRelease, lifecycle: KnowledgeLifecycle = {}): boolean {
  const withdrawn = lifecycle.withdrawnDependencies ?? [];
  if (release.provenance.revoked || [release.version,release.contentHash,release.provenance.libraryFileId,release.provenance.documentSha256,release.provenance.handoffSha256].some(id => withdrawn.includes(id))) return false;
  if (release.provenance.expiresAt !== null && (!lifecycle.now || !Number.isFinite(Date.parse(lifecycle.now)) || Date.parse(lifecycle.now) >= Date.parse(release.provenance.expiresAt))) return false;
  return true;
}

/** Exact NFC/case/space lookup only. Never apply Part 2's wider alias inventory,
 * fuzzy matching, substring rules, family equivalences or punctuation removal. */
export function resolveIngredientKnowledge(name: string, value: IngredientKnowledgeRelease = APPROVED_INGREDIENT_KNOWLEDGE, lifecycle: KnowledgeLifecycle = {}): IngredientKnowledgeCard | null {
  let release: IngredientKnowledgeRelease;
  try { release = validateIngredientKnowledgeRelease(value); } catch { return null; }
  if (!ingredientKnowledgeAvailable(release,lifecycle)) return null;
  const key = lookupName(name).key;
  const card = release.cards.find(card => [card.name,...card.aliases].some(surface => lookupName(surface).key === key));
  const withdrawn = lifecycle.withdrawnDependencies ?? [];
  return card && ![card.ingredientId,...card.sourceIds].some(id => withdrawn.includes(id)) ? card : null;
}
