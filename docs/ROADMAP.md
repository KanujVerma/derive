# Derive V1 Roadmap: Independent Founder Workstreams

Derive divides engineering into two independent, unblocked workstreams anchored on a shared contract layer.

---

## Kanuj Workstream (Customer Experience + Mobile)

### K1: Native Mobile Foundation [COMPLETE]
* **Scope**: True native 5-tab bar, Apple Liquid Glass materials, tab bottom safe-area insets (`paddingBottom: insets.bottom + 120`), native iOS haptics, motion curves, and Reduce Motion / Reduce Transparency accessibility support.
* **Acceptance Criteria**:
  - Five tabs switch instantly with correct active icons and mineral green accent.
  - Scrollable content and primary CTA buttons never collide with or get trapped behind the tab bar on any iOS device.
  - Haptics fire reliably on physical devices; fallback cleanly on simulators.

### K2: Customer Onboarding & Intake [COMPLETE]
* **Scope**: Production camera capture for bathroom shelf bottles, confirmed product rows, adverse reaction history with progressive Yes/No disclosure, reordered safety questionnaire with pregnancy/sensitivity tri-state audit, guided sequential 3-step photos (`1 Front` → `2 Left` → `3 Right`) with voice context note, and audit summary with direct edit links.
* **Acceptance Criteria**:
  - Member can complete full onboarding in under 4 minutes.
  - No duplicate questions or medical jargon.
  - Shelf products correctly populate the summary card.
  - Generates initial routine proposal with non-blocking review status (`awaiting_review`).
  - Full flow executable against `MockDeriveService`.

### K3: Core Five Tabs Experience [COMPLETE]
* **Scope**:
  - **Today**: 2-second status card, non-blocking review banner, tappable tonight routine preview, refill shipping tracker banner, and clinical insight card.
  - **Plan**: Segmented control (`ROUTINE` vs `PRODUCTS`), canonical routine drawer with dosages, application zones, rationales, and consolidated managed refill action.
  - **Scan**: Pure camera-first viewfinder (manual tabs removed), instant multi-attribute recognition, split verdict layout (`FIT FOR YOU RIGHT NOW` vs `FORMULA QUALITY`), and 1-tap Ask handoff.
  - **Ask**: Grounded conversation, scanned product context banner, starter chip routing to `/scan`, and refined composer with dedicated 44x44 voice button and camera attachment.
  - **Progress**: 100% AI-led longitudinal care loop, weekly check-in flow, SegmentedControl photo angle comparison, and plain-English learned observations.
* **Acceptance Criteria**:
  - All 5 tabs deliver distinct, high-signal value.
  - Scan → Ask handoff carries product state without re-scanning.
  - Zero streak counters or anxiety triggers.

### K4: Semantic Design System & Customer Polish [COMPLETE]
* **Scope**: Centralized semantic UI primitives in `src/components/ui/` (`Screen`, `ScreenHeader`, `StatusBadge`, `StickyActionFooter`, `SelectionRow`, `SelectionCard`, `ChoiceChip`, `SegmentedControl`, `GroupedSection`, `TextField`, `VoiceTextArea`, `InfoBanner`, `EmptyState`), spatial layout grammar (`layout.gutter: 24`, `sectionGap: 32`, `itemGap: 16`), contrast compliance (WCAG AA), zero emojis, and cleaned customer profile (internal founder desk removed).
* **Acceptance Criteria**:
  - Replaces ad-hoc inline styles across all onboarding and core screens.
  - All interactive controls satisfy 44pt minimum touch target.
  - Cleaned profile dedicated strictly to member account and history.

### K4.1: Personalized Pricing Architecture & Tab UX Refinements [COMPLETE]
* **Scope**:
  - Prototype personalized all-in monthly pricing engine in `src/pricing/**` (provisional client simulation pending co-founder review with Sami).
  - Explicitly distinguish steady-state consumption, current inventory, and initial fulfillment.
  - Price stability evaluation rule (`requiresMemberApproval: true` for cost increases).
  - Customer sees ONE all-in price; internal pricing components ($39 management, $5 risk buffer) hidden.
  - Isolate initial onboarding state (`onboardingStore`) from demo fixture data (`loadArthurDemoState()`).
  - Standardize 44x44 pt Account affordance on all 5 root tabs.
  - Implement quiet draft preview mode on Today and Plan during review (`DRAFT · NOT ACTIVE`).
  - Accordion disclosure chevrons (`up`/`down`) and multiline wrapping chat callouts.
