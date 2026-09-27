# P0-B publication and merge execution packet

## Status

**P0-B COMPLETE, PHYSICAL ACCEPTANCE PENDING.** All seven source workstreams are merged. This docs checkpoint records immutable source main `7775a426ee4adb7741291d475798a9d162d9d392`; documentation PR/merge and resulting main are reported in GitHub metadata and the final issue ledger, avoiding a predicted self-referential SHA.

Publication starting main: `105b3a3c41132287e7b4df1331eefe72111e58d4`. Earlier implementation recovered `45f1773e4983c3c28848839c65640b7681b89d8e`. Original dirty checkout at773a is preserved; no reset, stash or fast-forward.

## PR landing sequence

| Track / issue | Branch / exact head | PR / merge SHA | Exact-head CI |
| --- | --- | --- | --- |
| B1 / #75 | `kanuj/p0b-contracts` / `65f0e7ae57798c98abd8eccbaf11d94897eef575` | [#91](https://github.com/KanujVerma/derive/pull/91) / `7ed5a9f1c7d2038cb6818e3901af5a377a52a703` | [36315663590](https://github.com/KanujVerma/derive/actions/runs/36315663590), both jobs SUCCESS |
| B4 / #77 | `kanuj/p0b-personalization` / `46077f74b1ca9bdbad6f63c50366fd924524d4b1` | [#90](https://github.com/KanujVerma/derive/pull/90) / `6a7645613fda0e642a7da312e1aa1da0e13d2343` | [36321124552](https://github.com/KanujVerma/derive/actions/runs/36321124552), both jobs SUCCESS |
| B2 / #76 | `kanuj/p0b-context-history` / `48ec2806957966c508d5831ae39350c9783196d5` | [#92](https://github.com/KanujVerma/derive/pull/92) / `853ceacf711b400632e6d280d85bfb4cc7cf6682` | [36321573300](https://github.com/KanujVerma/derive/actions/runs/36321573300), both jobs SUCCESS |
| B5 / #79 | `kanuj/p0b-result-experience` / `342e2825ee128e806a4b10cf9e9be32facf7fb8e` | [#93](https://github.com/KanujVerma/derive/pull/93) / `f762755cd24d07bc6e20b7faf341d0ffdd83bde0` | [36321930933](https://github.com/KanujVerma/derive/actions/runs/36321930933), both jobs SUCCESS |
| B3 / #78 | `kanuj/p0b-findings-policy` / `a72917c18ccf3228e952c53ccd53e74b0a738b83` | [#94](https://github.com/KanujVerma/derive/pull/94) / `6901cbdb393306fb02f0a9be35ce71f8bc7127b8` | [36322440032](https://github.com/KanujVerma/derive/actions/runs/36322440032), both jobs SUCCESS |
| B6 / #80 | `kanuj/p0b-compose` / `3be208cef50c8a0871515687cfae0e78472d4750` | [#96](https://github.com/KanujVerma/derive/pull/96) / `86c9e03985c299a407e3f041fcad83afd0fee90a` | [36323096535](https://github.com/KanujVerma/derive/actions/runs/36323096535), both jobs SUCCESS |
| B7 / #88 | `kanuj/p0b-customer-compose` / `d9c6995812c592aff24b2f01d71d002ee75791c2` | [#97](https://github.com/KanujVerma/derive/pull/97) / `7775a426ee4adb7741291d475798a9d162d9d392` | [36323815039](https://github.com/KanujVerma/derive/actions/runs/36323815039), both jobs SUCCESS |

