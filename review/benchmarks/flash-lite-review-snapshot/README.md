# Isolated Flash Lite review calibration

This snapshot is a bounded diagnostic, not production integration or a completed end-to-end benchmark.

Review v8 aligns the reviewer with the existing conditional cosmetic-trial policy and separates action validity from proposed-copy defects. Copy remains v7. Runtime admission checks and the six calibration controls are unchanged from v7.

The v7 baseline completed six parsed responses, with four correct target judgments, two false negatives, zero false positives, and inconsistent action judgments. The v8 comparison is pending; these are authored calibration controls, not held-out validation.

Verify all 33 files in SNAPSHOT_SHA256.json. Run the six test files plus runner tests using Node's TypeScript stripping. There are 54 focused tests.

Run only when authorized: NODE_USE_ENV_PROXY=1 node --experimental-strip-types review/benchmarks/cloud-runner/calibration-probe.ts

The runner claims .review-v8-calibration.claimed exclusively before dispatch, limits execution to six calls spaced at least 25 seconds, stops on transport or contract failure, and retains private synthetic-response frames plus .review-v8-calibration-result.json. Never remove consumed claims to rerun. Credentials must remain in the approved environment and must not be printed.

Frozen v8 request panel SHA256: b1131e6d41df277f6a312b6ee4ff3ee51e950af7461ec15beb70bb4b95b90370.
