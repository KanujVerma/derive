# Derive Commerce Architecture (C1 / C1.1 Shop and Scan)

**Source of Truth**: Canonical architecture for Derive Shop, customer-facing commerce, and product acquisition.
**Owner**: Kanuj (Customer Experience + Mobile) with Platform/Shared integration points noted.
**Status**: C1 Shop V1 implemented; C1.1 Shop and Scan experience hardening on an isolated draft branch. S5 membership billing is separate; physical-product commerce C1.5 is not started.

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
| **Canonical Single Scanner (`app/shop/scan.tsx`)** | IMPLEMENTED | Kanuj | Moved from `app/(tabs)/scan.tsx`. Route compatibility redirect to `/shop/scan` preserved. |
| **Canonical Product Detail (`app/shop/[productId].tsx`)** | IMPLEMENTED | Kanuj | Single destination for product cards across Shop, Plan, and Today. Resolves from canonical client state. |
| **Plan → Shop Integration** | IMPLEMENTED | Kanuj | Products tab links ADD/KEEP items to `/shop/[productId]`. ADD acquisition suppressed when routine unconfirmed. Subtle "Shop your plan" link. |
| **Today → Shop Contextual Integration** | IMPLEMENTED | Kanuj | Contextual card surfaces only when published routine has unconfirmed ADD items. Single -> product detail; multiple -> Shop tab. |
| **Shop Audience Model (Guest / Non-Member / Member)** | APPROVED TARGET | Kanuj | Pure client view models in `src/commerce/types.ts`. Non-member fallback architected. |
| **Action-to-Commerce Semantics** | IMPLEMENTED | Kanuj | `resolveActionCommerceSemantics()`: ADD eligible on publish; PAUSE/STOP never; KEEP non-urgent; REPLACE never sells old product. |
| **No Universal Product Score Invariant** | IMPLEMENTED | Kanuj | Categorical fit guidance only (`GREAT FIT`, `COULD WORK`, `USE WITH CAUTION`, etc.). |
| **Shop state separation** | C1.1 | Kanuj | Loading, error, preparation, unpublished review, published needs, covered, and empty are distinct. Covered requires a resolved published plan. |
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
- **Target Experience**: Public shop, public product facts, physical order history, a future general Scan path, and membership upsell. C1 does not enable general Scan; the current Scan requires member context.
- **Personalization Fallback**: Shop shows a truthful limited catalog state. Product detail fails closed until an independent public product source exists. Hydrated member routine and shelf data never supplies non-member product facts.
- **Scan**: Current personalized Scan is locked. A general factual Scan requires a separate backend path and authorization policy before public activation.
- **Current Remote routing (E1)**: An inactive account reaches `/membership`, not the member tabs, even if onboarding was previously complete. C1's limited non-member Shop presentation stays behind the paid-app route boundary until C1.5 provides a factual public catalog and separate public routing. No physical-product billing is connected to S5.
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
- **Legacy Route Compatibility**: `app/(tabs)/scan.tsx` is preserved as a lightweight redirect shim directly to `/shop/scan`. Deep links, Ask handoffs, and starter pills route to canonical Shop Scan directly.
- **Single Scanner Invariant**: There is strictly **one** camera scanner implementation (`app/shop/scan.tsx`). Zero code duplication.

### C1.1 frequent Scan access

- Active members have a compact Scan control in the Today header and a
  permanent Scan control in the Shop header. Ask retains its contextual starter
  pill. All three go directly to `/shop/scan`; there is no sixth tab or global
  Scan button on unrelated screens.
- Shop's body Scan card explains the feature. The header is the primary
  shortcut and stays visible without scrolling. Inactive Remote accounts
  remain behind E1 membership routing; no public Scan is activated.
- A recognized Scan shows product identity, categorical fit verdict, one
  reason, member-specific facts, then separate formula facts and actions.
  `Scan Another` returns to the same scanner. `Ask Derive About This` passes
  the full typed result through the transient store. Unknown products get a
  no-match path, not invented identity or evaluation.
- Scan history and iOS app-icon Quick Actions remain future opportunities.
  Neither has persistence or native implementation in C1.1.

### Shop and detail presentation

`src/commerce/shopState.ts` reads the existing plan hydration status. A
loading or failed read cannot masquerade as a covered plan, and unpublished
review cannot show an acquisition section. Shop and product detail retry with
the existing `hydratePlanState()` coordinator. Needed products show their
reason and a **View product** path; future ordering is explained only on
detail. The Shop-owned `ProductCommerceSection` composes ADD, KEEP, PAUSE,
STOP, and REPLACE states from the existing action semantics. It has no offer,
price authority, payment path, or shared contract.

