# Kanuj beta-critical portfolio

## Mandate and checkpoint

Kanuj is DRI for P0-B acceptance and P0-D integrated customer/release experience. Sami owns active smart camera/capture, P0-A extraction/truth, catalog contribution/coverage and P0-C hosted operations. Kanuj remains CX steward of those customer-facing changes. A counterpart dependency gates integration, not independent preparation.

Starting main: `22a210a7a720c9621d45e789b8690dcc73ab059a`. Main CI36328042910 passed both jobs. Original shared checkout remains dirty at773a; no reset, stash, cleanup or overwrite. Isolated worktrees below start from the same clean source. P0-B source is reused, not rebuilt; its physical/customer gate remains #74/#88. Source-only #77 is closed with those acceptance requirements delegated.

## Active DAG and ownership

```text
Kanuj portfolio / root
+-- K1 P0-B acceptance
|   +-- device inventory / current-source native interaction
|   +-- actual local controller + Edge/persistence acceptance
|   +-- neutral comprehension protocol -> eligible tester later
|   +-- evidence and focused PR
+-- K2 P0-D / issue100
|   +-- stable account-link error recovery / scrollability
|   +-- integrated customer journey / unknown recovery harness
|   +-- source + environment + binary release truth
|   +-- later camera/hosted/release composition
+-- K3 CX stewardship
    +-- immutable95 review -> Sami disposition
    +--99 own delta advisory -> Sami reconcile -> final review
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

K1 diagnosed a healthy PostgreSQL container with failed Colima SSH host forwards. Temporary task-local loopback forwards recovered connectivity without a global configuration change or volume deletion; actual local controller/service acceptance is running. Independent K2 and K3 work continues. No production activation, paid vendor commitment, new provider, billing action, public release or duplicate EAS submission is authorized.

P0-D parent: [#100](https://github.com/KanujVerma/derive/issues/100). The integration bar is fresh install/guest entry, one simple camera/search, supported facts or useful unknown recovery, optional personalization and personal decision, routine/history/My Stuff, repeat Check and account/privacy/support. It owns whether that customer product works, not only a checklist.

## Scanner stewardship checkpoint

- [#95](https://github.com/KanujVerma/derive/pull/95) exact403427a on main22 merged as8ec9fe57ee2a341cf058da6818cab1227984aaea with both CI jobs green. Focused review found no introduced blocker; candidate extraction is bounded and non-authoritative, LAN is explicit development only. The older551/486 metadata needs a nonblocking current-run correction (current587/524), with historical evidence preserved.
- [#99](https://github.com/KanujVerma/derive/pull/99) reconciled exacte0591ea onto main8ec9fe5 and passed both CI36330524296 jobs (590TAP/524pgTAP). Final scoped CX review found no introduced source blocker; source/test delta is unchanged from its earlier six-file review. Kanuj did not rebase or merge Sami's branch.
- One automatic camera is the broader consumer bar. Technical role selection, barcode-only role detection, missing role inference and missing torch are Sami follow-ups, not newly introduced blockers to99's safe-area fix.
- Founder-reported tabs/shutter observations are distinct from independent lifecycle/small-screen/large-font/speed acceptance. The review artifact captures exact lines and proposed public comments.

## Completion rules

Close #74/#88 only after actual P0-B physical/live/customer requirements pass. Close P0-D only when the integrated consumer outcome, intended binary/environment, privacy/support/deletion, adult scope and release truth are observed. Human comprehension requires an eligible unassisted tester answering recommendation, why, routine change, uncertainty and next step without coaching. No names, recordings or sensitive disclosures in the study ledger.

Sami stewardship is advisory unless branch protection or a concrete unresolved invariant requires an affected-PR hold. Kanuj owns the merge decision. Substantial source changes run focused/full unit, app/test TypeScript, web/iOS where applicable, diff/secret/scope and exact-head CI; database/Auth/RLS changes require their actual reset/pgTAP/integration gates. Docs-only changes use scope/link/diff checks. This record activates ownership/preparation, not external beta readiness.

## Commit approval incident

Automatic approval review twice rejected the reviewed P0-D12-file local commit, interpreting the Global Codex Contract as a separate commit gate despite portfolio publication authorization. No workaround or indirect commit occurred. Root requested explicit approval of the concrete corrected payload; current patch hash98ae45436e9970a00232457f4eddf67c8fa483253b0a3d7500c6c39595f5feb1. The account native-method receiver regression was fixed and all applicable local gates passed before that request. Actual local journey execution/publication remains pending the clean commit, fresh rebase/validation and service lease. Other tracks continue.
