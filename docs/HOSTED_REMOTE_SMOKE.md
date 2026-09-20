# H1 hosted Remote activation record and smoke checklist

This is the staging/test activation record for the existing Derive Supabase
project. It is not a production launch checklist or an authorization to change
the committed Remote default. Record observations, not secret values or OTPs.

## Verified hosted baseline, 2026-09-19

| Boundary | Observed state |
| --- | --- |
| Project | `Derive`, organization `Derive`, ref `snojlbqovlawewwqbviz`, `us-east-2`, `ACTIVE_HEALTHY`, PostgreSQL 17.6.1.166 |
| Ownership | The brief identifies this as Sami's existing project. CLI places it in a distinct organization from `Kanuj's Org`; the individual owner was not independently verified. |
| Initial database | 14 Derive migrations through S5; 21 public tables with RLS; private `customer-skin-photos` bucket; zero Auth users, profiles, memberships, webhook events, and Storage objects. |
| Migration reconciliation | Partial Derive deployment. The first 14 local versions matched the hosted ledger, and a dry run named only `20260919222230_e1_membership_entitlements.sql`. Its expected predecessor policy names and owner checks were inspected before push. |
| Migration deployed | E1 applied forward-only. Hosted ledger now has all 15 committed migrations. `public.current_member_is_active()` is security invoker, and the E1 owner plus active-member write policies are present. No hosted reset or migration repair was used. |
| Edge Functions | Initially 10 S1-S4 functions. The seven E1-updated functions were redeployed at version 2; the three S5 billing functions were added at version 1. All 13 report `ACTIVE`. Customer/founder functions retain JWT verification; `stripe-membership-webhook` has `verify_jwt=false` and validates the Stripe signature in code. |
| Direct negative probes | Unauthenticated `prepare-onboarding` returned 401. An unsigned empty webhook returned 400 `INVALID_SIGNATURE`. Neither proves the signed billing lifecycle. |
| Data API | Enabled with exposed schemas `public` and `graphql_public`. All application tables checked have RLS. Authenticated grants are selective; `memberships` and `routines` use column-level SELECT grants rather than table-wide SELECT. Founder/server tables have no customer grants or owner policies. |
| Storage | Private `customer-skin-photos`, 10 MiB per object, image MIME allowlist. E1 active-member upload policy is installed. Cross-user and signed URL runtime tests remain pending. |
| Auth | Hosted Magic Link/OTP template is the default link-only email, subject `Your sign-in link`; custom SMTP is off. The repository's local `{{ .Token }}` template is not deployed. The free-tier UI prevents editing until custom SMTP is configured. Hosted six-digit OTP is unverified. |
| Secrets | Only Supabase-provided default names are present. Gemini, Stripe, trusted return URLs, and optional founder origin settings are absent. No secret value was read or copied into the client. |
| Advisors | Security: eight informational `rls_enabled_no_policy` notices on deliberately server-only tables. Performance: five unindexed foreign keys, 24 unused indexes on empty tables, one duplicate routine index warning. No change was made on advisory output alone. |
| Remote state | Committed `EXPO_PUBLIC_USE_REMOTE_SERVICE=false`. An explicit staging web export with the hosted URL and modern publishable key succeeded; no hosted customer lifecycle or provider smoke has passed. |

## H1 continuation: independent hosted negative smoke

`scripts/test-h1-hosted-negative.mjs` ran against the exact project above with
two generated, disposable password-auth users. This is separate from the
primary six-digit OTP customer flow. Both users received their own profile and
no membership. Each could read its own profile but not the other's. The seven
paid Edge operations returned 403 for an inactive user, as did founder
operations. A customer could not insert an active membership, and a valid
synthetic PNG upload returned 403 at the private Storage authorization
boundary. Both accounts used the deployed self-deletion function; hosted SQL
readback then showed zero Auth users, profiles, memberships, photo metadata,
and Storage objects.

This proves only the exercised inactive and profile-owner boundaries. It does
not prove cross-user routine/check-in/photo reads with populated rows, signed
photo URLs, deletion of an existing photo, real email OTP, or active-member
flows. Those remain in the full smoke checklist.

To repeat this narrowly scoped test, supply only the hosted public URL and
modern publishable key as `H1_HOSTED_SUPABASE_URL` and
`H1_HOSTED_SUPABASE_PUBLISHABLE_KEY`, then set
`H1_HOSTED_ALLOW_DISPOSABLE_TESTS=YES` and run the script. It rejects any
project other than `snojlbqovlawewwqbviz`, generates credentials in memory,
and attempts self-deletion in `finally`. If deletion fails, it reports only the
disposable Auth user IDs for authorized cleanup. Never run it in CI or use a
real customer identity.

The read-only shadow schema diff could not connect to the direct database host
from this environment. The migration ledger, actual table/policy inspection,
dry run, E1 migration preflight, and post-push readback support the narrow E1
deployment claim. A full independent hosted schema diff remains unverified.

## External decisions and secure setup

1. Sami owns Resend, sender/domain and DNS, Supabase custom SMTP, and the hosted
   six-digit `{{ .Token }}` template. Do not duplicate or overwrite that work.
   Inspect and behaviorally verify it when Sami marks it ready.
2. Sami is also building the Stripe infrastructure. Do not create or change
   products, prices, webhooks, Portal configuration, or billing secrets in
   parallel. After he completes account wiring, inspect the correct Derive
   test account and reuse what is already configured.
3. A dedicated staging inbox and a real Gemini API credential are still needed
   through trusted provider and Supabase settings. Never paste credentials,
   OTPs, or test payment details into chat or Git.
4. The implemented billing webhook endpoint is
   `https://snojlbqovlawewwqbviz.supabase.co/functions/v1/stripe-membership-webhook`.
   Subscribe only to the seven event types handled in that function. The
   recurring test Price must be $25/month for `Derive Founding Beta`, with
   products separate. Checkout and Portal return URLs are navigation only.

