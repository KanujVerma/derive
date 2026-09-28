# Kanuj beta-critical portfolio

## Current 24–48 hour execution wave, 2026-09-28

**Verified starting main:** `f9fa0b720fb8fc8bc8154c073709c0b8dee8581a`; both jobs of main CI `36377337899` succeeded. The shared checkout remains dirty at `773a4b8` with its prior files intact. The Kanuj source branches use disjoint worktrees and normal merges; source main advanced through #130 (`9ab465a`), #131 (`c2fba2c`), #129 (`399ff04`) and #133 (`666f6d3`). The 24–48 hour horizon prioritizes first useful customer value; it is not a promise of public App Store approval or hosted scanner-first release.

**Source-versus-hosted readback:** Sami #125–#128 landed hosted inventory tools, a temporary closed-beta policy, a guest-session replacement guard and a deletion/upload fence; #132 added Auth-config readback tooling but the actual Auth result is UNKNOWN without a Management API read token. A fresh authenticated, read-only exact-project inventory against source `666f6d3` still showed **15 hosted of 21 source Edge Function names** and **19 hosted of 29 source migration versions**, with no hosted-only entries. Missing functions: `access-state`, `free-context`, `free-personal-fit`, `personal-context`, `personal-decision`, `prepare-free-product-evidence`. The ten missing versions include the deletion fence `20260928000000`. Names/versions are not code, schema, RLS or runtime proof. No hosted migration/function was deployed, no anonymous Auth was activated, and no customer data was read in this Kanuj pass.

| Track | DRI and isolated branch | Status | Current blocker | Next integration |
| --- | --- | --- | --- | --- |
| T1 product/monetization | Kanuj `kanuj/mvp-monetization-research` | MERGED #129 at `399ff04`; exact-head CI `36386168342` both green | Pricing and Founding Plus terms remain open. | Use [monetization evidence](MONETIZATION.md) to choose a measurable future Plus benefit and offer. |
| T2 measurement | Kanuj `kanuj/mvp-product-analytics` | MERGED #131 at `c2fba2c`; exact-head CI `36385176624` both green | Typed coarse event contract has no production sink or call site; Sami #35 inactive PostHog transport and privacy choice remain separate. | Review payload/consent/deletion with Sami, then bounded screen/event integration. |
| T3 entitlements/usage | Kanuj `kanuj/mvp-entitlement-policy` | MERGED #133 at `666f6d3`; exact-head CI `36386667742` both green | Pure client projection issues no grant, counts no use and enforces no server quota. | Sami-owned trusted policy/grant/usage authority and atomic per-Check counting, then bounded client adapter. |
| T4 soft judgment | Kanuj `kanuj/mvp-decision-benchmark` | MERGED #130 at `9ab465a`; exact-head CI `36384580550` both green | Offline baseline self-aligns with reviewed assertions; independent gold and Gemini/Jev runs absent. | Review gold, privacy/terms/cost and only then compare providers. |
| T5 App Store/P0-D | Kanuj `kanuj/app-store-release-scorecard` | MERGED #134 at `9894481`; exact-head CI `36387428189` both green; source-only scorecard | Production EAS selects Mock; all non-development flavors select legacy. Hosted drift, Auth, physical acceptance, current binary and ASC evidence remain open. | [Release readiness](APP_STORE_RELEASE_READINESS.md) remains conditional; consume Sami hosted handoff and exact candidate later. |
| T6 Plus/Managed presentation | Kanuj isolated fixture leaf | ACTIVE, unpublished | No approved Plus service/entitlement or live Managed interest outcome. | Review fixture states and add only a real approved integration path in a later composition pass. |
| Sami P0-C, perception and contribution | Sami, independent portfolio | ACTIVE | Hosted source drift; image extractor has no eligible frozen rights-cleared corpus or provider winner; contribution service/review runtime absent. | Handoff reviewed contracts and exact hosted/device proof; Kanuj integrates in bounded separate passes. |

