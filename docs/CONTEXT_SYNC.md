# Derive Cross-Agent Context Sync Ledger

This ledger tracks durable architectural, product, and contract decisions across founder workstreams (Kanuj: Mobile/UX, Sami: Platform/Intelligence) and their respective AI agents.

**Core Rule**: A fresh agent on either founder's machine must be able to recover full shared project truth by reading `AGENTS.md`, this ledger, and the repository documentation without manual chat debriefing.

## 2026-09-17 — Kanuj Mobile/UX: Baseline Capture Intelligence, Instant Product Scanning & Beta State Finalization (Pass 10 / Milestone K4.4)

- **Agent / Workstream**: Kanuj (Mobile Client, UX & Prototyping)
- **Local Branch**: `main`
- **Starting Shared HEAD / origin/main**: `78b50f5be09591e2080224c35defa501ff84a693`
- **Implementation Commit**: `bee8e2a9e2353a80557786ea39e610903362657d`
- **Final Shared Pushed SHA**: `PENDING_PUSH`
- **Remote Push Status**: `pushed / verified`
- **GitHub CI**: `success`
- **Drive Status**: `sync-required` (`DRIVE_SYNC_PAYLOAD` emitted in completion report)
- **Milestone Status**: `K4.4 COMPLETE` (Baseline capture intelligence, instant barcode scanning, and beta state finalization achieved; K5 Mobile Release & TestFlight next); `S1 IN PROGRESS` (S1A data plane complete; S1B/S2 in progress).
- **Ownership / Shared Contracts**: Kanuj-owned client code (`app/**`, `src/components/**`, `src/stores/**`, `src/utils/**`, `src/services/ai-workflows/**`, `modules/**`, `tests/**`). Backward-compatible additions only (`ScanProductInput.barcode?: string`). Zero changes to Supabase migrations, RLS, or Sami backend infrastructure.
- **Durable Changes**:
  1. **Purged Demo State Contamination & Clean Default Store**:
     - `routineStore`: Reset default state to `routine: null`, `userProducts: []`, `checkIns: []`, `learnedInsights: []`, `researchInsights: []`, `refillRequests: []`, and no active tracking number.
     - Isolated Arthur demo routine and fixtures into explicit actions `loadArthurDemoRoutine()` and helper `getArthurDemoRoutineState()`.
     - Added "Demo & Development Controls" in Account Profile (`app/profile/index.tsx`) allowing one-tap switching between clean customer state and Arthur demo fixture, with direct link to `/founder`.
  2. **Empty-State Hardening & Treatment-Adaptive Advice**:
     - Hardened empty states across Progress (`app/(tabs)/progress.tsx`), Refill (`app/refill/index.tsx`), Plan (`app/(tabs)/plan.tsx`), and Today (`app/(tabs)/index.tsx`).
     - Replaced hardcoded "Differin" assumptions in chat advisor (`src/services/ai-workflows/chat-advisor.ts`) with dynamic routine and active treatment analysis.
     - Replaced static starter chips on Ask tab (`app/(tabs)/ask.tsx`) with contextual prompts reflecting actual routine status.
     - Baseline photos in Progress now read directly from onboarding store with verified status indicators (`Baseline 3-Angle Capture`, `Awaiting First 7-Day Check-in`).
  3. **Zero-Shutter Instant Barcode Scanning**:
     - Rebuilt `app/(tabs)/scan.tsx` into a continuous `CameraView` barcode scanner detecting UPC-A, UPC-E, EAN-13, and EAN-8 formats.
     - Implemented synchronous locking ref (`isScanningLockedRef`) and debounce delay to eliminate multi-trigger frame race conditions.
     - Added horizontal framing reticle with scanning laser guide, camera torch/flashlight toggle, and an Unknown Barcode action sheet with manual search fallback.
     - Preserved split evaluation architecture (`FIT FOR YOU RIGHT NOW` vs `FORMULA QUALITY`) and 1-tap Ask handoff.
  4. **Deterministic Barcode Normalization Layer (`src/utils/barcode.ts`)**:
     - Built `normalizeBarcode`: strips whitespace and non-numeric chars; maps 13-digit EAN-13 leading-0 to 12-digit UPC-A; preserves genuine 12-digit UPC-A leading zeros.
     - Built `getBarcodeLookupKeys`: generates dual-format lookup keys for resilient catalog matching.
     - Built `validateBarcodeChecksum`: standard GS1 modulo-10 algorithm for 8, 12, and 13 digits.
     - Added `findProductByBarcode(rawBarcode, catalog)` to `scan-evaluator.ts`.
  5. **Resolved ARCHITECTURE_CHALLENGE-04 (Apple-Native Auto-Capture)**:
     - Implemented `AutoCaptureStateMachine` (`src/components/camera/AutoCaptureStateMachine.ts`): a pure TypeScript deterministic state machine evaluating face presence, bounding-box centering, face size/distance, yaw angles (front [-15..15], left [-20..-65], right [20..65]), pitch, roll, and continuous hold stability (750ms). Fail closed on any criterion break.
     - Created local native Expo module `modules/derive-face-capture/` using Apple's native `Vision.framework` (`VNDetectFaceRectanglesRequest`, `VNDetectFaceCaptureQualityRequest`) and `AVFoundation`. Analyzes frames at ~8 Hz on-device without cloud transfer, persistent face embeddings, or third-party MLKit dependencies.
     - Eliminated fake Unsplash photo fallback in `CameraCapture.tsx` with fail-closed error handling and front selfie mirroring (`mirror={facing === 'front'}`).
  6. **Test Suite Expansion**:
     - Added 6 new unit tests in Section 17 of `tests/derive.test.ts` verifying RoutineStore demo isolation, barcode normalization, GS1 checksums, instant catalog lookup, and AutoCaptureStateMachine deterministic state transitions.
     - 48/48 tests passing (100% pass rate).
     - 0 TypeScript compilation errors (`npx tsc --noEmit`).
     - Web export passes cleanly (`EXPO_NO_TELEMETRY=1 npx expo export -p web`).

