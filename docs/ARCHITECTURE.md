# Derive System Architecture

## Strategy status: implemented system and approved target

**Implemented today:** the detailed topology below documents the existing C1 mobile app and E1 managed-membership access model. Remote mode currently requires a permanent signed-in account and active membership for managed onboarding/surfaces; the Remote Check route remains hidden. The S-FREE-1 platform supports local authenticated guest sessions, free sourced catalog and factual product resolution, and separate free/managed access state. Hosted guest signup is deliberately gated. `anon` has no application-table privileges. Catalog coverage is small and H1P live-provider behavior is unproven. See [S_FREE_1_ACCESS.md](S_FREE_1_ACCESS.md) for the backend operation matrix and Kanuj handoff.

**Approved customer target, not yet implemented in the mobile app:** free Check works for anonymous or permanent identities without managed entitlement. First launch silently creates a Supabase anonymous Auth identity and opens Check. A Supabase anonymous user is still an authenticated-role user with an anonymous identity claim; it is not the public `anon` key/role. S-FREE-1 completed the local platform/RLS boundary, but mobile integration, abuse controls and hosted activation remain separate gates.

Target identity/access separates anonymous identity, permanent identity, free product intelligence, and paid Managed Skincare. Managed enrollment requires permanent identity plus a managed entitlement. Product facts and baseline fit remain separate services; the deterministic fit service must work without a model provider. Public or shareable factual product evidence does not weaken owner-bound private shelf, profile, reaction, history, or evidence-photo storage.

The target root navigation is CHECK / MY STUFF / PLAN / SHOP. Existing C1 tabs remain shipped architecture until a later Kanuj implementation changes them. The roadmap's waves define interface owners and integration order.

## Architecture Overview

Derive couples an Apple-grade client application with a privacy-first, model-orchestrated backend platform.