**Operating priorities:** Free Check answer quality, safety, uncertainty and relevant single-product routine context do not depend on Plus payment. Plus is a proposed cross-product/longitudinal self-service job; Managed is delegated ongoing care; founding cohort size/duration and $4.99/$30–40 pricing are experiments, not entitlements or live prices. The user has reopened the 18+ audience decision. The prior Sami #126 source checkpoint calls the first scanner release free-only, while this new founder brief proposes Plus or Founding Plus access: treat that as an unresolved launch-scope reconciliation, with **no public Plus checkout or Managed payment activation** inferred. Product analytics must prove first useful Check and trial-to-Managed hypotheses without transmitting skincare content. The deterministic P0-B decision remains final authority; Jev/Gemini are bounded challengers, and Sami's image benchmark stays separate.

Root alone owns main advancement, issue/PR merge order, canonical existing docs and shared-file locks. T1 owns new monetization/evidence docs; T2 owns new analytics leaf/docs; T4 owns new decision-intelligence benchmark/docs. Reserve canonical Check/root navigation/Auth, shared contracts, accepted product truth, final policy, environment/build config and migration order for one reviewed writer. Every source PR must pass focused/full tests, both TypeScript checks, web/iOS exports, diff/secret/ownership and exact-head CI after reconciliation. Docs-only PRs need current-versus-target/history/link/diff and exact-head CI. No provider spend, customer photo upload, production billing, hosted activation, public Vercel deploy, EAS/App Review submission or unrelated dirty checkout edit is authorized here.


## Current continuation: Auto camera, contribution UX, and release truth

**Verified starting main:** `aefbd46085698d49be9789b7742acbf2a1288471`, resulting-main CI `36352925277` both jobs successful. Original shared checkout remains dirty at `773a4b8`; no reset, stash, checkout or cleanup of that work. Previous portfolio landings #102, #107 and #101 are merged and are historical records below, not new work.

Sami's #108 Auto camera, #110 Expo iOS UPC-A normalization, #109 offline perception benchmark, #111 pure catalog-contribution contract and #112 hosted-free readiness preflight are merged. None proves physical barcode acceptance, image recognition, customer contribution submission, or hosted guest activation. Sami's image-read-hardening #113 remains open and Sami-owned. Never edit, rebase or merge that branch for him.

```text
Kanuj portfolio root: current-main tracking, source-of-truth, issue and merge order
+-- K1 / current Auto camera and P0-D acceptance: physical/Simulator owner
+-- K2 / Help add this product customer module: #115, consumes #111 pure contract
+-- K3 / release/privacy/support truth: tracked apple-site and app copy audit
```

| Track | Isolated branch / worktree | Strict write-set and boundary |
| --- | --- | --- |
| Root | `kanuj/portfolio-wave-2` / `derive-kanuj-portfolio` | Canonical portfolio, roadmap/ledger, issue/merge coordination only. |
| K1 | `kanuj/p0d-current-camera-acceptance` / `derive-p0d-current-camera` | `docs/acceptance/P0_D_CURRENT_CAMERA.md`, focused tests, and a root-granted narrow `CheckProductScreen.tsx` Auto-entry composition fix. Sole device/Simulator operator; no Sami camera internals. |
| K2 | `kanuj/missing-product-contribution-ux` / `derive-missing-product-ux` | New `src/presentation/catalog-contribution/**`, `src/components/check/contribution/**`, `tests/catalog-contribution-ux*`, own acceptance doc. No Check root/backend/contract edits; #115 tracks the customer increment. |
| K3 | `kanuj/p0d-release-truth` / `derive-p0d-release-truth` | Own release audit, bounded `apple-site/{index,privacy,support,privacy-choices}.html` copy, optional Account leaf and tests. No external deployment or legal-commitment invention. |

