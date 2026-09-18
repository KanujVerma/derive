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
  - `skinPhotos`: Front/Left/Right URIs and context note
  - `safetyContext`: Known sensitivities, active prescriptions, pregnancy status
* **Output**: `OnboardingResult` with initialized `CustomerProfile`, `SkinProfile`, and canonical `Routine`.

### `scanProduct(input: ScanProductInput)`
* **Input**: `productName`, `brand`, optional `imageUri`, `userRoutineContext`.
* **Output**: `ProductScanResult`:
  - `verdict`: `great_fit` | `could_work` | `not_needed` | `better_replacement` | `use_with_caution` | `not_good_fit`
  - `verdictLabel`: e.g. `'BETTER AS A REPLACEMENT'`
  - `reason`: One-sentence core rationale
  - `whatItWouldChangeOrReplace`: Explicit routine impact
  - `whyBullets`: 2–3 factual, user-specific explanation bullets

### `askDerive(request: AskRequest)`
* **Input**: `userId`, `question`, optional `activeContext` (e.g. `scannedProduct`).
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
- The future signer must derive identity from the verified JWT, verify that both the metadata row and object path belong to that identity, and issue a signed URL with a 15-minute (900-second) expiration. It must ignore caller-supplied `userId` values for authorization.
- Full deletion must use the Storage API before deleting the auth/profile record; deleting rows from `storage.objects` or relying on relational cascades would orphan the physical object.

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
  - `submitOnboarding(payload)`: Onboards new member, establishes proposed routine, syncs stores.
  - `askQuestion(question, context)`: Dispatches contextual question to service intelligence.
  - `evaluateProduct(input)`: Evaluates scanned item against user routine.
  - `submitWeeklyCheckIn(input)`: Records longitudinal observation and syncs store cache.
  - `requestProductRefill(input)`: Submits replenishment request.
  - `hydrateOrders()`, `hydrateProgress()`, `hydrateRoutine()`, `hydrateResearchInsights()`, `hydrateCustomerProfile()`: Pull state from the active backend. `hydrateRoutine()` explicitly sets `routine: null, isPlanUnderReview: false` if backend returns null.
  - `resolveUserId(userId?)`: Validates user identity. When `isRemoteServiceEnabled()` is true, fails closed (throws error) if unauthenticated, empty, or mock IDs (`usr_beta_member`, `usr_beta_001`) are used.
- **Client Scanner Partition (`src/services/catalog.ts`)**: Camera viewfinder and offline barcode matching rely strictly on `src/services/catalog.ts` (`findProductByBarcode`, `PROTOTYPE_CATALOG`). Production `recognizeShelfProducts()` returns empty products to fail closed, while demo fixture is isolated to `getDemoShelfRecognitionFixture()`.
- **Zero-AI-Workflows Rule**: Client code in `app/**` is strictly forbidden from importing `src/services/ai-workflows/**`. Server workflows are invoked exclusively through `IDeriveService` implementations.
- **Swappability**: The active backend implementation can be swapped at runtime via `setDeriveService()` or via configuration flag without altering any client UI code.
- **Scan-to-Ask Context Contract**: Navigation from Scan to Ask passes `{ productName, brand, verdict, reason }` as string parameters. Client routes must not synthesize partial `ProductScanResult` records when full attributes are not present.

