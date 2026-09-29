# Catalog coverage benchmark: target-cohort useful scan hit rate

This is a **read-only, offline evaluation tool**, not an importer or a live product source. A Scandit or Expo camera can decode a barcode; neither supplies the product identity or formula. External catalog records may propose candidate identity. Only separately reviewed canonical evidence can support a verified product/formula claim.

## Current gate

No representative U.S. launch-scope personal-care barcode corpus has been supplied or measured. Running the tool without inputs reports `RIGHTS_CLEARED_US_PERSONAL_CARE_CORPUS_REQUIRED`; the synthetic unit tests are **not** provider coverage evidence. No source wins by default. Do not present hit rates from fewer, hand-picked items as launch coverage.

To build the corpus, ask the intended first users to select products they actually own or would scan in a store, with permission for evaluation. Record a scan encounter per selection (the same GTIN may appear for multiple people). For each encounter, privately retain the printed GTIN/UPC, product front/size/variant and barcode evidence, independent product identity, category, shopping channel, whether the physical app decoded it, and an opaque reference to permission and evidence. No face photos, health profile, participant names, purchase histories, or scraped retailer pages are needed. Source terms and the contributor's permission must independently allow each proposed provider query. Keep raw evidence and manifests out of Git.

For a rapid 24-hour signal, collect an initial 20–30 encounters from the actual intended launch mix, reporting the small-sample caveat and every missing category. Then expand to at least ~100 target-cohort encounters from multiple people and shopping channels before treating a rate as a launch decision. The allowed categories are `facial_cleanser`, `facial_moisturizer`, `sunscreen`, `facial_serum`, `facial_treatment`, `deodorant`, `antiperspirant`, `shampoo`, `conditioner`, `body_wash`, `body_moisturizer`, and `other`. Do not put the named new categories into `other`. For hybrid products, choose the primary marketed purpose once and note secondary claims in private evidence so one encounter is not double-counted. Channels are `drugstore`, `mass_retail`, `beauty_retail`, `warehouse_club` (for Costco-style stores), `direct_brand`, and `other`. Prefer participants' actual product mix over an artificially balanced catalog. Retain category/channel slices to expose, for example, strong shampoo coverage but poor sunscreen coverage. Record recruitment and sampling method, repeat-product frequency, packaging-only or missing-barcode cases, and a date. A convenience sample is not automatically representative.

## Inputs and independent adjudication

Make a **private** `corpus.json` from [the intake template](catalog-coverage/INTAKE_TEMPLATE.json). Fill a unique opaque `id` for each scan encounter. `gtin` is the normalized GTIN-8/12/13/14 with a valid check digit; expand UPC-E to UPC-A before entry, and keep the original scanner observation in private evidence. For a missing/unreadable barcode with no queryable GTIN, use `gtin: null` and `scan.decoded: false`, never a fabricated code. If the printed GTIN is known but the camera failed to decode it, retain the real GTIN and the observed `false` outcome. `scan.decoded` is the **observed device outcome**, not an assumption that the code can be decoded. `reference.identity` must come from the physical product/owner evidence, independently of the provider result. Exact `canonicalProductId` and `formulaSnapshotId` appear only if Derive has already reviewed and linked them. The rights references are opaque pointers to private proof; setting `providerEvaluationAllowed` to `true` must follow a real permissions/terms check, not mere possession of a photo or barcode.

Prepare a separate private `runs.json` array. Each source requires a pinned `adapterVersion`, `evaluationPermissionRef`, `termsReviewRef`, and `corpusSha256`. For each queryable case, record `candidate`, `miss`, `error`, or `timeout`, observed latency, the minimal identity fields, source record reference, retrieval time and source dataset version. For `gtin: null`, record only `no_barcode`, zero latency, `claim: candidate`, and an honest fallback action; this is an unqueryable encounter, **not** a provider miss or a provider call. A second reviewer compares a candidate with the physical/reference product and records `exact`, `possible`, `wrong`, or `unknown`, with reviewer/evidence references. A source's own “verified” label is not adjudication. `possible` is assisted recovery, **not** an identity recovery unless a separate observed customer confirmation of the exact package and variant is recorded in `review.customerConfirmation` with its own evidence reference. An external source can never produce a verified formula claim directly. Do not store API keys or entire third-party records in the runs file.