The four branches initially started at the same verified main; each remaining Kanuj PR was reconciled and revalidated after main advanced. Existing old branches/worktrees remain intact. Root reserves root navigation/Auth/contracts, migration order, build/environment config and final composition. K1 alone holds a narrow canonical Check entry lease after a current-source Simulator observation showed the barcode-only entry hiding package photos despite #108 Auto inside capture; it may not edit Sami capture internals. K1 holds device/Simulator; local Supabase/Colima are stopped until a root-granted need is established. K2 consumed #111's validator in merged PR #117 (normal merge `7a3e82c41b8ba46c0d32a0ae3217f74b22b12d48`, exact-head CI `36355063029` both green) without creating a submission API, review queue, catalog truth or fake success. #115 stays open for final Check composition after Sami #105 runtime handoff. K3 prepared PR #116 (`63371dece5f738c67e2e51126eab412b874c5f45`) for four tracked `apple-site` pages plus an audit; both exact-head CI `36354571785` jobs passed. The user explicitly authorized a read-only Vercel settings check after an earlier automatic rejection. The live `derive-beta-site` project has no connected Git repository or production branch in its project API; its sole READY production deployment is from historical `kanuj/apple-build8-external-review` source. Vercel documents automatic merge deployments for connected Git projects, so a source merge is not expected to publish this site. PR #116 reconciled after #117, passed both exact-head CI `36355613278` jobs, and merged normally as `137facf71e19111c7dbdaa743a37510af1cd8a5b`. Post-merge Vercel readback still showed the single older production deployment, so public deployment and candidate-specific privacy/legal review remain separate gates. No Vercel setting or deployment was changed. The eligible unassisted adult tester is later. The wired physical iPhone is paired but passcode-locked; an asynchronous operator unlock request is pending. Source, Simulator, physical, local service, hosted, binary/TestFlight and human observations remain separate.

After any main advancement, fetch and reconcile remaining Kanuj branches, rerun applicable gates and require exact-head CI. Source PRs run full unit, app/test TypeScript, web/iOS exports, diff/scope/secret checks; database/Auth/RLS gates apply only to legitimate backend changes, which this wave does not plan. All final PR merges remain root-owned. No EAS/TestFlight build, provider/billing/hosted activation, public release, photo-library path, Product Compare or Sami-owned implementation is authorized in this wave.

## Current wave source landing checkpoint

- **K2 merged:** PR #117 head `85ee9369e33a94fe5fd7b9a3b68d1548c3db45e0`, exact-head CI `36355063029` both successful, normal merge `7a3e82c41b8ba46c0d32a0ae3217f74b22b12d48`. The leaf has honest unavailable recovery today, optional draft review against #111, owner-scoped component state, private evidence opt-in and stable request IDs for unchanged details. It has no customer submission API or canonical truth write. #115 stays open for bounded Check composition after Sami #105 runtime.
- **K1 source landed:** PR #118 head `6a0c6660cf5f12be27488e9ee22a1a6a89469795`, exact-head CI `36356139508` both green, normal merge `c8284ee305ccbe65c5a36f0cec8e7955edc7f104`. Current-source Simulator had shown a barcode-only Check entry despite #108's Auto camera; one Kanuj-owned Check entry fix now renders a plain **Open camera** action and visible name-search fallback. It changed no Sami capture files. The updated entry rendered on iPhone 17 Pro Simulator, but automation taps did not change the screen; no in-camera interaction or physical proof is claimed. Local focused 21/21, full 62 files/665 registered cases, both TypeScript checks, web/iOS exports, diff/scope/secret checks passed.
- **K3 source landed:** PR #116 head `d12cfbdf75a742059376634d6020e1df5b6dce95`, exact-head CI `36355613278` both green, normal merge `137facf71e19111c7dbdaa743a37510af1cd8a5b`. Four tracked public-page source files and a release audit are committed. The live Vercel project has no connected Git repository; post-merge readback still showed only the old production deployment. Public site deployment, live page readback, candidate privacy/legal and hosted/binary validation remain open. Public deployment, binary-specific privacy/legal review and hosted behavior remain gates.
- **Still open:** #74/#88/#100/#115; Sami #113 is open/independent. Physical phone is passcode-locked, smaller Simulator prompt and native input-control behavior are unverified, eligible unassisted tester is later. Public site still served its old headline after #116 merged; source copy is not deployed. Hosted guest activation, contribution runtime, perception extraction, actual beta binary/TestFlight and candidate-specific privacy review remain open. The portfolio status is **KANUJ MVP PORTFOLIO PARTIAL**.