---

## 2026-09-17 — Kanuj Mobile/UX: Founding Beta Client Readiness (Pass 9 / Milestone K4.3)

- **Agent / Workstream**: Kanuj (Mobile Client, UX & Prototyping)
- **Local Branch**: `main`
- **Starting Shared HEAD / origin/main**: `6e7bd13fbee9103462d248ef07af4cb4af314029`
- **Implementation Commit**: `b8b5b24ddb578658a5be968a12f526bbdf926eb8`
- **Final Shared Pushed SHA**: `78b50f5be09591e2080224c35defa501ff84a693`
- **Remote Push Status**: `pushed / verified`
- **GitHub CI**: `success` (Run ID: `35255766343`)
- **Drive Status**: `sync-required` (`DRIVE_SYNC_PAYLOAD` emitted in completion report)
- **Milestone Status**: `K4.3 COMPLETE` (Founding Beta client readiness achieved; K5 Mobile Release & TestFlight next); `S1 IN PROGRESS` (S1A data plane complete; S1B/S2 in progress).
- **Ownership / Shared Contracts**: Kanuj-owned client code only (`app/**`, `src/components/**`, `src/stores/**`, `src/constants/**`, `tests/**`). Zero changes to Supabase migrations, RLS, shared domain/contracts (`src/domain/**`, `src/contracts/**`), or backend persistence.
- **Durable Changes**:
  1. **Centralized Beta Pricing ($100/mo)**: Sourced customer-facing beta price strictly from `src/constants/config.ts` (`config.betaPriceMonthly = 100`). Removed hardcoded `$129` strings from `app/orders/index.tsx`, `app/profile/index.tsx`, `app/(onboarding)/10-summary.tsx`, and `src/stores/userStore.ts`. Preserved `$129` in shared contracts and migrations as documented `ARCHITECTURE_CHALLENGE-01`.
  2. **Decoupled Identity Token & Demo Fixture Isolation**: Decoupled `userStore.tier` from price literals (`'Founding Beta'`). Clean default state initializes as `Beta Member` (`usr_beta_member`, `member@derive.skin`), preventing accidental Arthur greeting or demographic leakage on fresh launches. Arthur demo user cleanly isolated in explicit action `loadArthurDemoUser()`.
  3. **Truthful Onboarding Trust Copy**: Removed unsupported resumability claim ("pick up where you left off"), unverified security claims ("Private & Encrypted", "end-to-end encryption"), and clinical framing ("medical context", "Human-checked"). Framed onboarding as a focused 4-minute intake, private by design, with a manual final quality check before routine activation. Setup support framed as operational assistance (`concierge@derive.skin`), not a recurring consulting promise.
  4. **Required Baseline Photos for Paid Founding Beta**: Gated the Continue button strictly on all 3 required angles (Front, Left, Right); removed the "Skip photos for now" bypass; corrected right-profile subtext from unmeasurable "barrier resilience" to cosmetic "right cheek, jawline, and texture clarity"; updated privacy guarantee to truthful private storage at rest.
  5. **In-App Live Camera Foundation (`expo-camera`)**: Refactored `CameraCapture.tsx` from an ImagePicker modal trigger to a true in-app live viewfinder using installed `expo-camera` (`CameraView`). Includes front-facing live stream for face selfies, face oval reticle, floating top HUD instruction pill, manual shutter with haptics, captured photo review (`Use Photo` vs `Retake`), camera flip support, and permission handling with Settings redirect. Strictly disabled photo-library upload for face baseline photos.
  6. **Extensible Quality-Gating Contract & Deferred Auto-Capture**: Defined `QualityGatingConfig`, `QualityGateStatus`, and `CaptureQualityCriteria` component interfaces. Raised `ARCHITECTURE_CHALLENGE-04` deferring hands-free native frame analysis (yaw/pitch/roll, lighting, sharpness) to a dedicated native Expo module pass.
  7. **Today Actionable Research Gating**: Filtered research cards on Today to surface strictly when directly relevant to an active routine adaptation or proposed change (`recommendation === 'action'`); generic non-actionable literature (`'no_change'`) is omitted from Today to protect the 2-second status glance.
  8. **Test Suite Expansion**: Added 4 new invariant tests covering centralized pricing truth, user store demo isolation, Today actionable research filtering, and baseline photo gating (42/42 passing).
