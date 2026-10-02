# Part 1 local implementation — 2026-10-02

Approved input: Library `libfile_3e6fce8be450819194a56baff0d8d66e`, `derive-part-one-implementation-spec.docx` (12 pages, 29 cases). The complete DOCX paragraphs and tables were materialized and read on this Mac. This implements Part 1 boundary contracts only; personalized reasoning and Jev expansion remain Parts 2/3.

## Base and scope

Isolated branch `kanuj/part-one-implementation` starts at accepted UX `fea1a214dd174deccffbdb08fb2aa48c1e8fd0e0` (PR195), fetched from main before implementation. No Sami branch was merged or reused. Separate PostHog `f0408236665ada60fe74799224cc301164d1a326` and dirty primary checkout remain independent and untouched. Local commits are authorized; push, PR, merge, CI dispatch and deployment are not authorized here.

Strict versioned requests/results/display/fact bundles, GTIN normalization and deliberate barcode choice, immutable evidence admission and chemical source spans, additive private Supabase operation ledger, owner-authenticated Edge interface, deduplicated leased jobs/checkpoints/atomic quotas, snapshot-at-save/read/deletion, and the existing Check/result-sheet composition are implemented. Catalog reuse admits verified identity only; legacy ingredient arrays do not become declarations. No profile, health context, universal score or AI model call enters this path.

Feature activation is explicit, development-only and loopback-local: `EXPO_PUBLIC_PART_ONE_ENABLED=true` with Development Remote on exact local Supabase. It does not activate hosted scanners. The label preview additionally needs `EXPO_PUBLIC_PART_ONE_OCR_EVALUATION=true`, native iOS, and successful isolated-cache initialization. The synthetic UI route requires `EXPO_PUBLIC_PART_ONE_FIXTURE_UI=true`; it performs no durable save or provider call.

## Acceptance accounting

“Pass” below means deterministic synthetic contract/database coverage. It does not certify optical recognition, provider coverage, physical performance, terms compliance or production readiness. Native/simulator evidence and remaining gates are separate. All 29 cases have deterministic fixtures. A07 and A25 do not establish an activated durable private-photo path: policy-disabled assertions, private transaction fixtures and domain DEC fixtures must be assessed separately. No aggregate test total makes those acceptance gates pass.

| Case | Deterministic fixture coverage | Remaining real-world gate |
|---|---|---|
| A01 | Pass: canonical UPC/EAN/provider keys and native representations | Optical callback cadence |
| A02 | Pass: UPC-E, EAN-8, unknown 8 digits, case/retailer namespaces | Device symbology coverage |
| A03 | Pass: deliberate selected Vaseline target; repeated/background callbacks suppressed | Physical multi-code rotation/zoom/crop/missing bounds |
| A04 | Pass: decoded code and printed valid number remain distinct | Real La Roche-Posay capture |
| A05 | Pass: CeraVe identity plus contradictory soda declaration rejected | Authorized provider fixtures/coverage |
| A06 | Pass: corrupted polymer text preserved, uncertain, no repair | Real panel/extractor accuracy |
| A07 | Partial: private DEC and owner binding fixtures prevent shared promotion; committed OCR is conservatively partial | Accepted private package-to-declaration proof, approved upload/retention and physical source acceptance |
| A08 | Pass: variants conflict; unknown market never inherits request US | Actual regional/variant coverage |
| A09 | Pass: immutable same-GTIN declarations and saved selection | Reformulation/source coverage |
| A10 | Pass: substring/key ingredients fail complete bounds | Authorized extractor corpus |
| A11 | Pass: locants, punctuation, slash compounds, quantities, may-contain source spans | Broader labeled chemistry corpus |
| A12 | Pass: active-only remains partial; prose/complex claims excluded | Physical Drug Facts and multilingual labels |
| A13 | Pass: image revision does not refresh ingredients | Asset display/retention grants |
| A14 | Pass: missing tail/glare/confirmation cannot clear partial | Camera quality and targeted recapture |
| A15 | Pass: same-package aligned overlap lineage; incompatible views unmerged | Curved-panel/manual alignment usability |
| A16 | Pass: correction-off and assisted observations retained; disagreement blocks | Real chemical OCR accuracy; assisted release configuration |
| A17 | Pass: denied/cancelled/script/model/offline states are distinct | Physical first-use offline/camera denial; Android model choice |
| A18 | Pass: Back/cancel/scroll, cap, removal, expiry and cleanup epochs | Physical camera/cap memory benchmark |
| A19 | Pass: late OCR/catalog owner/generation/capture responses rejected | Physical rapid interactions |
| A20 | Pass: unique shared jobs, atomic quotas, retained unknown reservations | Permitted live provider quotas/429 |
| A21 | Pass: read/rejoin without fetch, lease/crash/checkpoint/poison terminal recovery | Foreground four-second target on phones |
| A22 | Pass: typed failures, HTML/malformed/timeout/429 vs genuine misses | Authorized live adapters |
| A23 | Pass: contradiction/retraction increments revision; stale publish rejected | Real-source contradiction workflow |
| A24 | Pass: atomic save CAS, tombstones, owner switch/deletion fences | Offline device lifecycle replay |
| A25 | Conditional fixtures: separate owner evidence, immutable edit receipts, foreign denial and deletion guards | Real sanitized upload/attestation and Storage byte-deletion executor are unavailable; private operations remain policy-disabled |
| A26 | Pass: permission expiry/revocation removes dependent material; independent facts survive | Reconnect/offline expiry on physical devices |
| A27 | Pass: cleanup isolation/restart/fail-closed; actual simulator HEIC metadata strip | SDK pre-return acquisition cache window; physical logs/backups |
| A28 | Pass: identity-only, partial and accepted snapshot-at-save reads | Physical restart/recovery |
| A29 | Pass: named actions/textual statuses and native accessibility reachability | VoiceOver/TalkBack, large text and rotation acceptance; app remains portrait |

