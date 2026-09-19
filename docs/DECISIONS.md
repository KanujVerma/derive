# Derive Architecture Decision Records (ADRs)

Key technical and product decisions accepted for Derive V1.

---

### ADR-01: React Native + Expo Router over Native Swift
* **Decision**: Build V1 on React Native with Expo Router.
* **Rationale**: Enables unified iOS, web, and future Android support with rapid iteration velocity, while retaining native iOS performance, haptics, and camera capabilities.

### ADR-02: Five Primary Native Tabs with Center Scan
* **Decision**: Adopt a 5-tab architecture: `Today` | `Plan` | `Scan` | `Ask` | `Progress`.
* **Rationale**: Elevates product scanning to a first-class native destination at position 3, providing immediate in-store utility without requiring users to navigate into chat.

### ADR-03: Scan Separated from Ask
* **Decision**: Provide a dedicated Scan tab while allowing 1-tap handoff into Ask.
* **Rationale**: Fast evaluation requires a zero-friction viewfinder and structured categorical verdict. Deeper questions can flow into Ask without cluttering the scanner.

### ADR-04: Direction A (Mineral) Design Language
* **Decision**: Style V1 using Warm Ivory (`#F6F3EC`), Elevated Surface (`#FFFEFB`), Architectural Charcoal (`#171A18`), and Mineral Green (`#345447`).
* **Rationale**: Delivers an understated luxury aesthetic that feels calm and restorative, distinctly separated from neon habit trackers or cold clinical portals.

### ADR-05: Supabase as Core Platform
* **Decision**: Use Supabase (Postgres, RLS, Auth, Edge Functions, Private Storage).
* **Rationale**: Delivers reproducible relational schema migrations, rock-solid row-level security for private health data, and fast serverless functions without heavy cloud infrastructure.

### ADR-06: Mock-First Service Contract Boundary
* **Decision**: Freeze `IDeriveService` shared contract; mobile consumes `MockDeriveService` while backend implements `RemoteDeriveService`.
* **Rationale**: Unblocks Kanuj (mobile) and Sami (backend) to work independently for days without blocking on each other.

### ADR-07: Kanuj & Sami Ownership Split
* **Decision**: Kanuj owns mobile UX, client AI experience, navigation, components, and design tokens. Sami owns Supabase, migrations, RLS, server AI workflows, operations console, and commerce.
* **Rationale**: Eliminates cross-lane merge conflicts and establishes crystal-clear accountability.

### ADR-08: Categorical Verdicts over Numerical Scores
* **Decision**: No arbitrary numerical ratings (e.g. "82/100" or "Clean/Dirty"). Use 6 clear categorical verdicts (`GREAT FIT`, `COULD WORK`, `NOT NEEDED`, `BETTER AS A REPLACEMENT`, `USE WITH CAUTION`, `NOT A GOOD FIT RIGHT NOW`).
* **Rationale**: A product is neither good nor bad in the abstract; fit is entirely contextual to this user's active routine and skin barrier.

### ADR-09: Research Intelligence as P1
* **Decision**: Surface curated clinical research directly in Today and Plan.
* **Rationale**: Builds member trust and demonstrates that Derive is grounded in published dermatological literature rather than influencer marketing.

### ADR-10: [HISTORICAL · SUPERSEDED] Manual Operations & $129/Month Canonical Pricing
* **Status**: HISTORICAL / SUPERSEDED (Superseded by ADR-21 for the first-10 Founding Beta operating experiment; flat $129/mo is no longer current commercial truth or pricing policy; legacy database defaults and code literal references remain implementation debt).
* **Decision**: Launch Founding Beta at $129/month for 10 initial members with manual founder review and manual fulfillment desk.
* **Rationale**: High-touch founder concierge ensures quality and fast customer learning before premature operational automation.

### ADR-11: Gemini Credentials Stay Server-Side
* **Decision**: The Expo/mobile client never embeds a Gemini API key and never calls Gemini directly. Live model invocation belongs in the trusted Supabase/server environment behind `RemoteDeriveService`.
* **Rationale**: A client-visible Gemini key would expose a paid API credential and send customer health context from the device. Kanuj continues on `MockDeriveService` with deterministic local reasoning; Sami owns server secrets and Edge Function orchestration.