* **Acceptance Criteria**:
  - Pricing calculation unit tests pass 100% (24/24 tests).
  - Full TypeScript typecheck passes with 0 errors.
  - Zero arbitrary subscription tiers.

### K4.2: Phenotype Architecture, Provenance & Dermatological Evidence [COMPLETE]
* **Scope**:
  - Implement client/mock phenotype module in `src/phenotype/` (`types.ts`, `profile.ts`, `evidence-policy.ts`, `tint-compatibility.ts`, `fixtures.ts`).
  - Categorical provenance & confidence modeling (`ProvenancedValue<T>`) with strict confirmation invariant (`setOrConfirmPhenotypeValue`: member confirmation outranks unconfirmed photo estimates).
  - Single V1 onboarding adaptive question for persistent dark mark tendency (*"Do breakouts or irritation usually leave dark marks that stick around?"*) triggered by `breakouts` or `dark_spots` goals.
  - Dermatological evidence policy decoupling scientific grade (`A`/`B`/`C`/`D`) from member applicability (Grade C observational meta-analyses cannot silently alter active routines; Grade D preliminary claims cannot drive product behavior).
  - Categorical tint compatibility and white-cast assessment with iron oxide visible-light photoprotection identification.
* **Acceptance Criteria**:
  - Full test suite passes 100% (36/36 tests).
  - Clean TypeScript typecheck (0 errors) and web export.
  - Zero race/ethnicity classifiers, CV colorimeters, or Fitzpatrick ML inference.

### K4.3: Founding Beta Client Readiness [COMPLETE]
* **Scope**:
  - Customer-facing first-10 beta pricing truth ($100/mo) centralized via `src/constants/config.ts` across Account Profile, Managed Orders, and Onboarding Summary.
  - UserStore demo isolation: decoupled tier string from price literals (`Founding Beta`), isolated Arthur demo identity in explicit `loadArthurDemoUser()`, default state initialized cleanly to `Beta Member`.
  - Truthful onboarding trust copy: removed unsupported "pick up where you left off" resumability, "end-to-end encryption", and "medical context"; framed assisted setup as operational concierge support (`concierge@derive.skin`).
  - Mandatory Founding Beta baseline photos: Front, Left, and Right captures required; skip bypass removed; Continue button strictly gated on all 3 captures; right profile subtext clarified to cosmetic texture/clarity.
  - In-app live camera foundation: built using installed `expo-camera` (`CameraView`) with front-facing live selfie stream, face oval guide, top HUD instruction pill, manual shutter, and review state (`Use Photo` / `Retake`); photo library upload strictly disabled for face baseline photos; permission handling with Settings redirect.
  - Extensible quality-gating contract: defined `QualityGatingConfig` and `CaptureQualityCriteria` interface; deferred native frame analysis/auto-capture to dedicated native pass (`ARCHITECTURE_CHALLENGE-04`).
  - Today actionable research filtering: clinical literature surfaces on Today strictly when directly relevant to an active routine change or adaptation; non-actionable educational research omitted from Today to protect the 2-second glance.
* **Acceptance Criteria**:
  - Full test suite passes 100% (42/42 tests).
  - TypeScript typecheck passes with 0 errors (`npx tsc --noEmit`).
  - Web export passes cleanly (`EXPO_NO_TELEMETRY=1 npx expo export -p web`).
  - Zero customer-facing `$129` promises in Kanuj-owned paths.
  - Zero unsupported E2EE or medical claims in customer-facing copy.

