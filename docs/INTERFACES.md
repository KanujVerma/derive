# Derive Interface & Service Contracts

This document formalizes the runtime interface contracts between the client application (Kanuj) and the backend intelligence platform (Sami).

Code definitions:
- Interface definition: [`src/contracts/DeriveService.ts`](../src/contracts/DeriveService.ts)
- Shared domain types: [`src/domain/types.ts`](../src/domain/types.ts)
- Implementation mock: [`src/services/mock/MockDeriveService.ts`](../src/services/mock/MockDeriveService.ts)
- Implementation remote: [`src/services/remote/RemoteDeriveService.ts`](../src/services/remote/RemoteDeriveService.ts)
- S6 product identity: [`src/contracts/ProductIdentityResolver.ts`](../src/contracts/ProductIdentityResolver.ts)
- S-FREE-3 free Check context: [`src/contracts/FreeContext.ts`](../src/contracts/FreeContext.ts)

### S-FREE-3 Free Context (stacked branch, not hosted)

`free-context` requires a valid Supabase Auth bearer token for every operation, including anonymous guests. The server derives the owner from the token; no request accepts a user ID. `src/services/remote/freeContext.ts` exposes `listFreeProducts`, `listFreeChecks`, `listFreeExperiences`, `saveFreeProduct`, `setFreeProductState`, `deleteFreeProduct`, `recordFreeCheck`, `recordFreeExperience`, and `deleteFreeEntry`.

- Lists are owner-bound, newest first, at most 50 per call, with an owner-bound last-entry-ID cursor. Raw tables and notes are not directly readable through PostgREST.
- `save_product` takes a stable caller-generated UUID request ID, a catalog product UUID **or** a user-entered name/brand, and `using` / `considering` / `stopped`. The server verifies catalog IDs and labels manual entries `user_reported`; manual text never establishes formula truth. `set_product_state` modifies only the owner's saved row.
- `record_check` takes a request ID plus either a sourced catalog product UUID or the caller's S6 **scan** case UUID. Unresolved cases are saved truthfully as unidentified, never upgraded to a product claim. This is an explicit “result viewed/saved” write, not an automatic log of searches or camera attempts.
- `record_experience` takes a request ID, a catalog/manual product reference, `tolerated` / `reacted` / `liked` / `finished`, and an optional bounded note. It records what the user reported, not a diagnosed allergy. Check/experience rows are append-only through the service, with owner deletion available. A reported reaction to the same catalog product can downgrade a later verified-formula S-FREE-2 fit to `USE_WITH_CAUTION`; it does **not** attribute causation to an ingredient or assume the prior variant/formula matches.
- Existing paid `user_products`, `product_reactions`, `check_ins`, membership and intake tables are not repurposed. Kanuj owns projection into `MyStuffViewModel`, calling these methods after his mobile integration milestone. No app screen is changed in this platform PR.

---

## 1. Core Service Interface (`IDeriveService`)

