# Result recovery consolidation — 2026-10-01

Kanuj owns Check composition and physical acceptance; Sami owns camera/platform contracts. Approved local implementation from clean `d5589a1ad04e5b69f2dad6cdaa74ca858d913b3e` on `kanuj/ux-search-scan-qa`. No push, merge, deployment or hosted activation in this pass.

## Implemented behavior

Check owns one product-result sheet across camera, name and link entry. Hosted capture emits observations and retains intentional photo review; it no longer guesses a lookup miss or renders a second product outcome. Retake/Use/Replace, role correction, thumbnails, torch, modes and permission recovery remain capture controls. Barcode detection pauses during results and rejects late paused callbacks; existing one-handoff/background deferral and result-lifetime fences remain.

Unmatched barcode copy is “No verified match for this barcode.” Photograph package and Search by name are in the measured compact fold. Photograph package suspends the result, enters front-label capture and retains local observations. Search replaces content inside the same gesture surface using CatalogProductSearch; Back restores the prior result/evidence and the query/candidate controller. Choosing a candidate is an identity lookup, never formula verification. Parent pixel review removed the redundant variant paragraph from zero-candidate search; it appears only for multiple resolver candidates. Dismissal restores the originating camera role or name/link entry; cancellation restores the suspended result. Findings remain visible on first expansion; only Source expands provenance. The fixed four verdicts and clinical policy are unchanged.

Known identity with missing formula offers ingredient capture instead of repeating identification. The existing `continue_ingredients` contract is now wired through Check's requested-evidence callback: same owner/root case/parent immutable snapshot, role-only private upload, retry IDs and validated child revision2. Cancellation/account change invalidates pending work. A child cannot initiate an unsupported third attempt. The UI/client wiring is tested with injected service fixtures; no live continuation request was executed here.

## Recovery boundaries

| State | Supported behavior and boundary |
| --- | --- |
| Unmatched barcode | Retain barcode; compact package photo/name search. Preview miss is not a live catalog finding. |
| Ambiguous identity/variant | Existing candidate choices and package/name recovery; selection alone supplies no verified formula. |
| Known identity, missing formula | Preserve identity/facts; bound ingredient continuation when an authoritative root exists. Preview uses retained local review. |
| Partial/unreadable photo | Preserve useful evidence; role correction and Retake/Replace target the selected role. No automatic readability detector or OCR is claimed. |
| Unsupported category | Keep verified facts; existing personal assessment abstention. More photos do not invent category support. |
| Network/auth/service failure | Operation error and Retry; capture upload/review recovery remains an error, not evidence insufficiency. |
| Optional personal context missing | Existing product facts remain and only the relevant existing context action is used. |
| Verified facts, unsupported goal/rule | Existing honest abstention; no extra-photo recovery for a missing rule. |
| Conflicting sources/formula | Preserve authoritative conflicts/sources; package confirmation/name recovery without silent formula selection. |

The backend has an ingredient-only child operation, not a generic append-front-label/package-to-existing-case contract. General same-case photo recovery therefore stays local for capture/review; it does not create an unrelated authoritative case while claiming continuity. Photo-only input still has no working OCR/image recognition, and an uploaded ingredient image alone does not verify a formula. This remaining perception/general-append contract belongs to Sami.

## Validation and screenshots

Final source: `npm test`981/981 across114 TAP files, `npx tsc --noEmit`, `npm run typecheck:tests`, web and iOS JavaScript exports all pass. Focused actual handler/render tests cover single hosted outcomes, compact recovery/replacement, original-mode return, retained evidence, late paused scans, owner/cancellation/parent binding and retry reuse. Final diff/whitespace/import/secret review passes. No backend/database/Auth/RLS/analytics/clinical changes, so no migration replay or hosted smoke in this pass. Exact-head CI remains required before a future merge.

Confirmed Library images (Library creation succeeded and local identity/version xattrs applied):

| Evidence | Library file ID | Meaning |
| --- | --- | --- |
| USB before, captured first | `libfile_c33a562cb2808191b78d01a2cc139573` | Actual duplicate camera notice behind canonical result, before navigation/reload. |
| After compact recovery | `libfile_d951fb1a85b48191a0baac629624595e` | Actual served390×844 preview/manual unknown; both direct actions visible. |
| After inline search | `libfile_a8778050d5d481918b76b55b348aeff6` | Corrected final same sheet, retained query and Back; no warning when zero candidates. |
| After known identity | `libfile_d9aebe1153248191a1fc3964922b5551` | Catalog identity retained, formula unverified, ingredient-specific action. |
| Updated simulator Check | `libfile_3b9ae5f9ec5c8191bc55fb014467ee8d` | Current native entry loads; empty-screen variant paragraph removed. |

Browser also verified Back restores the prior result, Close returns to retained entry search, and ingredient-capture cancellation restores catalog identity. Browser camera access was not enabled. These images and fixtures do not establish native barcode optics, gestures, shutter/review, torch or live recognition.

## Runtime and remaining physical acceptance

Existing Expo PID18994 remains in this checkout, port8084, Node22.23.0. Development Mock/`scanner_first_preview`, remote service false; barcode lookups intentionally return unknown and pending photo review is insufficient. No live backend was enabled. USB URL: `exp://169.254.48.58:8084/--/check`; browser: `http://localhost:8084/check`. Existing cable and unrelated servers/checkouts remain intact.

The updated simulator loaded. Supported Expo reload and foreground Expo Go launch succeeded on USB, but subsequent screenshot captures were entirely black; no after-result hardware acceptance can be asserted. Available device tooling captures/launches but does not inject phone touches, and native CUA Simulator selection was unavailable.

Minimum founder sequence: wake/unlock phone, open the URL if needed, Open camera and scan once; check one sheet with both compact recovery actions, Search by name/Back, Photograph package with retained barcode and photo Retake/Use/Replace, cancellation, dismiss/repeated scan/background resume and original mode. Validate a genuinely known root's ingredient continuation separately in an explicitly authorized live integration environment. Matched/unmatched physical results and owner-switch-in-flight acceptance remain open. Parent was sent Library IDs for pixel review.