Identity recovery is not yet a useful skincare result. After watching the user use the actual result, optionally record `review.customerUsefulness: { "usefulSkincareResult": true | false, "evidenceRef": "private-observation-001" }`. A positive requires a concrete useful skincare/personal-care fact or decision from that result, not merely recognizing a name, tapping confirmation, liking the design, or receiving generic retry copy. Keep the user's reason and what was shown in the referenced private observation. Never infer this observation from the provider response. Absence means **unmeasured** and cannot contribute to the useful-hit numerator; the encounter remains in the denominator. User-reported usefulness is not an audit of factual/clinical correctness: wrong identities and unsupported formula claims still cannot earn a useful hit even if a user liked them.

For field shape only, this **fabricated** case uses an all-zero test code and must be replaced before evaluation:

```json
{
  "id": "opaque-encounter-001",
  "gtin": "000000000000",
  "category": "facial_moisturizer",
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
  "review": {
    "identityMatch": "possible",
    "reviewerRef": "reviewer-001",
    "evidenceRef": "private-comparison-note-001",
    "customerUsefulness": { "usefulSkincareResult": false, "evidenceRef": "private-observation-001" }
  }
}
```

The permitted `action` values are `confirm_candidate`, `show_verified_product`, `show_verified_formula`, `capture_label`, `search_name`, `report_missing`. Set `claim` to `candidate`, `canonical_product`, or `canonical_formula` to audit whether proposed UI copy overstates evidence. External sources that claim a canonical product or formula score a false-certainty event even if their text looks right. A canonical source must match the independently supplied IDs to earn verified counts. Wrong or unreviewed candidate presentation is also false certainty.

## Run and interpret

Keep files in a local private folder (not Git). Compute the corpus digest from the **exact file bytes**, for example `shasum -a 256 /private/path/corpus.json`. The optional CLI with no arguments is a safe readiness check:

```sh
node --experimental-strip-types scripts/catalog-coverage-benchmark-cli.ts
node --experimental-strip-types scripts/catalog-coverage-benchmark-cli.ts /private/path/corpus.json <sha256> /private/path/runs.json
```

### Opt-in Open Beauty Facts evaluation

The separate [Open Beauty Facts evaluator](../scripts/open-beauty-facts-evaluation.ts) is **not a live app dependency**. With no arguments, its CLI makes zero network calls:

```sh
node --experimental-strip-types scripts/open-beauty-facts-evaluation-cli.ts
```

Before any real query, create a frozen private corpus, independently document collection permission and source terms, mark **every queryable** encounter `providerEvaluationAllowed: true` only after review, and register an external source row with id `open-beauty-facts`, `evaluationPermissionRef`, and `termsReviewRef`. Missing-barcode rows make no query and may retain `false`. Use a real identifying `DeriveCatalogEval/1.0 (contact-email-or-URL)` User-Agent. Confirm no other process on the same public IP is using the Open Beauty Facts product API during the run; local pacing alone cannot observe unrelated traffic behind the same IP. An operator can then explicitly invoke:

```sh
umask 077
node --experimental-strip-types scripts/open-beauty-facts-evaluation-cli.ts --execute-reviewed /private/path/corpus.json <sha256> <evaluationPermissionRef> <termsReviewRef> 'DeriveCatalogEval/1.0 (contact@example.com)' <unique-GTIN-count> > /private/path/obf-pending.json
```

