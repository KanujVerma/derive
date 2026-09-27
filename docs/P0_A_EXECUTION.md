# P0-A execution and evidence ledger

Status: IN PROGRESS. DRI Sami; product/formula-truth steward Sami, customer-experience steward Kanuj. No hosted activation or provider selection is authorized by this increment.

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