---

## 5. Action-to-Commerce Semantics

The single source of truth is `resolveActionCommerceSemantics(action, routineStatus)` in `src/commerce/types.ts`:

| Action | Plan Status Label | Routine Draft/Review/Approved | Routine Published | Never Sell Old Product? |
| :--- | :--- | :--- | :--- | :--- |
| **ADD** | Needed for your plan | Not acquisition-eligible (`not_applicable`) | **Acquisition-eligible** (`deferred_to_c15`) | False |
| **KEEP** | In your plan | Not acquisition-eligible | In your plan (`deferred_to_c15` optional refill) | False |
| **PAUSE** | Paused | Not acquisition-eligible (`not_applicable`) | Not acquisition-eligible (`not_applicable`) | False |
| **STOP** | Discontinued | Not acquisition-eligible (`not_applicable`) | Not acquisition-eligible (`not_applicable`) | False |
| **REPLACE** | Has recommended replacement | `view_replacement` only | `view_replacement` only | **TRUE (Never sell old product)** |

### Invariants:
1. **Unpublished Recommendations Are Never Monetized**: If `routine.status !== 'published'`, ADD items cannot produce active acquisition CTAs. Members preview recommendations during review without commercial pressure. Founder approval alone does not activate Shop acquisition.
2. **Recommendation Independence**: Skincare decisions are 100% independent of commerce. Margin, deals, or affiliate relationships cannot alter `KEEP`, `PAUSE`, `REPLACE`, `ADD`, `STOP`, or Scan verdicts.
3. **No Fake Price / No Fake Offers**: Price truth is respected. If approximate retail price is absent, it displays "Price not listed" or is omitted. Zero fabricated discounts or coupon banners.

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
| **Recommendation** | Keep physical commerce provider-neutral until C1.5 is opened and its provider decision is made. S5 Stripe use is membership-specific. |

---

## 8. S5 Membership Billing Boundary Protection

- **S5 Scope**: Stripe-hosted $25/month membership billing only (`HostedMembershipSession`, `createMembershipCheckout`, `createMembershipPortal`, webhook entitlement).
- **C1 Invariant**: C1 introduces **zero** shared contract modifications in `src/contracts/**` or `src/domain/**`. S5 types are not repurposed or overloaded for physical commerce.
- **Physical Commerce**: C1 has presentation models only (`src/commerce/types.ts`). C1.5 remains unopened; S5's Stripe integration is membership-specific.

---

## 9. Commerce Roadmap (V1 → V1.5 → V2)

### C1 / Shop V1 (Implemented)
- [x] Target member navigation: `Today · Plan · Shop · Ask · Progress`
- [x] Shop root tab with personalized member home
- [x] Single canonical scanner nested at `app/shop/scan.tsx` with redirect shim
- [x] Action-to-commerce semantics and calm empty states
- [x] Non-member and guest fallback view models
- [x] Automated unit and boundary tests for audience, publication, Scan, and member-only presentation
- [x] Full architecture documentation (`docs/COMMERCE.md`)

### C1.1 / Shop and Scan experience hardening (Shop-only draft)
- [x] Today and Shop header Scan accelerators route to the one scanner; Ask
  shortcut remains direct.
- [x] Result shows an immediate categorical verdict before formula facts;
  repeated Scan and unknown-product return paths remain direct and truthful.
- [x] Shop loading/error/review/covered states and product-detail action
  presentation are separated without backend or shared-contract changes.
- [x] 242 unit tests, both TypeScript checks, web export, and 390/320-pixel
  Mock phone review passed. Draft PR CI is a separate gate.

### C1.5 / Physical Product Commerce Integration (Next Phase)
- Preserve the membership and physical-product commerce separation established by S5 and C1.
- Select physical-commerce provider (Stripe vs Shopify vs External).
- Define shared `ProductOffer` contract and database schema.
- Implement single-item physical checkout (Apple Pay / Payment Sheet).
- Order persistence: `Order` and `OrderItem[]`.
- Unify operational refills with physical orders.
- Activate public/guest routing shell without compromising security.
- Build and test a general factual Scan backend path before enabling guest or non-member Scan; never reuse member routine context for that path.

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
