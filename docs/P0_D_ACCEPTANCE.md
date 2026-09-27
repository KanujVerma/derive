# P0-D integrated customer and release experience

**DRI: Kanuj. Parent: [#100](https://github.com/KanujVerma/derive/issues/100).** P0-D owns the integrated customer outcome. This increment prepares and exercises the existing local product; it does not activate hosted guest access or release a binary.

Starting main: `22a210a7a720c9621d45e789b8690dcc73ab059a`. P0-A immutable truth and merged P0-B contracts/controllers are reused. [P0_B_EXECUTION.md](P0_B_EXECUTION.md) records P0-B source proof and its separate acceptance gates. The current sections of that ledger supersede older first-match/profile-target statements in [FIRST_CUSTOMER_TEST.md](FIRST_CUSTOMER_TEST.md).

## Customer integration delivered

- Free Account Privacy and Support now contain browser/native open failures, show a plain retry message, and reuse the configured URL on retry. Raw errors do not reach the customer. Account content scrolls with bottom safe-area padding.
- One local service journey uses real anonymous Auth, existing Edge APIs, `CustomerController`, the bound decision renderer, explicit Check-history saver and My Stuff mapper. It checks guest/free entry, catalog search, useful unknown, exact immutable facts, optional profile, personal decision, canonical routine/history, explicit memory, repeat Check, second-owner isolation and actual customer deletion. Catalog evidence is explicitly synthetic. It does not exercise a camera, app navigation or package OCR.
- A read-only release preflight records current Git and app/build configuration, or verifies supplied evidence against full source SHA, exact API environment, exact candidate binary and SHA-256 artifact hashes. It reports each gate independently. Missing evidence cannot become a pass; complete records require independent review and do not authorize release.

## Run the available checks

Use Node 22 and existing installed dependencies. No dependency addition is required.

```sh
node --experimental-strip-types scripts/preflight-customer-release.mjs --help
node --experimental-strip-types scripts/preflight-customer-release.mjs
node --experimental-strip-types scripts/test-p0d-customer-flow-local.mjs --help
node --experimental-strip-types scripts/test-p0d-customer-flow-local.mjs --dry-run
```

The metadata and dry run contact no services and read no dotenv or keys. `app.json` version and `eas.json` profile configuration are configuration, never installed build identity. Build numbers are remotely managed and cannot be inferred from `app.json`.

Only after the portfolio root grants the shared local-service lease, with the existing stack and Edge functions available, run from a clean committed checkout:

```sh
node --experimental-strip-types scripts/test-p0d-customer-flow-local.mjs --run --output /private/tmp/p0d-local-receipt.json
```

The script refuses every endpoint except `http://127.0.0.1:54321`. It never starts, resets or serves Supabase. It creates disposable guests and uniquely named/random-ID fixture catalog rows, then deletes only those rows. Actual customer deletion is through the customer Edge API. Cleanup failures fail the run. A receipt is created only after all assertions/cleanup pass and Git identity remains unchanged. The output path must be new; preserve the receipt and its printed hash outside the checkout. Function traces contain response hashes/statuses, not credentials or raw disclosures.

## Evidence format and review

`scripts/acceptance/p0d/releaseEvidence.ts` defines the exact required observation IDs. Supply a JSON manifest:

```json
{
  "version": 1,
  "target": {
    "sourceSha": "FULL_40_CHARACTER_SOURCE_COMMIT",
    "environment": { "kind": "hosted", "apiUrl": "https://PROJECT.supabase.co" },
    "binary": { "buildId": "ACTUAL_BUILD_ID", "version": "1.0.0", "buildNumber": "ACTUAL_BUILD_NUMBER", "bundleIdentifier": "com.derive.skincare" }
  },
  "evidence": [
    { "kind": "local_api", "path": "p0d-local-receipt.json", "sha256": "ACTUAL_FILE_SHA256" }
  ]
}
```

Artifact paths resolve relative to the manifest. Each artifact is a JSON report with `version:1`, its exact `kind`, `source:{sha,dirty:false}`, an actual `observedAt`, `fixtureMode`, and `checks:[{id,outcome:"passed",observation:"concrete observed result"}]`. Except source evidence, identify the actual environment and binary. Local API artifacts instead use the exact local environment, `binary:null`, and `fixtureMode:"synthetic_catalog"` or `"none"`. They cannot stand in for binary/device/hosted evidence. Source artifacts should point reviewers to the exact test/export outputs and exact-head CI run. Binary/device/hosted/customer reports require `fixtureMode:"none"`.

```sh
node --experimental-strip-types scripts/preflight-customer-release.mjs --manifest /path/to/candidate.json
```

Missing gates exit 2. Invalid source, artifacts, environment, binary, missing observations or fixture substitution exit 1. Complete records return `REVIEW_REQUIRED`, never release approval. Hashes establish which record was reviewed; they do not establish that a manually authored observation is true. Review original command/CI records, device recordings and binary metadata. Do not put tokens, credentials, photos, identifying details or sensitive skin answers in these records.

| Gate | What clears its evidence requirement | What does not |
| --- | --- | --- |
| Source | Full tests/types/export/scope and exact-head CI for candidate SHA | Dirty checkout, old CI or export alone |
| Local API | Generated receipt from actual local Auth/Edge/persistence/controller run | Dry run, mocked gateway or UI fixture |
| Binary | Existing candidate metadata plus installed identity and embedded runtime/environment/offer inspection | App config, EAS profile name or development export |
| Simulator | Actual candidate journey on Simulator | Compile/export or source tests |
| Physical | Actual candidate on supported iPhone, interactions/camera/recovery/small screen/large text | Simulator or development fixture |
| Hosted | Actual intended backend lifecycle/privacy/deletion and service journey | Local Supabase or old managed-first staging |
| TestFlight | Installed exact candidate and customer journey/environment | A build in EAS or submission alone |
| Human | Eligible unassisted session with recommendation/reason/routine/uncertainty/next-step understanding | Guided developer QA or imaginary tester |

## Consumer bar for bounded composition

After Sami's merged capture contracts are available, the root coordinates one composition pass:

1. Fresh install establishes intended free/guest entry and opens Check without long intake or membership setup. Facts remain useful before optional profile. Current hosted flavors still use legacy presentation; P0-C activation is required.
2. One obvious camera/search entry. Barcode capture operates automatically; customers do not choose technical evidence roles first. Uncertain routing offers short manual correction. Verify shutter, permission/cancel/retry, torch, safe areas, preserved useful photos and back navigation. Sami owns this implementation; no competing controller is introduced.
3. Product resolves to supported facts or an honest useful unknown. Search/barcode/more evidence/manual recovery must not fabricate identity, formula or safety. Photo capture is private evidence collection. No OCR/image recognition claim until the actual implementation and real-image evidence exist.
4. Catalog contribution is a Sami dependency. Do not display a working "help add product" affordance until submission/storage/review/promotion actually exists. Current unknown recovery uses the existing search/barcode/manual path.
5. Optional personalization refreshes the same immutable result. Skip remains useful; critical unanswered/withheld context stays unknown. Personal action, all material cautions, reason and next step remain evidence-bound.
6. Routine/history edits persist and refresh the decision; self-reported experience remains a report. My Stuff saves require explicit action. Repeat Check uses current owner/context; session changes clear retained personal results.
7. Account/privacy/support are reachable, failed links/actions recover, actual deletion removes private data, and free/Managed/adult cosmetic scope match the binary. No unverified support-contact claim or activated billing claim.
8. Unassisted adult tester states what Derive recommends, why, what changes, what is uncertain and what to do next. Record hesitation/recovery without coaching the happy path. The user will arrange this tester later.

## Current acceptance truth

Source/account regression, metadata safety and evidence-validator tests can run independently. The actual local script requires the shared-service lease. Native account layout and real link-opening observation require the device/Simulator lease. Physical, hosted, actual beta binary, TestFlight and unassisted customer gates remain open until their own evidence exists. The P0-B acceptance lead exclusively controls the shared DB and devices this wave. No new EAS build, hosted activation, provider call, release, billing or catalog contribution architecture is part of this increment.

## Public page observation, 2026-09-27

Read-only HTTP checks returned 200 at the configured [Support](https://derive-beta-site.vercel.app/support), [Privacy](https://derive-beta-site.vercel.app/privacy) and [Privacy choices](https://derive-beta-site.vercel.app/privacy-choices) pages. This establishes public-page reachability, not an in-app native open or support-response test. The public copy describes managed cosmetic skincare, password-based account details/baseline onboarding, and deletion through Founding Beta Access/Account. The intended anonymous free Check experience uses different entry and deletion wording. Reconcile those pages with the actual candidate before clearing the release privacy/support gate. No hosted page was edited, no email sent, and no support response claimed. Temporary fetched HTML remains under `/private/tmp/p0d-{support,privacy,privacy-choices}.html`.

## Actual local service proof at the reconciled predecessor

On 2026-09-27, clean source `82dd0c5ae49b7f83eaaa52227c66446756a8c71f` (rebased onto merged scanner-readiness main `8ec9fe57ee2a341cf058da6818cab1227984aaea`) passed the actual local journey under the root-granted shared-service lease. All 12 required checks passed across 32 Edge calls; the foreign-owner case save returned the expected 404. The existing customer controller and bounded renderer consumed actual stored truth/context, produced the supported optional-context action, and refreshed repeat Check to KEEP_CURRENT after canonical routine/history. Explicit My Stuff retained unknown/manual distinctions; customer deletion and generated fixture absence were checked.

Receipt: `/private/tmp/p0d-local-receipt-82dd0c5.json`; actual file SHA-256 `4baebb82f81c27553cc3436bc71f789d4ad2bfcaee496266aa5311265a4a49fb`. Runtime: exact local Supabase, existing served Edge functions, synthetic random-ID catalog fixtures, no installed binary. The lease was returned with stack/forwards/devices untouched. This is immutable predecessor proof; if the final source SHA changes, rerun the journey on the final clean revision or execute it in registered exact-head CI. It is not camera/UI, physical, hosted, TestFlight or human-comprehension evidence.

Reconciled source validation passed: 69 test files, 604 TAP cases plus assertion-only scripts, application/test TypeScript, web and iOS exports, exact write-set/secret/diff checks. Exact-head publication CI and all actual candidate/device/hosted/customer release gates remain separate.
