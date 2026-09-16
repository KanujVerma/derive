# Derive Product Specification (V1)

## Product Ethos: Set-It-and-Forget-It
Derive eliminates the cognitive overhead of skincare. The member provides observations and counter products; Derive handles the interpretation and maintenance.

---

## Canonical V1 Navigation (5 Native Tabs)

All 5 primary tabs feature a standardized, accessible 44x44 pt Account profile button in the top navigation header, providing effortless access to the customer profile without navigating away from the active tab.

### 1. Today ("What matters right now")
- **2-Second Glance**: Top greeting stating routine status (`Good evening, Arthur. Everything looks on track. No changes today.`).
- **Non-Blocking Review Notice**: When a member's first plan is awaiting initial review (`status: 'awaiting_review'`), a calm `InfoBanner` displays at the top ("Final Review in Progress") with a 1-tap link to preview the proposed routine without blocking any app features.
- **Quiet Draft Preview Mode**: While the initial plan is in review, Today enters a quiet state: active tonight steps, active refills, and research insight cards are withheld until verification completes, displaying a single prominent `DRAFT · NOT ACTIVE` routine preview card.
- **Tonight Routine Preview**: Tappable preview card showing ordered steps, timing, and direct link to Plan tab (no redundant nested buttons).
- **Active Refill Tracker**: Prominent status banner displaying shipment status, carrier, and estimated arrival.
- **New For You Research Card**: 1 curated clinical paper with plain-English summary and routine relevance.
- **Anti-Anxiety Design**: Zero streaks, zero checkboxes, zero completion guilt.

### 2. Plan ("Your canonical routine and shelf audit")
- **Segmented View**: Top `SegmentedControl` toggles seamlessly between `ROUTINE` and `PRODUCTS (count)`.
- **First Plan Review Banner**: If the routine is `awaiting_review`, displays an `InfoBanner` ("First Routine Under Review") with clear `DRAFT · NOT ACTIVE` status badge, reassuring the member that proposed steps and dosages can be inspected while final verification finishes.
- **Canonical Routine List**: Step-by-step morning and evening sequences.
  - Numbered circular order indices.
  - Active schedule indicators (e.g. `MON / WED / FRI`).
  - Expandable drawer with exact dosage amounts (`1-2 pumps`), target zones, and personalized rationales. Disclosure chevrons (`up`/`down`) indicate expansion state.
  - **Consolidated Refill Action**: Single managed refill pathway integrated directly under active products in the routine. Redundant secondary refill rows and order links removed from the shelf list.
- **Counter Shelf Audit**: Complete inventory of the user's products tagged with action badges:
  - `KEEP`: Product is well-tolerated and aligns with goals.
  - `PAUSE`: Temporarily held while barrier stabilizes or active retinoid ramps up.
  - `REPLACE`: Quality formula, but redundant with an existing step.
  - `ADD`: Missing step recommended to fulfill a goal (e.g. daily morning SPF).

### 3. Scan ("Does this product fit me?")
- **Center Native Tab**: Accessible via viewfinder icon at position 3.
- **Pure Camera-First Viewfinder**: Uncluttered camera surface without artificial mode tabs (Front / Barcode / Ingredients eliminated). Automatic multi-attribute recognition analyzes whichever visual cue is in frame.
- **Fallback Search**: Subtle secondary link ("Can't scan? Search by name") for manual product lookup.
- **Split Evaluation Presentation**:
  - **FIT FOR YOU RIGHT NOW**: Categorical verdict (`GREAT FIT`, `COULD WORK`, `NOT NEEDED`, `BETTER AS A REPLACEMENT`, `USE WITH CAUTION`, `NOT A GOOD FIT RIGHT NOW`), active routine impact (*what it changes or replaces*), and 2-3 personalized rationale bullets.
  - **FORMULA QUALITY**: Objective product classification, key active ingredients, and formulation standard.
- **Handoff to Ask**: 1-tap `[Ask Derive About This]` button routes into Ask pre-seeded with context banner without re-scanning.

### 4. Ask ("Contextual skincare conversation")
- **Grounding Context**: Explicit context indicator: *"Answers based on your routine, skin history, and what we've learned about you."*
- **Scanned Product Context Banner**: Displayed when routed from Scan or when a product is attached.
- **Unified Starter Chips**: Starter chips include "Scan a product", which routes directly to the `/scan` tab rather than maintaining duplicate camera code inside chat.
- **Refined Composer (`GlassComposer`)**: Camera/attachment on the far left, expandable input in center, dedicated 44x44 tactile voice microphone button, and prominent send action.
- **Multiline Action Callouts**: Full-width wrapping action callouts prevent text overflow when the AI proposes concrete routine adjustments.
- **Clinical Safety Circuit Breaker**: Severe allergic symptoms immediately halt chat and surface emergency guidance.