```typescript
export interface IDeriveService {
  onboard(payload: OnboardingPayload): Promise<OnboardingResult>;
  proposeRoutine(input?: RoutineProposalInput): Promise<RoutineProposalResult>;
  getUserProducts(userId: string): Promise<UserProduct[]>;
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
    - `founderNotes` exists on the shared internal type but is intentionally omitted from customer-facing Remote and Edge responses.
    - *Contract Truth*: `Routine` has NO `rationales` property. Step-level personalized rationale is captured on individual `RoutineStep` items via `whyChosen`, `purpose`, `watchFor?`, and optional `scheduleText?`.
  - `userProducts`: `UserProduct[]` (with actions: `'KEEP'` | `'PAUSE'` | `'REPLACE'` | `'ADD'` | `'STOP'`).
  - `clarificationQuestions`?: string[]
* **Lifecycle State & Durability Truth**:
  - `InitialRoutineState` (`'pending_generation'` | `'awaiting_review'`) is a shared domain type returned via `OnboardingResult`. There is NO persisted `initial_routine_state` column in PostgreSQL today.
  - Before proposal: no canonical routine row exists in `public.routines` $\to$ client conceptual state is `pending_generation` (`routine: null`, `isPlanUnderReview: false`, "Your routine is being prepared.").
  - After proposal persistence: routine is persisted in `public.routines` with `status = 'awaiting_review'` $\to$ client derives `awaiting_review` (`isPlanUnderReview: true`, "Final review: Your first routine gets one final quality check before it goes live.").
  - If a dedicated persisted lifecycle column or API is deemed necessary, that is a future shared architecture decision, not assumed current implementation.
* **S2/B2 Delivered Schema & Mapping Reconciliations**:
  1. **`public.routines.updated_at` Reconciliation [DELIVERED]**:
     - Added `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` to `public.routines` via migration `20260919010000_i1_b2_routine_intelligence_and_persistence.sql`.
     - Wired to `routines_set_updated_at` calling `private.set_updated_at()`; S2 additionally protects immutable routine content and steps.
     - Granted `SELECT (updated_at)` on `public.routines` to `authenticated` while retaining `founder_notes` as founder-only.
  2. **`public.routine_items.product_id` Reconciliation [DELIVERED]**:
     - Added `product_id UUID REFERENCES public.products(id) ON DELETE RESTRICT` to `public.routine_items`.
     - Transactional RPC `commit_routine_proposal` resolves or upserts canonical products and populates `product_id`.
     - New rows that cannot be represented with a canonical product fail closed at the remote mapping boundary rather than receiving a fabricated ID.
  3. **`RoutineStep.scheduleText` Derivability [DELIVERED]**:
     - Derived deterministically during read assembly from `timing` + `days` using `formatRoutineStepSchedule` from `src/types/schema.ts` without database bloat.
  4. **`UserProduct.product` Reconstruction Invariant [DELIVERED]**:
     - All B2-decided products are normalized and upserted into `public.products`.
     - `public.user_products.product_id` references the normalized catalog row, and a unique constraint `user_products_user_product_idx` prevents duplicate user-product pairs.
     - `RemoteDeriveService.getUserProducts()` executes `user_products JOIN products` to hydrate full canonical `UserProduct` objects; rows lacking that canonical relationship fail closed instead of manufacturing placeholder products.
  5. **Remote Routine Read Assembly [DELIVERED]**:
     - `RemoteDeriveService.getRoutine(userId)` reads `routines` + `routine_items` (ordered by `order_index`), maps headers and steps, partitions into `amSteps` and `pmSteps`, derives `scheduleText`, and returns typed `RoutinePlan`.
     - Kanuj's `hydrateRoutine()` in `src/services/deriveClient.ts` cleanly hydrates this structure into `routineStore`.
  6. **User Confirmation Semantics (`is_confirmed_by_user`) [DELIVERED IN B2.1]**:
     - Products recommended or substituted by the intelligence engine in `public.user_products` are persisted with `is_confirmed_by_user = false`.
     - Only products explicitly vetted and confirmed by the member during onboarding shelf audit retain `is_confirmed_by_user = true`.
  7. **Customer-Safe Error Boundary Contract [DELIVERED IN B2.1]**:
     - `propose-routine` Edge Function strictly returns typed, customer-safe JSON: `{ error: string, code: RoutineErrorCode }`.
     - Canonical error codes: `UNAUTHORIZED` (401), `INTAKE_NOT_COMMITTED` (400), `INTAKE_CONTEXT_INVALID` (400), `MODEL_UNAVAILABLE` (503), `MODEL_OUTPUT_INVALID` (502), `CLARIFICATION_REQUIRED` (422), `VALIDATION_FAILED` (422), `PERSISTENCE_FAILED` (500), `INTERNAL_ERROR` (500).
     - Security Invariant: Zero stack traces, SQL constraints, table names, Postgres internal errors, or LLM provider errors may be emitted to the client.
  8. **Provider-Neutral Intelligence Boundary (`RoutineIntelligenceProvider`) [DELIVERED IN B2.2]**:
     - Edge Function decoupled behind provider interface: `{ readonly providerId: string; generateProposal(context: AssembledRoutineContext): Promise<RoutineIntelligenceProposal>; }`.
     - Commercial provider selection is explicitly OPEN / DEFERRED (`ARCHITECTURE_CHALLENGE-05`). Swapping providers requires an adapter + verification, not a pipeline refactor.
  9. **Zero Client-Side Provider Selection & Server Runtime Configuration [DELIVERED IN B2.2]**:
     - Client-controllable provider defect removed: `x-routine-fixture` header completely eliminated. Clients can never select a provider or force fixture mode.
     - Provider selection is strictly server-side runtime configuration: `ROUTINE_MODEL_PROVIDER` process env or secure `public.server_runtime_config` table restricted to `service_role`. Fails closed with 503 `MODEL_UNAVAILABLE` when unconfigured.
     - Isolated `FixtureRoutineProvider` for reproducible CI and local E2E. Optional `GeminiRoutineProvider` adapter with header auth (`x-goog-api-key`).
  10. **Catalog Provenance & Sensitivity Hardening [DELIVERED IN B2.2]**:
      - Model output is untrusted. `commit_routine_proposal` RPC prevents overwriting `is_catalog_standard = true` products; new model-proposed products default to `is_catalog_standard = false` with empty formula fields.
      - Post-model sensitivity evaluation (`validateSensitivities`): if member reported sensitivities, unverified formulas fail closed with `VALIDATION_FAILED`; trusted products containing known allergens fail closed.
  11. **Confirmation Provenance Preservation [DELIVERED IN B2.2]**:
      - `is_confirmed_by_user` semantics: denotes member confirmed having product in inventory, NOT member approval of an AI action. Existing shelf items retain `true` across actions (`KEEP`, `PAUSE`, `REPLACE`, `STOP`); new `ADD` items are `false`. Persistence never downgrades `true` to `false`.
  12. **Server Boundary Least Privilege & Catalog Provisional Protection [DELIVERED IN B2.3]**:
      - `commit_routine_proposal` restored to `SECURITY INVOKER` with explicit service-role execution ACL; deprecated `auth.role()` check removed.
      - Zero filesystem fallback in provider resolution (`.server-provider-config`, founder paths, and `Deno.readTextFile` eliminated).
      - Model outputs cannot promote `key_actives`, `full_ingredients`, or `retail_price_approx` to provisional (`is_catalog_standard = false`) products, preventing accumulation of hallucinated facts across subsequent proposals.
      - Null/unknown `is_confirmed_by_user` strictly fails closed to `false` in client mapping (`row.is_confirmed_by_user === true`).
  13. **Mobile Initial Routine Integration & Parity [DELIVERED IN I1-B3]**:
      - `IDeriveService`: `proposeRoutine(input?: RoutineProposalInput)` optional input parameter and `getUserProducts(userId: string): Promise<UserProduct[]>`.
      - `deriveClient.ts`: `hydratePlanState(userId?)` and `ensureInitialRoutineProposal(userId?)` coordinators with in-flight request deduplication (`inFlightHydrations`, `inFlightProposals`), remote session identity freshness, attempt monotonicity, and restart recovery.
      - `routineStore.ts`: `isRoutineBeingPrepared`, `planHydrationStatus` (`'idle' | 'loading' | 'ready' | 'error'`), `planHydrationAttempt`, `planHydrationError`, `startPlanHydration()`, `setPlanHydrated()`, `setPlanHydrationError()`, and monotonic `resetRoutine()`.
      - Calm preparation UI on Today and Plan tabs: renders "Your routine is being prepared" while generation is pending; hides "Start Routine Setup" and refill CTAs; recovers automatically upon completion.

### `getUserProducts(userId: string): Promise<UserProduct[]>`
* **Input**: `userId`: string
* **Output**: `UserProduct[]` (with actions: `'KEEP'` | `'PAUSE'` | `'REPLACE'` | `'ADD'` | `'STOP'`).
* **Semantics**:
  - In Mock mode: returns member shelf and recommended products.
  - In Remote mode: queries `public.user_products` joined with `public.products`, mapping `row.is_confirmed_by_user === true` (fail-closed on null/unknown).

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

### S3 Edge Endpoint Binding (Implemented, Client Wiring Pending)

All S3 functions require a valid Supabase bearer token at the gateway and
re-verify it in the handler. The authenticated UUID is canonical; request-body
identity cannot select another member's context.

| Edge Function | Contract role | Current behavior |
| --- | --- | --- |
| `propose-routine` | `proposeRoutine` | Loads canonical server context, runs/persists a validated `awaiting_review` proposal, and returns `RoutineProposalResult`. Caller-supplied profile/shelf truth is not trusted. |
| `scan-product` | `scanProduct` | Returns a categorical `ProductScanResult` and deterministically downgrades conflicts. Existing name/brand input remains compatible; optional `resolutionCaseId` must belong to the caller and be `verified_product_formula`, then canonical catalog labels override request labels. `imageUri` is not fetched or sent to Gemini. |
| `ask-derive` | `askDerive` | Enforces request `userId` equality, hard-stops mandatory red flags before model use, and returns `AskResponse`. `photoAttachmentUri` is deliberately excluded from model context. |
| `infer-ingredient-signals` | Internal S3 operation | Infers and appends owner-readable signal versions from canonical formula/reaction history; it is not an `IDeriveService` client method. |

These endpoints establish the server implementation boundary but do not, by
themselves, enable the production mobile Remote path. Wiring the existing
`RemoteDeriveService` methods to them and enabling Remote mode remains a
coordinated S5/I1 integration change.

### S6 `resolve-product-identity`

This JWT-gated, active-member endpoint is a stable backend boundary outside
`IDeriveService` until the separately owned mobile adaptation is agreed. Its
canonical request/result types are in `ProductIdentityResolver.ts`.

- Input: idempotency UUID, `scan | shelf` consumer, optional validated GTIN,
  typed identity, label/packaging text, ingredient list, and up to three
  caller-owned private evidence paths.
- Output: persisted case ID, one of five categorical trust states, supported
  product/formula identity only when available, candidate evidence, next action,
  and founder-review status.
- Raw local URIs and HTTP image URLs are rejected. OCR/model resemblance is
  candidate evidence only and cannot create verified identity.
- A catalog identifier becomes authoritative only after its `verified_at`
  checkpoint exists; its declared GTIN type must match its exact digit length.
- Request UUID persistence is safe under concurrent retries. Catalog reads are
  deterministically paged and fail closed at the documented safety ceiling
  rather than resolving against a silently truncated dataset.
- `scan-product` accepts optional `ScanProductInput.resolutionCaseId` as the
  first backend consumer. Only an owner-bound verified product+formula case may
  enter personalized evaluation through that path.
- Full semantics and persistence are in [PRODUCT_IDENTITY.md](PRODUCT_IDENTITY.md).

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

Live model invocation happens only in trusted server Edge Functions. Routine generation resolves a server-configured `RoutineIntelligenceProvider`; scan and Ask currently use the guarded Gemini adapter. `MockDeriveService` uses deterministic local reasoning and never requires a client model key.

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
  - `submitWeeklyCheckIn(input)`: Records longitudinal observation and syncs the canonical returned `CheckIn` into store cache exactly once. Optional `contextTags` + `contextNote` flow through unchanged. Legacy `notes` remains on the contract for historical callers; the new UI submits `contextNote`.
  - `requestProductRefill(input)`: Submits replenishment request.
  - `hydrateOrders()`, `hydrateProgress()`, `hydratePlanState()`, `hydrateRoutine()`, `hydrateResearchInsights()`, `hydrateCustomerProfile()`: Pull state from the active backend. Canonical plan hydration is `hydratePlanState()` (Routine + `UserProduct[]` atomically). Legacy `hydrateRoutine()` is a compatibility wrapper that returns `result?.routine ?? null`. On hydration error for an onboarded member, the client preserves `isRoutineBeingPrepared = true` rather than un-onboarded empty-state.
  - `resolveUserId(userId?)`: Validates user identity. When `isRemoteServiceEnabled()` is true, fails closed (throws error) if user ID is missing, empty, whitespace-only (`'   '`), or matches mock IDs (`usr_beta_member`, `usr_beta_001`). Note: this is a client-side non-mock presence guard to prevent mock data leakage, distinct from server-side JWT session verification (enforced via Postgres RLS in S1/I1).
  - `createMembershipCheckoutSession(requestId?)`, `createMembershipPortalSession()`: UI-safe coordinator entry points for the hosted billing methods; no UI route needs to import a concrete service implementation.
  - `IDeriveService.createMembershipCheckout(requestId?)`: Returns only `{ url }` for a short-lived HTTPS Stripe Checkout destination. Remote mode sends an idempotency correlation UUID; the trusted function derives member identity from the JWT. Mock mode rejects billing rather than fabricating a successful payment.
  - `IDeriveService.createMembershipPortal()`: Returns only `{ url }` for a short-lived HTTPS Stripe Billing Portal destination. The trusted function resolves the Stripe customer binding from the authenticated member; callers cannot supply a customer ID.
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
  - `membershipStatus`: Queried from owner-readable `public.memberships` in S5 order (latest Stripe event timestamp, then row creation; absent row maps to `'none'`). E1 requires `active` before Remote onboarding and managed tabs. `profileExists`, `onboardingCompleted`, and membership are independent facts. The event timestamp is server-written and owner-readable only for ordering; Stripe IDs and Price remain server-only.
  - Tier and pricing fields are strictly excluded from bootstrap. I1-B4A migrated `CustomerProfile.tier` from historical `'founding_beta_129'` to price-neutral `'founding_beta'`. Display price is `config.betaPriceMonthly` (`25`); Stripe's configured recurring Price is the S5 charge authority.

### H. S5 Membership Commerce Contract
- Checkout and portal are Stripe-hosted. Derive does not collect card fields or expose Stripe secrets in mobile code.
- Checkout input is only a request-correlation UUID. User ID, account email, tier metadata, Price ID, and redirect URLs are trusted-server values.
- Webhook mutation requires a valid Stripe signature over the unparsed request body. Unsigned/invalid requests return `400`; incomplete server configuration returns sanitized `503` responses.
- Canonical `membershipStatus` remains `active | paused | cancelled`; raw Stripe status is server-only evidence and never expands the shared customer enum.
- Money is not duplicated in `MembershipTier`, `CustomerProfile`, or the database tier identity. Changing the Stripe Price requires an explicit commercial/configuration review, not a tier rename.
- Product purchasing/refills remain outside this contract.

### H1. E1 Membership Access and Refresh
- `resolveAuthRoute` consumes the canonical bootstrap for the authenticated session. Missing, stale, or unresolved evidence stays on Holding; `none`/`paused`/`cancelled` goes to Membership; active plus incomplete onboarding goes to Onboarding; active plus completed onboarding enters member tabs.
- `/membership` uses existing S5 Checkout and Portal session coordinators and receives only validated HTTPS destinations. A success URL or local pending state cannot grant access; bounded retries and foreground refresh read backend status again.
- A downgrade retains Auth identity and historical server records while clearing local managed caches. The root navigator prevents paid deep links from mounting. Mock routing remains billing-free.

### I. I1-B4 Contract Status
- **B4A membership (IMPLEMENTED)**: `CustomerProfile.tier` is `'founding_beta'`. Display price is $25/month membership, products separate. `src/pricing/**` all-in engine removed. Mock/Remote map canonical `founding_beta` and fail closed otherwise.
- **B4B check-in (IMPLEMENTED)**: Canonical `CheckInContextTag` plus `contextTags` / `contextNote` on `CheckIn` / `CheckInInput`. Persisted `CheckIn.contextTags` is a required array (legacy rows map to `[]`). Input remains optional. Legacy `notes` preserved. Tags are context, not causation. Real `submit-checkin` Edge Function exists. Remote `getProgress()` reads `public.check_ins` via RLS and does not call `get-progress`. Remote `learnedInsights` and `recentPhotos` are empty until later durable insight/photo-signer milestones.


## 10. Free-access and fit interfaces

The contracts below distinguish landed local behavior from future milestones; they do not bypass current E1 gates. Sami owns each platform contract when its milestone first needs it; Kanuj builds to fixtures/local customer-state seams and consumes the merged contract.

- **S-FREE-1 access contract (local platform implemented; hosted gated):** `src/contracts/FreeAccess.ts` and `getFreeAccessState()` expose verified `userId`, `identityKind`, `freeProductAccess`, `managedMembershipStatus`, and `managedAccess` without changing managed bootstrap. `access-state` is JWT-gated; sourced `catalog-products` and factual non-photo `resolve-product-identity` accept authenticated guests. Managed endpoints require permanent identity and active membership; guests cannot claim Founding Beta. The exact FREE / MANAGED / BOTH / INTERNAL matrix, 401/403/503 errors and evidence limits are in [S_FREE_1_ACCESS.md](S_FREE_1_ACCESS.md). Hosted anonymous signup is not activated.
- **Wave-1 mobile consumption (local only):** `authClient` preserves a persisted session or silently signs in anonymously only in `local_free_integration`; `freeAccessStore` projects the returned server state for the current Auth UUID. Free identities use the four-root shell, factual catalog/resolver, and Check landing. Active permanent managed identities use Plan landing and retain managed bootstrap. A missing email, Mock membership fixture, or route parameter never determines identity or managed access. Development Remote with an exact local Supabase host is the sole activation; Remote Staging remains legacy.
- **S-FREE-2 profile/fit contract (local branch implementation; hosted gated):** `src/contracts/FreePersonalFit.ts` and JWT-gated `free-personal-fit` persist only a minimal optional free profile and derive categorical fit from server-verified product/variant/formula evidence. The caller supplies product/variant IDs, never ingredients or fit labels. Response includes evidence used, missing evidence and a safe unknown state. No universal score, invented concentration, diagnostic output, or model-provider hard dependency. Exact operations, field limits, owner isolation and K-FREE-2 handoff are in [S_FREE_2_PERSONAL_FIT.md](S_FREE_2_PERSONAL_FIT.md).
- **S-FREE-3 context contract:** owner-bound current products, considered/using/stopped state, check history and supported reactions/tolerance. Anonymous owner identity must be explicit. No client-authoritative ownership or cross-user projection.
- **S-FREE-4 evidence contract:** private product evidence and candidate/resolution states reuse S6. Mobile capture submits evidence; only server/catalog authority determines canonical product/formula identity. Ambiguous, missing, or unsupported formula evidence stays unknown or enters review.
- **S-PAID-1 managed contract:** permanent identity plus server-owned managed entitlement is required for managed operations. Founder-created routines use the existing validated publication authority; no client/RLS bypass. Free profile/context reuse during managed enrollment must preserve owner and safety boundaries.

A shared contract is not co-owned implementation. The owning milestone records request, response, ownership, failure states, security rules, and compatibility; merges it; then names the dependent milestone. No same-contract parallel edits.
