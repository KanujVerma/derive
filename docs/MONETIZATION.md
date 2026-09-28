# Derive monetization: product boundary and learning plan

**Owner:** Kanuj, with Sami advisory on hosted entitlement, billing, privacy, and operations. **As of:** 2026-09-28. **Scope:** product and commercial direction, not a billing activation plan. Status labels below distinguish source behavior from targets and experiments. Current competitor and subscription evidence is in [the dated research note](research/COMPETITOR_ECONOMICS_2026_09_28.md). [PRODUCT.md](PRODUCT.md), [COMMERCE.md](COMMERCE.md), and [APP_STORE_RELEASE_READINESS.md](APP_STORE_RELEASE_READINESS.md) remain authoritative for their respective product, Shop, and release boundaries.

## The three customer jobs

| Product | Customer job | Boundary and status |
| --- | --- | --- |
| **Derive** | “Should I use this product?” | **APPROVED TARGET:** useful single-product Check through Auto camera, barcode, search, and supported product/package evidence; optional profile, routine, history, basic My Stuff, and honest unknown recovery. **IMPLEMENTED:** scanner-first Free exists in Development Mock and exact-local-Supabase Development Remote; Remote Staging and production retain legacy Managed routing. Photo-only capture does not perform OCR or image recognition. Hosted guest activation and physical acceptance are open. |
| **Derive Plus** | “Help me make better skincare decisions across my products.” | **EVALUATION:** self-directed comparison, Considering workspace, analytical My Stuff, longitudinal patterns, and eventually useful research or reformulation alerts. Higher usage may help, but alone is a weak reason to pay. These are not public paid entitlements. |
| **Managed Skincare** | “I don't want to think about skincare. Manage it for me.” | **APPROVED TARGET:** Plus-level tools plus delegated AM/PM routine management, check-ins, proposed changes, customer approval for meaningful changes, and proactive follow-up. **IMPLEMENTED:** legacy Founding Beta membership and Stripe source exist; this is not evidence of a hosted public Managed offer. **EXPERIMENT:** $25/month, products separate, subject to service cost and retention evidence. |

**APPROVED TARGET / FIRST RELEASE SCOPE:** The current P0-C plan for the first App Store scanner candidate is free-only barcode and name search. Native product-photo OCR, Plus checkout, and Managed purchase activation are outside that candidate; hosted and physical acceptance remain open. The founder's newer proposal to show Plus or Founding Plus publicly remains unresolved against that free-only scope; this document does not add it to the candidate. See [P0-C activation readiness](P0_C_ACTIVATION_READINESS.md).

**APPROVED TARGET:** The scanner earns trust and may distribute the service; whether deeper scanner use increases Managed conversion is an unproven funnel hypothesis. Plus is for people who still direct their own routine. Managed takes responsibility for ongoing routine decisions. A Plus tool must not quietly imply the Managed promise of proactive care or human review.

## Free answer quality and possible access limits

**APPROVED TARGET:** Every allowed personalized Check uses the same product/formula evidence, context, safety policy, uncertainty standard, and explanation as a paid Check. An allowed Free Check includes material conflicts, relevant routine overlap, reasons, and next action. Paid status must not turn an unknown formula into a known one or change the skincare verdict. No universal product score, retailer-funded ranking, or paywall on material safety information. The source-of-truth and personal-decision contracts are described in [PRODUCT.md](PRODUCT.md) and [DECISIONS.md](DECISIONS.md).

**EVALUATION:** If costs require a limit, meter completed customer-visible Check sessions, not internal calls. Compare no limit, daily/weekly/monthly full-Check allowances, and separate allowances for expensive photo recognition. A cheaper barcode/search path can remain broader. Measure repeat utility and costs before choosing. `5/day`, `3/day`, and other example numbers are hypotheses, not policy. A configured limit must offer an intelligible reset and avoid charging a session when Derive fails to deliver a result. Keep basic saved products, Check history, and My Stuff usable without Plus; Plus may analyze those records across products and time.

## Plus: prove a distinct paid outcome

**EVALUATION:** Start with one cross-product job that users repeatedly ask for: compare a candidate with a product they use and explain whether it fills a gap, overlaps, or changes their routine. Both products must be independently resolved against the same personal-context revision; insufficient evidence remains explicit. A free customer can still receive routine-overlap information material to a single Check. The richer paid action is evaluating alternatives and accumulated choices, not withholding a valid Check answer. Product Compare remains the approved near-term post-MVP target in [COMMERCE.md](COMMERCE.md), and is not implemented.

**LATER / PARKED:** Considering-set analysis, deeper history, reformulation alerts, and research monitoring require reliable identity, formula/version evidence, relevance filters, and customer permission. Do not ship generic alerts or imply that a reported reaction proves a cause. Shopping savings require verified offers and their own commercial controls.

## Price and trial hypotheses

**EXPERIMENT:** `$4.99/month` and approximately `$30–40/year` are founder starting points for Plus, not approved storefront prices. At $4.99 monthly, $30 annual discounts twelve monthly payments by about 50%; $40 discounts by about 33%. That may suit seasonal shoppers, but it can also lower revenue before retention and value are known. Current peers span Yuka's displayed $15/year support price, Think Dirty Premium at $2.99/month or $28.99/year, and HadaBuddy Pro at $3.99/month or $29.99/year. RevenueCat's broad 2026 subscription sample reports an $8 median monthly price, $34.80 annual median, and a Health & Fitness monthly median of $9.99. These are anchors from unlike products, not proof Derive can charge any one figure. [Evidence and caveats](research/COMPETITOR_ECONOMICS_2026_09_28.md).

