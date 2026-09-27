# Derive Feature Ownership

## Active ownership model

Every active milestone/feature has exactly one founder DRI accountable for its customer outcome end-to-end. The DRI may own client/UI, server, persistence, tests, integration and physical acceptance required by that feature. There is no permanent frontend/backend owner split.

## Recommended initial P0 features

| Feature | DRI | Scope and status |
| --- | --- | --- |
| P0-A Capture + Product Resolution | Sami | End-to-end Check capture, barcode/photo evidence, extraction/evaluation adapters if selected, S6 truth resolution, catalog/review and device acceptance. Current Check uses Expo Camera directly; no photo OCR provider or Scandit adapter is implemented. |
| P0-B Personal Decision Intelligence | Kanuj | End-to-end optional profile, routine/history context, multi-finding policy, decision packet, renderer and physical acceptance. All seven focused source PRs and bounded customer composition are merged; automated local/CI gates passed. Physical/customer acceptance and hosted activation remain open. Sami stewardship remains advisory under the rule below. [Execution ledger](P0_B_EXECUTION.md) records agent ownership and actual evidence. |
| P0-C Hosted Beta Operations | DRI assigned explicitly before activation | Hosted guest abuse/lifecycle, linking, cleanup, retention and activation review. Hosted guest activation remains gated. |
| P0-D Cross-product physical/release acceptance | Composition/release DRI named explicitly before activation | Cross-feature physical and release composition. Do not infer an owner from a permanent client/server lane. |

These are the approved initial split, not a prediction that every P0 feature is currently active or complete. Current implementation and gate status are in [ROADMAP.md](ROADMAP.md).

## Horizontal stewardship

Feature ownership does not remove review of cross-cutting invariants. Default platform/truth steward: **Sami**, covering Auth, RLS, Storage, ownership/linking/deletion, billing, service-role boundaries, canonical product/formula semantics, scientific-evidence model and migration discipline. Default customer-experience steward: **Kanuj**, covering root navigation, shared design system, global Check, result hierarchy, app shell, cross-feature behavior and physical-device acceptance. A steward reviews invariant changes; the feature DRI remains accountable for shipping. Stewardship review is advisory and valuable, not a required merge approval or blocking gate unless GitHub branch protection or a concrete unresolved invariant finding requires it. The feature DRI owns the end-to-end merge decision and must independently verify focused diffs, required validation and exact-head CI. Keep the steward requested/notified; after each merge reconcile every remaining feature PR onto the new main and rerun its required exact-head validation.

## Maximum independent parallelism

**Every active milestone has one founder DRI. The DRI may decompose the milestone into parallel agent-owned workstreams with disjoint write-sets. A dependency may block final integration, but it must not block independent implementation when a stable contract, fixture or view model can be used. Shared contracts, migration ordering, authoritative truth promotion and high-contention composition files have one active writer at a time. After independent modules are complete, one bounded composition pass integrates them.**

Founder-level and subagent-level parallelism are both expected where write-sets do not conflict. A simple structure is:

```text
Feature A DRI -> independent agents -> bounded composition
Feature B DRI -> independent agents -> bounded composition
Feature A || Feature B when dependencies allow
```

Use one writer at a time for shared public contracts, migration ordering, central Auth/runtime composition, root navigation/layout, high-contention Check composition, authoritative catalog/science promotion, and final release composition. A stable contract or fixture lets the dependent feature progress without waiting for a live integration.

## Future assignment

Assign each future feature to one founder DRI using workload, context, dependencies, relevant expertise and parallelism. Explicitly name a DRI before starting hosted beta operations or cross-product physical/release acceptance. Do not turn a steward role into an implicit feature assignment.

## Historical ownership model (superseded for new features)

The following previous guide records the older fixed file-lane model at its checkpoint. It is retained for historical implementation context; it does not assign future milestones.


