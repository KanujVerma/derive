# Derive Interface & Service Contracts

This document formalizes the runtime interface contracts between the client application (Kanuj) and the backend intelligence platform (Sami).

Code definitions:
- Interface definition: [`src/contracts/DeriveService.ts`](../src/contracts/DeriveService.ts)
- Shared domain types: [`src/domain/types.ts`](../src/domain/types.ts)
- Implementation mock: [`src/services/mock/MockDeriveService.ts`](../src/services/mock/MockDeriveService.ts)
- Implementation remote: [`src/services/remote/RemoteDeriveService.ts`](../src/services/remote/RemoteDeriveService.ts)

---

## 1. Core Service Interface (`IDeriveService`)

```typescript
export interface IDeriveService {
  onboard(payload: OnboardingPayload): Promise<OnboardingResult>;
  proposeRoutine(input: RoutineProposalInput): Promise<RoutineProposalResult>;
  askDerive(request: AskRequest): Promise<AskResponse>;
  scanProduct(input: ScanProductInput): Promise<ProductScanResult>;
  submitCheckIn(input: CheckInInput): Promise<CheckInResult>;
  getProgress(userId: string): Promise<ProgressData>;
  requestRefill(input: RefillRequestInput): Promise<RefillRequest>;
  getOrders(userId: string): Promise<RefillRequest[]>;
  getResearchInsights(userId: string): Promise<ResearchInsight[]>;
  getRoutine(userId: string): Promise<RoutinePlan | null>;
  getCustomerProfile(userId: string): Promise<CustomerProfile | null>;
  getCustomerBootstrapState(userId: string): Promise<CustomerBootstrapState>;
}
```

---

## 2. Request & Response Specifications

### `onboard(payload: OnboardingPayload)`
* **Input**:
  - `primaryGoal`: Goal
  - `secondaryGoals`: Goal[]
  - `routineComplexity`: RoutineComplexity (`simple` | `balanced` | `maximize`)
  - `costPreference`: ProductCostPreference (`value` | `balanced` | `premium`)
  - `middayFeel`: MiddayFeel
  - `postCleanseTightness`: boolean
  - `confirmedProducts`: Product[]
  - `productReactions`: ProductReaction[]
  - `formulaSnapshots`?: FormulaSnapshot[]
  - `adaptiveFollowUps`?: Array<{ question: string; answer?: string }>
  - `pihTendencyAnswer`?: 'Rarely' | 'Sometimes' | 'Often' | 'Not sure' | null
  - `hasBadReactions`?: boolean | null
  - `skinPhotos`:
    - `frontUri`?: string
    - `leftUri`?: string
    - `rightUri`?: string
    - `shelfUri`?: string
    - `contextNote`?: string
  - `safetyContext`:
    - `knownSensitivities`: string[]
    - `sensitivitiesStatus`: `SensitivitiesStatus` (`'none_known'` | `'reported'` | `'unanswered'`)
    - `activePrescriptions`: string[]
    - `isPregnantOrNursing`: boolean
    - `pregnancyStatus`: `PregnancyStatus` (`'yes'` | `'no'` | `'prefer_not_to_say'` | `'unanswered'`)
    - `additionalNotes`?: string
* **Builder**: `buildOnboardingPayload(snapshot, userId?, overrideRemote?)` (`src/services/deriveClient.ts`) creates the canonical payload while enforcing non-mock identity in Remote mode.
* **Output**: `OnboardingResult`:
  - `userId`: string
  - `skinProfile`: `SkinProfile`
  - `proposedRoutine`: `Routine | null` (null when routine proposal is deferred to async founder review / generation)
  - `userProducts`: `UserProduct[]`
  - `initialRoutineState`: `InitialRoutineState` (`'pending_generation'` | `'awaiting_review'`)

