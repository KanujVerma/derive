# Part 2 local implementation and acceptance

Derive Part 2 adds deterministic ingredient details to the existing scanner result sheet. It consumes exact Part 1 evidence, preserves original names/order/spans and resolves only a finite exact-name release. Source-only captures remain private attributed readings; a selected declaration may yield narrow product facts only when its entry and current binding gates pass. Normalization never makes partial evidence complete.

This is a local implementation record in progress, not hosted activation or a complete acceptance claim. The parent integration owner must finalize the exact commit, final full-suite/DB/Edge/export/simulator results and immutable evidence references after final review. No push, PR, merge, deployment, live provider enablement or account/credential changes are authorized by this implementation.

## Foundation and scope

- Authoritative design: Library `libfile_b44e814fd7ac8191b2879565920f1d67`, version 0, `derive-part-two-implementation-spec.docx`; DOCX SHA256 `6559244bf118507e12a624af73ee8719e8b593654adbb799c3b69485f6f9e173`.
- Exact Part 1 foundation: `243ee1732bfbd356044ca802af7481dd2fdf3e37`, preserving its Declaration and FactBundleV1 contracts.
- Accepted UX foundation: `fea1a214dd174deccffbdb08fb2aa48c1e8fd0e0` through Part 1.
- Final Part 2 integration branch/head and evidence bundle: **pending parent final commit/validation**. The primary checkout and unrelated Sami/PostHog work are outside this scope.

Part 2 has no model/provider/dictionary request on normalization. It does not add a numerical score, ingredient rating, clinical prediction, negative/absence/free-from fact, suitability guidance, skin-profile interpretation or Jev output. Part 3 remains separate.

## Core and release boundaries

[`PartTwo.ts`](../src/contracts/PartTwo.ts) supplies closed Zod schemas for reference-only requests, authoritative inputs, every work state, immutable snapshots and the five admitted fact kinds. Every result carries authenticated owner, scan/capture target, request ticket, authoritative binding key, generation, exact evidence revision, independent monotonic Part 2 result revision and deadline. Equal revisions permit identical meaning only, ignoring the per-request ticket. Part 1 evidence revisions remain pinned and distinct.

[`src/domain/part-two`](../src/domain/part-two/index.ts) implements bounded lossless parsing and immutable derivation. UTF16 half-open spans and lookup offset maps preserve original source coordinates, including nonzero source offsets. Structured ingredient rows are preferred; explanatory/layout residuals remain unresolved spans rather than additional ingredients. Unsupported syntax, uncertain transcription and dictionary misses retain readable literal evidence. Prefix/suffix/parenthetical amounts preserve exact decimal strings, operators, subject and basis. Only a supported mg/g claim receives exact percent w/w conversion; no density or constituent amount is inferred. Exact decimal comparisons refuse impossible values and reversed ranges without floating-point rounding. Combined operators abstain.

The checked release is deliberately small and synthetic:

| Component | Final interpretation release |
|---|---|
| Dictionary | `derive-local-exact-v2` |
| Identities / aliases | **20 identities / 23 exact aliases** |
| Dictionary canonical content SHA256 | `dcc577b2fa0928c7560a224116229461b94ba62241541f1cd4ab7238163af9e2` |
| Parser | `bounded-lossless-v2` |
| Resolver | `lookup-nfc-case-space-v1` |
| Quantity | `exact-printed-v2` |
| Fact policy | `attributed-positive-facts-v5` |
| Explanation pack | `glycerin-reference-v1`, **one original Glycerin formulation-role card** |