## Earlier portfolio wave: landed source and historical checkpoints

## Mandate and checkpoint

Kanuj is DRI for P0-B acceptance and P0-D integrated customer/release experience. Sami owns active smart camera/capture, P0-A extraction/truth, catalog contribution/coverage and P0-C hosted operations. Kanuj remains CX steward of those customer-facing changes. A counterpart dependency gates integration, not independent preparation.

Starting main: `22a210a7a720c9621d45e789b8690dcc73ab059a`. Main CI36328042910 passed both jobs. Original shared checkout remains dirty at773a; no reset, stash, cleanup or overwrite. Isolated worktrees below start from the same clean source. P0-B source is reused, not rebuilt; its physical/customer gate remains #74/#88. Source-only #77 is closed with those acceptance requirements delegated.

## Portfolio DAG and ownership

```text
Kanuj portfolio / root
+-- K1 P0-B acceptance
|   +-- inventory DONE / current-source native observation PARTIAL
|   +-- actual local controller + Edge/persistence acceptance DONE / PR102 merged
|   +-- neutral comprehension protocol -> eligible tester later
|   +-- evidence and focused PR DONE / physical and human gates OPEN
+-- K2 P0-D / issue100
|   +-- account-link recovery / scrollability source DONE / PR107 merged
|   +-- integrated actual local journey / unknown recovery DONE
|   +-- source/environment/binary preflight DONE / candidate evidence OPEN
|   +-- later camera/hosted/release composition
+-- K3 CX stewardship
    +-- immutable95 scoped review DONE -> Sami merged
    +--99 focused/final reviews DONE -> Sami merged
    +-- one-camera consumer criterion matrix / physical gaps
```

The root alone maintains the full DAG, issue/PR/merge state, shared locks, dependency order and canonical docs. Feature leads may delegate only when capacity and disjoint work allow it. Do not add workers for agent count. Each public PR remains focused; after each main advancement reconcile and rerun required gates on every remaining Kanuj PR.

| Track | Lead / branch | Worktree | Strict write-set |
| --- | --- | --- | --- |
| Portfolio | root / `kanuj/portfolio-beta-orchestration` | task workspace `derive-kanuj-portfolio` | canonical docs, plan/ledger; no product code |
| K1 | `portfolio_p0b_acceptance` / `kanuj/p0b-customer-acceptance` | task workspace `derive-p0b-acceptance` | `scripts/acceptance/p0b/**`, `scripts/test-p0b-customer-acceptance-local.mjs`, `tests/p0b-acceptance-*`, `docs/acceptance/P0_B_*.md`, own plan |
| K2 | `portfolio_p0d_lead` / `kanuj/p0d-customer-release` | task workspace `derive-p0d-integration` | `scripts/acceptance/p0d/**`, customer release/flow CLI scripts, `src/presentation/customer-journey/**`, `tests/p0d-*`, `docs/P0_D_ACCEPTANCE.md`, own plan; `FreeAccountShell.tsx` granted for concrete link failure/scroll fix |
| K3 | `portfolio_cx_steward` / `kanuj/cx-scanner-stewardship` | task workspace `derive-cx-stewardship` | `docs/reviews/CX_SCANNER_*.md` only; source read-only |

Task workspace prefix: `/Users/kanuj/.codex/.chatgpt-projects/g-p-6aa97a53d2048191a32fe501d4540756`. Native app worktree tool could not resolve the mirror as a Git repository; manual linked worktrees use the real repository without modifying its dirty checkout.

## Resource and file locks