### K4.4: Baseline Capture Intelligence, Instant Product Scanning & Beta State Finalization [WIRED & COMPILATION READY / PHYSICAL DEVICE VALIDATION IN K5]
* **Scope**:
  - Purged remaining default demo state contamination from `routineStore`: initialized `routine: null`, `userProducts: []`, `checkIns: []`, `refillRequests: []`, and empty history by default; isolated Arthur fixture into explicit `loadArthurDemoRoutine()` and `getArthurDemoRoutineState()`; removed misleading `initializeDefaultRoutine` action.
  - Gated development surfaces (`ProfileScreen` demo controls, `Scan` test presets, `params.sim` parameter) behind `__DEV__`; simulation fails closed without match (zero silent fallback to `PROTOTYPE_CATALOG[0]`).
  - Empty-state hardening across Progress, Refill, Plan, and Profile with dynamic routine/treatment adaptive advice.
  - Zero-shutter continuous barcode scanner on Scan tab (`CameraView` with `onBarcodeScanned`), horizontal reticle guide, synchronous lock/debounce ref, torch toggle, and unknown product sheet with search fallback.
  - Deterministic barcode utilities (`normalizeBarcode`, `getBarcodeLookupKeys`, `validateBarcodeChecksum`) resolving UPC-A and EAN-13 variations.
  - Resolved `ARCHITECTURE_CHALLENGE-04`: implemented Apple Vision + AVFoundation local Expo module (`modules/derive-face-capture/`) with CocoaPods podspec and Expo autolinking (`DeriveFaceCaptureModule`); Swift syntax verified; pure TypeScript deterministic state machine (`AutoCaptureStateMachine.ts`) enforcing continuous hold stability before triggering capture.
  - Fully wired native face capture into `CameraCapture.tsx` and onboarding baseline photos (`app/(onboarding)/7-skin-photos.tsx`) with ref forwarding, imperative `takePhoto()`, frame metrics feedback, single-camera mounting, and clean web/simulator fallback to `expo-camera`.
  - Physical hardware sensor calibration and lighting tolerance testing explicitly scheduled for K5 on TestFlight.
* **Acceptance Criteria**:
  - Full test suite passes 100% (51/51 tests).
  - TypeScript typecheck passes with 0 errors (`npx tsc --noEmit`).
  - Web export passes cleanly (`EXPO_NO_TELEMETRY=1 npx expo export -p web`).
  - Native Swift syntax checks pass cleanly (`swiftc -parse`).
  - Expo autolinking resolves `DeriveFaceCapture` pod and module.
  - Zero unconfirmed demo data leaks into fresh client launches; dev controls hidden in production.
  - Barcode lookup correctly identifies products across UPC and EAN formats without shutter press.

### K5: Mobile Release & TestFlight [IMPLEMENTATION COMPLETE · ASC UPLOADED · PHYSICAL SMOKE DEFERRED TO I1]
* **Scope**: EAS configuration, development client builds, production provisioning profiles, TestFlight deployment, physical device validation, and first-customer test script.
* **Landed**:
  - `expo-dev-client`, `eas.json` (development + production profiles, remote `appVersionSource`, Mock/local `EXPO_PUBLIC_USE_REMOTE_SERVICE=false`), first-customer script.
  - Local CocoaPods autolinking of `DeriveFaceCapture` + `expo-dev-client`; local simulator native binary verified.
  - Expo project linked: `@derive-skincare/derive` (`4100d696-3e03-4b2c-bdb3-1986d5f1a624`).
  - Export compliance declared as HTTPS-only via `ios.config.usesNonExemptEncryption: false`.
  - Apple Developer signing credentials and distribution profile provisioned.
  - Production EAS build `3846b3b4-5a36-4f5a-b6bc-c78418987606` (Version `1.0.0 (3)`) succeeded cleanly on EAS cloud builders.
  - TestFlight submission `f19df267-fde8-45f4-8662-e803fddf87be` completed; `.ipa` uploaded to App Store Connect (`ascAppId: 6813524447`).
* **Deferred to I1**:
  - Physical TestFlight installation and hardware validation on connected device.