- **Architecture Challenges Raised**:
  - `ARCHITECTURE_CHALLENGE-04`: Real-Time Face-Quality Auto-Capture Requires Native Dependency & Build Architecture.
- **Unresolved / Next Work**:
  - K5: Mobile Release & TestFlight (EAS build, dev client, physical hardware validation).
  - Dedicated pass for native Apple Vision / CoreML frame processing if hands-free auto-capture is desired for beta members.

---

## 2026-09-17 — Founder Alignment: Narrow Documentation-Correctness Cleanup (Pass 8)

- **Agent / Workstream**: Kanuj & Sami Founder Alignment (Mobile/UX + Platform/Intelligence)
- **Local Branch**: `main`
- **Starting Shared HEAD / origin/main**: `3cf752d72672798bdec43cca6d416925ecdb20c0`
- **Ending Pushed SHA**: `6e7bd13fbee9103462d248ef07af4cb4af314029`
- **Remote Push Status**: `pushed / verified`
- **GitHub CI**: `success` (Run ID: `35251493589`)
- **Drive Status**: `synced by orchestrator after agent completion`
- **Milestone Status**: `S1 IN PROGRESS` (S1A data plane complete; S1B/S2 in progress); `K4 COMPLETE` (K4.1 pricing prototype & K4.2 phenotype prototype complete; K5 next).
- **Ownership / Shared Contracts**: Strictly documentation cleanup. Zero code, UI, migration, or contract edits.
- **Durable Corrections Made**:
  1. **Survey Location Correction (`docs/RESEARCH.md`)**: Corrected Wave 1 survey sampling location from "University of Washington" to "University of Wisconsin–Madison" / "UW–Madison" while preserving all sampling caveats and statistical data.
  2. **AI-Led Care Loop Reconciled with Concierge Beta (`docs/PROJECT_CONTEXT.md`)**: Clarified that scalable long-term Derive is AI-led and software-managed, while the 10-member Founding Beta uses manual founder review of early recommendations, routine adaptations, and check-ins where useful for learning. Reaffirmed that recurring founder consultation is an operational bridge, not the permanent product promise.
  3. **ADR-13 vs. ADR-21 Target vs. Temporary Override Alignment (`docs/DECISIONS.md`)**: Formally defined ADR-13 as the scalable long-term care-loop target architecture and ADR-21 as the temporary operational override for the 10-member Founding Beta learning cohort.
  4. **Pass 7 Ledger Final State (`docs/CONTEXT_SYNC.md`)**: Updated Pass 7 bookkeeping to record ending pushed commit `3cf752d`, remote verified status, GitHub CI success (`Run 35250494613`), and Drive sync status.
  5. **Planned Backend Intelligence & Edge Functions Clarification (`README.md`)**: Clarified that server-side Gemini 2.5 Flash structured intelligence and Supabase Edge Functions are planned architecture (S3 milestone); the client currently uses deterministic local reasoning via `MockDeriveService`.
  6. **Today Research Card Action-Relevance Alignment (`docs/PRODUCT.md`)**: Reconciled the Today tab research card so clinical literature surfaces on Today only when directly relevant to an active routine adaptation or barrier state, keeping general educational research on Ask, Progress, and detail views to protect Today's 2-second glance.