### 5. Progress ("Longitudinal skin record")
- **100% AI-Led Longitudinal Care Loop**: Weekly check-ins are fully automated through intelligent AI assessment of skin state, barrier comfort, and product tolerance. Derive dynamically updates schedules, generates learned insights, and adapts routines without requiring recurring manual founder calls.
- **Weekly Check-In Card**: 30-second structured check-in (skin state, irritation, adherence, optional notes/photo).
- **Photo Comparison**: Side-by-side baseline vs. latest photo comparison across Front, Left, and Right angles using full-width `SegmentedControl` with friendly dates (`Sep 1`, `Sep 8`, `Sep 15`).
- **Learned Insights**: Plain-English observations with clear provenance labels (`From your check-ins`, `From your routine history`).
- **Timeline Events**: Milestone log of routine changes and barrier developments.

### 6. Profile & Settings (`app/profile`)
- **Customer Account Identity**: Member name, email, membership status derived dynamically from active plan pricing (e.g. `Founding Beta · Estimated plan: $96/mo` under review, `Current plan: $96/mo` after activation).
- **Clean Customer Scope**: Dedicated customer-facing sections for Care & History (Active Routine, Product Reaction History, Orders & Refills) and Support & Privacy (Member Support, Export Personal Data).
- **No Developer Bloat**: Internal founder review desk links, dev toggles, and unsubstantiated HIPAA/GDPR regulatory claims are completely removed from customer view.

---

## Personalized All-In Monthly Pricing Architecture [PROVISIONAL · PENDING COFOUNDER REVIEW]

> [!NOTE]
> Prototyped in the client/mock layer (`src/pricing/**`) by Kanuj; not yet reviewed or accepted by Sami. Not a finalized architectural decision.

Derive is prototyping moving away from arbitrary public subscription tiers (Simple / Balanced / Premium) and flat-rate lock-in toward a personalized monthly plan price derived dynamically from the active routine.

### 1. Pricing Formula (Internal Simulation)
`monthlyPlanPriceCents = managementFeeCents + steadyStateProductConsumptionCents + operationsRiskCents`
- **Care Management Component**: Provisional software, intake, and AI check-in component (`PROVISIONAL_DEMO_MANAGEMENT_FEE_CENTS = 3900`, \$39/mo demo assumption).
- **Normalized Product Consumption**: Each active routine product managed by Derive is normalized to a 30-day consumption rate based on its expected usage lifespan:
  `Math.round(retailPriceCents * 30 / estimatedLifespanDays)`.
  *Arthur's Demo Plan Fixture Breakdown:*
  - CeraVe Hydrating Cleanser (\$16 retail / 60-day lifespan) = \$8.00 / month (managed)
  - Differin Gel (\$15 retail / 45-day lifespan) = \$10.00 / month (managed)
  - La Roche-Posay Toleriane Double Repair (\$24 retail / 45-day lifespan) = \$16.00 / month (managed)
  - Beauty of Joseon Relief Sun (\$18 retail / 30-day lifespan) = \$18.00 / month (managed)
  *Steady-State Product Consumption Total:* \$8 + \$10 + \$16 + \$18 = **\$52.00 / month**.
- **Operations & Buffer Component**: Provisional operations and replenishment risk buffer (`PROVISIONAL_DEMO_OPERATIONS_RISK_CENTS = 500`, \$5/mo demo assumption).
- **Arthur's Total Demo Estimate**: \$39 + \$52 + \$5 = **\$96.00 / month**.

### 2. Three Distinct Economic Concepts
1. **Steady-State Monthly Product Consumption**: Expected normalized cost of products over time.
2. **Current Inventory / Shipment Timing**: Existing bottles in the member's counter inventory affect *when* Derive must purchase and ship the next unit, not the long-run steady-state consumption rate.
3. **Initial Fulfillment Cost**: Upfront cash Derive spends near activation to provide missing or replacement products.

### 3. Open Founder / Business Decisions (Unresolved in Prototype)
The client prototype simulates the ongoing monthly rate, but leaves these operational economics open for founder resolution:
- Prepaid product liability.
- Member cancellation before future refills are shipped.
- First-basket financing.
- Refund policy.
- Internal reserve / ledger accounting treatment.
- Supplier payment terms.

### 4. Customer Presentation
The customer sees **ONE all-in monthly number**:
- **Pending Review**: *"Estimated plan: \$96/month • Based on your draft routine. Finalized when your first routine is ready."*
- **Active Plan**: *"Current plan: \$96/month"*
- **Includes**: Derive management • your routine products • managed replenishment.
- **No Internal Breakdown**: The \$39 management fee, \$5 risk buffer, and internal margins are strictly internal economics and are never itemized or exposed to the member.

### 5. Price Stability Contract
- **Price Reductions**: If a routine simplification lowers monthly product cost, the plan price drops automatically.
- **Price Increases**: If an added active or formula upgrade increases the monthly plan price, Derive requires explicit member review and approval (`requiresMemberApproval: true`).

---