### K6: Mobile Service Boundary & Remote-Readiness [COMPLETE]
* **Scope**:
  - Centralize client-side domain operations through `src/services/deriveClient.ts` delegating strictly to `IDeriveService` (`getDeriveService()`).
  - Partition local camera catalog and barcode lookup fixtures into `src/services/catalog.ts` (`findProductByBarcode`, `PROTOTYPE_CATALOG`, `recognizeShelfProducts`).
  - Eliminate all direct server workflow imports (`src/services/ai-workflows/**`) across the entire `app/**` directory.
  - Harden `MockDeriveService` to initialize strictly clean by default (`activeRoutine = null`, empty orders, empty check-ins, empty insights, `null` customer profile). Arthur demo fixture isolated in explicit `seedArthurDemoData()`.
  - Refactor all client screens to traverse `deriveClient`:
    - `app/(onboarding)/10-summary.tsx`: calls `submitOnboarding()`, displays error banner on failure.
    - `app/(onboarding)/6-shelf.tsx`: routes shelf recognition through `@/src/services/catalog`.
    - `app/(tabs)/ask.tsx`: routes Ask queries through `askQuestion()`.
    - `app/(tabs)/scan.tsx`: routes product scanning through `evaluateProduct()`.
    - `app/check-in/index.tsx`: routes check-ins through `submitWeeklyCheckIn()`.
    - `app/refill/index.tsx`: routes refills through `requestProductRefill()`.
    - `app/orders/index.tsx`: hydrates orders through `hydrateOrders()`.
    - `app/(tabs)/progress.tsx`: hydrates progress through `hydrateProgress()`.
    - `app/(tabs)/index.tsx`: hydrates routine, research insights, and orders through service boundary.
    - `app/(tabs)/plan.tsx`: hydrates routine through service boundary.
    - `app/insights/[id].tsx`: hydrates research through `hydrateResearchInsights()`.
    - `app/profile/index.tsx`: hydrates profile through `hydrateCustomerProfile()`.
  - Service swappability verified: injecting a test double via `setDeriveService()` transparently powers all client screens with zero UI refactoring.
* **Acceptance Criteria**:
  - 100% test suite passing (55/55 tests in `tests/derive.test.ts`).
  - Zero `ai-workflows` imports in `app/**` verified by automated architectural lint test.
  - TypeScript typecheck passes with 0 errors (`npx tsc --noEmit`).
  - Web export passes cleanly (`EXPO_NO_TELEMETRY=1 npx expo export -p web`).
  - Zero Gemini API key on client.

### K6.1: Service Boundary Hardening & Fail-Closed State [COMPLETE]
* **Scope**:
  - Fix Scan-to-Ask route parameters: aligned to `{ productName, brand, verdict, reason }` with legacy fallback support, avoiding fake `ProductScanResult` synthesis from partial strings.
  - Remote identity fail-closed validation: `isRemoteServiceEnabled()` helper added to `DeriveService.ts`; `getActiveUserId()` and `resolveUserId()` in `deriveClient.ts` fail closed and throw in Remote mode if unauthenticated, empty, or mock IDs (`usr_beta_member`, `usr_beta_001`) are used.
  - Production shelf recognition fail-closed: `recognizeShelfProducts()` returns empty list by default; demo fixture isolated to `getDemoShelfRecognitionFixture()`; added empty shelf guidance card in `6-shelf.tsx`.
  - Canonical null routine projection: `hydrateRoutine()` explicitly sets `routine: null, isPlanUnderReview: false` when backend returns null.
  - Async mutation error recovery: hardened error handling, loading states, and recovery in `scan.tsx`, `ask.tsx`, `check-in/index.tsx`, and `refill/index.tsx`.
* **Acceptance Criteria**:
  - 100% test suite passing (60/60 tests in `tests/derive.test.ts`), with 5 new regression tests.
  - TypeScript typecheck passes with 0 errors (`npx tsc --noEmit`).
  - Web export passes cleanly (`EXPO_NO_TELEMETRY=1 npx expo export -p web`).
  - Zero contracts or backend code modified.

### K6.2: Integration-Semantics & Error Hardening [COMPLETE]
* **Scope**:
  - Full-fidelity Scan → Ask context preservation: `useScanContextStore` in `src/stores/scanContextStore.ts` carries the full typed `ProductScanResult` across navigation boundaries; Ask synchronously delivers it to `askQuestion` on initial and subsequent queries; banner dismissal or "New chat" clears context.
  - Remote identity guard refinement: `resolveUserId()` rejects missing, empty, and whitespace-only (`'   '`) strings with clear client guard messaging (`Valid member identity required: Remote operations require a non-mock customer identity.`).
  - Customer-safe error sanitization: centralized mapper `src/utils/customerErrors.ts` ensures all client UI displays empathetic Direction A Mineral copy instead of leaking raw backend/technical errors (`PostgREST`, `Supabase`, `RemoteDeriveService`), while preserving technical logs in `console.warn` and protecting user draft inputs.
