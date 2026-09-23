# Derive Agent Guide

## Current product truth (2026-09-23)

Derive's founder-approved direction is **personalized skincare product intelligence first**, with free Check a Product as the acquisition wedge and optional **$25 Managed Skincare** for ongoing care. A universal numerical product score is not part of the product.

**Implemented today:** the mobile app still runs the C1 managed-first navigation (Today, Plan, Shop, Ask, Progress), and its shipped scanner result still uses the “FORMULA QUALITY” label. Remote access still follows the existing Auth and managed-membership gates; the anonymous free-check flow is not implemented. PRs #36/#37 added catalog search and Check a Product, but Remote Staging keeps that route hidden. S6 product identity and formula evidence remain fail-closed. PR #39 closed the selected catalog UUID handoff into routine persistence. The hosted catalog handoff count is 4 products, 1 sourced product, 1 alias, 0 variants, 0 identifiers, and 0 formula versions. `propose-routine` v3 is ACTIVE with JWT verification enabled; live provider-backed behavior remains unproven.

**Approved target, not yet implemented:** replace the legacy formula label with factual “FORMULA DETAILS” beside separate “PERSONAL FIT”; silently create a Supabase anonymous authenticated identity; launch to Check; show factual product evidence before offering optional short personalization; use CHECK / MY STUFF / PLAN / SHOP; permit free checking without managed membership; require a permanent account plus managed entitlement for Managed Skincare. Anonymous Auth users have an authenticated-role identity claim and require explicit RLS/security review. Do not describe the target as unauthenticated or claim that this pass changed runtime behavior.

The canonical current plan is [docs/ROADMAP.md](docs/ROADMAP.md), founder lanes and milestone handoffs are in [docs/OWNERSHIP.md](docs/OWNERSHIP.md), and accepted target decisions are in [docs/DECISIONS.md](docs/DECISIONS.md). See [docs/CONTEXT_SYNC.md](docs/CONTEXT_SYNC.md) for the PR #39 closure and strategy checkpoint.

## Ownership

- **Kanuj: customer and mobile lane.** Owns `app/**`, `src/components/**`, `src/constants/**`, customer-facing client state/helpers, presentation, and physical device/TestFlight acceptance. The next mobile milestone is K-FREE-1, Scanner-First App Shell. It may use fixtures or a local customer-state abstraction while Sami builds the platform lane.
- **Sami: platform and intelligence lane.** Owns `supabase/**`, `admin/**`, `src/services/remote/**`, `src/services/ai-workflows/**`, hosted configuration, product identity, access control, and founder operations. The next platform milestone is S-FREE-1, Anonymous / Free Access Platform, including FREE / MANAGED / BOTH function classification and an explicit anonymous-user RLS/security review.
- Shared contracts are interfaces, not co-owned implementation. The first milestone that needs a contract owns its minimal change, documents and merges it, then hands it off. Do not have both founders edit the same contract in parallel.

See the roadmap for all K-FREE, S-FREE, paid, operations, catalog, and acceptance milestones and the wave order. F1 is incorporated into S-PAID-1. H1P remains useful for richer provider-backed intelligence but does not block factual Check or deterministic baseline fit. H1E stays parked unless identity recovery needs reopen it.

## Sources of truth and working rules

GitHub `main` is the shared durable checkpoint. Before substantial work, fetch upstream and inspect branch state; preserve dirty or unpushed work. Current implementation, runtime, tests, and hosted evidence establish what exists. Accepted ADRs establish intended decisions. A target section never proves runtime implementation.

Read [ROADMAP.md](docs/ROADMAP.md) and [OWNERSHIP.md](docs/OWNERSHIP.md), then only the relevant contracts and safety docs: [CONTEXT_SYNC.md](docs/CONTEXT_SYNC.md), [DECISIONS.md](docs/DECISIONS.md), [ARCHITECTURE.md](docs/ARCHITECTURE.md), [INTERFACES.md](docs/INTERFACES.md), [SAFETY_PRIVACY.md](docs/SAFETY_PRIVACY.md), and the task-specific reference. Historical roadmap and context entries preserve evidence; their old next-action or navigation language is not current instruction. Drive holds customer-research artifacts only.

Keep `service_role` keys, Stripe secrets, and model-provider credentials server-side; never place them in client bundles or `EXPO_PUBLIC_*` variables. Client routes use `src/services/deriveClient.ts` and `IDeriveService`; `app/**` must not import `src/services/ai-workflows/**`. Record material decisions, handoffs, and durable state changes in the canonical doc and a concise `docs/CONTEXT_SYNC.md` entry.

Do not silently change the other founder's lane. Record cross-lane defects with reproduction, evidence, affected interface, owner, and blocker status. Never weaken Auth, RLS, private storage, deletion, or cosmetic/non-diagnostic boundaries for convenience. Keep photos and sensitive skin context private; do not infer race, ethnicity, ancestry, or Fitzpatrick category. Do not place sensitive skin or ingredient text in analytics. Session replay remains disabled.

For docs-only tasks, validate links and scope, run `git diff --check`, and verify that no non-documentation files changed. Run implementation tests only when the task requires them.
