# P0-C hosted free operations — readiness inventory

The current exact-project migration/function drift and ordered SQL review are
recorded in [the hosted rollout review](P0_C_HOSTED_ROLLOUT_REVIEW.md). It is a
read-only checkpoint and does not approve deployment or guest activation.

## App Store scanner release target (2026-09-27 update)

The founder has now specified a **scanner-first App Store release**, not merely
the temporary closed beta described in historical sections below. The approved
first release remains free-only; no $4.99 checkout or Managed purchase activation
is implied. The closed-beta decision to retain guest data until user deletion
was explicitly temporary, so it does **not** settle public-release retention,
privacy notice, or lost-device recovery. Kanuj owns the release binary/customer
acceptance; Sami owns this hosted lifecycle boundary. Neither lane can call the
App Store release ready from source tests alone.

This increment adds `20260928000000_p0c_account_deletion_upload_fence.sql` and
updates `delete-customer-account`: a server-only, durable deletion marker is set
before either private bucket is inventoried. Customer INSERT checks for both
private buckets are restrictive and share a transaction-scoped lock with that
transition. A failed cleanup leaves the marker set, allowing a retry without
reopening uploads; successful Auth deletion cascades the marker away. Existing
Storage-first removal, empty-namespace verification, and Auth-last order remain.
The local proof includes a fresh all-migration reset, full pgTAP, real free
Storage upload/rejection/deletion, a deterministic two-transaction ordering
test, all 85 application test files, both TypeScript checks, and web/iOS
JavaScript exports. This does not prove a provider-side upload already in
flight before its database INSERT, hosted deployment, or failure/retry behavior
under network faults. Review the hosted Storage implementation and run a
disposable hosted race/failure drill before claiming that broader guarantee.

A later, separate local regression now exercises a guest with 101 private skin
photos in one paginated folder, a nested skin photo, and private product
evidence. A deliberately inconsistent service-authored photo metadata path
first makes deletion fail closed: Auth and files remain, the upload fence stays
set, and a neighboring guest is untouched. After removing only that synthetic
bad row, retry removes both private namespaces and the guest Auth user while
preserving the neighbor. CI runs this disposable local drill after a fresh
database reset; it is not a hosted failure-injection or provider-network race
proof. If the drill itself fails, its cleanup attempts only its generated local
identities and warns if a synthetic fixture must be retained for diagnosis.

Before the App Store build can point at hosted scanner-first runtime, the
remaining gates include: reconcile all unapplied hosted migrations and missing
functions in reviewed order; verify Auth abuse/rate controls; finish guest
identity upgrade/existing-account warning and retention/recovery policy; verify
private-photo deletion and owner isolation on hosted; provide a useful, honest
scanner result/fallback on physical devices; and complete Kanuj-owned binary,
privacy/support, and App Store acceptance. Do not enable hosted anonymous Auth
or submit a release based on this isolated migration alone.

## Scope and actual state

Sami owns P0-C under the explicit portfolio brief. This increment audits existing
S-OPS-1 boundaries and adds a privacy-safe, offline source preflight. It does not
activate guest signup, change Auth/RLS/Storage, migrate data, implement cleanup,
change billing, or claim external-beta readiness.

Initial inspected base: `465173e` (camera recovery branch reconciled with canonical
`22a210a7a720c9621d45e789b8690dcc73ab059a`); this branch then fast-forwarded to
`be853d2` after #95/#99 merged. Local implementation evidence is not
hosted evidence. No hosted dashboard, Management API, database, credentials or
customer data was inspected in this increment. The exact intended hosted project
remains `snojlbqovlawewwqbviz`.

## Implementation audit, not a new Auth stack

