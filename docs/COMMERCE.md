# Derive Commerce Architecture (C1.5A acquisition foundation)

**Source of Truth**: Canonical architecture for Derive Shop, customer-facing commerce, and product acquisition.
**Owner**: Kanuj (Customer Experience + Mobile) with Platform/Shared integration points noted.
**Status**: C1 and C1.1 are implemented. The C1.5A acquisition foundation is implemented in a draft PR; production merchant listings remain empty pending stronger product, variant, and formula verification. C1.5B feeds and C1.5C Derive Shopify checkout remain planned. S5 membership billing is separate.

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
| **Merchant listings and purchase options** | C1.5A DRAFT | Kanuj | Shop-owned resolver and 0/1/many presentation; zero production listings. Ulta example is test-only. No live price. |
| **Physical Product Commerce Backend** | PLANNED (C1.5C) | Cross-founder | Derive as Shopify merchant, inventory, cart, checkout, orders, fulfillment, returns. |
| **Official retailer feeds** | PLANNED (C1.5B) | Cross-founder | Live offers, availability and approved attribution from official sources. |
| **Multi-Item Cart** | DEFERRED (V2) | Kanuj / Platform | V1/V1.5 is single-product purchase intent. Cart deferred until behavioral evidence warrants. |
| **ADR-32** | C1.5A DRAFT | Cross-founder | Acquisition separation and future Derive merchant decision. |

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
  - `ORDERS & REFILLS`: S2/S4 beta managed refill tracking. Outbound merchant clicks are not Derive orders.
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
- A runtime result with an unrecognized verdict cannot become a trusted label.
  Scan shows a recoverable, truthful failure and Scan Again, including when
  camera permission is denied.
- Scan history and iOS app-icon Quick Actions remain future opportunities.
  Neither has persistence or native implementation in C1.1.

### Shop and detail presentation

`src/commerce/shopState.ts` reads the existing plan hydration status. A
loading or failed read cannot masquerade as a covered plan, and unpublished
review cannot show an acquisition section. Shop and product detail retry with
the existing `hydratePlanState()` coordinator. Needed products show their
reason and a **View product** path; future ordering is explained only on
detail. The Shop-owned `ProductCommerceSection` composes ADD, KEEP, PAUSE,
STOP, and REPLACE states from the existing action semantics. Published ADD with
trusted product identity and an acquisition-active listing shows external Where to Buy options.
The production registry is empty, so published ADD currently yields a truthful
no-verified-option state. A test-only Ulta fixture exercises the full path.
No live offer is seeded.

---

## 5. Action-to-Commerce Semantics

The single source of truth is `resolveActionCommerceSemantics(action, routineStatus)` in `src/commerce/types.ts`:

| Action | Plan Status Label | Routine Draft/Review/Approved | Routine Published | Never Sell Old Product? |
| :--- | :--- | :--- | :--- | :--- |
| **ADD** | Needed for your plan | Not acquisition-eligible (`not_applicable`) | **Eligible for verified external listings**; Derive checkout remains deferred | False |
| **KEEP** | In your plan | Not acquisition-eligible | In your plan (`deferred_to_c15` optional refill) | False |
| **PAUSE** | Paused | Not acquisition-eligible (`not_applicable`) | Not acquisition-eligible (`not_applicable`) | False |
| **STOP** | Discontinued | Not acquisition-eligible (`not_applicable`) | Not acquisition-eligible (`not_applicable`) | False |
| **REPLACE** | Has recommended replacement | `view_replacement` only | `view_replacement` only | **TRUE (Never sell old product)** |