This is original local fixture vocabulary, `local_only` / `local_fixture_only`. It is not an imported external glossary, an adjudicated production corpus, source rights approval or market-coverage evidence. No GSRS, PubChem, PCPC or competitor database/prose is imported. One bounded CosIng Glycerin humectant role projection and definition scope supports an original reviewed sentence; its separate rights/dependency ledger is [Part 2 reference inputs](PART_TWO_REFERENCE_INPUTS.md). GSRS remains an offline qualified-reference option. The public production release needs explicit finite-corpus adjudication, source operations/rights review, release/privacy/QA owners and rollback decisions. Unknown permission disables the affected import or annotation. Missing or withdrawn explanations do not block deterministic core normalization. The one active Glycerin card keeps role-source evidence separate from original editorial wording, with credit/licence/source/review metadata and independent policy expiry/withdrawal.

Cache keys include private owner/capture/package identity or exact selected item/snapshot/declaration revisions, source/dependency digest, versions, epochs and deadlines. Auth, ownership, permissions, current evidence/release state and CAS publication are rechecked by the backend. Historical snapshots cannot bypass deletion, revocation or expiry. Source-only snapshots cannot acquire product IDs later. No profile revision enters the Part 2 interpretation key.

Explanation withdrawal is independent of ingredient identity withdrawal. Trusted durable tombstones cover the card, its dependencies, source policy, entry, definition and licence. Current normalization pins relevant tombstones in its cache key and manifest and suppresses only matching reference facts, even after a release rollback. Saved content may receive a new immutable card-only projection at a greater Part 2 revision, retaining original ingredient/span/quantity facts and historical snapshots. The shared schema rejects recalled cards in a tombstoned manifest. Backend authorization, tombstone persistence and CAS remain required for this projection; a pure helper alone does not establish live recall behavior.

The `product_label_assertion` variant is closed but ingredient rows do not automatically create label-assertion facts. Literal fragrance-free wording stays readable and is not an ingredient/negative fact. A future authoritative assertion capture must supply its own bound evidence.

## Runtime and customer surface

[`part-two-runtime.ts`](../supabase/functions/_shared/part-two-runtime.ts) resolves authorized Part 1 records, validates exact source text/spans and permissions, reuses an exact compatible snapshot or runs bounded local derivation, then publishes only under the live CAS guard. The local database migration installs private work/snapshot state, release registration/selection, service-only publication, authenticated reference operations and dependent invalidation. Initial release selection is disabled in the migration. A fixture-approved local environment can register the exact compound interpretation release; this is not hosted enablement.

The existing Check/saved-evidence surface uses [`PartTwoIngredients`](../src/components/check/part-two/PartTwoIngredients.tsx). Original permitted source text and existing identity/save actions remain usable. Ingredient rows open compact inline details with quantity/modality/source attribution. Missing enrichment stays explicit. The client discards mismatched owner/target/generation/evidence revision/request tickets and regressed revisions, and clears expired material. Invalidated open detail content is withdrawn while its close shell remains reachable. This adds no analysis screen or mandatory completion confirmation.

Physical OCR/image recognition and general real-photo whole-list completeness are not established by these synthetic tests. Part 1's unsupported optical/completeness paths and remaining physical release gates remain unchanged.

## Executed evidence and pending final checks

The core suite with the one-card pack has **33 passing test groups**, including **450 fast-check cases**: seeds 20261002 (250), 20261003 (Unicode 100) and 20261004 (decimal precision 100). Final core app/test TypeScript checks and diff whitespace check passed on Node22.23.0/macOS arm64 Apple M2 Pro. Fast-check is pinned dev-only; no production parser framework was added.

Independent frozen core review found seven defects in source/output fidelity, quantity abstention and bounded states. Reproducible regressions now reject foreign subjects/spans/quantities, contradictory bound rows, same-length altered unresolved text, compound quantity operators, decimal-boundary rounding, section-overflow error throws and `none`-state product facts. Structured non-cell text remains accounted for. Final policy v5 binds the one-card rights metadata and durable independent explanation-withdrawal semantics to the completed snapshot shape. Four further test groups exercise current withdrawals, cache compatibility, rollback non-resurrection, saved projections and strict stale-card rejection.