| Boundary | Implemented source | What remains unproved/unimplemented |
| --- | --- | --- |
| Guest startup | `authClient.ensureLocalAnonymousSession` preserves an existing session and single-flights local guest creation. `shellPresentation` confines free integration to Development and exact local/approved LAN hosts. | Hosted scanner-first startup, challenges, signup limits, public guest activation. |
| Identity/access | Verified Auth `is_anonymous` controls identity kind; `access-state` grants managed access only to permanent active members. | Exact hosted deployed revision/config and least-privilege readback. |
| Owner isolation | Auth UUID switches purge client caches; P0-B composition separately fences owner/revision responses. | Physical session-loss, refresh, account-switch and A→B→A acceptance against hosted deployment. |
| Photo resource control | Service-only grant RPC serializes owner quota/replay; six issued upload grants per rolling 24 hours; private immutable owner paths. | This is **not** a semantic Check allowance or signup-wide/IP/device abuse defense. Search/barcode do not share that upload quota. |
| Account deletion | Caller-token identity; exact confirmation; server-only deletion marker and restrictive private-upload fence; both private buckets inventoried, removed, verified empty, then Auth deletion. | Hosted deletion failure/retry and provider-side in-flight-upload acceptance. Existing implementation order must not be weakened. |
| Anonymous upgrade/conflict | Password signup/signin adapters and a fail-closed ordinary Auth replacement guard exist. | No verified same-UUID anonymous linking or customer warning/confirmation flow. Creating another account is not proof of guest preservation. |
| Retention/cleanup | Owner deletion exists. | No production guest inactivity retention policy, resumable Storage-first cleanup job, deletion lease or cleanup operational readback was found. Do not infer automatic expiry from Auth anonymity. |
| Operations | Existing tests cover local ownership/deletion boundaries. | Hosted rate/abuse alerts, retention execution, rollback drill and physical/customer acceptance. |

These findings supersede no canonical source and do not rebuild S-OPS-1 under a
second name. Historical Founding Beta password Auth is a different release path
from anonymous scanner-first activation; its disabled email-confirmation settings
must not silently become an approved public guest-upgrade policy.

### Guest transition guard after the inventory checkpoint

The ordinary password signup/signin and legacy email-code paths now check the
provider's current session before invoking an Auth call that could replace it.
If `user.is_anonymous === true`, sign-in/code verification is blocked with
`GUEST_SESSION_ACTIVE`; ordinary sign-up is blocked with
`GUEST_UPGRADE_REQUIRED`. Unknown identity or failed session lookup blocks with
`CURRENT_SESSION_UNKNOWN`. These typed, customer-safe failures leave the current
guest session and client stores intact. A confirmed permanent identity or no
current session keeps the previous behavior. This is a **fail-closed guard**, not
an account-conversion feature: no warning/confirmation UI, same-UUID linking,
email delivery, existing-account transition or concurrency acceptance is claimed.
The initial hosted activation remains blocked until the chosen beta account
policy and corresponding physical flow are verified.

## Read-only preflight

From the repository root:

```sh
node scripts/preflight-hosted-free-readiness.mjs
```

The tool reads eight fixed repository-source files, obtains the Git head and
checks whether those inspected files differ from that head using fixed read-only
commands. It never reads `.env` or process configuration, contacts
Supabase, sends telemetry, prints raw source/errors, or changes anything. Output
contains static shape markers, not customers, tokens, emails, object paths or
provider credentials. Missing, oversized or unreadable files produce `UNKNOWN`;
changed markers produce `STATIC_NOT_CONFIRMED`.

`STATIC_PRESENT` means only that expected markers were found. Markers can occur
in comments and do not prove execution, order, security enforcement or deployed
behavior. Existing focused runtime/RLS tests remain necessary. The local TOML
anonymous setting never implies the hosted setting. Every hosted gate stays
`UNKNOWN` without a separately reviewed exact-project readback. The tool
intentionally exits **2** and reports activation **BLOCKED**, even if every local
shape is present. It is an inventory aid, not a release authority or enable switch.

### Exact-project function-name readback (2026-09-27)

Run `node scripts/readback-hosted-function-inventory.mjs` from the repository root
with an authenticated Supabase CLI. This second, read-only check compares the
committed `HEAD` function entrypoints with the names returned by `supabase
functions list --project-ref snojlbqovlawewwqbviz --output json`. The project
reference is fixed in the script. It prints only the source revision, counts and
function names; raw CLI output/errors, credentials and customer data are not
printed. Missing, malformed or duplicate inventories fail closed with exit 2.
Name parity exits 0 for this **one inventory only**, but activation still reports
`BLOCKED`: names cannot prove deployed code revisions, configuration, JWT
enforcement, migrations, Auth settings, RLS or physical acceptance.

At source `3e641c550058e13fe1fe64adc31dbe67a64d0e10`, the exact hosted project
reported **15** functions versus **21** committed entrypoints. Six were missing
hosted: `access-state`, `free-context`, `free-personal-fit`, `personal-context`,
`personal-decision` and `prepare-free-product-evidence`; there were no unexpected
hosted names. This is a point-in-time name inventory, not a deployment request
or a full hosted migration/function revision readback. No hosted change was made.