### ADR-12: Semantic UI Primitives & Spatial Layout Grammar
* **Decision**: Refactor all customer screens onto centralized semantic UI primitives in `src/components/ui/` (`Screen`, `ScreenHeader`, `StatusBadge`, `StickyActionFooter`, `SelectionRow`, `SelectionCard`, `ChoiceChip`, `SegmentedControl`, `GroupedSection`, `TextField`, `VoiceTextArea`, `InfoBanner`, `EmptyState`) governed by explicit spatial grammar (`layout.gutter: 24`, `sectionGap: 32`, `itemGap: 16`, `minTouchTarget: 44`, `ctaHeight: 54`) and semantic state tokens (`actionReview: #8C6D3B`).
* **Rationale**: Replaces fragmented inline styles, eliminates layout drift, enforces Apple Human Interface Guidelines for 44pt minimum touch targets, and establishes an authoritative component library for future velocity without changing the core Mineral palette.

### ADR-13: AI-Led Longitudinal Care Loop & Non-Blocking First-Plan Review (Scalable Target Architecture)
* **Scope / Target**: Scalable Long-Term Care-Loop Target (Subject to ADR-21 temporary operational override for the 10-member Founding Beta).
* **Decision**: In the scalable long-term product, weekly check-ins and routine adaptations are 100% AI-led and automated based on logged skin tolerance and progress comparisons; there are zero recurring manual consultations. Only the first proposed routine generated at onboarding receives a manual quality check by the founders before activation (`awaiting_review`). This review state is strictly non-blocking: members retain full access to Today, Plan preview, Scan, Ask, and Profile, accompanied by a quiet, reassuring `InfoBanner` indicating verification is underway.
* **Rationale**: Scales the service efficiently without founder burnout while providing a human safety net during initial customer intake. Eliminates frustrating modal lockouts that prevent new members from using their app.

### ADR-14: Canonical Single Scanner Architecture & Split Verdict Model
* **Decision**: Consolidate camera scanning into a single, uncluttered camera-first viewfinder on the `Scan` tab. Remove manual mode selector buttons (Front / Barcode / Ingredients) in favor of automatic multi-attribute recognition with fallback text search. Route all scanner prompts from Ask to `/scan`. Structure product evaluations into two distinct sections: (1) `FIT FOR YOU RIGHT NOW` (categorical verdict, active routine impact, personalized rationale) and (2) `FORMULA QUALITY` (objective category, key actives, formulation standard).
* **Rationale**: Eliminates user confusion over scanner modes, deletes redundant camera code in the Ask tab, and cleanly decouples an ingredient's objective cosmetic quality from whether it is safe and beneficial for this user's current skin barrier and prescription schedule.

