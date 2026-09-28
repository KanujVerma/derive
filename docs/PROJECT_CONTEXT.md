# Project Context: Derive

## Current approved strategy (2026-09-28)

Derive is scanner-first personalized skincare product intelligence. The customer has one intent: **“Check this product.”** Auto camera, search, barcode, package evidence, and recovery are ways to provide evidence, not separate truth systems. Complexity belongs behind the interface; customers should not need to know the recognition method or backend vocabulary.

All supported inputs converge on S6 product/formula truth and ProductTruthSnapshotV1 before a personal decision. Auto camera is the current default, with supported barcode observation and package-photo capture; an unclassified still requires manual role clarification. Photo-library product upload is the next high-value target. URL paste and Share to Derive are later conveniences. Product Compare is approved near-term post-MVP, not a current feature. See [ROADMAP.md](ROADMAP.md), [PRODUCT.md](PRODUCT.md), [COMMERCE.md](COMMERCE.md), [DESIGN.md](DESIGN.md), and [OWNERSHIP.md](OWNERSHIP.md).

The $25/month Managed Skincare offer remains a paid hypothesis. Pricing, retention, and hosted billing activation are not validated by a display price or local flow. No universal product/compatibility/health score is used.

The latest founder direction targets public Derive plus real Plus or Founding Plus access, with Managed shown as Early Access. The older Sami P0-C Free-only barcode/name checkpoint is the explicit fallback if Plus billing delays release. Final candidate scope is open. Plus is an evaluated self-directed cross-product product, while Managed is delegated ongoing care; proposed Founding grants, quotas and Plus prices are experiments, not active customer access. [MONETIZATION.md](MONETIZATION.md), [FOUNDING_PLUS_ENTITLEMENT.md](FOUNDING_PLUS_ENTITLEMENT.md) and [APP_STORE_RELEASE_READINESS.md](APP_STORE_RELEASE_READINESS.md) keep offer, client preparation and release evidence separate. The former 18+ target has been reopened; first-release audience treatment is undecided.

## Implementation checkpoint at main 39c0fed (historical source snapshot)

PR #108 and #110 are merged. The current camera starts in Auto, keeps supported barcode observation active, and allows package-photo capture. PR #110 handles checksum-valid iOS UPC-A observations normalized by Expo Camera; actual iPhone barcode acceptance remains unverified. If a still is unclassified, the customer selects which package detail it contains before using it. Automatic photo-role classification, OCR, VLM extraction, and cloud video are not implemented.

The canonical product Check has no camera-roll/photo-library picker, product URL paste, OS Share input, or Product Compare. Search and manual recovery remain core paths. S6 and local ProductTruthSnapshotV1 preserve product/formula authority. P0-B currently provides locally/CI-proven findings, versioned decision policy, packet, and same-snapshot composition; this does not establish physical/customer acceptance or hosted release.

PR #109 is merged offline benchmark/replay tooling. It has not called a provider, uploaded images to a provider, or measured image-extraction performance. No image provider is selected, and the preliminary image intake does not meet rights-cleared independent-gold requirements. PR #112 adds a read-only offline hosted-free readiness preflight; all hosted gates remain UNKNOWN and activation remains BLOCKED. Remote Staging/production retain legacy managed routing, and scanner-first external beta is not ready.

**Current 2026-09-28 source update:** Offline soft-judgment benchmark #130, coarse analytics contract #131, monetization evidence #129, provider-neutral client entitlement projection #133, source-only App Store scorecard #134 and fixture-only tier presentation #135 are merged. None adds a production analytics sink, Plus grant, customer Check quota enforcement, provider-backed judgment, hosted anonymous activation, exact binary or physical acceptance. A fresh exact-project read-only inventory at `666f6d3` found 15 of 21 source Edge Function names and 19 of 29 source migration versions hosted; Auth config remains UNKNOWN. See [KANUJ_PORTFOLIO.md](KANUJ_PORTFOLIO.md) and [CONTEXT_SYNC.md](CONTEXT_SYNC.md).

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
