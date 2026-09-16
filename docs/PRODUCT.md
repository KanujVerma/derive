# Derive Product Specification (V1)

## Product Ethos: Set-It-and-Forget-It
Derive eliminates the cognitive overhead of skincare. The member provides observations and counter products; Derive handles the interpretation and maintenance.

---

## Canonical V1 Navigation (5 Native Tabs)

### 1. Today ("What matters right now")
- **2-Second Glance**: Top greeting stating routine status (`Good evening, Arthur. Everything looks on track. No changes today.`).
- **Tonight Routine Preview**: Compact preview card showing ordered steps, timing, and direct link to routine.
- **Active Refill Tracker**: Prominent status banner displaying shipment status, carrier, and estimated arrival.
- **New For You Research Card**: 1 curated clinical paper with plain-English summary and routine relevance.
- **Anti-Anxiety Design**: Zero streaks, zero checkboxes, zero completion guilt.

### 2. Plan ("Your canonical routine and shelf audit")
- **Canonical Routine List**: Step-by-step morning and evening sequences.
  - Numbered circular order indices.
  - Active schedule indicators (e.g. `MON / WED / FRI`).
  - Expandable drawer with exact dosage amounts (`1-2 pumps`), target zones, and personalized rationales.
- **Counter Shelf Audit**: Complete inventory of the user's products tagged with action badges:
  - `KEEP`: Product is well-tolerated and aligns with goals.
  - `PAUSE`: Temporarily held while barrier stabilizes or active retinoid ramps up.
  - `REPLACE`: Quality formula, but redundant with an existing step.
  - `ADD`: Missing step recommended to fulfill a goal (e.g. daily morning SPF).

### 3. Scan ("Does this product fit me?")
- **Center Native Tab**: Accessible via viewfinder icon at position 3.
- **Instant Camera Viewfinder**: Rapid recognition of bottle label or barcode.
- **Confirmation Step**: Confirms product name and brand before verdict generation.
- **6 Categorical Verdicts**:
  - `GREAT FIT`: Perfect compatibility with current routine.
  - `COULD WORK`: Usable with specific frequency or conditions.
  - `NOT NEEDED`: Redundant with an existing active.
  - `BETTER AS A REPLACEMENT`: High quality, but should replace rather than stack.
  - `USE WITH CAUTION`: Elevated irritation risk (e.g. BHA acid when scheduled for Differin).
  - `NOT A GOOD FIT RIGHT NOW`: Incompatible with barrier state or medical treatment.
- **Structured Response**:
  - 1-sentence verdict reason.
  - Routine impact: *What it would change or replace*.
  - 2-3 factual *Why this is specific to you* bullets.
- **Handoff to Ask**: 1-tap `[Ask Derive About This]` button opens Ask pre-seeded with context banner without re-scanning.

### 4. Ask ("Contextual skincare conversation")
- **Grounding Context**: Explicit context indicator: *"Answers based on your routine, skin history, and what we've learned about you."*
- **Scanned Product Context Banner**: Displayed when routed from Scan or when a product is attached.
- **Voice Dictation Button**: Tactile microphone button next to composer with speech-to-text transcription.
- **Clinical Safety Circuit Breaker**: Severe allergic symptoms immediately halt chat and surface emergency guidance.

### 5. Progress ("Longitudinal skin record")
- **Weekly Check-In Card**: 30-second structured check-in (skin state, irritation, adherence, optional notes/photo).
- **Photo Comparison**: Side-by-side baseline vs. latest photo comparison across Front, Left, and Right angles.
- **Learned Insights**: Plain-English observations with clear provenance labels (`From your check-ins`, `From your routine history`).
- **Timeline Events**: Milestone log of routine changes and barrier developments.

---

## Onboarding & Setup Workflow (6 Perceived Stages)
1. **Welcome & Goals**: Warm introduction with leaf monogram; reassurance cards (private encryption, human review, ~4 minutes); multi-select skin goals.
2. **Preferences**: Routine complexity (Simple & Focused, Balanced, More Involved); budget expectations (Value, Balanced, Premium When Worth It).
3. **Behavior**: Everyday skin observations (midday oil feel, post-cleansing tightness).
4. **Products & Safety**:
   - Shelf photo recognition of bathroom counter products.
   - Adverse reaction capture (body area, symptoms, historical ingredient snapshot).
   - Reordered safety questionnaire (known allergies search, shelf-aware prescription check for Differin, pregnancy/nursing clarification).
5. **Skin Photos**: Guided 3-angle capture (Front, Left, Right) with optional voice-enabled context note.
6. **Review & Audit**: Factual summary card ("Take a quick look before we build your plan") and `[Build My Plan]` CTA.

---

## Operational Workflows
- **Managed Refills (`app/orders`)**: Transparent 4-stage shipment tracker (`Requested` → `Ordered` → `Shipped` → `Delivered`). 1-tap refill request without false automatic depletion claims.
- **Founder Routine Review (`app/founder`)**: Founder review console for inspecting initial routine proposals, validating ingredient safety, and publishing approved routines.
