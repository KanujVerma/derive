# Derive Commerce Architecture (C1 / Shop V1)

**Source of Truth**: Canonical architecture for Derive Shop, customer-facing commerce, and product acquisition.
**Owner**: Kanuj (Customer Experience + Mobile) with Platform/Shared integration points noted.
**Status**: C1 IMPLEMENTED on draft branch `kanuj/c1-shop-v1`; S5 membership billing integration in progress (`sami/s5-commerce-remote-integration`); physical commerce backend DEFERRED to C1.5.

---

## 1. Executive Summary & Core Principle

Derive is **not** a generic skincare marketplace. Shop answers:
> *"What does Derive think I actually need, and how do I get it?"*
not:
> *"Which of thousands of skincare products should I browse?"*

Long-term product loop mental model:
- **PLAN**: Decides what belongs in the member's skincare routine (clinical/dermatological reasoning).
- **SHOP**: Helps the customer acquire products (commerce/acquisition layer).
- **SCAN**: Evaluates products encountered elsewhere (camera/barcode intelligence).
- **ASK**: Explains decisions, ingredients, and alternatives.
- **ORDERS**: Tracks purchases, shipments, and fulfillment.

---

## 2. Status Matrix

| Component | Status | Owner | Description |
| :--- | :--- | :--- | :--- |
| **Member Navigation (Today · Plan · Shop · Ask · Progress)** | IMPLEMENTED | Kanuj | Shop replaces Scan as root tab; Scan nested inside Shop. Five root tabs. |
| **Shop Audience Model (Guest / Non-Member / Member)** | APPROVED TARGET | Kanuj | Pure client view models in `src/commerce/types.ts`. Non-member fallback architected. |
| **Canonical Single Scanner (`app/shop/scan.tsx`)** | IMPLEMENTED | Kanuj | Moved from `app/(tabs)/scan.tsx`. Route compatibility redirect preserved. |
| **Action-to-Commerce Semantics** | IMPLEMENTED | Kanuj | `resolveActionCommerceSemantics()`: ADD eligible on publish; PAUSE/STOP never; KEEP non-urgent; REPLACE never sells old product. |
| **No Universal Product Score Invariant** | IMPLEMENTED | Kanuj | Categorical fit guidance only (`GREAT FIT`, `COULD WORK`, `USE WITH CAUTION`, etc.). |
| **Calm Empty States (Plan Covered / Review Pending)** | IMPLEMENTED | Kanuj | "Your current plan is covered" — Derive encourages buying nothing when appropriate. |
| **S5 Membership Billing Separation** | IMPLEMENTED / PRESERVED | Sami / Shared | Stripe membership checkout ($25/mo) remains strictly isolated in S5. |
| **Product / Recommendation / Offer Separation** | APPROVED TARGET | Shared | Conceptual 3-way split: catalog product vs member routine action vs commercial offer. |
| **Physical Product Commerce Backend** | DEFERRED (C1.5) | Cross-founder | Order schema, SKU commerce, fulfillment provider, single-item checkout. |
| **Commerce Provider Selection (Stripe vs Shopify)** | OPEN | Cross-founder | Evaluation documented below; no premature vendor lock-in. |
| **Multi-Item Cart** | DEFERRED (V2) | Kanuj / Platform | V1/V1.5 is single-product purchase intent. Cart deferred until behavioral evidence warrants. |
| **ADR Numbering** | DEFERRED | Cross-founder | Deferred to avoid conflict with S5's `ADR-30`. Recorded here authoritatively. |

---

## 3. Access Model & Three Audience States

### A. GUEST (Unauthenticated)
- **Target Experience**: Browse public shop, view general catalog information, see factual prices, guest checkout when supported, learn about Derive membership.
- **Safety / Privacy Invariant**: Zero personalized skincare claims without authenticated, canonical routine context.
- **C1 Implementation State**: Presentation view model fallback architected in `app/(tabs)/shop.tsx`. S1 Remote auth route gating is **not** weakened. Live guest routing activation deferred to C1.5.