Final source-main CI [36324191293](https://github.com/KanujVerma/derive/actions/runs/36324191293) passed both jobs at 7775a42. All merges were normal, with exact head matching and no admin bypass. After each main advancement every remaining P0-B PR was reconciled and reran required local and exact-head CI gates. B6/B7 published only own commits after dependencies actually merged; no combined validation bundle was published.

SamiAhmadBeg was requested/notified on every source PR. Review is advisory unless branch protection or a concrete unresolved invariant finding requires a hold. Kanuj is DRI and merge owner. Verified protection requires Verify & Build and no mandatory human approval; this pass additionally required Database & Integration. Static CODEOWNERS is unchanged.

## Orchestration and isolated ownership

Existing independent agents were reused: contracts owned B1/B5 and final B6 correction/extraction; engine owned B3/initial B6 and independent reviews; personalization owned B4/B7. Root owned final B2 publication/database lease, serial merges, issues and the sole canonical-docs write-set. Handoffs were sequential, with one active writer per shared surface.

B1/B3/B4/B5 worktrees: `/private/tmp/derive-p0b-*`. B2/B6/B7/docs: isolated `derive-p0b-*` worktrees under the task workspace. Frozen backups and validation bundles remain local. New server/contracts are P0-B-owned under end-to-end DRI policy; existing P0-A producer/validation was imported, not modified. Shared config stanzas were edited sequentially; B6 adds exactly two CI harness registrations.

## Validation by focused PR

- **B1 / #91:** 18 focused / 530 registered; TS/web/iOS/diff/scope/secrets PASS. 4 own files; exact base `105b3a3c41132287e7b4df1331eefe72111e58d4`.
- **B4 / #90:** six focused scripts / full unit; TS/web/iOS/diff/scope/secrets PASS. 15 own files; exact base `7ed5a9f1c7d2038cb6818e3901af5a377a52a703`.
- **B2 / #92:** 539 registered / 42 TAP files; TS/web/iOS/diff/scope/secret; fresh reset + 524 DB + authenticated context smoke PASS. 14 own files; exact base `6a7645613fda0e642a7da312e1aa1da0e13d2343`.
- **B5 / #93:** 563 registered / 51 unit files; 24 focused; compact SSR / TS / web+iOS / scope+secret+diff PASS. 7 own files; exact base `853ceacf711b400632e6d280d85bfb4cc7cf6682`.
- **B3 / #94:** 52 unit files / 51 focused gold + finite reaction/evidence matrices; TS / web+iOS / scope+secret+diff PASS. 4 own files; exact base `f762755cd24d07bc6e20b7faf341d0ffdd83bde0`.
- **B6 / #96:** 54 unit files / 566 registered + 22 service + 3 routine; TS/web/iOS/audits; fresh reset + 524 DB + context+authoritative decision Edge incl category withdrawal/capacity/Unicode/owner/replay/deletion PASS. 14 own files; exact base `6901cbdb393306fb02f0a9be35ce71f8bc7127b8`.
- **B7 / #97:** 62 unit files / 566 registered + 8 focused customer scripts; TS/web/iOS/ownership/copy/touch/secret/diff PASS; actual SDK principal-switch and root A-B-A purge regressions PASS. 18 own files; exact base `86c9e03985c299a407e3f041fcad83afd0fee90a`.

Final full suite: **62 unit files and 566 registered TAP cases**, plus assertion-style suites including 51 policy scenarios, 22 service cases and customer regressions. All passed, with both app/test TypeScript checks, web/iOS JS exports, diff, ownership, concrete secret patterns, copy and touch-target checks. Backend CI ran fresh reset, full pgTAP and prior integration harnesses plus both P0-B harnesses. JS exports are not native hardware acceptance.

## Actual database / ownership proof

Root reran B6 exact 3be208c against disposable local Supabase: fresh reset, **21 pgTAP files / 524 assertions**, authenticated context smoke and authoritative decision smoke all passed. Actual P0-A resolver-produced stored snapshots were consumed with fixture opt-in disabled. No hosted account, model or H1P was required.

- Immutable profile/routine/experience revisions retain unknown/withheld, manual references, qualitative frequency and exact historical product/variant/formula. Effective corrections resolve before product filtering/paging; older than 50 relevant reactions survive. Clients cannot access raw tables/RPCs; owner comes from verified Auth.
- Stable retries return immutable assessments after context/source edits; new stale assessments fail closed. Owner/section links cannot cross users. Identity deletion cascades private context, assessments, snapshots and cases.
- Category verification withdrawal from 50 already-committed routine products retained 100 supported overlap impacts using independently verified formula. Category/role stay unknown; redundancy is not fabricated. Formula-only private provenance is frozen and replay stays immutable after restoration.
- Capacity persisted 257 findings / 150 impacts in 454176 UTF-8 JSON bytes. Unicode input 326527 bytes retained all 300 ordered ingredients. PostgreSQL separately enforces actual text byte limits.
- Independent cleanup readback: auth users, context heads/revisions, assessments, snapshots, cases and all fixture products **0**. Temporary service servers stopped; final handoff records stack shutdown with volumes preserved.

## P0-A compatibility / product behavior

`ProductTruthSnapshotV1` from merged #87/#89 is authoritative. P0-B never seals, reconstructs, mutates or redefines it. Provider/candidate/user text is not product/formula authority. Category is a separate accepted assertion with a digest/frozen private provenance. Routine formula evidence is independent of category. Product, Variant and FormulaVersion remain separate. No unresolved P0-A interface dependency remains for this deterministic baseline. P0-A image extraction/physical readiness and P0-C hosted activation are separate.

| Scenario | Merged behavior |
| --- | --- |
| No / partial profile | Facts remain useful; no unsupported positive fit; optional context |
| Supported dry-skin moisturizer role | Narrow supported action only with known critical context/truth |
| Existing sourced role | Keep-current / replacement relation without efficacy or tolerance ranking |
| Multiple cautions | Deterministic precedence retains all material findings and needs |
| Verified routine formula, unknown category | Supported overlap retained; no invented category or role |
| Prior reaction / reformulation | Self-report stays a report; old/unknown formula does not prove current tolerance |
| Missing formula / unsupported goal | Unknown stays unknown; more intake is not offered as missing science |
| Sensitive context | Optional scoped JIT; known answers editable; no demographic inference |
| Catalog drift / outage | Immutable facts retained; stale personal result hidden until current owner/context ready |
| Owner switch / logout / A-B-A | Captured principal or abort; global purge and late-response fences cover retained S2 too |
| My Stuff | Canonical goals/routine/reports distinct from legacy saved products/checks/reports |

No universal score, diagnosis, prescription modification, concentration invention, commerce-influenced ranking or new scientific validation. Rules are bounded ports of reviewed S2 meanings; a general scientific-claim platform remains a target. No sensitive analytics/session replay, provider adoption, package dependency, hosted production mutation or billing change was added.

## Independent findings resolved

1. B5 disclosure mounted hundreds of rows. Structured grouping/paging now retains all 471 raw findings/source objects in 29 semantic scopes, with maximum 10 groups /10 records per expanded group. Default 15 text nodes, one secondary cue, explicit further-caution pages of 3, all critical warnings immediate. Actual component SSR passed; no physical comprehension claim.
2. B6 category provenance gated formula lookup. Three focused regressions and actual Edge/database category-withdrawal proof pass after independent lookup correction.
3. B7 retained legacy save/fit used mutable SDK principal. Existing optional FunctionClient seams now pin captured ownership. Actual Supabase SDK with synthetic transport proves normal requests, A-body/B-token race prevention, logout abort, no-screen status purge and late A-B-A rejection. No shared Auth/RLS contract change.

No concrete unresolved source invariant finding remains after these corrections and exact-head gates.

## Physical / customer acceptance

The initial preflight was blocked by the OS Open-in-Derive prompt and an offline iPhone. After the user cleared the prompt, the merged `d9c6995` source loaded in Expo Go on the booted iPhone 17 Pro / iOS26.5 Simulator. Task-local Metro used localhost8129 with dotenv/remote service disabled; all screens were explicitly DEVELOPMENT FIXTURE, with no live API/Auth/persistence claim. MCP snapshots/screenshots and installed Xcode CLI UI controls were used, with no Mirroring, browser workaround, source/global config/dependency change or native/EAS/TestFlight build.

| Native observation | Result |
| --- | --- |
| Positive, redundancy, caution, missing formula, reformulation | Correct conditional action/unknown/caution text rendered |
| Profile navigation and goal scrolling | Observed |
| Redundancy rationale / evidence disclosure | Native tap expands Why into evidence controls |
| Routine removal and apply | Row removed; local-only apply confirmation observed |
| Experience correction/apply | Report wording remains distinct from tolerance; local-only confirmation observed |
| Focused keyboard input and Add Product | Field mutation enabled Add Product; row created with the actual received text |
| Skip personalization | Native tap returned to the decision |
| Exact character injection | Not verified: requested Synthetic QA Cedar, automation entered Synthetc QA Cedari; no app defect established |
| Three-goal cap through native taps | Not verified; goal chips unavailable to semantic targets. Source/focused tests enforce one primary plus at most two secondary goals |

Representative temporary screenshots: positive `screenshot_optimized_9a1c6d0b-706e-49e3-b7a6-797d350db4fd.jpg`, rationale `screenshot_optimized_396c44b3-0a1f-456b-a435-767ac91918d0.jpg`, added product `screenshot_optimized_eeb64e78-dfe0-46a5-ab50-d1e8f285a053.jpg`, skip `screenshot_optimized_85976941-6140-4a47-8653-6f6eaf5a67c4.jpg` under `/var/folders/ff/ztddg8yn7c9fmbdh7rdwnc2m0000gn/T/`. Metro log `/private/tmp/p0b-retry-metro.log`; device enumeration `/private/tmp/p0b-native-device-enumeration.log`. These are session evidence, not durable acceptance artifacts.

Own Metro stopped and port8129 closed; existing8097 process untouched. MCP defaults restored to empty; Simulator boot state and clean source unchanged. No material source defect was established in exercised flows. Native fixtures do not prove live API, physical camera/interaction or customer comprehension. The latest physical enumeration listed the iPhone offline. **#74/#88 remain open** for physical/customer acceptance; exact native character injection and goal-chip interaction remain explicit verification limits.

## Docs / real remaining gates

One docs owner reconciled ARCHITECTURE, INTERFACES, DECISIONS, ROADMAP, OWNERSHIP, CONTEXT_SYNC and this packet after source landing. Historical checkpoints and static CODEOWNERS were preserved. The advisory rule is explicit in OWNERSHIP/ADR-40. Earlier stale docs-only approval and blocking-review interpretations were resolved; no pending human review is an idle dependency.

Remaining gates: reachable physical iPhone with enabled test controls; actual customer interaction/comprehension acceptance; separate hosted guest/operations activation with a named DRI. Scanner-readiness #95 was open/unmerged at this source checkpoint and not consumed speculatively. Source code completion does not activate hosted beta.

## Exact changed files

### B1 / PR #91

- `docs/P0_B_DECISION.md`
- `src/contracts/PersonalDecision.ts`
- `src/fixtures/personal-decision/fixtures.ts`
- `tests/p0b-contracts.test.ts`

### B4 / PR #90

- `src/components/p0b-personalization/ContextFlow.tsx`
- `src/components/p0b-personalization/ExperienceContext.tsx`
- `src/components/p0b-personalization/ReportedUseFields.tsx`
- `src/components/p0b-personalization/RoutineContext.tsx`
- `src/fixtures/p0b-personalization/examples.ts`
- `src/presentation/p0b-personalization/draft.ts`
- `src/presentation/p0b-personalization/experience.ts`
- `src/presentation/p0b-personalization/referenceDisplay.ts`
- `src/presentation/p0b-personalization/sensitivityInput.ts`
- `tests/p0b-personalization-experience.test.ts`
- `tests/p0b-personalization-history-reference.test.ts`
- `tests/p0b-personalization-labels.test.ts`
- `tests/p0b-personalization-presentation.test.ts`
- `tests/p0b-personalization-sensitivity.test.ts`
- `tests/p0b-personalization.test.ts`

### B2 / PR #92

- `docs/P0_B_CONTEXT.md`
- `scripts/test-p0b-context-local.mjs`
- `src/contracts/PersonalContext.ts`
- `src/services/remote/personalContext.ts`
- `supabase/config.toml`
- `supabase/functions/personal-context/deno.json`
- `supabase/functions/personal-context/index.ts`
- `supabase/functions/personal-context/validate.ts`
- `supabase/migrations/20260926233621_p0b_personal_context_revisions.sql`
- `supabase/migrations/20260927003158_p0b_assessment_context_revision_guard.sql`
- `supabase/migrations/20260927021000_p0b_assessment_packet_budget.sql`
- `supabase/tests/p0b_context.sql`
- `supabase/tests/p0b_packet_budget.sql`
- `tests/p0b-context-validation.test.ts`

### B5 / PR #93

- `src/components/personal-decision/PersonalDecisionPanel.tsx`
- `src/presentation/personal-decision/disclosure.ts`
- `src/presentation/personal-decision/parse.ts`
- `src/presentation/personal-decision/result.ts`
- `tests/p0b-renderer-capacity.test.ts`
- `tests/p0b-renderer-compact.test.ts`
- `tests/p0b-renderer.test.ts`

### B3 / PR #94

- `docs/P0_B_POLICY.md`
- `src/domain/personal-decision/evaluate.ts`
- `tests/fixtures/p0b/policy.ts`
- `tests/p0b-policy.test.ts`

### B6 / PR #96

- `.github/workflows/ci.yml`
- `scripts/test-p0b-decision-local.mjs`
- `src/contracts/PersonalDecisionService.ts`
- `src/presentation/personal-decision/contextAdapter.ts`
- `src/presentation/personal-decision/truthAdapter.ts`
- `src/services/remote/personalDecision.ts`
- `supabase/config.toml`
- `supabase/functions/personal-decision/deno.json`
- `supabase/functions/personal-decision/fixtures.ts`
- `supabase/functions/personal-decision/handler.ts`
- `supabase/functions/personal-decision/index.ts`
- `supabase/functions/personal-decision/runtime.ts`
- `tests/p0b-compose-routine-facts.test.ts`
- `tests/p0b-compose.test.ts`

### B7 / PR #97

- `app/(tabs)/my-stuff.tsx`
- `app/_layout.tsx`
- `app/personalize/fixture.tsx`
- `app/personalize/index.tsx`
- `src/components/check/CheckProductScreen.tsx`
- `src/components/my-stuff/MyStuffContent.tsx`
- `src/presentation/p0b-personalization/storageAdapter.ts`
- `src/presentation/personal-decision/customerController.ts`
- `src/presentation/personal-decision/customerGateway.ts`
- `src/presentation/personal-decision/legacyCustomerGateway.ts`
- `tests/p0b-customer-compose-adapter.test.ts`
- `tests/p0b-customer-compose-handler.test.ts`
- `tests/p0b-customer-compose-jit.test.ts`
- `tests/p0b-customer-compose-legacy-owner.test.ts`
- `tests/p0b-customer-compose-my-stuff.test.ts`
- `tests/p0b-customer-compose-owner-transport.test.ts`
- `tests/p0b-customer-compose-route.test.ts`
- `tests/p0b-customer-compose.test.ts`