This is a deliberately manual, rights-gated command; **do not run it just to smoke-test the code**. The runner uses the exact-barcode Open Beauty Facts v3 URL and minimal identity fields (`code,brands,product_name,quantity,categories,last_modified_t`) used by the candidate read-through path. It never requests photos, ingredients or formulas; does not save raw JSON; rejects barcode redirects/unrelated returned codes; treats UPC-A and its leading-zero EAN-13 as the same code; and sends one request per distinct normalized GTIN. The pending output uses a SHA-256-based opaque record reference rather than printing the raw GTIN; the separately kept private corpus is needed to recover the query context. A 6-second minimum between starts limits this local runner to at most 10 product reads/minute, below the [project's 15 reads/minute/IP limit](https://openfoodfacts.github.io/openfoodfacts-server/api/). It times out each response after 2.5 seconds, caps it at 32 KiB, stops on 429/503/timeout, and a local process lock prevents parallel runs on this host. A crash may leave the lock: inspect other activity before removing it. The source's [cosmetics API documentation](https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/tutorials/scanning-cosmetics-pet-food-and-other-products/) notes that Open Beauty Facts behavior may evolve.

The emitted JSON is **pending adjudication**, not a scored run. Candidate rows deliberately omit `review`; the offline scorer rejects them until a separate reviewer compares each candidate to the physical package and records `identityMatch`, `reviewerRef`, and `evidenceRef` (and, only if observed, `customerConfirmation` and `customerUsefulness`). Use `adjudicateOpenBeautyFactsRun` to combine those independently recorded reviews and validate the result, or add those review objects to a private copy of the pending run and wrap that run in the `runs.json` array for the offline CLI above. Neither tool fills observations itself. Identity-only OBF evaluations report identity recovery, **not** useful scan hits. Missing-barcode rows are emitted without fetching and remain in the denominator. Keep pending and reviewed files private, and never copy their product fields into canonical tables without a separate license and truth review.

The offline scorer makes no network calls or database writes, requires an exact digest, refuses symlink input, bounds file reads, and reports only aggregate metrics. The separate opt-in evaluator does make provider reads and emits minimal private candidate labels for adjudication, but no raw GTIN, source URL, rights proof or provider payload. Keep that pending file private. Missing run rows remain `NOT_RUN` in the full frozen denominator; errors/timeouts do not disappear. The headline provider rates stay `null` until that source has a result for every encounter; `usefulScanHitLowerBound` is only a partial-run diagnostic. Compare sources on the **same** corpus digest and inspect category/channel slices and median/p95 latency. A partial run is not competitive evidence against a complete run.

The launch metric is `rates.usefulScanHit`: a physically decoded barcode, independently adjudicated exact identity (or separately observed exact-package/variant confirmation), correctly qualified presentation, **and explicitly observed useful skincare result**, divided by **all target-cohort scan encounters**. This is a conservative user-observed usefulness measure with an identity/authority audit, not evidence of clinical effectiveness or independent validation of every displayed fact. A barcode/name-only provider benchmark cannot establish this end-to-end metric. This differs from:

- `rates.decode`: camera decode only, which says nothing about product coverage;
- `rates.candidate`: any source record, including wrong or uncertain identity;
- `rates.identityRecovery`: decoded, exact/confirmed identity with warranted presentation, even when no useful skincare result was observed;
- `rates.userReportedUsefulness`: positive usefulness reports divided only by observed reports; show `counts.usefulnessObserved` and `counts.usefulnessUnmeasured` alongside it. This satisfaction diagnostic is **not** the launch rate or a correctness metric;
- `rates.verifiedExactProduct` and `rates.verifiedFormula`: separately supported canonical evidence, never automatically promoted from external data;
- `rates.honestNextAction`: includes a useful fallback after an unknown/miss, but a generic fallback is **not** counted as a useful scan hit.

Review source licensing before even evaluation queries. In particular, do not bulk copy Open Beauty Facts/ODbL or commercial provider records into proprietary canonical tables before storage, attribution, reuse and share-alike obligations are reviewed. A read-through candidate is not a permanent license to redistribute source data. No benchmark result authorizes a production provider integration or changes formula truth.

The source status `COMPLETE` means every encounter has an outcome, not that usefulness was observed for every result. `counts.executed` counts recorded encounter outcomes, including `noBarcode`; it is not the provider-request count. Provider median/p95 exclude zero-query `no_barcode` rows. Missing-barcode, decode-failed, unrun, miss, error and timeout encounters never leave the frozen denominator. No real target corpus has been fabricated in this reconciliation.

### Reconciled review gates

This slice was reconciled with main `44eea2` (the indexed ingredient runtime landing) without changes to `app/**`, shared resolver contracts or database migrations. The existing schema accepts older reviewed runs, but absent usefulness observations now deliberately score zero useful hits; `identityRecovery` retains the previous identity-only diagnostic. Newly emitted OBF runs pin adapter version `obf-v3-eval-2`. Re-score old results rather than comparing the old identity-only headline with the new end-to-end rate. The 22 focused tests cover false-positive satisfaction, missing observation, zero-query missing-barcode encounters, full denominators, source authority, rights, bounds and private CLI output. Fresh local validation passed all 836 current tests, both TypeScript checks, web/iOS JavaScript exports and diff checks; exact-head CI remains the merge gate. Exports are not binary/device acceptance. No local database reset is needed for this offline-only diff. Physical encounters and observed useful result evidence are still required from founders before a real coverage claim.

## Handoff to live candidate layer

This benchmark deliberately keeps the measurement contract outside `supabase/**` and `app/**`. A future server-side read-through resolver should accept the decoded GTIN, return **candidate identity plus source, retrieval time and evidence**, and preserve an unknown state when no defensible match exists. Its output must not mutate canonical products/formula snapshots. Provider rollout requires a separately reviewed terms decision, rate/cost guardrails, request timeout, and a source-specific provenance readback. Mobile must display “possible match” until exact variant is confirmed and must not infer an ingredient formula from a UPC hit.
