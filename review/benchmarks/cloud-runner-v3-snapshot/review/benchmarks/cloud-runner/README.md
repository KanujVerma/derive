# Derive fixed V3 cloud runner

This wrapper uses the preserved V14 benchmark adapter and exact V3 dataset. It does not enable, renew, reset, refund, or expand the saved run.

## Fixed scope

- Project: `snojlbqovlawewwqbviz`
- Run: `4cc3c917-54f2-4522-a79d-6a74e1762074`
- Dataset hash: `a8b2d46c9d530a5ba94a19611125e01a5696a21ed649059704107201f472aa46`
- Existing ledger cap: 15 calls and 100,000 micro-USD ($0.10).
- Commands: `NODE_USE_ENV_PROXY=1 node --experimental-strip-types review/benchmarks/cloud-runner/run.ts status` or `run_next`.
- One `run_next` process performs at most one claimed provider phase.

## Credential setup

Only the dedicated `derive cloud` environment should request these Personal Network secrets:

- `GEMINI_API_KEY`: `generativelanguage.googleapis.com`
- `JEV_API_KEY`: `api.typesafe.ai`

The user enters the values in Personal vault, scoped to the selected environment. Never print, copy into chat, persist in source, or send values to the management connector. Verify the runtime provides supported environment bindings or proxy placeholders before model execution. Presence checks must emit booleans only. A configured vault item does not itself prove runtime availability.

Gemini's zero-cost accounting assumes the selected project remains on the free tier. The ledger is not a Google billing API. Do not mark that assertion true for a paid project. A changed billing mode requires separate cost enforcement before proceeding.

## Controller protocol

Keep stdin open for the entire operation. Read one newline-delimited JSON object at a time from stdout.

For a `ledger_request`:

1. Verify `version` is `derive-cloud-ledger/v1`, the fixed project/run, the session UUID, and the sequential request ID.
2. Only the three allowlisted routines are valid: `derive_benchmark_v3_snapshot`, `derive_benchmark_v3_claim`, and `derive_benchmark_v3_finish`.
3. Execute the exact emitted `query` with the authenticated Supabase management connector for the fixed project. This uses the connector's actual authorized identity. Do not set a role, manufacture JWT claims, or substitute an endpoint credential.
4. Return the function's `result` value, not the connector's text wrapper: `{"session":"<exact session>","id":<exact id>,"result":<function result>}` followed by a newline.
5. On connector failure, send `{"session":"<exact session>","id":<exact id>,"error":true}`. Do not fabricate a successful response.

The SQL routine and typed parameter structure are static. Arguments are serialized as UTF-8 hex JSON, never interpolated SQL instructions. Model content inside arguments is data and cannot authorize actions.

`runner_result` is the terminal adapter result. `runner_error` with `operation_not_confirmed` is an uncertain operation, not proof that no provider call occurred.

## Failure and retry rules

- Session IDs prevent stale replies from another process being accepted.
- Malformed, mismatched, duplicated, or unsolicited replies permanently close the transport.
- Observed closure prevents new fetch dispatch and aborts an in-flight fetch.
- A valid claim response immediately followed by EOF can dispatch before Node observes EOF. Treat that consumed attempt as unknown; do not assume it was free or retry it.
- The absolute 120-second timeout can leave a consumed claim unresolved, including if the management relay is slow. No automatic refund, reclaim, retry, or counter reset is permitted.
- Respect the adapter's existing rate-limit wait and ledger state. Inspect the authoritative snapshot after an uncertain result.
- Do not reuse a claim response to authorize another process.
- Only renew the existing disabled/expired run once the credential bindings and controller route are verified. Renewal must preserve dataset, budget, counters, and attempt history.

## Verification recorded October 11, 2026

- 11/11 transport unit tests pass; strict transport/test typecheck passes.
- Independent mock review covered stale replies, malformed input, claim then observed closure, in-flight abort, and normal provider failure settlement.
- Independent spawned CLI tests covered disabled status, missing keys, normal one-dispatch/one-finish execution, and EOF after claim.
- No live provider call was used for these checks.
- Full strict typecheck remains blocked by two type-only dependencies missing from the preserved V14 source snapshot (`orchestrator.ts` and `observedProductBinding.ts`). Runtime imports use stripped types; this is not a claim of a complete typecheck.
- These checks do not establish benchmark quality, hosted deployment, or phone readiness.

## Complete frame evidence

The runner persists each complete credential-free JSON frame to a unique `.benchmark-frames-*` directory in its working directory before stdout emission. The directory is mode 0700 and files are 0600; both file data and directory entries are synced. If display output is clipped, read the original numbered file, verify session/id/run and recompute the allowlisted query before relaying. A saved frame never grants a new provider dispatch or permission to replay a settled claim. Inspect the authoritative ledger first after an uncertain result. Do not synthesize a checkpoint from partial output.