### Invariants:
1. **Unpublished Recommendations Are Never Monetized**: If `routine.status !== 'published'`, ADD items cannot produce active acquisition CTAs. Members preview recommendations during review without commercial pressure. Founder approval alone does not activate Shop acquisition.
2. **Recommendation Independence**: Skincare decisions are 100% independent of commerce. Margin, deals, or affiliate relationships cannot alter `KEEP`, `PAUSE`, `REPLACE`, `ADD`, `STOP`, or Scan verdicts.
3. **No Fake Price / No Fake Offers**: Price truth is respected. If approximate retail price is absent, it displays "Price not listed" or is omitted. Zero fabricated discounts or coupon banners.

---

## 6. Product / Recommendation / Listing / Offer / Purchase Path

The data flow is one-way. Recommendations are resolved first; commerce cannot select or change a recommendation or Scan verdict.

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
│    MERCHANT LISTING     │  Stable mapping: exact product identity, merchant,
│    (Shop registry)      │  listing ID, verified destination and variant.
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ OPTIONAL OFFER SNAPSHOT │  Volatile price/currency/availability with source
│  (no live feed in A)    │  and observed time; absent by default.
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│      PURCHASE PATH      │  A: external verified retailer page.
│                         │  C: future Derive Shopify cart/checkout.
└─────────────────────────┘
```

- **Derive** owns canonical Product and member Recommendation truth. Existing `retailPriceApprox` is catalog context, never an offer from Target or Ulta.
- **Shop-owned beta resolver** uses exact case/whitespace-normalized brand and full name because Remote product UUIDs are runtime-generated. It requires the existing `is_catalog_standard === true` provenance mapped to `Product.isCatalogStandard`, plus presence in the current published routine steps. Missing/false provenance or a retained older ADD outside the current routine fails closed; no fuzzy, substring, AI, or Scan fixture lookup. `isCatalogStandard` describes canonical catalog provenance only. It does not establish that a retailer package has the same formula Derive evaluated.
- **MerchantDefinition** is extensible. The registry includes brand-direct CeraVe, Target, Ulta, Sephora, Walmart, Amazon and future `derive`; inclusion does not mean a listing exists. Marketplace seller legitimacy must be verified before any listing is added.
- **MerchantListing** holds stable merchant identity, direct page URL, verification date and variant. `CURATED_LISTINGS` is empty in production. The [Ulta CeraVe Hydrating Facial Cleanser page](https://www.ulta.com/p/hydrating-facial-cleanser-xlsImpprod4190255) is retained only in `tests/fixtures/merchantListings.ts`. The Ulta and [CeraVe ingredient presentations](https://www.cerave.com/skincare/cleansers/hydrating-facial-cleanser) are not sufficient to prove package/formula equivalence; this does not establish that Ulta sells the wrong formula. CeraVe also warns that ingredient lists can change and that the package is the current source. No replacement link is added merely to populate Shop.
- **Production listing activation** requires sufficient evidence that the merchant destination represents the intended canonical product, size/variant, and formula. Future evidence may combine GTIN/UPC, merchant identifiers, exact size, brand-direct identity, FormulaSnapshot comparison, S6 resolution, and official feed identity. The exact future contract remains open. Exact brand/name is a lookup seam, never acquisition authority by itself.
- **MerchantOfferSnapshot** is separate, optional and currently empty in production. Its display requires a named official feed/API source, USD minor-unit amount and observed time within 24 hours. Explicit out-of-stock offers do not display a price or activate Derive checkout. No manual current price or availability is seeded. A later feed must revalidate the policy and show source/freshness.
- **Purchase path** is HTTPS external handoff in A. At composition and tap time, the URL must match an exact configured host. The OS open failure has a sanitized retry message. A successful open records only `productId`, `merchantId` and `entryPoint`; it never creates an order or marks a purchase.
- **Future `derive` merchant** can be ordered first only with a real active offer; external alternatives remain visible. Shopify catalog mapping, inventory, checkout and fulfillment start in C1.5C. The current client has no Derive offer or checkout.

---

## 7. Commerce measures and source policy

Membership ARR is annualized recurring membership revenue. Commerce GMV is the total value of product transactions facilitated, when actually measurable. Commerce revenue is Derive's recognized product sales or attributable affiliate commission, not the full third-party retailer basket. Commerce gross profit subtracts the associated product cost and direct commerce costs from commerce revenue. A retailer click proves none of these transaction measures; one-time product GMV is not membership ARR.

C1.5B should prefer official merchant APIs, affiliate/product feeds, approved networks and trusted providers for identifiers, freshness, availability and allowed attribution. HTML scraping is not core infrastructure. No affiliate IDs, referral parameters, commission ranking or scraping are present in C1.5A.

---

## 8. S5 Membership Billing Boundary Protection

- **S5 Scope**: Stripe-hosted $25/month membership billing only (`HostedMembershipSession`, `createMembershipCheckout`, `createMembershipPortal`, webhook entitlement).
- **C1 Invariant**: C1 introduces **zero** shared contract modifications in `src/contracts/**` or `src/domain/**`. S5 types are not repurposed or overloaded for physical commerce.
- **Physical Commerce**: C1.5A adds Shop-only acquisition models (`src/commerce/merchantListings.ts`), not a physical checkout contract. S5's Stripe integration is membership-specific.

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

### C1.1 / Shop and Scan experience hardening (Implemented)
- [x] Today and Shop header Scan accelerators route to the one scanner; Ask
  shortcut remains direct.
- [x] Result shows an immediate categorical verdict before formula facts;
  repeated Scan and unknown-product return paths remain direct and truthful.
- [x] Shop loading/error/review/covered states and product-detail action
  presentation are separated without backend or shared-contract changes.
- [x] 245 unit tests, both TypeScript checks, web export, and 390/320-pixel
  Mock phone review passed. Unknown verdicts fail closed with Scan Again.

### C1.5A / Multi-Merchant Acquisition Foundation (Implemented in draft PR)
- Shop-owned merchant, listing, optional offer and purchase path presentation.
- Member ADD Where to Buy, privacy-safe outbound event, and test-only external acquisition fixture. Production listing count is zero until the activation gate above is met.
- No backend, migration, feed, affiliate attribution, Derive checkout, public routing or Scan purchase CTA.

### C1.5B / Official Retailer Feeds, Live Offers & Attribution (Planned)
- Verify official integration paths when opened. Establish merchant/feed product identity and listing verification, then resolve live merchant IDs, price, sale price, availability, offer freshness and approved affiliate attribution with provenance. Activate production listings only with adequate product, variant, and formula evidence.

### C1.5C / Derive Shopify Merchant & Integrated Checkout (Planned)
- Map Derive Shopify products and variants, then build real Derive offer, inventory, cart/checkout, product orders, fulfillment, returns and member benefits. Keep legitimate external alternatives visible.
- Public factual catalog/routing and non-member Scan authorization each require separate deliberate gates; neither is activated here.

### C2 / Personalized Discovery & Cart (Later Phase)
- Search, filter by category/concern.
- Personalized alternatives for out-of-stock or high-cost items.
- Multi-item cart (only if customer purchase patterns demonstrate necessity).
- Replenishment reminders and subscription refill options.

---

## 10. Open Business & Operational Questions

1. **Merchant of Record**: C1.5A sends customers to external merchants; C1.5C plans Derive as a Shopify merchant. Legal and operational setup remains future work.
2. **Inventory Ownership**: Will Derive buy wholesale and hold inventory, or rely on dropshipping?
3. **Fulfillment**: Founder fulfillment (beta) vs 3PL vs dropship vs brand-direct.
4. **Sales Tax & Shipping**: Destination-based tax calculation, nexus, shipping rate pass-through or flat-rate.
5. **Returns & Customer Service**: Policy on opened skincare cosmetics (safety regulations).
6. **One-Tap Refills**: Saved payment authorization for recurring replenishment.
7. **Member Economic Benefits**: Viability of member-exclusive pricing or free shipping without compromising recommendation neutrality.
