# Catalog contribution boundary (Sami S3 / #105)

## Runtime increment awaiting customer and hosted activation

`catalog-contribution` is a separate authenticated Edge endpoint; Kanuj's Check UI
does not call it yet. It uses the merged pure proposal parser and receives one of:

- `{"operation":"submit","contribution":<CatalogContributionRequest>,"consent":{"version":1,"purpose":"catalog_review","accepted":true}}`
- `{"operation":"status","requestId":"<UUID>"}`
- `{"operation":"withdraw","id":"<contribution UUID>"}`

Only an affirmative, versioned, purpose-bound submit is accepted. The exact
customer-facing consent wording is **not yet approved**; this endpoint must
not be activated in customer UI or hosted until it is. The server
derives the owner from a verified JWT; the request cannot name an owner. The
`requestId` is unique per owner, identical retries return the same row, and a
changed retry fails. At most ten new proposals per owner are accepted in a
rolling 24 hours; retries do not count again. The Edge parser bounds every
field and the database additionally rejects a payload over 4096 bytes.
`status` and `withdraw` reveal
only the calling owner's rows. No customer can write the table or call its
service-role-only transaction functions directly.

Submitted product text and a conservative candidate key are private
operator-side facts, not canonical catalog records. Optional evidence IDs must
name existing owner-bound `free_product_evidence_grants` with matching roles and
an existing object in the private `customer-product-evidence` bucket. Neither
Storage path nor signed URL is saved in the contribution row or returned from
this endpoint. This first increment does not grant a reviewer access to photo
bytes, queue submissions, publish facts, or promote formula/product truth.

Withdrawal atomically changes `status` to `withdrawn`, nulls `payload`,
`candidate_key`, and `request_fingerprint`, and timestamps the withdrawal.
The remaining tombstone contains only row/request/owner IDs, status, consent
version/purpose/timestamp, creation and withdrawal timestamps. It prevents
the same request UUID from silently reactivating a withdrawn submission and
keeps a minimal proof that consent was given then revoked. It remains until
account deletion, when the owner FK cascades it. No time-based expiry or
automatic cleanup is claimed or implemented; a public retention period still
requires a founder-approved policy. Withdrawal does not delete the customer's
separately owned private photo or manual saved product; account deletion
removes owner data and private objects through the existing deletion flow.

Before Kanuj composes the opt-in UI or this is hosted, founders must approve
the exact consent-screen wording and decide whether/how authorized reviewers
may view a private image. The API's stable purpose token is not a substitute
for a reviewed customer disclosure. No photo is licensed for public use,
training, third-party model calls, or permanent shared-image storage by this
consent. Only independently reviewed structured facts could later enter the
existing service-only catalog ingestion path, in a separate reviewed change.

## Earlier pure boundary

A pure proposal validator and deterministic candidate-demand reducer live in
[`proposal.ts`](../src/domain/catalog-contribution/proposal.ts). They do not write data,
call a provider, fetch a retailer, expose a queue, create a founder task or promote catalog truth.
The customer UI remains uncomposed; the runtime increment above is not a shipped customer flow.

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

**Founder-approved scope (2026-09-27):** contribution is explicit opt-in, photos remain
private, and only independently reviewed structured facts may be considered for catalog
inclusion. No public/catalog image reuse and no automatic formula approval are authorized.
This is the approved product boundary, not a claim that a consent screen/API is implemented.

Private photos remain owner-bound, evidence-only and purpose-limited. A contribution does
not make an image reusable, public, trainable or transferable to third-party models. No
public URL, Storage path, local URI, image bytes or reuse-consent flag is accepted here.
Independently corroborated structured facts may enter reviewed catalog ingestion without
reusing the private photo. User evidence alone cannot verify formula, concentration or
authenticity. Existing account deletion guarantees must survive any later persistence.

The runtime increment records explicit versioned consent, allows owner withdrawal,
and preserves account-deletion cascade without asserting a public retention period.
Founder-reviewed customer wording, private-evidence reviewer access, and any
time-based cleanup remain unresolved activation choices. Public image reuse is
out of scope; it is not enabled by private structured-facts contribution.

## Remaining integration and release gates

1. Approve customer consent copy, reviewer access to private evidence if needed,
   and a written public retention period before hosted activation.
2. Compose an explicit Help add it action under the single-writer Check lease. Reuse the existing
   manual save path; saving a private product alone must not implicitly contribute it.
3. Enrichment remains candidate retrieval. Reuse service-only reviewed canonical ingestion and
   S6 provenance gates; never auto-promote user photos or model transcription to formula truth.
4. Prioritize launch coverage from actual intended beta demand and rights-cleared sources.
   No broad scraping, live competing databases, or worldwide catalog expansion is included.

Focused adversarial tests cover strict shape/lengths, accessors, private-reference boundaries,
GTIN checks, variants/regions, Unicode/strength preservation, distinct-owner demand,
idempotency conflicts and bounded deterministic ranking. These are pure automated evidence,
not a physical device, hosted endpoint or complete contribution-loop acceptance claim.