* **Acceptance Criteria**:
  - 100% test suite passing (64/64 tests in `tests/derive.test.ts`), with 4 new K6.2 regression tests.
  - TypeScript typecheck passes with 0 errors (`npx tsc --noEmit`).
  - Web export passes cleanly (`EXPO_NO_TELEMETRY=1 npx expo export -p web`).
### K6.3: Test Integrity, CI Typechecking & Contract Truth [COMPLETE]
* **Scope**:
  - Close false-green CI hole: add `tsconfig.tests.json`, `"typecheck:tests": "tsc -p tsconfig.tests.json --noEmit"` in `package.json`, dedicated test typecheck step in `.github/workflows/ci.yml`, and enforce in `AGENTS.md` completion rules.
  - Canonical contract truth & fixture realignment: audit all test fixtures against canonical schemas, eradicating hallucinated fields (`barcode`, `confidence`, `ingredientsIdentified`, `safetyFlags`, `fitScore`) and illegal verdicts (`verdict: 'keep'`), restoring required canonical `ProductScanResult` properties (`category`, `keyActives`, `factsUsedToDecide`) and legal verdicts (`fits_plan`, `great_fit`). Production contracts remain authoritative; tests adapt strictly to contracts.
  - Separation of route display fallback from service context: create pure utility `src/utils/scanContext.ts` (`resolveAskDisplayBanner`, `resolveAskServiceContext`). Route query strings provide visual UI continuity (e.g. for deep links) and are never synthesized into artificial `ProductScanResult` domain records. Only the full typed `ProductScanResult` from `useScanContextStore` is sent to `IDeriveService.askDerive()`.
* **Acceptance Criteria**:
  - 100% test suite passing (65/65 tests in `tests/derive.test.ts`), with dedicated K6.3 regression tests.
  - Application typecheck passes with 0 errors (`npx tsc --noEmit`).
  - Test typecheck passes with 0 errors (`npm run typecheck:tests`).
  - Web export passes cleanly (`EXPO_NO_TELEMETRY=1 npx expo export -p web`).
  - Zero contracts or backend code modified.

### I1-A1: Mobile Auth & Session Spine [COMPLETE]
* **Scope**:
  - Implement mobile passwordless Email OTP flow (`signInWithOtp` -> `verifyOtp`) in `src/services/authClient.ts` with Direction A Mineral UI (`app/(auth)/login.tsx`, `app/(auth)/verify-otp.tsx`).
  - Configure `@react-native-async-storage/async-storage` session persistence for Supabase client in `src/services/supabase.ts`.
  - Provide lightweight auth state projection (`useAuthStore`) and user store session identity projection (`setRemoteSessionUser`) that strictly decouples session establishment from paid membership assertions.
  - Enforce cross-user cache and state purging on sign-out via `resetCustomerSessionData()` in `src/services/sessionReset.ts`.
  - Implement deterministic route gating and `AppState` auto-refresh listeners in `app/_layout.tsx` and `app/index.tsx`, while preserving 100% bypass in Mock mode.
* **Acceptance Criteria**:
  - 100% test suite passing (73/73 tests in `tests/derive.test.ts`), with 8 dedicated I1-A1 regression tests.
  - Application typecheck passes with 0 errors (`npx tsc --noEmit`).
  - Test typecheck passes with 0 errors (`npm run typecheck:tests`).
  - Web export passes cleanly (`EXPO_NO_TELEMETRY=1 npx expo export -p web`).
  - `eas.json` strictly preserves `EXPO_PUBLIC_USE_REMOTE_SERVICE: "false"`.
  - Zero contracts or backend code modified.