### ADR-15: [PROVISIONAL · PENDING COFOUNDER REVIEW] Personalized All-In Monthly Pricing Architecture & Price Stability Contract
* **Status**: PROVISIONAL / PENDING COFOUNDER BUSINESS REVIEW (Prototyped in client/mock layer by Kanuj; not yet reviewed or accepted by Sami; Arthur's $96/mo is an illustrative deterministic demo fixture, not a commercial pricing commitment; final economics, ranges, and commercial structure pending founder alignment).
* **Proposal**: Explore transitioning away from universal flat-rate $129/month assumptions toward a personalized, all-in monthly plan pricing model computed from the member's active routine:
  `monthlyPlanPriceCents = PROVISIONAL_DEMO_MANAGEMENT_FEE_CENTS ($39/mo) + normalizedProductConsumptionCents + PROVISIONAL_DEMO_OPERATIONS_RISK_CENTS ($5/mo)`.
  Product consumption is normalized to a 30-day rate via `Math.round(retailPriceCents * 30 / estimatedLifespanDays)`.
  Any routine adjustment that would increase the monthly plan price requires explicit member approval (`requiresMemberApproval: true`).
  In V1, routine complexity and product cost preference remain separate onboarding choices; pricing is derived from the resulting routine, not preset subscription tiers.
* **Economic Distinctions**:
  - **Steady-State Monthly Product Consumption**: Expected normalized cost of products over time.
  - **Current Inventory / Shipment Timing**: Existing counter bottles affect when Derive ships the next refill, not the long-run steady-state consumption.
  - **Initial Fulfillment Cost**: Cash Derive must spend near activation to fill missing/replacement products.
* **Open Decisions (Unresolved in V1 Prototype)**:
  - Prepaid product liability.
  - Cancellation before future refill.
  - First-basket financing.
  - Refund policy.
  - Internal reserve/ledger treatment.
  - Supplier payment terms.
* **Customer Presentation**: Customer sees ONE all-in price ("Estimated plan $96/month" pending first routine approval, "Current plan $96/month" after activation). Internal fee itemization ($39 management fee, $5 risk buffer) is strictly internal economics and never exposed to the customer.

### ADR-16: Tab Bar Implementation via Expo Router Standard Tabs with Custom Glass Container
* **Decision**: Implement the 5 root tabs using Expo Router standard Tabs (`@react-navigation/bottom-tabs`) styled with a floating `GlassContainer` (`tabBarBackground`) with customized haptics, hit targets, and icons, rather than experimental NativeTabs or third-party native bottom sheet tabs.
* **Rationale**: Preserves flawless cross-platform stability, avoids unverified native binary dependencies, and allows floating pill styling with directional glass effects.


### ADR-17: [PROVISIONAL · CLIENT PROTOTYPE] Phenotype-Aware, Never Race-Aware Skin Modeling
* **Status**: PROVISIONAL CLIENT ARCHITECTURE IMPLEMENTED, backend adoption pending (Implemented in `src/phenotype/` by Kanuj; backend schema unchanged; pending Sami platform review).
* **Decision**: Ground skin modeling exclusively in observable cutaneous attributes and response mechanics (`PigmentationFamily`, `Undertone`, `SunResponse` (behavior-only: burns_easily, burns_then_tans, etc.), `PihTendency`, `WhiteCastConcern`, `RazorBumpHistory`, `HairCurlPattern`).
* **Hard Prohibitions**: Zero race classifiers, zero ethnicity classifiers, zero ancestry inference, zero demographic recommendation rules (e.g. "Black -> product X"), and zero Fitzpatrick-as-race mappings.
* **Confirmation Invariant**: Every phenotype attribute carries explicit provenance (`ProvenancedValue<T>`) with categorical confidence (`low` | `medium` | `high`). Explicit member confirmation strictly outranks unconfirmed photo estimates (`setOrConfirmPhenotypeValue`). Stale estimates cannot overwrite confirmed truth.
* **V1 Onboarding Invariant**: Normal V1 onboarding funnels only collect one single new adaptive phenotype signal: *"Do breakouts or irritation usually leave dark marks that stick around?"* (shown only when `breakouts` or `dark_spots` goals are selected). Shade depth, undertone, sunscreen white cast, and shaving habits are collected contextually (e.g. during tinted sunscreen evaluation or shaving questions) rather than lengthening onboarding.

### ADR-18: Research Evidence Grading & Member Applicability Policy
* **Decision**: Decouple scientific evidence quality from individual member applicability.
* **Evidence Hierarchy**:
  - **Grade A / B**: High-quality RCTs, systematic reviews, or robust cohort studies. Eligible to influence routine decisions ONLY IF `directRoutineInfluenceAllowed` is true and all member applicability criteria and required product context (`EvidenceApplicabilityContext`) match (failing closed if context is missing).
  - **Direct Influence Hard-Block**: If `directRoutineInfluenceAllowed` is false, routine changes are blocked regardless of methodological grade.
  - **Grade C**: Small trials, observational studies (e.g. dairy-acne meta-analyses), or mechanistic research. Can inform educational context in Ask or research cards, but CANNOT silently modify active routines or force product swaps.
  - **Grade D**: Preliminary in-vitro data or anecdotal reports. Excluded from driving any routine or product behavior.
* **Non-Causal Rule**: Observational population correlations must never be converted into automated individual interventions or prescriptive dietary rules.

### ADR-19: Categorical Tint Compatibility & Mineral White-Cast Assessment
* **Decision**: Evaluate tinted formulations (e.g. tinted mineral sunscreens) using categorical matching (`likely_match`, `possible_match`, `needs_confirmation`, `unlikely_match`) rather than fake numeric percentages.
* **Confirmation Requirement**: If a member's pigmentation depth is unconfirmed or estimated, tint evaluation returns `needs_confirmation` before claiming compatibility.
* **Iron Oxide Photoprotection**: Detect and highlight iron-oxide benefits (HEV / visible light blocking) ONLY when a member has confirmed post-inflammatory hyperpigmentation tendency (sometimes or often); never infer treatment benefits from pigmentation depth alone.
* **White Cast Assessment**: Assesses white-cast friction using verified catalog or member observation matched against member cast concern; strictly avoids speculative formula-only prediction algorithms.

### ADR-20: S1A Least-Privilege Supabase Data Plane
* **Status**: IMPLEMENTED (database policy/config/test layer); full S1 remains in progress.
* **Decision**: Harden the existing baseline through an additive migration rather than rewriting potentially applied history. Provision Auth profiles through locked-down, Derive-namespaced triggers; revoke implicit `anon`/`authenticated` grants; establish fail-closed defaults for future public objects; grant customers only explicit owner-scoped operations; keep founder/payment/server-generated fields inaccessible; and store photos in one canonical private bucket under member-ID path prefixes.
* **Signed-URL Boundary**: Customers have no direct photo download/list/sign capability. A trusted server endpoint will issue 900-second signed URLs after JWT and path ownership validation.
* **Deletion Boundary**: Customers have immutable insert rights but no direct object or photo-metadata deletion rights. A trusted Storage-API-first workflow must delete physical objects before relational metadata/auth state so a partial client request cannot orphan private health data.
* **Rationale**: RLS policies and SQL grants are complementary controls. Exact policy-set tests detect permissive drift; explicit remote projections avoid protected-field wildcard failures; and separating immutable upload rights from trusted signing/deletion minimizes accidental exposure and orphaned objects.

### ADR-21: Founding Beta Concierge Operating Model & $100/Month First-10 Pricing Experiment (Temporary Beta Override)
* **Status**: APPROVED BETA EXPERIMENT (Temporary Operational Override to ADR-13 & Provisional Alternative to ADR-15).
* **Decision**: Adopt a high-touch concierge MVP operating model for the initial 10 paying Founding Beta members at a flat $100/month experimental price point.
* **Operational Override**: While ADR-13 defines the long-term AI-led scalable architecture, the Founding Beta temporarily overrides this with manual founder involvement where useful for learning: Kanuj will manually perform or review intake submissions, baseline photos, initial routine construction, product sourcing/fulfillment, early recommendations, and check-in logs. Biweekly-ish customer research conversations are conducted for feedback and discovery, explicitly as a beta research tool and not as a permanent personal consultation promise.
* **Pricing Experiment**: $100/month covers Derive care management plus the standard non-prescription facial skincare products needed for the approved routine. No product wallet, credit balance, or rollover allowance. Existing working products are retained (`KEEP`); shipments follow actual consumption need rather than calendar billing theater. Prescription medications are contextual inputs only, not products Derive prescribes or supplies. Thin or negative initial unit economics are intentionally tolerated for this 10-member learning cohort. Long-term personalized pricing (ADR-15) remains provisional.
* **Required Baseline Photos**: Standardized Front/Left/Right baseline photos are required for paid Founding Beta members to establish longitudinal comparison context. Capture uses on-device quality gating (pose, distance, centering, lighting, sharpness, stability) with hands-free auto-capture and manual fallback. Photos do NOT diagnose disease or produce fake quantitative barrier metrics.
* **Routine Approval & Refill Consent**: Material routine changes (adding/replacing products, permanent removals, strong active changes, price increases, new product shipments) require explicit member approval. Refills use low-friction confirmation ("Running low on [product]? Refill"), avoiding silent shipments based on elapsed calendar days.
* **Rationale**: Directly addresses the 6 core beta learning hypotheses (Value, Behavior, Trust, Longitudinal, Fulfillment, Retention) with 10 real paying members without prematurely hardening operational automation or finalizing long-term company pricing.

### ADR-22: Client Domain Operations Traverse IDeriveService Boundary
* **Status**: APPROVED & IMPLEMENTED (Milestones K6, K6.1, & K6.2).
* **Decision**: All mobile screens and UI components route domain operations (onboarding submission, Ask intelligence queries, product scanning evaluation, weekly check-in logging, refill replenishment requests, order tracking, and routine/progress hydrations) strictly through `src/services/deriveClient.ts` backed by `IDeriveService` (`getDeriveService()`). Client routes and components in `app/**` are strictly prohibited from importing server-side intelligence workflows (`src/services/ai-workflows/**`). Local catalog fixtures and barcode lookups are partitioned into `src/services/catalog.ts`.
* **K6.1 Hardening & Fail-Closed State**:
  - **Fail-Closed Remote Identity**: When `isRemoteServiceEnabled()` is true, operations requiring user identity fail closed and throw an explicit error if the user ID is absent or matches mock identities (`usr_beta_member`, `usr_beta_001`). In Mock mode, deterministic fallback to `usr_beta_member` is retained for local development.
  - **Fail-Closed Shelf Recognition**: In the default/production path, `recognizeShelfProducts()` returns an empty list (`[]`) rather than injecting fabricated mock products. Explicit demo fixture is isolated to `getDemoShelfRecognitionFixture()`.
  - **Canonical Null Cache Projection**: When `service.getRoutine(id)` returns `null`, `hydrateRoutine()` explicitly projects `routine: null, isPlanUnderReview: false`, preventing stale cache retention.
  - **Scan-to-Ask Alignment**: Screen handoff from Scan to Ask passes canonical parameters (`productName`, `brand`, `verdict`, `reason`), with backward compatibility for legacy params, without fabricating `ProductScanResult` records from partial route query strings.
  - **Mutation Error Recovery**: Scanning lockouts, Ask failures, check-in submissions, and refill requests handle errors gracefully with clear user feedback and preserve draft inputs/state for retry.
* **K6.2 Integration Semantics & Error Hardening**:
  - **Full Typed Scan Context Handoff**: `useScanContextStore` (`src/stores/scanContextStore.ts`) holds the exact `ProductScanResult` from the scanner. Ask synchronously passes this context on the initial automated query and all subsequent queries in that conversation, eliminating React closure race conditions. Banner dismissal or "New chat" clears the active scan context.
  - **Fail-Closed Non-Mock Presence Guard**: `resolveUserId()` trims inputs and rejects missing, empty, or whitespace-only IDs (`'   '`) in Remote mode, throwing a precise client guard error (`Valid member identity required: Remote operations require a non-mock customer identity.`) distinct from server-side JWT authentication.
  - **Customer-Safe Error Sanitization**: Reusable error mapper `src/utils/customerErrors.ts` shields internal technical errors (`PostgREST`, `Supabase`, `RemoteDeriveService`, stack traces) from customer UI, returning deterministic, empathetic Direction A Mineral copy while preserving technical error details in `console.warn` and keeping form state intact.
* **K6.3 Test Integrity, CI Typechecking & Contract Truth**:
  - **Closed False-Green CI Hole**: Root `tsconfig.json` excluded `"tests"` while `npm test` ran Node `--experimental-strip-types`, allowing broken types in `tests/derive.test.ts` to pass CI undetected. Added `tsconfig.tests.json`, `npm run typecheck:tests`, CI step in `.github/workflows/ci.yml`, and added to `AGENTS.md` completion rules.
  - **Canonical Contract Realignment**: Audited test fixtures to eliminate hallucinated fields (`barcode`, `confidence`, `ingredientsIdentified`, `safetyFlags`, `fitScore`) and illegal verdicts (`verdict: 'keep'`). Enforced canonical `ProductScanResult` properties (`category`, `keyActives`, `factsUsedToDecide`) and legal verdicts (`fits_plan`, `great_fit`). Production contracts are authoritative.
  - **Separation of UI Display Fallback from Service Context**: Created pure utility `src/utils/scanContext.ts` with `resolveAskDisplayBanner` and `resolveAskServiceContext`. Route query strings are strictly used for display banner fallback (e.g. deep links) and are never synthesized into artificial `ProductScanResult` domain records. Only the full typed `ProductScanResult` from `useScanContextStore` is passed to `IDeriveService.askDerive()`.
* **Rationale**: Eliminates direct coupling between client screens and mock or AI workflow internals, guarantees that swapping between `MockDeriveService` and `RemoteDeriveService` requires zero mobile screen refactoring, prevents any accidental client-side LLM execution, guarantees clean initial customer state by default without fixture contamination, preserves full scan metadata across views without synthetic fabrication, guarantees test suite type correctness in CI against canonical contracts, and ensures a resilient customer experience where errors are safe and non-destructive.
* **Verification**: Enforced by 65 unit and regression tests in `tests/derive.test.ts`, application typecheck (`npx tsc --noEmit`), test semantic typecheck (`npm run typecheck:tests`), and clean web export verifying zero `ai-workflows` imports in `app/`, clean default state of `MockDeriveService`, complete swappability of `IDeriveService`, fail-closed remote identity validation, full scan context delivery, customer error sanitization, and user intent preservation.

### ADR-25: Authenticated Remote Onboarding Intake Commit, Atomic Finalization & Replay Idempotency (I1-B1 & I1-B1.1)
* **Decision**: Implement the authenticated Remote write path via two serverless Edge Functions (`prepare-onboarding` and `onboard-customer`), internal staging ledger `public.onboarding_submissions`, direct immutable client photo uploads to `customer-skin-photos` (`upsert: false`), an atomic PostgreSQL finalization function (`public.commit_onboarding_intake`), and an evolved `OnboardingResult` contract that permits `proposedRoutine: null` and `initialRoutineState: 'pending_generation'` without routine generation in B1.
* **Key Mechanisms**:
  1. **Platform Gateway JWT Gate + Handler Verification**:
     - `supabase/config.toml` enforces platform gateway JWT validation (`verify_jwt = true`).
     - Handlers independently verify caller JWT via `auth.getUser()`, derive immutable user UUIDs, and reject cross-user spoofing.
  2. **Atomic Transactional Finalization RPC (`public.commit_onboarding_intake`)**:
     - `SECURITY INVOKER` function granted exclusively to `service_role` (`PUBLIC`, `anon`, `authenticated` revoked).
     - Inside a single database transaction: locks submission row (`FOR UPDATE`), handles already-committed submissions idempotently, upserts `skin_profiles` with `onboarding_completed: false`, records `user_photos` idempotently (`ON CONFLICT (storage_path) DO NOTHING`), ensures exactly one pending `initial_routine` founder review task, sets `skin_profiles.onboarding_completed = true` strictly last, marks the submission `committed`, and returns the canonical profile.
     - Any relational error rolls back the entire transaction, ensuring no half-committed or corrupted states.
  3. **Replay & Response-Loss Idempotency**:
     - Retrying a committed submission re-verifies canonical state and returns identical results without repeating relational writes or generating duplicate founder review tasks.
     - `public.onboarding_submissions` enforces a partial unique index on `(user_id) WHERE status = 'committed'`.
     - `public.user_photos` enforces a unique index on `storage_path`.
  4. **Prepare-After-Commit Resumption & Concurrency Protection**:
     - `prepare-onboarding` checks for existing committed intake first, returning its metadata without creating duplicate drafts.
     - Concurrent draft insert races (`23505`) re-query the winning draft, preventing customer-visible 500 errors.
  5. **Canonical Post-Submit Bootstrap Coordinator**:
     - `10-summary.tsx` invokes `resolveCustomerBootstrap(activeUserId)`, requiring `status === 'READY'` before app transition.
  6. **Truthful Status Semantics**:
     - `pending_generation` sets `isPlanUnderReview: false` and "Your routine is being prepared."
     - `awaiting_review` sets `isPlanUnderReview: true` and "Final review" copy.
* **Rationale**: Guarantees zero unverified writes or corrupted state, preserves complete intake provenance, survives partial failures, lost responses, and concurrent retries, protects private customer skin photos with least privilege, and cleanly separates intake persistence (B1) from routine generation (B2).
* **Verification**: Verified with 96 pgTAP assertions on local Supabase Postgres, 100 unit tests in `tests/derive.test.ts`, committed full-stack local E2E test harness (`scripts/test-i1-b1-local.mjs`), clean Expo web export, zero TypeScript errors, and automated GitHub CI with Supabase database testing.

---

## Open Shared-Contract Challenges (PROPOSED · UNRESOLVED)

These findings are review evidence, not accepted contract changes. S1A does not modify Kanuj-owned UI or shared TypeScript contracts.

### ARCHITECTURE_CHALLENGE-01: Price Is Embedded in Membership Identity
1. **Existing Decision**: ADR-10 and current schema/type literals encode `$129` as `founding_beta_129`, while ADR-15 proposes routine-derived pricing and remains pending cofounder review.
2. **Exact Evidence**: `supabase/migrations/20260915_init.sql` defaults `memberships.tier` to `founding_beta_129`; `src/domain/types.ts` narrows `CustomerProfile.tier` to that literal; README and client configuration still state `$129`.
3. **Why It Matters**: Membership identity, commercial price, and future Stripe state are coupled. The database accepts arbitrary text while the shared type claims one literal, so remote casts are unsound.
4. **Recommended Change**: After founders decide fixed versus routine-derived pricing, use a neutral cohort/plan identity and separately version agreed monetary state and effective timing. Preserve legacy data during migration.
5. **Alternatives**: Keep `$129` as an explicitly approved legacy Founding Beta contract; adopt another fixed price with a neutral plan code; or adopt the proposed routine-linked pricing ledger at S5.
6. **Affected Workstreams**: Shared domain contract, database membership model, client presentation, operations, and S5 commerce.
7. **Unblocked Work**: S1 security hardening can continue without persisting new pricing semantics.

### ARCHITECTURE_CHALLENGE-02: Safety Unknown States Are Collapsed [RESOLVED IN I1-B0]
1. **Status**: RESOLVED & IMPLEMENTED (I1-B0).
2. **Prior State**: The baseline database stored only a default-false pregnancy boolean and default-empty sensitivity array. Missing or withheld disclosures were collapsed into false negatives (`no` / `none_known`), destroying safety provenance.
3. **Resolution Implemented (I1-B0)**:
   - **Additive Migration (`20260918203554_onboarding_safety_status_and_action_pause.sql`)**: Added `pregnancy_status` (CHECK `in ('yes', 'no', 'prefer_not_to_say', 'unanswered')`) and `sensitivities_status` (CHECK `in ('none_known', 'reported', 'unanswered')`) with default `'unanswered'` and `NOT NULL`. Conservative epistemic backfill: `is_pregnant_or_nursing IS TRUE` -> `'yes'`, else `'unanswered'`; non-empty `known_sensitivities` -> `'reported'`, else `'unanswered'`. Column grants for insert/update granted to `authenticated`.
   - **Shared Schema & Contracts**: Added `PregnancyStatusSchema`, `SensitivitiesStatusSchema`, and updated `SkinProfile` and `OnboardingPayload.safetyContext` in `src/types/schema.ts` and `src/domain/types.ts`.
   - **Client State & UI Truth**: Updated `useOnboardingStore`, `8-safety.tsx` (initialized strictly to `none_known` / explicit choice, never coercing `unanswered`), `10-summary.tsx` (truthful display copy `'Not answered'` for unanswered states), and pure payload builder `buildOnboardingPayload` in `src/services/deriveClient.ts`.
4. **Affected Workstreams**: Shared onboarding/profile contracts, database persistence, routine intelligence, and client-to-remote mapping.

### ARCHITECTURE_CHALLENGE-03: `STOP` vs `PAUSE` Persistence Drift [RESOLVED IN I1-B0]
1. **Status**: RESOLVED & IMPLEMENTED (I1-B0).
2. **Prior State**: `user_products.action` in the baseline database accepted `STOP` but rejected `PAUSE`, while the routine generator emitted both and tests required `PAUSE` for temporary holds.
3. **Resolution Implemented (I1-B0)**:
   - **Additive Migration (`20260918203554_onboarding_safety_status_and_action_pause.sql`)**: Replaced `user_products_action_check` constraint with canonical superset: `CHECK (action in ('KEEP', 'PAUSE', 'REPLACE', 'ADD', 'STOP'))`.
   - **Verified via pgTAP**: Tests verify acceptance of `PAUSE`, `KEEP`, `REPLACE`, `ADD`, `STOP`, and rejection of invalid actions.
4. **Affected Workstreams**: Shared schema/domain types, routine generator, database constraint, Plan UI, and remote persistence.

### ARCHITECTURE_CHALLENGE-04: Real-Time Face-Quality Auto-Capture Requires Native Dependency & Build Architecture [ARCHITECTURE SELECTED & WIRED / PHYSICAL DEVICE VALIDATION IN K5]
1. **Existing Decision**: ADR-21 requires hands-free camera auto-capture gated on continuous real-time capture quality (face presence, pose/orientation, distance/face size, centering, lighting, sharpness, stability) with manual fallback.
2. **Exact Evidence**: Installed `expo-camera` (`~57.0.5`) provides `CameraView` with picture capture and barcode scanning, but does NOT provide continuous frame analysis, computer vision face landmarking, head pose estimation (yaw/pitch/roll), or image sharpness metrics. Legacy `expo-face-detector` was removed from modern Expo SDKs.
3. **Resolution Implemented (K4.4 Finalization)**: Resolved via **Alternative A (Custom Native Expo Module)** with architectural decoupling:
   - **Pure TypeScript State Machine (`src/components/camera/AutoCaptureStateMachine.ts`)**: Evaluates frame metrics (face bounding box, yaw [-15..15 for front, -20..-65 for left, 20..65 for right], roll, pitch, distance/size [0.28..0.72], centering, and Apple Vision `faceCaptureQuality`). Enforces a continuous 750ms stability hold before triggering `AUTO_CAPTURE`. 100% unit-tested and deterministic.
   - **Native iOS Module (`modules/derive-face-capture/`)**: Local Swift Expo module using AVFoundation and Apple's native `Vision.framework` (`VNDetectFaceRectanglesRequest`, `VNDetectFaceCaptureQualityRequest`). Throttled to ~8 Hz (120ms intervals) to avoid thermal throttling. Zero third-party SDK bloat (no MLKit); zero persistent face embeddings; all metrics processed in memory on-device. Podspec and module autolinking verified (`npx expo-modules-autolinking resolve -p ios`), Swift syntax checked via `swiftc -parse`.
   - **Full Wiring & Fallback**: `DeriveFaceCaptureView` is ref-forwarded with imperative `takePhoto()`, exported with `isDeriveFaceCaptureSupported()`, and fully wired into `CameraCapture.tsx` and `app/(onboarding)/7-skin-photos.tsx`. Web and simulator platforms fall back cleanly (`DeriveFaceCaptureView.web.tsx`) to `expo-camera` with manual shutter and oval guidance reticle. Single camera view mounted at any time.
4. **Status**: Architecture selected, Swift native module autolinked and compiled, ref-forwarded and fully wired into `CameraCapture.tsx` and onboarding photo flow (`app/(onboarding)/7-skin-photos.tsx`). Physical hardware sensor and lighting calibration explicitly scheduled for K5 on TestFlight.

### ARCHITECTURE_CHALLENGE-05: Model & AI Provider Selection Is Deferred [OPEN / DEFERRED]
1. **Status**: OPEN / DEFERRED (Provider-Neutral Boundary Implemented in I1-B2.2).
2. **Context & Evidence**: The founding team and architectural orchestrator have deliberately deferred selecting a permanent commercial AI provider (e.g., Google Gemini, OpenAI, Anthropic Claude, or an open-weights deployment). Choosing a production AI model requires empirical clinical evaluation, cost/latency benchmarking, and business agreements that are premature during early infrastructure rollout.
3. **Architectural Guardrails Implemented (I1-B2.2)**:
   - **Provider-Neutral Interface (`RoutineIntelligenceProvider`)**: All intelligence orchestration consumes a single provider interface: `{ readonly providerId: string; generateProposal(context: AssembledRoutineContext): Promise<RoutineIntelligenceProposal>; }`. Adding or swapping a provider requires only implementing this interface, not refactoring routine persistence, context assembly, or validation.
   - **Zero Client Influence**: Customer requests (via headers, query parameters, or payload fields) can NEVER select a provider or activate fixtures. Provider selection is strictly server-side runtime configuration (`ROUTINE_MODEL_PROVIDER` environment variable or `public.server_runtime_config` database table accessible only to `service_role`).
   - **Fail-Closed Default**: If no provider is configured, the server fails closed with HTTP 503 `MODEL_UNAVAILABLE`. It never silently falls back to hardcoded models or fabricated outputs.
   - **Deterministic Test Isolation**: Automated CI and local E2E use an isolated `FixtureRoutineProvider` under server configuration to ensure reproducible, zero-cost, network-independent verification.
   - **Optional Gemini Adapter**: `GeminiRoutineProvider` serves as an evaluation adapter, strictly requiring header-based authentication (`x-goog-api-key`, zero API key leakage in URL query parameters) and structured JSON outputs conforming to canonical domain types.
4. **Resolution Required**: When founders conduct model evaluation, select a permanent production model provider, configure server secrets, and deploy the corresponding adapter.



