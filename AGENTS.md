# Derive Agent Guide

## Purpose
Derive is a managed skincare service ("Your skincare, handled"). This guide defines repository-wide rules, boundaries, and source-of-truth pointers for AI agents and human contributors.

## Sources of Truth
When information conflicts, actual repository implementation, runtime code, and passing tests outrank documentation. For domain context, consult canonical references relevant to your task:
- `docs/CONTEXT_SYNC.md`: Active cross-founder decisions, milestone history, and shared ledger.
- `docs/OWNERSHIP.md`: Detailed directory ownership boundaries between founders.
- `docs/ROADMAP.md`: Project milestones, deliverables, and execution phases.
- `docs/DECISIONS.md`: Architectural decision records (ADRs).
- `docs/ARCHITECTURE.md`: System topology, data flow, and runtime services.
- `docs/INTERFACES.md`: Shared contracts, domain types, and service boundaries.
- `docs/SAFETY_PRIVACY.md`: Clinical safety, privacy invariants, and dermatological boundaries.

Read documents relevant to your specific task rather than loading all documentation indiscriminately.

## Ownership
- **Kanuj (Customer Experience + Mobile)**: Mobile app (`app/**`), UI components (`src/components/**`), client stores, themes, haptics, camera/voice UX, client analytics allowlist, and Expo/EAS configuration.
- **Sami (Platform + Intelligence + Operations)**: Supabase backend (`supabase/**`), database schema/migrations, RLS, private storage, Edge Functions, server intelligence workflows, and founder operations (`admin/**`).
- **Shared Contracts**: `src/contracts/**`, `src/domain/**`, and `src/types/schema.ts` form the stable integration boundary.

## Commercial truth
- **Implemented (I1-B4A)**: Founding Beta membership display is `$25/month` via `config.betaPriceMonthly` (display only; Stripe/S5 owns charged money). Canonical identity is `founding_beta`. Products are purchased separately. Routine-derived all-in pricing (`src/pricing/**`) has been removed.
- **Approved, not implemented (I1-B4B)**: optional multi-select check-in context tags + one optional context note.
- Do not implement B4B, Shop, Stripe, or a sixth tab unless that pass is explicitly opened.

Never silently cross founder ownership boundaries. For shared-contract modifications or cross-boundary integrations, document rationale and changes in `docs/CONTEXT_SYNC.md`.

## Repository Freshness
Before substantial work, fetch upstream and establish whether the working branch is in sync, behind, ahead, dirty, or diverged. Treat local repository state as authoritative only after this check.
- **Clean and only behind `origin/main`**: Fast-forward safely using `git merge --ff-only origin/main`.
- **Dirty, ahead, or diverged**: Preserve local work and reconcile deliberately. Never reset, force-push, overwrite, or silently discard uncommitted or unpushed work.

## Working Rules
- **Inspect Before Inventing**: Review existing code, tests, and schema before introducing new abstractions or dependencies.
- **Minimal Coherent Changes**: Prefer the smallest coherent change that completely solves the problem.
- **Evidence-Grounded Refactoring**: Code and passing tests supersede stale documentation. Challenge architectural assumptions with code or test evidence, but never silently alter shared architecture.
- **Security & Secrets**: Secrets, service-role keys, and LLM credentials belong strictly in server-side environments (`supabase/functions/**`, uncommitted `.env`). Never expose secrets in client bundles or `EXPO_PUBLIC_*` variables.
- **Safety & Privacy Invariants**: Never weaken Auth, RLS, storage boundaries, or clinical safety guards for implementation convenience. Skincare advice is strictly cosmetic (non-diagnostic); emergency symptoms escalate immediately. Session replay is strictly disabled; sensitive photos/notes remain private.
- **Ledger Synchronization**: Update `docs/CONTEXT_SYNC.md` whenever modifying shared contracts, system architecture, database schema, safety rules, or milestone states.

## Validation
Before claiming any substantial implementation complete:
1. `npm test`: Unit test suite must pass 100%.
2. `npx tsc --noEmit`: Strict application TypeScript check (0 errors).
3. `npm run typecheck:tests`: Test TypeScript check (0 errors).
4. `EXPO_NO_TELEMETRY=1 npx expo export -p web`: Production web export must build cleanly.
5. Backend/database changes must additionally satisfy Supabase migrations and pgTAP tests (`supabase test db`).
6. Inspect final `git diff`: Ensure zero unintended files, leaked secrets, temporary artifacts, or ownership boundary violations.
