# Part 2 local implementation and acceptance

Derive Part 2 adds deterministic ingredient details to the existing scanner result sheet. It consumes exact Part 1 evidence, preserves original names/order/spans and resolves only a finite exact-name release. Source-only captures remain private attributed readings; a selected declaration may yield narrow product facts only when its entry and current binding gates pass. Normalization never makes partial evidence complete.

This records implemented local runtime behavior and bounded synthetic acceptance. Hosted and physical release acceptance remain open. The final immutable report pins the final commit, complete receipts and Library references. No push, PR, merge, deployment, live provider enablement or account/credential changes are authorized by this implementation.

## Foundation and scope

- Authoritative design: Library `libfile_b44e814fd7ac8191b2879565920f1d67`, version 0, `derive-part-two-implementation-spec.docx`; DOCX SHA256 `6559244bf118507e12a624af73ee8719e8b593654adbb799c3b69485f6f9e173`.
- Exact Part 1 foundation: `243ee1732bfbd356044ca802af7481dd2fdf3e37`, preserving its Declaration and FactBundleV1 contracts.
- Accepted UX foundation: `fea1a214dd174deccffbdb08fb2aa48c1e8fd0e0` through Part 1.
- Part 2 branch: `kanuj/part-two-implementation`; original implementation commit `0471ea2962810d333ba746d6b7d9bb6896dc7b69`, reviewed v1 `97fbead5adb9e61a0f483c7745baa596a1e8d1a9`, followed by the bounded withdrawal-safe projection and section-heading correction. The immutable report pins the final branch head and evidence bundle. The primary checkout and unrelated Sami/PostHog work are outside this scope.

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
| Parser | `bounded-lossless-v3` |
| Resolver | `lookup-nfc-case-space-v1` |
| Quantity | `exact-printed-v2` |
| Fact policy | `attributed-positive-facts-v7` |
| Explanation pack | `glycerin-reference-v1`, **one original Glycerin formulation-role card** |

This is original local fixture vocabulary, `local_only` / `local_fixture_only`. It is not an imported external glossary, an adjudicated production corpus, source rights approval or market-coverage evidence. No GSRS, PubChem, PCPC or competitor database/prose is imported. One bounded CosIng Glycerin humectant role projection and definition scope supports an original reviewed sentence; its separate rights/dependency ledger is [Part 2 reference inputs](PART_TWO_REFERENCE_INPUTS.md). GSRS remains an offline qualified-reference option. The public production release needs explicit finite-corpus adjudication, source operations/rights review, release/privacy/QA owners and rollback decisions. Unknown permission disables the affected import or annotation. Missing or withdrawn explanations do not block deterministic core normalization. The one active Glycerin card keeps role-source evidence separate from original editorial wording, with credit/licence/source/review metadata and independent policy expiry/withdrawal.

Cache keys include private owner/capture/package identity or exact selected item/snapshot/declaration revisions, source/dependency digest, versions, epochs and deadlines. Auth, ownership, permissions, current evidence/release state and CAS publication are rechecked by the backend. Historical snapshots cannot bypass deletion, revocation or expiry. Source-only snapshots cannot acquire product IDs later. No profile revision enters the Part 2 interpretation key.

Explanation withdrawal is independent of ingredient identity withdrawal. Trusted durable tombstones cover the card, its dependencies, source policy, entry, definition and licence. Current normalization pins relevant tombstones in its cache key and manifest and suppresses only matching reference facts, even after a release rollback. Saved content may receive a new immutable card-only projection at a greater Part 2 revision, retaining independently permitted ingredient/span/quantity facts and permitted lineage/minimal metadata. Saved links are repointed to the replacement snapshot, then the unsafe old derived payload row is purged; withdrawn text is not retained as historical payload. The shared schema rejects recalled cards in a tombstoned manifest. Backend authorization, tombstone persistence and CAS remain required for this projection; a pure helper alone does not establish live recall behavior.

Service-admitted label assertions require exact retained-source hash and UTF16 span validation plus independent default-deny field grants. Ingredient rows do not create label assertions. Literal fragrance-free wording is attributed “Label says” evidence and never an inferred absence fact. Full label text remains server-only validation input; strict client assertions expose only permitted text, canonical provenance, hash and a finite conditional marker. Revocation projects both current and saved roots at a greater immutable revision, preserving separately permitted ingredients and claims without copied withdrawn usage.

