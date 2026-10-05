/** Standalone pilot only. No scanner, decision, network or persistence dependencies. */
export const REVIEW_BRIEF_PILOT_VERSION = '1.1.0';
export const REVIEW_BRIEF_AUDITED_ON = '2026-10-04';

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
  /** Required for ready content. Historical v1 exclusions have no accepted report. */
  reportEvidence?: Readonly<{
    firsthand: true;
    attribution: string;
    retrieval: 'direct_primary_page' | 'indexed_primary_page';
    /** Locators inspected for this source's own reported experiences. */
    sections: readonly string[];
    identity: readonly Readonly<{ url: string; section: string; finding: string }>[];
    formulaApplicability: 'historical_not_current_formula_verified';
  }>;
  permission: Readonly<{
    status: 'cleared' | 'explicit_restriction_pending_summary_review';
    basisUrl: string;
    basis: string;
    /** This is our retention policy, not a claim the publisher licensed metadata. */
    retain: readonly string[];
    display: 'original_summary_with_attribution' | 'none';
    /** Internal scoped use assessment, not an invented publisher licence. */
    useAssessment?: Readonly<{
      kind: 'original_factual_paraphrase' | 'written_permission';
      reviewedOn: string;
      checkedUrls: readonly string[];
      restrictions: string;
      quotations: false;
      copiedReviews: false;
      images: false;
      bulkCollection: false;
    }>;
  }>;
}>;

