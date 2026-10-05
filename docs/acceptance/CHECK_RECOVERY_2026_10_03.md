# Check recovery correction — 2026-10-03

Separate correction branch `kanuj/check-workflow-recovery-fixes` starts from accepted workflow `67675d44d59c202ba652cf16fe4f1638398ae70d`. The accepted checkpoint, dirty main, phone snapshot and concurrent Part3 work remain preserved. This is local implementation and verification; no push, merge or deployment.

## Changes

Both P1/P2 Edge entrypoints and the supervised public-name gateway share Auth failure classification. Actual SDK network/deadline errors, throttling, upstream5xx and unknown failures return `503 auth_unavailable`; explicit401/403 and missing sessions remain denied. Failed authentication assigns no owner and performs no owner RPC. Retry validates Auth again.

The new migration replaces the three accepted P1 worker/P2 resolver/P2 publication functions. Only elapsed lease checks/deadlines use wall time captured after relevant lifecycle/row locks. Owner/deletion, source rights, context digest, token/revision fences, grants, global lock order, evidence expiry, budgets and retry cadence retain their existing semantics. No fault hooks are included in product code.

Eight previously passing UI tests crossed their fixed evidence fixture expiry at 10:00 UTC during this run. Two test files now freeze Date at their declared fixture time; assertions and production expiry behavior are unchanged.

## Validation

- Application suite: 1,381/1,381 tests, including21 actual installed Supabase SDK regressions for both handlers, genuine401/403,429/5xx, network rejection, stalled headers/body deadlines, cancellation, zero owner operations and retry.
- Application and test TypeScript: zero errors. iOS/web exports pass. Existing unchanged native host rebuilt with Xcode successfully; correction JavaScript served from this branch over task-only loopback.
- Fresh migration replay: Supabase `db reset --db-url` against separate empty `derive_check_recovery_clean` in the task's own PostgreSQL container;35 files/1,042 assertions pass. Infrastructure-only schema initialization excluded all app data, app Auth triggers and app Storage policies; repository migrations recreated those boundaries. Active product evidence was not reset.
- Actual two-session SQL lifecycle:34 assertions pass, including a32-second delayed claim returning a fresh30-second lease, forced post-expiry renewal/publication refusal, reclaim/stale token, monotonic revision, singleflight, source rights/retraction, deletion and service-only fences. All four accepted-definition controls reproduce the targeted clock failures. Fixtures, test sessions and temporary pgTAP setup roll back; corrected functions remain.
- Actual local Auth service outage: P1 and P2 return503 with `auth_unavailable`; normalized owner-RPC count stays1121→1121. Own Auth service automatically restores; same synthetic session returns200 complete/ready. Missing-session requests return401 and actual malformed-session Auth refusals return403 on both endpoints. Normal native Check shows its existing unavailable/Retry state and recovers after Retry.

## Product and performance evidence

Normal native Check typed `cerave schuimende reinigingsgel`. Genuine Open Beauty Facts name lookup returned236ml Netherlands,474ml Netherlands/Ukraine and refill variants. Selecting236ml resolved GTIN3337875597197, source image and28 source-listed ingredient rows in the existing shared sheet. Normal native Check also typed barcode `3337875597197` through the same resolver, opened the existing Glycerin reference-role detail and saved through the normal Save product action and reopened the newest My Stuff save with28 ingredient rows. Save `86fff928-a8e4-4e39-8fbf-d7491aadf8f4`, scan `a9bec85b-0275-445f-b93e-5701f9b5a327`, snapshot-at-save `830a110f-f3d0-42b6-9d47-c19ad6d50ffc`. Image hotlink and ingredient wording remain attributed public source evidence; list is partial, package unconfirmed, personal fit unavailable. Synthetic test fixtures and the20-identity local normalization dictionary are not public catalog/formula verification.

Name candidates appeared in5.690s on this new live public query. Uncontended selected-variant reopen reached identity/image/ingredients in701/758/1110ms; the explicitly typed barcode reached657/714/1054ms. These barcode results use retained real public evidence. Five uncontended warm local HTTP pairs measured P1 48.839–76.582ms and P2 92.724–118.519ms; raw receipts preserve each sample. Immediately restarting own Edge runtime produced an initial502 and five further not-ready502 attempts; these are excluded from warm samples. Subsequent successful recovery measured181.183ms P1 and162.007ms P2; this is local restart recovery, not a production cold-start guarantee.

A name selection overlapped the intentional32-second SQL lock test and reached P2 ingredients at35.209s. It demonstrates controlled-contention recovery, not an uncontended sample. The outage/retry UI sequence's timer includes the operator's deliberate wait before pressing Retry and is excluded from latency comparisons.

The historical40.716-second readiness delay remains unexplained. These source-backed corrections and controlled experiments do not establish its original cause or a general performance guarantee. Existing original workflow acceptance receipts (no-match, missing fields, stale responses, close/back, local OCR correction and save/reopen) remain pinned to accepted67675d44; the correction changes no UI layout or capture permissions. General physical-camera/hosted/Android/production corpus/right/release and remote exact-head CI gates remain open.

Immutable source, diff, tests, actual SQL/Auth receipts, native screenshots and exact final commit identity are published as separate readable Library artifacts after final verification.
