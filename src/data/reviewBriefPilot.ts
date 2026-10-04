/** Standalone pilot only. No scanner, decision, network or persistence dependencies. */
export const REVIEW_BRIEF_PILOT_VERSION = '1.0.0';
export const REVIEW_BRIEF_AUDITED_ON = '2026-10-03';

export type ReviewBriefIdentity = Readonly<{
  brand: string;
  productName: string;
  variant: string;
  market: string;
}>;

export type ReviewBriefSource = Readonly<{
  id: string;
  url: string;
  publisher: string;
  auditedOn: string;
  sourceDate: Readonly<{
    kind: 'updated' | 'published';
    isoDate: string | null;
    displayed: string;
  }>;
  identityCheck: string;
  /** Only populated after checking the report's own variant and market. */
  acceptedReportIdentity: ReviewBriefIdentity | null;
  permission: Readonly<{
    status: 'cleared' | 'explicit_restriction_pending_summary_review';
    basisUrl: string;
    basis: string;
    /** This is our retention policy, not a claim the publisher licensed metadata. */
    retain: readonly string[];
    display: 'original_summary_with_attribution' | 'none';
  }>;
}>;

export type ReviewBriefObservation = Readonly<{
  topic: 'texture' | 'finish' | 'layering' | 'reported_experience';
  summary: string;
  /** Keep a contrary report separate, attributed and visible, not averaged away. */
  qualification: string;
  sourceIds: readonly string[];
  sourceSections: readonly string[];
}>;

export type ReviewBrief = Readonly<{
  id: string;
  version: string;
  identity: ReviewBriefIdentity;
  status: 'ready' | 'withheld';
  auditedOn: string;
  heading: 'What people report';
  selectionNotice: string;
  /** Historical product experience is not proof of today's package/formula. */
  formulaScope: 'historical_reports_not_formula_verified';
  observations: readonly ReviewBriefObservation[];
  sources: readonly ReviewBriefSource[];
  limits: readonly string[];
  gaps: readonly string[];
}>;

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

const selectionNotice =
  'A selected-source brief, not a representative review consensus. Reports do not predict your experience.';

/**
 * No experience text from excluded sources is retained here, even as a hidden draft.
 * New permitted observations require a new version and integration-owner review.
 */
