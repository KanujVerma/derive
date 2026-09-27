# P0-B execution and acceptance packet

## Final status

**P0-B PARTIAL, BLOCKERS REMAIN**

The publication continuation explicitly authorized reviewed public source pushes. B1, B2 and B4 are now published as focused PRs #91, #92 and #90 respectively; all three exact heads passed Verify & Build and Database & Integration. Required Sami stewardship requests are confirmed, but no reviews have been submitted. No P0-B PR has merged. Later public waves are held by the requested current-main dependency order, not by an implementation wait.

The new compactness gate exposed excessive expanded rows. Original B5 was corrected locally at `31712a2d49bdec92dbef05634ca5f13e8196f43a`; independent component SSR confirms bounded semantic/evidence pages, one immediate secondary cue, explicit further-caution review and visible critical warnings. All raw findings and provenance remain retained. The updated combined LOCAL validation bundle is `651cf3a0d8b3ff1d66f4366ce3a98b31cd0079fc`; it is not a public feature PR.

## Repository baseline

- Starting main: `45f1773e4983c3c28848839c65640b7681b89d8e`.
- Ending verified origin/main: `105b3a3c41132287e7b4df1331eefe72111e58d4`.
- P0-A advanced main during this pass. PR #87 supplied its contract; PR #89 supplied immutable snapshot production/storage. PR #89 head `fac8ebad36e56aad57d24a8dc5d88697cc7461c5` passed both exact-head jobs in [36284190028](https://github.com/KanujVerma/derive/actions/runs/36284190028).
- Original shared checkout remains at `773a4b8` with unrelated dirty web work. Its `.gitignore`, `CONTEXT_SYNC.md`, package/TypeScript files, apps, design script, web test and hidden tooling directories are preserved and excluded.
- The final integrated local customer bundle is `585208495becb6d66afc7f67380a3c6daf65d3d4`, with current main as an ancestor. It is a local validation bundle, not a proposed combined PR.

## Execution DAG

```text
B1 contracts/fixtures ──→ B3 findings/policy/gold ──┐
           └───────────→ B5 renderer ──────────────┤
B2 context/history/migrations ────────────────────┼→ B6 service/provenance
B4 progressive editors ──────────────────────────┘          ↓
                                      B7 Check/editor/My Stuff composition
                                                           ↓
                                      local API + SDK + customer-model acceptance
                                                           ↓
                                      publication / CI / stewardship / physical gates
```

B1, B2 and B4 began concurrently. B3 and B5 consumed the frozen local contract while context/editor work continued. B6 and B7 had disjoint service/customer write-sets. No feature waited for unfinished P0-A; fixtures supported independent work until its runtime arrived. Root owned CI registration, final docs and the narrow sequential B2 storage-budget amendment. Shared contracts, migrations and customer roots never had concurrent writers.

## Agent execution and frozen heads

All rows remain unmerged. B1/B2/B4 publication and exact-head CI are recorded below; later waves remain private until their prerequisites merge.

