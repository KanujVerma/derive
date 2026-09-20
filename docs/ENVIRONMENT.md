# Derive Environment & Credential Contract

This document defines where each Derive configuration value belongs. It is a
security boundary: a value may be safe in one runtime and catastrophic in
another.

## Current deployment state

- The mobile app remains in mock mode by default.
- H1 uses the existing Derive organization project `snojlbqovlawewwqbviz`
  (`us-east-2`) for staging/test work. All 15 committed migrations and 13
  required Edge Functions are deployed. See `docs/HOSTED_REMOTE_SMOKE.md` for
  dated readback and unresolved hosted gates.
- `.env.example` contains only public mobile names and a safe mock-mode default;
  it contains no usable credentials.
- Setting `EXPO_PUBLIC_USE_REMOTE_SERVICE=true` is intentionally fail-closed
  unless both public Supabase client values are present.

## Variable inventory

| Variable | Runtime | Sensitivity | When required |
| --- | --- | --- | --- |
| `EXPO_PUBLIC_USE_REMOTE_SERVICE` | Expo mobile/web build | Public | `false` until the I1 remote integration is verified |
| `EXPO_PUBLIC_SUPABASE_URL` | Expo mobile/web build | Public | Local or hosted Supabase client access |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Expo mobile/web build | Public | Local or hosted Supabase client access |
| `SUPABASE_PROJECT_ID` | CLI / CI | Public identifier | Linking and deploying to a hosted project |
| `SUPABASE_ACCESS_TOKEN` | CLI / CI | Secret | Headless Supabase management; interactive local login should use the CLI credential store instead |
| `SUPABASE_DB_PASSWORD` | CLI / CI | Secret | Hosted migration and database operations |
| `DERIVE_PUBLIC_SUPABASE_URL` | Local Edge Function runtime | Public | Optional override when testing signed photo URLs from a physical device; hosted environments do not need it |
| `GEMINI_API_KEY` | Supabase Edge Functions / trusted server | Secret | Required for live S3 routine, scan, and Ask generation |
| `GEMINI_MODEL` | Supabase Edge Functions / trusted server | Non-secret configuration | Optional model override; shared Ask/Scan runtime defaults to `gemini-2.5-flash`, while the routine proposal adapter defaults to `gemini-3.8-flash` |
| `STRIPE_SECRET_KEY` | Supabase Edge Functions / trusted server | Secret | Required for Checkout, Portal, and subscription retrieval; use a test-mode key until production readiness review |
| `STRIPE_WEBHOOK_SECRET` | Supabase Edge Functions / trusted server | Secret | Required to verify the raw Stripe webhook body; unique per webhook endpoint/listener |
| `STRIPE_FOUNDING_BETA_PRICE_ID` | Supabase Edge Functions / trusted server | Non-secret identifier, server-only policy | Recurring monthly Stripe Price that owns the actual Founding Beta charge |
| `DERIVE_CHECKOUT_SUCCESS_URL` | Supabase Edge Functions / trusted server | Non-secret configuration | HTTPS success destination (localhost HTTP allowed only for local development) |
| `DERIVE_CHECKOUT_CANCEL_URL` | Supabase Edge Functions / trusted server | Non-secret configuration | HTTPS cancellation destination (localhost HTTP allowed only for local development) |
| `DERIVE_PORTAL_RETURN_URL` | Supabase Edge Functions / trusted server | Non-secret configuration | HTTPS return destination from Stripe Billing Portal |
| `ADMIN_ALLOWED_ORIGINS` | Founder Edge Function runtime | Non-secret configuration | Approved browser origins for a hosted founder console; retain the existing S4 founder allowlist |

The root `.env.example` lists only the three `EXPO_PUBLIC_*` mobile variables.
CLI/CI and trusted-server names are documented here instead of being mixed into
the Expo template, reducing the risk that a developer pastes a server secret
into the mobile build environment.

S5 trusted-server names are listed with empty values in `supabase/.env.example`.
They are deliberately absent from the root Expo template. PostHog remains
excluded until its SDK and privacy-safe event transport are implemented.

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

## Supabase CLI and hosted-project access

The mobile sign-in screen expects a six-digit email OTP. Local Supabase uses
`supabase/templates/magic_link.html` with `{{ .Token }}` and an explicit six-digit
OTP length. The default Supabase Magic Link email does not satisfy this UI.
The existing hosted Derive project still sends the default Magic Link email.
It was created on the free tier after Supabase restricted template editing with
its shared mail provider. A founder must choose custom SMTP or a paid plan,
and an authorized administrator must install a `{{ .Token }}` template before
the six-digit Remote OTP smoke. Shared mail is also limited to organization
team addresses. Local CLI template configuration does not deploy to hosted.

E1 resolves the managed-app entitlement policy: Remote accounts need canonical
active membership before sensitive onboarding and the member tabs. A signed-in
inactive account uses `/membership` for trusted Checkout or billing management.
Profile readiness alone cannot grant access. Public Shop routing remains
separate, unopened C1.5 work. Keep `EXPO_PUBLIC_USE_REMOTE_SERVICE=false`
until six-digit hosted OTP, Gemini, and test-mode Checkout to signed webhook to
membership to Portal smoke all pass. H1's schema and function deployment alone
do not authorize production activation.

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

S3 intelligence reads `GEMINI_API_KEY` only inside the trusted Edge Function
runtime. Store it through Supabase Edge Function secrets (and in an ignored
`supabase/.env.local` file for local development), never in the repository
root's mobile values. `GEMINI_MODEL` may be set beside it when an explicitly
reviewed model override is needed; otherwise the functions use the implemented
models described above. Without a Gemini key, live routine, scan, and safe Ask
model paths return a sanitized `503` rather than fabricating model output. The
deterministic emergency circuit breaker and server-owned signal inference do
not require the provider key.

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
- Enabling remote mode in EAS until authentication, row mapping, Edge
  Functions, and I1 end-to-end verification are complete.

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
