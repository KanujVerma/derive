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
- The mobile client must **never** store or display public S3/Supabase URLs.
- The backend generates short-lived signed URLs (15-minute expiration) when serving photo comparisons.

---

## 6. Client vs Remote Service Switch
Switching from mock to remote requires only:
```bash
# In .env:
EXPO_PUBLIC_USE_REMOTE_SERVICE=true
```
The factory in `src/services/DeriveService.ts` automatically instantiates `RemoteDeriveService` without requiring any changes to React Native UI components.

Live Gemini invocation happens only behind `RemoteDeriveService` on the server. `MockDeriveService` uses deterministic local reasoning and never requires a client Gemini key.
