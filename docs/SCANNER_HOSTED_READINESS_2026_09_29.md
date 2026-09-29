# Scanner hosted readiness — 2026-09-29

Status: **NOT RELEASE READY. Read-only inventory, not authorization to deploy or activate.**

Reviewed source: `3228830d598b0f6194e0751316ef3ecaa16d66b5` (main after #174).
Exact hosted project: `snojlbqovlawewwqbviz`. Completed receipt: 2026-09-29 21:33 UTC.
Scope is scanner-only. Plus #180 is parked/default-off and is excluded from this rollout.
No hosted SQL, functions, Auth, SMTP, customer accounts, or payment configuration was changed.

## What is actually hosted

| Boundary | Observed result | What this does not prove |
| --- | --- | --- |
| Migration ledger | 19 hosted / 35 committed source versions; no hosted-only versions; local CLI inventory matches HEAD. | Hosted SQL, grants, triggers and constraints match source. |
| Edge names | 15 hosted / 24 source; no hosted-only names. | Existing function bundles contain current code. |
| Catalog | 1 catalog-standard product; 0 catalog variants, identifiers and formulas. | Useful scan hit rate for target customers. |
| Anonymous Auth | Remote `enable_anonymous_sign_ins=false`, directly observed in CLI config diff. | Permanent signup, confirmations, SMTP delivery or physical login. |
| Permanent Auth / email | Direct hosted `GET /auth/v1/settings` HTTP 200: `disable_signup=false`, `mailer_autoconfirm=true`, `external.email=true`, `external.anonymous_users=false`. Thus signup enabled, Confirm Email OFF, email provider enabled, anonymous disabled. Dashboard modal also shows OTP 6/3600 seconds and minimum password 6. Custom SMTP, template body and email delivery remain UNKNOWN. | Existing auto-confirm is not verified email ownership, and does not prove password recovery delivery. |
| Server key names | `GEMINI_API_KEY` and `JEV_API_KEY` present in secret-name inventory. Values/digests omitted. | Key validity, provider reliability or scanner dependence on AI. |

The read-only Chrome fallback reached the signed-in Auth Providers Email modal;
Save was disabled. A ScreenCaptureKit error temporarily interrupted readback, and
the user was actively changing the browser, so inspection stopped without fighting
their controls. The later direct public Auth settings read established the signup and
confirmation values without using the Management API token or browser. SMTP was not
observed. No setting was changed. [Official Auth settings source](https://github.com/supabase/auth/blob/master/internal/api/settings.go)
defines the returned fields and the inverse Confirm Email/autoconfirm relationship.
The Supabase team-only default sender is not a production mail solution: it sends only
to organization members and is capped at two messages/hour. This is a documented
conditional risk, **not a claim that this project has no custom sender**.
[Official SMTP documentation](https://supabase.com/docs/guides/auth/auth-smtp).

The source `access-state` grants `freeProductAccess=true` to both permanent and guest
verified identities without granting Managed membership. Current catalog/name search,
free context and personal decision authenticate owners without requiring Managed.
The scan resolver permits consumer `scan` without membership; Managed `shelf` remains
entitlement-gated. These current free-access function revisions are not yet proven
on hosted. Root is handling the separate signed-build scanner routing issue; this
inventory does not change client routing or turn on anonymous signup.

## Ordered migration delta

The hosted ledger currently ends at `20260922230123_product_catalog_ingest`.
Apply none until a refreshed exact-tree dry-run, schema review and backup/recovery
plan are accepted. Do not repair the ledger or skip historical migrations to fake parity.

1. `20260923180000_s_free_1_identity_boundary.sql`
2. `20260923235000_s_free_2_profile_fit.sql`
3. `20260924010000_s_free_3_context_history.sql`
4. `20260924020000_s_free_4_product_evidence.sql`
5. `20260925140000_s_paid_1_manual_routine_draft.sql`
6. `20260926233621_p0b_personal_context_revisions.sql`
7. `20260927003158_p0b_assessment_context_revision_guard.sql`
8. `20260927010000_p0a_product_truth_snapshots.sql`
9. `20260927021000_p0b_assessment_packet_budget.sql`
10. `20260928000000_p0c_account_deletion_upload_fence.sql`
11. `20260928010000_catalog_contribution_runtime.sql`
12. `20260928020000_product_measurement_ingress.sql`
13. `20260929040000_managed_waitlist.sql`
14. `20260929050000_external_candidate_lookup_budget.sql`
15. `20260929060000_indexed_product_identity_lookup.sql`
16. `20260929070000_product_check_ingredient_continuation.sql` (#174 now merged)

The earlier [P0-C rollout review](P0_C_HOSTED_ROLLOUT_REVIEW.md) details the high-risk
Auth/profile trigger, raw-product read policy, founder-operation constraint,
truth-snapshot trigger and deletion-upload fence boundaries. These are not all
simple additive tables. Existing Managed behavior must remain intact even though
Managed and Plus purchase are out of this scanner launch.

The new candidate budget (#161) caps Open Beauty Facts at 12 requests/minute
globally, not 60. That budget is not the promised customer-visible daily Check
quota. Source preparation/photo grant/assessment/provider limits remain distinct.

## Functions and pending composition

Missing source names: `access-state`, `catalog-contribution`,
`external-product-candidates`, `free-context`, `free-personal-fit`,
`personal-context`, `personal-decision`, `prepare-free-product-evidence`,
`product-measurement`.

For the bounded Check/My Stuff path, deploy reviewed revisions after migrations:
`access-state`, `catalog-products`, `resolve-product-identity`, `free-context`,
`free-personal-fit`, `personal-context`, `personal-decision`, and
`delete-customer-account`. Evidence preparation/contribution are conditional on
exposing those UI paths; measurement remains off unless separately accepted.
`external-product-candidates` is default-off unless
`DERIVE_OBF_CANDIDATES_ENABLED=true`; that name was absent from the hosted secret
inventory. Do not enable it as a shortcut around provider-license review.

`personal-decision` intentionally has gateway `verify_jwt=false` in source and
authenticates the token inside the function. Honor each reviewed function's config;
never globally use `--no-verify-jwt`. Test actual gateway/manual denial paths.

Pending at this checkpoint (refresh before preparing the release tree):

- #177 link intake: adds `resolve-product-link`, separate owner-bound client helper;
  requires the candidate budget migration and reviewed server URL/provider gates.
- #179 indexed ingredient candidates: migration `20260929090000`; does not become
  live ingredient continuation until the resolver actually composes its adapter.
- #175 category facts: migration `20260929080000` plus its function; include only
  if accepted into the final source tree. No fabricated category/water-resistance facts.
- Root client composition: signed release routing, profile-before-Check, actual
  permanent-account authentication, and scanner/indexed/link integration.

Existing function-name parity must not conceal an old resolver/delete function.
Review final function bundle/config readback and hosted owner-bound smoke separately.

## Executable operator sequence

These commands are a plan for the root operator. The inventory script never
executes a deployment/apply/config write. Run from the **final clean release tree**,
not this historical checkpoint; record its exact SHA and exact-head green CI.

```sh
git status --short
git rev-parse HEAD
node --test scripts/readback-scanner-hosted-readiness.test.mjs
node scripts/readback-scanner-hosted-readiness.mjs --read-only
supabase db push --dry-run --skip-vault --project-ref snojlbqovlawewwqbviz
```

Stop if inventory is UNKNOWN, ledger has unexpected versions, dry-run omits required
migrations, source is dirty, CI is not exact-head green, or actual SQL/grants/RLS
review is incomplete. CLI v2.117.0 supports `migration list --project-ref`,
`config diff`, `config pull --dry-run` and `db push --dry-run --skip-vault`.
Never `config push` a development config into hosted.

After root's separate apply authorization, preserve a recoverable backup/schema
receipt and confirm known mutation boundaries first. Then:

```sh
supabase db push --skip-vault --project-ref snojlbqovlawewwqbviz
node scripts/readback-hosted-migration-inventory.mjs
supabase functions deploy access-state --project-ref snojlbqovlawewwqbviz
supabase functions deploy catalog-products --project-ref snojlbqovlawewwqbviz
supabase functions deploy resolve-product-identity --project-ref snojlbqovlawewwqbviz
supabase functions deploy free-context --project-ref snojlbqovlawewwqbviz
supabase functions deploy free-personal-fit --project-ref snojlbqovlawewwqbviz
supabase functions deploy personal-context --project-ref snojlbqovlawewwqbviz
supabase functions deploy personal-decision --project-ref snojlbqovlawewwqbviz
supabase functions deploy delete-customer-account --project-ref snojlbqovlawewwqbviz
node scripts/readback-hosted-function-inventory.mjs
node scripts/readback-scanner-hosted-readiness.mjs --read-only
```

Deploy `resolve-product-link`, `product-check-facts`, evidence/contribution or
external candidates only if the final accepted tree/client requires them and its
dependencies/gates are satisfied. Do not deploy all functions indiscriminately:
existing Stripe/Managed functions and parked Plus work are out of scope. Inventory
of all source names may still show intentional non-launch omissions; document them.
Do not activate feature flags in this batch. Version/name parity is not success.

Existing `test-*-local.mjs` scripts intentionally refuse hosted URLs. Do not remove
their guard. Write/review a hosted-specific bounded disposable-user drill first:
create only approved test owners, retain their exact IDs in memory, never emit session
tokens or skin/photos/ingredient payloads, and delete only those exact approved
test records. Do not run the old hosted Managed scripts to simulate free scanner acceptance.

Acceptance sequence:

1. Unauthenticated/expired token denied; owner B cannot read owner A's context,
   continuation, Check case, evidence path or saved history.
2. Permanent account with **no Managed membership** gets free access and completes
   barcode/name/link fallback -> confirmed user ingredient continuation -> context
   -> honest decision. Unknown stays unknown; external candidate never becomes formula truth.
3. Save/reload/retry stable; concurrent context changes produce stale-revision denial;
   account switch clears retained state; deletion retry preserves upload fence.
4. Physical iPhone: real signup/login, persisted reopen, scan/name/link, profile,
   result/back/retry, logout/switch/delete. If using email codes, receive/enter a
   fresh code on the phone without laptop deep-link forwarding. Test an address
   outside the Supabase organization. If password-first and confirmations are off,
   explicitly acknowledge email ownership is unverified and verify recovery delivery
   separately; never silently disable confirmations to avoid mail setup.
5. Run the Target corpus. Report useful first-answer hit rate with denominator,
   category breakdown, canonical vs candidate matches, fallback success and false
   identities separately. Neither deployed row count nor API HTTP 200 is coverage proof.

## Founder decisions / external gates

- Permanent account signup is enabled; email autoconfirm is already ON (Confirm Email
  OFF), directly read from hosted. Password signup can therefore return a session
  without email delivery, but email ownership is unverified. This report does not
  enable/disable confirmations; root must acknowledge the existing policy and test
  actual signup, recovery and account lifecycle behavior.
- If email is required, verify custom sender/OTP template and real non-team delivery.
  No domain purchase or SMTP change is implied by this report.
- Open Beauty Facts customer display/reuse license review remains a gate; internal
  evaluation permission is not customer display permission. Paid source terms/cost
  require approval before purchase/activation; broad external records stay evidence.
- Public App Store retention/privacy disclosures cannot silently inherit the temporary
  closed-beta guest policy. Keep photos private, facts opt-in/reviewed, no public reuse.
- Kanuj remains release/signing/binary/physical acceptance DRI. Signed production
  root navigation and App Store permissions/privacy evidence are distinct gates.
- No claim of three daily Checks until a separately reviewed user-visible usage
  authority exists. No Plus checkout in this scanner-only release.

Tooling validation: eight sanitization/fail-closed unit tests; read-only receipts;
diff/scope check. No app/runtime source edits, no hosted acceptance claim.

The aggregate script serializes its two database queries: the CLI uses an ephemeral
login role, and parallel CLI queries produced an UNKNOWN receipt during cleanup.
The serialized replay returned both evidence and broad catalog counts successfully.
