# Derive Agent Guide

## Purpose
Derive is a managed skincare service ("Your skincare, handled"). This guide defines repository-wide rules, boundaries, and source-of-truth pointers for AI agents and human contributors.

## Sources of Truth
GitHub is the sole durable project context. The working tree records in-progress implementation; `main` is the shared implementation and documentation checkpoint. When information conflicts, actual implementation, runtime behavior, and tests outrank accepted repository decisions and docs. Drive holds customer-research artifacts only; it is not an architecture, roadmap, or agent handoff source. Before substantial work, read `docs/ROADMAP.md` and `docs/OWNERSHIP.md`, then the references relevant to the task:
- `docs/CONTEXT_SYNC.md`: Meaningful repository-native cross-agent checkpoints and historical ledger.
- `docs/OWNERSHIP.md`: Detailed directory ownership boundaries between founders.
- `docs/ROADMAP.md`: Project milestones, deliverables, and execution phases.
- `docs/DECISIONS.md`: Architectural decision records (ADRs).
- `docs/ARCHITECTURE.md`: System topology, data flow, and runtime services.
- `docs/INTERFACES.md`: Shared contracts, domain types, and service boundaries.
- `docs/SAFETY_PRIVACY.md`: Clinical safety, privacy invariants, and dermatological boundaries.

Read documents relevant to your specific task rather than loading all documentation indiscriminately.

## Ownership
- **Kanuj (Customer Experience + Mobile)**: `app/**`, `src/components/**`, `src/constants/**`, customer-facing client state/helpers, mobile recovery UX, device/TestFlight acceptance.
- **Sami (Platform + Intelligence + Operations)**: `supabase/**`, `admin/**`, `src/services/remote/**`, `src/services/ai-workflows/**`, hosted configuration, server billing, product resolution, founder operations.
- **Shared Contracts**: `src/contracts/**`, `src/domain/**`, `src/types/schema.ts`, manifests, CI, and architecture docs are interfaces, not co-owned implementation milestones. One milestone owns each required change and records the handoff.

## Commercial truth
- **Implemented (I1-B4A)**: Founding Beta membership display is `$25/month` via `config.betaPriceMonthly` (display only; Stripe/S5 owns charged money). Canonical identity is `founding_beta`. Products are purchased separately. Routine-derived all-in pricing (`src/pricing/**`) has been removed.
- **Implemented (I1-B4B)**: optional multi-select weekly check-in context tags + one optional context note, persisted through real `submit-checkin` and RLS-backed progress reads. Tags are context, not causation.
- **Implemented (S1–S4)**: platform foundation, core domain persistence, server intelligence, and founder operations console are on `main`.
- **Implemented (S5)**: server-owned Stripe membership Checkout, Billing Portal, and signed webhook projection. Hosted Stripe/Supabase activation smoke remains pending. Production Remote mode remains disabled.
- **Implemented (C1)**: member Shop V1 uses Today, Plan, Shop, Ask, and Progress as the five root tabs, with one Scan route inside Shop. Public Shop routing remains a future activation step.
- **E1 entitlement**: Remote managed skincare requires canonical `CustomerBootstrapState.membershipStatus === 'active'`. Auth identity and onboarding readiness are separate. Production/non-concierge Remote still depends on S5 Checkout and its signed webhook. Remote staging Build 9 instead uses the server-owned `open_external_testflight_beta` flag to grant an authenticated account a non-Stripe Founding Beta membership, then rereads canonical state. Premium writes remain gated by Edge checks and RLS; production Remote remains disabled.
- **C1.5A landed**: Shop-only merchant/listing/offer presentation and Where to Buy foundation. Production listings are empty until product, variant, and formula equivalence can be supported; `isCatalogStandard` alone is not acquisition authority. C1.5B feeds, C1.5C Shopify checkout, affiliate work, public Shop, and physical commerce automation are parked. See `docs/COMMERCE.md` and ADR-32.
- **L0/L1A landed**: the `remote-staging` EAS profile selects preview public configuration and Remote mode, while development and production remain Mock. H1A verified the exact Derive project and placed its public URL/key in EAS preview. L1A subsequently installed and physically verified signed-out build `1.0.0 (5)` on an iPhone.
- **H1A hosted baseline**: Kanuj's one-time platform assignment proved disposable post-auth entitlement, intake/Shelf/reaction snapshot, private photos, founder authorization, selected security and deletion in project `snojlbqovlawewwqbviz`. A synthetic admin entitlement is not Stripe proof. The model/provider choice remains open; a verified free-tier key could not be stored by this account's Supabase permissions, and direct adapter diagnostics received Google 503 high-demand. Hosted `propose-routine` returned `MODEL_UNAVAILABLE`; routine publication and dependent member surfaces remain blocked. See `docs/HOSTED_REMOTE_SMOKE.md`.
- **AUTH-V1 / Build 9 landed**: Remote staging now has real email/password signup and sign-in, with hosted email confirmation disabled for the small Founding Beta. OTP code remains dormant and password reset is deliberately deferred. Build 9 can grant canonical free external-beta access through a private hosted release flag; while that flag is enabled, every authenticated staging account is eligible—it is a release gate, not an invite allowlist. Paused, cancelled, and Stripe-linked memberships are never overwritten. This is staging access, not payment proof.
- **Build 10 landed**: native onboarding photo upload now sends Expo FileSystem `ArrayBuffer` data to the existing private bucket and server-issued path. Hosted adapter proof passed; physical TestFlight acceptance remains Kanuj-owned and pending. See `docs/BUILD10_PHOTO_UPLOAD.md`.
- **L1A complete**: store-signed Remote staging `1.0.0 (5)` is installed and physically verified on an iPhone 17 Pro Max. Signed-out launch, identity diagnostics, validation, restart, background/foreground and offline/recovery passed. AUTH-V1 removes the earlier H1E blocker, but authenticated routine/device acceptance still belongs to L1B/L1C.
- **Next work**: Sami owns F1 manual routine fallback now; H1P model-provider activation and H1B Stripe remain separate platform gates. H1E email OTP is no longer a Founding-Beta prerequisite and is parked as a future verified-email/recovery decision. Kanuj starts L1B after F1 and starts L1C after H1P using the current AUTH-V1 path. See `docs/ROADMAP.md` and `docs/OWNERSHIP.md`.

Never silently implement the other founder's work. Record a cross-lane defect with exact evidence, affected interface, owner, and blocker status; continue safely or stop at the dependency. Update relevant repository docs when durable state changes, and record material shared-contract or milestone handoffs in `docs/CONTEXT_SYNC.md`.

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
- **Repository checkpoint**: Update the canonical doc and add a concise `docs/CONTEXT_SYNC.md` entry when a material contract, architecture, safety rule, ownership handoff, or milestone state changes. Historical entries are not current instructions.

## Validation
Before claiming any substantial implementation complete:
1. `npm test`: Unit test suite must pass 100%.
2. `npx tsc --noEmit`: Strict application TypeScript check (0 errors).
3. `npm run typecheck:tests`: Test TypeScript check (0 errors).
4. `EXPO_NO_TELEMETRY=1 npx expo export -p web`: Production web export must build cleanly.
5. Backend/database changes must additionally satisfy Supabase migrations and pgTAP tests (`supabase test db`).
6. Inspect final `git diff`: Ensure zero unintended files, leaked secrets, temporary artifacts, or ownership boundary violations.
