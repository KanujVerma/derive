# Derive Environment & Credential Contract

This document defines where each Derive configuration value belongs. It is a
security boundary: a value may be safe in one runtime and catastrophic in
another.

## Current deployment state

- The mobile app remains in mock mode by default.
- The existing hosted Derive project is `snojlbqovlawewwqbviz`, independently read back in H1A. This identifier is documented here, not hardcoded in `eas.json`.
- EAS `preview` contains the matching public client URL and publishable key. No staging binary or production Remote app has been accepted.
- `.env.example` contains only public mobile names and a safe mock-mode default;
  it contains no usable credentials.
- Setting `EXPO_PUBLIC_USE_REMOTE_SERVICE=true` is intentionally fail-closed
  unless both public Supabase client values are present.

## Variable inventory

| Variable | Runtime | Sensitivity | When required |
| --- | --- | --- | --- |
| `EXPO_PUBLIC_USE_REMOTE_SERVICE` | Expo mobile/web build | Public | `false` in development and production profiles; `true` only in the explicit Remote staging profile before launch approval |
| `EXPO_PUBLIC_BUILD_FLAVOR` | Expo mobile/web build | Public | `development`, `remote-staging`, or `production`; empty local value defaults to development |
| `EXPO_PUBLIC_SUPABASE_URL` | Expo mobile/web build | Public | Local or hosted Supabase client access |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Expo mobile/web build | Public | Local or hosted Supabase client access |
| `EXPO_PUBLIC_FOUNDER_SUPPORT_EMAIL` | Expo mobile/web build | Public | Optional customer contact; configure only after send-and-receive mailbox verification |
| `EXPO_PUBLIC_ANALYTICS_ENABLED` | Expo mobile/web build | Public | S7 kill switch; empty/false until analytics disclosure, privacy-choice UI, and rollout are approved; flag alone never opts a customer in |
| `EXPO_PUBLIC_POSTHOG_PROJECT_KEY` | Expo mobile/web build | Public project token | Only for an approved Remote analytics build; never use a personal or server API key |
| `EXPO_PUBLIC_POSTHOG_HOST` | Expo mobile/web build | Public | Exact project region: `https://us.i.posthog.com` or `https://eu.i.posthog.com` |
| `SUPABASE_PROJECT_ID` | CLI / CI | Public identifier | Linking and deploying to a hosted project |
| `SUPABASE_ACCESS_TOKEN` | CLI / CI | Secret | Headless Supabase management; interactive local login should use the CLI credential store instead |
| `SUPABASE_DB_PASSWORD` | CLI / CI | Secret | Hosted migration and database operations |
| `DERIVE_PUBLIC_SUPABASE_URL` | Local Edge Function runtime | Public | Optional override when testing signed photo URLs from a physical device; hosted environments do not need it |
| `GEMINI_API_KEY` | Supabase Edge Functions / trusted server | Secret | Required for live S3 routine, scan, and Ask generation |
| `GEMINI_MODEL` | Supabase Edge Functions / trusted server | Non-secret configuration | Optional shared S3 model override; Ask/Scan currently default to `gemini-2.5-flash`, while routine proposal currently defaults to `gemini-3.8-flash`. Neither is a founder-approved final model choice. |
| `STRIPE_SECRET_KEY` | Supabase Edge Functions / trusted server | Secret | Required for Checkout, Portal, and subscription retrieval; use a test-mode key until production readiness review |
| `STRIPE_WEBHOOK_SECRET` | Supabase Edge Functions / trusted server | Secret | Required to verify the raw Stripe webhook body; unique per webhook endpoint/listener |
| `STRIPE_FOUNDING_BETA_PRICE_ID` | Supabase Edge Functions / trusted server | Non-secret identifier, server-only policy | Recurring monthly Stripe Price that owns the actual Founding Beta charge |
| `DERIVE_CHECKOUT_SUCCESS_URL` | Supabase Edge Functions / trusted server | Non-secret configuration | HTTPS success destination (localhost HTTP allowed only for local development) |
| `DERIVE_CHECKOUT_CANCEL_URL` | Supabase Edge Functions / trusted server | Non-secret configuration | HTTPS cancellation destination (localhost HTTP allowed only for local development) |
| `DERIVE_PORTAL_RETURN_URL` | Supabase Edge Functions / trusted server | Non-secret configuration | HTTPS return destination from Stripe Billing Portal |

