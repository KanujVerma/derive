# Product-link request composition

`createProductLinkController` in `src/presentation/product-links/controller.ts` owns one mounted link input and is separate from the endpoint or Check view. The default transport is #177's validated `resolveProductLink` helper. Pass `createCatalogRequestId` into `createRequestId` and a callback reading the current live Auth/free-access owner into `getCurrentOwner`. No direct Auth-store, Supabase, navigation or camera import is needed by the controller.

For the root Check composition owner:

1. Create the controller once for the mounted Check input and subscribe to `getState` with the existing external-store pattern. Call `setOwner(liveCheckOwner)` when the owner changes; call `reset` on Check reset/unmount. The controller also checks `getCurrentOwner` before publishing an async result so a logout wins before React effects run.
2. Send the input to `setInput`. A different URL invalidates the old sequence and clears every source result/error. Owner changes additionally clear the URL itself. Loading suppresses duplicate presses. Explicit retry retains the same per-owner/input request UUID; there is no automatic retry.
3. Await `submit`. A stale response returns `null` for all resolution, label, recovery and error branches. A current `status=resolution` goes through root's existing `showResolution`/snapshot and owner guards; those remain the final Check truth gate. A `label_candidate` remains a possible published-label match, with package-evidence/search recovery and no formula or personal verdict. `needs_details` uses the existing search/camera recovery.
4. Render `state.message` as plain text. It uses fixed customer copy rather than a provider's reason or thrown transport error. Quota errors remain typed `RATE_LIMITED`; neither a source-title candidate nor an unsupported URL counts as a useful personalized Check.

This increment changes no Check UI, app navigation, provider, schema, billing, allowance or hosted configuration. #177 and its resolver provenance dependency #174 must land before the live link path is composed. The pure controller can be tested while those backend changes are reconciled.

## Bounded Check composition

The separate `sami/product-link-check` increment wires this controller into the existing Check link input for `local_free_integration`. The mounted input subscribes to the controller; its owner getter reads live Auth/access state before publishing, owner changes clear the input, and editing/reset/unmount invalidates pending work. Starting name search or camera from this entry abandons an earlier link request. Explicit retries preserve the request UUID; loading suppresses duplicate submits.

Only `status=resolution` enters the existing `showResolution` consumer, including its optional catalog readback, snapshot and owner gate. The Check sequence also fences a link if input changes while optional catalog readback is pending. Published-label candidates show their plain-text title and a package-confirmation message at the entry; retailer/unsupported-link recovery and typed failures show safe copy and an explicit name-search action. The existing camera action remains available. Neither branch creates a formula or personal verdict. Analytics uses the existing `unknown` input-method category and does not emit the URL/title.

The source supports the strict URL families documented in [PRODUCT_LINK_INTAKE.md](PRODUCT_LINK_INTAKE.md), not arbitrary retailer lookup. Preview retains its sourced fixture boundary; production/Remote Staging still use the existing legacy shell. This composition does not activate hosted sources or prove signed-build or physical iPhone acceptance. Kanuj's shared UX/result leaves, camera implementation and `app/**` remain unchanged.