export type ReviewBriefObservation = Readonly<{
  topic: 'texture' | 'finish' | 'layering' | 'reported_experience';
  summary: string;
  /** Keep a contrary report separate, attributed and visible, not averaged away. */
  qualification: string;
  sourceIds: readonly string[];
  sourceSections: readonly string[];
  /** One explicit section binding per cited source; cannot borrow another source's locator. */
  bindings?: readonly Readonly<{ sourceId: string; section: string }>[];
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
export const REVIEW_BRIEF_PILOT_V1: readonly ReviewBrief[] = deepFreeze([
  {
    id: 'review-brief/vanicream-daily-facial-moisturizer/us/non-spf',
    version: '1.0.0',
    identity: {
      brand: 'Vanicream',
      productName: 'Daily Facial Moisturizer',
      variant: 'non-SPF daily facial moisturizer',
      market: 'US',
    },
    status: 'withheld',
    auditedOn: '2026-10-03',
    heading: 'What people report',
    selectionNotice,
    formulaScope: 'historical_reports_not_formula_verified',
    observations: [],
    sources: [
      {
        id: 'fussy-mug-vanicream-daily',
        url: 'https://www.fussymug.com/vanicream-daily-facial-moisturizer-review/',
        publisher: 'Fussy Mug',
        auditedOn: '2026-10-03',
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
        auditedOn: '2026-10-03',
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
    version: '1.0.0',
    identity: {
      brand: 'CeraVe',
      productName: 'PM Facial Moisturizing Lotion',
      variant: 'PM non-SPF facial lotion',
      market: 'US',
    },
    status: 'withheld',
    auditedOn: '2026-10-03',
    heading: 'What people report',
    selectionNotice,
    formulaScope: 'historical_reports_not_formula_verified',
    observations: [],
    sources: [
      {
        id: 'artistry-by-t-cerave-pm',
        url: 'https://www.artistrybyt.com/blog/cerave-pm-moisturizer-review',
        publisher: 'Artistry by T',
        auditedOn: '2026-10-03',
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

const ceraveIdentity = REVIEW_BRIEF_PILOT_V1[1].identity;
const ceraveSourceId = 'enjoy-the-view-cerave-pm-2016';
const ceraveSection = 'Firsthand application paragraph after Ingredients; following purchase paragraph';

const vanicreamIdentity = REVIEW_BRIEF_PILOT_V1[0].identity;
const vanicreamSourceId = 'isabelxmarie-vanicream-daily-2023';
const vanicreamSection = 'Morning Routine, Vanicream Daily Facial Moisturizer paragraph';
const vanicreamUrl = 'https://www.isabelxmarie.com/affordable-skincare-routine-for-dry-skin/';

const vanicreamReady: ReviewBrief = {
  ...REVIEW_BRIEF_PILOT_V1[0],
  version: REVIEW_BRIEF_PILOT_VERSION,
  auditedOn: REVIEW_BRIEF_AUDITED_ON,
  status: 'ready',
  selectionNotice: 'One selected firsthand account from 2023, not a representative review consensus. It does not predict your experience.',
  observations: [{
    topic: 'layering',
    summary: 'Isabel reported a light feel under makeup, without a heavy or greasy finish.',
    qualification: 'One person’s 2023 routine. Her makeup was not identified, and today’s formula has not been verified.',
    sourceIds: [vanicreamSourceId], sourceSections: [vanicreamSection],
    bindings: [{ sourceId: vanicreamSourceId, section: vanicreamSection }],
  }],
  sources: [{
    id: vanicreamSourceId, url: vanicreamUrl,
    publisher: 'Isabel, IsabelxMarie', auditedOn: REVIEW_BRIEF_AUDITED_ON,
    sourceDate: { kind: 'published', isoDate: '2023-06-07', displayed: 'Published and updated June 7, 2023' },
    identityCheck: 'The firsthand routine names Daily Facial Moisturizer. Its original morning-routine photo shows the non-SPF 3 fl oz / 89 mL Daily Facial tube, separately from Trader Joe’s SPF 40 sunscreen. The author describes her own use in a U.S. routine context corroborated by her same-year DC/VA treatment account with the same Carolyn/TalaMed named in this article. This is not an inference from dollar pricing. Retailer, batch, back-label ingredients and current formula equivalence are not established.',
    acceptedReportIdentity: vanicreamIdentity,
    reportEvidence: {
      firsthand: true, attribution: 'Isabel’s own trial and morning/evening routine account',
      retrieval: 'direct_primary_page', sections: [vanicreamSection],
      identity: [
        { url: vanicreamUrl, section: 'Morning Routine and Evening Routine, Vanicream paragraphs; article date metadata', finding: 'Firsthand trial at a friend’s house and use of the exact Daily Facial Moisturizer; publication and modification June 7, 2023.' },
        { url: 'https://www.isabelxmarie.com/wp-content/uploads/2023/04/IMG_0357-1024x683.jpeg', section: 'Morning-routine photograph, upper-middle tube', finding: 'Visually inspected Daily Facial Moisturizer 3 fl oz / 89 mL non-SPF tube; separate Trader Joe’s sunscreen. Image is citation evidence only, not retained or displayed by this module.' },
        { url: 'https://www.isabelxmarie.com/what-is-a-prp-facial/', section: 'Own treatment account, DC/VA and Carolyn at Tala Med references', finding: 'Corroborates U.S. routine context with the same practitioner named in the skincare report; not package-batch or ingredient verification.' },
      ],
      formulaApplicability: 'historical_not_current_formula_verified',
    },
    permission: {
      status: 'cleared', basisUrl: 'https://www.copyright.gov/help/faq/faq-protect.html',
      basis: 'Scoped editorial use of one independently written, attributed factual observation. Focused inspection of the article, homepage, About and FAQ plus site terms/copyright searches found no express restriction on this summary or attribution link. No affirmative licence was found or claimed. The basis distinguishes experiential facts from protected expression, not a blanket fair-use ruling. No quotation, copied review, image reuse or bulk collection.',
      retain: ['our original factual summary', 'source links and section locators', 'date and identity audit', 'scoped use assessment'],
      display: 'original_summary_with_attribution',
      useAssessment: {
        kind: 'original_factual_paraphrase', reviewedOn: REVIEW_BRIEF_AUDITED_ON,
        checkedUrls: [vanicreamUrl, 'https://www.isabelxmarie.com/', 'https://www.isabelxmarie.com/about/', 'https://www.isabelxmarie.com/faq/', 'https://www.copyright.gov/help/faq/faq-protect.html'],
        restrictions: 'No express factual-summary, commercial-summary or linking restriction located in inspected pages and focused searches; no affirmative licence. Cookie notice is about cookies, not a reuse permission. Protected expression and images are not copied. A FAQ fetch timed out and is not treated as inspected terms; the bounded search is not asserted exhaustive.',
        quotations: false, copiedReviews: false, images: false, bulkCollection: false,
      },
    },
  }],
  limits: [
    'One historical 2023 U.S.-context account. Retailer, batch and current formula are not verified.',
    'Makeup type and complete application conditions were not reported; no general layering guarantee.',
    'The article contains shopping links. No affiliate links, images, clinical claims or sunscreen-mixing advice are reused.',
    'No ingredient cause, safety conclusion, consensus or personal recommendation is inferred.',
  ],
  gaps: [],
};

const ceraveReady: ReviewBrief = {
  ...REVIEW_BRIEF_PILOT_V1[1],
  version: REVIEW_BRIEF_PILOT_VERSION,
  auditedOn: REVIEW_BRIEF_AUDITED_ON,
  status: 'ready',
  selectionNotice: 'One selected firsthand account from 2016, not a representative review consensus. It does not predict your experience.',
  observations: [
    {
      topic: 'finish',
      summary: 'In Kim’s 2016 account, CeraVe PM absorbed quickly without a greasy finish, but left an unfamiliar surface feel.',
      qualification: 'One person’s experience with a historical U.S. bottle, not a finding about your current formula or skin.',
      sourceIds: [ceraveSourceId], sourceSections: [ceraveSection],
      bindings: [{ sourceId: ceraveSourceId, section: ceraveSection }],
    },
    {
      topic: 'layering',
      summary: 'Kim reported that the unusual feel was no longer noticeable after applying sunscreen in her daytime routine.',
      qualification: 'The sunscreen was not identified. This does not establish how PM will layer with your products.',
      sourceIds: [ceraveSourceId], sourceSections: [ceraveSection],
      bindings: [{ sourceId: ceraveSourceId, section: ceraveSection }],
    },
  ],
  sources: [{
    id: ceraveSourceId,
    url: 'https://www.enjoytheviewblog.com/2016/04/cerave-pm-facial-moisturizing-lotion.html',
    publisher: 'Kim, enjoy the view', auditedOn: REVIEW_BRIEF_AUDITED_ON,
    sourceDate: { kind: 'published', isoDate: '2016-04-21', displayed: 'Published April 21, 2016' },
    identityCheck: 'The report names PM Facial Moisturizing Lotion, identifies a 3 oz pump bought at Kroger, and describes the author’s own use. The author’s Kentucky context is independently visible on the site. U.S. retail purchase, not dollar pricing, supports market identity. No current formula equivalence is established.',
    acceptedReportIdentity: ceraveIdentity,
    reportEvidence: {
      firsthand: true, attribution: 'Kim’s own application and Kroger purchase account',
      retrieval: 'indexed_primary_page',
      sections: [ceraveSection],
      identity: [
        { url: 'https://www.enjoytheviewblog.com/2016/04/cerave-pm-facial-moisturizing-lotion.html', section: 'Title, April 21 2016 dateline, application and Kroger purchase paragraphs', finding: 'PM non-SPF product, 3 oz pump, firsthand purchase and use at a U.S. retailer.' },
        { url: 'https://www.enjoytheviewblog.com/', section: 'Author context and Kentucky/Newport references', finding: 'Corroborating U.S. context, not an inference from currency.' },
      ],
      formulaApplicability: 'historical_not_current_formula_verified',
    },
    permission: {
      status: 'cleared', basisUrl: 'https://www.copyright.gov/help/faq/faq-protect.html',
      basis: 'Scoped editorial use of two short, original attributed factual paraphrases. No copied expression, quotation, images or review archive. Site copyright notice reserves expression; no express restriction applicable to this factual-summary use was found in the focused page/homepage and terms search. This is not a publisher licence, written permission or a conclusive legal ruling. See the source audit for the search-index retrieval limitation.',
      retain: ['our original factual summaries', 'source links and section locators', 'date and identity audit', 'scoped use assessment'],
      display: 'original_summary_with_attribution',
      useAssessment: {
        kind: 'original_factual_paraphrase', reviewedOn: REVIEW_BRIEF_AUDITED_ON,
        checkedUrls: ['https://www.enjoytheviewblog.com/2016/04/cerave-pm-facial-moisturizing-lotion.html', 'https://www.enjoytheviewblog.com/', 'https://www.copyright.gov/help/faq/faq-protect.html'],
        restrictions: 'All rights reserved notice. No specific factual-summary restriction found in the focused pass. Direct article returned 429; indexed primary text was used without bypass or collection retries.',
        quotations: false, copiedReviews: false, images: false, bulkCollection: false,
      },
    },
  }],
  limits: [
    'One historical 2016 U.S. account. The batch and current formula are not verified.',
    'The original article has affiliate-link disclosure. No purchase links or images are reused.',
    'No ingredient cause, clinical benefit, safety conclusion or personal recommendation is inferred.',
    'Direct article retrieval returned 429. The primary article’s indexed text was inspected; its current live revision is unverified.',
  ],
  gaps: [],
};

export const REVIEW_BRIEF_PILOT: readonly ReviewBrief[] = deepFreeze([
  vanicreamReady,
  ceraveReady,
]);

/** Saved callers retain a version or snapshot; changing the default never rewrites v1. */
export const REVIEW_BRIEF_EDITIONS: Readonly<Record<string, readonly ReviewBrief[]>> = deepFreeze({
  '1.0.0': REVIEW_BRIEF_PILOT_V1,
  '1.1.0': REVIEW_BRIEF_PILOT,
});

function sameIdentity(a: ReviewBriefIdentity | null, b: ReviewBriefIdentity): boolean {
  return a !== null
    && a.brand === b.brand && a.productName === b.productName
    && a.variant === b.variant && a.market === b.market;
}

const nonblank = (value: string) => value.trim().length > 0;
function safeUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch { return false; }
}
function realDate(value: string | null): boolean {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function sourceUsable(source: ReviewBriefSource, brief: ReviewBrief): boolean {
  const evidence = source.reportEvidence, use = source.permission.useAssessment;
  return sameIdentity(source.acceptedReportIdentity, brief.identity)
    && source.permission.status === 'cleared'
    && source.permission.display === 'original_summary_with_attribution'
    && safeUrl(source.url) && safeUrl(source.permission.basisUrl)
    && realDate(source.sourceDate.isoDate) && realDate(source.auditedOn)
    && ['updated', 'published'].includes(source.sourceDate.kind) && nonblank(source.sourceDate.displayed)
    && source.sourceDate.isoDate! <= source.auditedOn && source.auditedOn <= brief.auditedOn
    && nonblank(source.id) && nonblank(source.publisher)
    && nonblank(source.identityCheck) && nonblank(source.permission.basis)
    && !!evidence && evidence.firsthand === true && nonblank(evidence.attribution)
    && ['direct_primary_page', 'indexed_primary_page'].includes(evidence.retrieval)
    && evidence.sections.length > 0 && evidence.sections.every(nonblank)
    && evidence.formulaApplicability === 'historical_not_current_formula_verified'
    && evidence.identity.length > 0
    && evidence.identity.every(item => safeUrl(item.url) && nonblank(item.section) && nonblank(item.finding))
    && !!use && realDate(use.reviewedOn) && nonblank(use.restrictions)
    && use.reviewedOn <= brief.auditedOn
    && ['original_factual_paraphrase', 'written_permission'].includes(use.kind)
    && source.permission.retain.length > 0 && source.permission.retain.every(nonblank)
    && use.checkedUrls.length > 0 && use.checkedUrls.every(safeUrl)
    && use.quotations === false && use.copiedReviews === false && use.images === false && use.bulkCollection === false;
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
    && brief.heading === 'What people report'
    && brief.formulaScope === 'historical_reports_not_formula_verified'
    && sameIdentity(brief.identity, identity)
    && brief.gaps.length === 0 && brief.limits.length > 0 && brief.limits.every(nonblank)
    && realDate(brief.auditedOn) && nonblank(brief.version) && nonblank(brief.selectionNotice)
    && new Set(brief.sources.map(source => source.id)).size === brief.sources.length
    && brief.sources.every(source => sourceUsable(source, brief)
      && brief.observations.some(observation => observation.sourceIds.includes(source.id)))
    && brief.observations.length >= 1 && brief.observations.length <= 2
    && brief.observations.every((observation) =>
      ['texture', 'finish', 'layering', 'reported_experience'].includes(observation.topic)
      && observation.summary.trim().length > 0
      && observation.qualification.trim().length > 0
      && observation.sourceSections.length > 0 && observation.sourceSections.every(nonblank)
      && observation.sourceIds.length > 0
      && new Set(observation.sourceIds).size === observation.sourceIds.length
      && !!observation.bindings && observation.bindings.length === observation.sourceIds.length
      && observation.bindings.every(binding => observation.sourceIds.includes(binding.sourceId)
        && nonblank(binding.section) && observation.sourceSections.includes(binding.section)
        && brief.sources.find(source => source.id === binding.sourceId)?.reportEvidence?.sections.includes(binding.section))
      && new Set(observation.bindings.map(binding => binding.sourceId)).size === observation.sourceIds.length
      && observation.sourceIds.every((id) => brief.sources.some((source) =>
        source.id === id
        && sameIdentity(source.acceptedReportIdentity, brief.identity)
        && source.permission.status === 'cleared'
        && source.permission.display === 'original_summary_with_attribution'))));
}
