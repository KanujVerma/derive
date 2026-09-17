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
