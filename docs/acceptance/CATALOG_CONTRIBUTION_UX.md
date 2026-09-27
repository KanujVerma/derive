# Missing product contribution customer UX

## Implemented boundary

`MissingProductContribution` is a reusable Check recovery component. It is not composed into `CheckProductScreen` yet. Its current `unavailable` state says that asking Derive to add a product is not available and offers **Try another way**. It cannot imply that an unresolved Check sent a request, created a review task, or added catalog truth.

The future `available` state opens a short draft with required brand and product name. Barcode, variant, package size, and country code are optional. The action is **Review product details**; its callback receives the parsed `CatalogContributionRequest` for a separate consent and submission step. This component never sends, persists, or displays success for a shared contribution.

The draft calls the merged `parseCatalogContribution` boundary. Optional blank fields are omitted. An observed barcode remains exact and must pass the contract checksum. Repeated review reuses the request ID for the same normalized details and photo choice; a changed payload gets a new ID. A local photo URI cannot enter the request. The form accepts only opaque evidence IDs supplied by a trusted integration, and includes them only after the customer selects **Include the private package photos I already took**. Selection is not a consent record or authorization to reuse images. The service must verify owner, purpose, existence, and allowed review access.

## Composition handoff

1. Under the single-writer Check lease, show the recovery component for unresolved product states, including unknown barcode, unresolved typed search, and unresolved photo review. Pass observed text and exact barcode when present. Pass a `contextKey` that changes with the authenticated owner or Check case to clear private draft state immediately. Keep **Try another way** linked to the existing search, scan, and retake paths.
2. Keep `availability: { kind: 'unavailable' }` until the trusted contribution service, concrete consent record and wording, owner checks, private evidence access, retention, withdrawal/deletion, and abuse controls are implemented and accepted. An available mode must open a separate consent/review screen before any submission.
3. If the customer chooses to save a manual item to My Stuff, use the existing owner-bound `save_product` flow. Label it as a private item with unverified formula. It does not submit a contribution and must not create a canonical product ID.
4. Reuse captured photos only when the service returns eligible opaque evidence IDs for the same authenticated owner and permitted purpose. Today's `CheckCaptureHandoff.localPhotos` contains local URIs, so it cannot be passed as contribution evidence.
5. On a real submission response, distinguish accepted request, retryable failure, and any later review result. Never use draft preparation or an unresolved Check as proof of submission or catalog addition. Preserve a request ID for an unchanged retry; mint a new ID if the payload changes.

## Evidence and open acceptance

Focused draft and experience tests cover minimal fields, exact optional details, correction messages, strict photo references, explicit photo inclusion, request IDs, and unavailable/available action semantics. App and test TypeScript, full unit suite, and web/iOS exports are source/build gates. This isolated module has no on-device, hosted-service, founder-review, or real-user acceptance evidence. Final composition and physical acceptance remain open.