Every implementation milestone has one founder owner. This approved split supports long parallel work with minimal file overlap. Wave-1 foundations and local mobile/platform integration are landed. K-FREE-2 (#51), K-FREE-3 (#48), K-FREE-4 (#49), K-PAID-1A (#52), K4-COMPOSE handoff prep (#55), KPAID-COMPOSE (#56), and K2-COMPOSE (#60) are landed. S-FREE-2 (#54), S-FREE-3 (#58), and S-FREE-4 (#61) are merged as local platform contracts and integrated in PRs #63, #64, and #65. Hosted deployment remains separate. [ROADMAP.md](ROADMAP.md) has the full sequence and acceptance gates.

**Max-parallel implementation rule:** A counterpart contract is a prerequisite for integration, not a prerequisite for beginning or completing owned implementation. Kanuj presentation milestones may build against Kanuj-owned view models/fixtures while Sami builds platform contracts independently. After completing an owned milestone, each founder advances to the next non-overlapping milestone. Integration is a separate bounded task.

### Kanuj: customer and mobile lane

Owns `app/**`, `src/components/**`, `src/constants/**`, customer-facing client state/helpers, customer navigation/presentation, and physical device/TestFlight acceptance. Kanuj may build against fixtures or a local customer-state abstraction while the platform contract is being built.

- **K-FREE-1 / Wave 1 foundation, LANDED:** Scanner-First App Shell and target CHECK / MY STUFF / PLAN / SHOP presentation. No Supabase backend, hosted Auth/RLS, or free entitlement implementation.
- **K-FREE-1B, LANDED:** scanner-first UX polish.
- **Wave-1 integration, LANDED locally:** consume Sami's unchanged `FreeAccessState` in the local Development Remote app. Free Check uses live factual catalog and resolver; managed routes remain gated. Hosted activation remains with S-OPS-1.
- **K-FREE-2 / K2-S2, LANDED (PRs #51 and #63):** optional minimal personalization after factual first Check, with typed profile save/read and same-result fit refresh connected locally. Hosted deployment remains gated.
- **K-FREE-3 / K3-S3 / Check memory, LANDED (PRs #48, #64 and #66):** MY STUFF reads/writes through owner-bound local free context. Check history saves only after an explicit customer action; retained Check results clear on local owner change. Hosted deployment remains gated.
- **K-FREE-4 / K4-S4, LANDED locally (PRs #49 and #65):** K4-COMPOSE handoff prep (PR #55) is also landed. Camera evidence connects to S-FREE-4 and S6; candidate/unknown states remain non-authoritative, and no hosted deployment is implied. Typed client handling for the S-FREE-4 429 quota response remains open.
- **K-PAID-1A, LANDED presentation foundation (PR #52):** free Managed Skincare offer, upgrade states, context reuse, managed intake/photo and Plan states; fixture-backed. KPAID-COMPOSE (PR #56) is landed; integration consumes stable Sami contracts.
- **K-ACCEPT-1:** scanner-first physical/TestFlight acceptance after platform contracts and release hardening.
- **K-GROWTH, later:** shareable Check result and referral UX.

### Sami: platform, intelligence, and operations lane

Owns `supabase/**`, `admin/**`, `src/services/remote/**`, `src/services/ai-workflows/**`, hosted Supabase/Auth/RLS/configuration, server billing, product identity/formula truth, and founder operations. Sami does not implement customer mobile UI.

- **S-FREE-1 / Wave 1 foundation, LANDED:** anonymous identity and free access, account-kind distinction, free/managed separation, FREE / MANAGED / BOTH operation inventory, least-privilege RLS review, and stable access contract. No mobile UI and no fake `founding_beta` membership for free users.
- **S-FREE-2 / Wave 2, LANDED (PR #54):** minimal free profile and deterministic categorical fit. The Retinyl Propionate pregnancy-fit defect has a regression fix and exact-head CI passed. K2/S2 consumes the local contract in PR #63; no hosted deployment. See [S_FREE_2_PERSONAL_FIT.md](S_FREE_2_PERSONAL_FIT.md).
- **S-FREE-3 / Wave 3, LANDED (PR #58):** owner-bound free Check history, shelf/product states, reactions/tolerance and profile context data plane, including anonymous ownership. K3/S3 consumes the local contract in PR #64; no hosted deployment.
- **S-FREE-4 / Wave 4, LANDED (PR #61):** private grant-bound free product evidence, S6 candidate/formula resolution and review states, and managed Shelf separation. OCR/model output is not authoritative identity. K4/S4 consumes the local contract in PR #65; typed client handling for its 429 quota response remains open, and no hosted deployment occurred. See [S_FREE_4_PRODUCT_EVIDENCE.md](S_FREE_4_PRODUCT_EVIDENCE.md).
- **S-PAID-1 / Wave 5:** permanent identity and managed entitlement separation plus F1 founder construction, validation, publication and member readback. F1 is part of this milestone.
- **S-OPS-1:** anonymous cleanup, rate/abuse controls, account linking/conflicts, deletion, session-loss behavior and privacy-safe operational observability.
- **S-CATALOG, ongoing:** demand-driven verified coverage, aliases, package/identifier/formula evidence, reformulation history and safe unknown fallback.

H1P remains a provider-backed intelligence milestone. H1B remains later managed billing/entitlement activation. H1E remains parked unless recovery needs it. None reinstates a hard H1P dependency for free factual Check or deterministic fit.

### Wave handoffs

| Wave | Parallel owner pair | Handoff required before integration |
| --- | --- | --- |
| Wave-1 foundations (landed) | K-FREE-1 / K-FREE-1B (Kanuj); S-FREE-1 (Sami) | The stable access contract is consumed locally. Hosted anonymous signup remains gated. |
| Wave-1 integration (landed, local only) | Kanuj consumes S-FREE-1 in mobile; Sami's platform lane is unchanged. | Local guest lifecycle and factual Check are verified. Wave 2 is unblocked; hosted activation is separate. |
| 2, live integration landed | K-FREE-2 (PR #51), K2-COMPOSE (PR #60), K2/S2 (PR #63) / S-FREE-2 (PR #54) | Local profile and fit integration is merged; hosted deployment remains gated. |
| 3, live integration landed | K-FREE-3 (PR #48), K3/S3 (PR #64), Check memory (PR #66) / S-FREE-3 (PR #58) | MY STUFF uses owner-bound persistence; Check history is explicit-save only and Check state clears on local owner change. Hosted deployment remains gated. |
| 4, local integration landed | K-FREE-4 (PR #49), K4/S4 (PR #65) / S-FREE-4 (PR #61) | Camera-to-resolver integration is merged locally; typed handling for the 429 quota response remains open. |
| 5, presentation and composition landed | K-PAID-1A (PR #52) / S-PAID-1 | KPAID-COMPOSE (PR #56) is landed; integration handles upgrade and real Plan. |
| Release | K-ACCEPT-1 / S-OPS-1 | Operations/security behavior and mobile acceptance are evidenced before scanner-first external beta. |

### Shared-contract rule

A shared contract is not co-owned implementation. The milestone that first requires a contract owns its minimal change, records the exact request/response and failure states, validates and merges it, then hands it to the dependent milestone. The dependent owner does not edit that contract in parallel. Do not create “Kanuj + Sami” implementation milestones.

### Historical ownership and evidence

Older F1, H1P, L1/L2, C1, Build 8/9/10, and catalog branch entries preserve their checkpoint-specific assignments and evidence. They do not override the current milestone table. PR #39's selected catalog UUID preservation is closed; Sami does not own that same fix as current work. Cross-lane defects still require exact evidence, affected interface, owner, and blocker status in the PR or [CONTEXT_SYNC.md](CONTEXT_SYNC.md).
