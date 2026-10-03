import { ProductResearchBriefSchema, type ProductResearchBrief, type ResearchBriefSource } from '../../contracts/PartFour.ts';
import { canonicalJson, sha256 } from '../part-two/hash.ts';
import { deepFreeze } from '../part-two/dictionary.ts';

export interface ResearchBriefSubject { productId: string; variantId: string; formulaVersionId: string | null }
export interface ResearchBriefAdmissionOptions {
  now: string;
  expectedSubject: ResearchBriefSubject;
  withdrawnDependencies?: readonly string[];
  /** Explicit local preview/test opt-in; never a production approval. */
  allowLocalFixture?: boolean;
}

export function researchBriefHash(value: ProductResearchBrief | Omit<ProductResearchBrief, 'contentHash'>): string {
  const { contentHash: _hash, ...content } = value as ProductResearchBrief;
  return sha256(canonicalJson(content));
}

/** Canonical public citation identity, not a fetch or a claim of authenticity.
 * Alias records are rejected rather than changing a reviewed artifact's bytes. */
function citationIdentity(value: string): string | null {
  try {
    if (value.length > 4096) return null;
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || url.username || url.password || url.port && url.port !== '443') return null;
    if (!hostname.includes('.') || /^[\d.]+$/.test(hostname) || hostname.includes(':') ||
      /(?:^|\.)(?:localhost|local|test|invalid|example)$/.test(hostname) ||
      /(?:^|\.)example\.(?:com|net|org)$/.test(hostname)) return null;
    const host = hostname.replace(/^www\./, '');
    const path = decodeURIComponent(url.pathname).replace(/\/+$/, '') || '/';
    // Reddit thread URLs with another title, mobile/old host or share parameters
    // remain one source. A thread is not multiple independent review sources.
    const thread = path.match(/\/comments\/([^/]+)/i);
    if (/(?:^|\.)reddit\.com$/.test(host) && thread) return `reddit.com/comments/${thread[1].toLowerCase()}`;
    for (const key of [...url.searchParams.keys()]) if (/^utm_/i.test(key) || /^(?:ref|ref_source|share_id|fbclid|gclid)$/i.test(key)) url.searchParams.delete(key);
    url.searchParams.sort();
    return `${host}${path}${url.searchParams.size ? `?${url.searchParams.toString()}` : ''}`;
  } catch { return null; }
}

const nonblank = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const unique = (values: readonly string[]) => new Set(values).size === values.length;

/** Validates the already human-reviewed, permission-qualified JSON artifact.
 * Hashes ensure integrity, not approval or prose entailment. The canonical owner
 * must supply the exact current subject and a trusted reviewed artifact; this
 * provider-independent gate does not acquire, summarize or authenticate sources. */
export function admitResearchBrief(value: unknown, options: ResearchBriefAdmissionOptions): ProductResearchBrief | null {
  const parsed = ProductResearchBriefSchema.safeParse(value);
  if (!parsed.success) return null;
  const brief = parsed.data;
  const expected = options.expectedSubject;
  const now = Date.parse(options.now);
  const reviewed = Date.parse(brief.reviewedAt);
  const expires = Date.parse(brief.validUntil);
  if (!expected || !nonblank(expected.productId) || !nonblank(expected.variantId) ||
    expected.formulaVersionId !== null && !nonblank(expected.formulaVersionId)) return null;
  if (!Number.isFinite(now) || reviewed > now || reviewed >= expires || now >= expires) return null;
  if (brief.reviewDecision === 'approved_local_fixture' && !options.allowLocalFixture) return null;
  if (!nonblank(brief.reviewerId) || !nonblank(brief.revision) || !nonblank(brief.coverageLimit)) return null;
  if (brief.contentHash !== researchBriefHash(brief)) return null;
  if (brief.productId !== expected.productId || brief.variantId !== expected.variantId) return null;
  if (brief.formulaVersionId !== null && brief.formulaVersionId !== expected.formulaVersionId) return null;
  if (!unique(brief.sources.map(source => source.id)) || !unique(brief.observations.map(observation => observation.id))) return null;

  const dependencies = [brief.revision, brief.contentHash, brief.productId, brief.variantId, brief.reviewerId,
    ...(brief.formulaVersionId ? [brief.formulaVersionId] : []),
    ...brief.sources.flatMap(source => [source.id, source.permission.grantId, source.permission.version])];
  if (dependencies.some(id => options.withdrawnDependencies?.includes(id))) return null;
  const identities: string[] = [];
  for (const source of brief.sources) {
    const identity = citationIdentity(source.url);
    if (!identity || !nonblank(source.id) || !nonblank(source.title) || !nonblank(source.coverageLimit) ||
      !nonblank(source.permission.grantId) || !nonblank(source.permission.version)) return null;
    identities.push(identity);
    if (source.productId !== expected.productId || source.variantId !== expected.variantId) return null;
    if (source.formulaVersionId !== null && (source.formulaVersionId !== brief.formulaVersionId || source.formulaVersionId !== expected.formulaVersionId)) return null;
    if (source.matching === 'exact_formula' && (source.formulaVersionId === null || brief.formulaVersionId === null)) return null;
    const retrieved = Date.parse(source.retrievedAt), published = source.publishedAt === null ? null : Date.parse(source.publishedAt);
    const permissionExpiry = Date.parse(source.permission.validUntil);
    if (retrieved > reviewed || published !== null && published > retrieved || permissionExpiry < expires || permissionExpiry <= now) return null;
  }
  if (!unique(identities)) return null;

  const sources = new Map(brief.sources.map(source => [source.id, source]));
  const used = new Set<string>();
  for (const observation of brief.observations) {
    if (!nonblank(observation.id) || !nonblank(observation.text) || !observation.sourceIds.length ||
      !unique(observation.sourceIds) || !unique(observation.opposingSourceIds) ||
      observation.sourceIds.some(id => observation.opposingSourceIds.includes(id))) return null;
    const refs = [...observation.sourceIds, ...observation.opposingSourceIds];
    if (refs.some(id => !sources.has(id))) return null;
    refs.forEach(id => used.add(id));
    const support = observation.sourceIds.map(id => sources.get(id)!);
    if (observation.kind === 'reported_experience' && (support.some(source => source.kind === 'manufacturer') || !support.some(source => source.kind === 'personal_anecdote'))) return null;
    if (observation.kind === 'editorial_observation' && !support.some(source => source.kind === 'editorial' || source.kind === 'manufacturer')) return null;
    if (observation.scope === 'formula_context') {
      if (brief.formulaVersionId === null || expected.formulaVersionId === null ||
        refs.some(id => { const source = sources.get(id)!; return source.matching !== 'exact_formula' || source.formulaVersionId !== expected.formulaVersionId; })) return null;
    }
  }
  // Unreferenced records cannot make a limited brief appear more widely based.
  if (used.size !== brief.sources.length) return null;
  return deepFreeze(brief);
}

export function researchBriefSourceKind(source: ResearchBriefSource): string {
  return { personal_anecdote: 'Personal experience report', editorial: 'Editorial observation', manufacturer: 'Manufacturer information' }[source.kind];
}
