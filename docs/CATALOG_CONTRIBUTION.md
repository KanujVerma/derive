# Catalog contribution boundary (Sami S3 / #105)

## Implemented in this increment

A pure, inactive proposal validator and deterministic candidate-demand reducer live in
[`proposal.ts`](../src/domain/catalog-contribution/proposal.ts). They do not write data,
call a provider, fetch a retailer, expose a queue, create a founder task or promote catalog truth.
This is preparation for the missing-product loop, not a shipped customer contribution flow.

## Audit: reuse what already exists

- [`FreeContext.ts`](../src/contracts/FreeContext.ts) and
  [`free-context`](../supabase/functions/free-context/index.ts) already support explicit
  `save_product` with a manual brand/name. The saved item is owner-bound, `productId: null`,
  `source: user_reported`. Reuse this path for immediate provisional customer continuation;
  do not manufacture a canonical product UUID or another private-product store.
- [`PRODUCT_CATALOG.md`](PRODUCT_CATALOG.md) and
  [`catalog-ingest.mjs`](../scripts/catalog-ingest.mjs) describe the existing service-only
  sourced ingestion transaction. It is not a customer submission endpoint.
- S6 resolution cases/evidence/review and immutable ProductTruthSnapshot are existing truth
  boundaries. The new proposal does not replace them. A failed Check is not explicit
  submission intent. The inspected resolver sends `p_requires_founder_review` only when
  `managedAccess && decision.requiresFounderReview`: unresolved free Checks do not enqueue
  managed founder tasks. Preserve this bounded free-acquisition behavior. A future explicit
  contribution queue must not repurpose ordinary unresolved Checks as submissions.
- No CatalogContribution table/API or automatic enrichment/promotion loop was found in
  the inspected tree. No catalog records, images or invented barcodes were added.

## Proposed input, not an active network API

`parseCatalogContribution(unknown)` requires version 1, `intent: help_add_product`, a retry
UUID, and brand/name. Exact GTIN, variant, package size, region and up to three opaque
evidence IDs are optional. Region is a bounded country/subdivision-shaped hint, not proof
of a package's market. GTIN must have a supported exact digit length and correct check
digit; arbitrary characters are never stripped. All-zero placeholders are rejected.
Only front-label, ingredient-panel and packaging evidence roles are supported.

The request cannot claim an owner, canonical identity, formula, authority, review result
or image reuse permission. Evidence IDs are references, not authorization. A future trusted
service must derive the owner from verified Auth, verify each evidence row/object/purpose
and existence, enforce issuance/abuse controls, and reject cross-owner or deleted references.
This pure validator does not prove any of those runtime conditions.

## Dedupe and demand, not truth

- GTIN candidate keys normalize valid identifiers to 14 digits. Brand/name disagreement
  under that key becomes a review conflict, never a vote for the most popular name.
- Region, variant and package size remain separate key dimensions. Unanswered context is
  not a wildcard. Text-only keys preserve Unicode, decimals, punctuation and units; only
  label case, compatibility Unicode and repeated whitespace normalize; package-size unit
  case remains intact. Do not guess size
  equivalence or transliterations. The resulting conservative under-merges are safer than
  silently combining distinct variants; authoritative review may connect candidates later.
- A candidate group is not an exact package/formula identity. GTINs may survive reformulation.
  These keys are local/operator-only and may contain product text; they must not enter analytics.
- Demand counts distinct Auth owner IDs per candidate, not retries, new request IDs or photos.
  Anonymous identities are not verified distinct people. Account farming remains a P0-C abuse
  concern; do not market the count as distinct-human validation.
- Same owner/retry UUID with changed normalized payload fails with `IDEMPOTENCY_CONFLICT`.
  Evidence ordering is canonicalized by role, so merely reordering identical references
  does not conflict.
  The reducer is a bounded batch (maximum 5,000 records), not a scalable storage/query engine.
  Future persistence needs atomic uniqueness and indexed aggregation, not loading the entire
  submission history into memory. Over-limit input fails rather than silently truncating.

## Privacy and founder decision gate

Private photos remain owner-bound, evidence-only and purpose-limited. A contribution does
not make an image reusable, public, trainable or transferable to third-party models. No
public URL, Storage path, local URI, image bytes or reuse-consent flag is accepted here.
Independently corroborated structured facts may enter reviewed catalog ingestion without
reusing the private photo. User evidence alone cannot verify formula, concentration or
authenticity. Existing account deletion guarantees must survive any later persistence.

Before an API/migration/runtime activation, founders must choose the scope of explicit
submission consent, private-evidence access and retention, withdrawal/deletion behavior,
and any separate image rights/reuse permission. That decision is intentionally not encoded
as a new database retention policy or a blanket consent claim in this increment.

## Remaining integration and release gates

1. Resolve the above purpose/retention/consent architecture with founders.
2. Add an owner-derived API and additive persistence with atomic replay/dedupe, least-privilege
   RLS, deletion/withdrawal and private evidence checks; fresh reset, pgTAP and integration QA.
3. Compose an explicit Help add it action under the single-writer Check lease. Reuse the existing
   manual save path; saving a private product alone must not implicitly contribute it.
4. Enrichment remains candidate retrieval. Reuse service-only reviewed canonical ingestion and
   S6 provenance gates; never auto-promote user photos or model transcription to formula truth.
5. Prioritize launch coverage from actual intended beta demand and rights-cleared sources.
   No broad scraping, live competing databases, or worldwide catalog expansion is included.

Focused adversarial tests cover strict shape/lengths, accessors, private-reference boundaries,
GTIN checks, variants/regions, Unicode/strength preservation, distinct-owner demand,
idempotency conflicts and bounded deterministic ranking. These are pure automated evidence,
not a physical device, hosted endpoint or complete contribution-loop acceptance claim.
