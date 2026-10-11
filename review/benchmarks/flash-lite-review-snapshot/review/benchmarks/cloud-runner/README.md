# Fresh bounded V3 benchmark

Fixed run: 8a9afbe3-c677-4829-97f0-c81c655ccebd.
Project: snojlbqovlawewwqbviz.
Dataset hash: a8b2d46c9d530a5ba94a19611125e01a5696a21ed649059704107201f472aa46.

Five eligible synthetic cases each have decision/copy/review phases; cropped-label identity preflight has no provider phase. The full run uses Jev1.13.0 for decisions and Gemini3.5FlashLite for copyv7/reviewv9. This is isolated benchmark evidence, not a production model change.

Seed a NEW ledger run and its15 phase rows only after authorization. Bounds:15calls,100000microUSD,2hours,free Gemini confirmed. Preserve all old runs and claims; never renew/reset them. The runner cannot create or enable a run.

Set NODE_USE_ENV_PROXY=1. Start `node --experimental-strip-types review/benchmarks/cloud-runner/run.ts status` or `run_next` from this isolated snapshot. The control plane must service the scoped ledger RPC frames through its existing authorized management connector and return bounded frames on stdin. Never print keys. Do not use browser impersonation or new credentials.

Respect30second ledger pacing,90second leases,600second orchestration timeout; provider requests retain their separate45second limit. One provider dispatch per claim, no automatic retries. Durable private frame files precede stdout. Stop on ambiguous settlement; inspect retained frames and exact ledger state before any further dispatch. Unknown outcomes must remain explicit and charged, never silently replayed. No live-user data.
