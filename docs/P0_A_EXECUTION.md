# P0-A execution and evidence ledger

Status: AUTOMATED IMPLEMENTATION INTEGRATED; PHYSICAL/REAL-IMAGE ACCEPTANCE BLOCKED. DRI Sami; product/formula-truth steward Sami, customer-experience steward Kanuj. No hosted activation or provider selection is authorized by this increment.

## Recovered checkpoint

Base `45f1773e4983c3c28848839c65640b7681b89d8e`, inspected 2026-09-26. Main CI run [36277810693](https://github.com/KanujVerma/derive/actions/runs/36277810693) passed. Main requires Verify & Build. Repository token can push but cannot administer. Project metadata query failed: token lacks `read:project`; issue/PR metadata is available. Original `app` checkout has unfinished auth changes and is preserved.

| Evidence | Current reality | Required P0-A change |
| --- | --- | --- |
| ProductIdentityResolver contract / S6 Edge | Five categorical states; product and formula separate | Add authoritative versioned snapshot without breaking existing fields |
| S6 migrations / catalog ingestion | Append-only formula versions, owner cases, service-only promotion | Reuse, only add durable snapshot persistence if needed |
| Capture processor / remote grants | Three roles, immutable private uploads, retry IDs; typed remote daily limit becomes generic PREPARE_FAILED | Carry quota into customer recovery; preserve owner/session isolation |
| Expo Camera / catalog search | Barcode and typed search work locally; no image extractor | Preserve truthful photo abstention; neutral extraction boundary and honest evaluation harness |
| Founder operations | Existing managed identity queue and service-only review; free cases deliberately do not queue | Audit authorization/promotion; do not create an unbounded free queue |
| P0-B issues #74–78 | Active independent contracts/context/policy/personalization | Supply fixtures and stable truth contract; no competing P0-B truth authority |
| PRs #35 / #71 | Open, conflicting, unrelated observability / GTM | Leave unchanged |
| Legacy #6–9 | Historical platform milestones do not specify current P0-A | Do not recreate or blanket-close; only reconcile proven P0-A overlap |

## Architecture challenge and minimal contract direction

Extend S6, not a new resolver. `ProductTruthSnapshotV1` uses schemaVersion 1, opaque snapshot/case IDs, creation time and resolver version; existing categorical resolution state; separate supported product identity, exact variant and verified formula; ordered ingredients only from an authoritative exact formula record; catalog/evidence references; typed missing-evidence/conflict reasons; confirmation/review status. No numeric confidence, health score, personalized findings, raw photos/paths/OCR, invented concentrations, provider-derived authority, or catalog-wide version invented from mutable rows.

An immutable snapshot must survive catalog changes and retries. Reconstructing old results against today's catalog is insufficient. Snapshot persistence is therefore a justified additive migration, not a mirror of an ideal diagram. Any newly reviewed case produces a new snapshot rather than rewriting an old one. Public provenance must be explicitly approved, never an internal source reference. Formula-only evidence cannot prove which package is in hand. Customer choice cannot verify a formula. Conflicting submitted evidence must prevent a confident exact match.

Photo extraction providers are not selected. Without approved credentials and rights-cleared representative images, only synthetic truth cases and a runnable evaluator are deliverable; no real-image accuracy/latency/cost winner can be claimed.

## Dependency graph / ownership

Repository recovery → root contract/fixture freeze → independent leaf implementation → serial snapshot/runtime composition → fresh full reset, security/integration/unit/export gates → exact-head CI → scoped PR merges → physical acceptance and P0-B handoff.

| Track | Single writer / write-set | Dependency |
| --- | --- | --- |
| Contract / persistence / root wiring | Root: ProductTruthSnapshot contract, ProductIdentityResolver additive field, snapshot migrations, resolver Edge, CI registration, canonical docs | Existing S6 audit |
| Capture recovery | Sol capture agent: capture leaf processor, recovery copy, capture UI only, focused tests | Existing evidence service; no root Check edits |
| Resolver/catalog/review audit | Sol audit agent: initial read-only audit, then explicitly assigned pure resolver fixes/tests | Existing S6; no migration/Edge edits |
| Synthetic corpus / provider evaluation | Sol evaluation agent: evaluation contracts, synthetic fixtures, harness/tests, evaluation doc | Existing resolver; root snapshot contract handoff later |
| Global Check / navigation / P0-B | Kanuj P0-B root remains active writer | Coordinate leaf presentation integration; no concurrent edits |

High-contention contracts, migrations, resolver Edge, runtime composition, CI and canonical docs are root-only. Every agent uses a separate branch/worktree based on the recovered checkpoint. No same-checkout editing.

## Validation and completion gates

Repository-native full unit suite; app and test TypeScript; web and iOS JS export; diff/secret/boundary review; backend full reset, pgTAP, existing Edge integration plus new snapshot/ownership/replay smoke; exact-head Verify & Build and Database & Integration. Unit tests do not prove physical camera/permissions/haptics. Record all 26 customer scenarios with evidence or an explicit unverified/blocker status. Synthetic provider tests do not prove real-image quality. Hosted anonymous operations/release remain P0-C/P0-D, not this task.

## Landings and integrated evidence

Parent #81; contract/producer #82; capture #83; resolver/review #84; evaluation #85; acceptance #86. Contract #87 merged as `773a4b839f37712f345a20118b908c4d4eba0bae`, exact-head CI run [36282262084](https://github.com/KanujVerma/derive/actions/runs/36282262084) passed both jobs. #82 was reopened because its runtime producer was not complete at the contract landing. Original dirty auth checkout remains untouched. Unrelated #35/#71 and historical #6–9 remain unchanged.

The second increment serially composes leaf commits and root production: additive `20260927010000_p0a_product_truth_snapshots.sql`; immutable owner snapshots per case/review; fail-closed client parsing; exact ingredients/market/Unicode/punctuation/identifier conflicts; typed quota/session recovery; capture operation gate; mixed evidence retention; readonly existing-grant upload-status recovery; neutral extraction contract/corpus/evaluator. No server function imports a client filesystem path. Actual live Edge testing caught and corrected that bundle error before publication. Existing founder queue/promotion is reused, not recreated; free unresolved cases remain outside the managed queue.

Observed local gates: **40 unit files / 512 tests**, both TypeScript checks, web and iOS JS exports, diff check; 19 pgTAP files / 486 assertions and all 17 CI integration scripts passed on a fresh disposable reset. Synthetic gold 15/15; no real extraction supplied, no provider selected. Exact-head CI results belong to the PR/completion packet, not predicted SHAs in this ledger. A pgTAP rerun after legacy founder smokes initially hit fixture-pollution assertions; a fresh reset restored the required reproducible clean baseline. No test failure was waived.

Remaining P0-A critical acceptance: rights-cleared representative real-image corpus and approved provider evaluation inputs; connected/current test binary and physical camera/permission/network/retake acceptance. Root may merge the safe automated increment after exact-head CI, but must return `P0-A PARTIAL — BLOCKED`, not complete. P0-B may immediately import the contract/fixtures and presentation seam; global Check is reserved for Kanuj's single-writer composition. Catalog pagination fails closed above 10k/table; indexed demand retrieval is a scaling follow-up, not a reason to remove the safety bound. No restart-persistent capture retry, invented formula concentrations, public-check monetization, S7 expansion, hosted deployment or data deletion is authorized.