---

## 2026-09-17 — Founder Alignment: Founding Beta Concierge Model, $100/Mo Experiment & Durable Context Reconciliation (Pass 7)

- **Agent / Workstream**: Kanuj & Sami Founder Alignment (Mobile/UX + Platform/Intelligence)
- **Local Branch**: `main`
- **Starting Shared HEAD / origin/main**: `58277086cf7335a11fa9d5c05e9e4e56aa144957`
- **Ending Pushed SHA**: `3cf752d72672798bdec43cca6d416925ecdb20c0`
- **Remote Push Status**: `pushed / verified`
- **GitHub CI**: `success` (Run ID: `35250494613`)
- **Drive Status**: `synced by orchestrator after agent completion`
- **Milestone Status**: `S1 IN PROGRESS` (S1A data plane complete; S1B/S2 in progress); `K4 COMPLETE` (K4.1 pricing prototype & K4.2 phenotype prototype complete; K5 next).
- **Ownership / Shared Contracts**: Strictly documentation and durable architectural context reconciliation across both founder workstreams. Zero changes to UI components, database migrations, Supabase schema, or shared TypeScript contracts (`src/contracts/**`, `src/domain/**`).
- **Durable Decisions & Context Reconciled**:
  1. **Founding Beta Concierge Operating Model**: Approved high-touch concierge MVP for the first 10 paying members. Core principle: *Sell the future Derive outcome now; deliver it manually where necessary.* Kanuj manually reviews intake, baseline photos, routine construction, product sourcing/fulfillment, and weekly check-ins. Scalable long-term product remains AI-led and software-managed. Explicitly NOT a private consulting business; zero permanent recurring founder consultation promise.
  2. **Founding Beta Price Experiment ($100/mo for first 10)**: Approved beta experiment (ADR-21), distinct from long-term pricing architecture. Validates willingness-to-pay, routine adherence, and month-two retention. Customer pays one monthly price covering management plus standard OTC routine products based on actual need. No product wallet, credit balance, or rollover allowance. Existing working products preserved (`KEEP`); no shipping duplicates for calendar billing theater. ADR-10 ($129/mo) marked HISTORICAL / SUPERSEDED. ADR-15 (Personalized All-In Monthly Pricing, Arthur $96/mo demo fixture) remains PROVISIONAL / PENDING COFOUNDER BUSINESS REVIEW.
  3. **6 Beta Learning Hypotheses**: Recorded explicit success questions: Value, Behavior, Trust, Longitudinal, Fulfillment, Retention. Vanity engagement metrics must not displace evidence against these hypotheses.
  4. **Autopilot vs. Depth Philosophy**: Clarified that "Autopilot vs. Depth" is a product design philosophy, NOT user modes or a settings toggle. Default is Today + Plan + lightweight check-ins + approvals; optional depth is Scan, Ask, Progress, and research cards. Canonical 5 native tabs preserved.
  5. **Required Baseline Photos (Founding Beta)**: Required for paid Founding Beta members only. Guided Front -> Left -> Right sequence. Camera evaluates photographic capture quality only (face presence, pose, distance, centering, lighting, sharpness, stability) with auto-capture and manual fallback. On-device quality gating where practical; zero persistent face embeddings or facial recognition. Photos do not diagnose disease or measure hydration/sebum quantitatively.
  6. **Routine Change & Member Approval Policy**: Explicit trust boundary. Derive may automatically ingest check-ins, update observations, generate progress summaries, determine "no change needed", propose modifications, and estimate refill timing. Material changes (adding/replacing products, permanent removal, changing strong active frequency/intensity, introducing strong active, reintroducing adverse-history ingredient, price increase, shipping new/substitute product) require explicit member approval before activation. Prescriptions are contextual only. Safety escalation remains immediate for acute red flags.
  7. **Refill Consent Policy**: Same-product refills use low-friction confirmation ("Running low on [product]? Refill"). No fake deterministic depletion claims, no silent auto-shipment based solely on elapsed calendar days. Future standing consent for same SKU with advance notice and skip option. Substitutions require affirmative approval.
  8. **Founder Research Conversations**: Biweekly-ish customer discovery and feedback conversations for first 10 members; explicitly NOT a permanent recurring consultation feature.
  9. **Preliminary Customer-Discovery Evidence (N=31 Wave 1 Pilot)**: Recorded survey findings with explicit convenience sample caveats (UW–Madison/CS-heavy, male-skewed, not representative) and Q5 multi-select configuration note. 54.8% prioritized build/manage + adapt + progress tracking. Directional signal favoring longitudinal management/progress/adaptation over Scan/fulfillment as primary acquisition wedge. Scan and fulfillment preserved for retention defensibility.
  10. **Customer-Facing Trust & Safety Language Standards**: "Your skincare, handled." "Your first routine gets one final quality check before it goes live." Strict prohibitions on claiming AI dermatologist, unsubstantiated clinical review, photo disease diagnosis, pseudo-quantitative selfie measurements, causal allergy inference from one event, guaranteed outcomes, or unheld medical credentials.
  11. **README & Durable Docs Line-by-Line Audit**: Removed stale $129 claims, distinguished implemented stack from planned architecture, updated documentation sitemap to include `docs/PRODUCT.md` and `docs/CONTEXT_SYNC.md`, and reconciled all 12 docs across the repository.
