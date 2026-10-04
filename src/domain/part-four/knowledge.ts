import { z } from 'zod';
import { IngredientKnowledgeCardSchema, PartFourSourceSchema, EducationDocumentContextSchema, type IngredientKnowledgeCard } from '../../contracts/PartFour.ts';
import { LOCAL_DICTIONARY_RELEASE, deepFreeze, lookupName } from '../part-two/dictionary.ts';
import { canonicalJson, sha256 } from '../part-two/hash.ts';
import { APPROVED_CARD_TEXT } from './approved-card-text.ts';
import { APPROVED47_SOURCE, APPROVED47_PREPARATION_HASH } from './approved47-source.ts';
import { Candidate423ReleaseSchema, type Candidate423Release } from '../../contracts/IngredientEducation423Candidate.ts';
import { validate423Candidate, resolve423EducationalCard } from './knowledge423.ts';

export const HISTORICAL_INGREDIENT_KNOWLEDGE_VERSION = 'approved-37-v7/editorial-v1';
export const INGREDIENT_KNOWLEDGE_VERSION = 'approved-47-20261004/original37-v2-expansion10-v1/editorial-local-v2';
const digest = z.string().regex(/^[a-f0-9]{64}$/);
export const IngredientKnowledgeReleaseSchema = z.strictObject({
  version: z.string().min(1), contentHash: digest, releaseGate: z.literal('local_only'),
  provenance: z.strictObject({
    libraryFileId: z.literal('libfile_211e2d19dbe881918237cc72994ca091'), libraryVersion: z.union([z.literal(1),z.literal(2)]),
    documentSha256: digest, handoffSha256: digest, ingredientSourceSha256: digest,
    sourceRevision: z.string().min(1), approvedOn: z.iso.date(), importVersion: z.enum(['exact-approved-prose/v1','exact-approved-prose/v2']),
    additionalDocuments: z.array(z.strictObject({libraryFileId:z.string().min(1),libraryVersion:z.number().int().nonnegative(),documentSha256:digest})).max(1).optional(), preparationHash: digest.optional(),
    reviewScope: z.literal('approved_editorial_local_only'), expiresAt: z.iso.datetime().nullable(), revoked: z.boolean(),
  }),
  cards: z.array(IngredientKnowledgeCardSchema).max(1000),
  contributionKinds: z.record(z.string(), z.enum(['benefit','support','unknown'])),
  sources: z.array(PartFourSourceSchema).max(1000),
  educationContext: z.array(EducationDocumentContextSchema).max(2).optional(),
});
type ApprovedEditorialRelease = z.infer<typeof IngredientKnowledgeReleaseSchema>;
export type IngredientKnowledgeRelease = ApprovedEditorialRelease | Candidate423Release;
export interface KnowledgeLifecycle { now?: string; withdrawnDependencies?: readonly string[] }
const validatedReleases = new WeakSet<IngredientKnowledgeRelease>();

export function ingredientKnowledgeHash(release: IngredientKnowledgeRelease): string {
  const { contentHash: _hash, ...content } = release;
  return sha256(canonicalJson(content));
}

/** The local pack authorizes original approved prose, not a new clinical review.
 * IDs already in Part 2 are reused; new identities use literal name slugs. */
