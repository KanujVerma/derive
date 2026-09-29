# Product Identity and Formula Provenance

S6 establishes one backend resolver for product evidence captured by Scan or
Shelf. It separates four questions that must not be collapsed:

1. What product family might this be?
2. Which exact variant, region, package, and identifier does the evidence support?
3. Which formula version does that exact package support?
4. Is the evidence authoritative enough to evaluate the product for this member?

## Current implementation and approved target

**CURRENT IMPLEMENTATION:** S6 stores product identity, variants, identifier assertions, append-only formula versions, provenance, evidence, resolution cases, and candidates. K4/S4 connects mobile capture to private product-evidence handling locally. The customer capture path uses Expo Camera directly. Photo evidence can be stored and reviewed, but no working OCR, image-recognition extractor, or package-authentication system is claimed. Retained S2 fit is first-match; P0-B consumes actual immutable truth for a locally proven multi-finding baseline. Local integrations do not imply hosted, physical or customer acceptance.

**P0-A local implementation:** immutable `ProductTruthSnapshotV1` stores the actual case/review revision, product/variant identity, separate authoritative ordered formula ingredients, public provenance or explicit unknown, evidence references, conflicts and next evidence. Its storage, producer and client-validation details are in [INTERFACES.md](INTERFACES.md); automated and physical evidence are distinguished in [P0_A_CAPTURE_ACCEPTANCE.md](P0_A_CAPTURE_ACCEPTANCE.md). No hosted activation or working photo extractor is claimed.

**APPROVED TARGET, NOT YET IMPLEMENTED:** the broader normalized ingredient-occurrence/entity model, concentration assertions, regulatory constraints and scientific evidence claims remain separate concepts; they are not fabricated by the minimal snapshot.

Formula truth is time-bound: Product → Variant → FormulaVersion → ordered IngredientOccurrence records → evidence/provenance. A GTIN is an identifier assertion, not a product primary key, exact-formula key, or proof of authenticity. A model resemblance or customer confirmation can contribute evidence or a candidate, but neither alone verifies a formula. Unknown and conflict remain explicit.

ProductTruthSnapshot binds the identity, variant, formula evidence, unresolved conflicts and provenance revision for downstream assessment. Historical snapshots never silently follow catalog refreshes or reformulations. Concentration assertions remain future work and require independent evidence basis, quantity shape, review state, unit, w/w versus w/v when known, active-equivalent basis when relevant, formula/version, market, date, and source. Regulatory limits remain separate constraints; a derived legal maximum is not an observed concentration.

User, brand, and manual submissions may create proposals or resolution cases. New and conflicting proposals stay in a review queue; accepted catalog truth requires source review, provenance, conflict handling, and an auditable promotion decision. Indexed candidate retrieval must replace broad unindexed matching before catalog scale. Do not use barcode lookup as a formula shortcut or bulk scrape product pages/images.

## Stable interface

`POST /functions/v1/resolve-product-identity` requires an authenticated caller under the applicable free or managed access gate
and the contract in
[`src/contracts/ProductIdentityResolver.ts`](../src/contracts/ProductIdentityResolver.ts).
Every request carries a caller-generated UUID for idempotency and declares its
consumer as `scan` or `shelf`.

Supported evidence is:

- GTIN-8, UPC-A, EAN-13, or GTIN-14;
- typed brand, name, variant, and region;
- candidate label or packaging text;
- ingredient-list text;
- up to three privately uploaded photos: front label, ingredients, packaging.

Local device URIs and arbitrary HTTP URLs are rejected. Managed product photos
must already exist under the immutable
`customer-product-evidence/<member-id>/<role>/<opaque-file-name>` namespace.
S-FREE-4 adds a separately granted private guest Check path; see
[S_FREE_4_PRODUCT_EVIDENCE.md](S_FREE_4_PRODUCT_EVIDENCE.md).

### Same-Check ingredient continuation (source increment; not hosted)

`POST /functions/v1/resolve-product-identity` also accepts the additive
`continue_ingredients` operation in `ProductIdentityResolver.ts`. It requires
the original owner-bound Scan case ID, its exact current immutable snapshot ID,
a new request UUID, and either a full ordered ingredient transcription or one
previously granted private ingredient photo. It is deliberately one continuation
per root Check, with a stable `attemptId` for future metering and opt-in history.
An identical retry returns the same child case; changed evidence or a second
continuation returns a conflict. The original case and truth snapshot are never
rewritten. A later client composition must use the returned child snapshot while
retaining the root attempt ID; it must not start a second Check or charge again.

Photo-only continuation stores private evidence and remains formula-unverified:
there is no OCR or image recognition. Text can select one verified formula only
when its entire ordered ingredient list matches an authoritative catalog version
for the original exact variant **and** the original barcode has a completed,
authoritative assertion explicitly linking that version and was reported as
device-origin evidence. `barcodeSource: 'member_input'` preserves pasted/link-derived
origin in stored evidence and the snapshot; it cannot become a device scan by
adding ingredient text. Omitted source preserves the legacy device-origin contract;
explicit `device_barcode` serializes identically for retries. Changing origin on
retry is a conflict; unsupported origins or origin without barcode are invalid.
Origin is reported, not attested, and never creates catalog authority. Typed identity plus a
transcription cannot authenticate a package formula. Conflicts and ambiguity
remain unverified. No external provider data becomes formula truth through this
path. The schema and endpoint require a coordinated migration/function rollout;
the customer UI is a separate Kanuj-owned handoff, not active here.

## Trust states