## Runtime and customer surface

[`part-two-runtime.ts`](../supabase/functions/_shared/part-two-runtime.ts) resolves authorized Part 1 records, validates exact source text/spans and permissions, reuses an exact compatible snapshot or runs bounded local derivation, then publishes only under the live CAS guard. The local database migration installs private work/snapshot state, release registration/selection, service-only publication, authenticated reference operations and dependent invalidation. Initial release selection is disabled in the migration. A fixture-approved local environment can register the exact compound interpretation release; this is not hosted enablement.

The authoritative resolver is service-only: authenticated clients cannot fetch full retained-source validation context. Edge resolves the owner from validated Auth before invoking the service resolver; ordinary save/read operations retain their user-JWT boundary. Publication and legacy projection reconstruct strict permitted response containers, including nested manifest, source, permission, literal and fact metadata. Ready responses reject pending-only text fields.

The existing Check/saved-evidence surface uses [`PartTwoIngredients`](../src/components/check/part-two/PartTwoIngredients.tsx). Original permitted source text and existing identity/save actions remain usable. Ingredient rows open compact inline details with quantity/modality/source attribution. Missing enrichment stays explicit. The client discards mismatched owner/target/generation/evidence revision/request tickets and regressed revisions, and clears expired material. Invalidated open detail content is withdrawn while its close shell remains reachable. This adds no analysis screen or mandatory completion confirmation. Printed Active/Inactive transitions use both section identity and kind for headings; mounted real-view tests retain source order, may-contain resets and separate physical sections.

The initial known-public-product private-capture failure is now diagnosed and repaired within the authorized integration boundary: the production snapshot stores its ItemSnapshot at the payload root, while the capture-review context read only a fixture-style `fullItem`. An additive strict root projection now supplies exact identity/revision/rights fields to the shared authoritative runtime; it preserves nested private ItemSnapshots and rejects malformed roots. The diagnostic records known root failing, unknown root succeeding, and explicit nested fixture succeeding before repair. The final runtime checks cover known-public capture, save/reopen, deletion and independent public-fact survival.

Independent repair review additionally found a candidate-caused Auth deletion deadlock: user-row deletion held Auth rows while Part 2 precomputation held scan/current rows and requested an Auth FK lock. The additive lifecycle repair acquires canonical global locks `40203 → 40204`, then the owner lock and rows, including Auth BEFORE DELETE STATEMENT and the Part 1 owner helper. Original Part 1 migration bytes and auth/profile checks remain unchanged. Actual Auth deletion/publication, worker/cleanup and same-owner overlaps pass with observed PostgreSQL waits. Exact Part1 baseline Auth deletion without predeleting saves passes. Historical candidate failures and baseline orchestration recovery are retained in the immutable evidence.

Physical OCR/image recognition and general real-photo whole-list completeness are not established by these synthetic tests. Part 1's unsupported optical/completeness paths and remaining physical release gates remain unchanged.

## Executed local evidence and release gates

The core suite with the one-card pack passes **59 test groups / 1,250 generated cases**, plus **100 generated controller race sequences**. Additional review regressions cover newline OR alternatives, wrapped locants, bare ± scopes and reset, blend/group quantity subjects, structured alternatives, disputed spans and lossless syntax limits. Parser `bounded-lossless-v3` and fact policy `attributed-positive-facts-v7` identify the repaired interpretation; the finite dictionary/reference content hash remains unchanged.

The final v7 application suite passes **1,321 tests / 138 file groups**, both TypeScript checks report zero errors, and web/iOS JavaScript exports build cleanly. Clean replay passes **1,042 database assertions / 35 files**. Actual deployed-local authority/Auth races pass **83 checks**, including 12 adversarial response containers, full current/saved byte-safe field withdrawal and customer/forged-owner resolver denial. Actual reviewed private production-handler/Auth/SQL/Storage/P2Edge acceptance passes **107 checks**; public **22** and current/saved recall/rollback **35** pass. Native public/private/Close each execute one passing test, including both Close-position checks. The accepted-private optical oracle remains explicitly synthetic; deployed generic capture remains partial.