### B. NON-MEMBER ACCOUNT (Authenticated, No Active Membership)
- **Target Experience**: Public shop, public product facts, physical order history, Scan general information fallback, membership upsell.
- **Personalization Fallback**: Uses factual sections (`SHOP SKINCARE`, `ABOUT THIS PRODUCT`). Never fabricates a plan or fit score.
- **Membership Upsell**: Non-coercive CTA:
  > *"Want to know how this fits your skin and routine? Derive members get personalized product-fit guidance, a managed routine, weekly check-ins, and ongoing adjustments."*

### C. ACTIVE DERIVE MEMBER ($25/mo Founding Beta)
- **Full Personalization**:
  - `NEEDED FOR YOUR PLAN`: Derived from `UserProduct.action === 'ADD'` and `!isConfirmedByUser` on a published routine.
  - `YOUR ROUTINE`: Current `KEEP` products in the member's routine.
  - `SCAN A PRODUCT`: Camera/barcode scanner evaluating personal fit (`GREAT FIT`, `COULD WORK`, `NOT NEEDED`, etc.).
  - `ORDERS & REFILLS`: S2/S4 beta operational refill tracking.
  - `WHY THIS FITS YOU`: Personalized rationale linked to member skin goals and routine timing.

---

## 4. Navigation Architecture & Scan Migration

### The Five Member Root Tabs
Approved target and C1 implementation:
```text
Today · Plan · Shop · Ask · Progress
```
- **Shop replaces Scan as a root tab.** There are never six root tabs.
- **Scan is a capability; Shop is a top-level domain.** Scan now lives canonically at `/shop/scan` (`app/shop/scan.tsx`).
- **Legacy Route Compatibility**: `app/(tabs)/scan.tsx` is preserved as a lightweight redirect shim to `/(tabs)/shop`. Deep links, Ask handoffs, and starter pills route to canonical Shop Scan.
- **Single Scanner Invariant**: There is strictly **one** camera scanner implementation (`app/shop/scan.tsx`). Zero code duplication.

---

## 5. Action-to-Commerce Semantics

The single source of truth is `resolveActionCommerceSemantics(action, routineStatus)` in `src/commerce/types.ts`:

| Action | Plan Status Label | Routine Draft/Review | Routine Published/Approved | Never Sell Old Product? |
| :--- | :--- | :--- | :--- | :--- |
| **ADD** | Needed for your plan | Not acquisition-eligible (`not_applicable`) | **Acquisition-eligible** (`deferred_to_c15`) | False |
| **KEEP** | In your plan | Not acquisition-eligible | In your plan (`deferred_to_c15` optional refill) | False |
| **PAUSE** | Paused | Not acquisition-eligible (`not_applicable`) | Not acquisition-eligible (`not_applicable`) | False |
| **STOP** | Discontinued | Not acquisition-eligible (`not_applicable`) | Not acquisition-eligible (`not_applicable`) | False |
| **REPLACE** | Has recommended replacement | `view_replacement` only | `view_replacement` only | **TRUE (Never sell old product)** |

### Invariants:
1. **Unapproved Recommendations Are Never Monetized**: If `routine.status !== 'published' && routine.status !== 'approved'`, ADD items cannot produce active purchase CTAs. Members preview recommendations during review without commercial pressure.
2. **Recommendation Independence**: Skincare decisions are 100% independent of commerce. Margin, deals, or affiliate relationships cannot alter `KEEP`, `PAUSE`, `REPLACE`, `ADD`, `STOP`, or Scan verdicts.
3. **No Fake Price / No Fake Offers**: Price truth is respected. If approximate retail price is absent, it displays "Price available at checkout" or is omitted. Zero fabricated discounts or coupon banners.

---

## 6. Product / Recommendation / Offer Conceptual Separation

To survive V1 → V1.5 → V2 without architectural churn, three concepts remain decoupled:

```text
┌─────────────────────────┐
│         PRODUCT         │  Catalog truth: identity, brand, name, formula,
│   (Derive Product DB)   │  ingredients, category, cautions.
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│     RECOMMENDATION      │  Clinical/member truth: KEEP, PAUSE, REPLACE, ADD, STOP,
│      (UserProduct)      │  actionReason, schedule, frequency, timing.
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│      PRODUCT OFFER      │  Commerce truth: merchant, SKU, price, currency,
│    (C1.5 / Proposed)    │  availability, purchaseMode, fulfillmentMode.
└─────────────────────────┘
```