export function validateIngredientKnowledgeRelease(value: ApprovedEditorialRelease): ApprovedEditorialRelease;
export function validateIngredientKnowledgeRelease(value: Candidate423Release): Candidate423Release;
export function validateIngredientKnowledgeRelease(value: unknown): IngredientKnowledgeRelease;
export function validateIngredientKnowledgeRelease(value: unknown): IngredientKnowledgeRelease {
  if (value && typeof value === 'object' && validatedReleases.has(value as IngredientKnowledgeRelease)) return value as IngredientKnowledgeRelease;
  if(value&&typeof value==='object'&&'releaseGate' in value&&value.releaseGate==='isolated_local_candidate')return validate423Candidate(value);
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
  if (release.version === INGREDIENT_KNOWLEDGE_VERSION) {
    const fixed = (value: IngredientKnowledgeRelease) => ({...value,contentHash:undefined,provenance:{...value.provenance,expiresAt:null,revoked:false}});
    if (canonicalJson(fixed(release)) !== canonicalJson(fixed(approved47Release))) throw Error('Release differs from exact approved47 education/source/context pin');
    deepFreeze(release); validatedReleases.add(release); return release;
  }
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
  sourceIds: [`ingredient-reference:${idFor(name)}`], version: HISTORICAL_INGREDIENT_KNOWLEDGE_VERSION,
}));
const release: IngredientKnowledgeRelease = {
  version: HISTORICAL_INGREDIENT_KNOWLEDGE_VERSION, contentHash: '0'.repeat(64), releaseGate: 'local_only',
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
export const APPROVED_37_INGREDIENT_KNOWLEDGE = validateIngredientKnowledgeRelease(release);

// The complete approved archive stays immutable and separate from runtime cards.
// Its preparation gate is historical provenance, not runtime selection authority.
const {contentHash: preparationHash, ...preparationContent}=APPROVED47_SOURCE;
if (preparationHash!==APPROVED47_PREPARATION_HASH || sha256(canonicalJson(preparationContent))!==APPROVED47_PREPARATION_HASH) throw Error('Approved47 source archive hash mismatch');
deepFreeze(APPROVED47_SOURCE);
const approved47Release: IngredientKnowledgeRelease = {
 version: INGREDIENT_KNOWLEDGE_VERSION,contentHash:'0'.repeat(64),releaseGate:'local_only',
 provenance:{libraryFileId:'libfile_211e2d19dbe881918237cc72994ca091',libraryVersion:2,
 documentSha256:'68e0740df427bf8a434b5c30ea30cd07378568078d3c8d01af56fee2ed8c7d22',
 handoffSha256:'82dbfd91fd296ee6eb6d93f7810482e30981ba04043736f27fe57ea2052fa6ca',
 ingredientSourceSha256:APPROVED47_PREPARATION_HASH,sourceRevision:'approved-editorial-47-2026-10-04',approvedOn:'2026-10-04',importVersion:'exact-approved-prose/v2',reviewScope:'approved_editorial_local_only',expiresAt:null,revoked:false,
 additionalDocuments:[{libraryFileId:'libfile_62fd53a648888191b30c8ff388128dc1',libraryVersion:1,documentSha256:'b204028c1a6a38343a24693fb8b0b65deb5a8e4cc94084a92a5fc6db18d2f83b'}],preparationHash:APPROVED47_PREPARATION_HASH},
 cards:APPROVED47_SOURCE.cards.map(record=>{const e=record.approvedEntry;const ingredientId=record.identityProposal.proposedRuntimeIngredientId;
 const previous=APPROVED_37_INGREDIENT_KNOWLEDGE.cards.find(card=>card.ingredientId===ingredientId);
 return {ingredientId,name:e.display_name,aliases:previous?.aliases??[],short:e.function,label:e.proposed_label,body:e.short_intro,detail:e.depth,evidence:e.evidence_note,sourceIds:[...record.sourceIds],version:INGREDIENT_KNOWLEDGE_VERSION,
 editorial:{caution:e.cautions.standalone_text,amountAndUse:e.concentration.amount_and_use_text,
 aliasNotes:e.aliases.notes_verbatim??null,distinctIngredients:e.aliases.distinct_ingredients_notes_verbatim??null,
 qualifications:e.cautions.standalone_text===null?[e.cautions.null_meaning]:[],copySha256:e.copy_sha256,documentId:e.source_document.id,libraryFileId:e.source_document.library_file_id,libraryVersion:e.source_document.library_version,documentSha256:e.source_document.sha256}};}),
 // Existing general-role classification is retained. New editorial labels do
 // not manufacture scientific benefit rules or a clinical contribution class.
 contributionKinds:Object.fromEntries(APPROVED47_SOURCE.cards.map(c=>[c.identityProposal.proposedRuntimeIngredientId,APPROVED_37_INGREDIENT_KNOWLEDGE.contributionKinds[c.identityProposal.proposedRuntimeIngredientId]??'unknown'])),
 sources:APPROVED47_SOURCE.sourceIndex.map(source=>({id:source.sourceId,title:source.sourceMetadata.link_labels.join(' · '),url:source.sourceMetadata.url,reviewedAt:'2026-10-04T00:51:00Z',kind:'approved_editorial',editorial:{metadataSha256:source.sourceMetadata.metadata_sha256,copyApprovedAt:'2026-10-04T00:51:00Z',rights:'not_promoted',remoteBodySnapshot:'unavailable'}})),
 educationContext:Object.entries(APPROVED47_SOURCE.documentWideContext).map(([documentId,context])=>{
  // Exact approved science/identity/amount qualifications are customer content;
  // review worksheets/import commands remain in the complete pinned archive.
  const allowed=new Set(documentId==='original37'?[16,17,18,19,20,21,22,23,24,289,290,291]:[106,108,109,111,122,123,124,125,126,127,128,129,130,131,132,133,134,135,136,139,140,141,142,143,144,145,146,147,148,149,150,151,152,153,154,157,158]);
  const seen=new Set<number>();
  const sections=context.sections.map(section=>({heading:section.heading,paragraphs:section.paragraphs.filter(p=>allowed.has(p.index)&&!seen.has(p.index)&&(seen.add(p.index),true)).map(p=>({text:p.text,links:p.links}))})).filter(section=>section.paragraphs.length);
  return {documentId,sections,researchTable:context.research_table?{rows:context.research_table.rows}:null};
 }),
};
approved47Release.contentHash=ingredientKnowledgeHash(approved47Release);
export const APPROVED_INGREDIENT_KNOWLEDGE=validateIngredientKnowledgeRelease(approved47Release);

export function ingredientKnowledgeAvailable(release: IngredientKnowledgeRelease, lifecycle: KnowledgeLifecycle = {}): boolean {
  const withdrawn = lifecycle.withdrawnDependencies ?? [];
  if(release.releaseGate==='isolated_local_candidate')return !release.provenance.revoked&&!withdrawn.includes(release.version)&&!withdrawn.includes(release.contentHash)&&(release.provenance.expiresAt===null||!!lifecycle.now&&Date.parse(lifecycle.now)<Date.parse(release.provenance.expiresAt));
  if (release.provenance.revoked || [release.version,release.contentHash,release.provenance.libraryFileId,release.provenance.documentSha256,release.provenance.handoffSha256,...(release.provenance.additionalDocuments??[]).flatMap(doc=>[doc.libraryFileId,doc.documentSha256]),...(release.provenance.preparationHash?[release.provenance.preparationHash]:[])].some(id => withdrawn.includes(id))) return false;
  if (release.version===INGREDIENT_KNOWLEDGE_VERSION && release.sources.some(source=>withdrawn.includes(source.id))) return false;
  if (release.provenance.expiresAt !== null && (!lifecycle.now || !Number.isFinite(Date.parse(lifecycle.now)) || Date.parse(lifecycle.now) >= Date.parse(release.provenance.expiresAt))) return false;
  return true;
}

/** Exact NFC/case/space lookup only. Never apply Part 2's wider alias inventory,
 * fuzzy matching, substring rules, family equivalences or punctuation removal. */
export function resolveIngredientKnowledge(name: string, value: IngredientKnowledgeRelease = APPROVED_INGREDIENT_KNOWLEDGE, lifecycle: KnowledgeLifecycle = {}): IngredientKnowledgeCard | null {
  let release: IngredientKnowledgeRelease;
  try { release = validateIngredientKnowledgeRelease(value); } catch { return null; }
  if (!ingredientKnowledgeAvailable(release,lifecycle)) return null;
  if(release.releaseGate==='isolated_local_candidate')return resolve423EducationalCard({literalName:name,mapping:{state:'unknown',ingredientId:null}},{explicitLocal423:true,expectedReleaseHash:release.contentHash,now:lifecycle.now??'1970-01-01T00:00:00.000Z',withdrawnDependencies:[...(lifecycle.withdrawnDependencies??[])]},release);
  const key = lookupName(name).key;
  const card = release.cards.find(card => [card.name,...card.aliases].some(surface => lookupName(surface).key === key));
  const withdrawn = lifecycle.withdrawnDependencies ?? [];
  return card && ![card.ingredientId,...card.sourceIds].some(id => withdrawn.includes(id)) ? card : null;
}