**EVALUATION:** Set prices only after a real Plus outcome, customer interviews, cost per active user, trial behavior, and a storefront-specific margin model are available. Present monthly and annual terms plainly. Measure eligible paywall views, start, paid conversion, renewal, refund, usage after purchase, and cancellation by acquisition cohort. Never treat an app-category benchmark as a conversion forecast for Derive.

**EXPERIMENT:** Founding Plus for approximately the first 250 users for approximately 60 days could remove early paywall friction. The proposed cohort and duration are arbitrary until tied to a learning question and expected recruitment volume. A 60-day grant delays paid-conversion evidence beyond the 24–48 hour MVP horizon, can mask low willingness to pay, and risks a confusing expiration. Recommend a **bounded, versioned promotional entitlement** only if the first Plus behavior is genuinely usable, with a disclosed end date, no surprise renewal, a control or later cohort for comparison where feasible, and a review date. If Plus is not ready, offer the complete Free scanner and recruit research participants explicitly; do not label Free access as a Plus trial. Apple subscription offer codes are one later mechanism, but entitlement and App Store terms need review before selection. [Apple's offer-code rules](https://developer.apple.com/help/app-store-connect/manage-subscriptions/set-up-subscription-offer-codes).

**OPEN FOUNDER DECISION:** Choose whether any Founding Plus cohort launches with the first external candidate. If yes, approve cohort eligibility, benefit actually available, term, expiration copy, transition to Free, and whether paid auto-renewal is ever involved. Do not hard-code `250`, `60 days`, or a Check quota in mobile screens; a single remotely configurable, versioned entitlement policy and auditable cohort assignment are the target. This document does not activate one.

## Managed Early Access and the funnel test

**APPROVED TARGET:** Public navigation may show Managed Skincare as **Early Access** with a useful explanation and an interest action when the candidate actually supports that route. It must not imply that public payment, onboarding, or ongoing care is ready. The release candidate must still be reviewed against [App Store readiness](APP_STORE_RELEASE_READINESS.md).

**EVALUATION:** Define scanner depth before looking at outcomes: first supported Check, repeat Check, saved product, routine context used, and cross-product action, each measured as nonsensitive event names/counts. Track Managed information view, expressed interest, eligible invitation, actual activation, and service retention separately. Compare qualified cohorts and control for acquisition source and baseline intent; observational correlation is not causal evidence that scanning creates Managed demand. Interview people who decline as well as those who express interest. Keep skin details, photos, ingredient names, and sensitive context out of analytics.

**OPEN FOUNDER DECISION:** Define the Early Access promise and what happens after an interest action. Approval of an interest CTA is distinct from approval to charge or offer Managed publicly.

## Distribution, referrals, and commerce

**EVALUATION:** Begin with useful Check value and a simple, optional share or invitation path. Attribute campus clubs, student leaders, creators, and friend referrals with source/campaign identifiers from first touch through activation and paid outcomes, without copying private skin conclusions into links. Compare engaged users and retained users per channel, not installs alone. Apple's [campaign links](https://developer.apple.com/help/app-store-connect-analytics/acquisition/campaign-links) can measure App Store acquisition; they do not by themselves establish person-level referral credit. RevenueCat's [referral guidance](https://www.revenuecat.com/blog/growth/how-to-build-a-referral-program-for-mobile-apps) cautions that referral programs do not manufacture growth without product value. Creator rewards or paid referral incentives require a specific economics, disclosure, abuse, and attribution design before launch. No referral reward or creator commission is approved here.

**APPROVED TARGET:** Shop is a separate acquisition layer. The current C1.5A member Where to Buy foundation has zero production listings; C1.5B feeds and C1.5C physical checkout are parked. Verified merchant prices, offers, stock, and approved affiliate attribution may later generate commerce revenue, with commission and merchandise margin measured separately from subscription revenue. Product identity, formula truth, Check outcome, comparison, and skincare ranking are independent of seller payment. Retailer clicks are not sales. See [COMMERCE.md](COMMERCE.md).

**EVALUATION:** Default to no generic advertising in the Check and recommendation surfaces. Yuka's ad-free independence supports trust, while INCI Beauty shows that ad-funded free access is a possible market model; neither establishes Derive's unit economics. Reopen only with measured financial need, explicit placement and privacy review, and a way to preserve advice independence. **LATER / PARKED:** broad B2B data/licensing, brand-sponsored placement, and an owned skincare brand. They add conflicts, operations, and capital needs without improving the first external Check.

## 24–48 hour call and unresolved decisions

**APPROVED TARGET:** Release a useful scanner-first Free candidate once its actual hosted, physical, privacy, and App Store gates pass. Managed can be honestly presented as Early Access if the candidate supports the promised interest path. Plus architecture and learning instrumentation can proceed in parallel; neither a Plus price nor billing must block first scanner value.

**OPEN FOUNDER DECISIONS, in order:**

1. Whether the first external candidate is Free plus Managed information, or also exposes a real Plus benefit. Name the exact benefit before a paid offer.
2. Whether to run Founding Plus at launch; if yes, approve eligibility, term, expiration/renewal terms, and the primary learning metric. Do not assume `250/60` is optimal.
3. Whether to test `$4.99/month` and `$30–40/year` after value and cost evidence, and which price variants are allowed in a later experiment. No storefront product is approved by this note.
4. What Managed Early Access commits Derive to do with expressed interest, and who can fulfill that response.

Billing provider, iOS purchase path, referral rewards, commerce partner terms, and ads remain separate later decisions. Existing Stripe Founding Beta source does not grant authority to sell Plus in iOS or claim hosted Managed activation.
