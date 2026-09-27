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

## Source validation completed

- 17 focused P0-D cases passed, including rejected link/retry, pinned source/environment/binary/hash rejection, safe CLI dry run and real policy/controller/renderer contract scenarios.
- Full `npm test` passed: 66 files, 583 TAP cases plus existing assertion-only scripts.
- Application and test TypeScript passed. Web and iOS exports passed with dotenv and telemetry disabled; outputs stay under `/private/tmp`.
- `git diff --check` and exact write-set/secret review passed. No dependency addition.
- Actual shared-stack local journey, native small-screen/large-font observation, physical device, hosted, intended beta binary, TestFlight and unassisted customer acceptance remain pending their leases/evidence. Exact-head CI follows focused publication before any merge.

Review found that passing React Native Linking.openURL alone loses its receiver. A receiver-dependent failing regression verified this; the helper now invokes the method on the supplied Linking object. Public page reachability passed independently; managed-first public copy remains a release reconciliation dependency. Automatic approval review twice rejected local commit permission despite publication authorization; no commit/publication occurred and the staged payload is preserved pending concrete explicit approval.