### I1-A1.1: Session Isolation & Post-Auth Routing Hardening [COMPLETE]
* **Scope**:
  - Establish neutral profile-resolution holding state (`/holding`, `app/holding.tsx`) in Remote mode: authenticated sessions route to `/holding` rather than branching on local `onboardingStore.isCompleted`, leaving canonical onboarding and membership determination to future remote profile hydration (I1-A2).
  - Centralize production routing policy in pure testable helper `resolveAuthRoute` (`src/utils/authRouting.ts`) shared identically by `app/index.tsx`, `app/_layout.tsx`, `app/(auth)/verify-otp.tsx`, and `tests/derive.test.ts`.
  - Include `useOnboardingStore.resetOnboarding()` in `resetCustomerSessionData()` so sensitive face photos, skin goals, adverse reaction logs, and prescriptions never leak across authenticated accounts.
  - Enforce cross-user cache purging on cold-start when no active session is found (`getCurrentSession()`).
  - Detect authenticated user UUID transitions ($A \rightarrow B$) in `subscribeToAuth` and `verifyEmailOtp` and purge old user caches before projecting the new identity, while preserving caches across same-user token refreshes ($A \rightarrow A$).
  - Configure explicit local device sign-out scope (`{ scope: 'local' }`) matching customer UI copy ("End session on this device").
  - Enforce truthful sign-out verification in `signOutSession()`: verify session termination in provider on error and prevent UI navigation if session remains active.
  - Enforce token minimization in `verifyEmailOtp`: never expose access/refresh tokens to the calling UI (`VerifyOtpResult`).
  - Correct documentation drift in `docs/ARCHITECTURE.md` to reflect passwordless 6-digit Email OTP architecture.
* **Acceptance Criteria**:
  - 100% test suite passing (75/75 tests in `tests/derive.test.ts`), with dedicated I1-A1.1 regression tests.
  - Application typecheck passes with 0 errors (`npx tsc --noEmit`).
  - Test typecheck passes with 0 errors (`npm run typecheck:tests`).
  - Web export passes cleanly (`EXPO_NO_TELEMETRY=1 npx expo export -p web`).
  - `eas.json` strictly preserves `EXPO_PUBLIC_USE_REMOTE_SERVICE: "false"`.
### I1-A1.2: Final Auth Route & Session-Truth Closure [COMPLETE]
* **Scope**:
  - Global Remote Route Enforcement: Implement pure helper `getAuthRedirectRoute` in `src/utils/authRouting.ts` and integrate into root `app/_layout.tsx`, guaranteeing that Remote authenticated sessions (`SIGNED_IN`) cannot bypass `/holding` via direct links, tab URLs, onboarding paths, profile, orders, check-ins, or modal routes, while preventing self-redirect loops when already on `/holding` or inside `(auth)`.
  - Fail-Closed Sign-Out Verification Truth Table: Refactor `signOutSession()` in `src/services/authClient.ts` to implement a strict 7-case fail-closed truth table. Verification errors or exceptions from `getSession()` fail closed (returning failure and preserving customer caches) rather than guessing logout success.
  - Founder Mode Isolation: Reset `isFounderMode: false` on `logout()` and force `isFounderMode: false` on `setRemoteSessionUser()` in `src/stores/userStore.ts`. Ensures founder/debug state never survives cross-account transitions or Remote customer identity projection.
* **Acceptance Criteria**:
  - 100% test suite passing (76/76 tests in `tests/derive.test.ts`), with dedicated I1-A1.2 regression tests covering global route enforcement (12 scenarios), fail-closed sign-out truth table (7 cases), and founder mode isolation (4 scenarios).
  - Application typecheck passes with 0 errors (`npx tsc --noEmit`).
  - Test typecheck passes with 0 errors (`npm run typecheck:tests`).
  - Web export passes cleanly (`EXPO_NO_TELEMETRY=1 npx expo export -p web`).
  - `eas.json` strictly preserves `EXPO_PUBLIC_USE_REMOTE_SERVICE: "false"`.
  - Zero contracts or backend code modified.