Historical v1 evidence includes account erasure/public survival33, unknown29 and known-public29 capture-removal, the exact Part1 baseline10 and prior native/performance receipts. Those are retained with their source revision and are not fresh v7 checks. The v2 report distinguishes final successful native receipts from a development-link setup failure and a test-ordering failure caused by concurrently recalling the synthetic explanation; sequential fresh-fixture native reruns pass. Physical/hosted gates stay explicit.

The mounted production Check and saved sheets now render one primary normalized list; exact original wording is a disclosure. Pending/unsupported states retain only authorized literal fallback. A 15-second poll joins a slow in-flight request; a bounded deadline releases it, and late responses cannot publish across owners/targets/revisions. Forty-row native/component cases place the explanation immediately after the tapped row. Preferred names retain “Listed as” wording; amount copy is readable, source/licence is secondary, and withdrawal removes sensitive text/URLs while keeping numeric open-detail geometry. Current refusal overrides stale accepted summary. Exact source-evidence denial additionally hides retained private history/photos/corrections; dictionary-only failure keeps independently permitted Part 1 originals. Saved private recovery/removal actions remain reachable.

Exact-head hosted CI, physical camera/phone/offline/large-text/VoiceOver/TalkBack acceptance, Android and a rights-reviewed held-out market/formula-family corpus remain unrun release gates. No push or merge was performed.

## Proposed criteria mapped to current evidence

“Core executed” refers to the final 59-test/1,250-case suite. “Runtime/controller fixture” identifies synthetic inputs through actual local Auth/SQL/Edge/Storage and production controllers; it does not establish physical optical truth. Each criterion has narrower evidence than broad market, optical or hosted acceptance.

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
| A15 | Core executed unknown/empty/no-negative boundaries and typed no_declaration. All five admitted fact kinds are wired: ingredient presence/reference role plus exact service-admitted claim/usage/context. Field-specific default-deny grants, full retained-source hash, exact spans, owner and source ancestry are enforced. “Label says” is attribution only; no absence or benefit inference. |
| A16 | Core executed collision/hash/release validation plus independent card/source-policy dependency withdrawals preserving identities. Production split/recall impact review remains pending. |
| A17 | Core executed version-scoped cache keys; SQL fixture tests increasing revision on release changes. Final 1,042-assertion DB replay and runtime release revision checks passed. |
| A18 | Evidence/revision/market separation enforced by keys/contracts; same-GTIN market/formula replacement end-to-end corpus not fully executed. |
| A19 | Actual SQL/Edge tests cover retraction, current blocking, late publication and copied private payload purge, plus open-detail component withdrawal. V7 selective label-field withdrawal checks entire current/saved JSON for usage-byte absence while independent claim and ingredients survive. |
| A20 | Controller fixtures cover every pending/terminal binding and account mismatch; generated monotonic work states, late errors and CAS stale publication fixtures. Final private deletion/publication-failure re-resolution passed through actual DB/Edge and production controller. |
| A21 | SQL/runtime fixtures cover foreign-owner cache access; source/cache keys include owner. Actual identical-private-text A/B isolation passed; broad population/privacy acceptance remains open. |
| A22 | Core executed durable-tombstone cache semantics, rollback non-resurrection and monotonic immutable saved projections. Legacy full-label roots are verified server-side then replaced by greater-revision immutable projections. Saved links are repointed, permitted lineage/minimal metadata is retained, and unsafe old payload rows are purged; stable replay and greater revision are tested even with unchanged grant counts. SQL/controller fixtures cover stale work and equal replay. Actual current/saved recall, rollback suppression, SQL bypass rejection and deterministic saved-read overlap passed. |
| A23 | No public/private evidence union; separate dependencies. Actual independent public Water/Glycerin fact IDs, snapshot and revision survive unrelated private-proof deletion; private original/derived copies and bytes purge. Known public payload-root and account-erasure variants use only synthetic owner records and leave unrelated public facts independently authorized. The private-fixture enablement is temporary and restored on cleanup. |
| A24 | Controller/UI fixtures clear expired memory material; finite inherited deadlines enforced. No new durable offline cache approved; physical offline/reconnect acceptance pending. |
| A25 | Core executed foreign/malformed binding, source/span/subject/raw/quantity rejection; service-only full-context resolver/publication and trusted Auth owner routing. Strict projected assertions contain no full source text or raw conditional prose; nested response metadata and ready-only fields reject publication attacks. Final DB/Edge least-privilege and forged-payload rejection passed. |
| A26 | Core executed bytes/sections/occurrences/depth limits, malformed syntax and inert markup; request-body bounds/UI control rendering fixtures. Actual 513th-ancestor overflow returns typed parse_limit without text; valid 500-ancestor and deduplicated cyclic/diamond graphs are exercised. Unbounded deployment/load stress remains unrun. |
| A27 | Core executed astral/combining/bidi/control/surrogate cases, duplicate occurrences and deterministic original UTF16 slices; Pinned generated Unicode/name/quantity/modality cases. Whole-panel optical alignment unproved. |
| A28 | Actual local reopen reuses/pins authorized snapshots; both native synthetic flows retain source text and actions. Physical interaction/latency acceptance pending. |
| A29 | Controller save fixture sends exact Part 1/Part 2 CAS and rejects stale save. Part 1 correction/alternative-list lineage reused; Actual private correction, explicit source-only/bound pins, reopen and stale-save rejection passed; full physical correction/selection acceptance remains open. |
| A30 | Actual component tests and native synthetic flows cover named rows, close controls, scroll/expand, expiry/invalidation shell and visible limits. Physical large text, VoiceOver/TalkBack/focus/scroll unrun. |
| A31 | Core executed one original Glycerin card with separate source rights metadata; missing, withdrawn, expired, revoked and permission-disabled card cases retain identity evidence; independent card/entry/definition/licence tombstones remove current or saved cards without identity loss. No nearby/model filler; no production corpus enabled; Printed claim/usage/context is included only under explicit source-qualified grants; missing usage stays unknown. |
| A32 | Core executed stable IDs and preserved qualifier/quantity/scope limitations. Jev/profile Part 3 consumer integration is excluded. |

