# P0-C hosted rollout review — source-to-hosted checkpoint

**Status: BLOCKED; read-only review, not deployment approval.** At committed
`7d804bf0ac174b8816a5a83f465647c1d9387732` on 2026-09-28, the exact
project `snojlbqovlawewwqbviz` had 19 of 29 committed migration versions and
15 of 21 committed Edge Function names. There were no hosted-only names or
versions. The CLI's `db push --dry-run --skip-vault --project-ref
snojlbqovlawewwqbviz` printed the ten migrations below in this exact order;
it made no database change. The migration and function inventory scripts
independently produced the same drift. The readback does **not** compare hosted
SQL, function revisions, Auth configuration, deployed secrets, RLS behavior or
Storage state. Anonymous signup has not been approved for activation.

## Ordered migration review

| Order / version | Source change and prerequisite | Specific rollout check |
| --- | --- | --- |
| 1 / `20260923180000` | Guest identity boundary: nullable profile email, a narrow blank-email cleanup for anonymous users, replacement Auth/profile and managed-membership functions, and tighter direct product SELECT policy. Requires historical Auth trigger, membership, beta flag, products and Shelf objects. | Confirm actual hosted trigger and grants before replacement; verify permanent Managed members retain their product/Shelf read while guests cannot read raw product facts or claim beta membership. Count affected blank anonymous emails before applying. |
| 2 / `20260923235000` | Creates service-only free skin profile with categorical constraints and owner RLS. Requires `profiles` and `private.set_updated_at`. | Guest and permanent owner CRUD only through the JWT-gated function; raw profile/sensitivities denied through Data API. |
| 3 / `20260924010000` | Creates free saved products, explicit Check history, experiences, owner-case trigger, indexes and service-only grants. Requires profiles, catalog products and S6 resolution cases. | Check an unresolved/other-owner case cannot be saved as the customer's case; verify account-delete cascade and no direct sensitive-note reads. |
| 4 / `20260924020000` | Creates service-issued, owner/request-bound free photo grants with six grants per rolling 24 hours and a private Storage INSERT policy. Requires free identity and the existing private product-evidence bucket. | Verify guest/other-owner denial, immutable path, MIME/size, replay/conflict, quota, and absence of public read/list. Six upload grants are **not** three customer-visible Checks. |
| 5 / `20260925140000` | Expands the founder-operation constraint and adds a service-only manual routine draft RPC. Requires existing founder log, active-membership and routine functions. | Inspect existing operation values and constraint name before replacement; ensure only a permanent active Managed member can receive a manual draft and that a guest gets no entitlement. |
| 6 / `20260926233621` | Adds immutable personal-context heads/revisions, owner-bound assessment records and service-only read/write/persist RPCs. Reads legacy free tables from steps 2–3. | Verify aggregate revision/idempotency, owner/cross-owner denial, corrections and no raw context exposure. No legacy backfill may invent missing facts. |
| 7 / `20260927003158` | Replaces assessment persistence RPC with expected-context-revision guard. Requires step 6. | Concurrent context change must fail `STALE_CONTEXT`; an exact replay remains stable. Do not expose step 6's older RPC as the final hosted state. |
| 8 / `20260927010000` | Adds immutable owner-bound ProductTruthSnapshot records and S6 case-review triggers. Requires existing product/variant/formula/evidence/case schema. | Review trigger behavior on existing case updates; verify old and reviewed snapshots, owner reads, formula/variant provenance and deletion cascade. No image or candidate becomes verified formula truth. |
| 9 / `20260927021000` | Raises finite assessment input/packet byte budgets for legitimate large P0-B results. Requires step 6's named constraints. | Check actual hosted constraint names and test a supported large result without unbounded payload growth. |
| 10 / `20260928000000` | Adds a durable deletion marker plus a restrictive INSERT fence on both private buckets, sharing a transaction lock with deletion-start RPC. Requires existing account deletion and Storage policies. | Test in-flight ordering, both buckets, remove/list/Auth failures and retry; marker stays set on failure. Confirm future inserts cannot bypass the restrictive policy. This does not prove an upload already in flight before its DB INSERT. |

The changes are not a zero-risk "add tables" batch: step 1 changes existing
profile/product access and Auth behavior; step 5 replaces a live constraint;
step 8 installs case-update triggers; step 10 deliberately makes failed account
deletion block further private uploads until a successful retry. A source-only
reset cannot establish the hosted data/backfill or operational result. Review
those four boundaries against a sanitized hosted schema/data inventory and a
disposable-user drill before applying anything. Never repair migration history
manually to make the version table appear current.

## Functions and deployment sequencing

The six missing names are `access-state`, `free-context`, `free-personal-fit`,
`personal-context`, `personal-decision`, and
`prepare-free-product-evidence`. `free-personal-fit` requires steps 2–3;
`free-context` requires step 3; evidence preparation requires step 4;
`personal-context` and `personal-decision` require steps 6–9. All must be
deployed from the same reviewed source tree **after** their migrations, before
any guest client is enabled. Existing hosted functions also need exact revision
review: a matching name does not prove current behavior. In particular,
`delete-customer-account` must be updated alongside step 10 or the new fence
is not used by the deletion path. `personal-decision` declares gateway
`verify_jwt = false` in source but manually calls the shared token authenticator;
its denial and authenticated-owner behavior must be tested in the actual hosted
deployment, not inferred from the config flag. Do not deploy Stripe functions or
enable billing as part of this free rollout.

## Go/no-go and recovery

1. Freeze the exact clean source commit, record the dry-run list and a sanitized
   backup/recovery reference. Obtain the required founder/operations approval for
   hosted changes. Reconcile any new migrations or functions from main before
   deployment; this checkpoint becomes historical as soon as main advances.
2. Re-run a fresh **local** all-migration reset, pgTAP and integration tests from
   that commit. Run hosted read-only schema/constraint/policy/trigger and function
   revision readbacks. Confirm Auth flags, challenge/rate behavior and provider
   configuration through least-privilege readback; the Auth result is currently
   `UNKNOWN` because the read token is unavailable.
3. Review the pending SQL and dry-run again against the exact project. Apply
   only through a single migration writer and observe each step. Additive
   forward fixes are preferred to editing applied files or removing the
   migration ledger. Stop on any unexpected version, drift or failed assertion.
4. Deploy the reviewed non-Stripe functions and current revisions in a
   coordinated window. Test existing permanent Managed behavior as well as
   disposable guest/owner isolation and deletion. Keep anonymous signup and
   public scanner-first routing off until the entire hosted/physical/release
   acceptance packet passes. If a deployment fails, leave activation off and
   use the pre-reviewed recovery plan; do not assume schema rollback is safe.

**Unresolved founder/release choices:** public guest retention/lost-device
recovery, first-release audience, and whether the final candidate is Free-only
or includes a real Plus benefit. The temporary closed-beta retain-until-delete
choice is not a public policy. Kanuj owns the binary/customer acceptance and
source routing. This review changes no hosted setting, migration, function,
customer data, billing or release configuration.
