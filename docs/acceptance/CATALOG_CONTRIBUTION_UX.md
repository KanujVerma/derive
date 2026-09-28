# Missing product contribution customer UX

## Implemented boundary

`MissingProductContribution` is composed into the scanner-first Check for an unknown barcode, an unresolved identity result after a typed name, and a package-photo handoff without a resolved case. Its current `unavailable` state says that asking Derive to add a product is not available and offers **Search by name** in Check. The reusable component retains **Try another way** as its default elsewhere. Camera retries remain available. An unresolved Check does not send a request, create a review task, or add catalog truth.

The future `available` state opens a short draft with required brand and product name. Barcode, variant, package size, and country code are optional. The action is **Review product details**; its callback receives the parsed `CatalogContributionRequest` for a separate consent and submission step. This component never sends, persists, or displays success for a shared contribution.

The draft calls the merged `parseCatalogContribution` boundary. Optional blank fields are omitted. An observed barcode remains exact and must pass the contract checksum. Repeated review reuses the request ID for the same normalized details and photo choice; a changed payload gets a new ID. A local photo URI cannot enter the request. The form accepts only opaque evidence IDs supplied by a trusted integration, and includes them only after the customer selects **Include the private package photos I already took**. Selection is not a consent record or authorization to reuse images. The service must verify owner, purpose, existence, and allowed review access.

## Current Check boundary

The Check composition keys recovery state by the current owner and, when one exists, the resolution case. Only an exact, checksum-valid observed barcode can prefill the draft model. A typed name may prefill the name field; the customer would still have to review it. Local photo URIs never become contribution evidence IDs. A photo capture remains customer evidence, not product or formula verification. Unknown and unresolved results do not claim a review is pending.

Merged Sami runtime #142 accepts owner-derived authenticated `submit`, `status`, and `withdraw` operations. It remains source-only. Its [contract](../CATALOG_CONTRIBUTION.md) explicitly blocks customer UI and hosted activation until the exact consent v1 customer wording is approved. The UI therefore does not call the endpoint or expose a send action. It does not show a pending state, withdrawal control, or success state without a server receipt. Separately owned private photos are not deleted by contribution withdrawal.

A transport-injected client adapter matches those three operations. It sends no owner ID, canonicalizes the proposal, requires affirmative version 1 `catalog_review` consent for `submit`, and rejects malformed or mismatched server receipts. No app component creates or invokes it. Read-only hosted inventory on 2026-09-28 found 15 deployed Edge Function names without `catalog-contribution` and 19 deployed migration versions without `20260928010000_catalog_contribution_runtime`. This is source and local-test readiness, not a hosted submission path.

## Proposed consent copy for founder review, not in the app

This wording is a **candidate for explicit founder approval**. It must not be treated as approved consent v1 or used to activate the endpoint:

> **Send product details to Derive?**
>
> We’ll store the brand, product name, and any details you entered for private catalog review. Your Check does not send a request automatically.
>
> Package photos are included only if you choose them. They stay private and will not be published or used to train a model. This request alone does not verify the product or add it to Derive.
>
> You can withdraw the request later. Withdrawal removes its product details, but does not remove photos saved with your Check. A minimal record of the request remains until you delete your account.
>
> ☐ I agree to share these details for private catalog review.
>
> **Send request** · **Not now**

Proposed receipt copy, shown only after an owner-bound `submitted` response: “Request received. This product has not been added to Derive. You can withdraw this request.” Proposed withdrawal copy, shown only after an owner-bound `withdrawn` response: “Request withdrawn. Its product details were removed. Photos saved with your Check remain private in your account.” There is no server review-progress state yet; `submitted` must not be rendered as “under review” or “approved.”

Before approval, verify that the photo and retention sentences match the current privacy notice and deletion behavior. The copy does not authorize private photo access for reviewers or public image reuse. A reviewer workflow and any time-based cleanup period still require separate decisions.

## Activation handoff

1. Approve exact customer consent wording and any reviewer access to private evidence. Define the public retention/cleanup policy. Verify the owner-bound endpoint and deletion behavior in the intended hosted environment.
2. Only then change `availability: { kind: 'unavailable' }`. An available mode must open a separate consent/review screen before any submission. Send a stable request ID for an unchanged retry; render accepted or withdrawn status only from an owner-bound server response. Keep review pending distinct from catalog inclusion.
3. If the customer chooses to save a manual item to My Stuff, use the existing owner-bound `save_product` flow. Label it as a private item with unverified formula. It does not submit a contribution and must not create a canonical product ID.
4. Reuse captured photos only when the service returns eligible opaque evidence IDs for the same authenticated owner and permitted purpose. Today's `CheckCaptureHandoff.localPhotos` contains local URIs, so it cannot be passed as contribution evidence.
5. On a real submission response, distinguish accepted request, retryable failure, withdrawal, and any later review result. Never use draft preparation or an unresolved Check as proof of submission or catalog addition. Preserve a request ID for an unchanged retry; mint a new ID if the payload changes.

Acceptance evidence still needed for activation: founder-approved exact copy; customer checkbox unchecked by default; no call before affirmative choice; same-ID retry and changed-payload conflict; owner-isolated status and withdrawal; private evidence grant/object validation without local URI or signed URL; daily abuse limit; withdrawal scrub with separate Check photo lifecycle; account-deletion cascade; hosted function/migration readback; physical Check flow and recovery. Tests for the service contract already exist in #142, but no hosted or physical acceptance is claimed here.

## Evidence and open acceptance

Focused draft, experience, and Check composition tests cover minimal fields, exact optional details, correction messages, strict photo references, explicit photo inclusion, request IDs, owner/case reset, and unavailable/available action semantics. App and test TypeScript, full unit suite, and web/iOS exports are source/build gates. This source composition has no on-device, hosted-service, founder-review, or real-user acceptance evidence. Physical acceptance and the consent-approved service activation remain open.
