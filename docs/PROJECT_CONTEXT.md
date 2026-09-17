# Project Context: Derive

## The Customer Promise
**"Your skincare, handled."**

Derive is a managed skincare service. Customers provide their observations, bathroom counter bottles, and skin history; Derive performs the interpretation, establishes and manages a single canonical routine, answers questions, checks in weekly, and replenishes verified products.

---

## 1. Founding Beta Operating Model (Concierge MVP) — APPROVED EXPERIMENT

The immediate business objective is to recruit **10 real paying Founding Beta members** quickly while simultaneously conducting 50–100 broader customer-discovery conversations.

### Core Operating Principle
> **Sell the future Derive outcome now; deliver it manually where necessary.**

The long-term scalable product is AI-led and software-managed. For the initial 10 Founding Beta members, Kanuj will manually perform or review operational tasks that future software, platform workflows, and intelligence services will automate:
- Manually reviewing intake submissions and baseline skin photos.
- Manually constructing or deeply reviewing the initial routine proposal.
- Manually checking early system-generated recommendations and verdicts.
- Manually sourcing, purchasing, and fulfilling approved routine products.
- Manually reviewing weekly check-in logs when necessary.
- Manually monitoring product refill timing and operational exceptions.
- Conducting biweekly-ish customer research and feedback conversations.

### Operational Boundaries & Safeguards
- **Not a Personal Consulting Practice**: Manual concierge delivery for the first 10 members is an operational bridge for learning, NOT a pivot into a private skincare consulting business.
- **No Permanent Founder Consultation Promise**: Customer-facing value is always anchored in Derive the managed service, not personal access to Kanuj.
- **Core Customer-Facing Value**:
  1. Derive understands the member's goals, history, current products, tolerance, and progress.
  2. Derive establishes and manages one trusted, audited routine.
  3. Derive helps the member know what to keep, pause, replace, or add.
  4. Derive learns what happens over time and proposes justified adaptations.
  5. Derive prevents wasteful, incompatible, or redundant product purchases.
  6. Approved managed OTC products are fulfilled and replenished according to beta terms.

---

## 2. Founding Beta Pricing Experiment — $100/Month (First 10 Only)

* **Status**: **APPROVED BETA EXPERIMENT** (Distinct from long-term pricing architecture).
* **Price Point**: Flat **$100/month** for the initial 10 paying Founding Beta members.
* **Strategic Rationale**:
  - Validates genuine recurring willingness-to-pay, member routine adherence, and month-two retention.
  - Lowers signup friction to secure 10 committed paying members rapidly.
  - Thin or negative first-basket unit economics are intentionally tolerated for this 10-person learning cohort; mature unit economics are NOT claimed.
* **Customer-Facing Concept**:
  - One all-in monthly price covers Derive management plus the standard non-prescription facial skincare products needed for the member's approved routine.
  - **No Product Wallet or Credit Allowance**: The member does NOT receive a product wallet, credit balance, rollover allowance, or "$X of products."
  - **Preserve Working Products**: Existing counter products that already work are retained (`KEEP`); Derive does not ship duplicate bottles merely because someone pays monthly.
  - **Refills by Need, Not Calendar Theater**: Replenishment shipments follow actual consumption need, never arbitrary billing calendar cadences.
  - **Prescriptions Are Contextual Only**: Prescription medications (e.g. Tretinoin, oral treatments) are contextual inputs, never products Derive prescribes, modifies, or supplies.
  - **Discretionary Luxury Exclusions**: Unusually expensive discretionary/luxury products are not silently guaranteed by all-in beta terms.
* **Internal Beta Economics**:
  Tracked privately per member (subscription payment, first-basket wholesale cost, steady-state normalized recurring product cost, shipping/tax, founder time, replacement/refund costs); internal fee structures are never exposed as a customer-facing breakdown.
* **Long-Term Pricing Architecture**:
  The personalized all-in monthly pricing architecture (ADR-15, prototyped in `src/pricing/` with Arthur's $96/mo illustrative demo fixture) remains **PROVISIONAL / PENDING COFOUNDER BUSINESS REVIEW** and will be informed by evidence gathered from this 10-member beta. ADR-10's historical flat $129/mo pricing is superseded.

---

## 3. Product Philosophy: Autopilot vs. Depth

"Autopilot vs. Depth" is a core product philosophy, **NOT a user settings toggle or separate app modes**.

* **Default Derive Experience (Autopilot)**:
  A member who does not want to think about skincare should only need Today + Plan + lightweight check-ins + approvals. Derive handles scheduling, monitoring, and replenishment in the background.
* **Optional Depth**:
  Members who want deeper understanding can explore Scan (viewfinder evaluation), Ask (grounded conversational intelligence), Progress (longitudinal photo comparisons and insights), and research cards at their own pace.
* **Canonical Navigation Preserved**:
  All members navigate the same 5 primary native tabs: `Today` | `Plan` | `Scan` | `Ask` | `Progress`.

---

## 4. Service Composition
The Founding Beta delivers:
1. **Audited Canonical Routine**: Morning and evening sequences with personalized dosage amounts, application zones, and active schedules.
2. **Bathroom Shelf Audit**: Evaluation of counter bottles into KEEP, PAUSE, REPLACE, and ADD.
3. **Dedicated Viewfinder Scanner**: In-store and counter evaluation verifying whether prospective products fit their active barrier and routine.
4. **Contextual Ask Derive**: Conversational intelligence grounded in active products, retinoid schedules, and tolerance history.
5. **Weekly Check-Ins & Progress**: Longitudinal tracking of tolerance, barrier stability, and photo comparison.
6. **Managed Refills**: Low-friction replenishment of standard routine products without automated depletion illusions.

---

## 5. Operating Principles & Safety Boundaries
- **Third-Party Products Only**: We do not formulate custom white-label bottles. We curate established, reliable dermatological formulas (CeraVe, La Roche-Posay, Differin, EltaMD).
- **Phenotype-Aware, Never Race-Aware**: Skincare personalization is grounded in observable cutaneous biology (pigmentation depth, undertone, post-inflammatory response, hair curl pattern). We strictly prohibit race/ethnicity classifiers, CV colorimetry, or demographic recommendation rules.
- **Cosmetic Skincare, Not Medicine**: We advise on over-the-counter routines and cosmetic tolerance. We never diagnose skin diseases or treat clinical pathology.
- **AI-Led Care Loop with Founder Quality Net**: Routine adaptations, weekly check-ins, and learned insights are 100% AI-led and automated. A fast, high-touch manual founder quality check serves as a safety net exclusively for initial routine proposals before first activation.
- **Speed & Learning Over Premature Moats**: Real customer retention and paid conversions teach us what features actually matter.
- **Long-Term Defensibility**: Lies in proprietary longitudinal context—knowing how specific skin types and barrier histories react to active combinations over 3–12 months.
