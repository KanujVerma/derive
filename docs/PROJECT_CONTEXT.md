# Project Context: Derive

## Current approved strategy (2026-09-23)

Derive is personalized skincare product intelligence first: a free Check acquisition wedge for factual, evidence-bounded product information and optional personal fit. The paid target is **$25 Managed Skincare**, ongoing routine construction and management. No universal score. See [ROADMAP.md](ROADMAP.md) for the current product flow, access matrix, milestones, gates and open implementation questions.

**Not implemented yet:** silent Supabase anonymous Auth, free access without managed entitlement, optional minimal profile persistence, deterministic baseline fit, target CHECK / MY STUFF / PLAN / SHOP navigation, and scanner-first external beta. Current C1/E1 runtime remains managed-first. The anonymous target is authenticated-role Auth with an anonymous identity claim and requires a dedicated RLS/security review.

**Current evidence:** PR #36/#37 catalog search and Check routes exist, but Remote Staging hides Check. The hosted catalog handoff has 4 products, 1 sourced product, 1 alias and no variants, identifiers or formula versions. PR #39 closes the catalog UUID handoff to routine persistence; hosted live-provider behavior remains H1P-unproven.

## Historical managed-first project context (superseded as product strategy)

The material below preserves prior Founding Beta and C1 product framing and release context. It may describe shipped runtime behavior, but it is not the approved target positioning, access model, navigation, or next-work plan. Read the current Roadmap and Ownership first.

## The Customer Promise
**"Your skincare, handled."**

Derive is a managed skincare service. Customers provide their observations, bathroom counter bottles, and skin history; Derive performs the interpretation, establishes and manages a single canonical routine, answers questions, checks in weekly, and replenishes verified products.

---

## 1. Founding Beta Operating Model (Concierge MVP) — APPROVED EXPERIMENT

The immediate business objective is for customer #1 to pay $25, complete the real app journey, and receive a trustworthy routine, then learn from **10 real paying Founding Beta members**. Broader customer discovery remains useful, but the first-10 operation is a concierge MVP.

### Core Operating Principle
> **Sell the future Derive outcome now; deliver it manually where necessary.**

The long-term scalable product is AI-led and software-managed. For the initial 10 Founding Beta members, authorized founders may manually perform or review operational tasks that future software, platform workflows, and intelligence services will automate:
- Manually reviewing intake submissions and baseline skin photos.
- Manually constructing or deeply reviewing the initial routine proposal.
- Manually checking early system-generated recommendations and verdicts.
- Helping members source and purchase approved routine products separately from membership; any founder fulfillment follows explicit beta terms.
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
  6. Product acquisition and refills are handled honestly under beta terms; the $25 membership does not include products.

---

## 2. Founding Beta Pricing — Approved $25 Management Membership (Products Separate)

* **Status**: **IMPLEMENTED (I1-B4A / ADR-26)**. Current runtime uses `config.betaPriceMonthly = 25` and `founding_beta`.
* **Price Point**: Flat **$25/month** Founding Beta experiment for Derive managing the member's skincare. Not "$25 for AI." Not a lifetime company price.
* **Products**: Purchased separately. Membership price is independent of routine size, retail cost, lifespan, and refill rate. No V1 membership tiers.
* **Strategic Rationale**:
  - Validates genuine recurring willingness-to-pay **for management**, independent of product cost.
  - Preserves KEEP / consent / need-based refill operating principles from ADR-21.
  - Thin or negative first-basket unit economics remain possible while founders assist product purchasing; mature unit economics are NOT claimed.
* **Customer-Facing Concept**:
  - Membership pays for Derive managing skincare (routine, check-ins, Scan, Ask, Progress, beta founder review).
  - Products are separate transactions. No product wallet, credit balance, or rollover allowance.
  - **Preserve Working Products**: Existing counter products that already work are retained (`KEEP`).
  - **Refills by Need, Not Calendar Theater**: Same-SKU refills may stay low-friction; new SKUs require explicit consent.
  - **Prescriptions Are Contextual Only**.
  - **Weekly check-in context (I1-B4B)**: optional tags + one note are history for comparison, not proven causes. No food diary or period tracker.
  - **Commercial Independence**: Monetization must not silently change recommendations.
