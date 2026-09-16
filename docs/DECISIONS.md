# Derive Architecture Decision Records (ADRs)

Key technical and product decisions accepted for Derive V1.

---

### ADR-01: React Native + Expo Router over Native Swift
* **Decision**: Build V1 on React Native with Expo Router.
* **Rationale**: Enables unified iOS, web, and future Android support with rapid iteration velocity, while retaining native iOS performance, haptics, and camera capabilities.

### ADR-02: Five Primary Native Tabs with Center Scan
* **Decision**: Adopt a 5-tab architecture: `Today` | `Plan` | `Scan` | `Ask` | `Progress`.
* **Rationale**: Elevates product scanning to a first-class native destination at position 3, providing immediate in-store utility without requiring users to navigate into chat.

### ADR-03: Scan Separated from Ask
* **Decision**: Provide a dedicated Scan tab while allowing 1-tap handoff into Ask.
* **Rationale**: Fast evaluation requires a zero-friction viewfinder and structured categorical verdict. Deeper questions can flow into Ask without cluttering the scanner.

### ADR-04: Direction A (Mineral) Design Language
* **Decision**: Style V1 using Warm Ivory (`#F6F3EC`), Elevated Surface (`#FFFEFB`), Architectural Charcoal (`#171A18`), and Mineral Green (`#345447`).
* **Rationale**: Delivers an understated luxury aesthetic that feels calm and restorative, distinctly separated from neon habit trackers or cold clinical portals.

### ADR-05: Supabase as Core Platform
* **Decision**: Use Supabase (Postgres, RLS, Auth, Edge Functions, Private Storage).
* **Rationale**: Delivers reproducible relational schema migrations, rock-solid row-level security for private health data, and fast serverless functions without heavy cloud infrastructure.

### ADR-06: Mock-First Service Contract Boundary
* **Decision**: Freeze `IDeriveService` shared contract; mobile consumes `MockDeriveService` while backend implements `RemoteDeriveService`.
* **Rationale**: Unblocks Kanuj (mobile) and Sami (backend) to work independently for days without blocking on each other.

### ADR-07: Kanuj & Sami Ownership Split
* **Decision**: Kanuj owns mobile UX, client AI experience, navigation, components, and design tokens. Sami owns Supabase, migrations, RLS, server AI workflows, operations console, and commerce.
* **Rationale**: Eliminates cross-lane merge conflicts and establishes crystal-clear accountability.

### ADR-08: Categorical Verdicts over Numerical Scores
* **Decision**: No arbitrary numerical ratings (e.g. "82/100" or "Clean/Dirty"). Use 6 clear categorical verdicts (`GREAT FIT`, `COULD WORK`, `NOT NEEDED`, `BETTER AS A REPLACEMENT`, `USE WITH CAUTION`, `NOT A GOOD FIT RIGHT NOW`).
* **Rationale**: A product is neither good nor bad in the abstract; fit is entirely contextual to this user's active routine and skin barrier.

### ADR-09: Research Intelligence as P1
* **Decision**: Surface curated clinical research directly in Today and Plan.
* **Rationale**: Builds member trust and demonstrates that Derive is grounded in published dermatological literature rather than influencer marketing.

### ADR-10: Manual Operations & $129/Month Canonical Pricing
* **Decision**: Launch Founding Beta at $129/month for 10 initial members with manual founder review and manual fulfillment desk.
* **Rationale**: High-touch founder concierge ensures quality and fast customer learning before premature operational automation.

### ADR-11: Gemini Credentials Stay Server-Side
* **Decision**: The Expo/mobile client never embeds a Gemini API key and never calls Gemini directly. Live model invocation belongs in the trusted Supabase/server environment behind `RemoteDeriveService`.
* **Rationale**: A client-visible Gemini key would expose a paid API credential and send customer health context from the device. Kanuj continues on `MockDeriveService` with deterministic local reasoning; Sami owns server secrets and Edge Function orchestration.