The root `.env.example` lists only public mobile variables, including an empty optional build flavor and support address.
CLI/CI and trusted-server names are documented here instead of being mixed into
the Expo template, reducing the risk that a developer pastes a server secret
into the mobile build environment.

When the support address is unset or malformed, onboarding does not offer a human support contact and Profile routes skincare questions to Ask. A real-money customer launch requires a separately verified working contact path; a syntactically valid email address alone does not prove delivery.

S5 trusted-server names are listed with empty values in `supabase/.env.example`.
They are deliberately absent from the root Expo template. S7's PostHog client
configuration is public and optional; it remains disabled in the template and
current EAS profiles. See [S7_OBSERVABILITY.md](S7_OBSERVABILITY.md).

## Local mobile development

Copy the template, then fill only the `EXPO_PUBLIC_*` client values:

```bash
cp .env.example .env.local
```

Keep `EXPO_PUBLIC_USE_REMOTE_SERVICE=false` for ordinary UI development. The
remote adapter is implemented, but supplying Supabase credentials alone does
not make the end-to-end app production-ready: hosted migrations, functions,
provider secrets, Stripe test-mode setup, and the I1 smoke test must also pass.

Expo compiles every `EXPO_PUBLIC_*` value into the shipped application. These
variables may contain only values designed to be public. A publishable key is
safe in a mobile binary because database authorization is enforced by Supabase
Auth, grants, and Row-Level Security—not by hiding the client key.