## Onboarding & Setup Workflow (6 Perceived Stages)
1. **Welcome & Goals**: Warm introduction with leaf monogram; reassurance cards (private encryption, human review before first plan, ~4 minutes); multi-select skin goals with `SelectionCard` (checkbox mode) and `ChoiceChip` priority selector. Store initializes clean with zero pre-filled demo data.
2. **Preferences**: Routine complexity (Simple & Focused, Balanced, More Involved); budget expectations (Value, Balanced, Premium When Worth It). Continue button disabled until explicit selection is made.
3. **Behavior**: Everyday skin observations (midday oil feel, post-cleansing tightness) utilizing `SelectionCard` and `SelectionRow`.
4. **Products & Safety**:
   - Shelf photo recognition of bathroom counter products.
   - **Progressive Reaction Disclosure**: Clean Yes/No entry gate. Product name, symptoms chips, and voice note only disclose if the member indicates they experienced a reaction.
   - **Safety Tri-State Audit**: Explicit tri-state tracking for pregnancy/nursing (`'yes' | 'no' | 'prefer_not_to_say'`) and sensitivities (`'none_known' | 'reported' | 'unanswered'`), preventing false negatives.
   - **Focused Retinoid Frequency**: When prescription actives (e.g. Differin) are detected, members select structured frequency choices (`1–2 nights`, `3–4 nights`, `5–6 nights`, `Every night`, `Not sure`) rather than ambiguous free text.
5. **Skin Photos**: Guided 3-step sequential capture (`1 Front View` → `2 Left Profile` → `3 Right Profile`) with step indicators, live capture preview, retake button, and optional voice notes.
6. **Review & Audit**: Grouped review card with direct `[Edit]` links per section, understated single estimated plan price card, and reassurance that the first plan receives a final manual quality check before going live. Tapping `[Build My Plan]` transitions the user directly to the main app with `isPlanUnderReview: true`.

---

## Operational Workflows
- **Non-Blocking First-Plan Verification**: When a new member completes onboarding, their initial routine is set to `status: 'awaiting_review'`. Founders review the routine proposal in `app/founder`. The member is immediately free to explore the app, scan shelf products, and use Ask. Once approved by the founder, the routine status updates to `'approved'` and the review banner dismisses.
- **Managed Refills (`app/orders`)**: Transparent 4-stage shipment tracker (`Requested` → `Ordered` → `Shipped` → `Delivered`). 1-tap refill request without false automatic depletion claims.


---

## Phenotype Architecture & Longitudinal Care Signals [PROVISIONAL · CLIENT PROTOTYPE]

Derive models observable skin attributes to deliver nuanced, safe routine recommendations without racial categorization or invasive surveys.

### 1. Observable Phenotype Attributes
* **Pigmentation Family**: `very_light`, `light`, `light_medium`, `medium`, `medium_deep`, `deep`, `very_deep`, `unknown`.
* **Undertone**: `cool`, `neutral`, `warm`, `olive`, `unknown`.
* **Sun Response**: Self-reported sun behavior (`burns_easily`, `burns_then_tans`, `sometimes_burns_tans`, `rarely_burns_tans_easily`, `not_sure`), strictly decoupled from pigmentation depth.
* **PIH Tendency**: Tendency for inflammatory lesions or acne to resolve with persistent hyperpigmentation (`rarely`, `sometimes`, `often`, `unknown`).
* **White Cast Concern**: Mineral sunscreen cast sensitivity (`none`, `slight`, `moderate`, `severe`).
* **Razor Bump History**: History of pseudofolliculitis barbae (`none`, `occasional`, `frequent`).
* **Hair Curl Pattern**: `straight`, `wavy`, `curly`, `coily`.

### 2. V1 Onboarding Adaptive Signal (Post-Inflammatory Hyperpigmentation)
To preserve intake completion under 4 minutes, Derive does NOT include a general phenotype questionnaire on the standard onboarding path. Only one single adaptive follow-up is injected during stage 6 (Targeted Clarifications):
- **Question**: *"Do breakouts or irritation usually leave dark marks that stick around?"*
- **Trigger**: Adaptively shown when `breakouts` or `dark_spots` goals are selected.
- **Choices**: `Rarely`, `Sometimes`, `Often`, `Not sure`.
- **Storage**: Provenanced as `source: 'self_reported'`, `confidence: 'high'`, `userConfirmed: true`.
- **Reasoning Impact**: Signals Derive to avoid unnecessary irritation, avoid stacking multiple irritating active changes simultaneously, prioritize adherence-friendly photoprotection, track persistent dark marks distinctly from active breakouts, and evaluate product fit without automatically prescribing specific ingredients.

### 3. Categorical Tint Compatibility & White Cast Assessment
- **Categorical Matching**: Evaluates product shade compatibility without arbitrary numeric match scores (`likely_match`, `possible_match`, `needs_confirmation`, `unlikely_match`).
- **Confirmation Invariant**: If a member's pigmentation depth is unconfirmed or derived from an unverified camera estimate, tint evaluation returns `needs_confirmation`.
- **Iron Oxide Photoprotection**: Identifies iron oxide photoprotection benefits against visible light when the member has a confirmed post-inflammatory hyperpigmentation signal (*Castanedo-Cazares et al. 2014*); never inferred from pigmentation depth alone.