### ADR-12: Semantic UI Primitives & Spatial Layout Grammar
* **Decision**: Refactor all customer screens onto centralized semantic UI primitives in `src/components/ui/` (`Screen`, `ScreenHeader`, `StatusBadge`, `StickyActionFooter`, `SelectionRow`, `SelectionCard`, `ChoiceChip`, `SegmentedControl`, `GroupedSection`, `TextField`, `VoiceTextArea`, `InfoBanner`, `EmptyState`) governed by explicit spatial grammar (`layout.gutter: 24`, `sectionGap: 32`, `itemGap: 16`, `minTouchTarget: 44`, `ctaHeight: 54`) and semantic state tokens (`actionReview: #8C6D3B`).
* **Rationale**: Replaces fragmented inline styles, eliminates layout drift, enforces Apple Human Interface Guidelines for 44pt minimum touch targets, and establishes an authoritative component library for future velocity without changing the core Mineral palette.

### ADR-13: AI-Led Longitudinal Care Loop & Non-Blocking First-Plan Review
* **Decision**: Weekly check-ins and routine adaptations are 100% AI-led and automated based on logged skin tolerance and progress comparisons; there are zero recurring manual consultations. Only the first proposed routine generated at onboarding receives a manual quality check by the founders before activation (`awaiting_review`). This review state is strictly non-blocking: members retain full access to Today, Plan preview, Scan, Ask, and Profile, accompanied by a quiet, reassuring `InfoBanner` indicating verification is underway.
* **Rationale**: Scales the service efficiently without founder burnout while providing a human safety net during initial customer intake. Eliminates frustrating modal lockouts that prevent new members from using their app.

### ADR-14: Canonical Single Scanner Architecture & Split Verdict Model
* **Decision**: Consolidate camera scanning into a single, uncluttered camera-first viewfinder on the `Scan` tab. Remove manual mode selector buttons (Front / Barcode / Ingredients) in favor of automatic multi-attribute recognition with fallback text search. Route all scanner prompts from Ask to `/scan`. Structure product evaluations into two distinct sections: (1) `FIT FOR YOU RIGHT NOW` (categorical verdict, active routine impact, personalized rationale) and (2) `FORMULA QUALITY` (objective category, key actives, formulation standard).
* **Rationale**: Eliminates user confusion over scanner modes, deletes redundant camera code in the Ask tab, and cleanly decouples an ingredient's objective cosmetic quality from whether it is safe and beneficial for this user's current skin barrier and prescription schedule.