The environment resolver accepts the legacy
`EXPO_PUBLIC_SUPABASE_ANON_KEY` temporarily so an existing uncommitted setup
does not break. New environments must use
`EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. The legacy name is deliberately absent
from `.env.example`.

## L0 Remote staging build boundary

`eas.json` has three explicit build profiles. `development` is an internal development client with Remote disabled. `production` is store-signed with Remote disabled. `remote-staging` is store-signed and TestFlight-capable, sets `EXPO_PUBLIC_BUILD_FLAVOR=remote-staging` and `EXPO_PUBLIC_USE_REMOTE_SERVICE=true`, and explicitly selects EAS environment `preview`. The explicit preview selection matters because a store distribution build otherwise selects the production environment by default. The build flavor is independent of service mode; a later approved production Remote activation remains possible without redefining flavor semantics.

EAS preview provides `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` as public client configuration. L0 first validated the profile with both absent. H1A then verified the existing Derive Supabase project and matched the stored preview values privately against its exact URL and enabled publishable key. This is configuration proof, not a shipped binary or customer session. Do not copy the key into `eas.json`, source, or a PR. Never use a service-role or secret key in Expo.

The L0 resolver rejects invalid flavor values, Remote staging with Remote disabled, missing or malformed publishable keys, legacy anon-only key, local/non-HTTPS or non-`*.supabase.co` hosts, and URLs containing a path, query, fragment, or embedded credentials. Remote staging checks the documented `sb_publishable_` key shape: a 22-character random part and an 8-character checksum part. A future reviewed custom-domain rollout would need an explicit guard change. The build shows a staging-only identity card on sign-in, Holding, Membership, and Profile with its service mode, safe backend host, **public configuration shape** status, and app version. Shape validation does not establish that the key is active or belongs to the displayed project. It never shows a key or user token. H1A must compare the host on a built device with the verified project and prove an authenticated call; a TestFlight label alone is not evidence of Remote mode.

When switching local build flavors, clear Metro's cache before using an export as evidence. A 2026-09-20 local export initially reused a prior Mock bundle after shell environment values changed; `npx expo export -p web --clear` rebuilt and embedded the synthetic staging host as expected. Always inspect the compiled staging diagnostic on the installed build. This local observation does not assert the state of an EAS cloud binary.

The optional fixed expected-project-ref guard was not added in L0 because the general connected project list then omitted Derive. H1A direct project lookup and authenticated CLI later verified the exact ref, and private EAS preview readback matched it. The staging diagnostic still needs an installed-device comparison; it alone cannot prove the backend key is live.

## Supabase CLI and hosted-project access

The mobile sign-in screen expects a six-digit email OTP. Local Supabase uses
`supabase/templates/magic_link.html` with `{{ .Token }}` and an explicit six-digit
OTP length. The default Supabase Magic Link email does not satisfy this UI.
For a hosted project, set its Magic Link / OTP email template in the Supabase
Dashboard to include `{{ .Token }}` and verify the OTP length is six before the
Remote activation smoke. Local CLI template configuration does not deploy to
the hosted project.

E1 resolves the managed-app entitlement policy: Remote accounts need canonical
active membership before sensitive onboarding and the member tabs. A signed-in
inactive account uses `/membership` for trusted Checkout or billing management.
Profile readiness alone cannot grant access. Public Shop routing remains
parked. Keep the committed production and local default profiles on
`EXPO_PUBLIC_USE_REMOTE_SERVICE=false` until hosted core, real six-digit OTP
email, Gemini, and Stripe Checkout/webhook/Portal gates pass. The separate
Remote staging profile is for controlled hosted-core verification with a
disposable authenticated entitlement fixture in the separate H1A scripts; it is
not a mobile Auth path, email proof or billing proof. L1A may build and inspect
the Remote staging app while signed out, but must stop at customer login until
H1E proves six-digit hosted OTP or another founder-approved customer Auth path.
Do not add password login, token paste, session injection or a client
entitlement override to cross this boundary. H1P separately owns hosted model
provider activation for routine, Ask and Scan; F1 owns manual routine recovery.

For a developer workstation, prefer interactive authentication:

```bash
npx supabase login
npx supabase link --project-ref <project-id>
```

The CLI stores its access token in its local credential store. Do not paste the
token into source files or chat. The database password belongs in a password
manager and may be entered when the CLI prompts for it.

For headless CI only, configure these encrypted repository secrets:

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_DB_PASSWORD`
- `SUPABASE_PROJECT_ID`

Never expose any of them through an `EXPO_PUBLIC_*` name or an EAS public build
environment. Before applying a migration remotely, run a local reset/test and
a remote dry run. Never run `supabase db reset --linked` against production.

## Trusted server and Edge Functions

Hosted Supabase Edge Functions receive `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and
`SUPABASE_SERVICE_ROLE_KEY` from Supabase automatically. These names belong to
the trusted function runtime and are deliberately absent from the root Expo
template. Do not manually copy a Supabase secret or legacy service-role key
into the mobile app.

Local Docker functions see Storage through the internal `kong` hostname. The
photo signer rewrites that local-only origin to `http://127.0.0.1:54321` by
default. Set `DERIVE_PUBLIC_SUPABASE_URL` only when a physical test device needs
the Mac's LAN-reachable Supabase URL. The signed path and token are preserved.