- K1 is the sole physical iPhone, Simulator and local Supabase/Colima operator during this wave. Other tracks request a lease; no concurrent reset or device control.
- Root is the sole Kanuj canonical-docs/issue/merge writer. Sami's independent ledger additions must be preserved when main advances.
- K2 is the sole `src/components/account/FreeAccountShell.tsx` writer for the evidenced broken-link/scrolling recovery change. It preserves existing configured links and makes no contact verification claim.
- Reserve canonical Check, root navigation/layout, central Auth/bootstrap, contracts, migration order and global environment/build configuration. A concrete consumer defect needs an explicit lock before touching these.
- Reserve Sami's complete camera/capture surfaces, including `src/components/check/capture/**`, `src/presentation/capture/**`, extraction contract/evaluator/server adapter and readiness/environment helpers. No new detector/controller, forked contract or catalog system.

## Current evidence and external gates

P0-B's seven source PRs and docs are merged. Development fixtures, local service, native UI, physical device, hosted environment, TestFlight binary and real-user observations are distinct evidence scopes. Never upgrade one into another.

The user has made the iPhone available and will arrange an eligible unassisted U.S. adult tester later. Fresh escalated inventory sees the connected iPhone and ExpoGo57; developer-only inventory initially missed store apps. Installed Derive1.0.0 build10 is an older binary, not current P0-B. Native automation capabilities and a current-source payload/environment must be verified before claiming physical interaction or live-service acceptance.

K1 diagnosed a healthy PostgreSQL container with failed Colima SSH host forwards. Temporary task-local loopback forwards recovered connectivity without a global configuration change or volume deletion; actual local controller/service acceptance passed at the K1 candidate, with disposable cleanup checked as zero. Native current-source Remote guest/Check and personalization screens loaded on Simulator; reported-success actions that did not change the screen remain unverified, not app defects. Independent K2 and K3 work continues. No production activation, paid vendor commitment, new provider, billing action, public release or duplicate EAS submission is authorized.

