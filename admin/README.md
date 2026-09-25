# Derive Founder Operations Console

Internal console for the first Founding Beta cohort. It covers routine review and publication, urgent safety-task triage, refill fulfillment, formula verification, and private operational notes.

## Security model

- The browser receives only the Supabase project URL and publishable key. It never receives a service-role key.
- A founder signs in through Supabase Auth. `founder-operations` re-verifies the access token and requires an active row in `public.founder_accounts`.
- Operational tables have RLS enabled and no `anon` or `authenticated` privileges. All mutations use service-only database functions with strict transitions, idempotency request IDs, and an append-only operation log.
- The console does not expose private Storage paths, signed photo URLs, model credentials, Stripe credentials, or Ask transcripts.

## Local setup

1. Copy `config.example.js` to `config.js` and provide the local or hosted Supabase URL and **publishable** key.
2. Create the founder as a normal Supabase Auth user.
3. Add the Auth UUID to `public.founder_accounts` using the Supabase SQL editor or the server-only provisioning process documented in `docs/ENVIRONMENT.md`.
4. Serve this directory on `http://127.0.0.1:4173` (for example, `npx serve admin -l 4173`) and add the deployed production origin to the server secret `ADMIN_ALLOWED_ORIGINS`.

Never put `SUPABASE_SERVICE_ROLE_KEY` in `config.js`, browser storage, an Expo variable, or any static hosting configuration.

## Supported operations

Lightweight administrative tools for operating the first 10 Founding Beta customers ($25/mo Derive-management membership; products purchased separately):
- **Founder Draft + Routine Review Queue**: Look up an eligible managed member, select standard catalog products, author a model-independent initial draft, then separately review and publish it before customer notification. The picker is deliberately bounded; it does not imply that a product is clinically appropriate or that every catalog formula is verified.
- **Safety Escalation Queue**: Inspect flagged medical/sensitization warnings from Ask conversations.
- **Managed Refill Operations**: Track replenishment requests, mark as ordered/shipped, and assign tracking numbers.
- **Product & Formula Verification**: Review user-scanned counter products and audited formula snapshots.
- **Internal Clinical Notes**: Record observations and customer feedback without customer visibility.