### Exact-project migration-version readback (2026-09-27)

Run `node scripts/readback-hosted-migration-inventory.mjs` from the repository
root with an authenticated Supabase CLI. This read-only check compares the
committed `HEAD` SQL migration **versions** with `supabase migration list
--project-ref snojlbqovlawewwqbviz --output-format json`. It also compares the
CLI's local-version inventory with committed source, so an uncommitted migration
cannot silently look like a clean match. It prints only the source revision,
counts and version numbers. Raw CLI output, errors, credentials and customer
data are not printed. Missing/malformed/duplicate inventories fail closed with
exit 2. Version parity exits 0 for this **one inventory only**; it does not
verify migration SQL contents, applied schema/RLS, function revisions, Auth
configuration, physical acceptance or activation readiness.

At source `98d2ba379b7cf36607b1bce349c03db293500947`, the exact hosted
project reported **19 applied** versions versus **28 committed** migrations.
The following nine committed migrations have not been applied hosted:
`20260923180000`, `20260923235000`, `20260924010000`, `20260924020000`,
`20260925140000`, `20260926233621`, `20260927003158`, `20260927010000`, and
`20260927021000`. No hosted-only version appeared. This is a point-in-time
readback, not a request or authorization to push those migrations. The free
identity/profile/history/evidence migrations are among the missing versions,
so enabling hosted guests now would create a mixed deployment.

### Exact-project Auth setting readback (2026-09-28)

`node scripts/readback-hosted-auth-config.mjs` makes one read-only Management API
GET for `snojlbqovlawewwqbviz`. It requires a Supabase Management API token
with `auth_config_read` permission in the process environment as
`SUPABASE_ACCESS_TOKEN`; do **not** put that token in `.env.local`, the app,
commits, command arguments or screenshots. A project publishable key is not a
Management API token. The API's response may contain SMTP/CAPTCHA/provider
secrets, so the script only emits the anonymous-signup flag, global signup flag,
anonymous hourly IP limit and CAPTCHA enabled/provider state. Unknown providers
are printed as `UNKNOWN`, not raw text. Errors and malformed or oversized
responses emit only a sanitized `UNKNOWN`/`BLOCKED` result and exit 2.

This check does not change a dashboard setting, create a guest, verify a real
challenge, test IP limits, prove endpoint abuse resistance, or authorize a
release. Observed settings leave activation `BLOCKED` even if anonymous Auth is
already enabled. At this checkpoint no read token was available, so the actual
hosted Auth settings remain **unknown**. The founder selected barcode/name search
for the first App Store release; do not treat the preliminary Mac OCR diagnostic
or package-photo capture as product recognition in that build.

## Required reviewed evidence before activation

For the initial closed scanner-first beta, the founder chose **free-only**:
do not enable the proposed $4.99 checkout or Managed purchase path as part of
this activation. This pricing decision does not weaken the hosted identity,
rate, privacy, deletion or physical acceptance gates below.

Record revision, project, date, reviewer, sanitized artifact reference and actual
observed result per gate. Store secrets/customer identifiers outside public docs;
use disposable identities and opaque case labels in acceptance records. A boolean
assertion or screenshot of a dashboard switch alone does not prove the control.

1. Exact hosted migration/function/source readback; no unapplied migration or
   mixed deployment. Anonymous signup remains disabled until the complete review.
2. Signup abuse/rate controls and challenge experience, including denied,
   unavailable and retry outcomes. Endpoint resource limits and alerts separately.
3. Real guest, permanent-free and managed identities: cross-owner denial, direct
   raw truth/RPC denial, managed denial, private immutable Storage and no public reads.
4. Same-identity upgrade preserves its UUID/data. Existing-account signin keeps
   that account and **does not auto-merge guest data**. Warn before abandoning the
   guest session; do not promise recovery after the guest credentials are lost.
5. Session loss, reinstall, token refresh, foreground/retry and A→B→A response
   fencing: no stale owner's private result or context returns.
6. Deletion tests with both private buckets, unreferenced uploads, pagination,
   injected removal/list failure and retry. Fence new writes during deletion and
   prove Storage empty before Auth removal. Signed URL expiry is not immediate
   revocation; existing maximum 15-minute exposure must be explained accurately.
7. For the closed beta, disclose the approved **no automatic inactivity
   cleanup** policy and verify customer-requested Storage-first deletion. Before
   introducing any later automatic cleanup, approve a retention duration and
   notice, then require a resumable dry-run: exclude permanent/linked identities,
   recheck identity/activity immediately before deletion, serialize cleanup
   versus linking/new uploads, verify Storage first, minimize job status, and
   alert/retry on failure.
