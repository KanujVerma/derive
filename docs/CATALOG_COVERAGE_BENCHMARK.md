# Catalog coverage benchmark: target-cohort useful scan hit rate

This is a **read-only, offline evaluation tool**, not an importer or a live product source. A Scandit or Expo camera can decode a barcode; neither supplies the product identity or formula. External catalog records may propose candidate identity. Only separately reviewed canonical evidence can support a verified product/formula claim.

## Current gate

No representative U.S. skincare barcode corpus has been supplied or measured. Running the tool without inputs reports `RIGHTS_CLEARED_US_SKINCARE_CORPUS_REQUIRED`; the synthetic unit tests are **not** provider coverage evidence. No source wins by default. Do not present hit rates from fewer, hand-picked items as launch coverage.

To build the corpus, ask the intended first users to select products they actually own or would scan in a store, with permission for evaluation. Record a scan encounter per selection (the same GTIN may appear for multiple people). For each encounter, privately retain the printed GTIN/UPC, product front/size/variant and barcode evidence, independent product identity, category, shopping channel, whether the physical app decoded it, and an opaque reference to permission and evidence. No face photos, health profile, participant names, purchase histories, or scraped retailer pages are needed. Source terms and the contributor's permission must independently allow each proposed provider query. Keep raw evidence and manifests out of Git.

For a rapid 24-hour signal, collect an initial 20–30 encounters across cleanser, moisturizer, sunscreen, serum and treatment, reporting the small-sample caveat and every missing category. Then expand to at least ~100 target-cohort encounters from multiple people and shopping channels before treating a rate as a launch decision. Prefer participants' actual product mix over an artificially balanced catalog. Retain category/channel slices to expose, for example, strong cleanser coverage but poor sunscreen coverage. Record recruitment and sampling method, repeat-product frequency, packaging-only or missing-barcode cases, and a date. A convenience sample is not automatically representative.

## Inputs and independent adjudication

Make a **private** `corpus.json` from [the intake template](catalog-coverage/INTAKE_TEMPLATE.json). Fill a unique opaque `id` for each scan encounter. `gtin` is the normalized GTIN-8/12/13/14 with a valid check digit; expand UPC-E to UPC-A before entry, and keep the original scanner observation in private evidence. `scan.decoded` is the **observed device outcome**, not an assumption that the code can be decoded. `reference.identity` must come from the physical product/owner evidence, independently of the provider result. Exact `canonicalProductId` and `formulaSnapshotId` appear only if Derive has already reviewed and linked them. The rights references are opaque pointers to private proof; setting `providerEvaluationAllowed` to `true` must follow a real permissions/terms check, not mere possession of a photo or barcode.

Prepare a separate private `runs.json` array. Each source requires a pinned `adapterVersion`, `evaluationPermissionRef`, `termsReviewRef`, and `corpusSha256`. For each case, record `candidate`, `miss`, `error`, or `timeout`, observed latency, the minimal identity fields, source record reference, retrieval time and source dataset version. A second reviewer compares a candidate with the physical/reference product and records `exact`, `possible`, `wrong`, or `unknown`, with reviewer/evidence references. A source's own “verified” label is not adjudication. `possible` must be presented for customer confirmation; an external source can never produce a verified formula claim directly. Do not store API keys or entire third-party records in the runs file.

For field shape only, this **fabricated** case uses an all-zero test code and must be replaced before evaluation:

```json
{
  "id": "opaque-encounter-001",
  "gtin": "000000000000",
  "category": "moisturizer",
  "channel": "drugstore",
  "scan": { "decoded": true, "deviceEvidenceRef": "private-device-note-001" },
  "reference": {
    "identity": { "brand": "Fiction", "name": "Synthetic Lotion", "variant": "Plain", "packageSize": "100 mL", "region": "US" },
    "evidenceRef": "private-front-back-note-001"
  },
  "rights": {
    "collectionEvidenceRef": "private-collection-note-001",
    "permissionEvidenceRef": "private-permission-note-001",
    "providerEvaluationAllowed": false
  }
}
```