### ADR-15: [PROVISIONAL · PENDING COFOUNDER REVIEW] Personalized All-In Monthly Pricing Architecture & Price Stability Contract
* **Status**: PROVISIONAL / PENDING COFOUNDER BUSINESS REVIEW (Prototyped in client/mock layer by Kanuj; not yet reviewed or accepted by Sami; Arthur's $96/mo is an illustrative deterministic demo fixture, not a commercial pricing commitment; final economics, ranges, and commercial structure pending founder alignment).
* **Proposal**: Explore transitioning away from universal flat-rate $129/month assumptions toward a personalized, all-in monthly plan pricing model computed from the member's active routine:
  `monthlyPlanPriceCents = PROVISIONAL_DEMO_MANAGEMENT_FEE_CENTS ($39/mo) + normalizedProductConsumptionCents + PROVISIONAL_DEMO_OPERATIONS_RISK_CENTS ($5/mo)`.
  Product consumption is normalized to a 30-day rate via `Math.round(retailPriceCents * 30 / estimatedLifespanDays)`.
  Any routine adjustment that would increase the monthly plan price requires explicit member approval (`requiresMemberApproval: true`).
  In V1, routine complexity and product cost preference remain separate onboarding choices; pricing is derived from the resulting routine, not preset subscription tiers.
* **Economic Distinctions**:
  - **Steady-State Monthly Product Consumption**: Expected normalized cost of products over time.
  - **Current Inventory / Shipment Timing**: Existing counter bottles affect when Derive ships the next refill, not the long-run steady-state consumption.
  - **Initial Fulfillment Cost**: Cash Derive must spend near activation to fill missing/replacement products.
* **Open Decisions (Unresolved in V1 Prototype)**:
  - Prepaid product liability.
  - Cancellation before future refill.
  - First-basket financing.
  - Refund policy.
  - Internal reserve/ledger treatment.
  - Supplier payment terms.
* **Customer Presentation**: Customer sees ONE all-in price ("Estimated plan $96/month" pending first routine approval, "Current plan $96/month" after activation). Internal fee itemization ($39 management fee, $5 risk buffer) is strictly internal economics and never exposed to the customer.

### ADR-16: Tab Bar Implementation via Expo Router Standard Tabs with Custom Glass Container
* **Decision**: Implement the 5 root tabs using Expo Router standard Tabs (`@react-navigation/bottom-tabs`) styled with a floating `GlassContainer` (`tabBarBackground`) with customized haptics, hit targets, and icons, rather than experimental NativeTabs or third-party native bottom sheet tabs.
* **Rationale**: Preserves flawless cross-platform stability, avoids unverified native binary dependencies, and allows floating pill styling with directional glass effects.


### ADR-17: [PROVISIONAL · CLIENT PROTOTYPE] Phenotype-Aware, Never Race-Aware Skin Modeling
* **Status**: PROVISIONAL CLIENT ARCHITECTURE IMPLEMENTED, backend adoption pending (Implemented in `src/phenotype/` by Kanuj; backend schema unchanged; pending Sami platform review).
* **Decision**: Ground skin modeling exclusively in observable cutaneous attributes and response mechanics (`PigmentationFamily`, `Undertone`, `SunResponse` (behavior-only: burns_easily, burns_then_tans, etc.), `PihTendency`, `WhiteCastConcern`, `RazorBumpHistory`, `HairCurlPattern`).
* **Hard Prohibitions**: Zero race classifiers, zero ethnicity classifiers, zero ancestry inference, zero demographic recommendation rules (e.g. "Black -> product X"), and zero Fitzpatrick-as-race mappings.
* **Confirmation Invariant**: Every phenotype attribute carries explicit provenance (`ProvenancedValue<T>`) with categorical confidence (`low` | `medium` | `high`). Explicit member confirmation strictly outranks unconfirmed photo estimates (`setOrConfirmPhenotypeValue`). Stale estimates cannot overwrite confirmed truth.
* **V1 Onboarding Invariant**: Normal V1 onboarding funnels only collect one single new adaptive phenotype signal: *"Do breakouts or irritation usually leave dark marks that stick around?"* (shown only when `breakouts` or `dark_spots` goals are selected). Shade depth, undertone, sunscreen white cast, and shaving habits are collected contextually (e.g. during tinted sunscreen evaluation or shaving questions) rather than lengthening onboarding.

### ADR-18: Research Evidence Grading & Member Applicability Policy
* **Decision**: Decouple scientific evidence quality from individual member applicability.
* **Evidence Hierarchy**:
  - **Grade A / B**: High-quality RCTs, systematic reviews, or robust cohort studies. Eligible to influence routine decisions ONLY IF `directRoutineInfluenceAllowed` is true and all member applicability criteria and required product context (`EvidenceApplicabilityContext`) match (failing closed if context is missing).
  - **Direct Influence Hard-Block**: If `directRoutineInfluenceAllowed` is false, routine changes are blocked regardless of methodological grade.
  - **Grade C**: Small trials, observational studies (e.g. dairy-acne meta-analyses), or mechanistic research. Can inform educational context in Ask or research cards, but CANNOT silently modify active routines or force product swaps.
  - **Grade D**: Preliminary in-vitro data or anecdotal reports. Excluded from driving any routine or product behavior.
* **Non-Causal Rule**: Observational population correlations must never be converted into automated individual interventions or prescriptive dietary rules.

### ADR-19: Categorical Tint Compatibility & Mineral White-Cast Assessment
* **Decision**: Evaluate tinted formulations (e.g. tinted mineral sunscreens) using categorical matching (`likely_match`, `possible_match`, `needs_confirmation`, `unlikely_match`) rather than fake numeric percentages.
* **Confirmation Requirement**: If a member's pigmentation depth is unconfirmed or estimated, tint evaluation returns `needs_confirmation` before claiming compatibility.
* **Iron Oxide Photoprotection**: Detect and highlight iron-oxide benefits (HEV / visible light blocking) ONLY when a member has confirmed post-inflammatory hyperpigmentation tendency (sometimes or often); never infer treatment benefits from pigmentation depth alone.
* **White Cast Assessment**: Assesses white-cast friction using verified catalog or member observation matched against member cast concern; strictly avoids speculative formula-only prediction algorithms.
