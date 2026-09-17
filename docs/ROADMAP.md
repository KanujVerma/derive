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

### K5: Mobile Release & TestFlight [IN PROGRESS — EXPO LINKED / BLOCKED ON APPLE SIGNING + IPHONE DEVELOPER MODE]
* **Scope**: EAS configuration, development client builds, production provisioning profiles, TestFlight deployment, physical device validation, and first-customer test script.
* **Landed**:
  - `expo-dev-client`, `eas.json` (development + production profiles, remote `appVersionSource`, Mock/local `EXPO_PUBLIC_USE_REMOTE_SERVICE=false`), first-customer script.
  - Local CocoaPods autolinking of `DeriveFaceCapture` + `expo-dev-client`; local simulator native binary exists.
  - Expo project linked: `@derive-skincare/derive` (`4100d696-3e03-4b2c-bdb3-1986d5f1a624`).
  - Export compliance declared as HTTPS-only via `ios.config.usesNonExemptEncryption: false`.
* **Remaining**:
  - Interactive Apple login to create EAS internal-distribution credentials, then EAS development cloud build.
  - Enable Developer Mode on the connected iPhone, then install and physically validate face auto-capture and barcode scan.
  - Production/store build and internal TestFlight processing + founder install.
* **Acceptance Criteria**:
  - Installable iOS internal TestFlight build distributed to founders.
  - Onboarding, scanning, and chat verified on physical hardware.
  - First-customer test script executed.

---

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