| Issue / workstream | Agent / branch | Frozen head | Own write-set |
| --- | --- | --- | --- |
| [#75](https://github.com/KanujVerma/derive/issues/75) B1 contracts | Sol contracts agent; `kanuj/p0b-contracts` | `65f0e7ae57798c98abd8eccbaf11d94897eef575` | PersonalDecision contract; personal-decision fixtures; contracts test; P0_B_DECISION doc |
| [#76](https://github.com/KanujVerma/derive/issues/76) B2 context | Sol context agent, then root budget amendment; `kanuj/p0b-context-history` | `36084f0c7c12f13455da56bfc58a0af46e5e54f8` | PersonalContext contract/remote client; personal-context Edge/parser; three additive migrations; context/budget pgTAP; context smoke/test/doc; only its JWT-enabled config stanza |
| [#78](https://github.com/KanujVerma/derive/issues/78) B3 policy/gold | Sol engine agent; `kanuj/p0b-findings-policy` | `511aa72a891023a0e59c0f652191403bcdae71be` | domain personal-decision evaluator; policy fixtures/test/doc |
| [#77](https://github.com/KanujVerma/derive/issues/77) B4 editors | Sol personalization agent; `kanuj/p0b-personalization` | `c5fa9d7a5236220125e8c99c1836995c98b827a8` | p0b-personalization components/models/fixtures; six focused test scripts |
| [#79](https://github.com/KanujVerma/derive/issues/79) B5 renderer | Sol contracts agent after B1; `kanuj/p0b-result-experience` | `31712a2d49bdec92dbef05634ca5f13e8196f43a` | PersonalDecisionPanel; strict parser/templates; renderer/capacity tests |
| [#80](https://github.com/KanujVerma/derive/issues/80) B6 service | Sol engine agent after B3; `kanuj/p0b-compose` | `cdf0b3e795906213fcb97ed1896931240502ae45` | PersonalDecisionService DTO/remote client; pure truth/context adapters; personal-decision Edge; decision config stanza; service smoke/test; root's two CI registrations |
| [#88](https://github.com/KanujVerma/derive/issues/88) B7 customer | Sol personalization agent after B4; `kanuj/p0b-customer-compose` | `585208495becb6d66afc7f67380a3c6daf65d3d4` | CheckProductScreen; existing personalize route/dev fixture; My Stuff/root layout; controller/gateway/storage adapter; seven customer test scripts; narrow MyStuffContent props |

Worktrees: B1/B3/B4/B5 live under `/private/tmp/derive-p0b-*`. B2/B6/B7 and root docs live under the task workspace's `derive-p0b-*` directories. A Luna mechanical agent audited overlap, secrets, telemetry, copy and touch targets. Independent Sol reviews exercised engine-to-renderer and SDK ownership/JIT behavior.

For later focused publication, B6's own commits are `90decd9`, `7b5bc32`, `cdf0b3e`; B7's own commits are `35f8824`, `5852084`. Dependency commits stay separate and must be reconciled onto actually merged main. Never publish either dependency bundle as one giant feature PR.

## Implemented architecture and persistence

### Personal context

Optional profile captures decision intent, explicit primary and secondary goals, behavior/reactivity, relevant treatments/sensitivities and distinct pregnancy/trying/nursing statuses. Unanswered, unsure, withheld and explicit none remain distinct. Known answers remain editable; new sensitive collection requires relevant, supported formula/rule evidence.

Routine items retain stable IDs, canonical product/variant/formula references when known or provisional manual identity; current/paused/stopped/occasional; timing, qualitative or reported exact frequency, dates/duration and explicit completeness. No legacy schedule is invented.

Experience records preserve self-reported outcome, occurrence/use context and immutable correction links. No reaction reported is separate from tolerated. Name selection keeps product identity but leaves historical variant/formula unknown; one unambiguous exact package can be explicitly confirmed. Existing known references remain stable. Reactions never establish ingredient causation.

The service-only journal has an owner aggregate revision and immutable section revisions. Writes use stable request IDs/base revision; corrected history is paged at a fixed revision after supersession. Raw tables/RPCs deny public/anon/authenticated access, and identity deletion cascades. Legacy observations remain tagged and are not fabricated into canonical exposure records.

### Findings, policy and renderer

Engine `p0b-findings/5`, policy `p0b-policy/3`, projection `p0b-product-evaluation/v1`, packet `personal-decision/v1`.

All distinct material conclusions survive. Repeated semantically equivalent history reports consolidate by scope, outcome and current/old/unknown formula relationship; raw history is retained. Equivalent evidence needs share links without losing findings. Caution precedence is deterministic. Unsupported primary goals, incomplete/unknown context and missing critical evidence cannot become stronger positive actions. Old tolerance does not establish current-formula tolerance; unrelated history cannot change an action.

The renderer uses fixed evidence-bound templates and independently verified binding. It preserves the action, visible material cautions/blockers, routine impact, uncertainty and next step. No raw provider/notes prose, score, diagnosis, prescription modification, concentration invention, demographic inference or commerce ranking enters the policy.

### Truth and assessment provenance

P0-A owns ProductTruthSnapshotV1 and its parser/store. P0-B reads an existing snapshot by authenticated owner, scan case and ID; it never seals, reconstructs or accepts client/model truth. Category is separate accepted catalog evidence, hashed with its source/content and frozen privately in assessment input; it is not promoted into the snapshot. Source-only changes produce a new category boundary, while exact old request replay preserves its original evidence.

The request contains only operation/request ID/case ID/snapshot ID. Case ownership is checked before readers/replay. Assessment persistence binds owner, snapshot/source boundaries and exact profile/routine/history references, with a locked aggregate-revision guard. New assessment on changed context fails; exact retry returns the immutable earlier packet. Reassessment uses a new request ID.

Packet ID is the request UUID; assessment ID is a different database-generated UUID. Customer code verifies them independently and matches the original immutable product envelope. Check facts use that snapshot even if current catalog detail changes or fails.

Requests pin the captured owner session's Authorization. Actual SDK testing reproduced the old A-body/B-token race and verified the corrected request remains A or aborts. Root auth/access subscriptions clear P0-B memory without feature screens mounted and fence late load/save/label callbacks. The new compact disclosure pages replace prior rows; they do not accumulate hundreds of mounted findings.

## Concrete customer behavior verified locally

| Scenario | Observed evidence |
| --- | --- |
| No personalization | Factual snapshot remains available; personal action abstains |
| Basic personalization / same result | Canonical profile save and reassessment change the supported role result |
| Routine-aware redundancy | KEEP_CURRENT with source-bound role/use evidence |
| Active overlap | Retained beside sensitivity, reactivity, reaction and formula-change findings |
| Prior reaction | Corrected relevant report older than 50 unrelated recent events still influences the result |
| Partial routine | Critical uncertainty retained; absent item is not interpreted as no use |
| Missing formula / conflict | Unsupported positive action blocked; known relevant reaction remains |
| Unknown reproductive context | Actual Edge emits formula-bound, uncertain scoped JIT evidence, including trying-only unknown |
| Known trying status needing scientific review | NOT_ENOUGH_INFORMATION with product-facts next step; more answers are not presented as scientific support |
| Reformulation / historical identity | Current/old/unknown classes stay separate; past name choice never assigns today's formula |
| Owner switch | Actual SDK principal binding, global purge and late-callback fences pass |
| My Stuff | Canonical primary/secondary goals and bounded report summary; separate S3 saved products/history/other reports |
| Result comprehension | Template/SSR and limited Simulator rendering; human/physical acceptance remains unverified |

## Validation

- Starting baseline: 460 registered tests.
- Final integrated local `npm test`: **59 discovered files, exit 0**; **559 registered TAP cases, 51 named policy scenarios, 22 service scenarios and 13 further assertion scripts**, zero observed failures. Finite reaction/evidence-removal matrices also pass. Root reran this on frozen `5852084`.
- App TypeScript and test TypeScript: exit 0; root independently reran on final customer head.
- Web and iOS JS exports: pass on final customer bundle; no native signing/build/physical claim.
- Fresh current-main migration replay: pass, including all three P0-B migrations.
- Full pgTAP: **21 files / 524 assertions**, pass.
- Actual local Auth/resolver/Edge/context/engine/persistence smoke on final `cdf0b3e`: pass, fixture reader disabled. Catalog rows are explicit synthetic test seeds, not live coverage.
- Large real persisted result: **257 findings / 150 impacts; 454,176 UTF8 packet bytes**. Unicode evaluated input: **326,527 bytes**, all 300 ordered ingredients preserved.
- Independent maximum engine fixture: **471 findings / 150 impacts / 471 action refs / 300 linked need refs**; PostgreSQL packet bytes **649,695**. Captured maximum-formula evaluated input bytes **291,857**. Renderer permits 512 findings/refs, 200 impacts and a 1 MiB transport cap. Storage uses finite 1 MiB packet / 512 KiB input PostgreSQL byte caps; nine budget regressions cover Unicode, type, immutability, privileges and deletion.
- Independent engine/renderer recheck: 12 checks pass; repeated-history cap regression repaired without dropping raw reports.
- Independent SDK ownership/JIT review: no material findings; focused tests and separate actual-SDK harness pass. No physical/React-mount proof implied.
- Final combined diff: 70 scoped files, no existing P0-A implementation edits; source/config/root exceptions assigned explicitly. Diff checks pass; concrete credential-pattern audit found zero matches. No sensitive analytics/replay additions; controls use 44-point minimum/shared primitives.
- P0-B exact-head GitHub CI: B1/B2/B4 **SUCCESS, both jobs** at the exact heads below; later waves NOT RUN because publication awaits prerequisite reviews/merges.

## Physical/customer acceptance

XcodeBuildMCP/Expo Go bundled and displayed a redundancy fixture in Simulator. A native Open-in-Derive prompt obstructed interaction and some content. The physical phone was not successfully exercised; the latest CoreDevice listing timed out. No camera hardware, interaction speed or human comprehension acceptance is claimed. No EAS/TestFlight build, External Beta Review, hosted mutation, provider adoption or new package dependency was added.

## P0-A handoff

The contract and actual snapshot producer/reader dependency is resolved locally. P0-A code is unchanged by P0-B. Category remains a separate accepted assertion with frozen provenance. P0-A's extraction/real-image and physical gates remain its own work; hosted activation remains outside P0-B.

## Documentation and source of truth

Root's isolated `kanuj/p0b-docs` prepares updates to ARCHITECTURE, INTERFACES, DECISIONS, ROADMAP, OWNERSHIP and CONTEXT_SYNC plus this execution packet. Leaf docs describe decision/context/policy semantics. These docs are local, unpublished; they do not falsely mark code merged or hosted. [Parent #74](https://github.com/KanujVerma/derive/issues/74) is the authorized live issue ledger. Required source/CI/review evidence must replace this local checkpoint before any eventual docs merge.

## Remaining blockers and next authorized steps

1. Required stewardship review on the published foundation/editor/context PRs; requests are pending with no submitted review.
2. Merge prerequisites after review, then reconcile/publish B3/B5/B6/B7 own commits on actual merged main and require exact-head CI. B6 imports B5’s strict parser, so B5 is an additional actual source prerequisite.
3. Sami stewardship review for material context/migration/RLS/service-role/source/scientific boundaries, including ownership transport. This review has not been obtained.
4. Physical/customer acceptance with a usable device/runtime and interaction tools.

Independent P0-B implementation did not wait for Sami. No hosted rollout, free guest operations, OCR/provider choice, billing or release build is authorized by this packet.


## Publication continuation: exact current PR gates

Starting and ending shared main for this continuation: `105b3a3c41132287e7b4df1331eefe72111e58d4`. No merge performed while required reviews are absent.

| Workstream | PR / exact head | Files / validation | Exact-head CI | Stewardship / merge |
| --- | --- | --- | --- | --- |
| B4 / #77 | [#90](https://github.com/KanujVerma/derive/pull/90), `c5fa9d7a5236220125e8c99c1836995c98b827a8` | 15 own files; six focused assertion scripts; full unit, both TS, web/iOS, scope/secret/diff pass | [36315658000](https://github.com/KanujVerma/derive/actions/runs/36315658000), both success | Sami requested, no review; unmerged |
| B1 / #75 | [#91](https://github.com/KanujVerma/derive/pull/91), `65f0e7ae57798c98abd8eccbaf11d94897eef575` | 4 own files; 18 focused/530 full registered tests; both TS/web/iOS/scope/secret/diff pass | [36315663590](https://github.com/KanujVerma/derive/actions/runs/36315663590), both success | Sami requested, no review; unmerged |
| B2 / #76 | [#92](https://github.com/KanujVerma/derive/pull/92), `36084f0c7c12f13455da56bfc58a0af46e5e54f8` | 14 own files; 521 registered tests, both TS/web/iOS; fresh local reset, pgTAP21/524, authenticated context/RLS/correction/deletion smoke pass | [36316218680](https://github.com/KanujVerma/derive/actions/runs/36316218680), both success | Sami requested, no review; unmerged |
| B3 / #78 | Frozen `511aa72`; no PR until B1 merges | Existing own four commits, no redesign | Not published | Source prerequisite / scientific stewardship |
| B5 / #79 | Corrective `31712a2`; no PR until B1 merges | 505 registered tests; four compactness tests, both TS/web/iOS/diff/secret; independent SSR pass | Not published | Source prerequisite / relevant review |
| B6 / #80 | Frozen `cdf0b3e`; no PR until B1/B2/B3/B5 merge | Own commits90decd9/7b5bc32/cdf0b3e; actual P0-A snapshot remains consumed | Not published | Required platform/truth stewardship |
| B7 / #88 | Own commits35f8824/5852084; no PR until B4/B5/B6 merge | Updated local bundle651cf3a:60 unit files/563 registered cases; TS/web/iOS, owner/JIT/MyStuff/Check regressions pass | Not published | Final review / physical gate open |

Local Docker initially failed because a forced registry caused new image pulls through a missing Desktop credential helper. Using the installed CLI’s default cached image tags restored startup without editing global credential configuration. Fresh B2 tests passed. Local advisors report zero security issues and one existing duplicate-index performance warning on public.routines, outside B2 scope; no unrelated schema fix made.

All raw471 finding/source objects remain byte-identical through compactness presentation. Actual SSR defaults15 text nodes; explanation pages10/10/9 structured groups with lazy evidence, no append growth. Default1secondary cue plus explicit7-caution review in3/3/1 pages; all4critical unknowns and a synthetic known blocker remain immediate. No analytics/raw packet data added. This is component/SSR evidence, not physical rendering.