The source manifest row is `{ "id": "source-id", "kind": "external", "evaluationPermissionRef": "private-source-eval-terms", "termsReviewRef": "private-license-review" }`. An external run row for a successful lookup is shaped as follows; the real value of `identityMatch` requires a separate review and must not be copied from the provider:

```json
{
  "caseId": "opaque-encounter-001",
  "outcome": "candidate",
  "latencyMs": 120,
  "action": "confirm_candidate",
  "claim": "candidate",
  "candidate": {
    "identity": { "brand": "Fiction", "name": "Synthetic Lotion", "variant": "Plain", "packageSize": "100 mL", "region": "US" },
    "recordRef": "private-provider-record-001",
    "retrievedAt": "2026-09-28T00:00:00Z",
    "datasetVersion": "record-version-or-as-of-date"
  },
  "review": { "identityMatch": "possible", "reviewerRef": "reviewer-001", "evidenceRef": "private-comparison-note-001" }
}
```

The permitted `action` values are `confirm_candidate`, `show_verified_product`, `show_verified_formula`, `capture_label`, `search_name`, `report_missing`. Set `claim` to `candidate`, `canonical_product`, or `canonical_formula` to audit whether proposed UI copy overstates evidence. External sources that claim a canonical product or formula score a false-certainty event even if their text looks right. A canonical source must match the independently supplied IDs to earn verified counts. Wrong or unreviewed candidate presentation is also false certainty.

## Run and interpret

Keep files in a local private folder (not Git). Compute the corpus digest from the **exact file bytes**, for example `shasum -a 256 /private/path/corpus.json`. The optional CLI with no arguments is a safe readiness check:

```sh
node --experimental-strip-types scripts/catalog-coverage-benchmark-cli.ts
node --experimental-strip-types scripts/catalog-coverage-benchmark-cli.ts /private/path/corpus.json <sha256> /private/path/runs.json
```

The tool makes no network calls or database writes, requires an exact digest, refuses symlink input, bounds file reads, and reports only aggregate metrics. No raw GTIN, product label, source URL, rights proof or provider payload is printed. Missing run rows remain `NOT_RUN` in the full frozen denominator; errors/timeouts do not disappear. The headline provider rates stay `null` until that source has a result for every encounter; `usefulScanHitLowerBound` is only a partial-run diagnostic. Compare sources on the **same** corpus digest and inspect category/channel slices and median/p95 latency. A partial run is not competitive evidence against a complete run.

The launch metric is `rates.usefulScanHit`: a physically decoded barcode plus an independently adjudicated exact/possible candidate and a correctly qualified next action, divided by **all target-cohort scan encounters**. This differs from:

- `rates.decode`: camera decode only, which says nothing about product coverage;
- `rates.candidate`: any source record, including wrong or uncertain identity;
- `rates.verifiedExactProduct` and `rates.verifiedFormula`: separately supported canonical evidence, never automatically promoted from external data;
- `rates.honestNextAction`: includes a useful fallback after an unknown/miss, but a generic fallback is **not** counted as a useful scan hit.

Review source licensing before even evaluation queries. In particular, do not bulk copy Open Beauty Facts/ODbL or commercial provider records into proprietary canonical tables before storage, attribution, reuse and share-alike obligations are reviewed. A read-through candidate is not a permanent license to redistribute source data. No benchmark result authorizes a production provider integration or changes formula truth.

## Handoff to live candidate layer

This benchmark deliberately keeps the measurement contract outside `supabase/**` and `app/**`. A future server-side read-through resolver should accept the decoded GTIN, return **candidate identity plus source, retrieval time and evidence**, and preserve an unknown state when no defensible match exists. Its output must not mutate canonical products/formula snapshots. Provider rollout requires a separately reviewed terms decision, rate/cost guardrails, request timeout, and a source-specific provenance readback. Mobile must display “possible match” until exact variant is confirmed and must not infer an ingredient formula from a UPC hit.