export const REVIEW_BRIEF_PILOT: readonly ReviewBrief[] = deepFreeze([
  {
    id: 'review-brief/vanicream-daily-facial-moisturizer/us/non-spf',
    version: REVIEW_BRIEF_PILOT_VERSION,
    identity: {
      brand: 'Vanicream',
      productName: 'Daily Facial Moisturizer',
      variant: 'non-SPF daily facial moisturizer',
      market: 'US',
    },
    status: 'withheld',
    auditedOn: REVIEW_BRIEF_AUDITED_ON,
    heading: 'What people report',
    selectionNotice,
    formulaScope: 'historical_reports_not_formula_verified',
    observations: [],
    sources: [
      {
        id: 'fussy-mug-vanicream-daily',
        url: 'https://www.fussymug.com/vanicream-daily-facial-moisturizer-review/',
        publisher: 'Fussy Mug',
        auditedOn: REVIEW_BRIEF_AUDITED_ON,
        sourceDate: { kind: 'updated', isoDate: '2024-08-22', displayed: 'Updated August 22, 2024' },
        identityCheck:
          'Daily facial moisturizer distinguished from the standard lotion. Target purchase and US-only site terms indicate the US market. Exact package size, batch and current formula equivalence are not established.',
        acceptedReportIdentity: null,
        permission: {
          status: 'explicit_restriction_pending_summary_review',
          basisUrl: 'https://www.fussymug.com/terms-conditions/',
          basis: 'Terms expressly restrict storage, display and derivative works without consent. Whether a short original factual summary falls within those terms needs review; no clearance claimed.',
          retain: ['source link', 'date metadata', 'exclusion audit'],
          display: 'none',
        },
      },
      {
        id: 'reddit-skinbarrier-vanicream-lead',
        url: 'https://www.reddit.com/r/SkinbarrierLovers/comments/1qvjery/lets_be_honest_vanicream_daily_facial_moisturizer/',
        publisher: 'Reddit',
        auditedOn: REVIEW_BRIEF_AUDITED_ON,
        sourceDate: { kind: 'published', isoDate: null, displayed: 'Relative dates only in inspected view' },
        identityCheck:
          'Thread title alone does not validate each comment. Replies also discuss other products and markets; no comment-level package/formula match accepted.',
        acceptedReportIdentity: null,
        permission: {
          status: 'explicit_restriction_pending_summary_review',
          basisUrl: 'https://redditinc.com/policies/user-agreement-july-1-2026',
          basis: 'User Agreement sections 4 and 7 restrict commercial exploitation, derivative works and collection. A short manual factual summary is distinct from API use or bulk scraping; its treatment remains unresolved.',
          retain: ['lead link', 'exclusion audit'],
          display: 'none',
        },
      },
    ],
    limits: [
      'No permitted reports are available for display in this version.',
      'Do not substitute Vanicream Moisturizing Lotion, Enhanced Moisturizer or Facial Moisturizer SPF 30.',
      'A future report cannot establish ingredient causation or personal suitability.',
    ],
    gaps: ['Resolve narrow-summary use through permission or a reviewed legal basis, or use a directly consented firsthand report.'],
  },
  {
    id: 'review-brief/cerave-pm-facial-moisturizing-lotion/us/non-spf',
    version: REVIEW_BRIEF_PILOT_VERSION,
    identity: {
      brand: 'CeraVe',
      productName: 'PM Facial Moisturizing Lotion',
      variant: 'PM non-SPF facial lotion',
      market: 'US',
    },
    status: 'withheld',
    auditedOn: REVIEW_BRIEF_AUDITED_ON,
    heading: 'What people report',
    selectionNotice,
    formulaScope: 'historical_reports_not_formula_verified',
    observations: [],
    sources: [
      {
        id: 'artistry-by-t-cerave-pm',
        url: 'https://www.artistrybyt.com/blog/cerave-pm-moisturizer-review',
        publisher: 'Artistry by T',
        auditedOn: REVIEW_BRIEF_AUDITED_ON,
        sourceDate: { kind: 'published', isoDate: '2023-10-31', displayed: 'Oct 31; 2023 confirmed in page metadata' },
        identityCheck:
          'PM and AM are discussed in separate sections. The clumpy texture and greasy white-cast complaints belong to AM, not PM. US-dollar pricing does not confirm a US-market package; the site is Vancouver-based.',
        acceptedReportIdentity: null,
        permission: {
          status: 'explicit_restriction_pending_summary_review',
          basisUrl: 'https://www.artistrybyt.com/terms-of-service',
          basis: 'Terms expressly restrict display and derivative works from website information. Applicability to a short original factual summary needs review; attribution alone is not clearance.',
          retain: ['source link', 'date metadata', 'exclusion audit'],
          display: 'none',
        },
      },
    ],
    limits: [
      'No permitted reports are available for display in this version.',
      'AM/SPF reviews must never be attributed to PM.',
      'The US-market package and formula generation have not been established.',
    ],
    gaps: [
      'Resolve narrow-summary use through permission or a reviewed legal basis, or use a directly consented firsthand report.',
      'Confirm US-market PM packaging before accepting this lead.',
    ],
  },
]);

function sameIdentity(a: ReviewBriefIdentity | null, b: ReviewBriefIdentity): boolean {
  return a !== null
    && a.brand === b.brand && a.productName === b.productName
    && a.variant === b.variant && a.market === b.market;
}

/**
 * Proposed opt-in contract. Synchronous, no I/O and no writes. Undefined means
 * omit the section, not an error or a reason to delay/change a product result.
 * Caller must map an already-resolved exact identity; no title/barcode guessing.
 */
export function getOptionalReviewBrief(
  identity: ReviewBriefIdentity,
  enabled = false,
  /** Allows a reviewed immutable edition, not a remote permission override. */
  edition: readonly ReviewBrief[] = REVIEW_BRIEF_PILOT,
): ReviewBrief | undefined {
  if (!enabled) return undefined;
  return edition.find((brief) =>
    brief.status === 'ready'
    && sameIdentity(brief.identity, identity)
    && brief.limits.length > 0
    && brief.observations.length >= 1 && brief.observations.length <= 2
    && brief.observations.every((observation) =>
      observation.summary.trim().length > 0
      && observation.qualification.trim().length > 0
      && observation.sourceSections.length > 0
      && observation.sourceIds.length > 0
      && observation.sourceIds.every((id) => brief.sources.some((source) =>
        source.id === id
        && sameIdentity(source.acceptedReportIdentity, brief.identity)
        && source.permission.status === 'cleared'
        && source.permission.display === 'original_summary_with_attribution'))));
}