P0-D parent: [#100](https://github.com/KanujVerma/derive/issues/100). The integration bar is fresh install/guest entry, one simple camera/search, supported facts or useful unknown recovery, optional personalization and personal decision, routine/history/My Stuff, repeat Check and account/privacy/support. It owns whether that customer product works, not only a checklist.

## Scanner stewardship checkpoint

- [#95](https://github.com/KanujVerma/derive/pull/95) exact403427a on main22 merged as8ec9fe57ee2a341cf058da6818cab1227984aaea with both CI jobs green. Focused review found no introduced blocker; candidate extraction is bounded and non-authoritative, LAN is explicit development only. The older551/486 metadata needs a nonblocking current-run correction (current587/524), with historical evidence preserved.
- [#99](https://github.com/KanujVerma/derive/pull/99) reconciled exacte0591ea onto main8ec9fe5 and passed both CI36330524296 jobs (590TAP/524pgTAP). Final scoped CX review found no introduced source blocker; source/test delta is unchanged from its earlier six-file review. Sami merged99 asbe853d237d6b7bc1e5f3252ebeb88cf7f3f46c0f; Kanuj did not rebase or merge his branch. Kanuj tracks reconcile onto this main before their gates/merges.
- One automatic camera is the broader consumer bar. Technical role selection, barcode-only role detection, missing role inference and missing torch are Sami follow-ups, not newly introduced blockers to99's safe-area fix.
- Founder-reported tabs/shutter observations are distinct from independent lifecycle/small-screen/large-font/speed acceptance. The review artifact captures exact lines and proposed public comments.

## Completion rules

Close #74/#88 only after actual P0-B physical/live/customer requirements pass. Close P0-D only when the integrated consumer outcome, intended binary/environment, privacy/support/deletion, adult scope and release truth are observed. Human comprehension requires an eligible unassisted tester answering recommendation, why, routine change, uncertainty and next step without coaching. No names, recordings or sensitive disclosures in the study ledger.

Sami stewardship is advisory unless branch protection or a concrete unresolved invariant requires an affected-PR hold. Kanuj owns the merge decision. Substantial source changes run focused/full unit, app/test TypeScript, web/iOS where applicable, diff/secret/scope and exact-head CI; database/Auth/RLS changes require their actual reset/pgTAP/integration gates. Docs-only changes use scope/link/diff checks. This record activates ownership/preparation, not external beta readiness.

## Commit approval incident

Automatic approval review twice rejected the reviewed P0-D12-file local commit, interpreting the Global Codex Contract as a separate commit gate despite portfolio publication authorization. No workaround or indirect commit occurred. Root requested explicit approval of the concrete corrected payload and the user approved that P0-D commit; current patch hash98ae45436e9970a00232457f4eddf67c8fa483253b0a3d7500c6c39595f5feb1. The account native-method receiver regression was fixed and all applicable local gates passed before that request. The P0-D candidate committed/reconciled to82dd0c5 and passed the actual12-check/32-call local journey with generated-row cleanup. Its reviewed evidence remains local-service/controller proof, not native/physical/hosted/TestFlight/human acceptance; publication and exact-head CI subsequently passed; later reconciliation and cleanup corrections are recorded below. Other tracks continue.

## Acceptance observation checkpoint

K1 actual local controller/remote-adapter/SDK/Edge/persistence harness passed positive/redundancy/prior reaction/partial context, exact persisted Unicode text, correction, response-loss replay, unavailable/retry, owner/sign-out transitions and denied private-table access. Existing eight-category decision/capacity/Unicode and full pgTAP21/524 also passed. These are actual local service/controller observations, not physical or human acceptance. Current-source native Remote guest boot and personalization appeared in normal app screens on Simulator, without a development fixture or auth bypass; interactions remain unverified when automation reports success without actual state changes. Root Device Hub fallback timed out. Physical current-source launch is still blocked by a locked phone, with operator request pending. Tester is arranged later.

## P0-D actual local journey checkpoint

Candidate82dd0c5ae49b7f83eaaa52227c66446756a8c71f completed12 checks and32 actual Edge calls: guest/free, catalog/unknown recovery, immutable product truth, optional context/personal action, canonical routine/history, explicit My Stuff, repeat Check/KEEP_CURRENT, foreign-owner denial and actual customer deletion. Receipt `/private/tmp/p0d-local-receipt-82dd0c5.json`, SHA2564baebb82f81c27553cc3436bc71f789d4ad2bfcaee496266aa5311265a4a49fb. Generated guests/catalog rows were removed and read back absent; shared stack was not reset. Free Account native-opener receiver regression was found during root review and fixed before approval/publication. Public legal/support pages return200 but retain managed-first copy; this is a candidate-specific release reconciliation gate, not proof of support response or scanner-first readiness.

## Historical main-advance reconciliation checkpoint

Sami95 and99 are merged at8ec9fe57 andbe853d23 respectively. K1 acceptance PR102 is reconciling onto be853d23 and rerunning its required source/CI gates. The final P0-D candidate04c25338512971219ed7100cc5587d8e8e0099f0 passed its12-check/32-call local service/controller journey again on that clean rebased head. Receipt `/private/tmp/p0d-local-receipt-04c2533.json`, SHA256fdde442f7637877516c28419f33a8508e9cb94d98da823c042744d9944c86359; generated data cleanup checked, no native/hosted/binary proof. The portfolio docs branch preserved Sami's two ledger entries during reconciliation. Smart automatic routing/extraction/torch and hosted/current-release/user gates are still separate from the landed full-screen fix.

## Independent review correction

Root/independent review reproduced a P2 failure-path defect in both new acceptance runners: one cleanup deletion exception skipped remaining owned cleanup/absence checks. Both owners added all-attempt cleanup, safe aggregated failure and injected regressions. K1 final head9bcffb6 checks each owned product-truth snapshot is absent after cleanup; its actual controller/local-service rerun passed. P0-D corrected head6499f90 passed its12-check/32-call journey with verified Auth404 and all cleanup, receipt `/private/tmp/p0d-local-receipt-6499f90.json`, SHA256e10d4774856daa56441e4274cb47cacecb746a0c7c114d0510e4a112f7bff6b8. It also requires the missing iOS-export evidence gate. No real customer data or actual cleanup failure was observed. The concrete source finding is corrected; exact-head validation and dependency-safe landing remain required. This was not a human-steward approval dependency.


## P0-B acceptance source landing

PR102 exact9bcffb6f98977ef92163152601aaf289a35d4b00 passed bothCI36336776094 jobs, including the new actual customer-controller harness. Independent review injected surviving snapshots for either owner and observed safe rejection only after all24cleanup operations. Root merged normally as8ac8ed3d6299a85ef6e617b5dc940c1e4c5d5f20. K2 now receives the sole three-line CI registration lock and reconciles PR107 onto that main before its fresh gates. #74/#88 remain open because this source landing does not complete physical or human acceptance.

GitHub interpreted a negated closing keyword in PR102 as an automatic issue74 closure on merge. Root corrected the PR wording, verified closingIssuesReferences empty, reopened74 and left an evidence comment. Physical/human acceptance remains open; the automatic event was not completion proof.


## P0-D final source registration

After PR102 landed, K2 reconciled onto8ac8ed3 and added exactly three CI lines after the P0-B client harness. Clean head7cc6fda3489d0900c13d8e8601fc6fe7abf505c3 passed full73unit files/612registeredTAP plus assertion scripts, app/test types, web/iOS exports and scope/secret/diff checks. Its actual local12checks/32Edgecalls and robust owned cleanup passed again; receipt `/private/tmp/p0d-local-receipt-7cc6fda.json`, SHA256cef026b1e65fadb35b7fdf08a826f8fffdb44bfca00e3d90ec3b617afa03298c. Source registration and local proof are complete; exact-head CI36337440783 subsequently passed both jobs and root merged PR107 normally asaa12e08677657b5a955fef766d81c97b9432a968. This is local service/controller proof, not physical, hosted, TestFlight or human proof.


## Final runtime restoration

After all local service leases returned, K1 verified only12Derive containers and no foreign containers. It stopped only task-owned Metro8135, stopped Supabase with default backups enabled, cancelled exactly the temporary127.0.0.1:54321/54322 SSH forwards, and stopped Colima after verifying zero containers and all three saved volumes retained (`supabase_db_derive`, `supabase_edge_runtime_derive`, `supabase_storage_derive`). Ports8135/54321/54322 are closed. Port8097 already had no listener and was not killed; Simulator boot state is preserved. The private pre-reset backup remains unprinted/uncommitted. No global Docker/SSH/build configuration changed. The earlier prepared phone URL is now historical and requires a new bounded operator run; the phone unlock question was unanswered, not permission. Physical interactions and unassisted study remain unrun.


## Landed source and remaining acceptance

| PR | Final reviewed head | Both successful exact-head CI | Normal merge |
| --- | --- | --- | --- |
| K1 #102 | 9bcffb6f98977ef92163152601aaf289a35d4b00 | 36336776094 | 8ac8ed3d6299a85ef6e617b5dc940c1e4c5d5f20 |
| K2 #107 | 7cc6fda3489d0900c13d8e8601fc6fe7abf505c3 | 36337440783 | aa12e08677657b5a955fef766d81c97b9432a968 |

Final source validation:73unit files/612registeredTAP plus assertion scripts, both TypeScript checks, web/iOS exports, diff/secret/ownership scope. CI independently replayed migrations, all21pgTAPfiles/524assertions and all integration harnesses including new K1 actual-client and K2 journey steps. Docs-only PR101 is reconciled ontoaa12e08 and requires its own scope/link/diff review and fresh both-job CI before normal landing. Its final head/merge/main CI are GitHub metadata, not predicted here.

No unresolved scoped source invariant remains. Portfolio status remains **KANUJ MVP PORTFOLIO PARTIAL**. Kanuj gates: actual current-source physical interactions, small-screen/large-text and unassisted five-question comprehension. Sami dependencies: one-camera automatic evidence-role routing/manual fallback, real image extraction/evaluation, useful catalog coverage/contribution, hosted guest lifecycle/abuse/linking/deletion activation. Cross-feature gates: actual intended beta binary/environment, hosted and TestFlight journey, offer/privacy/support copy matching that binary. No source/local/simulator observation closes these. #74/#88/#100 stay open; #77 source-only is closed. No new EAS/TestFlight build, production/hosted activation, provider/billing commitment or unrelated checkout edit.
