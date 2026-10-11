# Bounded stronger-reviewer comparison

This is an isolated diagnostic, not a production model switch. The review v9 prompt and runtime gates match the Lite candidate. The model constant is gemini-3.8-flash so response decoding and review checkpoints truthfully bind to that model.

Inputs are frozen synthetic decision/copy checkpoints from run 8a9afbe3-c677-4829-97f0-c81c655ccebd. Three original problem packets and one corrected next-step control are reviewed. Expected field and branch labels stay outside requests. These are targeted known-failure comparisons, not held-out general quality validation.

Verify 28 hashes. Run tests/model-review-probe.test.ts, tests/review-citation-contract.test.ts and review/benchmarks/cloud-runner/*.test.ts. 38 focused tests passed before publication.

Only authorized entrypoint: NODE_USE_ENV_PROXY=1 node --experimental-strip-types review/benchmarks/cloud-runner/model-review-probe.ts

Maximum four calls, at least25 seconds between starts,45 second request deadline,4096 output tokens,32KiB request/64KiB response. First HTTP/contract/persistence failure stops the panel. No retries. Exclusive .review-v9-flash-comparison.claimed and durable private frames preserve execution. Do not delete or reset claims. Existing approved free-tier credentials only, never print their values.

Panel SHA256: bd839c39ccfe63ad70eca6ef7f09330eb9028516e97e12140fa90bcd99b39962.

Judge the irritation trigger inference, unsupported preference assertions, and the separately scoped retain/change branches. Contract-valid output is not proof of correctness. Preserve every failure and compare with recorded Lite reviews before considering any product integration.
