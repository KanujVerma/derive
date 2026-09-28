# Derive Agent Guide

## Product direction

Derive's approved direction is **scanner-first personalized skincare product intelligence**. Free Check asks “Should I use this product?” and returns only supported facts and context-sensitive actions. Plus is an evaluated self-directed cross-product layer, not a live entitlement; `$25/month Managed Skincare` is a paid hypothesis, not validated pricing or activated hosted billing. The first scanner-first release remains scoped to Free barcode/name Check while Plus/Founding launch scope is open. No universal numerical compatibility, health, or product-quality score. See [MONETIZATION.md](docs/MONETIZATION.md) and [KANUJ_PORTFOLIO.md](docs/KANUJ_PORTFOLIO.md).

The target architecture is not proof of runtime behavior. Development Mock and exact-local-Supabase modes contain a scanner-first free path; Remote Staging and production retain legacy managed access. S-FREE-2/3/4 and K2/S2, K3/S3, K4/S4 are integrated locally, not hosted. P0-A adds immutable product-truth snapshots and tested capture recovery, not photo recognition. Photo-only input has no working OCR/image recognition; hosted guest activation and physical acceptance remain gated. See [ROADMAP.md](docs/ROADMAP.md), [P0_A_EXECUTION.md](docs/P0_A_EXECUTION.md), and [CONTEXT_SYNC.md](docs/CONTEXT_SYNC.md) for current status.

## Truth and references

GitHub `main` is the durable checkpoint. For what exists, prefer runtime, source and tests over stale prose. Accepted ADRs describe intent, not implementation. Before substantial work, fetch/inspect branch freshness and preserve dirty or unpushed work. Read only references relevant to the task:

- [ROADMAP.md](docs/ROADMAP.md): objective, active P0s, gates and history.
- [OWNERSHIP.md](docs/OWNERSHIP.md): feature DRIs, stewards and parallel work.
- [DECISIONS.md](docs/DECISIONS.md): accepted decisions and evaluation status.
- [ARCHITECTURE.md](docs/ARCHITECTURE.md): current system versus target architecture.
- [INTERFACES.md](docs/INTERFACES.md): current and conceptual boundaries.
- [PRODUCT.md](docs/PRODUCT.md), [PRODUCT_CATALOG.md](docs/PRODUCT_CATALOG.md), [PRODUCT_IDENTITY.md](docs/PRODUCT_IDENTITY.md): customer value and product truth.
- [SAFETY_PRIVACY.md](docs/SAFETY_PRIVACY.md), [RESEARCH.md](docs/RESEARCH.md), [CONTEXT_SYNC.md](docs/CONTEXT_SYNC.md): safety, evidence and handoffs.

## Feature ownership and parallel work

Every feature has one founder DRI who owns the customer outcome end-to-end; the DRI may work across client, server, persistence, tests, integration and physical acceptance. There is no permanent frontend/backend assignment. Current recommended P0 DRIs are Sami for P0-A Capture + Product Resolution and Kanuj for P0-B Personal Decision Intelligence. P0-D integrated customer/release acceptance is now explicitly assigned to Kanuj; Sami owns P0-C hosted operations preparation; hosted activation remains gated and is not authorized by this portfolio pass. Sami owns active smart camera/capture; Kanuj owns downstream acceptance and CX stewardship without another scanner/controller. See docs/KANUJ_PORTFOLIO.md.

Sami stewards platform/truth invariants; Kanuj stewards customer experience. Stewardship reviews cross-cutting changes but does not transfer the feature DRI. **Every active milestone has one founder DRI. The DRI may decompose the milestone into parallel agent-owned workstreams with disjoint write-sets. A dependency may block final integration, but it must not block independent implementation when a stable contract, fixture or view model can be used. Shared contracts, migration ordering, authoritative truth promotion and high-contention composition files have one active writer at a time. After independent modules are complete, one bounded composition pass integrates them.**

Founder workstreams and subagents may run concurrently when their write-sets and dependencies are independent. Keep one writer for shared contracts, migration order, auth/runtime composition, root navigation/layout, Check composition, authoritative truth promotion and release composition. Use fixtures or stable target contracts to keep independent work moving. See [OWNERSHIP.md](docs/OWNERSHIP.md).

## Non-negotiables

- Challenge assumptions using inspected source, tests and explicit evidence, not ticket prose alone. Surface major architectural decisions to the founders before implementing them; continue autonomously on bounded, reversible implementation decisions. Preserve active unpublished counterpart work instead of reconstructing it.
- Keep service-role, Stripe and model-provider secrets out of client code; `app/**` must not import server AI workflows.
- Never silently implement another feature DRI's work. Record cross-feature defects with evidence and owner.
- Never weaken Auth, RLS, private Storage or deletion for convenience.
- Guidance remains cosmetic/non-diagnostic. Keep photos and sensitive context private; do not infer race, ethnicity, ancestry or Fitzpatrick.
- Do not place sensitive skin or ingredient text in analytics. Session replay remains disabled.
- Record material durable changes in canonical docs and `CONTEXT_SYNC.md`.

## Implementation validation

Before claiming substantial implementation complete:

1. `npm test` must pass 100%.
2. `npx tsc --noEmit` must pass with zero errors.
3. `npm run typecheck:tests` must pass with zero errors.
4. `EXPO_NO_TELEMETRY=1 npx expo export -p web` must build cleanly.
5. For mobile/native runtime changes, run the applicable iOS JavaScript/export validation.
6. For backend/database/Auth/RLS changes, replay migrations with `supabase db reset`, run `supabase test db`, run relevant Edge/local integration smoke, and verify least-privilege/RLS for changed identities/roles.
7. Inspect the final diff for unintended files, secrets, temporary artifacts and boundary violations; run `git diff --check`.
8. Require exact-head CI green before merging substantial implementation.

## Docs-only validation

Docs-only work does not need the application suite unless its scope requires it. Validate links and scope, run `git diff --check`, and verify no non-documentation files changed.