### I1-A2: Remote Customer Bootstrap Resolution & Profile Handshake [COMPLETE]
* **Scope**:
  - Replace temporary static `/holding` dead-end with canonical Remote bootstrap resolution handshake (`CustomerBootstrapState`).
  - Distinguish auth identity (`auth.users`), profile existence (`public.profiles`), and canonical onboarding completion (`public.skin_profiles.onboarding_completed`).
  - Independent membership resolution: query latest row deterministically by `created_at` descending; map missing rows to `none` without blocking onboarding or routing.
  - Safe mapping: eliminate raw `as unknown as CustomerProfile` casts; explicitly map DB columns to domain properties; protect Stripe customer/subscription IDs from client projection.
  - Client bootstrap state machine (`useBootstrapStore`): manage `UNRESOLVED`, `RESOLVING`, `NEEDS_ONBOARDING`, `READY`, `ERROR` states with fail-closed error handling.
  - Holding screen integration: render active resolving spinner vs. calm error canvas with "Try Again" retry and "Sign Out" affordances.
  - Routing integration: pure routing helpers `resolveAuthRoute` and `getAuthRedirectRoute` route new authenticated members to `/(onboarding)/1-welcome`, onboarded members to `/(tabs)`, and failing/resolving sessions to `/holding`.
  - Full test suite: comprehensive behavioral tests covering shared contract, mock state, PostgREST query execution, profile mapping, and client lifecycle.
* **Acceptance Criteria**:
  - 100% test suite passing (81/81 tests in `tests/derive.test.ts`), including 14 new dedicated I1-A2 bootstrap resolution tests.
  - Application typecheck passes with 0 errors (`npx tsc --noEmit`).
  - Test typecheck passes with 0 errors (`npm run typecheck:tests`).
  - Web export passes cleanly (`EXPO_NO_TELEMETRY=1 npx expo export -p web`).
  - `eas.json` strictly preserves `EXPO_PUBLIC_USE_REMOTE_SERVICE: "false"`.

### I1-A2.1: Bootstrap Freshness & Founder Surface Isolation [COMPLETE]
* **Scope**:
  - Bound async bootstrap resolution (`resolveCustomerBootstrap`) and profile hydration (`hydrateCustomerProfile`) to active authenticated session UUID (`useAuthStore.sessionUserId`) and monotonic attempt generation (`resolutionAttempt`).
  - Stale success, error, membership projection, or profile projection from prior attempts or switched identities ($A \rightarrow B$) are discarded.
  - Same-user retry races discard older errors when newer attempts succeed.
  - Session reset (`resetBootstrap`, `resetCustomerSessionData`) increments attempt generation, invalidating in-flight network promises.
  - Isolate local/demo mobile founder routes (`/founder/**`): Remote customers are redirected to `/(tabs)` when READY, onboarding when NEEDS_ONBOARDING, holding when UNRESOLVED/RESOLVING/ERROR, and login when SIGNED_OUT.
  - Preserve developer/demo founder workflow in Mock mode.
* **Acceptance Criteria**:
  - 100% test suite passing (86/86 tests in `tests/derive.test.ts`), including 5 new dedicated I1-A2.1 tests.
  - Application typecheck passes with 0 errors (`npx tsc --noEmit`).
  - Test typecheck passes with 0 errors (`npm run typecheck:tests`).
  - Web export passes cleanly (`EXPO_NO_TELEMETRY=1 npx expo export -p web`).
  - `eas.json` strictly preserves `EXPO_PUBLIC_USE_REMOTE_SERVICE: "false"`.
  - Zero shared contract or backend modifications.

## Sami Workstream (Platform + Intelligence + Operations)

### S1: Platform Foundation [IN PROGRESS — S1A DATA PLANE HARDENED]
* **Scope**: Supabase setup, baseline PostgreSQL schema, reproducible migration scripts, customer authentication, private photo storage buckets, Row-Level Security (RLS) policies, and secure environment secrets management.
* **Implemented in S1A**:
  - Committed local Supabase configuration and an additive migration chain.
  - Auth-user profile provisioning with a hardened trigger and backfill.
  - Explicit grants plus operation-specific RLS on every existing public application table.
  - Private `customer-skin-photos` bucket, member-ID path isolation, immutable uploads, and no client download/list/sign/update/delete permission.
  - pgTAP coverage for exact policy/grant shape, auth provisioning and synchronization, anonymous denial, owner/cross-owner access, server-owned fields, and private Storage policy behavior.
  - Explicit safe-column projections in the Sami-owned remote adapter, avoiding wildcard expansion across protected membership and routine fields.
