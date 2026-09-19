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

### I1-B0: Onboarding Persistence Contract & Safety Alignment [COMPLETE]
* **Scope**:
  - Resolved `ARCHITECTURE_CHALLENGE-02` (Safety Status Provenance) and `ARCHITECTURE_CHALLENGE-03` (Routine Action Alignment):
  - Additive database migration `20260918203554_onboarding_safety_status_and_action_pause.sql`:
    - Added `pregnancy_status` (CHECK `in ('yes', 'no', 'prefer_not_to_say', 'unanswered')`) and `sensitivities_status` (CHECK `in ('none_known', 'reported', 'unanswered')`) to `public.skin_profiles` with `NOT NULL` and default `'unanswered'`.
    - Conservative epistemic backfill: `is_pregnant_or_nursing IS TRUE` -> `'yes'`, else `'unanswered'` (never infers explicit negative); non-empty `known_sensitivities` -> `'reported'`, else `'unanswered'`.
    - Granted column-level insert/update privileges to `authenticated` role.
    - Updated `public.user_products.action` check constraint to accept `PAUSE` alongside `KEEP`, `REPLACE`, `ADD`, and `STOP`.
  - Shared domain and schema contracts:
    - Added `PregnancyStatusSchema`, `SensitivitiesStatusSchema`, and updated `SkinProfile` and `OnboardingPayload.safetyContext` in `src/types/schema.ts` and `src/domain/types.ts`.
  - Pure payload builder:
    - Created `buildOnboardingPayload()` in `src/services/deriveClient.ts` to construct canonical `OnboardingPayload` with safety status provenance and enforce fail-closed non-mock identity protection in Remote mode.
  - Client state & UI non-coercion:
    - Updated `useOnboardingStore` default state and `setSafetyContext` fallbacks.
    - Fixed `app/(onboarding)/8-safety.tsx`: `hasNoSensitivities` initialized strictly to `sensitivitiesStatus === 'none_known'` and `pregnancyState` strictly to `pregnancyStatus`, preventing initial unanswered state from collapsing into false negatives; rendered active sensitivity chips.
    - Fixed `app/(onboarding)/10-summary.tsx`: display copy shows `'Not answered'` for unanswered pregnancy and sensitivities states; uses `buildOnboardingPayload`.
  - Service & test verification:
    - Updated `MockDeriveService.onboard()` to preserve safety statuses.
    - Expanded pgTAP test suite in `supabase/tests/s1_access_control.test.sql` to 71 tests.
    - Added 6 dedicated unit tests to `tests/derive.test.ts` (92/92 passing).
* **Acceptance Criteria**:
  - 100% test suite passing (92/92 tests in `tests/derive.test.ts`).
  - Application typecheck passes with 0 errors (`npx tsc --noEmit`).
  - Test typecheck passes with 0 errors (`npm run typecheck:tests`).
  - Web export passes cleanly (`EXPO_NO_TELEMETRY=1 npx expo export -p web`).
  - `eas.json` strictly preserves `EXPO_PUBLIC_USE_REMOTE_SERVICE: "false"`.
  - Database runtime verification status truthfully reported (Docker daemon absent).

### I1-B1: Authenticated Remote Onboarding Intake Commit & Private Photo Pipeline [COMPLETE]
* **Scope**:
  - Additive database migration `20260918213146_onboarding_intake_submission_and_idempotency.sql`:
    - Created `public.onboarding_submissions` table for durable intake staging with unique partial index on `(user_id) WHERE status = 'draft'`.
    - Revoked all privileges on `onboarding_submissions` from `anon` and `authenticated`; granted full access to `service_role`.
    - Added partial unique index on `public.founder_review_tasks (user_id, task_type) WHERE task_type = 'initial_routine' AND status = 'pending'` for idempotency.
    - Attached `private.set_updated_at()` trigger to `onboarding_submissions`.
  - Edge Functions implementation:
    - `prepare-onboarding`: Authenticates caller JWT via `supabase.auth.getUser()`, derives immutable user UUID, creates or retrieves active draft submission, verifies any previously uploaded photos for retry support, and returns server-issued upload targets (`<userId>/<angle>/<opaque_id>.jpg`).
    - `onboard-customer`: Authenticates caller JWT, validates payload consistency (rejecting safety contradictions), verifies existence of required private photos (`front`, `left`, `right`, and optional `shelf`) in `customer-skin-photos` using admin client, sanitizes snapshot (stripping local `file:///` URIs), commits `onboarding_submissions` to `committed`, upserts `skin_profiles` with `onboarding_completed = false`, records `user_photos` rows, creates pending `initial_routine` founder review task, and **strictly last** sets `skin_profiles.onboarding_completed = true`.
  - Shared contracts & domain types:
    - Added `InitialRoutineState = 'pending_generation' | 'awaiting_review'`.
    - Evolved `OnboardingResult`: `proposedRoutine: Routine | null`, `initialRoutineState: InitialRoutineState`.
    - Enriched `OnboardingPayload` with `formulaSnapshots`, `adaptiveFollowUps`, `pihTendencyAnswer`, `hasBadReactions`, and `skinPhotos.shelfUri`.
  - Client photo upload helper (`src/services/onboardingPhotoUpload.ts`):
    - Uploads private photos directly to `customer-skin-photos` at server-issued paths with `upsert: false`. Detects MIME types and throws on error, never persisting local URIs.
  - RemoteDeriveService & Client integration:
    - Implemented 3-stage `onboard(payload)` pipeline in `RemoteDeriveService.ts`: `prepare-onboarding` -> upload photos -> `onboard-customer`.
    - Hardened `submitOnboarding()` in `src/services/deriveClient.ts` to safely handle `proposedRoutine: null` without dereferencing `status`, and preserve proven remote membership status.
    - Updated `app/(onboarding)/10-summary.tsx` to re-resolve `CustomerBootstrapState` and verify `onboardingCompleted === true` before navigating in Remote mode.
  - Database & test verification:
    - Colima native container runtime active; Supabase local stack fully running.
    - 83/83 pgTAP assertions passing across `s1_access_control.test.sql` and `i1_b1_onboarding_intake.test.sql`.
    - End-to-end integration verified on real local Supabase with synthetic authenticated test user.
    - 97/97 unit tests passing in `tests/derive.test.ts`.
