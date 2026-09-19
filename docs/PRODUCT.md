# Derive Product Specification (V1)

## Product Ethos: Set-It-and-Forget-It & Autopilot vs. Depth

Derive eliminates the cognitive overhead of skincare ("Your skincare, handled"). The member provides observations, baseline context, and counter products; Derive handles the interpretation, maintenance, and replenishment.

### Autopilot vs. Depth: A Product Philosophy, Not User Modes
"Autopilot vs. Depth" is an overarching product design philosophy, **never a settings toggle or separate user modes**:
- **Default Experience (Autopilot)**: For members who want skincare off their mind, Derive requires only Today + Plan + lightweight check-ins + explicit routine/refill approvals. The system manages scheduling, monitors barrier stability, and coordinates replenishment in the background.
- **Optional Depth**: Members desiring deeper agency or understanding can explore Scan (viewfinder product evaluations), Ask (grounded conversational intelligence), Progress (longitudinal photo comparisons and learned observations), and clinical research cards at their own pace.
- **Same Unified Product**: Every member has access to the same 5 canonical native tabs (`Today` | `Plan` | `Scan` | `Ask` | `Progress`).

---

## Canonical V1 Navigation (5 Native Tabs)

All 5 primary tabs feature a standardized, accessible 44x44 pt Account profile button in the top navigation header, providing effortless access to the customer profile without navigating away from the active tab.

### 1. Today ("What matters right now")
- **2-Second Glance**: Top greeting stating routine status (`Good evening, Arthur. Everything looks on track. No changes today.`).
- **Non-Blocking Review Notice**: When a member's first plan is awaiting initial review (`status: 'awaiting_review'`), a calm `InfoBanner` displays at the top ("Final Review in Progress") with a 1-tap link to preview the proposed routine without blocking any app features.
- **Quiet Draft Preview Mode**: While the initial plan is in review, Today enters a quiet state: active tonight steps, active refills, and contextual research cards are withheld until verification completes, displaying a single prominent `DRAFT · NOT ACTIVE` routine preview card.
- **Tonight Routine Preview**: Tappable preview card showing ordered steps, timing, and direct link to Plan tab (no redundant nested buttons).
- **Active Refill Tracker**: Prominent status banner displaying shipment status, carrier, and estimated arrival.
- **Actionable Research Card (Contextual Only)**: Curated clinical research surfaces on Today *only* when it directly informs a current routine change, barrier state, or active adjustment (e.g. explaining why an active was paused or why photoprotection was adapted). To preserve Today's 2-second glance without consuming attention with non-actionable reading, broader educational research lives in Ask, Progress, and dedicated detail views (`app/insights/[id]`).
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
- **AI-Led Longitudinal Care Loop**: Weekly check-ins capture member observations and may generate reviewable insights or proposed adaptations. Check-in context is observational, not proof of causation, and material routine changes still require the applicable review and consent.
- **Weekly Check-In Card**: 30-second structured check-in (skin state, irritation, adherence, optional multi-select context tags, one voice/text note, and optional photo). Context tags include diet, sleep, stress, alcohol, cycle, travel/weather, new product, medication/supplement, routine change, and other.
- **Photo Comparison**: Side-by-side baseline vs. latest photo comparison across Front, Left, and Right angles using full-width `SegmentedControl` with friendly dates (`Sep 1`, `Sep 8`, `Sep 15`).
- **Learned Insights**: Plain-English observations with clear provenance labels (`From your check-ins`, `From your routine history`).
- **Timeline Events**: Milestone log of routine changes and barrier developments.

### 6. Profile & Settings (`app/profile`)
- **Customer Account Identity**: Member name, email, and `Founding Beta · $25/mo` membership status. Product purchases are separate and never silently folded into the membership price.
- **Clean Customer Scope**: Dedicated customer-facing sections for Care & History (Active Routine, Product Reaction History, Orders & Refills) and Support & Privacy (Member Support, Export Personal Data).
- **No Developer Bloat**: Internal founder review desk links, dev toggles, and unsubstantiated HIPAA/GDPR regulatory claims are completely removed from customer view.

---

## Founding Beta Membership & Product Commerce

### 1. Founding Beta Membership — APPROVED EXPERIMENT
* **Status**: **APPROVED BETA EXPERIMENT** for the first 10 paying members.
* **Membership Price**: **$25/month** for Derive's managed routine, ongoing check-ins and history, product-fit guidance, and app experience.
* **Products Are Separate**: OTC products, replacements, and refills are purchased separately at the applicable price. No product allowance, hidden bundle, consumption-derived membership price, or promise that products are included.
* **Price-Neutral Identity**: The membership tier is `founding_beta`; monetary terms belong to trusted server-side billing configuration, not the tier name or customer profile.
* **Recommendation Independence**: A recommendation must be driven by member fit and evidence, never by product margin or the possibility of a separate sale.

### 2. Product Purchase & Refill Rules
* **Preserve Working Products**: Existing products that work are retained (`KEEP`); Derive does not create unnecessary orders.
* **Explicit Approval**: Every new product, substitute, and refill requires a clear price and affirmative approval before charge, purchase, or shipment unless the member later establishes revocable standing consent for the exact same SKU.
* **Need-Based Replenishment**: Refill prompts follow observed depletion need, not the membership billing calendar.
* **Prescriptions Are Contextual Only**: Prescription medications inform compatible OTC routine construction; Derive does not prescribe, modify, or supply them.
* **Internal Economics Stay Internal**: Product cost, tax, shipping, founder time, and other operating costs may be tracked privately but do not alter the $25 membership promise.

---

## Onboarding & Setup Workflow (6 Perceived Stages)

