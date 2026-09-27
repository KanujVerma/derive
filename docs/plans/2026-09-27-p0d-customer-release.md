# P0-D customer integration and release preparation

Owner: Kanuj. Starting source: `22a210a7a720c9621d45e789b8690dcc73ab059a`.

Authorized portfolio execution supplies design approval. Source and current contracts govern this bounded increment.

## Actual gaps and scope

Existing local free Auth, immutable P0-A facts, P0-B controller/context/decisions and explicit My Stuff save already exist. Reuse them. Separate scripts currently exercise those services; there is no single guest through repeat Check/deletion smoke with a pinned receipt, or preflight that refuses to substitute local/fixture/simulator evidence for the intended beta binary. Free account Privacy/Support reject without customer recovery; its content cannot scroll. Component edit requires the root's expanded write-set grant.

## Sequence

1. Write failing P0-D receipt/preflight and local-run safety tests. Implement exact-source/environment evidence validation, artifact hash checking, and explicit missing gates.
2. Build a local service journey using existing Edge APIs: guest/free, catalog search, useful unknown, immutable formula, optional context, deterministic action, routine/history, explicit My Stuff save, repeat Check, owner isolation and actual customer account deletion. Synthetic catalog fixtures are marked; never imply camera, OCR or UI acceptance. --help/--dry-run do not touch services.
3. If granted, write failing account-link recovery tests, then catch link failures and allow free account content to scroll. No new link/config/backend.
4. Document actual evidence and exact composition bars. Request local service lease after the P0-B acceptance lead is finished; never start/reset the shared stack.
5. Focused tests, full tests, application/test types, web export, iOS export if account UI changes, diff/write-set/secret review, commit, focused PR, exact-head CI. Root merges and reconciles canonical docs.

## Dependencies and evidence limits

Sami owns camera/capture, recognition, catalog contribution and hosted guest lifecycle. Their integration follows merged contracts once; no competing implementation. Physical and unassisted human testing require an available device/tester. The intended binary, hosted environment and TestFlight are separate gates. No production activation, new EAS build, release, paid/provider call, dependency addition or global environment change.

## Write-set

`scripts/acceptance/p0d/**`, `scripts/preflight-customer-release.mjs`, `scripts/test-p0d-customer-flow-local.mjs`, `src/presentation/customer-journey/**`, `tests/p0d-*`, `docs/P0_D_ACCEPTANCE.md`, this plan. `src/components/account/FreeAccountShell.tsx` only after root grant. Reserved composition/capture/contracts/migrations/canonical docs unchanged.

## Pre-approval source validation completed

- 17 focused P0-D cases passed, including rejected link/retry, pinned source/environment/binary/hash rejection, safe CLI dry run and real policy/controller/renderer contract scenarios.
- Full `npm test` passed: 66 files, 583 TAP cases plus existing assertion-only scripts.
- Application and test TypeScript passed. Web and iOS exports passed with dotenv and telemetry disabled; outputs stay under `/private/tmp`.
- `git diff --check` and exact write-set/secret review passed. No dependency addition.
- Actual shared-stack local journey, native small-screen/large-font observation, physical device, hosted, intended beta binary, TestFlight and unassisted customer acceptance remain pending their leases/evidence. Exact-head CI follows focused publication before any merge.

Review found that passing React Native Linking.openURL alone loses its receiver. A receiver-dependent failing regression verified this; the helper now invokes the method on the supplied Linking object. Public page reachability passed independently; managed-first public copy remains a release reconciliation dependency. At the pre-approval checkpoint, automatic approval review twice rejected local commit permission despite publication authorization; the staged payload was preserved without a bypass.

## Approved and reconciled execution

The user explicitly authorized the reviewed 12-file patch SHA-256 `98ae45436e9970a00232457f4eddf67c8fa483253b0a3d7500c6c39595f5feb1`. Commit `532a013` was backed up before rebase onto main `8ec9fe57`; reconciled source became `82dd0c5`. Full gates passed (69 files, 604 TAP tests plus assertion scripts, app/test types, web/iOS exports and scope/diff review). Root-granted actual local journey at `82dd0c5` passed all 12 checks, 32 Edge calls and owned-only cleanup; receipt/hash are recorded in P0_D_ACCEPTANCE. DB lease returned, stack/forwards/devices unchanged. Leaf evidence updates preserve that predecessor identity; final publication/source CI and final-head local proof must be refreshed after subsequent main reconciliation.

## Bounded independent review corrections

Independent review found that an early cleanup exception could prevent remaining owned deletions. A script-only cleanup helper now attempts every recorded guest/catalog deletion and absence check, collects safe errors, and fails without a receipt if any result remains uncertain. Injected first-user, catalog, verification, surviving-row and network-error cases failed against the old early-abort behavior and pass with the correction. Actual deletion now requires the admin get-user 404 response; a transport error is not proof of absence. The source preflight also requires `ios_export`, with a missing-iOS observation regression. These are bounded correctness corrections within P0-D acceptance scope. Prior service receipts remain immutable predecessor evidence; final clean revision receives fresh validation/CI/service proof.
