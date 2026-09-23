# Derive Roadmap: First Customer

This opening section is the current execution plan. Earlier delivery records below are historical, not assignments for new work. Each active or future implementation milestone has one founder owner. [OWNERSHIP.md](OWNERSHIP.md) defines lanes and cross-lane defect handoffs. GitHub is the sole durable project context.

**Company gate:** customer #1 can pay $25/month for the Derive management membership, buy products separately, complete the real app journey, and receive a trustworthy routine. The first 10 members are a concierge MVP: manual founder recovery is acceptable; fabricated product/formula truth and unrecoverable automation are not.

## Product catalog and Check a Product V1 assignment

- **Catalog foundation (PR A):** Kanuj is authorized by this customer-requested integration milestone to deliver a bounded platform catalog search/ingestion interface on top of S6. This is a one-time assignment, not a transfer of Sami's F1, H1P, H1B, or ongoing product-resolution ownership. It must land and deploy before the mobile consumer.
- **Mobile consumer (PR B):** Kanuj owns onboarding search and Check a Product UX against the stable catalog interface. Current Remote Staging Ask/Scan gating stays in place; this milestone creates no TestFlight submission.
- **Source boundary:** demand-driven, operator-verified catalog entries only. Product-only records are valid; formula and package identity require separate S6 evidence. See [PRODUCT_CATALOG.md](PRODUCT_CATALOG.md).

## Current milestone sequence

```text
Landed foundation: V1A -> L0 -> H1A hosted baseline
Completed mobile preflight: Kanuj L1A
Landed beta access: AUTH-V1 email/password -> Build 9 free external-beta claim
Current platform: Sami F1 manual routine fallback
Next platform: Sami H1P provider activation and H1B billing (separate gates)
After each routine origin: Kanuj L1B manual fallback and L1C provider-path device acceptance
Wave 3 in parallel: Kanuj L2A customer launch readiness  |  Sami P1 production backend
Final: Kanuj L2B customer #1 acceptance
```

H1A's verified hosted intake, photos, entitlement fixture, founder authorization and selected security boundaries are in [HOSTED_REMOTE_SMOKE.md](HOSTED_REMOTE_SMOKE.md). Subsequent AUTH-V1 replaced the earlier proposed OTP prerequisite for this beta with real email/password signup and sign-in; Build 9 grants server-owned free staging access behind a private release flag. Email confirmation, SMTP, OTP, and password-reset mail remain deliberately outside this cohort. The final model/provider remains undecided; this account could not store the user's verified free-tier key in hosted Supabase secrets, and bounded direct adapter calls received upstream 503 high-demand. H1P is Sami's separate provider-activation milestone, independent of F1 manual routine recovery. No proposal, publication, or published-member path is proven; customer #1 launch cannot claim working Ask/Scan intelligence while H1P remains blocked. Stripe remains a separate Sami gate. S6 does not block customer #1 when manual recovery works.

### V1A: First-Customer Intake Integrity

- **Owner:** Kanuj. **Status:** COMPLETE. **Prerequisites:** C1.5A landed.
- **Owned surfaces:** customer mobile onboarding/Shelf, client recovery/support presentation, acceptance documentation, repository roadmap and ownership docs.
- **Explicit non-scope:** H1, backend, founder operations, F1, S6, hosted configuration, physical commerce.
- **Outcome:** customer-entered Shelf and safety truth survives recognition and retakes.
- **Acceptance criteria:** brand, exact name and category can be added, edited, viewed, removed and retained through empty or failed recognition/retake; no canned product or invented actives/formula/catalog provenance; truthful Shelf and support copy.
- **Handoff to:** L0 prepares an explicit Remote staging customer build; hosted and founder-operation baselines follow separately.

### L0: Remote Customer Build Readiness

- **Owner:** Kanuj. **Status:** COMPLETE. **Prerequisites:** V1A landed.
- **Owned surfaces:** `eas.json`, public mobile environment validation, staging-only build diagnostics, Remote client route/state tests, and build documentation.
- **Explicit non-scope:** hosted Supabase mutation, Auth/email activation, Stripe, Gemini, founder operations, production Remote enablement, L1 device acceptance.
- **Outcome:** `remote-staging` is a store-signed, TestFlight-capable profile selecting EAS `preview` and compiling Remote mode. Development and production remain Mock. The staging diagnostic exposes safe build identity only.
- **Acceptance criteria:** Invalid flavor, missing or malformed hosted URL/key, local URL, or inconsistent Remote mode fail closed. H1A subsequently verified and configured the preview public URL/key; no device binary has been accepted.
- **Handoff to:** L1A builds and installs from this profile without a new build architecture milestone.

### H1A: Hosted Remote Core

- **Owner:** Kanuj for this single milestone by founder authorization. **Status:** HOSTED BASELINE PROVEN; provider-dependent routine/member gates BLOCKED. **Prerequisites:** L0 landed, current `main` reconciled, exact hosted project verified.
- **Owned surfaces:** hosted Supabase readback, guarded post-auth staging fixture/entitlement, Remote onboarding/photos, founder authorization, selected security smoke, and still-valid evidence from old draft PR #21.
- **Explicit non-scope:** real email delivery and six-digit OTP proof (H1E), Stripe Checkout/webhook proof (H1B), F1 founder-from-scratch routine creation, production Remote enablement, customer mobile redesign.
- **Outcome:** disposable hosted identities proved post-auth entitlement, intake, manual Shelf and reaction snapshot, private photos, founder authorization, selected cross-user denial and account deletion. The synthetic membership is not billing proof.
- **Acceptance criteria:** current hosted matrix in [HOSTED_REMOTE_SMOKE.md](HOSTED_REMOTE_SMOKE.md) states each PASS, WARN and BLOCKED gate. Real model/proposal, founder routine edit/publish, published customer read and dependent member surfaces remain blocked until a model decision or separate F1 path. Production Remote remains off.
- **Handoff to:** Sami resumes platform ownership for F1, H1P provider activation, H1E and H1B; Kanuj starts L1A signed-out physical preflight with explicit Auth and routine blockers.

### F1: Founder Manual Routine Fallback

- **Owner:** Sami. **Status:** CURRENT. **Prerequisites:** H1A hosted baseline and AUTH-V1 access landed.
- **Owned surfaces:** `admin/**`, founder operations, backend routine validation and publication.
- **Explicit non-scope:** customer mobile UX, L1A/L1B/L1C device acceptance, email and Stripe setup.
- **Outcome:** when automation has no usable proposal, an authorized founder can construct a complete routine inside Derive through the same safety, validation and publication pipeline. Multiple authorized origins use one publication authority.
- **Acceptance criteria:** founder creation, edit, validation, publication, member readback and refusal of incomplete or unsupported product truth pass on hosted disposable accounts. No client or RLS bypass.
- **Handoff to:** Kanuj L1B manual-fallback acceptance after the stable interface is documented.

### L1A: Remote Staging Device Preflight