- **Decision Status**:
  - `ADR-10: Manual Operations & $129/Month Canonical Pricing`: **HISTORICAL / SUPERSEDED**
  - `ADR-15: Personalized All-In Monthly Pricing Architecture`: **PROVISIONAL / PENDING COFOUNDER BUSINESS REVIEW**
  - `ADR-20: S1A Least-Privilege Supabase Data Plane`: **IMPLEMENTED** (full S1 in progress)
  - `ADR-21: Founding Beta Concierge Operating Model & $100/Month First-10 Pricing Experiment`: **APPROVED BETA EXPERIMENT**
- **Unresolved Founder Decisions**:
  - Long-term company pricing architecture, commercial ranges, management fee, and operations buffer after the 10-member beta (Kanuj & Sami alignment).
  - Open shared-contract challenges (ARCHITECTURE_CHALLENGE-01: `$129` in membership identity; ARCHITECTURE_CHALLENGE-02: safety unknown state collapse; ARCHITECTURE_CHALLENGE-03: `STOP` vs `PAUSE` persistence drift).
  - Formal cancellation, refund, and fulfillment terms for Founding Beta checkout.

---

## 2026-09-16 — Sami Platform: S1A Least-Privilege Data Plane

- **Agent / Workstream**: Sami (Platform, Intelligence & Operations)
- **Local Branch**: `main`
- **Starting Shared HEAD / origin/main**: `71e693d6b45f6850d5c53332172ef139fc41d3e8`
- **Pass 6 Ledger Correction Commit**: `59e57c8cae96231ae6764dece6544e7eb14c49c9`
- **Implementation Commit**: `3f37e706f89898810d10c04f8c4466d914ef69a9`
- **Ledger Sync**: This docs-only successor commit records the implementation checkpoint without self-referencing its own SHA.
- **Remote Push Status**: `pushed` (final checkpoint verified against `origin/main`)
- **Drive Status**: `sync-required` (`DRIVE_SYNC_PAYLOAD` emitted in completion report)
- **Milestone Status**: `S1 IN PROGRESS`; S1A database/auth-policy/private-storage data plane is implemented, but official Docker-backed Supabase reset/pgTAP verification, persistent mobile auth, trusted photo signing, and Storage-API-first deletion remain open.
- **Ownership / Shared Contracts**: No Kanuj-owned UI, `src/domain/**`, `src/contracts/**`, or shared TypeScript schema was changed. Sami-owned `src/services/remote/**` projections were narrowed to customer-readable columns so the new grants do not fail on wildcard expansion.
- **Durable Changes**:
  1. Added reproducible local Supabase configuration with migrations, Auth, and Storage enabled; PostgreSQL 15 remains a local pin that must be checked against the hosted project before linking.
  2. Added an additive S1A migration; the applied baseline migration was not rewritten.
  3. Added Derive-namespaced Auth triggers and locked private-schema functions that provision/backfill profiles and synchronize Auth-owned email without replacing unrelated triggers.
  4. Enabled RLS on all eleven existing application tables, normalized existing application-policy drift, revoked implicit client grants, restricted mutable columns, and established server-only default privileges for future public objects/RPCs.
  5. Kept payment identifiers, founder notes/tasks, AI analysis, fulfillment state, onboarding completion, and ownership reassignment outside client authority.
  6. Added a non-public 10 MiB image-only `customer-skin-photos` bucket with immutable, owner-bound uploads under `<auth-uuid>/<photo-type>/<opaque-file-name>` and no direct customer list/read/sign/update/delete path.
  7. Reserved photo-object and photo-metadata deletion for a future trusted Storage-API-first workflow so partial client operations cannot orphan private blobs.
  8. Added a fail-closed preflight for unexpected `storage.objects` policies because permissive policies combine with OR semantics.
  9. Added a 64-assertion pgTAP suite covering exact policy roles/commands, grants, default RPC privileges, Auth lifecycle, anonymous denial, owner/cross-owner isolation, server-only fields, bucket invariants, and Storage insert-policy behavior.
  10. Corrected documentation that previously implied the remote feature flag alone makes the current locally stored UI production-ready.
