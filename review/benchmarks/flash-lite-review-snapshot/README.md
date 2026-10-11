# Isolated Flash Lite review diagnostics

Review v9 distinguishes empirical claims, justified decision language, and context-grounded neutral labels. Every field retains its audit, citation requirement and runtime admission checks. Copy remains v7. No production integration.

V7 body-panel baseline: 4/6 targets correct, 2 false negatives, 0 false positives, unstable actualSupported. V8 same-panel comparison: 6/6 targets correct, stable actualSupported, but no complete copy passed due to non-target headline/title/advice rejections. Both are preserved diagnostic runs, not full benchmark successes.

V9 introduces a separately frozen six-control field-role panel: neutral/deceptive titles, conditional/guaranteed recommendation headlines, observational/invented-regimen next steps. These are authored new calibration controls on the same underlying fixture, not broad held-out product validation. Results pending.

Verify all 36 SNAPSHOT_SHA256.json files, then run all tests/*.test.ts and review/benchmarks/cloud-runner/*.test.ts using Node TypeScript stripping. 57 focused tests.

Only authorized provider entrypoint for this phase:
NODE_USE_ENV_PROXY=1 node --experimental-strip-types review/benchmarks/cloud-runner/field-role-probe.ts

Six-call maximum, 25-second start spacing, 45-second timeout, strict budgets, exclusive .review-v9-field-role-calibration.claimed. Stop on first transport/contract failure. Do not remove or reset old claims. Preserve private frames and .review-v9-field-role-calibration-result.json. Never print credentials. Do not run other probe entrypoints.

Frozen field-role request panel hash: 55907dc7472abfbf838df2765b0e3eaa583071381e4154da7a9c6e30fdb3f226.
