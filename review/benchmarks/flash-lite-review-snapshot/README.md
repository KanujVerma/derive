# Review-policy calibration, current v7 baseline

Six frozen body-only controls test whether the reviewer distinguishes uncertainty-respecting advice from unsupported guarantees, attributed descriptions from comparative claims, and specific experiences from category generalizations. All other input, action, text and attached reference pools stay constant. These are authored calibration examples using an existing synthetic fixture, not held-out product performance evidence. Expected support labels are not sent to the provider.

Run calibration-probe.ts from review/benchmarks/cloud-runner once from the fixed snapshot root, after verifying 33 manifest hashes and 54 tests. Exclusive claim, at most six Flash Lite review calls, 25-second minimum start spacing, stop on the first transport/parse failure, no retries. Existing key/free project, MINIMAL thinking, 4096 tokens and 45 seconds per request. Calibration hash: 24e9299ab811e2e1cec648c0359721ceb9698ebdd6f07b5741c16d4cf6114490.

Report target-field false positives/negatives separately from contract failures, plus whether actual decision judgment stays stable across body-only changes. Retain raw bounded synthetic responses privately. Do not execute older probe entrypoints or rewrite prior results. No production model/policy switch or full benchmark claim.