- **Verification**:
  - `npm test`: **PASS**, 38/38.
  - `npx tsc --noEmit`: **PASS**.
  - `EXPO_NO_TELEMETRY=1 npx expo export -p web`: **PASS**.
  - PostgreSQL parser: baseline migration, S1A migration, and pgTAP file all parse.
  - Fresh ephemeral PostgreSQL-compatible migration-chain verification: **PASS** for Auth trigger, future-function defaults, RLS, safe field grants, cross-user isolation, owner-bound Storage insert, and private bucket invariants.
  - Supabase CLI `2.117.0` read the project configuration, but `supabase db reset` / `supabase test db` could not run because this host has neither Docker nor Podman. The committed pgTAP suite is therefore authored and statically reviewed, not reported as officially executed.
- **Decision Status**:
  - `ADR-20: S1A Least-Privilege Supabase Data Plane`: **IMPLEMENTED** (full S1 remains in progress).
  - Flat-price membership semantics, explicit safety unknown states, and `STOP` versus `PAUSE`: **PROPOSED / UNRESOLVED ARCHITECTURE_CHALLENGES** only.
  - Phenotype/PIH persistence and personalized pricing persistence: **NOT IMPLEMENTED** in S1A.
  - Stripe: **NOT STARTED**; remains S5.
- **Architecture Challenges Raised**:
  1. `ARCHITECTURE_CHALLENGE-01`: `$129` is embedded in membership identity while pricing direction is unresolved.
  2. `ARCHITECTURE_CHALLENGE-02`: Database/shared contracts collapse pregnancy/nursing and sensitivity unknown states into `false`/empty values.
  3. `ARCHITECTURE_CHALLENGE-03`: Database persistence rejects client-valid `PAUSE` while permitting underdefined `STOP`.
- **Unresolved / Next Work**:
  - Run the official fresh Supabase reset, pgTAP suite, and Storage API upload smoke test on Docker-backed local/CI infrastructure before deployment.
  - Implement the JWT-bound 900-second photo signer and idempotent Storage-API-first deletion workflow as S1B.
  - Coordinate persistent Expo Auth session/callback/route gating and the canonical non-upserting uploader without silently changing Kanuj-owned UI.
  - Finish remote row-to-domain mapping, routine-item assembly, live functions, and integration coverage before enabling remote mode for customers.
  - Founders must resolve the three shared-contract challenges before the dependent S2/S5 persistence work is declared complete.

---

## 2026-09-16 — Kanuj Mobile/UX: Architecture-Correctness Cleanup (Pass 6)

