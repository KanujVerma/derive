# Scanner-first U.S. App Store product-page packet

**Status: READY TO VERIFY, not approved for App Store Connect entry or App Review.** Drafted 2026-09-27 against `origin/main` at `2f6671d25d762bca32396be220a3fb070749c5e1`. This packet describes the intended first public scanner-first candidate. Replace every conditional note with evidence from the exact final binary, hosted service, live public pages, and App Store Connect before entry. The historical [Build 8 TestFlight packet](APPLE_EXTERNAL_TESTFLIGHT_SUBMISSION.md) is not submission copy for this release.

## Candidate boundary

- Source `app.json` names Derive, version `1.0.0`, bundle ID `com.derive.skincare`, iPhone only, and `usesNonExemptEncryption=false`. `eas.json` uses remote native build numbering and records ASC app ID `6813524447`; those values do not prove a current App Store Connect record, final build number, export answer, or accepted binary.
- Current `src/utils/shellPresentation.ts` routes every non-development build flavor to the legacy managed shell. `src/services/DeriveService.ts` selects the Mock service when Remote is off. The `production` EAS profile is store distributed with `EXPO_PUBLIC_USE_REMOTE_SERVICE=false`; `remote-staging` is store distributed with Remote on but still uses legacy managed presentation. Neither profile currently proves the scanner-first public outcome. **BLOCKED:** do not use this draft as current production or TestFlight metadata.
- The local Check flow supports product-name search, camera barcode/package evidence with manual recovery, supported product facts or uncertainty, optional context-sensitive decisions, and explicit My Stuff saves. Automatic photo OCR/recognition, a hosted free scanner journey, useful public catalog coverage, final physical acceptance, and final-binary screenshots are unverified or absent. A package photo alone does not identify a formula. See [Roadmap](ROADMAP.md), [P0-D acceptance](P0_D_ACCEPTANCE.md), and [release copy audit](release/P0_D_COPY_AUDIT.md).
- Recommend **United States storefront only** for the first candidate because the stated audience and operating/support scope are U.S. adults. Storefront availability is **UNKNOWN** until read in App Store Connect and requires founder authorization to change.

## U.S. English product page draft

Apple permits a name and subtitle of at most 30 characters each; description of at most 4,000 characters; keywords of at most 100 bytes; optional promotional text of at most 170 characters. Keywords should not repeat the app or company name or use other app/company names. These fields are **drafts**, contingent on final-binary verification. [Apple app information](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information/); [Apple platform version information](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information/).

| Field | Proposed entry | Gate |
| --- | --- | --- |
| App name | `Derive` | 6 characters; confirm name availability and actual ASC localization. |
| Subtitle | `Check skincare products` | 23 characters; confirm final free Check entry. |
| Keywords | `skincare,ingredients,product lookup,routine,skin care,cosmetics,sensitivity,product history` | 91 UTF-8 bytes; recheck relevance after final candidate. |
| Primary category | **Lifestyle** | Cosmetic product decisions and personal skincare context fit a general-interest lifestyle app. |
| Secondary category | **Reference** | Product lookup and evidence-bound facts are the next clearest function. Reassess if the final binary materially changes purpose. |
| Copyright | `2026 [confirmed legal owner]` | **UNKNOWN:** founder confirms the rights holder and year; Apple adds the copyright symbol. Do not paste the placeholder. |
| Promotional text | `Check what Derive knows about a skincare product, see what remains uncertain, and save useful context for later checks.` | Optional; use only after final functionality matches. |

Apple says categories must accurately reflect the app's core experience. Lifestyle and Reference fit this cosmetic information flow better than Medical, given the current non-diagnostic product scope. If the final app becomes primarily health or treatment oriented, revisit the categories and associated regulated-medical-device declaration; category selection must reflect the app, not be used to avoid a declaration. [Apple category guidance](https://developer.apple.com/app-store/categories/); [Apple regulated-medical-device declaration](https://developer.apple.com/help/app-store-connect/manage-app-information/declare-regulated-medical-device-status/).

### Description draft

> Check a skincare product with Derive. Search by product name to see the facts Derive can support, what remains uncertain, and a practical next step.
>
> Add your own skincare context when you want a more personal check. Derive can use the information you choose to share, such as products you use and relevant sensitivities, to explain why a product may or may not fit your current routine. You can skip optional context and update it later.
>
> Save useful checks and products in My Stuff, so you can return to what you learned and build on it over time.
>
> Coverage varies by product. If Derive cannot verify a product or its formula, it says so and offers a way to search or try again. A photo by itself does not verify a product. Derive offers cosmetic skincare guidance, not medical diagnosis or treatment. For a medical concern or a reaction, seek advice from an appropriate health professional.