### `proposeRoutine(input: RoutineProposalInput)`
* **Current Shared Contract (`src/domain/types.ts`)**:
  - `input`: `RoutineProposalInput`:
    - `profile`:
      - `primaryGoal`: Goal
      - `secondaryGoals`?: Goal[]
      - `routineComplexity`: RoutineComplexity (`'simple'` | `'balanced'` | `'maximize'`)
      - `costPreference`?: ProductCostPreference
      - `middayFeel`?: MiddayFeel
      - `postCleanseTightness`?: boolean
      - `activePrescriptions`?: string[]
      - `isPregnantOrNursing`?: boolean
    - `shelfProducts`: Product[]
    - `reactions`?: ProductReaction[]
  - *Note*: The current TypeScript `RoutineProposalInput.profile` does NOT contain `pregnancyStatus` or `sensitivitiesStatus`. If B2 requires these fields directly on the input contract, that is a future coordinated shared-contract change requiring mutual founder review.
* **B2 Richer Context Available Server-Side**:
  - Server-side context assembly reads richer canonical safety and history signals directly from the database:
    - `public.skin_profiles`: `primary_goal`, `secondary_goals`, `routine_complexity`, `cost_preference`, `midday_feel`, `post_cleanse_tightness`, `known_sensitivities`, `sensitivities_status`, `active_prescriptions`, `is_pregnant_or_nursing`, `pregnancy_status`. *(Note: `skin_profiles` does NOT have a `pih_tendency` column).*
    - `public.onboarding_submissions.payload_snapshot` JSONB: full raw intake snapshot, including `confirmedProducts`, `productReactions`, `formulaSnapshots`, `adaptiveFollowUps`, `pihTendencyAnswer` (PIH tendency is durably read from here), `hasBadReactions`, photo context notes, and canonical Storage paths.
    - `public.user_photos`: baseline photo metadata (angles: `front`, `left`, `right`).
* **Output Contract (`RoutineProposalResult` in `src/domain/types.ts`)**:
  - `routine`: `Routine` (`id`, `userId`, `version`, `status: 'awaiting_review'`, `summarySentence`, `amSteps`, `pmSteps`, `createdAt`, `updatedAt`, `publishedAt?`, `founderNotes?`).
    - *Contract Truth*: `Routine` has NO `rationales` property. Step-level personalized rationale is captured on individual `RoutineStep` items via `whyChosen`, `purpose`, `watchFor?`, and optional `scheduleText?`.
  - `userProducts`: `UserProduct[]` (with actions: `'KEEP'` | `'PAUSE'` | `'REPLACE'` | `'ADD'` | `'STOP'`).
  - `clarificationQuestions`?: string[]
* **Lifecycle State & Durability Truth**:
  - `InitialRoutineState` (`'pending_generation'` | `'awaiting_review'`) is a shared domain type returned via `OnboardingResult`. There is NO persisted `initial_routine_state` column in PostgreSQL today.
  - Before proposal: no canonical routine row exists in `public.routines` $\to$ client conceptual state is `pending_generation` (`routine: null`, `isPlanUnderReview: false`, "Your routine is being prepared.").
  - After proposal persistence: routine is persisted in `public.routines` with `status = 'awaiting_review'` $\to$ client derives `awaiting_review` (`isPlanUnderReview: true`, "Final review: Your first routine gets one final quality check before it goes live.").
  - If a dedicated persisted lifecycle column or API is deemed necessary, that is a future shared architecture decision, not assumed current implementation.
