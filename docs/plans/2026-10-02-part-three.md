# Part 3 local implementation plan

Authoritative design: Library libfile_1b83f7bead548191899021ceed42c9de v0; DOCX SHA256 b86f08a40fd51ea82f0884fb9a9c249b1e245505cff5c2b0de452c95ebd39d7b. Clean foundation 96b102dd8bc1d9c10759e8dea2b2d3740ac5dd75.

## Global constraints

Local synthetic implementation only. No external provider calls, credentials, production data, imports, activation, hosted writes, push, PR, merge or deploy. Preserve Part 1/2 authority and account-erasure lock order. Sol 6.1 High is the engineering cap. Source specification prevails over this plan. Evidence-owner and processing approvals remain release gates; initial packs are local engineering fixtures.

## Task 1 Context v2 and durable setup

Extend durable context with explicit Answer states, preferences, use purpose/site/form, assessments and private notes. Preserve v1 semantics with explicit migration. Atomic idempotent CAS setup; deletion purges original history and derived Part 3 output. Integrate five-step setup in existing editor. Verify pure round-trip/concurrency and local Auth/SQL lifecycle.

## Task 2 Trusted decision core and provider seam

Strict PersonalResultV2/binding/finding/purpose contracts. Consume full Part 2 snapshot authority and exact owner context. Implement earned judgments, independent mandatory findings, pair comparison, scoped bounded history and one materially useful question. Host owns headline/reason. Real injected bounded Jev transport converts native Choice protocol, default-off processing/job gates, exact menu/distribution/confidence checks, complete fallback. No clinical role inference.

## Task 3 Runtime and scanner composition

Server independently resolves exact Part 1/2 and context, CAS publishes monotonic results, revalidates every read and atomically saves exact basis. Integrate judge-first into canonical PartOneResultSheet; comparator/intent, question exposure latch, suppression, save/reopen historical/current split, owner/expiry/offline invalidation. Preserve ingredient-only and product-save paths.

## Task 4 Exact-source validation and evidence

All app tests, both typechecks, web/iOS exports. Dedicated isolated DB migration/RLS suite, Auth/Edge lifecycle and deterministic deletion/save races. Native simulator comparisons/questions/save/reopen/withdrawal. Preserve failures and recovery. Review exact source/diff; clean local commits; immutable Library bundle with source/test hashes and full J/C/Q/L/U acceptance matrix. Phone and real provider evaluation remain gates.

The original candidate completed local validation on 2026-10-03 UTC. Independent review then confirmed eight numbered and two secondary findings; the corrections are recorded in `part-three-review-corrections.md`. Runtime correction head is `7cc14932b149372c11b766460b9ff771b4bc129f`. Both recovered typechecks passed. The recovered full-app log contains 1,459 passes, zero failures and five skips across 151 TAP files, but its expired process handle did not yield an explicit final exit receipt. Fresh full-suite completion and both exports now have exit-zero receipts. Recovered native workflows remain pending.

The first corrected native attempt failed its Face-selection assertion and was later interrupted with exit 143; its incomplete result bundle is not credited. The Mac subsequently went offline. Optional haptics now dispatch without delaying user actions, with focused component regressions, but the native failure's cause remains unproven. Native work is serialized with the separately approved Check integration. At the parent's request, the idle dedicated Part 3 simulator and eight local containers were stopped gracefully; volumes and source remain intact. Light source/documentation work continues until the integration releases the native window. Final evidence delivery will replace the existing Library artifact identities with exact-source receipts and preserve failed attempts.


Final resumed validation: app code 7cc has persisted complete full-suite, both typecheck and web/iOS export passes. Native-only harness 6d138189 preserves recalled references and passed all four serial native workflows with complete exit-zero results. Application input equivalence covers 877 non-documentation entries, excluding only the corrected Swift assertions. Final documentation, immutable evidence generation and same-identity Library verification complete the local candidate; independent parent review and the recorded release gates remain additional.

Final native recovery at `6c66fe76fd51a65b4c41ec19aa13062f0dda7ea4` passed all four workflows with complete exit-zero receipts: comparison 67.345 s, setup 29.746 s, conflict 16.483 s, maximum text/long-name/contrast 55.299 s. The exact committed harness was mirrored byte-for-byte for each credited run; temporary route-preparation helpers were separate. Both surviving identity and recalled-wording absence are asserted before/after purpose withdrawal. All 877 other application/backend entries match tested 7cc. Dedicated simulator settings were restored and synthetic fixture cleanup completed with exit zero. Nine existing Library items currently have predecessor version 1; final guarded version-2 replacements and exact transfer/read hashes are attested separately after completion. No physical-phone, human-comprehension or real-provider acceptance is claimed.

## Final residual review checkpoint

R1 and R2 were reproduced before correction; only committed receipt matching, exact target-dimension compatibility, ambiguous display selection and their regressions changed. The dropped-response lifecycle proof is an additional test-only commit. Fresh SQL CLI validation now passes directly. Missing cached CLI and callback-narrowing failures are preserved, as is the synthetic private-permission precondition failure and its supported recovery.

The residual implementation is frozen at `60263b2a997a008446c54d6a540ba5a5d6d76330`. Full app validation passed 179 files: 151 TAP files with 1,460 passes, zero failures and five explicit skips, plus 28 standalone assertion files. Both typechecks and gated web/iOS exports passed with persisted exit-zero receipts. Fresh isolated migrations and the complete Supabase CLI suite passed all 38 files and 1,091 assertions. Actual Auth/Edge/SQL at `6bbd96c410f364f702cd5204e582e337b103923d` passed 183 checks, including discarded HTTP response-body replay after expired-read deletion, changed identity/hash/revision rejection, and refusal after context erasure. Nine injected Jev transport calls and observed deletion races passed; outbound model calls remain zero.

All four final native workflows at `6bbd96c410f364f702cd5204e582e337b103923d` passed with complete exit-zero results: comparison/question/save/reopen/offline/withdrawal/owner clearing (68.832 s), atomic five-step setup (26.268 s), stale-context draft retention (16.200 s), and maximum accessibility text/long name/increased contrast (56.975 s). Exact ingredient identity survives while durably recalled wording is absent before and after purpose withdrawal. The native Swift mirror was checked against committed bytes for every credited run. The only non-documentation change after the full app/type/export source is the separately executed synthetic lifecycle driver; a complete 877-entry equivalence proof records all other unchanged inputs. Retained Part 2 authority/Auth race, full response-byte containment, private lifecycle, public survival, public Auth erasure and recall passed 83/49/107/29/33/35 checks. Simulator settings were restored and synthetic fixture cleanup completed with exit zero. Prior candidate receipts remain predecessor evidence; no failed orchestration is called a pass.

Nine existing Library items currently have version-2 predecessor evidence. Final guarded version-3 replacements, consumer-local archive downloads and complete native text reads are attested separately after exact byte/hash verification. Parent acceptance and existing phone/provider/human gates remain additional; no production activation is claimed.
