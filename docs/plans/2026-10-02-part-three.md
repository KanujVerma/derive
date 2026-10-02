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