* **B2 Delivered Schema & Mapping Reconciliations (Sami B2 Implementation)**:
  1. **`public.routines.updated_at` Reconciliation [DELIVERED]**:
     - Added `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` to `public.routines` via migration `20260919010000_i1_b2_routine_intelligence_and_persistence.sql`.
     - Wired to `routines_set_updated_at` trigger calling `private.set_updated_at()`.
     - Granted `SELECT (updated_at)` on `public.routines` to `authenticated` while retaining `founder_notes` as founder-only.
  2. **`public.routine_items.product_id` Reconciliation [DELIVERED]**:
     - Added `product_id UUID REFERENCES public.products(id) ON DELETE RESTRICT` to `public.routine_items`.
     - Transactional RPC `commit_routine_proposal` resolves or upserts canonical products and populates `product_id`.
  3. **`RoutineStep.scheduleText` Derivability [DELIVERED]**:
     - Derived deterministically during read assembly from `timing` + `days` using `formatRoutineStepSchedule` from `src/types/schema.ts` without database bloat.
  4. **`UserProduct.product` Reconstruction Invariant [DELIVERED]**:
     - All B2-decided products are normalized and upserted into `public.products`.
     - `public.user_products.product_id` references the normalized catalog row, and a unique constraint `user_products_user_product_idx` prevents duplicate user-product pairs.
     - `RemoteDeriveService.getUserProducts()` executes `user_products JOIN products` to hydrate full canonical `UserProduct` objects with nested `Product`.
  5. **Remote Routine Read Assembly [DELIVERED]**:
     - `RemoteDeriveService.getRoutine(userId)` reads `routines` + `routine_items` (ordered by `order_index`), maps headers and steps, partitions into `amSteps` and `pmSteps`, derives `scheduleText`, and returns typed `RoutinePlan`.
     - Kanuj's `hydrateRoutine()` in `src/services/deriveClient.ts` cleanly hydrates this structure into `routineStore`.

### `scanProduct(input: ScanProductInput)`
* **Input**: `productName`, `brand`, optional `imageUri`, `userRoutineContext`.
* **Output**: `ProductScanResult`:
  - `productName`: string
  - `brand`: string
  - `category`: `ProductCategory`
  - `keyActives`: string[]
  - `verdict`: `great_fit` | `could_work` | `fits_plan` | `not_needed` | `better_replacement` | `use_with_caution` | `not_good_fit`
  - `verdictLabel`?: string (e.g. `'BETTER AS A REPLACEMENT'`)
  - `verdictSummary`: string
  - `reason`?: One-sentence core rationale
  - `whatItWouldChangeOrReplace`?: Explicit routine impact
  - `factsUsedToDecide`: string[]
  - `whyBullets`?: 2–3 factual, user-specific explanation bullets

### `askDerive(request: AskRequest)`
* **Input**: `userId`, `question`, optional `activeContext` (`scannedProduct: ProductScanResult`, `currentStepId`, `photoAttachmentUri`).
  - *Context Resolution*: Pure helper `resolveAskServiceContext` (`src/utils/scanContext.ts`) extracts the full typed `ProductScanResult` from `useScanContextStore`. Lightweight route params are used exclusively by `resolveAskDisplayBanner` for UI display continuity and are never synthesized into artificial `ProductScanResult` records.
* **Output**: `AskResponse`:
  - `directAnswer`: 1 concise sentence answering the core question
  - `whyExplanation`: Grounded clinical/routine reasoning
  - `recommendedAction`: Next step for the user
  - `safety`: `SafetyClassification`

---

## 3. Safety & Escalation Model

Derive enforces an unskippable safety circuit breaker on all queries:

```typescript
export interface SafetyClassification {
  isMedicalEmergency: boolean;
  severity: 'safe' | 'warning' | 'emergency';
  message?: string;
  matchedKeywords?: string[];
  recommendedAction?: 'continue' | 'caution_barrier' | 'immediate_medical_care';
}
```

- **`emergency`**: Flags severe reactions (facial swelling, respiratory distress, pus/oozing). The client immediately halts routine recommendations and displays emergency clinic referral copy.
- **`warning`**: Flags barrier sensitization (stinging, severe peeling). Directs the user to pause actives for 48 hours.
- **`safe`**: Benign cosmetic query. Proceed with normal grounded response.

---

## 4. State Ownership & Canonical Routine Invariants

