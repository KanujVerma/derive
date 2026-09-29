# External barcode candidates (evaluation-only)

Derive's reviewed catalog remains the only source of canonical product/variant and
formula truth. The first broad-coverage adapter is a disabled-by-default,
authenticated Open Beauty Facts (OBF) **read-through** for exact barcode identity
candidates. It does not populate `products`, `product_variants`,
`product_identifiers`, `product_formula_versions`, S6 resolution cases, or
customer history. It does not feed formula evaluation. The canonical S6 resolver
and customer Check behavior are unchanged.

## Interface

`POST /functions/v1/external-product-candidates` with `{ "barcode": "<valid GTIN>" }`
requires a valid Supabase Auth session (a guest session is sufficient). The
endpoint returns one of `found`, `not_found`, `incomplete`, `rate_limited`, or
`unavailable`. `rate_limited` returns HTTP 429 without an automatic retry. A
`found` response has one candidate with source
`open_beauty_facts`, `sourceLicense: ODbL-1.0`, exact barcode, source page URL,
retrieval time, optional source modification time, observed barcode and OBF's
returned barcode, brand/name/quantity/category,
`canonicalProductId: null`, and `formulaVerified: false`. All other statuses
have `candidate: null`. Callers must never translate `found` into a verified
Derive product or use OBF ingredient text as verified formula data.

The adapter queries the official OBF v3 endpoint once with only bounded
identity fields and a contactable User-Agent. The response is capped at 32 KiB,
times out after 2.5 seconds, refuses redirects, validates exact source barcode
or only its UPC-A/zero-prefixed EAN-13 equivalent,
and never returns upstream raw JSON. Provider errors and malformed content are
unavailable, not fabricated matches.

## Activation gate

`DERIVE_OBF_CANDIDATES_ENABLED` must equal `true` in the **server-only** Edge
environment for any lookup to occur. It is deliberately unset by default. Do
not activate in hosted production or call it from mobile until all of these are
resolved:

1. Review ODbL attribution, database-rights, storage, reuse, share-alike, and
   commercial-use implications for the proposed response and any cache. No bulk
   import into proprietary canonical tables is authorized.
2. Validate the new durable, atomic request reservation on local and hosted
   disposable users. It caps a user at 10/minute and 100/day, and all users at
   12/minute and 1,000/day. The global minute cap leaves headroom below the
   [published product-read limit of 15/minute/IP](https://openfoodfacts.github.io/openfoodfacts-server/api/#rate-limits)
   (checked 2026-09-29). Each outbound attempt counts, even if OBF is down;
   provider 429 is passed back without an automatic retry. Add provider-wide
   backoff/monitoring before scale. Existing photo-grant quotas and measurement
   caps remain separate. Do not enable hosted until the migration and endpoint
   are deployed from the same reviewed revision and acceptance is complete.
3. Benchmark representative U.S. skincare barcodes for exact hit, useful
   identity, variant ambiguity, stale/misclassified products, 429, and latency.
   Compare with the canonical-only baseline. Do not use row count as the launch
   metric.
4. Decide how candidate suggestions are presented, confirmed, and (if allowed)
   retained without violating S6 case immutability or implying formula truth.
   Kanuj owns the customer-facing Check integration.

The OBF API documentation describes the [v3 barcode endpoint](https://openfoodfacts.github.io/documentation/docs/Product-Opener/v3/products/get-api-v3-product-code/)
and [Beauty-specific behavior](https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/tutorials/scanning-cosmetics-pet-food-and-other-products/).
