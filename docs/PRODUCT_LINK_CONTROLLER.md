# Product-link request composition

`createProductLinkController` in `src/presentation/product-links/controller.ts` owns one mounted link input and is separate from the endpoint or Check view. The default transport is #177's validated `resolveProductLink` helper. Pass `createCatalogRequestId` into `createRequestId` and a callback reading the current live Auth/free-access owner into `getCurrentOwner`. No direct Auth-store, Supabase, navigation or camera import is needed by the controller.

For the root Check composition owner:

1. Create the controller once for the mounted Check input and subscribe to `getState` with the existing external-store pattern. Call `setOwner(liveCheckOwner)` when the owner changes; call `reset` on Check reset/unmount. The controller also checks `getCurrentOwner` before publishing an async result so a logout wins before React effects run.
2. Send the input to `setInput`. A different URL invalidates the old sequence and clears every source result/error. Owner changes additionally clear the URL itself. Loading suppresses duplicate presses. Explicit retry retains the same per-owner/input request UUID; there is no automatic retry.
3. Await `submit`. A stale response returns `null` for all resolution, label, recovery and error branches. A current `status=resolution` goes through root's existing `showResolution`/snapshot and owner guards; those remain the final Check truth gate. A `label_candidate` remains a possible published-label match, with package-evidence/search recovery and no formula or personal verdict. `needs_details` uses the existing search/camera recovery.
4. Render `state.message` as plain text. It uses fixed customer copy rather than a provider's reason or thrown transport error. Quota errors remain typed `RATE_LIMITED`; neither a source-title candidate nor an unsupported URL counts as a useful personalized Check.

This increment changes no Check UI, app navigation, provider, schema, billing, allowance or hosted configuration. #177 and its resolver provenance dependency #174 must land before the live link path is composed. The pure controller can be tested while those backend changes are reconciled.