1. **Sunscreen AM Invariant**: Sunscreens must NEVER appear in the evening (`pmSteps`) routine.
2. **Retinoid PM Invariant**: Strong retinoids (Adapalene/Differin, Tretinoin) must NEVER appear in the morning (`amSteps`) routine.
3. **Single Source of Truth**: The active routine stored in `routines` table is authoritative. Neither client nor backend may show a conflicting schedule.

---

## 5. Storage & Image Reference Rules
- Customer skin photos are stored in a private Supabase Storage bucket (`customer-skin-photos`).
- Canonical object paths are `<authenticated-member-uuid>/<photo-type>/<opaque-file-name>`; metadata rows must use the same member-owned prefix.
- Uploads are immutable: use unique names with `upsert: false`. The mobile client must **never** store or display public S3/Supabase URLs.
- The mobile client can upload to its own member namespace but cannot list, directly download, sign, replace, or delete photo objects. It also cannot delete photo metadata directly.
- `photo-url` is the only customer photo delivery interface. It derives identity from the verified JWT, rejects caller-supplied `userId` or path values, verifies that both the metadata row and canonical object path belong to the caller, and issues a signed URL with an exact 15-minute (900-second) expiration and private/no-store caching.
- `delete-customer-account` is the destructive lifecycle interface. It requires the exact `DELETE_MY_DERIVE_ACCOUNT` confirmation, rejects caller-supplied identity, recursively inventories and removes the authenticated caller's Storage namespace through the Storage API, verifies the namespace is empty, and deletes the Auth user last. Deleting rows from `storage.objects` directly or relying only on relational cascades is forbidden because it can orphan physical objects.

---

## 6. Client vs Remote Service Switch
The service factory selects the remote adapter with:
```bash
# In .env:
EXPO_PUBLIC_USE_REMOTE_SERVICE=true
```
The factory in `src/services/DeriveService.ts` then instantiates `RemoteDeriveService` for callers of that factory. Current screens still operate primarily through local Zustand stores, and the remote adapter still lacks complete row-to-domain mapping and live function coverage; therefore this flag alone does **not** make the current app a production-ready remote experience. Client/service wiring requires a coordinated integration slice.

Live Gemini invocation happens only behind `RemoteDeriveService` on the server. `MockDeriveService` uses deterministic local reasoning and never requires a client Gemini key.

---

## 7. Semantic Requirements for Backend Evolution (For Sami Review)

The following semantic requirements emerge from the client prototypes (`src/phenotype/` and `src/pricing/`). They are documented here to inform backend architecture without prescribing database schemas, table layouts, or specific column designs.

### A. Phenotype & PIH Signal Semantics
The backend must preserve full evidence provenance for any captured phenotype signal, rather than flattening it to an unprovenanced string:
- **Core Signal**: Adaptive question on post-inflammatory hyperpigmentation (persistent dark marks after breakouts or irritation).
- **Required Provenance Fields**:
  - `value`: Categorical answer (`rarely`, `sometimes`, `often`, `unknown`).
  - `source`: Evidence origin (`self_reported`, `photo_estimate`, `observed_history`, `derived_from_history`, `external_context`).
  - `confidence`: Categorical confidence (`low`, `medium`, `high`).
  - `userConfirmed`: Boolean invariant ensuring member-confirmed values outrank estimates.
  - `observedAt`: ISO timestamp of observation/confirmation.
- **Storage Decision**: Sami may persist this via JSONB attributes, relational fact tables, event ledgers, or dedicated profile columns as best fits backend normalization and RLS performance.

### B. Personalized Pricing Semantics
Pricing is dynamic, versioned relative to routine and subscription lifecycle, and requires versioned state tracking rather than a static single profile column:
- **Semantic State Requirements**:
  - **Draft Estimate**: Computed during onboarding and displayed under quiet review before first plan publication.
  - **Active Agreed Price**: The monthly amount currently authorized and active.
  - **Proposed Changed Price**: Generated when a routine adjustment or product swap changes steady-state consumption.
  - **Routine Version Linkage**: Exact association between the pricing snapshot and the canonical routine version.
  - **Approval State**: Explicit member confirmation state (`pending_approval`, `approved`, `rejected`) for any price increase.
  - **Effective Timing & History**: Activation timestamp, scheduled change dates, and historical audit ledger.