Pre-final local logs recorded public Auth/SQL/Edge normalization (19 checks, zero external normalization calls), source-only private ownership/reopen/deletion paths and the combined Part 1+Part 2 private flow (89 checks). These are development synthetic sources and earlier interpretation runs; **final clean reset, DB suite, v5/one-card registration/restarted Edge smoke and final-source acceptance evidence remain pending parent confirmation**. The existence of scripts/tests below is not proof that every subcase or final runtime gate executed.

Final full `npm test`, app/test typechecks, web/iOS exports, clean database replay and pgTAP, exact-local integration smoke, final diff review, simulator accessibility/focus/save flows and exact final commit evidence: **pending parent record**. Exact-head hosted CI, physical phone/camera/offline/accessibility and held-out market/formula-family evaluation remain unrun release gates unless the parent supplies independent evidence.

## Proposed criteria mapped to current evidence

“Core executed” refers to the final 33-test/450-case suite. “Runtime/controller fixture” identifies targeted code/test coverage and pre-final local evidence; it does not replace the pending final v5/one-card runtime rerun. Each criterion has narrower evidence than broad market, optical or hosted acceptance.

| ID | Current evidence / remaining limit |
|---|---|
| A01 | Core executed source-only/private schema and no product IDs; backend/UI source-reading fixtures. |
| A02 | Core executed partial bound per-entry product facts, without whole-list promotion. Real-photo entry clarity unproved. |
| A03 | Core executed no completeness uplift from mapped visible entries. Cropped optical tail detection unproved. |
| A04 | Core executed public-source attribution/unconfirmed package; inline UI fixture. Physical bottle revision unproved. |
| A05 | Core executed exact water equivalent/locant spans. Supported aliases are finite fixture decisions. |
| A06 | Core executed exact slash polymer/botanical names; `(and)` blends conservatively unresolved. No general blend grammar. |
| A07 | Core executed hard-negative molecule/salt/botanical-part/PEG distinctions. Not comprehensive chemistry coverage. |
| A08 | Core executed transcription uncertainty and toner/chemical hard negatives; no fuzzy repair. Optical alternatives recognition unproved. |
| A09 | Core executed may-contain/alternative scopes and new-section reset; UI fixture preserves qualifiers. Complex unknown scope abstains. |
| A10 | Core executed prefix/suffix/parenthetical subject/spans and global-offset cases; printed-amount UI fixture. |
| A11 | Core executed mg/g vs mg/mL, bare basis, decimal commas and comparison/range meaning. Unknown density/context abstains. |
| A12 | Core executed complex/blend amount subject; no constituent percentage inference. Trade-name component expansion unsupported. |
| A13 | Core executed ordinal/inactive section retention; no inferred concentration or famous-ingredient active designation. |
| A14 | Core executed impossible/sign/reversed/excess-precision amounts and combined operators; no numeric repair. |
| A15 | Core executed unknown/empty/no-negative boundaries and typed no_declaration. No independent label-assertion capture/facts enabled. |
| A16 | Core executed collision/hash/release validation plus independent card/source-policy dependency withdrawals preserving identities. Production split/recall impact review remains pending. |
| A17 | Core executed version-scoped cache keys; SQL fixture tests increasing revision on release changes. Final v5/one-card DB rerun pending. |
| A18 | Evidence/revision/market separation enforced by keys/contracts; same-GTIN market/formula replacement end-to-end corpus not fully executed. |
| A19 | SQL fixtures/pre-final smoke test retraction, current blocking, late publication and copied private payload purge; final v5/one-card rerun pending. |
| A20 | Controller fixtures cover every pending/terminal binding and account mismatch; generated monotonic work states, late errors and CAS stale publication fixtures. Full final runtime/deletion rerun pending. |
| A21 | SQL/runtime fixtures cover foreign-owner cache access; source/cache keys include owner. Identical-private-text two-owner population/privacy acceptance pending. |
| A22 | Core executed durable-tombstone cache semantics, rollback non-resurrection and monotonic immutable saved projections. SQL/controller fixtures cover stale work and equal replay. Final concurrent v5/one-card runtime recall/rollback smoke pending. |
| A23 | No public/private evidence union; separate dependencies. Independent-public-proof survival after private deletion specific end-to-end case remains pending. |
| A24 | Controller/UI fixtures clear expired memory material; finite inherited deadlines enforced. No new durable offline cache approved; physical offline/reconnect acceptance pending. |
| A25 | Core executed foreign/malformed binding, source/span/subject/raw/quantity rejection; service-only publication/request boundary fixtures. Final DB least-privilege rerun pending. |
| A26 | Core executed bytes/sections/occurrences/depth limits, malformed syntax and inert markup; request-body bounds/UI control rendering fixtures. Exhaustive dependency/memory stress pending. |
| A27 | Core executed astral/combining/bidi/control/surrogate cases, duplicate occurrences and deterministic original UTF16 slices; 350 name/Unicode generated cases. Whole-panel optical alignment unproved. |
| A28 | Runtime fixtures/pre-final local reopen joins work/reuses snapshot; UI fixture retains source text and actions. Physical interaction/latency acceptance pending. |
| A29 | Controller save fixture sends exact Part 1/Part 2 CAS and rejects stale save. Part 1 correction/alternative-list lineage reused; complete final correction/save/selection flow pending. |
| A30 | Actual component fixtures cover named rows/close action, expired/invalidation shell and visible limits. Physical large text, VoiceOver/TalkBack/focus/scroll unrun. |
| A31 | Core executed one original Glycerin card with separate source rights metadata; missing, withdrawn, expired, revoked and permission-disabled card cases retain identity evidence; independent card/entry/definition/licence tombstones remove current or saved cards without identity loss. No nearby/model filler; no production corpus enabled; usage remains unknown. |
| A32 | Core executed stable IDs and preserved qualifier/quantity/scope limitations. Jev/profile Part 3 consumer integration is excluded. |

