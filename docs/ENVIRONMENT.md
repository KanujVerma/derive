# Derive Environment & Credential Contract

This document defines where each Derive configuration value belongs. It is a
security boundary: a value may be safe in one runtime and catastrophic in
another.

## Current deployment state

- The mobile app remains in mock mode by default.
- No hosted Supabase project is identified by committed configuration.
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
| `GEMINI_MODEL` | Supabase Edge Functions / trusted server | Non-secret configuration | Optional S3 model override; defaults to `gemini-2.5-flash` |

The root `.env.example` lists only the three `EXPO_PUBLIC_*` mobile variables.
CLI/CI and trusted-server names are documented here instead of being mixed into
the Expo template, reducing the risk that a developer pastes a server secret
into the mobile build environment.

Stripe is intentionally excluded. It belongs to S5 and must not be introduced
as part of the S1 platform setup. PostHog is also excluded until its SDK and
privacy-safe event transport are implemented.

## Local mobile development

Copy the template, then fill only the `EXPO_PUBLIC_*` client values:

```bash
cp .env.example .env.local
```

Keep `EXPO_PUBLIC_USE_REMOTE_SERVICE=false` for ordinary UI development. The
current remote adapter is incomplete, so supplying Supabase credentials does
not make the end-to-end app production-ready.

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
reviewed model override is needed; otherwise the functions use
`gemini-2.5-flash`. Without a Gemini key, live routine, scan, and safe Ask model
paths return a sanitized `503` rather than fabricating model output. The
deterministic emergency circuit breaker and server-owned signal inference do
not require the provider key.

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