## Measurement and quality limits

Historical v6 warm in-memory CPU measurements on Apple M2 Pro/Node22.23.0/macOS arm64, concurrency one, 50 timed runs after warmup under concurrent local validation load: 100 entries p50/p95/p99 **5.817/10.400/12.821 ms**; 1,000 entries **53.665/87.208/113.974 ms**. Observed process maximum RSS **212,729,856 bytes** includes the harness and is not isolated incremental parser memory. These include schemas/hash/freezing and exclude authorization, persistence, network, OCR and UI. Earlier measurements are retained, with their exact release and protocol; none establishes server/cache or phone latency targets.

The original engineering-adjudicated corpus contains **30 cases / 37 occurrences**, including six reserved synthetic formulation families: 28 resolved, nine unknown, zero ambiguous/incorrect/false merges/span/modality/unsupported-fact failures in this finite set. Mapping precision is **100% of resolved occurrences**, resolution coverage **75.68%**, unknown rate **24.32%**. Twenty identities resolved across 30 observed names. One explanation identity covers two occurrences: **5.41% overall**, **7.14% of resolved occurrences**. Corpus SHA256 `a72c2dcc5683f720bfcb50c165557d82dbfe6b7c6d63cb1ef27a4335b536efa0`. No population/market/optical accuracy is implied.

Mapping and explanation coverage remain distinct: the dictionary contains 20 finite identities/23 aliases and one rights-qualified original card. Passing synthetic cases do not give population precision, market resolution coverage, unknown/error rates or real-photo completeness. A separately adjudicated corpus with formula-family holdouts is still required. Critical failures discovered by review were repaired in the regression set; do not turn “no known failures in this bounded set” into a general zero-error claim.

## Immutable final evidence

The immutable review bundle pins final head/base/branch, byte-exact source and binary diffs from Part 1 and the reviewed v0 candidate, complete application/DB/Edge/native receipts, all 32 criteria and unrun gates, release/source-rights hashes, benchmarks, recovery failures and independent review. It preserves prior v0 evidence as historical evidence, without treating its receipts as final-source acceptance. The confirmed Library report/bundle IDs, versions and hashes are returned after validation and writeback. The compound release is `part-two:cfaa79a4532f6554f681996816fa1999c0018d403e8474cf5b2506a3eab221b3`.