8. Private model-provider purpose/terms/retention review before sending images.
9. Privacy-safe operational alerts plus rollback/recovery drill. No ingredient,
   profile, pregnancy, prescription, product-text, images, tokens or replay payloads.
10. P0-A physical and Kanuj-owned P0-D customer/release acceptance against the actual
    build; simulator/source tests cannot replace it.

## Architectural decisions requiring founder review

- **Closed-beta retention:** founder approved keeping guest data until the user
  deletes it during this temporary closed-beta phase. No inactivity-cleanup job
  will run in this phase. This is not an indefinite retention commitment;
  customer-facing notice must reflect actual behavior, and a new policy decision
  is required before a broader launch or automated cleanup. Customer-initiated
  Storage-first deletion remains required.
- **Cleanup/upgrade/delete concurrency:** use a reviewed identity/lifecycle fence,
  not a bulk `delete auth.users` sweep. Auth deletion before Storage verification
  would orphan private evidence and is prohibited.
- **Existing account:** founder decision is already settled: keep existing data,
  no automatic guest merge. Warning, cancellation and loss/recovery behavior still
  need implementation and acceptance; no new merge engine is justified.
- **Abuse economics:** six photo grants is resource control, not “three Checks per
  day,” and cannot prevent disposable-identity cycling. Choose signup/challenge and
  endpoint defenses based on operational evidence without unnecessary tracking.
- **Activation:** one coordinated Auth/runtime/config writer, reviewed exact
  hosted rollout and rollback only after all gates; no silent hosted activation
  from this preflight or a green camera/provider PR.

## Safe next implementation sequence

Define the lifecycle/conflict contract and public-release notice → lease shared
Auth/migration surfaces → isolated signup/endpoint abuse controls and
hosted deletion-fence failure/race drill → bounded client lifecycle
integration with Kanuj → disposable local reset/
pgTAP/integration → exact-head CI → reviewed hosted dry-run/readback → actual
physical/customer acceptance → explicit coordinated activation.

Camera, provider benchmarking and catalog contribution work may continue in
parallel. None requires enabling hosted guests early.

## Increment validation

At reconciled base `be853d2` plus this three-file increment: seven focused
preflight tests pass; full `npm test` passes all 67 test files (51 TAP-reporting
files, 597 registered TAP tests, zero failures; assertion-style files also run).
Application/tests TypeScript and web/iOS JavaScript exports pass. No environment
files were loaded into the export. This is offline tooling/source evidence, not
new RLS, hosted security, cleanup execution or physical acceptance evidence.
Exact-head CI remains the portfolio orchestrator's pre-merge gate.

### Reconciliation checkpoint: `24529ae`

Reconciled onto canonical `24529aeb8125d82085f5e3ccad8cb0513c145bb5` without
conflicts. The eight inspected source files are unchanged at this checkpoint;
the preflight still reports all 12 hosted gates `UNKNOWN` and activation `BLOCKED`.
Kanuj's P0-D account changes add reachable legal links, not anonymous linking or
an existing-account conflict warning. His separate
[P0-D acceptance](P0_D_ACCEPTANCE.md) owns integrated customer/release evidence;
this source inventory does not replace it.

Fresh validation passes all 75 current test files (57 TAP-reporting files,
627 registered TAP tests, zero failures; assertion-style files also run), both
TypeScript checks, web/iOS exports and scope/diff checks. No hosted setting,
runtime, schema, rate limit, cleanup job or privacy invariant was changed.

### Latest reconciliation: `4b71bdd`

Reconciled without conflicts onto canonical
`4b71bdd39b06dd396ebecda6bfa2ba7f61dab3a0`, preserving the merged offline
perception benchmark, catalog proposal foundation, smart camera and Kanuj work.
Fresh full validation passes all 77 current test files (59 TAP-reporting files,
653 registered TAP tests, zero failures; assertion-style files also run), both
TypeScript checks, web/iOS exports and diff/scope checks. The earlier checkpoints
above remain historical evidence rather than current test counts.

All eight inspected source files remain unchanged and match the reconciled head.
All 12 hosted gates remain `UNKNOWN`; activation remains `BLOCKED`. This pass
changes no runtime, hosted setting, schema, security control or cleanup behavior.
Exact-head CI is still required before merge.
