# P0-C hosted free operations — readiness inventory

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
| Account deletion | Caller-token identity; exact confirmation; both private buckets inventoried, removed, verified empty, then Auth deletion. | Concurrent upload fencing and hosted deletion failure/retry acceptance. Existing implementation order must not be weakened. |
| Anonymous upgrade/conflict | Password signup/signin adapters exist. | No verified same-UUID anonymous linking workflow or explicit existing-account conflict flow was found in inspected Auth/account modules. Creating another account is not proof of guest preservation. |
| Retention/cleanup | Owner deletion exists. | No production guest inactivity retention policy, resumable Storage-first cleanup job, deletion lease or cleanup operational readback was found. Do not infer automatic expiry from Auth anonymity. |
| Operations | Existing tests cover local ownership/deletion boundaries. | Hosted rate/abuse alerts, retention execution, rollback drill and physical/customer acceptance. |

These findings supersede no canonical source and do not rebuild S-OPS-1 under a
second name. Historical Founding Beta password Auth is a different release path
from anonymous scanner-first activation; its disabled email-confirmation settings
must not silently become an approved public guest-upgrade policy.

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

## Required reviewed evidence before activation

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
7. Approved inactivity/retention policy and resumable cleanup dry-run. Exclude
   permanent/linked identities, recheck identity/activity immediately before
   deletion, serialize cleanup versus linking/new uploads, verify Storage first,
   retain only privacy-minimized job status, and alert/retry on failure.
8. Private model-provider purpose/terms/retention review before sending images.
9. Privacy-safe operational alerts plus rollback/recovery drill. No ingredient,
   profile, pregnancy, prescription, product-text, images, tokens or replay payloads.
10. P0-A physical and Kanuj-owned P0-D customer/release acceptance against the actual
    build; simulator/source tests cannot replace it.

## Architectural decisions requiring founder review

- **Retention duration and notice:** no default is chosen. Set product expectations
  and a defensible inactivity duration before introducing destructive cleanup.
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

Define the lifecycle/conflict contract and retention policy → lease shared Auth/
migration surfaces → isolated abuse and cleanup modules with failure/concurrency
tests → bounded client lifecycle integration with Kanuj → disposable local reset/
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