- **Owner:** Kanuj. **Status:** COMPLETE for its historical signed-out physical-device scope; post-auth journey remains outside L1A and is no longer H1E-blocked after AUTH-V1. **Prerequisites:** L0 and H1A hosted baseline.
- **Owned surfaces:** store-signed Remote staging/TestFlight build, physical-device installation, signed-out login/recovery, staging diagnostics, reachable native camera/haptics/layout checks, and customer mobile defects.
- **Explicit non-scope:** password login UI, token/session injection, entitlement bypass, backend, F1, H1P, H1E, H1B and production Remote.
- **Outcome:** Remote staging `1.0.0 (5)` was built, processed by internal TestFlight, installed and exercised on an iPhone 17 Pro Max without treating build identity as backend proof. A missing build-number diagnostic was found on build 4, fixed and physically closed on build 5.
- **Acceptance criteria:** installed build reports Remote Staging, Remote service, verified Derive host, valid public configuration shape and `App: 1.0.0 (5)` with no key/token. Signed-out cold launch, USB restart, invalid email, background/foreground, offline OTP-request failure and restored-network recovery passed. Scan and photo deep links did not grant a supported post-auth session. At that checkpoint, authenticated intake/routine/member and camera module runtime remained assigned to later Auth-dependent milestones rather than bypassed; AUTH-V1 subsequently supplied the approved beta session path.
- **Handoff to:** Kanuj L1B for F1 fallback and L1C for H1P provider-path acceptance through the current AUTH-V1 session; Sami receives exact provider/backend blockers.

### L1B: Manual-Fallback Acceptance

- **Owner:** Kanuj. **Status:** PLANNED for Wave 2. **Prerequisites:** F1 hosted publication interface, current AUTH-V1 hosted access, and L1A device baseline.
- **Owned surfaces:** device journey and mobile recovery when automated routine preparation is unavailable.
- **Explicit non-scope:** founder routine construction code, model/provider setup, Stripe and email backend.
- **Outcome:** the customer completes intake, founder uses F1 to construct and publish, and the customer sees the validated routine.
- **Acceptance criteria:** one controlled device run observes unavailable automation, F1 construction, guarded publication and member readback; no manual off-app promise is counted as success.
- **Handoff to:** L2A customer launch readiness for the manual recovery path.

### L1C: Authenticated Remote Provider-Path Acceptance

- **Owner:** Kanuj. **Status:** PLANNED; independent of L1B after its own prerequisites. **Prerequisites:** L1A physical staging baseline, current AUTH-V1 hosted access, H1P hosted routine/Ask/Scan provider proof, and a controlled staging entitlement.
- **Owned surfaces:** physical-device customer Auth, intake/photos, automated proposal-to-founder publication handoff, published member readback and customer-visible Today, Plan, Shop/Scan, Ask, Check-In and Progress states.
- **Explicit non-scope:** H1P provider implementation, F1 manual routine construction, H1B Stripe backend and production Remote activation.
- **Outcome:** the authenticated customer app consumes a real hosted provider-backed routine and member services on a physical device without using H1A's script password session or client entitlement bypass.
- **Acceptance criteria:** hosted email/password creates the intended mobile session; a trusted staging-only entitlement is read canonically; intake/photos persist; H1P proposal is validated and published through current founder authority; member tabs and known/unknown Scan and Ask states reflect hosted truth. Customer errors recover safely and no Mock fixtures or fabricated product/formula claims appear. Billing remains separately unverified until H1B.
- **Handoff to:** L2A launch readiness after both L1B manual recovery and L1C provider-path evidence, or a founder-approved narrower launch scope that explicitly withholds unavailable intelligence.

### H1P: Hosted Model Provider Activation

- **Owner:** Sami. **Status:** PLANNED, blocked on approved model choice, hosted Edge secret permission and provider availability. **Prerequisites:** H1A hosted baseline; independent of F1.
- **Owned surfaces:** approved server-side model credential and runtime configuration, real hosted routine proposal, Ask and Scan provider calls, output validation and provider error behavior.
- **Explicit non-scope:** F1 manual founder construction, H1E email, H1B Stripe, customer mobile UI and client-visible model keys.
- **Outcome:** supported hosted intelligence uses a real selected provider while unknown product/formula evidence stays unknown.
- **Acceptance criteria:** credential remains in trusted server storage; actual provider calls for routine, Ask and Scan are observed; structured outputs pass existing validators; failure stays recoverable and does not fabricate routine, ingredient, product or diagnosis truth. A direct key lookup or local adapter call alone cannot pass H1P.
- **Handoff to:** Kanuj L1C authenticated provider-path device acceptance and Sami P1 production backend readiness. F1 remains the independent manual routine recovery path.

### H1E: Verified Email Delivery and Recovery

- **Owner:** Sami. **Status:** PARKED; superseded as a Founding-Beta sign-in prerequisite by AUTH-V1. **Prerequisites:** founder approval to add verified email/recovery plus sender/domain access.
- **Owned surfaces:** future sender, DNS, custom SMTP, verified-email, password-reset, or OTP delivery selected for a later cohort.
- **Explicit non-scope:** current Kanuj mobile AUTH-V1 UX, Stripe, and routine provider choice.
- **Outcome:** if reopened, real hosted email delivery provides the approved verification or account-recovery path.
- **Acceptance criteria:** dedicated inbox delivery, verification/reset or code recovery, retry behavior, and identity readback pass; link-only or local tests do not count.
- **Handoff to:** the later mobile milestone that explicitly adopts the approved recovery interface. H1E does not block current L1B/L1C.

### H1B: Hosted Billing Activation

- **Owner:** Sami. **Status:** PLANNED for Wave 2 after his Stripe infrastructure work. **Prerequisites:** correct Derive Stripe account and hosted S5 baseline.
- **Owned surfaces:** $25 monthly test Price, Checkout, signed webhook, canonical membership, Portal, pause/cancel/downgrade and event ordering/idempotency.
- **Explicit non-scope:** H1A synthetic entitlement as payment proof, Kanuj build/UI work, physical product commerce.
- **Outcome:** test-mode payment and signed events govern membership without navigation-based activation.
- **Acceptance criteria:** actual test Checkout, signed webhook, member activation, Portal change, downgrade and replay/order guards pass against the correct account.
- **Handoff to:** P1 live-mode readiness and Kanuj's later provider/device acceptance.

### L2A: Customer Launch Readiness

- **Owner:** Kanuj. **Status:** PLANNED for Wave 3. **Prerequisites:** L1B, L1C or a founder-approved narrower intelligence scope, H1B activation, and H1P proof or an explicit founder-approved limit on Ask/Scan claims.
- **Owned surfaces:** production customer build preparation, customer contact path, launch copy, founder-approved policy surfaces, operating checklist and physical-device launch QA.
- **Explicit non-scope:** live Stripe backend, SMTP, server security and founder backend.
- **Outcome:** a truthful, supportable customer launch package is ready for final cross-lane acceptance.
- **Acceptance criteria:** working contact route, reviewed copy/policies, correct production build identity and physical-device journey pass without claiming backend gates from UI alone.
- **Handoff to:** L2B after Sami's P1.

### P1: Production Backend Readiness

