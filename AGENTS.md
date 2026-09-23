# Derive Agent Guide

## Product direction

Derive’s approved direction is free personalized skincare product intelligence first, centered on Check a Product, with optional $25 Managed Skincare for ongoing routine management. The scanner-first architecture is approved target behavior, not proof of current runtime implementation. Do not use a universal numerical product score; keep Formula Details separate from Personal Fit.

For current implementation status and milestones, use [ROADMAP.md](docs/ROADMAP.md). For recent landed/runtime evidence, use [CONTEXT_SYNC.md](docs/CONTEXT_SYNC.md). For accepted product and architecture decisions, use [DECISIONS.md](docs/DECISIONS.md).

## Ownership

Kanuj owns `app/**`, `src/components/**`, `src/constants/**`, customer-facing client state/helpers, navigation/presentation, and device/TestFlight acceptance. Sami owns `supabase/**`, `admin/**`, `src/services/remote/**`, `src/services/ai-workflows/**`, hosted Auth/RLS/configuration, product identity, access control, and founder operations.

K-FREE-1 is Kanuj’s next mobile milestone; S-FREE-1 is Sami’s next platform milestone. Shared contracts are single-owner handoffs, not co-owned parallel edits. See [OWNERSHIP.md](docs/OWNERSHIP.md) for founder/file boundaries and [ROADMAP.md](docs/ROADMAP.md) for milestones.

## Sources of truth

GitHub `main` is the durable shared checkpoint. Current implementation, runtime, and tests outrank stale prose about what exists; accepted ADRs describe intended decisions. Before substantial work, fetch and inspect branch freshness. Preserve dirty or unpushed work. Read only the references relevant to the task.

- [ROADMAP.md](docs/ROADMAP.md): current execution plan and milestones.
- [OWNERSHIP.md](docs/OWNERSHIP.md): founder and file boundaries.
- [DECISIONS.md](docs/DECISIONS.md): accepted ADRs.
- [ARCHITECTURE.md](docs/ARCHITECTURE.md): service and data boundaries.
- [INTERFACES.md](docs/INTERFACES.md): shared contracts.
- [SAFETY_PRIVACY.md](docs/SAFETY_PRIVACY.md): safety and privacy invariants.
- [CONTEXT_SYNC.md](docs/CONTEXT_SYNC.md): recent durable handoffs and runtime evidence.

## Non-negotiables

- Keep service-role, Stripe, and model-provider secrets out of client code.
- `app/**` must not import server AI workflows.
- Do not silently implement the other founder’s lane. Record cross-lane defects with evidence and owner.
- Never weaken Auth, RLS, private Storage, or deletion for convenience.
- Skincare behavior remains cosmetic/non-diagnostic. Keep private photos and sensitive context private; do not infer race, ethnicity, ancestry, or Fitzpatrick.
- Do not place sensitive skin or ingredient text in analytics. Session replay remains disabled.
- Record material durable changes in canonical docs and `CONTEXT_SYNC.md`.

## Implementation validation

Before claiming any substantial implementation complete:

1. `npm test` must pass 100%.
2. `npx tsc --noEmit` must pass with zero errors.
3. `npm run typecheck:tests` must pass with zero errors.
4. `EXPO_NO_TELEMETRY=1 npx expo export -p web` must build cleanly.
5. For mobile changes affecting native/customer runtime, run the applicable iOS JavaScript/export validation, such as `EXPO_NO_TELEMETRY=1 npx expo export -p ios`.
6. For backend/database/Auth/RLS changes, additionally:
   - replay migrations from a fresh local database state with `supabase db reset`;
   - run the full pgTAP/database suite with `supabase test db`;
   - run relevant Edge/local integration smoke checks;
   - verify least-privilege/RLS behavior for changed identities or roles.
7. Inspect the final diff for unintended files, secrets, temporary artifacts, and ownership-boundary violations; run `git diff --check`.
8. Require exact-head CI green before merging substantial implementation.

## Docs-only validation

Docs-only work does not need the application suite unless its scope requires it. Validate links and scope, run `git diff --check`, and verify no non-documentation files changed.