## Repeatable checks before a TestFlight release

The CLI commands below target the existing project. Run local reset only in an
unlinked or default-local context; never pass `--linked` to `db reset`.

- [ ] **Automated/read-only:** Confirm clean source revision, linked project
  ref and organization, `supabase migration list`, `supabase db push --dry-run`,
  function inventory and per-function `verify_jwt`, private bucket, exposed
  schemas, grants, RLS, and advisors. Do not print secret values.
- [ ] **Manual Auth:** In an explicit staging Remote app configuration using
  the hosted URL and modern publishable key, send an email OTP to a dedicated
  inbox, enter the six-digit code privately, and verify a real session and the
  Membership screen. A new user must have no active membership or onboarding.
- [ ] **Manual billing:** Open S5 hosted test Checkout, complete a Stripe test
  payment, observe a signed event and canonical active membership, and refresh
  to onboarding. Repeat the event to verify idempotency; verify an older event
  and an unrelated customer cannot displace the current projection. The
  success navigation alone must leave entitlement unchanged.
- [ ] **Manual onboarding:** Complete goals, preferences, skin observations,
  products, reactions, and safety answers through the app. Upload representative
  front/left/right staging images. Verify private object paths, metadata,
  owner isolation, bounded signed URLs, and idempotent intake replay. Do not
  commit, log, or reuse actual member photos.
- [ ] **Manual provider/founder:** Confirm a real Gemini network call and
  model ID, an `awaiting_review` proposal and founder task. Provision founder
  access only through `founder_accounts`; deny an ordinary customer. Review and
  publish, then refresh the customer without reinstalling or resetting state.
- [ ] **Manual member surfaces:** Verify Today, Plan, personalized Shop, known
  and unknown Scan, safe Ask, weekly Check-In, Progress, managed Refill,
  founder fulfillment, and Orders/tracking against hosted rows. Record both
  response and relevant logs. Do not count mock/fixture output as hosted proof.
- [ ] **Manual billing downgrade:** Open the own-customer Portal in test mode,
  perform an enabled safe cancellation or pause, confirm signed webhook state,
  refresh the app, and verify immediate Membership routing with managed caches
  cleared. Reactivate only through an already-supported S5 path.
- [ ] **Manual negative/security:** With two isolated test customers, verify
  cross-user profile/routine/check-in/photo/refill denials, founder denial,
  inactive premium API and write denials, and private Storage restrictions.
  Use a separate disposable account for deletion and verify Storage cleanup,
  relational handling, then Auth deletion last.
- [ ] **Final review:** Re-run hosted security and performance advisors, inspect
  Auth, Edge, database, and webhook logs, record unresolved warnings, and keep
  production/default Remote mode off until a later explicit launch decision.

No lifecycle item above is marked complete merely because local or CI fixtures
passed. Keep C1.5 physical-product commerce unopened.