**Final-copy gates:** Verify that a new U.S. customer can reach product-name search, facts/unknown result, optional personalization, and My Stuff on the exact public binary and hosted environment without membership payment; verify the sensitive-result path. If any feature is absent, revise the description before ASC entry. No OCR, image-recognition, universal product coverage, AI-provider performance, Shop offer, or paid service is promised here. Plain-text description is required by Apple; the blockquote markers are document formatting only. [Apple description rule](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information/).

## Payment scope, two conditional release paths

**Founder decision required.** The current `production` flavor exposes a Managed membership screen with a `$25/month` price and Stripe-hosted Checkout/Portal actions, while `remote-staging` hides Checkout and price through `usesConciergeMembershipAccess`. Neither flavor makes the hosted free Check public. `src/utils/shellPresentation.ts`, `src/utils/membershipPresentation.ts`, `app/membership/index.tsx`, and `eas.json` are the source evidence. This packet does not change payment architecture or select a path.

| Path | Product-page and Review Notes treatment | Gate |
| --- | --- | --- |
| **A. Free-first v1.0** | Use the description above only if scanner-first Free Check, optional context, and My Stuff actually work without payment. Managed Skincare may be informational or invite-only; state its exact visibility and access in Review Notes. Do not claim a public paid membership or put an unavailable paid screen in screenshots. | **BLOCKED** until the final binary proves free access, no reachable public Checkout/Portal CTA, hosted behavior, and truthful account/support paths. |
| **B. Managed payment included** | Revise the listing to disclose the actual paid features and price/terms; explain the exact purchase, entitlement, restore/management, and review account paths. Show Managed only where available. | **BLOCKED** until the founders choose this scope, the final binary and payment service are verified, and the specific digital-vs-outside-the-app payment treatment is reviewed against Apple's rules. A U.S.-only storefront does not by itself establish that Stripe-hosted checkout is acceptable. Do not ask a reviewer to pay. |

Apple's payment rules distinguish in-app digital content/services from goods or services consumed outside the app, and its review guidance requires full access to account-based features. The mixed nature of Managed Skincare needs an exact offering and policy assessment before path B can be submitted. [Apple App Review Guidelines, sections 2.1 and 3.1](https://developer.apple.com/app-store/review/guidelines/).

## Screenshot plan for the final candidate