* **Acceptance Criteria**:
  - 100% test suite passing (97/97 tests in `tests/derive.test.ts`).
  - 100% pgTAP test suite passing (83/83 assertions).
  - Application typecheck passes with 0 errors (`npx tsc --noEmit`).
  - Test typecheck passes with 0 errors (`npm run typecheck:tests`).
  - Web export passes cleanly (`EXPO_NO_TELEMETRY=1 npx expo export -p web`).
  - `eas.json` strictly preserves `EXPO_PUBLIC_USE_REMOTE_SERVICE: "false"`.
  - End-to-end intake verified on local Supabase container stack.

### I1-B1.1: Transactional Intake Finalization, Auth Gate & Canonical Post-Commit Routing [COMPLETE]
* **Scope**:
  - Additive database migration `20260918230000_transactional_intake_and_replay_idempotency.sql`:
    - Enforced at most one committed initial intake per member via partial unique index `onboarding_submissions (user_id) WHERE status = 'committed'`.
    - Enforced Storage path uniqueness on `user_photos (storage_path)`.
    - Enforced storage path check constraints on `onboarding_submissions` (`front`, `left`, `right`, and `shelf` matching caller UUID prefixes and folder categories).
    - Created atomic transactional RPC `public.commit_onboarding_intake` executed by `service_role` (`SECURITY INVOKER`, privileges revoked from `PUBLIC`, `anon`, `authenticated`), guaranteeing atomic rollback on any relational error.
  - Platform gateway JWT verification:
    - Enabled `verify_jwt = true` in `supabase/config.toml` for `prepare-onboarding` and `onboard-customer`, blocking unauthenticated/malformed tokens at the platform gateway while retaining handler `auth.getUser()` defense in depth.
  - Edge Functions hardening:
    - `prepare-onboarding`: Resumes committed intake without creating duplicate drafts; recovers from concurrent draft insert races (`23505`) by re-querying the winning draft.
    - `onboard-customer`: Recognizes already-committed submissions and replays the canonical result without repeating relational writes or duplicate tasks.
    - Sanitized customer-safe error codes (`UNAUTHORIZED`, `INVALID_PAYLOAD`, `PHOTO_VERIFICATION_FAILED`, `NO_ACTIVE_DRAFT`, `ONBOARDING_COMMIT_FAILED`, `INTERNAL_ERROR`).
  - Canonical post-submit bootstrap coordinator:
    - Replaced raw bootstrap queries in `10-summary.tsx` with production coordinator `resolveCustomerBootstrap(activeUserId)` on the active authenticated Supabase session user, requiring `useBootstrapStore.status === 'READY'` before app transition.
  - Truthful status semantics:
    - Decoupled `pending_generation` (`isPlanUnderReview: false`, "Your routine is being prepared.") from `awaiting_review` (`isPlanUnderReview: true`, "Final review").
  - Committed local E2E test harness (`scripts/test-i1-b1-local.mjs`):
    - Repeatable full-stack test exercising Auth, Edge Gateway, Storage, transactional commit, atomic rollback, and replay idempotency with synthetic users.
  - Database CI gate:
    - Added `database` job to `.github/workflows/ci.yml` running `supabase start`, `supabase db reset`, `supabase test db`, and `node scripts/test-i1-b1-local.mjs`.
