# Product Identity and Formula Provenance

S6 establishes one backend resolver for product evidence captured by Scan or
Shelf. It separates four questions that must not be collapsed:

1. What product family might this be?
2. Which exact variant, region, package, and identifier does the evidence support?
3. Which formula version does that exact package support?
4. Is the evidence authoritative enough to evaluate the product for this member?

## Stable interface

`POST /functions/v1/resolve-product-identity` requires an authenticated active
member and the contract in
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
mismatches, and refuses unresolved cases. Existing manual-name evaluation stays
backward compatible until Kanuj adopts the new mobile contract.

The resolver securely stores photo evidence but does not yet perform live visual
or OCR extraction. Provider activation is a separate H1P decision. A future
extractor may propose candidate text or candidates; it may not bypass these trust
states. Mobile Shelf/Scan capture and confirmation UX remains Kanuj-owned and is
not silently changed by S6.

## Operational invariants

- A verified Auth session is required for every resolution. Managed Shelf and
  legacy managed photo paths require active membership; free Check can resolve
  sourced catalog evidence and use a server-granted private photo path locally.
- Evidence photos are private, immutable, excluded from analytics, and deleted
  Storage-first before account deletion completes.
- There is no numerical confidence or quality score in the customer contract.
- Unknown and ambiguous evidence remains unknown or ambiguous.
- Catalog reads page deterministically past the API's 1,000-row response limit.
  Above 10,000 rows per identity table the resolver fails closed until an indexed
  retrieval milestone replaces bounded in-memory matching; it never silently
  searches a truncated catalog.

## Review and rollout checklist

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