**READY TO VERIFY:** Capture real, clean states from the accepted final binary and matching service. No old Build 8, Mock fixture, synthetic catalog-only, or unverified Simulator capture may be passed off as the public product. Apple requires 1 to 10 screenshots and publishes accepted display sizes and formats. Match the final supported iPhone display requirements shown in ASC; `app.json` currently has `supportsTablet=false`. [Apple upload guidance](https://developer.apple.com/help/app-store-connect/manage-app-information/upload-app-previews-and-screenshots/); [Apple screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/).

1. **Check a Product:** show the real entry, product-name search and camera action if both exist in the candidate. Caption: “Check a skincare product.”
2. **Find the product:** show a real supported name-search result. Show barcode camera or package capture only if physically accepted and actually useful in the candidate. Caption describes the actual input shown.
3. **Facts and limits:** show one verified product's supported facts and a visible uncertainty. Never imply a photographed package establishes formula identity.
4. **Personal decision:** show the real action, reason, and next step with optional context supplied, using privacy-safe reviewer content. Omit if hosted decision composition fails.
5. **My Stuff:** show actual saved product/check history and an edit or revisit action. Omit any future contribution submission state.
6. **Managed/Plan (conditional):** only if path B includes a working, reviewable feature or path A exposes an actually usable invited experience, with its access requirements clear.

Before upload, inspect every screenshot for actual text, privacy leaks, obsolete pricing, unsupported camera/OCR claims, readable captions, and alignment with the exact binary. Avoid making a result look universal by selecting only one known product.

## App Review Information draft

**READY TO VERIFY:** Paste one of the following only after replacing the bracketed facts with observed candidate behavior. Put any credentials solely in App Store Connect's App Review Information fields, never in this repository. Apple requires working backend services, full reviewer access, and a valid demo account or fully featured demo mode for account-based features; notes should explain non-obvious configurations. [Apple review guidance](https://developer.apple.com/app-store/review/); [Apple platform version information](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information/).

### Notes for path A, free-first

> Derive provides cosmetic skincare product information and contextual guidance; it is not a medical diagnosis or treatment app. Open Check a Product and search by name for [verified reviewer-test product and variant]. A physical bottle or barcode is not required. Camera access is requested only if you open the camera; [describe observed barcode/package behavior]. Check [verified unknown product] to see the no-match and search-recovery path. Optional personalization can be skipped; [describe how to add or edit context and how to see a personal action]. Saved checks appear in My Stuff. [Describe the exact Account & Settings/Account deletion path verified in this binary]. [State exact Managed/Plan visibility and that no payment is needed to review all features in this candidate]. [State any intentionally unavailable beta features, including photo recognition if the camera accepts package photos].

### Notes for path B, Managed payment included

> Derive provides cosmetic skincare product information and contextual guidance; it is not a medical diagnosis or treatment app. [Describe the free product-name search, supported and unknown result, optional context, My Stuff, and camera behavior actually present]. [Describe paid Managed features and exact price/checkout/entitlement/restore behavior]. App Review can exercise every gated feature using the separately supplied permanent reviewer account with active access; no payment, OTP, founder intervention, or support contact is required. [Describe the exact account deletion path and any intentionally unavailable beta features].

**Reviewer-access plan:** First test the final candidate as a new free user. If any relevant route needs sign-in or membership, provision a stable reviewer identity in the actual review environment with needed entitlements and representative non-sensitive data. Verify credentials, onboarding, refresh, navigation, and deletion access from a fresh installation. Supply login details in ASC only, and a separate disposable account for destructive deletion testing if needed. Reviewers must not need an OTP from a founder, temporary code, payment, or manual approval. The historical Build 8 account is not evidence that this candidate works.

## Links and other App Store fields

| Field | Proposed URL or input | Current status |
| --- | --- | --- |
| Marketing URL | `https://derive-beta-site.vercel.app/` | **READY TO VERIFY:** current source has the page, but public deployment may be stale and managed-first. |
| Privacy Policy URL | `https://derive-beta-site.vercel.app/privacy` | **READY TO VERIFY:** required for iOS; compare live text with final data flow and deletion. |
| Support URL | `https://derive-beta-site.vercel.app/support` | **READY TO VERIFY:** verify reachable contact method and actual support response. |
| Privacy choices | `https://derive-beta-site.vercel.app/privacy-choices` | **READY TO VERIFY:** verify live page and match in-app link/candidate scope. |
| Export compliance | `usesNonExemptEncryption=false` in source | **READY TO VERIFY:** inspect final archive and dependencies; answer ASC's encryption questions from final-binary evidence. Escalate any custom or non-exempt cryptography. |
| Rights / ASC app record / agreements | App ID `6813524447` appears in `eas.json` | **UNKNOWN:** privately verify ASC record, rights answers, agreements and current app metadata. Source config alone is insufficient. |

Apple requires a Privacy Policy URL and a Support URL with contact information; it requires a copyright owner/year entry. The source currently compiles the links in `src/config/environment.ts`, but the live site was previously observed to lag the merged source, so HTTPS reachability alone does not clear the candidate-copy gate. [Apple app information](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information/); [Apple platform version information](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information/); [source/live distinction](release/P0_D_COPY_AUDIT.md).

## Age-rating questionnaire preparation

**UNKNOWN final rating and ASC answers.** Apple determines a rating from the actual questionnaire, including content descriptors, capabilities and controls. Do not infer `18+` solely from Derive's intended U.S.-adult audience; current runtime age affirmation is unproven. If final terms or a founder decision establish a minimum age above Apple's calculated rating, review Apple's higher-rating override. Do not select Made for Kids. [Apple age-rating process](https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating); [Apple rating definitions](https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions).

| Questionnaire input | Draft evidence-based response to verify in exact binary |
| --- | --- |
| Health and wellness topics | Likely **yes**: skincare routines, sensitivities and product-fit guidance. Verify the current ASC wording/frequency. |
| Medical or treatment information | **READY TO VERIFY:** inspect final screens for prescription context, pregnancy/nursing cautions, reactions and professional-referral wording; select the frequency matching visible content, not a desired age band. |
| User-generated content / sharing / messaging | Personal notes or photos may be entered and stored privately; determine whether Apple's questionnaire treats the final capability as UGC. No public sharing or messaging is established by current source. |
| Unrestricted web access | **READY TO VERIFY:** inspect all reachable external links and in-app browsing behavior. A bounded support/privacy or checkout handoff is not automatically unrestricted access. |
| Advertising, gambling, violence, sexual content, mature themes | No evidence of these in the scoped product source; **READY TO VERIFY** across the final binary and connected content before answering “none.” |
| Age assurance / parental controls | No proven runtime age-18 affirmation or parental controls. **UNKNOWN** until founder age-scope decision and final binary. |

Apple identifies health/wellness topics and medical/treatment information as distinct age-rating inputs; the calculated rating may differ from the product's intended age audience. [Apple rating definitions](https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions).

## Submission handoff

**Release packet remains READY TO VERIFY.** After Sami's final source/hosted handoff and founder payment/age/storefront decisions: identify the exact release profile and service; inspect the signed candidate and archive; perform physical and hosted guest/reviewer/deletion checks; verify privacy/report and public URLs; capture final screenshots; reconcile every word and checkbox above; confirm ASC private state; then enter metadata only with founder authorization. App Review submission remains a separate authorized action.
