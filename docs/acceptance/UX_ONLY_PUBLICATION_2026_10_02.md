# UX-only camera and search publication

## Scope and extraction

The user authorized a separate UX-only PR, CI and normal merge. The fresh base is `origin/main@7efb9ce446c6b7b54b3803fa85522b47da2a05ee` (PR193). The isolated branch is `kanuj/ux-only-camera-search`; the original phone preview and the separate PostHog checkout remain intact.

This branch extracts the approved search/lifecycle work from `d5589a1`, result consolidation from `b4d0e31`, and only UX source/tests from `9fd5c92`, `a919920` and `b2384b3`. Conflicts against the combined preview were resolved without its measurement hooks, feedback controls or viewport instrumentation. No analytics foundation/fixes/deletion work, dependencies, runtime configuration, root layout, backend, database, Auth/RLS, billing or clinical policy changes are included. Main's existing analytics code remains unchanged. Sami's open PR194 at `afcfde46e1b3a8239b5b82952aa68c8c8f5d42e5` is separate and unactivated.

## Resulting behavior

- Check owns one product-result sheet across camera, catalog selection and link entry. Capture owns observations and intentional photo review, without guessed catalog outcomes or a duplicate result notice.
- Barcode MVP shows frame, X, torch and borderless Search. The frame reserves footer/safe-area space. Photo controls remain behind `CHECK_PHOTO_CAPTURE_ENABLED = false`.
- Unknown barcode reads “No verified match for this barcode.” Direct catalog search appears in the compact result; camera Search opens the same sheet. Query/candidate state remains in Check. Choosing a catalog identity never verifies its formula.
- Search-only sheets use one measured detent, retain their greatest content height while typing/loading, and reset when the query clears. The registered sheet input stays above the keyboard. X/swipe dismisses the keyboard and returns to the origin. Camera resume increments an epoch without remounting capture.
- Both raw-name fallback buttons and their dead handler are removed. All Check catalog search hosts show exactly “No products found” on settled no match. Real catalog matches remain selectable.
- Findings appear on first expansion; Source alone expands provenance. The four verdicts and conservative formula comparison semantics remain. Service failures offer Retry independently of evidence gaps. Static exact-variant warning and normal Check's Result examples link are removed; the existing developer example route remains guarded.
- Retained photo recovery and the existing ingredient-only continuation client are preserved behind the disabled photo capability. Continuation validates owner/root case/parent snapshot/product/variant/child revision, cancellation and retry binding. No backend continuation contract is added.

## Validation

The isolated UX source passes `npm test`: **990/990 tests across115 TAP files**, with no failures, skips or cancellations; assertion scripts also pass. Application `npx tsc --noEmit` and `npm run typecheck:tests` pass with zero errors. Web and iOS JavaScript exports pass. Logs and build artifacts are outside Git under `/tmp/derive-ux-only-*`.

Focused production component/controller regressions cover single hosted outcomes, compact recovery, same-sheet catalog selection, query/candidate retention, missing-name copy, measured search growth/reset, keyboard dismissal, origin return, stale dismissal/results, owner changes, background delivery, held/different/quiet/retry barcode observations and ingredient continuation binding. The React review checked stable hook order, lazy controller initialization, effect cleanup, current callback refs, accessible controls and stale-operation guards. Diff/whitespace, client/server import and secret-boundary review passes. Exact-head CI remains required before merge.

The isolated production web export was served on loopback8096 and exercised with the available Playwright browser (agent-browser was unavailable). Check entry, partial `cer` search returning the sourced mock CeraVe Renewing SA Cleanser, absent query showing only “No products found”, matched selection into one conservative result and X returning the retained query all pass, with zero browser page errors. Screenshots `/tmp/derive-ux-only-web-{check,search-results,search-empty,result}.png` were inspected. This is browser/mock evidence, not optical or live backend acceptance. The task-owned temporary static server is separate from the preserved Expo preview.

## Prior actual phone evidence

These are confirmed USB captures of the accepted UX in the original combined Development Mock preview, not captures of this isolated branch. User taps/typing/clear/X supplied touch; available device tools supplied capture. All images were inspected and saved to Library. The UI source was reconciled against that preview while excluding analytics dependencies.

| State | Confirmed Library ID |
| --- | --- |
| Original duplicate, captured before navigation | `libfile_c33a562cb2808191b78d01a2cc139573` |
| Normal Check without examples link | `libfile_29b8887c74c48191a039071079edae8a` |
| Centered frame and borderless Search | `libfile_016432725a008191b41408a46fb44c59` |
| Empty direct Search above keyboard | `libfile_d4bed044f09081918374baf60c41e11a` |
| Same sheet grows for mock CeraVe row | `libfile_2aebc3c6bbac81918d3ece6675cb0de6` |
| Clear restores compact empty height | `libfile_bab72c6bdbd88191a97189e5a9b45ec6` |
| X returns to camera without sheet/keyboard | `libfile_401e734274288191abbc4479d9edd497` |

After the raw-name removal the user reported “the phone change is working.” There was no additional publishable screenshot of that fallback state; its entry/camera behavior is covered by production component regressions.

## Runtime and remaining acceptance

The preserved Expo preview runs from `derive-ux@b2384b3` on8084 at `exp://169.254.48.58:8084/--/check`, with development/mock routing, remote services false, scanner release false and analytics/privacy approval false. Preview barcode misses are synthetic, not real catalog coverage. No hosted service or provider was enabled.

Still captures establish settled layouts, not animation smoothness. Physical held-barcode dismissal/re-entry, matched/unmatched repeated optical scans, background/resume, torch/permissions, native swipe and VoiceOver remain hardware acceptance limits. Browser/component tests do not establish those capabilities. Live signed backend coverage remains separate from this UX publication.

Photo OCR/recognition is unavailable. The existing backend has ingredient-only child continuation, but no generic package/front-label append to an authoritative existing case; generic photo recovery retains local review. More photos do not fix unsupported categories/goals/rules. Sources/conflicts remain attributed and are never silently promoted to verified formula truth.