* **Historical (do not delete)**: ADR-21 $100/month all-in/products-included experiment; ADR-10 $129; ADR-15 Arthur $96/mo routine-derived prototype. All superseded as commercial direction.
* **Commerce State**: S5 membership Checkout and Portal are implemented, with hosted Stripe activation owned by Sami and still pending. H1A's disposable admin entitlement is only a post-auth test fixture. C1 member Shop and C1.5A acquisition foundation are landed, with zero production merchant listings. C1.5B feeds/attribution and C1.5C physical checkout are parked while the first-10 concierge flow is proven. No sixth tab.

---

## 3. Product Philosophy: Autopilot vs. Depth

"Autopilot vs. Depth" is a core product philosophy, **NOT a user settings toggle or separate app modes**.

* **Default Derive Experience (Autopilot)**:
  A member who does not want to think about skincare should only need Today + Plan + lightweight check-ins + approvals. Derive handles scheduling, monitoring, and replenishment in the background.
* **Optional Depth**:
  Members who want deeper understanding can explore Scan (viewfinder evaluation), Ask (grounded conversational intelligence), Progress (longitudinal photo comparisons and insights), and research cards at their own pace.
* **Canonical Navigation Preserved**:
  All members navigate the same 5 primary native tabs: `Today` | `Plan` | `Shop` | `Ask` | `Progress`.

---

## 4. Service Composition
The Founding Beta delivers:
1. **Audited Canonical Routine**: Morning and evening sequences with personalized dosage amounts, application zones, and active schedules.
2. **Bathroom Shelf Audit**: Evaluation of counter bottles into KEEP, PAUSE, REPLACE, and ADD.
3. **Shop & Dedicated Viewfinder Scanner**: In-store and counter evaluation verifying whether prospective products fit their active barrier and routine, plus acquisition for recommended steps.
4. **Contextual Ask Derive**: Conversational intelligence grounded in active products, retinoid schedules, and tolerance history.
5. **Weekly Check-Ins & Progress**: Longitudinal tracking of tolerance, barrier stability, and photo comparison.
6. **Managed Refills**: Low-friction replenishment of standard routine products without automated depletion illusions.

---

## 5. Operating Principles & Safety Boundaries
- **Third-Party Products Only**: We do not formulate custom white-label bottles. We curate established, reliable dermatological formulas (CeraVe, La Roche-Posay, Differin, EltaMD).
- **Phenotype-Aware, Never Race-Aware**: Skincare personalization is grounded in observable cutaneous biology (pigmentation depth, undertone, post-inflammatory response, hair curl pattern). We strictly prohibit race/ethnicity classifiers, CV colorimetry, or demographic recommendation rules.
- **Cosmetic Skincare, Not Medicine**: We advise on over-the-counter routines and cosmetic tolerance. We never diagnose skin diseases or treat clinical pathology.
- **Scalable AI-Led Care Loop with Concierge Beta Bridge**: The long-term scalable Derive service is AI-led and software-managed, executing routine adaptations, weekly check-in assessments, and learned insights automatically when supported. For the initial 10-member Founding Beta cohort, authorized founders may manually review early recommendations, proposed adjustments, and check-ins to ensure quality and accelerate learning. F1, owned by Sami, supplies the in-app manual routine publication fallback. Recurring private founder consultation is not the permanent product promise.
- **Speed & Learning Over Premature Moats**: Real customer retention and paid conversions teach us what features actually matter.
- **Long-Term Defensibility**: Lies in proprietary longitudinal context—knowing how specific skin types and barrier histories react to active combinations over 3–12 months.