- **Derive** owns Product and Recommendation truth.
- **Commerce Provider** (Stripe, Shopify, or External Merchant) owns Offer, Inventory, Checkout, and Fulfillment truth.

---

## 7. Physical Commerce Provider Evaluation (Stripe vs Shopify)

Decision status: **OPEN / DEFERRED TO C1.5**.

| Criteria | Stripe (Direct) | Shopify (Headless / Storefront API) |
| :--- | :--- | :--- |
| **Primary Strength** | Custom direct payments, native Apple Pay, seamless extension of S5 Stripe billing. | Complete inventory, variants, multi-warehouse shipping, tax, returns, Shop Pay. |
| **Complexity** | High backend effort: must build order DB, tax calculation, shipment tracking, refund ops. | Lower commerce ops effort: Shopify manages inventory, tax, fulfillment integrations. |
| **Best Fit Scenario** | Derive holds small curated inventory (5-10 SKUs) fulfilled by founders or single 3PL. | Derive scales catalog, dropships, or supports complex catalog variants and merchant fulfillment. |
| **Recommendation** | Keep provider-neutral in C1. Reconcile with S5 Stripe infrastructure before deciding in C1.5. |

---

## 8. S5 Membership Billing Boundary Protection

- **S5 Scope**: Stripe-hosted $25/month membership billing only (`HostedMembershipSession`, `createMembershipCheckout`, `createMembershipPortal`, webhook entitlement).
- **C1 Invariant**: C1 introduces **zero** shared contract modifications in `src/contracts/**` or `src/domain/**`. S5 types are not repurposed or overloaded for physical commerce.
- **Physical Commerce**: Handled via client presentation models (`src/commerce/types.ts`) until S5 is merged and C1.5 is explicitly opened.

---

## 9. Commerce Roadmap (V1 → V1.5 → V2)

### C1 / Shop V1 (Current Draft PR)
- [x] Target member navigation: `Today · Plan · Shop · Ask · Progress`
- [x] Shop root tab with personalized member home
- [x] Single canonical scanner nested at `app/shop/scan.tsx` with redirect shim
- [x] Action-to-commerce semantics and calm empty states
- [x] Non-member and guest fallback view models
- [x] Comprehensive automated unit & static boundary tests (25 tests)
- [x] Full architecture documentation (`docs/COMMERCE.md`)

### C1.5 / Physical Product Commerce Integration (Next Phase)
- Reconcile with merged S5 Stripe infrastructure.
- Select physical-commerce provider (Stripe vs Shopify vs External).
- Define shared `ProductOffer` contract and database schema.
- Implement single-item physical checkout (Apple Pay / Payment Sheet).
- Order persistence: `Order` and `OrderItem[]`.
- Unify operational refills with physical orders.
- Activate public/guest routing shell without compromising security.

### C2 / Personalized Discovery & Cart (Later Phase)
- Search, filter by category/concern.
- Personalized alternatives for out-of-stock or high-cost items.
- Multi-item cart (only if customer purchase patterns demonstrate necessity).
- Replenishment reminders and subscription refill options.

---

## 10. Open Business & Operational Questions

1. **Merchant of Record**: Will Derive act as merchant of record, or refer to external retailers/brands?
2. **Inventory Ownership**: Will Derive buy wholesale and hold inventory, or rely on dropshipping?
3. **Fulfillment**: Founder fulfillment (beta) vs 3PL vs dropship vs brand-direct.
4. **Sales Tax & Shipping**: Destination-based tax calculation, nexus, shipping rate pass-through or flat-rate.
5. **Returns & Customer Service**: Policy on opened skincare cosmetics (safety regulations).
6. **One-Tap Refills**: Saved payment authorization for recurring replenishment.
7. **Member Economic Benefits**: Viability of member-exclusive pricing or free shipping without compromising recommendation neutrality.