## Measurement and quality limits

The pre-pack v3 exploratory benchmark includes strict source/dependency/schema/hash/freeze work but excludes authorization, DB/network, OCR and render. Apple M2 Pro/Node22.23.0, five warmups then 30 runs at each size, one normalization at a time, with other integration agents/exports active: 100 entries p50/p95/p99 **23.897/168.383/201.846 ms**; 1000 entries **804.479/1645.489/2422.451 ms**. The host was not isolated. A later pre-withdrawal-v5 one-card in-memory benchmark at 100 repeated entries measured Niacinamide (no reference card) p50/p95/p99 **5.887/15.197/16.200 ms** and Glycerin (100 occurrence-linked cards) **5.702/12.313/12.763 ms**, five warmups/30 runs on the same nonisolated host. These establish bounded local core timings only; the proposed warm server/cache and phone targets remain pending controlled measurements. Earlier faster observations are exploratory, not a final performance promise.

Mapping and explanation coverage remain distinct: the dictionary contains 20 finite identities/23 aliases and one rights-qualified original card. Passing synthetic cases do not give population precision, market resolution coverage, unknown/error rates or real-photo completeness. A separately adjudicated corpus with formula-family holdouts is still required. Critical failures discovered by review were repaired in the regression set; do not turn “no known failures in this bounded set” into a general zero-error claim.

## Final evidence to be completed by integration owner

The immutable review bundle should pin final code head/base/branch, complete source/diff/test files, executed versus unrun matrix, source/data permissions, all release/version hashes, benchmark protocol, runtime/simulator environment and exact Library deliverable IDs/version/hashes. Final source/test hashes for the one-card v5 release include contracts `a1865f282a40073121d73f79e301c5d652e51e55d02414dbb02af0f3e1b788d2` and core index `5d0e33c4ab4ef9658f72cbe0c0627e1bee472d24fb973de069a5df5edf1983da`; the parent final evidence manifest is authoritative for the complete integration.
