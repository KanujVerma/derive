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

---

## 3. Intelligence Orchestration Layer
* **Model**: Google Gemini 2.5 Flash via structured JSON outputs, invoked only from the trusted Supabase/server environment.
* **Credential boundary**: Gemini API keys are server secrets. The Expo client must never read, embed, or ship a Gemini key (`EXPO_PUBLIC_*` Gemini variables are forbidden). Mobile talks to intelligence only through `IDeriveService`. `MockDeriveService` uses local deterministic reasoning; `RemoteDeriveService` calls Edge Functions that may invoke Gemini.
* **Context Assembly**: When evaluating queries, the backend injects:
  1. Customer skin profile (primary goals, midday oil, tightness).
  2. Active prescription products (e.g. Differin 0.1% schedule: Mon/Wed/Fri).
  3. Tolerated shelf products vs. past adverse reactions.
  4. Most recent weekly check-in skin state and barrier symptoms.
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