- **Storage Decision**: The database representation (e.g. subscription versioning table, routine-linked pricing snapshot, or ledger entity) belongs to backend architecture review.

### C. Routine Change Proposal vs. Active State & Member Approval Semantics
The data model must preserve a clean separation between the canonical *active* routine currently in use and any *proposed* routine modifications awaiting member consent:
- **Separation of Concerns**: Proposed routine modifications formulated by system intelligence or founder review must not overwrite the active schedule until explicit member consent is obtained.
- **Member Approval Lifecycle**:
  - `status`: Categorical proposal lifecycle (`pending_member_approval`, `member_approved`, `member_rejected`, `superseded`).
  - `materialChanges`: Explicit diff indicating added products, replaced formulas, discontinued steps, active frequency changes, or price adjustments.
  - `approvalTimestamp`: Recorded timestamp of member confirmation.
- **Invariants**:
  - Ingesting weekly check-ins and updating internal tolerance models do not alter active routines without approval.
  - Routine adjustments that increase monthly plan price or introduce/alter strong actives remain in `pending_member_approval` until the member explicitly confirms.

### D. Standing Refill Consent & Replenishment Lifecycle Semantics
Refill requests and recurring replenishment must respect explicit customer consent boundaries rather than simulating automatic calendar depletion:
- **Consent Models**:
  - **On-Demand Confirmation (Beta Baseline)**: Each refill requires a low-friction affirmative request ("Running low on [product]? Refill").
  - **Standing Refill Consent (Future Opt-In)**: Members may explicitly opt a stable, previously approved SAME SKU into automatic replenishment with advance notice and a 1-tap skip affordance.
- **Replenishment Tracking**:
  - `status`: `requested` | `ordered` | `shipped` | `delivered` | `cancelled`.
  - `sku`: Must match active routine product; any formula substitution or brand swap requires separate affirmative member approval.
  - `trackingNumber`, `carrier`, `estimatedArrival`: Transparent fulfillment metadata.

### E. Baseline & Progress Photo Provenance Semantics
Skin photos serve as longitudinal baseline and progress context, governed by strict privacy and provenance standards:
- **Baseline Invariant for Founding Beta**: Three standardized captures (`front`, `left`, `right`) are required for initial beta intake; subsequent weekly progress photos are optional.
- **Required Metadata & Provenance**:
  - `angle`: Categorical orientation (`front` | `left` | `right`).
  - `captureType`: `baseline` | `progress` | `reaction_context`.
  - `captureQualityPassed`: Boolean indicating on-device capture quality gating (lighting, sharpness, pose, stability) passed before auto-capture.
  - `memberApproved`: Explicit confirmation by member (`Use Photo` chosen over `Retake`).
  - `capturedAt`: ISO timestamp.
- **Non-Diagnostic & Privacy Invariants**:
  - Zero storage of facial recognition embeddings or biometric identifiers.
  - Photos are treated as private, sensitive consumer skincare data, stored in private storage (`customer-skin-photos`), and delivered exclusively via short-lived signed URLs.