- **Owner:** Sami. **Status:** PLANNED for Wave 3. **Prerequisites:** accepted production Auth configuration, H1B, F1 and H1P proof or an explicit founder-approved limit on provider-backed features.
- **Owned surfaces:** production Auth, optional email recovery if approved, live Stripe, production founder access, backend/security smoke and production environment.
- **Explicit non-scope:** Kanuj's customer copy, mobile presentation and device QA.
- **Outcome:** real backend services and founder operation are ready for customer #1.
- **Acceptance criteria:** production Auth, signed live billing, routine origin/recovery, RLS/Storage/privacy, advisor review and deletion/operations checks are evidenced. Ask/Scan intelligence is proven through H1P or plainly unavailable in the approved launch scope.
- **Handoff to:** Kanuj L2B final acceptance.

### L2B: Final Customer #1 Acceptance

- **Owner:** Kanuj. **Status:** PLANNED after Wave 3. **Prerequisites:** L2A and P1 both accepted.
- **Owned surfaces:** final customer-facing end-to-end acceptance and go/no-go record.
- **Explicit non-scope:** direct backend implementation or unverified money/provider claims.
- **Outcome:** customer #1 can pay for the $25/month management membership, buy products separately and receive a trustworthy routine with founder recovery.
- **Acceptance criteria:** full real customer journey, support contact, billing, routine delivery and privacy gates pass. Do not charge customer #1 before this gate.
- **Handoff to:** first-customer operation and learning.

### S6: Visual Product Identity and Formula Resolution

- **Owner:** Sami. **Status:** BACKEND RESOLVER IMPLEMENTED; mobile consumption and live visual/OCR extraction remain separate handoffs. Not a customer-#1 launch dependency.
- **Owned surfaces:** backend product identity, formula/provenance resolution, intelligence serving both Shelf and Scan.
- **Explicit non-scope:** Kanuj mobile UI adaptation, merchant-driven recommendation or Scan truth.
- **Outcome:** one backend resolver uses barcode, front label, ingredient photo, typed name and authoritative catalog evidence while unknown/ambiguous evidence remains unknown.
- **Acceptance criteria:** variant, region, packaging and reformulation provenance are retained; model resemblance proposes candidates only; production Shelf and Scan never claim identity from unsupported evidence. Current barcode lookup is a narrower existing path.
- **Implemented:** stable typed contract, deterministic trust resolver, provenance-preserving schema, private product-evidence storage, idempotent Edge Function, founder review/audit flow, owner-bound Scan case integration, deletion lifecycle, and regression coverage.
- **Handoff to:** Kanuj may now plan a separately owned mobile consumer against [`ProductIdentityResolver.ts`](../src/contracts/ProductIdentityResolver.ts). H1P still owns any live visual/OCR provider decision; model resemblance remains candidate-only.

## Parked commerce execution