| State | Meaning | Allowed next step |
| --- | --- | --- |
| `verified_product_formula` | A completed-verification authoritative identifier is explicitly linked to a verified formula version. | Personalized Scan may evaluate fit. |
| `identified_formula_unverified` | Exact product identity is supported, but the current formula is not. | Ask for ingredient evidence. |
| `ambiguous_candidates` | Evidence supports one or more candidates but cannot establish identity. | Member chooses/corrects; founder review remains open. |
| `formula_only` | Ingredient evidence matches a verified formula, but product/variant identity is not established. | Confirm variant or manually review. |
| `insufficient_evidence` | No supported identity can be claimed. | Manual review or better evidence. |

Typed identity, OCR, packaging resemblance, retailer data, and model output do
not produce `verified_product_formula`. Retail price, availability, commission,
or offer ordering are never product-truth evidence.

An identifier's authority label is not sufficient by itself: `verified_at` must
record completion of the catalog verification step before the resolver may use
it to establish identity. GTIN type and digit length must agree exactly.

GTINs can survive reformulation. When one verified authoritative identifier is observed
against multiple formula versions, the resolver preserves the exact variant but
returns `identified_formula_unverified` and requests ingredient evidence rather
than guessing which formula is in the member's package.

## Persistence and review

- `product_variants` retains region, package size, packaging markers, and lifecycle.
- `product_identifiers` retains exact identifier authority and optional explicit
  formula linkage, while keeping unverified observations out of authoritative
  resolution.
- `product_formula_versions` is append-only and preserves source, observation
  date, region, packaging, and reformulation lineage.
- `product_resolution_cases`, evidence, and candidates preserve what was known
  at decision time. Customers may read only their own records and cannot write
  resolver outcomes directly.
- Ambiguous, formula-only, and insufficient cases create a `product_identity`
  founder task. `founder_resolve_product_identity` is service-only, idempotent,
  provenance-checked, and audit logged. Founder operations exposes a guarded
  detail action with candidate catalog facts and 15-minute signed evidence URLs.
- Customer and founder request UUIDs are concurrency-safe: simultaneous retries
  return the winning immutable case/audit result rather than creating duplicates
  or surfacing a unique-constraint failure.

## Current integration boundary

`scan-product` accepts an optional `resolutionCaseId`. When present, it derives
product labels from an owner-bound `verified_product_formula` case, rejects label
mismatches, and refuses unresolved cases. The local K4/S4 mobile integration now submits private capture evidence through the free Check path. Identity and formula results still follow the S6 trust states; this local path does not enable hosted guest activation.

The resolver securely stores photo evidence but does not yet perform live visual
or OCR extraction. Provider activation and extractor selection remain separate decisions. A future
extractor may propose candidate text or candidates; it may not bypass these trust
states. Current capture uses Expo Camera directly. Future work is assigned by
feature DRI with platform/truth and customer-experience stewardship, not by a
permanent client/server lane.

## Operational invariants

- A verified Auth session is required for every resolution. Managed Shelf and
  legacy managed photo paths require active membership; free Check can resolve
  sourced catalog evidence and use a server-granted private photo path locally.
- Evidence photos are private, immutable, excluded from analytics, and deleted
  Storage-first before account deletion completes.
- There is no numerical confidence or quality score in the customer contract.
- Unknown and ambiguous evidence remains unknown or ambiguous.
- Pure barcode checks query the existing `(identifier_type, identifier_value)`
  index and load only linked products, variants, and formulas. UPC-A and its
  single-zero-prefixed EAN-13 representation are queried as equivalent identifier
  assertions without changing the submitted barcode or equating other GTIN forms.
  Exact typed brand/name checks use a service-only normalized expression index;
  mixed barcode plus typed identity uses both complete bounded candidate sets.
  A 101st exact product is an explicit error, never a hidden winner.
- Replays read only the persisted case and at most eight candidate IDs, so later
  catalog growth cannot block an immutable result. Catalog-standard products and
  the requester's own shelf-linked provisional products remain visible; another
  customer's provisional products are excluded from barcode, typed, broad, and
  replay candidate presentation. Direct Data API product reads follow the same
  owner boundary: active managed members can read shared catalog-standard rows
  and their own shelf-linked provisional rows; guests remain limited to their
  own linked rows. Historical snapshots are not rewritten.
- Ingredient-list and label/packaging text resolution still need the broad
  catalog read to preserve formula and cross-product contradiction detection.
  An alias is a search hint, not a verified resolver identity. These remaining
  paths require a complete indexed evidence plan before large catalog activation.
- Broad catalog reads page deterministically past the API's 1,000-row response
  limit. Above 10,000 rows per identity table they fail closed, never silently
  search a truncated catalog. Pure barcode reads also fail closed if one exact
  GTIN (including its UPC-A/EAN-13 equivalent) has more than 100 identifier
  assertions.

## Historical S6 review and rollout checklist

S6 requires no new API key or model credential. Its deterministic resolver uses
the existing Supabase project configuration. A future OCR or visual provider is
separate work and must not be enabled through this rollout.

1. Review the shared contract, additive migration, trust-state resolver, and
   owner/founder access boundaries together.
2. Merge only after both CI jobs pass against the exact PR head.
3. Apply the additive migration to the intended hosted Supabase project before
   deploying code that queries the new tables.
4. Deploy `resolve-product-identity`, `scan-product`, `founder-operations`, and
   `delete-customer-account` from the same merged revision.
5. Smoke-test an active member's verified and unresolved cases, founder detail
   access, a 15-minute evidence URL, cross-member denial, and Storage-first
   account deletion.
6. Keep existing mobile behavior backward compatible until Kanuj separately
   adopts evidence upload, candidate confirmation, and `resolutionCaseId`.

Do not populate catalog truth from guessed fixture data during rollout. Until
authoritative identifier/formula records exist, the expected production result
is an unresolved case—not an invented match.
