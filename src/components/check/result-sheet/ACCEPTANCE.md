# Shared Check result content and contextual presentation

At the starting main `d96cf55`, Check already mounts the factual camera companion. This leaf adds optional shared Personal Fit content and a transient lifecycle helper. Search/link and personal-content composition remain the root writer's integration pass. This is source validation, not physical-device, hosted or clinical acceptance.

## Consumer API

`CheckResultContent({ input, expanded?, showIdentity?, onNextStep?, onPersonalize?, onOpenSource? })` is reusable in a contextual sheet or full-detail page. `input` supplies the current owner, immutable snapshot (or bounded catalog facts when no snapshot exists), and one fit state:

- `{ kind: 'canonical', packet, expectedBinding }`: independently loaded current binding. The presenter rechecks owner, snapshot/revision, source boundary, product, variant and formula against the originating truth envelope, then uses the existing packet presenter.
- `{ kind: 'legacy', state }`: the existing supported Personal Fit response. It is hidden behind unresolved identity/formula evidence. Legacy factual-only does not establish that a profile questionnaire can improve the result.
- `{ kind: 'loading' | 'service_failure' | 'profile_save_failure' | 'preview_unavailable' }`: distinct operation and capability limitations. No fabricated saved state or supported advice.

Identity leads, then Personal Fit or its limitation. Essential reason, all critical cautions/unknowns, reported cautions, uncertainty and the supported next action do not depend on expansion. Expansion adds formula/source and supporting decision disclosure. Missing identity/formula and unsupported rules do not invite an irrelevant profile questionnaire. A prior-reaction caution can remain useful while the exact formula is unverified. The presenter never evaluates ingredients or invents advice.

`ScanResultSheet` adds `contentInput?`, `onNextStep?`, `onPersonalize?`, `onOpenSource?`, and `dismissLabel?`. Detection callback is optional for non-camera consumers. Existing callers retain factual content. Personal content is accepted only when its owner and immutable case binding match the sheet. The host must still use `selectVisibleCustomerDecision` with the current saved context immediately before supplying a packet and recheck current context before actions. Passing a packet's own binding as independent authority is invalid.

The surface is mineral-white; green is reserved for actions. Product names and essential content are not line-clamped. One bounded scroll area contains identity, answer and details. Drag interaction remains restricted to the existing handle; text scroll does not compete with a new gesture framework. Tap/accessible Expand, Collapse, Close and accessibility escape remain available. Layout animation observes Reduce Motion. Root owns modal focus restoration and keyboard/safe-area composition; physical verification remains required.

## Lifecycle and return

`createCheckResultLifecycle()` owns generation tokens only:

1. `begin(ownerId, origin, requestId)` pins a camera/search/link/history origin and invalidates older work. Search pins query, scroll offset and selected product ID; link pins its input and scroll offset.
2. Check `canPublish(token, currentOwnerId)` before publishing every pending result. `bind(token, currentOwnerId, { snapshotId, caseRevision, formulaVersionId, contextRevision })` pins the acknowledged current result.
3. Check `canAct(token, currentOwnerId, currentBinding)` immediately before contextual navigation or actions. Context/formula/snapshot revisions are exact; optional context refresh does not rewrite history.
4. `dismiss(token, currentOwnerId)` returns the originating context once and invalidates pending callbacks. `invalidate()` handles owner/access changes and abandoned operations. A stale dismiss cannot clear the next result.

Keep Check home/search mounted and opt into the root-owned search preservation API. Closing a result restores input/results/scroll and focus. Tab focus itself must not clear the result. Suspend the sheet before profile editing and reopen the same case only after canonical acknowledgement and current-context refresh. These host behaviors are not implemented inside this leaf.

## Product evidence and ownership

Catalog images require a matching product and approved public provenance. Private customer photos require matching owner/case/snapshot/evidence and retain the `Your photo, unverified` label. The current catalog service returns no public image until rights/provenance are reviewed.

Only a matching authoritative `photograph_ingredients` action plus snapshot `nextRequiredEvidence: ingredients` and a working same-case callback exposes `Add ingredient photo`. Without the callback, copy states the unverified-formula limitation instead of instructing unusable photo collection. The host rechecks case/snapshot/resolver immediately before navigation. This leaf neither implements ingredient continuation nor promotes photos to formula truth. Sami owns that capture/resolver handoff and PR #174; do not copy its unmerged backend work.

Sami also owns local camera-notice exclusivity and deliberate detection rearm. Root must pause detection while any result, including loading/error, is active. Dismissal must not remount into an immediate same-barcode reopen loop. No camera/controller code was changed here.

Saved history remains metadata until an owner-bound sealed detail contract exists. Re-resolving current catalog facts and assessing current context must never be labeled the original historical result.

## Verification

Focused tests cover immutable facts, owner/snapshot/formula mismatch, context versus unsupported-rule limitations, unverified-formula prior caution, save/preview/service/loading distinctions, relevant profile actions, stale close/publication, retained origin, revision-bound actions and unavailable ingredient continuation. Run full unit, both TypeScript checks, web/iOS exports and diff/scope checks before integration; rerun after composition and shared-primitives reconciliation.

Physical acceptance still needs small/large iPhones, long names, larger text, VoiceOver focus/escape/labels, keyboard-open search sheets, text scroll versus handle drag, Reduce Motion/Transparency, critical cautions at collapsed presentation, and camera pause/notice/rearm. No physical or clinical claims follow from compilation or these semantic tests.