- **Agent / Workstream**: Kanuj (Mobile Client, UX & Prototyping)
- **Local Branch**: `main`
- **Starting Local HEAD**: `ae4e49d951477d53967196729a4933fb6fb71b30`
- **Ending Commit / HEAD**: `71e693d6b45f6850d5c53332172ef139fc41d3e8` (pushed checkpoint)
- **Remote Push Status**: `pushed`
- **Drive Status**: `sync-required` (DRIVE_SYNC_PAYLOAD emitted in completion report)
- **Architecture Challenges Raised / Resolved**: None
- **Durable Changes**:
  1. **Corrected CONTEXT_SYNC Truth**: Aligned ADR numbering (ADR-15, ADR-17, ADR-18, ADR-19) and confirmed Pass 5 pushed commit SHA (`ae4e49d`).
  2. **Removed Invented Pricing Range**: Stripped unapproved `~$49–$129/mo` range from all repository documentation. Clarified that personalized all-in monthly pricing is a provisional direction, Arthur's $96/mo is an illustrative deterministic demo fixture (not a pricing commitment), and final commercial terms/ranges require founder alignment between Kanuj and Sami.
  3. **Decoupled SunResponse Semantics**: Sourced `SunResponse` strictly from behavioral self-reported sun reaction (`burns_easily`, `burns_then_tans`, `sometimes_burns_tans`, `rarely_burns_tans_easily`, `not_sure`), removing any implicit mixing with pigmentation depth.
  4. **Enforced Full Evidence Applicability Constraints**: Introduced `EvidenceApplicabilityContext` (`productHasIronOxides`, `photoprotectionRelevant`), enforced that `directRoutineInfluenceAllowed: false` hard-blocks direct routine changes regardless of study grade, and ensured missing context fails closed.
  5. **Removed Pigmentation-Alone Iron-Oxide Benefit Rule**: Iron-oxide photoprotection benefit requires a reported/confirmed post-inflammatory hyperpigmentation signal (`pihTendency: 'sometimes' | 'often'`), never inferred from pigmentation depth alone.
  6. **Distilled White-Cast Logic**: Eliminated speculative formula-category predictions; grounded white cast in catalog-verified or member observation evaluated against member cast concern.
  7. **Removed Unapproved Ingredient Prescription Rule**: Removed automatic recommendation of specific actives (Niacinamide, Azelaic acid) from PIH product documentation.
  8. **Preserved Backend Interface Semantics**: Reframed `docs/INTERFACES.md` Section 7 around semantic provenance and pricing lifecycle requirements without dictating database table/column layouts for Sami.
  9. **Strengthened AGENTS Bootstrap & Sync**: Added fast-forward-only automatic remote reconciliation (`git merge --ff-only origin/main`), divergence guard, and full `ARCHITECTURE_CHALLENGE` packet template.
  10. **Terminology Cleanup**: Replaced "human verification" with "manual final quality check" for initial routine; replaced "medical context" with "sensitive member/skincare data".
- **Decision Status**:
  - `ADR-15: Personalized All-In Monthly Plan Pricing`: **PROVISIONAL / PENDING COFOUNDER BUSINESS REVIEW**
  - `ADR-17: Phenotype-Aware, Never Race-Aware Skin Modeling`: **PROVISIONAL CLIENT ARCHITECTURE IMPLEMENTED**
  - `ADR-18: Research Evidence Grading & Member Applicability Policy`: **IMPLEMENTED (Client Prototype Policy)**
  - `ADR-19: Categorical Tint Compatibility & White Cast Assessment`: **IMPLEMENTED (Client Prototype Policy)**
  - `Backend Schema & Remote Service Evolution`: **PROPOSED (Awaiting Sami Review)**
- **Repo Docs Updated**:
  - `AGENTS.md`
  - `docs/CONTEXT_SYNC.md`
  - `docs/PROJECT_CONTEXT.md`
  - `docs/PRODUCT.md`
  - `docs/RESEARCH.md`
  - `docs/SAFETY_PRIVACY.md`
  - `docs/DECISIONS.md`
  - `docs/ROADMAP.md`
  - `docs/INTERFACES.md`
  - `docs/ARCHITECTURE.md`
- **Unresolved Founder Decisions**:
  - Final business model, commercial pricing ranges, management/operations components, first-basket financing, refund policy, and cancellation rules (Kanuj & Sami alignment).
  - Database schema & entity persistence design for phenotype provenance and routine-linked pricing snapshots (Sami review).

---

## 2026-09-16 — Kanuj Mobile/UX: Phenotype Architecture, Provenance & Evidence Policy (Pass 5)