Fixture suites: evidence, backend HTTP, capture, lifecycle and accessibility under `tests/part-one-*.test.ts`; database matrix `supabase/tests/part_one_evidence.test.sql`. Real source correctness is tested independently from coverage with synthetic fixtures; none are represented as live catalog observations.

## Source and privacy decisions

Every external policy operation remains false: Open Facts, UPCitemdb, manufacturer, DailyMed, SmartLabel and private capture. The primary worker runs catalog-first orchestration through callable Open Facts and conditional UPCitemdb identity adapters with injected transport, policy checks, bounded bodies/deadlines and per-redirect reservations. Its CLI keeps all endpoint configurations and network transport unavailable. Fixture correctness is distinct from live provider coverage. Manufacturer/DailyMed need package/NDC association and reviewed extractors before activation. No API key, paid service, provider network request, cloud photo/model fallback or real health-profile transmission was used. Existing catalog identity permission does not authorize legacy formula promotion.

Lookup, processing, retention, public/private display, hotlink/rehost/crop, attribution, export, purge obligations, policy duration and offline windows require reviewed per-source grants. Private sanitized upload destination, original/photo/transcript retention, user edit provenance and deletion derivatives remain release decisions. Private commit/edit/read/removal contracts have a gated owner transaction and strict immutable receipts; the deployed-default endpoint returns a typed disabled response. Committed text remains partial because the current upload/request path cannot establish complete package/category/variant/market proof. Sanitation attestation creation/upload and the Storage byte-deletion executor are unimplemented boundaries. The private commit/read/delete client helpers currently have no UI callers, and capture read returns session metadata rather than restored observations, photos or reviewed result. These gaps are locally implementable behind disabled gates; they are not permission blockers. The approved continuation will implement and test that complete private workflow before A07/A25 can be called complete. Memory preview never becomes a durable accepted declaration. No deployment/production schema behavior is claimed.

On-device Apple Vision is replaceable and separately gated. Correction is off; no ignored customWords claim. One recognizer, six images and 4096-pixel edge are engineering limits pending phone benchmarks. The live capture review offers source images, missing-region prompts, per-line section/language, attributed corrections/originals, exact overlap assembly, and a retained same-sheet local summary. Native picker/permission/retry handlers fence capture epoch, owner and binding before and after every await. Picker/camera app-cache copies move to an opaque task-owned directory; startup purges that directory; sheet end/logout/account switch/removal/30-minute inactivity invalidate drafts and queue cleanup. Process death before Expo returns an acquisition URI can leave an SDK-owned cache copy. Broad deletion of unrelated picker caches is deliberately avoided; this narrow gap remains a physical privacy gate.

## Review dispositions

The bounded review fixed representation-dependent retailer UPC classification (including the narrow checksum-valid iOS EAN13/UPC12 alias), exact immutable candidate binding and expiry, late joins to running public jobs, quota deferrals at the attempt limit, deletion-start fencing, per-field display and saved-list expiry, and expired/removed capture reopen. Corrections preserve monotonically identified originals and historical assemblies; package contradictions cannot be confirmed away. Provider checkpoint regressions cover global Retry-After and parsed redirect misses. Revoked image policy is rechecked after candidate selection reconstruction before storage/response. Unresolved active captures keep their original null binding and frozen label across same-generation identity enrichment; explicit item adoption still needs a new user binding. Private asset UUID uniqueness is case-insensitive, and package UUID casing cannot invalidate a successful commit receipt. Native and structured brand assertions are both retained; a contradiction blocks ingredient readiness instead of silently discarding one assertion.

## Validation evidence

Final numerical receipts are recorded in the implementation report and source review bundle. The full application/test typechecks, web/iOS exports and native Debug/Release Simulator builds are required alongside full app and isolated database suites. Native proof includes synthetic HEIC OCR/metadata sanitation and actual selected-photo picker→Vision for initial/nonzero generations. A final native XCTest exercises live review/correction/original retention, Back, removal/re-import, picker cancellation and account recovery. Field expiry, retained inactive-draft expiry, stale callbacks and owner switches also have deterministic actual-handler fixtures. Closing the native fixture clears its draft; that run does not establish a retained 30-minute physical expiry or phone performance.

No physical-device tests ran. Optical barcode selection, real-package label photography, phone quality/performance/memory, accessibility/rotation, live-provider/source-policy acceptance, hosted operations and exact-head CI remain open. These are release gates, not inferred passes from the simulator. The app has no configured lint command; no new lint tooling was installed.