### F. Client Service Coordinator & Direct Import Boundary (`src/services/deriveClient.ts`)
To enforce strict boundary isolation between presentation and backend implementations:
- **Centralized Coordinator**: All UI routes (`app/**`) execute domain mutations and queries exclusively through `src/services/deriveClient.ts`:
  - `submitOnboarding(payload)`: Onboards new member, maps canonical `OnboardingResult` (`proposedRoutine: null` and `initialRoutineState: 'pending_generation'` sets `isPlanUnderReview: false` with "Your routine is being prepared"; only `awaiting_review` sets `isPlanUnderReview: true` with "Final review"), preserves proven remote membership, and relies on `resolveCustomerBootstrap` to verify `READY` status before navigation.
  - `askQuestion(question, context)`: Dispatches contextual question to service intelligence.
  - `evaluateProduct(input)`: Evaluates scanned item against user routine.
  - `submitWeeklyCheckIn(input)`: Records longitudinal observation and syncs store cache.
  - `requestProductRefill(input)`: Submits replenishment request.
  - `hydrateOrders()`, `hydrateProgress()`, `hydrateRoutine()`, `hydrateResearchInsights()`, `hydrateCustomerProfile()`: Pull state from the active backend. `hydrateRoutine()` explicitly sets `routine: null, isPlanUnderReview: false` if backend returns null.
  - `resolveUserId(userId?)`: Validates user identity. When `isRemoteServiceEnabled()` is true, fails closed (throws error) if user ID is missing, empty, whitespace-only (`'   '`), or matches mock IDs (`usr_beta_member`, `usr_beta_001`). Note: this is a client-side non-mock presence guard to prevent mock data leakage, distinct from server-side JWT session verification (enforced via Postgres RLS in S1/I1).
- **Client Scanner Partition (`src/services/catalog.ts`)**: Camera viewfinder and offline barcode matching rely strictly on `src/services/catalog.ts` (`findProductByBarcode`, `PROTOTYPE_CATALOG`). Production `recognizeShelfProducts()` returns empty products to fail closed, while demo fixture is isolated to `getDemoShelfRecognitionFixture()`.
- **Zero-AI-Workflows Rule**: Client code in `app/**` is strictly forbidden from importing `src/services/ai-workflows/**`. Server workflows are invoked exclusively through `IDeriveService` implementations.
- **Swappability**: The active backend implementation can be swapped at runtime via `setDeriveService()` or via configuration flag without altering any client UI code.
- **Scan-to-Ask Context Contract**: Navigation from Scan to Ask preserves the full typed `ProductScanResult` across navigation boundaries via ephemeral `useScanContextStore` (`src/stores/scanContextStore.ts`). Ask synchronously passes this context on the initial automated query and all subsequent queries in that conversation, eliminating React closure race conditions. Context is cleared upon banner dismissal or starting a new conversation. Partial records are never artificially synthesized from route query strings.
- **Customer-Safe Error Sanitization (`src/utils/customerErrors.ts`)**: All client UI errors are mapped through `getCustomerErrorMessage(operation)` to present deterministic, empathetic Direction A Mineral copy. Internal technical details (e.g. Supabase, PostgREST, RemoteDeriveService, stack traces) are strictly shielded from the member while being preserved in `console.warn` logs, and user draft inputs (form state, selected products) are preserved for seamless retry.

### G. Customer Bootstrap Resolution Contract (`src/contracts/DeriveService.ts`, `src/domain/types.ts`)
To truthfully determine whether an authenticated user requires onboarding or is an existing active member without guessing:
- **`CustomerBootstrapState` Contract**:
  ```typescript
  export interface CustomerBootstrapState {
    userId: string;
    profileExists: boolean;
    onboardingCompleted: boolean;
    membershipStatus: 'active' | 'paused' | 'cancelled' | 'none';
  }
  ```
- **Invariants**:
  - `profileExists`: Verified via `public.profiles`. The presence of a profile row (auto-provisioned by auth triggers) does NOT mean onboarding is complete. If absent, bootstrap fails closed (`profileExists: false`) to catch provisioning failures.
  - `onboardingCompleted`: Read strictly from `public.skin_profiles.onboarding_completed`. Missing skin profile or false means `NEEDS_ONBOARDING`; true means `READY`.
  - `membershipStatus`: Queried from `public.memberships` deterministically (latest row by `created_at` descending; absent row maps to `'none'`). Membership state is purely informational in this slice and does NOT gate onboarding navigation.
  - Tier and pricing fields are strictly excluded, preserving `ARCHITECTURE_CHALLENGE-01` without resolving it prematurely.