1. **Welcome & Goals**: Warm introduction with leaf monogram; reassurance cards (private encryption, manual quality check before first plan, ~4 minutes); multi-select skin goals with `SelectionCard` (checkbox mode) and `ChoiceChip` priority selector. Store initializes clean with zero pre-filled demo data.
2. **Preferences**: Routine complexity (Simple & Focused, Balanced, More Involved); budget expectations (Value, Balanced, Premium When Worth It). Continue button disabled until explicit selection is made.
3. **Behavior**: Everyday skin observations (midday oil feel, post-cleansing tightness) utilizing `SelectionCard` and `SelectionRow`.
4. **Products & Safety**:
   - Shelf photo recognition of bathroom counter products.
   - **Progressive Reaction Disclosure**: Clean Yes/No entry gate. Product name, symptoms chips, and voice note only disclose if the member indicates they experienced a reaction.
   - **Safety Tri-State Audit**: Explicit tri-state tracking for pregnancy/nursing (`'yes' | 'no' | 'prefer_not_to_say'`) and sensitivities (`'none_known' | 'reported' | 'unanswered'`), preventing false negatives.
   - **Focused Retinoid Frequency**: When prescription actives (e.g. Differin) are detected, members select structured frequency choices (`1–2 nights`, `3–4 nights`, `5–6 nights`, `Every night`, `Not sure`) rather than ambiguous free text.
5. **Skin Photos (Required Baseline for Founding Beta)**:
   - Standardized 3-step sequential capture (`1 Front View` → `2 Left Profile` → `3 Right Profile`) required for paid Founding Beta members to establish longitudinal baseline context.
   - **Intended Auto-Capture UX**:
     - Camera evaluates **capture quality only**: single face detected, correct orientation, appropriate face distance/size, centered framing, adequate lighting/exposure, sufficient sharpness/focus, no severe occlusions, stable frame for a brief interval.
     - Hands-free auto-capture triggers when all quality conditions are met.
     - Member immediately previews the capture and selects `[Use Photo]` or `[Retake]`.
     - A tactile manual shutter fallback is always provided if auto-capture cannot succeed reliably or accessibly.
   - **Privacy & Biological Invariants**:
     - Quality evaluation is on-device where practical; zero persistent face embeddings or facial recognition.
     - Baseline photos do NOT diagnose clinical conditions, determine exact skin type, measure hydration/sebum quantitatively, replace self-reported history, or infer race/ethnicity/Fitzpatrick.
6. **Review & Audit**: Grouped review card with direct `[Edit]` links per section, an understated `$25/month` Founding Beta membership card that clearly states products are purchased separately, and reassurance that the first plan receives a final manual quality check before going live. Tapping `[Build My Plan]` transitions the user directly to the main app with `isPlanUnderReview: true`.

---

## Operational Workflows & Trust Boundaries

### 1. Founding Beta Concierge Operating Model
- **Core Principle**: *Sell the future Derive outcome now; deliver it manually where necessary.*
- For the first 10 paying members, Kanuj manually reviews intake, baseline photos, routine construction, product sourcing/fulfillment, check-ins, and conducts biweekly customer research conversations.
- The scalable long-term product remains AI-led and software-managed. Concierge operations bridge learning without creating a permanent founder consultation promise.

### 2. Routine Change & Member Approval Policy
To preserve customer agency and trust, Derive establishes an explicit boundary between autonomous operations and changes requiring explicit member consent:
- **Derive May Automatically**:
  - Ingest and interpret weekly check-in logs.
  - Update internal tolerance observations and barrier history.
  - Generate progress summaries and learned insights.
  - Determine that no routine adaptation is needed ("Everything on track").
  - Formulate proposed routine modifications with supporting evidence.
  - Estimate approaching product depletion and refill timing.
  - Dispatch operational reminders and routine status notifications.
- **Explicit Member Approval REQUIRED Before Activation For**:
  - Adding a new product to the active routine.
  - Replacing an existing product with a different formula.
  - Permanently removing or stopping a routine step.
  - Materially altering the frequency or application intensity of a strong active (e.g. retinoids, exfoliating acids).
  - Introducing an additional strong active ingredient.
  - Reintroducing any ingredient or formula materially connected to a recorded past adverse reaction.
  - Any new or changed product that would create a separate product charge.
  - Sourcing, purchasing, or shipping a new or substitute product not covered by existing standing consent.
- **Prescription Boundaries**: Derive does NOT have autonomous authority to modify, prescribe, or discontinue prescription treatments. Derive manages compatible OTC skincare around member-reported prescription schedules.
- **Safety Circuit Breaker**: Severe or emergency symptoms (facial swelling, respiratory distress, pus/oozing) bypass normal optimization and trigger immediate clinical referral.

### 3. Refill Consent Policy
- **Low-Friction Confirmation**: Founding Beta same-product replenishment utilizes an explicit low-friction prompt: *"Running low on [product]? Refill"*.
- **No Calendar Theater**: No silent automated shipments based solely on elapsed days; no fake deterministic depletion models.
- **Future Standing Consent**: Members may explicitly opt a stable, previously approved SAME SKU into auto-replenishment with advance shipment notifications and a 1-tap skip option.
- **Substitutions & New SKUs**: Any SKU substitution, brand change, or price modification requires explicit affirmative member approval.

### 4. Founder Research Conversations
- Biweekly-ish conversations with the first 10 members are conducted strictly as **customer research and beta feedback sessions**.
- They are NOT a permanent recurring consultation feature or promised personal founder access.
- Learning focus: what members followed, what they ignored, outside purchases, friction points, cancellation risks, and whether cognitive load was genuinely reduced.

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
