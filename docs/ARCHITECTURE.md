# Derive System Architecture

## Architecture Overview

Derive couples an Apple-grade client application with a privacy-first, model-orchestrated backend platform.

```
┌─────────────────────────────────────────────────────────────┐
│                 MOBILE CLIENT (Kanuj Lane)                  │
│       Expo Router • React Native • TypeScript • Zustand     │
│   Today  •  Plan  •  Scan (Viewfinder)  •  Ask  •  Progress │
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
│  │ Google Gemini 2.5 Flash│    │ Stripe Commerce API     │  │
│  │ (Structured Outputs)   │    │ (Web Checkout Personalized Plan)  │  │
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
  - **Passwordless Email OTP**: Client authenticates using 6-digit email OTP codes (`signInWithOtp` -> `verifyOtp({ email, token, type: 'email' })`).
  - **Session Persistence**: Supabase client is configured with `@react-native-async-storage/async-storage` (`persistSession: true`, `autoRefreshToken: true`, `detectSessionInUrl: false`).
  - **Lifecycle Token Refresh**: React Native `AppState` listener triggers `startAuthAutoRefresh()` when active and `stopAuthAutoRefresh()` in the background, avoiding orphaned timers.
  - **Identity vs. Membership Decoupling**: Authenticated session establishment projects identity (`userId`, `email`) into `useAuthStore` and `useUserStore.setRemoteSessionUser()`, but never asserts paid membership (`membershipStatus: 'none'`, `tier: ''`) until canonical remote profile hydration proves it.
  - **Cross-User Cache Purging**: `resetCustomerSessionData()` purges user identity, active routine, check-ins, refill orders, and transient scan context on sign-out or account switch.
  - **Deterministic Route Gating**:
    - Mock Mode (`EXPO_PUBLIC_USE_REMOTE_SERVICE=false`): 100% bypasses auth gating for instant developer velocity and offline demo stability. Local onboarding state determines routing between `/(tabs)` and `/(onboarding)/1-welcome`.
    - Remote Mode (`EXPO_PUBLIC_USE_REMOTE_SERVICE=true`): `INITIALIZING` displays minimal Mineral loading splash; `SIGNED_OUT` routes to `/(auth)/login`; `SIGNED_IN` enters profile resolution state (`useBootstrapStore`). While `UNRESOLVED` or `RESOLVING`, user is held at `/holding` ('Finishing your setup…'). Once canonical bootstrap resolves: `NEEDS_ONBOARDING` (`skin_profiles.onboarding_completed = false`) routes to `/(onboarding)/1-welcome`; `READY` (`skin_profiles.onboarding_completed = true`) routes to `/(tabs)`; `ERROR` stays on `/holding` with calm error copy, Retry, and Sign Out affordances. Local onboarding store state is strictly ignored.
    - **Bootstrap Freshness & Attempt Guarding (I1-A2.1)**: Asynchronous bootstrap resolution and customer profile hydration are bound to a monotonically increasing attempt generation and the active authenticated session UUID (`useAuthStore.sessionUserId`). Stale responses from prior attempts, older retries, or switched accounts ($A \rightarrow B$) are discarded and never project membership, profile, error, or routing state into customer stores. Session reset immediately increments the attempt generation, invalidating any pending in-flight requests.
    - **Founder Surface Isolation (I1-A2.1)**: Production founder operations reside exclusively in Sami's platform console (`admin/**`). Mobile founder screens (`app/founder/**`) are local/demo tooling without trusted authorization; Remote customers navigating to `/founder/**` are strictly redirected to `/(tabs)` in READY state, to onboarding in NEEDS_ONBOARDING, to holding in UNRESOLVED/RESOLVING/ERROR, and to login when signed out. Mock/dev workflows preserve explicit founder navigation.
* **Hardware Integrations**:
  - `expo-camera` / viewfinder for shelf scanning and zero-shutter continuous barcode scanning.
  - Native Swift face capture module (`modules/derive-face-capture/`) utilizing Apple's `Vision.framework` with a deterministic 750ms hold state machine (`AutoCaptureStateMachine.ts`).
  - `expo-haptics` for tactile confirmations.
  - Native Web Speech API / native voice dictation for hands-free notes.

---

## 2. Platform & Database Layer (Sami)
* **Database**: Managed PostgreSQL on Supabase.
* **Auth Data Lifecycle (S1A Implemented)**: Inserts into `auth.users` provision a matching `public.profiles` row through a `SECURITY DEFINER` trigger in the unexposed `private` schema with an empty pinned search path. Email and non-authoritative display metadata are synchronized without granting customers profile creation or email-write authority.
* **Row-Level Security (S1A Implemented)**: Every existing public application table has RLS enabled. `anon` has no application-table privileges. Authenticated members receive an explicit least-privilege operation matrix: owner-scoped profile/skin/shelf/photo/check-in/refill access, read-only membership/routine/catalog access, and no access to founder review tasks, payment identifiers, founder notes, AI analysis fields, or fulfillment state changes. Trusted service-role operations stay server-side.
* **Private Storage Data Plane (S1A Implemented)**: `customer-skin-photos` is a non-public, 10 MiB image-only bucket. Object names must begin with the authenticated member UUID (`<member-id>/<photo-type>/<opaque-file-name>`). Members can create immutable objects with non-upserting uploads, but have no direct object list/read/sign/update/delete path. Photo metadata is likewise customer-readable and insertable but not customer-deletable.
* **Signed Photo Delivery (S1 Remaining)**: The database intentionally grants no client download or signing path. A trusted JWT-bound server endpoint must validate the caller and metadata ownership, then issue a 900-second signed URL. That endpoint is not implemented yet, so the signed-URL acceptance criterion remains open.
* **Deletion (S1 Remaining)**: Relational rows cascade from profile deletion, but physical Storage objects must be deleted through the Storage API before the auth/profile record is removed. The idempotent deletion workflow is not implemented yet.
* **Client Auth (I1-A1 Client Spine Implemented)**: Passwordless 6-digit Email OTP via Supabase Auth (`signInWithOtp` / `verifyOtp` with `type: 'email'`) is the canonical authentication mechanism. Persistent native sessions via `AsyncStorage`, app-lifecycle token refresh, deterministic route gating (`/holding` neutral state in Remote mode), and cross-user cache purging are established. Magic Link deep linking and Apple/Google social providers remain deferred to later passes.
* **Remote Adapter Compatibility (S1A Implemented, Adapter Still Provisional)**: Sami-owned PostgREST projections enumerate only customer-readable routine, membership, profile, and refill columns, so column-level grants do not fail due to wildcard expansion. The adapter still requires later row-to-domain mapping, routine-item assembly, live functions, and integration tests before the remote feature flag is production-ready.
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
  - **Private Photo Upload Pipeline (`src/services/onboardingPhotoUpload.ts`)**: Direct upload to private `customer-skin-photos` at server-issued paths with `upsert: false`. Zero public URLs and zero local URIs persisted.
  - **Canonical Bootstrap Coordination & Post-Submit Routing**: `10-summary.tsx` invokes the production coordinator `resolveCustomerBootstrap(activeUserId)` rather than querying raw backend state. Transitions to the application occur only when `useBootstrapStore` reaches `status === 'READY'`, letting root route gating maintain canonical navigation truth.
  - **Truthful Status Semantics (`pending_generation` vs `awaiting_review`)**: When `proposedRoutine === null` and `initialRoutineState === 'pending_generation'`, `isPlanUnderReview` is strictly `false` and copy reads "Your routine is being prepared." Only when a routine is proposed and `initialRoutineState === 'awaiting_review'` does `isPlanUnderReview` become `true` with "Final review" copy. Routine generation is strictly deferred to I1-B2.
* **Initial Routine Intelligence Pipeline & Domain Persistence (I1-B2 Planned / Sami Scope)**:
  - **Lifecycle Progression & Durability Truth**:
    1. **B1 Commit (`pending_generation`)**: Intake finalized in database; member skin profile and photo metadata committed; pending `initial_routine` founder review task created in `public.founder_review_tasks` (`status = 'pending'`); `isPlanUnderReview: false`.
    2. **B2 Server Generation (`awaiting_review`)**: Server context assembly ingests committed intake (`payload_snapshot JSONB` + canonical `skin_profiles` columns including `pregnancy_status` and `sensitivities_status`; PIH tendency is read from `payload_snapshot.pihTendencyAnswer`), invokes Gemini 2.5 Flash with structured schema, validates clinical invariants, persists proposal to `public.routines` (`version = 1`, `status = 'awaiting_review'`) and `public.routine_items`, and normalizes shelf actions into `public.user_products`. Preserves or updates the pending `initial_routine` review task (which uses `status = 'pending'`; supported DB task statuses are strictly `'pending'`, `'completed'`, `'dismissed'` — there is NO `'awaiting_review'` task status). If explicit routine linking is required (e.g. `routine_id` on `founder_review_tasks`), that is a Sami-owned additive migration.
    3. **B2 Client Hydration**: Once `RemoteDeriveService.getRoutine()` implements routine-item read assembly (currently it queries only the `routines` table header), the mobile client calls `hydrateRoutine()`, detects `routine.status === 'awaiting_review'`, sets `isPlanUnderReview: true`, and displays quiet draft preview (`DRAFT · NOT ACTIVE`) on Today and Plan. Note: `InitialRoutineState` is a shared domain type in `OnboardingResult`, not a persisted database column.
  - **Relational Domain Persistence & Required Schema Reconciliations (S2/B2)**:
    - `public.routines`: Canonical routine header (`id`, `user_id`, `version = 1`, `status = 'awaiting_review'`, `summary_sentence`, `founder_notes`, `created_at`, `published_at`).
      - *Schema Reconciliation (`B2_REQUIRED_SCHEMA_RECONCILIATION`)*: Canonical `Routine` requires `createdAt` and `updatedAt`. Current schema lacks `updated_at`. Sami should add `updated_at TIMESTAMPTZ DEFAULT NOW()` via an additive B2 migration (with `private.set_updated_at()` trigger pattern).
    - `public.routine_items`: Step items using actual schema columns (`id`, `routine_id`, `order_index`, `timing` [`'am'` | `'pm'`], `product_name`, `brand`, `category`, `amount`, `area`, `days` [`TEXT[]`], `purpose`, `why_chosen`, `watch_for`, `created_at`).
      - *Schema Reconciliation (`B2_REQUIRED_SCHEMA_RECONCILIATION`)*: Canonical `RoutineStep` requires `productId: string`. Current schema lacks `product_id`. Sami should add `product_id UUID REFERENCES public.products(id)` via an additive B2 migration to enable deterministic mapping to `RoutineStep.productId`.
      - *Derivability*: `RoutineStep.scheduleText` is optional and should be derived during DB $\to$ domain mapping from `timing` + `days` using `formatRoutineStepSchedule` rather than adding a redundant DB column.
    - `public.user_products`: Normalization of member counter products with canonical actions (`KEEP`, `PAUSE`, `REPLACE`, `ADD`, `STOP`).
      - *Persistence Invariant (`B2_REQUIRED_PERSISTENCE_INVARIANT`)*: Canonical `UserProduct` requires full canonical `product: Product`. Every B2-decided product should be normalized into `public.products`, with `user_products.product_id` referencing that row, allowing `user_products JOIN products` $\to$ canonical `UserProduct`.
  - **Current B2 Context Sources**:
    - `public.skin_profiles` provides normalized profile/safety fields: `primary_goal`, `secondary_goals`, `routine_complexity`, `cost_preference`, `midday_feel`, `post_cleanse_tightness`, `known_sensitivities`, `sensitivities_status`, `active_prescriptions`, `is_pregnant_or_nursing`, `pregnancy_status`. *(Note: `skin_profiles.pih_tendency` does NOT exist).*
    - `public.onboarding_submissions.payload_snapshot` JSONB preserves richer intake context: `confirmedProducts`, `productReactions`, `formulaSnapshots`, `adaptiveFollowUps`, `pihTendencyAnswer` (PIH answer is read from here), `hasBadReactions`, photo context, canonical Storage paths.
    - `public.user_photos` provides baseline photo metadata (`photo_type`, `storage_path`).

---

## 3. Intelligence Orchestration Layer
* **Model**: Google Gemini 2.5 Flash via structured JSON outputs, invoked only from the trusted Supabase/server environment.
* **Credential boundary**: Gemini API keys are server secrets. The Expo client must never read, embed, or ship a Gemini key (`EXPO_PUBLIC_*` Gemini variables are forbidden). Mobile talks to intelligence only through `IDeriveService`. `MockDeriveService` uses local deterministic reasoning; `RemoteDeriveService` calls Edge Functions that may invoke Gemini.
* **Context Assembly**: When evaluating queries or generating routine proposals, the backend injects:
  1. Customer skin profile from `public.skin_profiles` (primary goals, midday oil, tightness, `pregnancy_status`, `sensitivities_status`).
  2. Intake snapshot context from `public.onboarding_submissions.payload_snapshot` (`pihTendencyAnswer`, adverse reactions, confirmed shelf products, formula snapshots).
  3. Active prescription products (e.g. Differin 0.1% schedule: Mon/Wed/Fri).
  4. Tolerated shelf products vs. past adverse reactions.
  5. Most recent weekly check-in skin state and barrier symptoms.
  6. Standardized baseline photos metadata (angles, capture timestamps).
* **Clinical & Safety Invariants (Enforced in Intelligence & Persistence)**:
  1. **Sunscreen AM Invariant**: Sunscreen steps must NEVER appear in the evening (`pmSteps`) routine.
  2. **Retinoid PM Invariant**: Strong retinoids (Adapalene/Differin, Tretinoin) must NEVER appear in the morning (`amSteps`) routine.
  3. **Pregnancy / Nursing Contraindication**: Retinoids and high-strength salicylic acid are strictly excluded when `pregnancy_status === 'yes'`.
  4. **Reported Sensitivities**: Known sensitized ingredients must not be introduced in added or replacement products when `sensitivities_status === 'reported'`.
* **Routine Proposal Pipeline (`propose-routine` Edge Function & RPC)**:
  - Gateway JWT verification with handler defense-in-depth `auth.getUser()`.
  - Fail-closed intake verification: rejects requests with `400 INTAKE_NOT_COMMITTED` unless `public.onboarding_submissions` status is `committed`.
  - Fail-closed context assembly: validates canonical domain values from `skin_profiles` and `payload_snapshot`, rejecting missing or invalid goals/complexity with `400 INTAKE_CONTEXT_INVALID` without fabricating arbitrary defaults.
  - Replay idempotency: checks for existing version-1 routine in `public.routines` and returns it without duplicate writes or re-invoking the model provider.
  - Production model intelligence: powered by `gemini-3.8-flash` (configurable via `GEMINI_MODEL`, authenticated via secret `GEMINI_API_KEY`) using Google AI Studio REST endpoint with `responseMimeType: 'application/json'` and `responseSchema: GEMINI_PROPOSAL_RESPONSE_SCHEMA`. Fails closed with `503 MODEL_UNAVAILABLE` when key/provider is absent (zero fake branded product generators in production).
  - Deterministic test seam: automated CI and local test harnesses trigger `createDeterministicTestProposal` via header `x-routine-fixture: 'true'` or environment flag `ROUTINE_FIXTURE_MODE = 'true'`.
  - Post-generation deterministic validation enforcing AM/PM invariants, pregnancy contraindications, and action/category enums.
  - Trust semantics: AI-generated product recommendations in `public.user_products` are persisted with `is_confirmed_by_user = false`.
  - Customer-safe error boundary: returns strictly typed domain codes (`UNAUTHORIZED`, `INTAKE_NOT_COMMITTED`, `INTAKE_CONTEXT_INVALID`, `MODEL_UNAVAILABLE`, `MODEL_OUTPUT_INVALID`, `CLARIFICATION_REQUIRED`, `VALIDATION_FAILED`, `PERSISTENCE_FAILED`, `INTERNAL_ERROR`), never leaking stack traces, Postgres internals, SQL constraints, or provider errors to clients.
  - Transactional relational persistence via `public.commit_routine_proposal(...)` RPC executed by `service_role`: normalizes products in `public.products`, inserts version-1 routine in `awaiting_review` status, inserts `routine_items` with resolved `product_id` FKs, updates `user_products`, and updates the pending `initial_routine` founder review task notes.
* **Safety Circuit Breaker**: Pre-model regex and deterministic classifier that intercepts medical emergencies before model generation.

---

## 4. Founder Console & Concierge Operations (`admin/**`)
* Dedicated administrative and concierge operations interface for Kanuj and Sami to run the 10-member Founding Beta:
  - **Routine Review Queue**: Manually review, adjust, and approve proposed routines before initial member publication or subsequent material routine changes.
  - **Fulfillment Desk**: Manually source, purchase, and track product shipments and replenishments (`requested` → `ordered` → `shipped` → `delivered`) with carrier tracking numbers.
  - **Safety Escalation Queue**: Inspect and resolve flagged adverse reaction events.
  - **Concierge MVP Bridge**: High-touch founder delivery for the first 10 members serves as an operational learning bridge; long-term operations are software-managed and AI-led.

---

## 5. Commerce & Billing
* **Platform**: Planned Stripe Checkout for web payment of Founding Beta memberships ($100/month approved first-10 beta experiment; long-term personalized pricing architecture remains provisional).
* **Lifecycle**: Webhook events (`customer.subscription.created`, `invoice.payment_succeeded`) update the member's `memberships` status in Supabase.
* **Pricing Invariant**: Covers care management plus standard routine products. No product wallet or rollover allowance. Existing working products preserved.

---

## 6. Telemetry & Analytics
* **Provider**: Planned privacy-safe telemetry (PostHog; client-side allowlist implemented in `src/services/analytics.ts`; SDK integration planned).
* **Strict Privacy Guardrails**:
  - `disable_session_recording: true` (Session replay strictly disabled).
  - Zero health data, skin photos, symptoms, or conversation text transmitted.
  - Event payloads restricted to allowlisted navigation, operational milestones, and interaction metrics.