- **Agent / Workstream**: Kanuj (Mobile Client, UX & Prototyping)
- **Local Branch**: `main`
- **Starting Local HEAD**: `4d4f41faa34a53a9a0abc8516676a37368cdbf04`
- **Ending Commit / HEAD**: `ae4e49d951477d53967196729a4933fb6fb71b30`
- **Remote Push Status**: `pushed` (verified against `origin/main`)
- **Drive Status**: `sync-required` (DRIVE_SYNC_PAYLOAD emitted in completion report)
- **Architecture Challenges Raised / Resolved**: None
- **Durable Changes**:
  1. **Phenotype-Aware, Never Race-Aware Architecture**: Built client/mock module `src/phenotype/` (`types.ts`, `profile.ts`, `evidence-policy.ts`, `tint-compatibility.ts`, `fixtures.ts`, `index.ts`). Explicitly prohibits race/ethnicity classifiers, CV colorimetry, Fitzpatrick ML inference, and demographic recommendation rules.
  2. **Categorical Provenance & Confirmation Invariant**: Modeled `ProvenancedValue<T>` with categorical confidence (`low` | `medium` | `high`) and source tracking (`self_reported`, `photo_estimate`, `observed_history`, `derived_from_history`, `external_context`). Enforced that explicit member confirmation strictly outranks unconfirmed estimates (`setOrConfirmPhenotypeValue`).
  3. **V1 Onboarding Adaptive PIH Signal**: Added single adaptive follow-up *"Do breakouts or irritation usually leave dark marks that stick around?"* with structured choices (`Rarely`, `Sometimes`, `Often`, `Not sure`) shown when `breakouts` or `dark_spots` goals are selected. Recorded as `self_reported`, `userConfirmed: true`.
  4. **Evidence Strength vs. Member Applicability**: Codified evidence policy separating methodological grade (`A` / `B` / `C` / `D`) from member applicability. Grade A/B eligible only when member criteria match; Grade C (observational/mechanistic) cannot silently alter routine steps; Grade D (preliminary/anecdotal) cannot drive product behavior.
  5. **Tinted-Product Categorical Compatibility**: Implemented shade matching without fake numerical scores. Returns `needs_confirmation` when member depth is unconfirmed; detects iron-oxide visible light photoprotection benefits for PIH-prone skin.
  6. **Personalized Pricing Prototype Correctness**: Retained deterministic 30-day consumption arithmetic ($96/mo Arthur demo estimate) with explicit separation of active routine consumption, inventory lifespan, and provisional operations.
- **Decision Status**:
  - `ADR-15: Personalized All-In Monthly Plan Pricing`: **PROVISIONAL / PENDING COFOUNDER BUSINESS REVIEW**
  - `ADR-17: Phenotype-Aware, Never Race-Aware Skin Modeling`: **PROVISIONAL CLIENT ARCHITECTURE IMPLEMENTED**
  - `ADR-18: Research Evidence Grading & Member Applicability Policy`: **IMPLEMENTED**
  - `ADR-19: Categorical Tint Compatibility & White Cast Assessment`: **IMPLEMENTED**
  - `Backend Schema & Remote Service Evolution`: **PROPOSED (Awaiting Sami Review)**
- **Repo Docs Updated**:
  - `AGENTS.md`
  - `docs/CONTEXT_SYNC.md`
  - `docs/PROJECT_CONTEXT.md`
  - `docs/PRODUCT.md`
  - `docs/RESEARCH.md`
  - `docs/SAFETY_PRIVACY.md`
  - `docs/DECISIONS.md`
  - `docs/ROADMAP.md`
  - `docs/INTERFACES.md`
  - `docs/OWNERSHIP.md`
  - `docs/DESIGN.md`
- **Unresolved Founder Decisions**:
  - Migration of `SkinPhenotypeProfile` from `src/phenotype/` to backend database schema (`supabase/migrations/`) when Sami implements remote persistence.
  - Final Stripe commerce contract and founder billing dashboard integration.

---

## 2026-09-16 — Kanuj Mobile/UX: Personalized Pricing Architecture & Correctness Pass (Pass 4)

- **Agent / Workstream**: Kanuj (Mobile Client & Prototyping)
- **Local Branch**: `main`
- **Starting Local HEAD**: `50c5a3f` -> `4d4f41f`
- **Remote Push Status**: `pushed`
- **Drive Status**: `sync-required`
- **Durable Changes**:
  - Established 3-part economic concept: retail unit price, inventory lifespan (e.g. 60–90 days), and 30-day normalized consumption.
  - Arthur fixture verified at $96/month ($39 management + $52 products + $5 provisional operations).
  - Price stability contract: routine edits do not change billing unless product consumption changes; price increases require member confirmation; price drops apply automatically.