* **Acceptance Criteria**:
  - 100% test suite passing (100/100 tests in `tests/derive.test.ts`).
  - 100% pgTAP test suite passing (96/96 assertions in `supabase/tests/**`).
  - 100% local E2E test harness passing (11/11 stages in `scripts/test-i1-b1-local.mjs`).
  - Application typecheck passes with 0 errors (`npx tsc --noEmit`).
  - Test typecheck passes with 0 errors (`npm run typecheck:tests`).
  - Web export passes cleanly (`EXPO_NO_TELEMETRY=1 npx expo export -p web`).
  - `eas.json` strictly preserves `EXPO_PUBLIC_USE_REMOTE_SERVICE: "false"`.
  - Database & integration tests automated in GitHub Actions CI.

### I1-B2: Initial Routine Intelligence Integration [NEXT · SAMI PRIMARY]
* **Scope**:
  - **Server-Side Intelligence & Persistence (Sami Primary)**:
    - Context assembly: Ingest committed intake snapshot from `public.onboarding_submissions.payload_snapshot` (including `pihTendencyAnswer` for PIH signal; `skin_profiles.pih_tendency` does NOT exist) and canonical `skin_profiles` (goals, midday feel, tightness, plus server-available `pregnancy_status` and `sensitivities_status`), confirmed shelf products, adverse reaction history, and photo metadata. (Note: current TypeScript `RoutineProposalInput.profile` does not contain `pregnancyStatus`/`sensitivitiesStatus`; adding them to the shared contract requires future mutual founder review).
    - Server-side Gemini 2.5 Flash invocation using server secrets (zero client keys) with structured JSON output enforcing canonical schema (with step-level `whyChosen`, not a root `rationales` field).
    - Deterministic clinical & safety guardrails: Sunscreen AM invariant (sunscreens never in PM), Retinoid PM invariant (adapalene/tretinoin never in AM), and strict exclusion of contra-indicated actives during pregnancy/nursing.
    - Required schema reconciliations (`B2_REQUIRED_SCHEMA_RECONCILIATION`):
      1. Add `updated_at` to `public.routines` via additive migration (satisfying canonical `Routine.updatedAt`).
      2. Add `product_id UUID REFERENCES public.products(id)` to `public.routine_items` via additive migration (satisfying canonical `RoutineStep.productId`).
      3. Derive `RoutineStep.scheduleText` deterministically from `timing` + `days` rather than adding a redundant column.
    - Relational routine persistence: Insert generated routine into `public.routines` (`version = 1`, `status = 'awaiting_review'`) and routine steps into `public.routine_items` using actual PostgreSQL columns (`order_index`, `timing`, `product_id`, `product_name`, `brand`, `category`, `amount`, `area`, `days`, `purpose`, `why_chosen`, `watch_for`).
    - Shelf action normalization & persistence invariant (`B2_REQUIRED_PERSISTENCE_INVARIANT`): Map shelf products into `public.user_products` with canonical actions (`KEEP`, `PAUSE`, `REPLACE`, `ADD`, `STOP`). Every B2-decided product is normalized into `public.products` with `user_products.product_id` referencing that row, enabling `user_products JOIN products` $\to$ canonical `UserProduct`.
    - Founder review queue transition: Keep or update the pending `initial_routine` task in `public.founder_review_tasks` (supported DB statuses: `'pending'`, `'completed'`, `'dismissed'`; no `'awaiting_review'` status exists in DB today). If explicit routine linking via foreign key is needed, Sami will propose an additive migration.
    - Remote routine read assembly: Implement full routine-item read assembly in `RemoteDeriveService.getRoutine()` (currently reads only the `routines` table header) to return a fully populated canonical `Routine` (`amSteps`, `pmSteps`).
  - **Client-Side Consumption (Kanuj)**:
    - Mobile hydration: `hydrateRoutine()` in `src/services/deriveClient.ts` is the downstream consumer once Remote assembly is implemented, detecting `routine.status === 'awaiting_review'` (`isPlanUnderReview = true`). Note: `InitialRoutineState` is a shared domain type in `OnboardingResult`, not a persisted database column.
    - Quiet draft preview: Renders `DRAFT · NOT ACTIVE` indicator on Today and Plan tabs while preserving non-blocking navigation across all 5 tabs.
    - Truthful customer messaging: Displays "Final review: Your first routine gets one final quality check before it goes live."
    - Zero client-side Gemini execution; fails closed on missing or unauthenticated sessions.
* **Acceptance Criteria**:
  - Server pipeline generates valid routine proposal from committed intake data without inventing non-existent fields.
  - AM/PM invariants and pregnancy/sensitivity contraindications strictly upheld.
  - B2 additive migrations resolve `routines.updated_at` and `routine_items.product_id` schema gaps.
  - Generated routine persisted to `public.routines` (`status = 'awaiting_review'`) and `public.routine_items` (matching reconciled DB schema).
  - Shelf products normalized into `public.user_products` with valid actions and canonical product references.
  - `RemoteDeriveService.getRoutine()` assembles `routine_items` into `amSteps` and `pmSteps`.
  - Mobile client cleanly hydrates routine in `awaiting_review` state and displays quiet draft preview.
  - 100% tests passing, 0 TypeScript errors, clean Expo web export, `EXPO_PUBLIC_USE_REMOTE_SERVICE: "false"` preserved.

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