* **Remaining Before S1 Is Complete**:
  - Run `supabase db reset` and `supabase test db` against a Docker-backed official local stack and make that verification repeatable in CI.
  - Implement persistent Expo auth sessions and authenticated route/callback handling in a coordinated shared/mobile change.
  - Implement a JWT-bound server signer that issues 15-minute photo URLs without trusting caller-supplied user IDs or paths.
  - Implement idempotent Storage-API deletion before relational/auth deletion; database cascades alone do not delete physical objects.
  - Replace the unused arbitrary/upserting client upload helper with the canonical bucket and member-owned path convention, then run an API-level upload smoke test in a coordinated change.
  - Finish remote row-to-domain mapping, routine-item assembly, live function coverage, and integration tests before enabling the remote service in production.
* **Acceptance Criteria**:
  - Migrations run cleanly from a fresh Supabase database.
  - RLS strictly isolates member data: customer can only read/write their own records.
  - Customer skin photos accessible solely via short-lived signed URLs (no public URLs).
  - Zero secrets committed to version control.

### S2: Core Domain Persistence
* **Scope**: Relational tables and queries for customer profiles, skin profiles, catalog products, formula snapshots, product reactions, ingredient signals, routine versions, weekly check-ins, photo records, and refill orders.
* **Acceptance Criteria**:
  - Canonical state persists reliably across app restarts.
  - Routine updates create new version snapshots rather than overwriting historical records.
  - Product reactions persist historical formula snapshots at the exact time of the reaction.

### S3: Server-Side Intelligence Services
* **Scope**: Edge Functions for routine proposal generation, product scan evaluation with categorical verdicts, Ask Derive conversation synthesis, safety classifier circuit breaker, and probabilistic ingredient signal inference.
* **Acceptance Criteria**:
  - Edge Function endpoints satisfy `IDeriveService` shared contracts.
  - Prompt context includes user's active prescriptions, Differin schedule, and reaction history.
  - All mandatory emergency/red-flag fixtures escalate correctly; no known mandatory-escalation fixture is missed; the classifier remains conservative under uncertainty.
  - Ingredient signals update confidence based on multi-product overlap and tolerated exposure discounting.

### S4: Founder Operations Console
* **Scope**: Lightweight internal administrative portal (`admin/**`) for managing the initial 10 Founding Beta members ($100/month concierge operating experiment; long-term personalized pricing architecture remains provisional). Routine review queue, refill replenishment status updater, product formula auditor, and internal clinical notes.
* **Acceptance Criteria**:
  - Founders can review, edit, and publish routine proposals before member notification.
  - Refill orders can be transitioned (`requested` → `ordered` → `shipped` → `delivered`) with carrier tracking numbers.
  - Safety escalation flags appear in an urgent review queue.

### S5: Commerce & Remote Service Integration
* **Scope**: Stripe checkout / customer portal integration for Founding Beta memberships ($100/month approved first-10 beta experiment; long-term personalized pricing architecture remains provisional), webhook listeners for subscription lifecycle, and `RemoteDeriveService` client adapter implementation.
* **Acceptance Criteria**:
  - Stripe webhook maps customer email to Supabase member record.
  - `RemoteDeriveService` passes the full test suite against live Supabase Edge Functions.
  - Mobile app can toggle from `MockDeriveService` to `RemoteDeriveService` via a single environment flag.

---

## Shared Milestone

### I1: Mock → Remote DeriveService Integration
* **Scope**: Joint end-to-end integration test verifying complete customer lifecycle on live backend:
  Onboarding → Profile → Routine Generation → Founder Review & Approval → Today Display → Shelf Audit → Product Scan → Ask Context → Weekly Check-In → Refill Request → Tracking.
* **Acceptance Criteria**:
  - Kanuj switches `EXPO_PUBLIC_USE_REMOTE_SERVICE=true` without changing UI code.
  - All flows execute flawlessly end-to-end.