C1.5A is **LANDED** (PR #23, merge `6f6a556`): Shop-only Where to Buy foundation. Production merchant listings remain zero and Ulta is test-only. `Product.isCatalogStandard` indicates narrow catalog provenance, not merchant/package/formula equivalence. No fake live price or availability; commerce never changes recommendation or Scan truth.

C1.5B official retailer feeds, live offers, affiliate/network applications and attribution, and C1.5C Derive Shopify merchant/checkout are **PARKED**. Public Shop, price comparison, cart, broad discovery, and automated physical fulfillment are parked too. First-10 operability and learning take priority. Keep the architecture in [COMMERCE.md](COMMERCE.md), but do not begin execution.

When reopened, split each implementation:

| Sequence | Single owner | Scope and handoff |
| :--- | :--- | :--- |
| C1.5B platform | Sami | Official feeds/APIs, listing identity, current offers, freshness, approved attribution. Publish a stable evidence-backed interface. |
| C1.5B mobile | Kanuj | Customer offer/purchase-option presentation and Shop states, after the platform interface. |
| C1.5C platform | Sami | Shopify product/variant, inventory, checkout, order and fulfillment lifecycle. Publish a stable interface. |
| C1.5C mobile | Kanuj | Customer checkout and order UX after the platform interface. |

## Next action by founder

- **Kanuj:** L1A and AUTH-V1 are complete. Start L1B after F1; start L1C after H1P using the current AUTH-V1 session. Until those handoffs, do not add Auth shortcuts or take Sami platform work.
- **Sami:** start F1 from the H1A hosted baseline. H1P is a separate model-provider activation gate; H1B is separate billing work with Stripe intentionally later. H1E verified-email/recovery work is parked unless the founders reopen it. Own platform defects and hand tested interfaces to Kanuj. Do not take L1A/L1B/L1C/L2 mobile implementation.

Future tickets use: **Milestone, Owner, Status, Prerequisites, Owned surfaces, Explicit non-scope, Outcome, Acceptance criteria, Handoff to.**

---

## Historical delivery record

The following entries preserve earlier scope and checkpoint language. The current plan above overrides old next-step, tab, pricing, and commerce-status wording.

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

### I1-B2: Initial Routine Intelligence Integration [COMPLETE · SERVER IMPLEMENTATION & PERSISTENCE DELIVERED]
* **Scope**:
  - **Server-Side Intelligence & Persistence (Sami Primary)**:
    - Context assembly: Ingests committed intake snapshot from `public.onboarding_submissions.payload_snapshot` (reading `pihTendencyAnswer` for PIH signal) and canonical `skin_profiles` (goals, midday feel, tightness, `is_pregnant_or_nursing`, `pregnancy_status`), confirmed shelf products, and baseline photo metadata.
    - Server-side routine intelligence formulated via `supabase/functions/propose-routine/` with server secrets (zero client keys) with structured JSON output enforcing canonical schema and step-level `whyChosen`.
    - Deterministic clinical & safety guardrails: Sunscreen AM invariant (sunscreens never in PM), Retinoid PM invariant (adapalene/tretinoin never in AM), and strict exclusion of contra-indicated actives during pregnancy/nursing.
    - Reconciled schema via additive migration `20260919010000_i1_b2_routine_intelligence_and_persistence.sql`:
      1. Added `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` to `public.routines` with `private.set_updated_at()` trigger.
      2. Replaced non-unique index with unique constraint `routines_user_id_version_unique UNIQUE (user_id, version)` on `public.routines`.
      3. Added `updated_at` and unique index `products_brand_name_idx ON public.products (lower(trim(brand)), lower(trim(name)))`.
      4. Added `product_id UUID REFERENCES public.products(id) ON DELETE RESTRICT` to `public.routine_items`.
      5. Added unique index `user_products_user_product_idx UNIQUE (user_id, product_id) WHERE product_id IS NOT NULL` on `public.user_products`.
      6. Granted `SELECT (updated_at)` on `public.routines` to `authenticated`; strictly retained security boundary denying client access to `founder_notes`.
      7. Created atomic transactional RPC `public.commit_routine_proposal(...)` executed exclusively by `service_role`.
    - Relational routine persistence: Inserts generated routine into `public.routines` (`version = 1`, `status = 'awaiting_review'`) and routine steps into `public.routine_items` with resolved `product_id` foreign keys.
    - Shelf action normalization & persistence invariant: Decided products normalized into `public.products` with `user_products.product_id` referencing that row, enabling `user_products JOIN products` $\to$ canonical `UserProduct`.
    - S2 persistence hardening: Routine/formula/reaction/signal history is append-only or immutable where appropriate; remote mapping fails closed when canonical product relationships or required timestamps are absent.
    - Founder review queue transition: Updates pending `initial_routine` task in `public.founder_review_tasks` with v1 generation notes.
    - Remote routine read assembly: Implemented full routine-item read assembly in `RemoteDeriveService.getRoutine()` (partitions into `amSteps` and `pmSteps`, derives `scheduleText` via `formatRoutineStepSchedule`) and `getUserProducts()`.
  - **Client-Side Consumption (Kanuj)**:
    - Mobile hydration: `hydrateRoutine()` in `src/services/deriveClient.ts` consumes assembled routine, detecting `routine.status === 'awaiting_review'` (`isPlanUnderReview = true`).
    - Quiet draft preview: Renders `DRAFT · NOT ACTIVE` indicator on Today and Plan tabs while preserving non-blocking navigation across all 5 tabs.
    - Truthful customer messaging: Displays "Final review: Your first routine gets one final quality check before it goes live."
    - Zero client-side Gemini execution; fails closed on missing or unauthenticated sessions.
* **Acceptance Criteria**:
  - 100% test suite passing (110/110 tests in `tests/derive.test.ts`).
  - 100% pgTAP test suite passing (113/113 assertions in `supabase/tests/**`).
  - 100% local E2E test harness passing (8/8 stages in `scripts/test-i1-b2-local.mjs`).
  - Application typecheck passes with 0 errors (`npx tsc --noEmit`).
  - Test typecheck passes with 0 errors (`npm run typecheck:tests`).
  - Web export passes cleanly (`EXPO_NO_TELEMETRY=1 npx expo export -p web`).
  - `eas.json` strictly preserves `EXPO_PUBLIC_USE_REMOTE_SERVICE: "false"`.
  - Database & integration tests automated in GitHub Actions CI (`ci.yml`).

### I1-B2.1: Real Model Intelligence, Trust Semantics & Error-Boundary Closure [COMPLETE · SERVER INTELLIGENCE DELIVERED]
* **Scope**:
  - **Real Server-Side Gemini Structured Output (Sami Primary)**:
    - Integrated `gemini-3.8-flash` (configurable via `GEMINI_MODEL`, secret `GEMINI_API_KEY`) via Google AI Studio REST endpoint with `responseMimeType: 'application/json'` and `responseSchema: GEMINI_PROPOSAL_RESPONSE_SCHEMA`.
    - Removed hardcoded production branded product generator fallbacks (Vanicream, La Roche-Posay, EltaMD mock generators removed).
    - Fails closed with `503 MODEL_UNAVAILABLE` when model credentials or network are unavailable (no silent fallback to fake routines).
    - Single source of intelligence logic: deduplicated types, invariants, validation, context assembly, and Gemini provider between `src/services/ai-workflows/routine-intelligence.ts` and `supabase/functions/propose-routine/`.
  - **Trust Semantics (`is_confirmed_by_user`)**:
    - AI-generated product recommendations in `public.user_products` are persisted with `is_confirmed_by_user = false`.
    - User-confirmed shelf audit products retain explicit user confirmation provenance.
  - **Customer-Safe Error Boundary**:
    - Replaced raw runtime errors with typed customer-safe error responder returning `{ error: string, code: RoutineErrorCode }`.
    - Canonical error codes: `UNAUTHORIZED` (401), `INTAKE_NOT_COMMITTED` (400), `INTAKE_CONTEXT_INVALID` (400), `MODEL_UNAVAILABLE` (503), `MODEL_OUTPUT_INVALID` (502), `CLARIFICATION_REQUIRED` (422), `VALIDATION_FAILED` (422), `PERSISTENCE_FAILED` (500), `INTERNAL_ERROR` (500).
    - Hardened security invariant: Zero stack traces, table names, SQL constraints, or provider internals exposed to clients.
  - **Fail-Closed Domain Context**:
    - Missing or non-canonical `Goal` or `RoutineComplexity` in intake context fails closed with `400 INTAKE_CONTEXT_INVALID` without fabricating arbitrary default values.
  - **Isolated Deterministic Test Seam**:
    - Deterministic fixture provider `createDeterministicTestProposal` isolated under test semantics (`x-routine-fixture: 'true'` header or `ROUTINE_FIXTURE_MODE = 'true'`) for CI and local test harnesses.
* **Acceptance Criteria**:
  - 100% test suite passing (114/114 tests in `tests/derive.test.ts`).
  - 100% pgTAP test suite passing (113/113 assertions in `supabase/tests/**`).
  - 100% local E2E test harness passing (8/8 stages in `scripts/test-i1-b2-local.mjs` including 5A model unavailability and 5B fixture proposal).
  - Strict application TypeScript check: 0 errors (`npx tsc --noEmit`).
  - Strict test TypeScript check: 0 errors (`npm run typecheck:tests`).
  - Clean Expo web production export (`EXPO_NO_TELEMETRY=1 npx expo export -p web`).
  - `eas.json` strictly preserves `EXPO_PUBLIC_USE_REMOTE_SERVICE: "false"`.

### I1-B2.2: Provider-Neutral Intelligence Boundary, Catalog Provenance & Trust Closure [COMPLETE · SERVER INTELLIGENCE DELIVERED]
* **Scope**:
  - **Provider-Neutral Intelligence Boundary (Sami Primary)**:
    - Decoupled routine generation behind the `RoutineIntelligenceProvider` interface (`providerId`, `generateProposal(context)`).
    - Production AI model/provider selection is explicitly OPEN / DEFERRED (`ARCHITECTURE_CHALLENGE-05`). Swapping providers requires a thin adapter, not a pipeline refactor.
  - **Defect Closure (Zero Client-Side Provider Selection)**:
    - `x-routine-fixture` header completely eliminated from CORS, request parsing, and routing. Client requests can never select a provider or force fixture mode.
  - **Server-Side Runtime Provider Configuration**:
    - Provider selection governed strictly via server-side configuration: `ROUTINE_MODEL_PROVIDER` process env or secure `public.server_runtime_config` table restricted to `service_role`.
    - Fails closed with HTTP 503 `MODEL_UNAVAILABLE` when no provider is configured (zero hardcoded branded fallback).
  - **Deterministic Test Isolation**:
    - `FixtureRoutineProvider` isolated under server-only configuration for CI and local E2E.
  - **Optional Gemini Evaluation Adapter**:
    - `GeminiRoutineProvider` adapter requires header authentication (`x-goog-api-key`, zero API key leakage in URL query parameters) and conforms to canonical domain response types.
  - **Canonical Domain Enum Hardening**:
    - Enforced exact match with `src/types/schema.ts` in `context.ts` (`ALLOWED_PRIMARY_GOALS`, `ALLOWED_COMPLEXITY`, `ALLOWED_COST`, `ALLOWED_MIDDAY_FEEL`, `ALLOWED_PREGNANCY_STATUS`, `ALLOWED_SENSITIVITIES_STATUS`).
    - Added secondary goals validation and non-empty brand/name validation for confirmed shelf items. Fails closed with `400 INTAKE_CONTEXT_INVALID` without default fabrication.
  - **Catalog Provenance Invariants**:
    - Additive migration `20260919020000_i1_b2_catalog_provenance_and_confirmation_preservation.sql`: `commit_routine_proposal` RPC protects trusted products (`is_catalog_standard = true`) from metadata overwrites; defaults new proposed products to `is_catalog_standard = false` with empty formula fields.
    - Post-model sensitivity evaluation (`validateSensitivities`): if member reported sensitivities, recommendations with unverified formulas fail closed with `VALIDATION_FAILED`; trusted products containing known allergens fail closed.
  - **Confirmation Provenance Invariants**:
    - `is_confirmed_by_user` semantics: denotes member confirmed having the product in inventory, NOT member approval of an AI action. Existing shelf items retain `true` across actions (`KEEP`, `PAUSE`, `REPLACE`, `STOP`); new proposed `ADD` items are `false`. Persistence never downgrades `true` to `false`.
* **Acceptance Criteria**:
  - 100% test suite passing (119/119 tests in `tests/derive.test.ts`).
  - 100% pgTAP test suite passing (119/119 assertions in `supabase/tests/**`).
  - 100% local E2E test harness passing (8/8 stages in `scripts/test-i1-b2-local.mjs` including 5A client fixture rejection and 5B server-configured fixture proposal).
  - Strict application TypeScript check: 0 errors (`npx tsc --noEmit`).
  - Strict test TypeScript check: 0 errors (`npm run typecheck:tests`).
  - Clean Expo web production export (`EXPO_NO_TELEMETRY=1 npx expo export -p web`).
  - `eas.json` strictly preserves `EXPO_PUBLIC_USE_REMOTE_SERVICE: "false"`.

### I1-B2.3: Final Server Boundary Cleanup [COMPLETE · B2 SERVER LANE CLOSED]
* **Scope**:
  - **Removal of Filesystem Fallback**:
    - Eliminated `.server-provider-config`, founder-machine `/Users/` paths, and `Deno.readTextFile` lookups from `supabase/functions/propose-routine/provider.ts` and test harnesses.
    - Server provider resolution is strictly bounded to `ROUTINE_MODEL_PROVIDER` process env or `public.server_runtime_config` table (service-role only).
  - **Restoration of RPC Least Privilege**:
    - Additive migration `20260919030000_i1_b2_restore_rpc_security_invoker_and_catalog_protection.sql` restored `public.commit_routine_proposal` to `SECURITY INVOKER` with `set search_path = ''` and fully-qualified schema references.
    - Removed deprecated `auth.role()` check while maintaining explicit ACL: EXECUTE granted strictly to `service_role`; revoked from `PUBLIC`, `anon`, and `authenticated`.
  - **Provisional Catalog Formula Protection**:
    - Model outputs cannot promote hallucinated `key_actives`, `full_ingredients`, or `retail_price_approx` into provisional (`is_catalog_standard = false`) products, preventing accumulation of hallucinated formula facts across subsequent proposals.
    - Trusted catalog standard products (`is_catalog_standard = true`) remain immutable to provider metadata.
  - **Fail-Closed Confirmation Mapping**:
    - `RemoteDeriveService.getUserProducts` maps null/unknown `is_confirmed_by_user` strictly to `false` (`=== true`), eliminating fabricated confirmation.
* **Acceptance Criteria**:
  - 100% test suite passing (122/122 tests in `tests/derive.test.ts`).
  - 100% pgTAP test suite passing (126/126 assertions in `supabase/tests/**`).
  - 100% local E2E test harness passing (`scripts/test-i1-b1-local.mjs` and `scripts/test-i1-b2-local.mjs`).
  - Strict application TypeScript check: 0 errors (`npx tsc --noEmit`).
  - Strict test TypeScript check: 0 errors (`npm run typecheck:tests`).
  - Clean Expo web production export (`EXPO_NO_TELEMETRY=1 npx expo export -p web`).
  - `eas.json` strictly preserves `EXPO_PUBLIC_USE_REMOTE_SERVICE: "false"`.
  - Kanuj's provider-independent mobile integration is unblocked.

### I1-B3: Provider-Independent Initial Routine Mobile Integration [COMPLETE]
* **Scope**:
  - Connect mobile application to consume real B2 initial routine state through shared service boundary.
  - Shared contract updates: added `getUserProducts(userId: string): Promise<UserProduct[]>` and optional `proposeRoutine(input?: RoutineProposalInput)` to `IDeriveService`.
  - Service parity: implemented `getUserProducts` and optional `proposeRoutine` in `MockDeriveService` and `RemoteDeriveService`.
  - Routine store state lifecycle: added `isRoutineBeingPrepared`, `planHydrationStatus` (`'idle' | 'loading' | 'ready' | 'error'`), `planHydrationAttempt`, `planHydrationError`, `startPlanHydration()`, `setPlanHydrating()`, `setPlanHydrated()`, `setPlanHydrationError()`, and monotonic `resetRoutine()`.
  - Coordinator functions in `deriveClient.ts`:
    - `hydratePlanState(userId?)`: concurrently queries `getRoutine` and `getUserProducts`, performs remote identity and attempt freshness checks, derives `isRoutineBeingPrepared` when onboarding is complete and routine is null, and commits atomically.
    - `ensureInitialRoutineProposal(userId?)`: checks existing routine and preparation status, invokes `service.proposeRoutine()`, deduplicates in-flight calls, shields technical errors with customer-safe copy, and preserves pending state on failure for retry.
    - In-flight request deduplication via module-scoped maps (`inFlightHydrations`, `inFlightProposals`).
    - Purged in-flight maps on session reset in `sessionReset.ts`.
  - Onboarding summary flow (`10-summary.tsx`): kicks off `ensureInitialRoutineProposal` in background upon verified onboarding completion.
  - Consumer screens (`Today` and `Plan`):
    - Consume `isRoutineBeingPrepared` to render calm preparation UI ("Your routine is being prepared", "Initial Routine Setup", "Preparing your routine").
    - Hide "Start Routine Setup" and refill CTAs when routine preparation is pending.
    - Provide empathetic retry affordance ("Try Again") upon generation error.
    - Project canonical draft awaiting review state (`DRAFT · NOT ACTIVE`) and real `UserProduct[]` with action badges (`KEEP`, `PAUSE`, `REPLACE`, `ADD`, `STOP`) when proposal arrives.
  - Zero provider leakage: client remains 100% provider-independent (zero references to Gemini, OpenAI, Claude, `ROUTINE_MODEL_PROVIDER`).
* **Acceptance Criteria**:
  - 100% test suite passing (131/131 tests in `tests/derive.test.ts`).
  - 100% pgTAP test suite passing (126/126 assertions in `supabase/tests/**`).
  - 100% local E2E test harness passing (`scripts/test-i1-b1-local.mjs` and `scripts/test-i1-b2-local.mjs`).
  - Strict application TypeScript check: 0 errors (`npx tsc --noEmit`).
  - Strict test TypeScript check: 0 errors (`npm run typecheck:tests`).
  - Clean Expo web production export (`EXPO_NO_TELEMETRY=1 npx expo export -p web`).
  - `eas.json` strictly preserves `EXPO_PUBLIC_USE_REMOTE_SERVICE: "false"`.

### I1-B3.1: Client Hardening — Cold-Restart Hydration, Read-Failure Generation Guard, Promise-Identity In-Flight Cleanup [COMPLETE]
* **Scope**:
  - Cold Remote restart: authenticated + bootstrap `READY` + `onboardingCompleted === true` + failed plan read preserves `routine = null`, `isRoutineBeingPrepared = true`, `isPlanUnderReview = false`, `planHydrationStatus = 'error'`, customer-safe `planHydrationError`. Onboarded members do not fall into "Start Routine Setup" empty-state.
  - Read failure must not call `proposeRoutine()`. Retry with `planHydrationStatus === 'error'` re-runs hydration first even if `isRoutineBeingPrepared` is already true. Proposal runs only after successful hydration proves `routine === null` and pending-generation is still true.
  - In-flight maps use per-request ownership tokens so an older request's `finally` cannot delete a newer same-user hydration or proposal. `hydratePlanState` returns the map Promise directly (not an extra `async` wrapper) so same-user joins keep Promise identity.
  - Legacy `hydrateRoutine()` is a compatibility wrapper over `hydratePlanState()` and hydrates Routine + `UserProduct[]` atomically.
* **Acceptance Criteria**:
  - Section 36 in `tests/derive.test.ts` covers cold-restart error, no false generation, retry-then-propose, genuine in-flight races, atomic `hydrateRoutine`, awaiting_review, published, provider neutrality, and session reset.
  - Unit tests, app/test typecheck, and Expo web export remain green. Backend schema unchanged.
  - `eas.json` Remote flag remains `false`.

### I1-B4: Membership, Commerce & Check-In Context Model Reconciliation [COMPLETE]
* **Implemented in I1-B4A**:
  - Founding Beta membership display is **$25/month** (`config.betaPriceMonthly`). Membership pays for Derive managing skincare. Products are purchased separately. Membership price does not depend on routine size or product cost.
  - Canonical identity `founding_beta` via additive migration `20260919075053_i1_b4_membership_identity_reconciliation.sql` (legacy `founding_beta_129` backfilled; unknown tiers fail closed). `src/pricing/**` all-in engine removed.
  - Onboarding, Profile, Orders, and Refill copy state products are separate. ADR-26 implemented. ARCHITECTURE_CHALLENGE-01 resolved. Remote mapper accepts `founding_beta`.
* **Implemented in I1-B4B**:
  - Optional multi-select `CheckInContextTag` + one optional context note every weekly check-in. Tags are context, not causation. `cycle` is not a period tracker. Medication/supplement context does not alter prescriptions.
  - Additive `check_ins` migration, real `submit-checkin` Edge Function, RLS-backed Remote progress reads (no phantom `get-progress`). Learned insights remain empty in Remote until S3 durable insight persistence. **S4 is complete on `main`.** Next remaining platform/commerce work is **S5**. C1 Shop is not started.
* **Approved product truth**:
  - Do **not** frame as "$25 for AI". $25 is a current Founding Beta experiment, not a lifetime company price.
  - Commercial-independence invariant: margin, affiliate, sponsorship, and coupons must never silently alter KEEP / PAUSE / REPLACE / ADD, Scan, safety, or ranking. New SKU charges require explicit consent; same-SKU refills may stay low-friction.
  - Five-tab IA preserved. Full Shop deferred. Stripe billing deferred to S5.
* **B4A — Membership & Product Commerce Model Reconciliation** [COMPLETE]
* **B4B — Weekly Check-In Context Model & Persistence** [COMPLETE]
* **Not in B4**: Shop tab, Stripe checkout amounts, coupons, affiliates, food diary, period tracker, membership tiers, provider selection.

## Sami Workstream (Platform + Intelligence + Operations)

### S1: Platform Foundation [COMPLETE]
* **Scope**: Supabase setup, baseline PostgreSQL schema, reproducible migration scripts, customer authentication, private photo storage buckets, Row-Level Security (RLS) policies, and secure environment secrets management.
* **Implemented**:
  - Committed local Supabase configuration and an additive migration chain.
  - Auth-user profile provisioning with a hardened trigger and backfill.
  - Explicit grants plus operation-specific RLS on every existing public application table.
  - Private `customer-skin-photos` bucket, member-ID path isolation, immutable uploads, and no client download/list/sign/update/delete permission.
  - pgTAP coverage for exact policy/grant shape, auth provisioning and synchronization, anonymous denial, owner/cross-owner access, server-owned fields, and private Storage policy behavior.
  - Explicit safe-column projections in the Sami-owned remote adapter, avoiding wildcard expansion across protected membership and routine fields.
  - Official Docker-backed `supabase db reset`, pgTAP, and API-level integration verification in local development and CI.
  - Persistent Expo Auth sessions with app-lifecycle token refresh and authenticated route gating.
  - Canonical non-upserting client photo upload helper restricted to server-issued member-owned paths; the obsolete arbitrary/upserting helper was removed.
  - JWT-gated `photo-url` Edge Function that derives the caller from `auth.getUser()`, verifies the caller-owned photo metadata/path, and issues an exact 900-second signed URL with `Cache-Control: private, no-store`.
  - JWT-gated `delete-customer-account` Edge Function that requires exact destructive confirmation, rejects caller-supplied identity, inventories and deletes the caller's complete Storage namespace first, verifies it is empty, and deletes the Auth user last.
  - Fail-closed public mobile environment validation with a canonical Supabase publishable-key contract and a documented separation between public Expo values, local CLI values, CI secrets, and trusted server-only secrets.
* **Boundary After S1**:
  - The production Remote service flag remains `false`. Remote row-to-domain mapping, routine-item assembly, model execution, normalized reaction/formula persistence, and commerce belong to I1-B2/S2/S3/S5 and do not reopen S1.
  - `ARCHITECTURE_CHALLENGE-01` remains unresolved; S1 does not encode a new price or change Kanuj-owned UI.
* **Acceptance Criteria**:
  - [x] Migrations run cleanly from a fresh Supabase database.
  - [x] RLS strictly isolates member data: customer can only read/write their own records.
  - [x] Customer skin photos are accessible solely through short-lived signed URLs; no public URL path exists.
  - [x] Account deletion removes private Storage objects before relational/auth deletion.
  - [x] Zero secrets are committed to version control; public and trusted-runtime environment boundaries are explicit.

### S2: Core Domain Persistence [COMPLETE]
* **Scope**: Relational tables and queries for customer profiles, skin profiles, catalog products, formula snapshots, product reactions, ingredient signals, routine versions, weekly check-ins, photo records, and refill orders.
* **Implemented**:
  - Audited and extended the existing baseline through one additive migration; no baseline table was recreated or rewritten.
  - Added immutable, owner-isolated `formula_snapshots`, `product_reactions`, and versioned `ingredient_signals` history. `record_product_reaction` atomically captures the exact formula and reaction in one server-only transaction.
  - Added `routines.updated_at`, `routine_items.product_id`, unique `(user_id, version)` routine identity, immutable routine content/steps, and the concurrency-safe server-only `create_routine_version` append operation.
  - Enriched existing check-ins, private photo metadata, catalog products, and refill requests with the canonical fields required by current shared domain types while preserving legacy rows and the sealed onboarding flow.
  - Implemented full `RemoteDeriveService.getRoutine()` header/step assembly, deterministic schedule text derivation, snake_case refill mapping, and direct RLS-protected refill persistence.
  - Added pgTAP, unit, local API integration, migration-reset, schema-lint, and S1 onboarding-regression coverage. The API integration creates a fresh authenticated client after writes and verifies canonical state reconstructs correctly.
* **Boundaries**:
  - Zero Kanuj-owned UI changes; `EXPO_PUBLIC_USE_REMOTE_SERVICE` remains `false`.
  - S2 creates persistence and mapping substrate only. Gemini generation, signal inference, progress synthesis, and safety-classifier execution remain S3/I1-B2 work.
  - `ARCHITECTURE_CHALLENGE-01` remains unresolved. No new price, tier, Stripe, or membership semantics were encoded.
* **Acceptance Criteria**:
  - [x] Canonical state persists reliably across app restarts.
  - [x] Routine updates create new version snapshots rather than overwriting historical records.
  - [x] Product reactions persist historical formula snapshots at the exact time of the reaction.

### S3: Server-Side Intelligence Services [COMPLETE]
* **Scope**: Edge Functions for routine proposal generation, product scan evaluation with categorical verdicts, Ask Derive conversation synthesis, safety classifier circuit breaker, and probabilistic ingredient signal inference.
* **Implemented**:
  - Added JWT-gated `propose-routine`, `scan-product`, `ask-derive`, and `infer-ingredient-signals` Edge Functions. Handler identity is derived from the verified token; caller-supplied profile truth and spoofed member IDs are rejected or ignored.
  - Added trusted server context assembly across committed intake, canonical safety states, prescriptions, latest routine and shelf, immutable formula/reaction history, latest ingredient signals, recent check-ins, and private-photo metadata only. Storage paths and customer images are not sent to Gemini in S3.
  - Preserved provider-neutral routine generation with server-only provider selection and a deterministic CI fixture. Added guarded server-side Gemini structured-output orchestration for scan and Ask with explicit JSON schemas, parsing, post-model safety validation, timeouts, and sanitized fail-closed errors. No model credential enters the Expo bundle.
  - Added pre-model emergency and barrier-warning circuit breakers. Emergency Ask requests never reach the model and create privacy-minimized urgent founder tasks without storing the customer transcript.
  - Reused the canonical B2 transaction for awaiting-review routine versions and shelf actions. Added service-only historical product identity resolution, idempotent sealed-intake reaction normalization, and immutable ingredient-signal versions without creating a competing routine RPC or treating unverified formulas as catalog truth.
  - Hardened ingredient inference so repeated incidents from one bottle cannot mimic multi-product overlap; tolerated exposures discount naive suspicion; inference never auto-creates a confirmed allergy.
* **Boundaries**:
  - No Kanuj-owned UI or shared domain/service contracts changed. Typed `RemoteDeriveService` endpoint adapters exist, but Remote mode remains disabled; full mobile lifecycle activation remains S5/I1.
  - Production Remote mode remains `false`. No hosted deployment, Gemini secret, Stripe, pricing, or PostHog SDK is introduced.
* **Acceptance Criteria**:
  - [x] Edge Function endpoints validate and return the existing `IDeriveService` shared contract shapes without changing those contracts.
  - [x] Prompt context includes the member's active prescriptions, Differin/routine schedule, and reaction history.
  - [x] All mandatory emergency/red-flag fixtures hard-stop before model use; uncertain safety states fail conservatively.
  - [x] Ingredient signals update confidence using distinct multi-product overlap and tolerated-exposure discounting.
  - [x] Unknown/withheld pregnancy status fails closed for pregnancy-excluded actives, and recognized prescription schedules are preserved exactly or require clarification.

### S4: Founder Operations Console [COMPLETE]
* **Scope**: Lightweight internal administrative portal (`admin/**`) for managing the initial 10 Founding Beta members. After I1-B4A, customer-facing membership truth is the $25/month Derive-management experiment with products purchased separately; S4 itself remains founder review/edit/publish of routines, refill status, formula audit, and internal notes. Do not treat full Shop as an S4 acceptance criterion.
* **Implemented**: Founder-only `admin/**` console, JWT-gated `founder-operations`, allowlisted `founder_accounts`, immutable routine review/publish, refill transitions, formula verification, safety queue, internal notes, and append-only audit. Landed on shared `main` via cumulative PR #16.
* **Acceptance Criteria**:
  - Founders can review, edit, and publish routine proposals before member notification.
  - Refill orders can be transitioned (`requested` → `ordered` → `shipped` → `delivered`) with carrier tracking numbers.
  - Safety escalation flags appear in an urgent review queue.

### S5: Membership Billing Integration [IMPLEMENTED; HOSTED ACTIVATION PENDING]
* **Status**: Membership billing implementation merged on `main` through PR #18. Hosted Stripe/Supabase activation smoke remains pending. Production Remote mode remains disabled.
* **Scope**: Trusted Stripe-hosted Founding Beta membership Checkout and Billing Portal, signed webhook lifecycle projection, and `RemoteDeriveService` hosted-session adapters. The server-configured Stripe Price owns the charge; `config.betaPriceMonthly` is display only. Products remain separate purchases.
* **Acceptance Criteria**:
  - [x] Checkout and Portal derive member identity from the authenticated session; callers cannot choose a customer, Price, or amount.
  - [x] Signed webhook uses the raw body, current Stripe subscription truth, a service-only idempotent ledger, and fail-closed identity reconciliation.
  - [x] `HostedMembershipSession`, `createMembershipCheckout`, and `createMembershipPortal` remain membership-specific shared contracts.
  - [x] Stripe secrets, webhook secret, and service-role credential remain server-side.
  - [x] Product SKU checkout, ProductOffer, cart, and physical orders are outside S5.
  - [ ] Run hosted test-mode Checkout to signed webhook to membership state to Billing Portal smoke before claiming billing is live.

### S6: Visual Product Identity & Formula Resolution [BACKEND RESOLVER IMPLEMENTED]
* **Owner**: Sami / backend-platform. The S6 backend is additive and does not modify C1.5A commerce or Kanuj mobile UI.
* **Goal**: Interactive product resolution in seconds when evidence suffices, including products without visible barcode, unknown catalog items, unfamiliar packaging, changed packaging and ingredient-list photos. Manual review is an edge-case fallback; no fixed SLA is promised before measurement.
* **Shared resolver**: One future Product Identity Resolver serves both Scan and onboarding Shelf. Camera/user evidence flows through extraction, candidate retrieval, identity resolution, formula verification, user confirmation when needed, then personalized Scan evaluation. Barcode/GTIN, front-label OCR, brand/name/variant, packaging image, ingredient OCR, user text, catalog, merchant listing identity and authoritative external product sources are candidate evidence. Verified product/variant identity and FormulaSnapshot linkage may later support Shop listing activation. Merchant economics never affect identity or skincare verdicts.
* **Trust states**: The stable contract now names `verified_product_formula`, `identified_formula_unverified`, `ambiguous_candidates`, `formula_only`, and `insufficient_evidence`. Model resemblance generates candidates, not verified product truth. Ask for the ingredient photo or variant confirmation when needed. Formula-version provenance accounts for reformulations, region, and old packaging.
* **Pre-S6 gap retained for context**: Client barcode lookup existed; `ScanProductInput.imageUri` did not resolve visual identity; production Shelf recognition returned no products. Demo fixtures remain non-authoritative.
* **Delivered backend**: `resolve-product-identity` accepts validated barcode, typed, label, packaging, ingredient and private-photo evidence for either consumer. It returns the five explicit trust states, preserves candidates and provenance, creates audited founder review work when unresolved, and lets `scan-product` consume only an owner-bound verified case through optional `resolutionCaseId`.
* **Remaining handoffs**: Kanuj-owned capture/confirmation UI has not been changed. Live photo/OCR extraction is provider-dependent H1P work; stored photos without trusted extracted evidence correctly remain unresolved rather than producing invented identity.

---

## Kanuj Commerce Stream (Shop & Customer Acquisition)

### C1: Shop V1 Personalized Commerce UX [IMPLEMENTED]
* **Scope**: Five member root tabs (`Today · Plan · Shop · Ask · Progress`) with one Scan implementation inside Shop. A canonical product detail route uses member context only. Shop, Today, and Plan commerce entry points require active membership; ADD acquisition and managed refills require a published routine.
* **Acceptance Criteria**:
  - [x] Shop replaces Scan as a root tab; legacy and Ask Scan links reach `/shop/scan`.
  - [x] Shop, product detail, Today, and Plan use the same Mock-versus-Remote audience resolution.
  - [x] Inactive audiences see no member product detail, personalized Scan, or Shop acquisition links.
  - [x] No fabricated public catalog, physical offer, price, discount, or checkout is shown.
  - [x] Mock Scan-to-Ask preserves the scanned verdict.
  - [x] Recommendation and safety decisions remain independent of commercial inputs.
  - [x] C1 adds no backend migration or physical-commerce shared contract.

### C1.1: Shop and Scan Experience Hardening [IMPLEMENTED]
* **Scope**: Make Scan a visible one-tap utility from the active-member Today
  and Shop headers while keeping one `/shop/scan` implementation and five root
  tabs. Clarify Shop state and product-detail presentation without physical
  commerce or public Scan.
* **Acceptance**:
  - [x] Today and Shop header actions reach the canonical scanner; Ask shortcut
    remains direct.
  - [x] Scan result prioritizes identity and categorical verdict, then reason,
    member facts, formula facts, and next actions. Unknown search and repeated
    Scan remain direct.
  - [x] Shop distinguishes loading, error, preparation, review, needs,
    covered, and empty from canonical plan hydration. Product detail has a
    presentation-only future-offer seam and preserves action semantics.
  - [x] Invalid runtime verdicts show a truthful retry state without a crash
    or invented fit label. Stale pre-E1 inactive Shop comment corrected.
  - [x] 245 unit tests, both TypeScript checks, web export, and phone review
    passed.
* **Non-overlap**: No H1, Sami backend, Stripe, SMTP, membership, shared contract,
  ProductOffer, physical checkout, or app-wide UI cleanup.

### E1: Membership Entitlements and Checkout UX [IMPLEMENTED LOCALLY; HOSTED ACTIVATION PENDING]
* **Scope**: Sign in, activate the Founding Beta membership through S5 Checkout, then onboard. Canonical active membership gates the managed app; profile readiness is a separate dimension. Paused, cancelled, and not-yet-active accounts receive one Membership screen with trusted Checkout or Portal links where S5 supports them.
* **Acceptance**:
  - [x] Root and direct routes enforce member access, while Mock mode remains billing-free.
  - [x] Checkout, Portal return, foreground, and explicit retry refresh backend membership truth; a Checkout success URL never grants access.
  - [x] Downgrades clear local paid projections while preserving Auth identity and owner-readable history.
  - [x] Edge functions and RLS require active membership for paid onboarding, model operations, Check-In, refills, and new private photo writes.
  - [x] Local unit, pgTAP, OTP, E1 lifecycle, and S1-S5 integration tests cover the boundary.
  - [ ] Configure and smoke the hosted six-digit OTP template, Supabase functions/migrations, Gemini secret, and test-mode Stripe Checkout to signed webhook to Portal lifecycle before enabling production Remote mode.

### C1.5A: Multi-Merchant Acquisition Foundation [LANDED]
* **Scope**: Shop-owned exact identity resolver, merchant/listing/optional offer presentation and member Where to Buy UI. The production listing registry is empty until merchant destination, product variant and formula equivalence can be supported. The reviewed Ulta listing remains a test-only fixture. Product/recommendation truth remains upstream; provisional products and unpublished ADD fail closed. No backend migration, live price, checkout or public routing.

### C1.5B: Official Retailer Feeds, Live Offers & Attribution [PARKED]
* **Scope**: Verify official merchant APIs/feeds or approved networks, establish merchant product identity and listing verification, then ingest live prices, availability, identifiers, freshness and approved affiliate attribution with provenance. S6 may supply stronger product/variant/formula evidence, but price, availability and commission never decide product truth or recommendations. HTML scraping is not the core data source. No C1.5B code in A.

### C1.5C: Derive Shopify Merchant & Integrated Checkout [PARKED]
* **Scope**: Derive becomes a first-class merchant through Shopify product/variant mapping, real offer, inventory, cart/checkout, physical orders, fulfillment, returns and member benefits. External alternatives stay visible. No C1.5C code in A. Public catalog/Shop and factual non-member Scan each need independent routing, data and authorization gates.

### C2: Personalized Discovery & Cart [DEFERRED]
* **Scope**: Search, categories, alternatives, and multi-item cart only after customer evidence supports them.


---

## Historical integration objective (not an active implementation milestone)

### I1: Mock → Remote DeriveService Integration
* **Historical scope**: Earlier end-to-end integration objective. Current ownership and acceptance are H1, F1, L1 and L2 above. The earlier test described:
  Onboarding → Profile → Routine Generation → Founder Review & Approval → Today Display → Shelf Audit → Product Scan → Ask Context → Weekly Check-In → Refill Request → Tracking.
* **Acceptance Criteria**:
  - Kanuj switches `EXPO_PUBLIC_USE_REMOTE_SERVICE=true` without changing UI code.
  - All flows execute flawlessly end-to-end.
