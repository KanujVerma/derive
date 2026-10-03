# Normal Check public workflow — local acceptance

Base: `96b102dd8bc1d9c10759e8dea2b2d3740ac5dd75`; isolated branch `kanuj/check-workflow-live`. This document records actual local verification; final commit and remaining matrix are updated before handoff. No hosted activation, phone modification, real customer/health data, model call, new credential or deployment. Dirty main and concurrent Part 3 stacks were untouched.

## Product behavior

Normal Check explicitly searches by name or typed barcode. A public-source name result carries its genuine barcode, source/variant provenance and rights expiry; selecting it invokes the same Part 1 durable scan/worker ledger as typed/camera barcode. The accepted shared result sheet shows identity/photo immediately when permitted, neutral Personal Fit and truthful partial/missing states; swipe reveals sourced ingredient occurrences and inline per-finding detail. Source remains secondary. No new product page or manual identity form.

Capture reuses the existing temporary local photo review. Readable-line corrections are primary; technical coverage, language, boundaries, provenance and recognition history require Label options. A correction cannot prove hidden text or whole-label completeness. Normal capture is nested inside the existing result native Modal, outside the lazily mounted findings; the camera inline companion uses the same content. Optional haptics never delay an action.

## Real provider and approved local data

The supervised gateway listens only on `127.0.0.1:59631` and forwards only exact-origin approved paths to this task's local Supabase API `59621`. Public name search uses bounded HTTPS Open Beauty Facts `/cgi/search.pl`; exact barcode lookup uses `/api/v2/product/<GTIN>.json`. Source policies, DNS pinning, exact hosts, body/deadline limits, quotas, rights/expiry and per-field admission remain enforced. Conditional UPC and all unapproved operations remain disabled. Product images must use the exact GTIN's approved HTTPS CDN path and independently permitted image/display/hotlink rights.

A task-only 24-hour public source policy permits bounded public identity/ingredients/image lookup and display with Open Beauty Facts contributor attribution, ODbL/DbCL and image CC BY-SA 3.0 references. It does not approve private upload/retention, image rehosting/cropping or production export. Default external source gates remain closed; hosted search returns source_configuration_required. Receipts preserve every gateway run in a new timestamp/UUID directory. Local generated credentials remain private ignored files outside all deliverables.

Product identity/photos/raw ingredients below are **live public provider data**, not seeded products. Part 2 uses the accepted finite local reference release: 20 synthetic reference identities/23 aliases plus one genuinely sourced Glycerin/CosIng explanation. Synthetic reference and regression fixtures do not prove product coverage or a populated catalog. Formula/package completeness and personal suitability remain unverified.

## Actual native environment

Own iPhone 17 Pro/iOS 26.5 simulator `17910709-67F5-4DD1-858C-833F54880E2B`; accepted native host bundle `com.derive.skincare`, development-client scheme `derive-p1p2-verify`, ordinary final branch JS from Metro `8141`. No Part One/Part Two fixture UI. Native host built successfully with this worktree, two Xcode jobs; no native ABI change afterward. AXe physical native input and screenshots exercise actual controls; app-clock measurements use an opt-in, credential-free local console probe, not automation wall time.

## Recorded native workflow

- Exact name `CeraVe Schuimende Reinigingsgel`: three live source variants — 236 ml `3337875597197`, 474 ml `3337875597357`, refill `3337875905596`. Correct source quantity/market makes variant selection explicit.
- 236 ml name selection: genuine own photo, title and 28 sourced ingredient entries inside the shared sheet. Glycerin detail opened, including CosIng reference, license and role-only limitation. Unrecognized cocamidopropyl hydroxysultaine showed details unavailable rather than invented content.
- Exact typed barcode `3337875597197`: normal `/functions/v1/part-one/scans` (202), worker/source refresh, same product/photo/ingredients.
- Normal Save: `/functions/v1/part-two/saves` (200), visible Saved. My Stuff listed and reopened the actual saved record via `/functions/v1/part-one/saves/<id>` and `/functions/v1/part-two/saved-details` (200); the shared saved sheet contained all 28 entries.
- Capture, other variants/missing information, no match, controlled slow/offline/retry, repeated/stale response and replacement-search back/cancel matrix: underway; no pass inferred.

Initial capture attempts exposed two actual native issues: Button awaited a stalled haptic promise; normal result and capture were sibling native Modals. Both were repaired before final acceptance. Failed/early screenshots remain diagnostic attempts and are labelled separately in the final evidence index.

## Measured responsiveness

First live variant selection: identity 8,699 ms, image onLoad 8,914 ms, ingredients ready 10,634 ms. Warm name search 394 ms. After pending polling repair, warm typed barcode: identity 1,701 ms, image onLoad 2,346 ms, ingredients ready 2,641 ms. These are readiness timings, not painted frames. Existing source observations and candidate image may be cached; warm measurements are not cold-source claims. Identity is not held behind image/analysis. Pending queued/running polling is one second, with future server retry deadlines respected; completed-result and Part 2 authority refresh cadence remain unchanged.

## Verification receipts and release boundary

Latest full suite/type/export receipts and exact source/commit identity are recorded in the handoff evidence. Clean SQL: 35 files/1,042 tests pass; actual local P1 RPC smoke16 pass using synthetic accounts/fixtures only. Native build BUILD SUCCEEDED/exit0. Independent source review covers actual normal Check, My Stuff saved-private caller, source deadlines/rights, withdrawal and owner/intent fences. Saved-source refusal hides private originals/photos through later pending replies; unrelated dictionary/transport failures preserve independently permitted Part 1 history.

Production operation remains separate: approved source grant/policy/budget/worker/search activation, reviewed dictionary coverage and exact-head release/device checks. Private capture persistence remains disabled; temporary capture correction/back/reopen can be tested without enabling it. No push, PR, merge, hosted schema/data mutation or deployment was performed.