S3 intelligence reads `GEMINI_API_KEY` only inside trusted Edge Functions.
Store it through Supabase Edge Function secrets (and in an ignored
`supabase/.env.local` file for local development), never in the repository
root's mobile values. At the 2026-09-20 H1A gate, an exact free-tier auth key
was verified through Google's read-only model endpoint, but the authenticated
Supabase CLI account was denied permission to set `GEMINI_API_KEY` on the
existing Derive project. No partial hosted secret was stored. The model
selection remains open. A synthetic direct adapter call to current routine
default `gemini-3.8-flash` received Google 503 high-demand twice; a direct
diagnostic with the shared Ask/Scan default ID `gemini-2.5-flash` received
404 for this new key; a one-off
`gemini-3.6-flash` diagnostic also received 503. Do not call any of those
hosted provider paths proven. Without a selected/configured provider,
`propose-routine` returns sanitized `MODEL_UNAVAILABLE` rather than fabricating
a routine. The deterministic emergency circuit breaker and server-owned signal
inference do not require the provider key. See [HOSTED_REMOTE_SMOKE.md](HOSTED_REMOTE_SMOKE.md).

S5 commerce reads every Stripe value only inside Supabase Edge Functions.
`create-membership-checkout` and `create-membership-portal` require a valid
member JWT. `stripe-membership-webhook` intentionally does not require a
Supabase JWT because Stripe does not send one; it verifies `Stripe-Signature`
against the unparsed body and `STRIPE_WEBHOOK_SECRET` before any database call.
Missing Stripe configuration fails closed with sanitized errors.

## Stripe test-mode setup (required before hosted S5 smoke test)

1. In Stripe test mode, create one product named `Derive Founding Beta` and one
   recurring monthly Price at the founder-approved amount. Copy its `price_...`
   identifier—not a dollar amount—into `STRIPE_FOUNDING_BETA_PRICE_ID`.
2. Copy the test-mode secret API key (`sk_test_...`) into
   `STRIPE_SECRET_KEY`. Never paste a restricted/secret key into a root Expo
   `.env` file, source file, issue, PR, screenshot, or chat transcript.
3. Create a webhook endpoint targeting
   `https://<project-ref>.supabase.co/functions/v1/stripe-membership-webhook`.
   Subscribe to `checkout.session.completed`,
   `checkout.session.async_payment_succeeded`, and
   `customer.subscription.created|updated|deleted|paused|resumed`. Store that
   endpoint's `whsec_...` value as `STRIPE_WEBHOOK_SECRET`.
4. Set HTTPS success/cancel/portal-return destinations. These are navigation
   destinations only; membership activation still comes exclusively from the
   signed webhook.
5. Store the values in the hosted function secret store, then deploy the three
   S5 functions. Do not commit the populated file.

For local development:

```bash
cp supabase/.env.example supabase/.env.local
supabase functions serve --env-file supabase/.env.local
```

For hosted Supabase after the project is linked:

```bash
supabase secrets set --env-file supabase/.env.local
supabase functions deploy create-membership-checkout
supabase functions deploy create-membership-portal
supabase functions deploy stripe-membership-webhook --no-verify-jwt
```

The committed template contains names only. Actual values belong in the
ignored `supabase/.env.local` file or the hosted Supabase secret store.

## Explicitly forbidden

- Any Supabase secret key or legacy service-role key in `EXPO_PUBLIC_*`.
- Database passwords, personal access tokens, SMTP passwords, model-provider
  keys, or payment credentials in mobile code.
- Real credentials in `.env.example`, documentation, tests, screenshots,
  issues, commits, or pull-request descriptions.
- Enabling Remote mode in the committed production EAS profile before the
  later production launch gate. The separate L0 Remote staging profile is
  allowed only with its validated preview configuration and hosted-core smoke.

## Failure behavior

Derive refuses to enable remote mode when its URL or publishable key is
missing. It also rejects malformed URLs, non-local plaintext HTTP URLs, and
remote-mode values other than the exact strings `true` or `false`. Error
messages name missing variables but never echo credential values.

## References

- [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys)
- [Supabase local-to-hosted CLI workflow](https://supabase.com/docs/guides/local-development/cli-workflows)
- [Supabase Edge Function secrets](https://supabase.com/docs/guides/functions/secrets)
- [Expo environment variables](https://docs.expo.dev/guides/environment-variables/)