```
┌─────────────────────────────────────────────────────────────┐
│                 MOBILE CLIENT (Kanuj Lane)                  │
│       Expo Router • React Native • TypeScript • Zustand     │
│   Today  •  Plan  •  Shop  •  Ask  •  Progress              │
└──────────────────────────────┬──────────────────────────────┘
                               │
               ┌───────────────┴───────────────┐
               │    IDeriveService Contract    │
               │   (Shared Integration Layer)  │
               └───────┬───────────────┬───────┘
                       │               │
        ┌──────────────▼──────┐ ┌──────▼─────────────────────┐
        │  MockDeriveService  │ │ RemoteDeriveService        │
        │  (Local Deterministic│ │ (Supabase Client Adapter)  │
        │   Fast Dev & Tests) │ └──────────────┬─────────────┘
        └─────────────────────┘                │
                                               │ HTTPS / Signed JWT
                                               ▼
┌─────────────────────────────────────────────────────────────┐
│                PLATFORM BACKEND (Sami Lane)                 │
│  Supabase Postgres • Auth • Private Storage • RLS Policies   │
│                                                             │
│  ┌────────────────────────┐    ┌─────────────────────────┐  │
│  │     Edge Functions     │    │  Founder Admin Console  │  │
│  │ - Routine Generator    │    │ - Routine Review Queue  │  │
│  │ - Scan Evaluator       │    │ - Refill Operations     │  │
│  │ - Chat Advisor         │    │ - Clinical Safety Queue │  │
│  │ - Safety Classifier    │    └─────────────────────────┘  │
│  └───────────┬────────────┘                                 │
│              │                                              │
│              ▼                                              │
│  ┌────────────────────────┐    ┌─────────────────────────┐  │
│  │ Provider-Neutral Model │    │ Stripe Commerce API     │  │
│  │ (Adapter Layer: Gemini)│    │ (Web Checkout Plan)     │  │
│  └────────────────────────┘    └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 1. Mobile Client Layer (Kanuj)
* **Framework**: React Native 0.86 on Expo SDK 57, structured via Expo Router (file-system routing in `app/`).
* **State Management**: Zustand stores (`useRoutineStore`, `useOnboardingStore`, `useUserStore`, and ephemeral `useScanContextStore`) for reactive client UI state and transient full-fidelity Scan → Ask context preservation.
* **Scan & Ask Context Resolution (`src/utils/scanContext.ts`)**: Pure utilities `resolveAskDisplayBanner` and `resolveAskServiceContext` that cleanly decouple visual banner display continuity (supporting deep link route parameters) from domain service context. Route query strings are never synthesized into artificial `ProductScanResult` domain records; `IDeriveService.askDerive` receives strictly full typed `ProductScanResult` records from the ephemeral store.
* **Service Coordinator & Boundary (`src/services/deriveClient.ts`)**: Centralized facade and custom React hooks that route all domain queries, mutations, scanning evaluations, and state hydrations through the frozen `IDeriveService` contract boundary. UI routes (`app/**`) are strictly prohibited from importing backend intelligence workflows (`src/services/ai-workflows/**`). Enforces fail-closed identity validation in Remote mode (`resolveUserId()`), canonical null routine cache projection (`hydrateRoutine()`), and centralized customer-safe error sanitization (`src/utils/customerErrors.ts`) that shields internal technical errors (e.g. Supabase / PostgREST / network stack traces) from customer UI while preserving technical logs in `console.warn` and protecting user draft inputs.
* **Device Scanner & Catalog (`src/services/catalog.ts`)**: Pure client catalog fixture and deterministic barcode lookup (`findProductByBarcode`, `PROTOTYPE_CATALOG`) partitioned away from server workflows. In the default/production path, `recognizeShelfProducts` fails closed returning an empty list, while demo fixtures are isolated in `getDemoShelfRecognitionFixture()`.
* **Clean Initial State Guarantee**: `MockDeriveService` defaults strictly to a clean un-onboarded state (`activeRoutine = null`, empty orders, empty check-ins, `customerProfile = null`). Demo fixtures (e.g. Arthur Pendelton) are isolated in explicit development loaders (`seedArthurDemoData()`) and never leak into initial customer sessions.
* **Styling & Tokens**: Direction A Mineral tokens defined in `src/constants/theme.ts`.
* **Mobile Auth & Session Spine (`src/services/authClient.ts`, `src/stores/authStore.ts`)**:
  - **Founding-Beta Email/Password (AUTH-V1)**: Remote staging signup collects first name, last name, email, and password; login uses Supabase email/password. Hosted confirmation is disabled for this limited cohort so signup returns a session immediately. Existing OTP adapter code is dormant and not routed from the beta UI; SMTP, OTP, social login, MFA, and password-reset email are deferred.
  - **Session Persistence**: Supabase client is configured with `@react-native-async-storage/async-storage` (`persistSession: true`, `autoRefreshToken: true`, `detectSessionInUrl: false`).
  - **Lifecycle Token Refresh**: React Native `AppState` listener triggers `startAuthAutoRefresh()` when active and `stopAuthAutoRefresh()` in the background, avoiding orphaned timers.
  - **Identity vs. Membership Decoupling**: Authenticated session establishment projects identity (`userId`, `email`) into `useAuthStore` and `useUserStore.setRemoteSessionUser()`, but never asserts paid membership (`membershipStatus: 'none'`, `tier: ''`) until canonical remote profile hydration proves it.
  - **Cross-User Cache Purging**: `resetCustomerSessionData()` purges user identity, active routine, check-ins, refill orders, and transient scan context on sign-out or account switch.
  - **Deterministic Route Gating**:
    - Mock Mode (`EXPO_PUBLIC_USE_REMOTE_SERVICE=false`): 100% bypasses auth gating for instant developer velocity and offline demo stability. Local onboarding state determines routing between `/(tabs)` and `/(onboarding)/1-welcome`.
    - Remote Mode (`EXPO_PUBLIC_USE_REMOTE_SERVICE=true`): signed-out users enter Login. Unresolved, failed, or mismatched bootstrap stays on Holding. A resolved inactive membership enters `/membership` before any onboarding. Only an active membership can enter Onboarding when incomplete or the five member tabs when complete. `READY` remains profile readiness, never payment proof. The root Stack protects tabs, onboarding, Check-In, Refills, Orders, Scan, product detail, Insights, and Profile from inactive deep links. Local onboarding state is ignored.
    - **Entitlement Refresh (E1)**: Foreground and web-focus transitions refresh canonical bootstrap with bounded, deduplicated reads. An active member's screen is shielded during refresh; an inactive customer remains on Membership. A downgrade clears routine, scan, onboarding, and managed caches without clearing Auth identity or server history. Checkout and Portal return never self-activate membership.
    - **Bootstrap Freshness & Attempt Guarding (I1-A2.1)**: Asynchronous bootstrap resolution and customer profile hydration are bound to a monotonically increasing attempt generation and the active authenticated session UUID (`useAuthStore.sessionUserId`). Stale responses from prior attempts, older retries, or switched accounts ($A \rightarrow B$) are discarded and never project membership, profile, error, or routing state into customer stores. Session reset immediately increments the attempt generation, invalidating any pending in-flight requests.
    - **Founder Surface Isolation (I1-A2.1)**: Production founder operations reside exclusively in Sami's platform console (`admin/**`). Mobile founder screens (`app/founder/**`) are local/demo tooling without trusted authorization; Remote customers navigating to `/founder/**` are strictly redirected to `/(tabs)` in READY state, to onboarding in NEEDS_ONBOARDING, to holding in UNRESOLVED/RESOLVING/ERROR, and to login when signed out. Mock/dev workflows preserve explicit founder navigation.
* **Hardware Integrations**:
  - `expo-camera` / viewfinder for shelf scanning and zero-shutter continuous barcode scanning.
  - Native Swift face capture module (`modules/derive-face-capture/`) utilizing Apple's `Vision.framework` with a deterministic 750ms hold state machine (`AutoCaptureStateMachine.ts`).
  - `expo-haptics` for tactile confirmations.
  - Native Web Speech API on web for hands-free notes. Production native platforms do not inject canned demo transcripts; typed input remains available (`ARCHITECTURE_CHALLENGE_NATIVE_DICTATION`).

---

## 2. Platform & Database Layer (Sami)
* **Database**: Managed PostgreSQL on Supabase.
* **Auth Data Lifecycle (S1 Implemented)**: Inserts into `auth.users` provision a matching `public.profiles` row through a `SECURITY DEFINER` trigger in the unexposed `private` schema with an empty pinned search path. Email and non-authoritative display metadata are synchronized without granting customers profile creation or email-write authority.
* **Row-Level Security (S1 Implemented)**: Every existing public application table has RLS enabled. `anon` has no application-table privileges. Authenticated members receive an explicit least-privilege operation matrix: owner-scoped profile/skin/shelf/photo/check-in/refill access, read-only membership/routine/catalog access, and no access to founder review tasks, payment identifiers, founder notes, AI analysis fields, or fulfillment state changes. Trusted service-role operations stay server-side.
* **Private Storage Data Plane (S1 Implemented)**: `customer-skin-photos` is a non-public, 10 MiB image-only bucket. Object names must begin with the authenticated member UUID (`<member-id>/<photo-type>/<opaque-file-name>`). Members can create immutable objects with non-upserting uploads, but have no direct object list/read/sign/update/delete path. Photo metadata is likewise customer-readable and insertable but not customer-deletable.
* **Product Evidence Data Plane (S6 Implemented)**: `customer-product-evidence` separately stores front-label, ingredient-panel, and packaging images under the same immutable member-owned pattern. Resolution cases, evidence, and candidates are server-authored and owner-readable. Account deletion inventories and verifies both private buckets before deleting Auth identity.
* **Signed Photo Delivery (S1 Implemented)**: The JWT-gated `photo-url` Edge Function authenticates the caller through `auth.getUser()`, rejects supplied identities and arbitrary paths, resolves a `user_photos` record by both photo ID and caller UUID, validates its canonical member-owned path, and issues an exact 900-second signed URL with `Cache-Control: private, no-store`. The local runtime rewrites only Supabase's internal `kong` origin to the explicitly configured public local origin; hosted signed URLs remain unchanged.
* **Account Deletion (S1 Implemented)**: The JWT-gated `delete-customer-account` Edge Function requires exact destructive confirmation, derives identity from the caller token, recursively inventories the caller's complete Storage namespace, validates ownership, removes objects in bounded batches, verifies the namespace is empty, and only then deletes the Auth user. Relational rows cascade after Storage succeeds, preventing orphaned private objects.
* **Environment Contract (S1/L0 Implemented)**: `src/config/environment.ts` uses statically referenced Expo public variables, validates the URL and publishable-key shape, supports the legacy anon-key name only as a transition fallback, and fails closed when Remote mode lacks valid configuration. L0 adds a separate build flavor: Remote staging requires a hosted HTTPS base URL, a publishable key, and Remote mode, while the committed production profile stays Mock. Staging-only diagnostics reveal flavor, service mode, backend host and app version without displaying keys. Service-role, database, Gemini, and CI credentials remain trusted-runtime-only and are documented separately from the public `.env.example`.
* **H1A Hosted Boundary (verified 2026-09-20)**: The existing Derive project `snojlbqovlawewwqbviz` has current migrations/functions and private photo Storage. EAS preview public client values match this project. Guarded disposable password-auth identities and admin-only test entitlement proved hosted intake, private photos, founder authorization and deletion. No production Remote, real email OTP, Stripe billing, hosted model proposal, or published routine has passed. The model choice is open and this account cannot set hosted Edge secrets; see [HOSTED_REMOTE_SMOKE.md](HOSTED_REMOTE_SMOKE.md) for the acceptance matrix.
* **Client Auth (AUTH-V1 Implemented)**: Email/password via Supabase Auth is the current Founding-Beta authentication mechanism. Persistent native sessions via `AsyncStorage`, app-lifecycle token refresh, deterministic route gating (`/holding` neutral state in Remote mode), and cross-user cache purging remain established. The older six-digit OTP adapter is retained but dormant; email confirmation, password-reset mail, Magic Link deep linking, and Apple/Google social providers remain deferred.
* **Remote Adapter Compatibility (S1 Implemented, Adapter Still Provisional)**: Sami-owned PostgREST projections enumerate only customer-readable routine, membership, profile, and refill columns, so column-level grants do not fail due to wildcard expansion. The adapter still requires later row-to-domain mapping, routine-item assembly, live functions, and integration tests before the remote feature flag is production-ready; those later capabilities are outside S1.
* **Safety Disclosure Provenance & Action Alignment (I1-B0 Implemented)**: `public.skin_profiles` includes explicit `pregnancy_status` and `sensitivities_status` columns with least-privilege column grants (`authenticated` select/insert/update) and check constraints, guaranteeing epistemic provenance. `public.user_products.action` check constraint incorporates `PAUSE` alongside `KEEP`, `REPLACE`, `ADD`, and `STOP`. Pure builder `buildOnboardingPayload()` constructs canonical intake payloads while enforcing non-mock identity in Remote mode.
* **Authenticated Remote Onboarding Intake, Atomic Transactional Finalization & Replay Idempotency (I1-B1 & I1-B1.1 Implemented)**:
  - **Internal Submission Ledger (`public.onboarding_submissions`)**: Stores server-issued storage paths, status (`draft` | `committed`), and sanitized intake snapshots (`payload_snapshot JSONB`) with partial unique indexes guaranteeing a single active draft (`WHERE status = 'draft'`) and a single committed initial intake (`WHERE status = 'committed'`) per member. Check constraints enforce that storage paths match caller UUID prefixes and expected categories (`front`, `left`, `right`, `shelf`). RLS is enabled and all direct access is revoked from `anon` and `authenticated` roles, isolating staging state to trusted `service_role` operations.
  - **Atomic Transactional Finalization RPC (`public.commit_onboarding_intake`)**: Narrowly scoped PostgreSQL function executed with `SECURITY INVOKER` by `service_role` (`EXECUTE` revoked from `PUBLIC`, `anon`, and `authenticated`). Inside a single database transaction, it locks the submission row (`FOR UPDATE`), handles already-committed submissions idempotently, upserts `skin_profiles` with `onboarding_completed = false`, records `user_photos` idempotently (`ON CONFLICT (storage_path) DO NOTHING`), ensures exactly one pending `initial_routine` task (`founder_review_tasks`), sets `skin_profiles.onboarding_completed = true` strictly last, marks the submission `committed`, and returns the canonical profile. Any relational error rolls back the entire transaction, leaving the draft clean and retryable.
  - **Review Task & Photo Idempotency**: `public.founder_review_tasks` enforces a partial unique index on `(user_id, task_type) WHERE task_type = 'initial_routine' AND status = 'pending'`. `public.user_photos` enforces unique index on `storage_path`. Retried or replayed commits produce zero duplicate rows.
  - **Edge Functions Defense in Depth & Error Sanitization**:
    - Platform gateway JWT verification (`verify_jwt = true` in `supabase/config.toml`) blocks unauthenticated or malformed requests at the edge.
    - Handlers execute `auth.getUser()`, derive immutable user UUID, and reject caller ID spoofing or cross-user submission commits (fail closed).
    - Errors are sanitized: mobile clients receive stable error codes (`UNAUTHORIZED`, `INVALID_PAYLOAD`, `PHOTO_VERIFICATION_FAILED`, `NO_ACTIVE_DRAFT`, `ONBOARDING_COMMIT_FAILED`) without database or schema internals leakage.
    - `prepare-onboarding`: Resumes existing committed intake if already finalized (avoiding duplicate drafts on lost responses), or re-queries active draft upon concurrent insert races (`23505`), returning upload targets with storage presence flags.
    - `onboard-customer`: Checks for already-committed state and replays canonical result idempotently without re-writing rows; otherwise validates storage presence and delegates to `commit_onboarding_intake`.
    - `submit-checkin` (I1-B4B): Authenticated weekly check-in persistence. Handler-level `auth.getUser()` is authoritative. Spoofed `userId` fails closed. No LLM/provider call. `ai_analysis_sentence` is a bounded deterministic status summary from skin state, irritation, and adherence — never a causal claim from lifestyle tags.
  - **Private Photo Upload Pipeline (`src/services/onboardingPhotoUpload.ts`)**: Direct upload to private `customer-skin-photos` at server-issued paths with `upsert: false`. Zero public URLs and zero local URIs persisted.
  - **Canonical Bootstrap Coordination & Post-Submit Routing**: `10-summary.tsx` invokes the production coordinator `resolveCustomerBootstrap(activeUserId)` rather than querying raw backend state. Transitions to the application occur only when `useBootstrapStore` reaches `status === 'READY'`, letting root route gating maintain canonical navigation truth.
  - **Truthful Status Semantics (`pending_generation` vs `awaiting_review`)**: When `proposedRoutine === null` and `initialRoutineState === 'pending_generation'`, `isPlanUnderReview` is strictly `false` and copy reads "Your routine is being prepared." Only when a routine is proposed and `initialRoutineState === 'awaiting_review'` does `isPlanUnderReview` become `true` with "Final review" copy. Routine generation is strictly deferred to I1-B2.
* **Initial Routine Intelligence Pipeline & Domain Persistence (S2 + S3 Implemented / Client Integration Pending)**:
  - **Lifecycle Progression & Durability Truth**:
    1. **B1 Commit (`pending_generation`)**: Intake finalized in database; member skin profile and photo metadata committed; pending `initial_routine` founder review task created in `public.founder_review_tasks` (`status = 'pending'`); `isPlanUnderReview: false`.
    2. **B2 Server Generation (`awaiting_review`)**: Server context assembly ingests committed intake (`payload_snapshot JSONB` + canonical `skin_profiles` columns including `pregnancy_status` and `sensitivities_status`; PIH tendency is read from `payload_snapshot.pihTendencyAnswer`), resolves a server-configured `RoutineIntelligenceProvider`, validates clinical invariants, persists proposal to `public.routines` (`version = 1`, `status = 'awaiting_review'`) and `public.routine_items`, and normalizes shelf actions into `public.user_products`. Preserves or updates the pending `initial_routine` review task (which uses `status = 'pending'`; supported DB task statuses are strictly `'pending'`, `'completed'`, `'dismissed'` — there is NO `'awaiting_review'` task status). If explicit routine linking is required (e.g. `routine_id` on `founder_review_tasks`), that is a Sami-owned additive migration.
    3. **B2 Client Hydration**: `RemoteDeriveService.getRoutine()` now assembles the latest routine header and immutable `routine_items` snapshot into canonical ordered `amSteps` / `pmSteps`, deriving `scheduleText` from `timing` + `days`. The existing mobile `hydrateRoutine()` is the downstream consumer. Note: `InitialRoutineState` is a shared domain type in `OnboardingResult`, not a persisted database column.
  - **Relational Domain Persistence (S2 Implemented)**:
    - `public.routines`: Canonical routine header now includes `updated_at`; `(user_id, version)` is unique. Customer-facing content and version identity cannot be rewritten in place. `public.create_routine_version` takes a per-member transaction lock, allocates the next version, and atomically appends its steps.
    - `public.routine_items`: Includes canonical `product_id UUID REFERENCES public.products(id)`. Rows are immutable after insert, and `(routine_id, timing, order_index)` is unique. `RoutineStep.scheduleText` is derived during DB $\to$ domain mapping and is not redundantly stored.
    - `public.formula_snapshots` + `public.product_reactions`: Append-only history. `public.record_product_reaction` atomically creates the formula snapshot and its reaction link; ownership/product consistency is trigger-enforced. S3's service-only `record_product_reaction_once` idempotently normalizes reaction evidence from the sealed B1 snapshot without rewriting it.
    - `public.ingredient_signals`: Append-only per-member/per-ingredient versions with categorical confidence, evidence count, owner-validated supporting reaction IDs, and contradictory-tolerance evidence. S3 executes and persists inference through a JWT-gated Edge Function and service-only append transaction.
    - `public.check_ins`, `public.user_photos`, `public.refill_requests`: Existing baseline tables are additively enriched with routine linkage, structured check-in fields, conservative photo provenance, canonical refill product identity, and fulfillment metadata.
    - `public.user_products`: Normalization of member counter products with canonical actions (`KEEP`, `PAUSE`, `REPLACE`, `ADD`, `STOP`).
      - *Persistence Invariant (`B2_REQUIRED_PERSISTENCE_INVARIANT`)*: Canonical `UserProduct` requires full canonical `product: Product`. Every B2-decided product should be normalized into `public.products`, with `user_products.product_id` referencing that row, allowing `user_products JOIN products` $\to$ canonical `UserProduct`.
  - **Current B2 Context Sources**:
    - `public.skin_profiles` provides normalized profile/safety fields: `primary_goal`, `secondary_goals`, `routine_complexity`, `cost_preference`, `midday_feel`, `post_cleanse_tightness`, `known_sensitivities`, `sensitivities_status`, `active_prescriptions`, `is_pregnant_or_nursing`, `pregnancy_status`. *(Note: `skin_profiles.pih_tendency` does NOT exist).*
    - `public.onboarding_submissions.payload_snapshot` JSONB preserves richer intake context: `confirmedProducts`, `productReactions`, `formulaSnapshots`, `adaptiveFollowUps`, `pihTendencyAnswer` (PIH answer is read from here), `hasBadReactions`, photo context, canonical Storage paths.
    - `public.user_photos` provides baseline/progress/reaction-context provenance (`capture_type`, optional `angle`, quality/approval booleans, `captured_at`) plus private `storage_path` metadata.

---

## 3. Intelligence Orchestration Layer
* **Provider-Neutral Architecture (`RoutineIntelligenceProvider`)**:
  - The routine intelligence pipeline is decoupled behind a provider-neutral interface: `{ readonly providerId: string; generateProposal(context: AssembledRoutineContext): Promise<RoutineIntelligenceProposal>; }`.
  - Production model/provider selection is explicitly OPEN / DEFERRED (`ARCHITECTURE_CHALLENGE-05`). Swapping providers requires implementing a thin adapter and verification, not a redesign of routine generation.
  - Optional `GeminiRoutineProvider` adapter provides an initial implementation using Google AI Studio REST endpoint with structured JSON outputs and header authentication (`x-goog-api-key`, zero API key in URL query parameters).
* **Server-Side Runtime Provider Configuration & Zero Client Selection**:
  - Provider selection is strictly server-side runtime configuration: `ROUTINE_MODEL_PROVIDER` process env or secure `public.server_runtime_config` table restricted to `service_role`.
  - Client requests can NEVER select a provider or activate fixtures (`x-routine-fixture` header eliminated).
  - Unconfigured servers fail closed with HTTP 503 `MODEL_UNAVAILABLE` (zero hardcoded branded fallback).
  - Deterministic `FixtureRoutineProvider` is isolated under server configuration for automated CI and local E2E.
* **Credential boundary**: Model API keys are server secrets. The Expo client must never read, embed, or ship an API key (`EXPO_PUBLIC_*` key variables are forbidden). Mobile talks to intelligence only through `IDeriveService`. `MockDeriveService` uses local deterministic reasoning; `RemoteDeriveService` calls Edge Functions. S3's current scan and Ask adapters use server-side Gemini structured output, while routine generation remains behind the provider-neutral boundary.
* **Context Assembly**: Routine generation consumes committed canonical intake and trusted catalog records. S3 scan, Ask, and signal inference may additionally use the member's longitudinal context:
  1. Customer skin profile from `public.skin_profiles` (primary goals, midday oil, tightness, `pregnancy_status`, `sensitivities_status`).
  2. Intake snapshot context from `public.onboarding_submissions.payload_snapshot` (`pihTendencyAnswer`, adverse reactions, confirmed shelf products, formula snapshots).
  3. Active prescription products (e.g. Differin 0.1% schedule: Mon/Wed/Fri).
  4. Tolerated shelf products vs. past adverse reactions.
  5. Most recent weekly check-in skin state and barrier symptoms.
  6. Standardized baseline photos metadata (angles, capture timestamps, quality/approval state). Private Storage paths, signed URLs, local URIs, and image bytes are not placed in S3 model prompts.
* **Clinical & Safety Invariants (Enforced in Intelligence & Persistence)**:
  1. **Sunscreen AM Invariant**: Sunscreen steps must NEVER appear in the evening (`pmSteps`) routine.
  2. **Retinoid PM Invariant**: Strong retinoids (Adapalene/Differin, Tretinoin) must NEVER appear in the morning (`amSteps`) routine.
  3. **Pregnancy / Nursing Contraindication**: Retinoids, hydroquinone, and explicitly high-strength salicylic acid are excluded when pregnancy/nursing is `yes`; `unanswered` and `prefer_not_to_say` fail closed for generated pregnancy-excluded actives.
  4. **Reported Sensitivities**: If `sensitivities_status === 'reported'`, recommendations with unverified formulas fail closed (`VALIDATION_FAILED`); trusted products containing known allergens fail closed.
  5. **Prescription Schedule Preservation**: Generated routines cannot silently omit or reschedule a recognized active prescription; ambiguous prescription schedules require clarification instead of invention.
* **Routine Proposal Pipeline (`propose-routine` Edge Function & RPC)**:
  - Gateway JWT verification with handler defense-in-depth `auth.getUser()`.
  - Fail-closed intake verification: rejects requests with `400 INTAKE_NOT_COMMITTED` unless `public.onboarding_submissions` status is `committed`.
  - Fail-closed context assembly: validates exact canonical domain enums matching `src/types/schema.ts`, secondary goals, and non-empty product identities, rejecting invalid inputs with `400 INTAKE_CONTEXT_INVALID` without fabricating arbitrary defaults.
  - Replay idempotency: checks for existing version-1 routine in `public.routines` and returns it without duplicate writes or re-invoking the model provider.
  - Provider resolution: resolves provider strictly from `ROUTINE_MODEL_PROVIDER` server environment or `public.server_runtime_config` table (service-role only). Zero filesystem or client-side provider selection.
  - Post-generation deterministic validation: enforces AM/PM invariants, pregnancy contraindications (including unknown-state fail-closed behavior), prescription schedule preservation, and action/category enums via `validateRoutineProposal`.
  - Post-generation sensitivity validation: enforces formula verification and allergen avoidance via `validateSensitivities`.
  - Catalog provenance: `commit_routine_proposal` RPC protects trusted products (`is_catalog_standard = true`) from metadata overwrites; defaults new proposed products to `is_catalog_standard = false` with empty `key_actives`, empty `full_ingredients`, and null `retail_price_approx`. Prevents model hallucination accumulation across proposals.
  - Confirmation provenance: `is_confirmed_by_user` denotes having the product in inventory, NOT member approval of an AI action. Existing shelf items retain `true` across actions (`KEEP`, `PAUSE`, `REPLACE`, `STOP`); new proposed `ADD` items are `false`. Null/unknown confirmation strictly fails closed to `false`. Persistence never downgrades `true` to `false`.
  - Customer-safe error boundary: returns strictly typed domain codes (`UNAUTHORIZED`, `INTAKE_NOT_COMMITTED`, `INTAKE_CONTEXT_INVALID`, `MODEL_UNAVAILABLE`, `MODEL_OUTPUT_INVALID`, `CLARIFICATION_REQUIRED`, `VALIDATION_FAILED`, `PERSISTENCE_FAILED`, `INTERNAL_ERROR`), never leaking stack traces, Postgres internals, SQL constraints, or provider errors to clients.
  - Transactional relational persistence via `public.commit_routine_proposal(...)` RPC: defined with least privilege as `SECURITY INVOKER` with `set search_path = ''`, executed strictly by `service_role` (revoked from PUBLIC, anon, and authenticated). Normalizes products in `public.products`, inserts version-1 routine in `awaiting_review` status, inserts `routine_items` with resolved `product_id` FKs, updates `user_products`, and updates the pending `initial_routine` founder review task notes.
* **Safety Circuit Breaker**: `ask-derive` runs a deterministic classifier before any model call. Facial/eye/lip/tongue swelling, breathing/throat distress, severe blistering/oozing/pus, and rapidly spreading hot hives return an emergency response immediately and create only a privacy-minimized urgent founder task. Barrier warnings remain categorical and non-diagnostic.
* **Structured-Output Gate**: Routine, scan, and Ask responses use provider JSON schemas and are parsed again on the server. Deterministic post-model guards reject invalid schedules, prescription changes, sensitivity conflicts, prohibited diagnostic claims, and unsafe pregnancy-context recommendations before persistence or response.

---

## 4. Founder Console & Concierge Operations (`admin/**`)
* Dedicated administrative and concierge operations interface for Kanuj and Sami to run the 10-member Founding Beta:
  - **Routine Review Queue**: Manually review, adjust, and approve proposed routines before initial member publication or subsequent material routine changes.
  - **Fulfillment Desk**: Manually source, purchase, and track product shipments and replenishments (`requested` → `ordered` → `shipped` → `delivered`) with carrier tracking numbers.
  - **Safety Escalation Queue**: Inspect and resolve flagged adverse reaction events.
  - **Concierge MVP Bridge**: High-touch founder delivery for the first 10 members serves as an operational learning bridge; long-term operations are software-managed and AI-led.

---

## 5. Commerce & Billing
* **Platform**: S5 implements hosted Stripe Checkout and Billing Portal sessions for the Founding Beta **membership**. Implemented display truth is **$25/month** Derive-management (ADR-26 / I1-B4A), while `STRIPE_FOUNDING_BETA_PRICE_ID` is the server-side charged-price authority. `config.betaPriceMonthly` remains display-only.
* **Trust Boundary**: Authenticated checkout/portal functions re-verify the member session and derive user/email server-side. The mobile app receives only a short-lived HTTPS destination; Stripe secret key, webhook secret, customer ID, subscription ID, and price ID never cross into Expo.
* **Lifecycle**: `stripe-membership-webhook` has Supabase JWT verification disabled because Stripe sends no Supabase JWT, but it verifies the raw body against `Stripe-Signature` before mutation. It handles Checkout completion and subscription create/update/delete/pause/resume events. `active`/`trialing` map to canonical `active`; `canceled`/`incomplete_expired` map to `cancelled`; other non-entitled billing states map conservatively to `paused`.
* **Ordering & Identity**: `public.apply_stripe_membership_event` is service-role-only, serializes event IDs, records a minimal event ledger, and ignores stale older events. The webhook reads current Stripe subscription truth before projection, so an event for an older subscription cannot revoke a newer active replacement. Member resolution prefers server-authored UUID metadata or established Stripe IDs before normalized-email fallback; conflicting bindings fail closed.
* **Membership vs products**: Membership does not include products. C1 provides a five-tab member Shop with Scan inside Shop. C1.5A composes current published recommendations and trusted catalog identity to stable merchant listings and optional provenance-backed offer snapshots in the Shop client. Production listings are empty until destination, variant and formula equivalence has sufficient evidence; an Ulta example is test-only. The shared `Product` type additively exposes existing `isCatalogStandard` provenance, while the database schema and `IDeriveService` contract remain unchanged. No live offers, product checkout, product order schema or backend migration is included. C1.5B feeds and C1.5C Derive Shopify merchant work are parked and split into Sami backend and later Kanuj mobile milestones.
* **E1 paid operation boundary**: The signed webhook remains the sole membership writer. Client routing reads canonical bootstrap; service-role Edge functions recheck active membership before onboarding, routine generation, personalized Scan, ordinary Ask, ingredient inference, and Check-In. Owner-scoped RLS requires active membership for new skin-profile, shelf, photo, check-in, refill, and private Storage writes. Historical owner reads, account deletion, and the deterministic emergency Ask circuit breaker remain available. Billing identifiers and secrets remain server-only.
* **Identity**: Canonical default is `founding_beta` (I1-B4A additive migration from historical `founding_beta_129`).
* **Weekly check-in persistence (I1-B4B)**: `public.check_ins` stores optional `context_tags` / `context_note`, nullable `adherence`, and nullable historical `primary_goal`. Remote progress reads this table through owner RLS. There is no `get-progress` function. Remote `learnedInsights` stay empty until S3 creates durable insight persistence. Remote `recentPhotos` stay empty until a JWT-bound signer exists; private storage paths are never returned as customer URLs.
* **Historical**: $100 all-in/products-included (ADR-21), $129 identity (ADR-10), routine-derived $96 Arthur prototype (ADR-15) are superseded as commercial direction.

---

## 6. Telemetry & Analytics

**Current transmission state:** live `src/services/analytics.ts` only logs allowlisted events to the console in development; it has no PostHog/network sender, and session replay is disabled. The event type currently includes product names/IDs for some scan/shop events. Do not transmit product/ingredient text or any skin/profile text when analytics is added. Do not describe planned measurement as active analytics.

**Future conceptual funnel (not implemented):** first app open → first product check started → factual result viewed → personalization offered → personalization completed or skipped → personalized result viewed → current products added → repeat check → permanent account saved → Managed Skincare interest → Managed Skincare activation. Future events may record these milestone names and coarse outcomes only. Never include product/ingredient text, goals, skin behavior, prescriptions, sensitivities, pregnancy/nursing answers, photos, or free-text in event payloads.

* **Provider**: Planned privacy-safe telemetry (PostHog; client-side allowlist implemented in `src/services/analytics.ts`; SDK integration planned).
* **Strict Privacy Guardrails**:
  - `disable_session_recording: true` (Session replay strictly disabled).
  - Zero health data, skin photos, symptoms, or conversation text transmitted.
  - Event payloads restricted to allowlisted navigation, operational milestones, and interaction metrics.

---

## 7. S6 backend: one Product Identity Resolver for Scan and Shelf

Current Scan has a client barcode lookup, while `ScanProductInput.imageUri` is only an input field: hosted `scan-product` still requires `productName` and does not perform image identity resolution. Onboarding Shelf has a capture UI, but production `recognizeShelfProducts()` returns no detected products; historical demo fixtures are not recognition authority.

S6 now provides the shared backend contract and implementation documented in [PRODUCT_IDENTITY.md](PRODUCT_IDENTITY.md). `resolve-product-identity` accepts GTIN, typed identity, label/packaging text, ingredient text, and owner-bound private product photos from either `scan` or `shelf`. The deterministic resolver produces verified product+formula, identified/formula-unverified, ambiguous candidates, formula-only, or insufficient-evidence states. Model/OCR resemblance cannot produce verified truth.

Postgres retains variant, region, package, immutable formula lineage, identifier authority, evidence, candidates, and founder resolution audit history. Ambiguous evidence opens a founder task. `scan-product` can consume an optional owner-bound `resolutionCaseId` but accepts only a `verified_product_formula` case and rejects caller label mismatch. The existing mobile flow remains unchanged until Kanuj adopts the contract. Live photo/OCR extraction is still an H1P provider decision, so an uploaded image without supported extracted evidence fails closed.
