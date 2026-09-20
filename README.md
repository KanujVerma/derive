# Derive: "Your skincare, handled."

Managed skincare service ("Your skincare, handled"). Built on Apple-grade minimalism, contextual intelligence, and persistent customer care. Currently preparing for an initial 10-member Founding Beta cohort. Membership is **$25/month** for Derive managing skincare; products are purchased separately (ADR-26 / I1-B4A).

---

## 1. Quick Start

### Prerequisites
- Node.js 22+ (LTS)
- npm 10+
- iOS Simulator (macOS with Xcode) or Expo Go

### Local Setup
```bash
# 1. Clone repository
git clone https://github.com/KanujVerma/derive.git
cd derive

# 2. Install dependencies
npm install

# 3. Environment configuration (fill only the mobile-client section)
cp .env.example .env.local

# 4. Run test suite & strict typecheck
npm test
npx tsc --noEmit

# 5. Start Expo development server
npx expo start
```

### Local Supabase Verification

The committed `supabase/config.toml` and ordered migrations reproduce the S1
data-plane locally. Docker Desktop or another Docker-compatible runtime is
required by the Supabase CLI.

```bash
# Start the local Auth, Postgres, and Storage services.
npx supabase start

# Rebuild a fresh database from every committed migration.
npx supabase db reset

# Run the pgTAP access-control suite in supabase/tests/.
npx supabase test db
```

Before linking a hosted project, confirm its PostgreSQL major version matches
`supabase/config.toml`. Never run a linked reset against production.
See [`docs/ENVIRONMENT.md`](docs/ENVIRONMENT.md) for the public-client,
developer/CI, and trusted-server credential boundaries.

---

## 2. Tech Stack

- **Mobile Client**: Expo SDK 57, React Native 0.86, TypeScript (strict mode), Expo Router (file-based navigation in `app/`), Zustand state stores.
- **Visual Design**: Direction A Mineral (Warm Ivory `#F6F3EC`, Elevated Surface `#FFFEFB`, Architectural Charcoal `#171A18`, Mineral Green `#345447`).
- **Platform / Backend**: Supabase PostgreSQL, Row-Level Security, Auth, private Storage, and Edge Functions are implemented through S5. Hosted activation remains pending.
- **Intelligence**: S3 server intelligence uses a server-side Gemini provider when configured and deterministic safety circuit breakers. The mobile app remains in Mock mode by default.
- **Commerce**: S5 membership Checkout, Billing Portal, and signed subscription webhooks are implemented; hosted test-mode activation remains pending. C1 Shop and C1.5A acquisition foundation are landed. Products are separate purchases; C1.5B feeds and C1.5C physical checkout are parked.
- **Member Access**: E1 requires canonical active membership before Remote onboarding and the managed app. Unpaid, paused, and cancelled accounts reach Membership for trusted billing actions. Mock remains the default and production Remote activation awaits hosted end-to-end smoke.
- **Telemetry**: Planned privacy-safe telemetry (PostHog with session replay strictly disabled; typed navigation allowlist only; zero health data/photos/symptoms).

---

## 3. Founder Workstreams

Derive separates development into two independent lanes connected by a thin, stable service contract (`src/contracts/DeriveService.ts`):

* **Kanuj (Customer Experience + Mobile)**:
  - Mobile screens (`app/**`), UI components (`src/components/**`), design tokens (`src/constants/theme.ts`), haptics, voice input, and client AI interactions.
  - Develops against `MockDeriveService` with zero backend blocking.
* **Sami (Platform + Intelligence + Operations)**:
  - Supabase database schema, migrations, RLS policies, private storage, Edge Functions (`supabase/**`), intelligence workflows, and founder operations console (`admin/**`).
  - Implements `RemoteDeriveService` fulfilling the exact same contract.

Each implementation milestone has one founder owner. Read [`docs/ROADMAP.md`](docs/ROADMAP.md) for current status and prerequisites and [`docs/OWNERSHIP.md`](docs/OWNERSHIP.md) for file boundaries and cross-lane defect handoffs. GitHub is the sole durable source for project context; Drive is limited to customer-research artifacts.

### Toggling Between Mock and Remote Backend
The service factory supports selecting the remote backend adapter:
```bash
# In your local .env:
EXPO_PUBLIC_USE_REMOTE_SERVICE=true
```
*Note: The mobile client remains in Mock mode by default. The Remote adapter and S1-S5 implementation are present, but hosted migrations, functions, provider secrets, and the Stripe test-mode lifecycle smoke must be verified before Remote production activation. Enabling this flag alone is not a production readiness check.*

L0 defines a separate `remote-staging` EAS profile for a store-signed Remote test build. It selects EAS `preview`; H1A must verify the hosted project and supply the preview public Supabase URL and publishable key before building. The production profile remains Mock. See [`docs/ENVIRONMENT.md`](docs/ENVIRONMENT.md) for preflight and staging-only diagnostics.

---

## 4. Repository Documentation Sitemap

Before beginning substantial feature work, consult the core documentation:
* [`AGENTS.md`](AGENTS.md): Essential orienting instructions, bootstrap rules, and architecture challenge protocol for AI agents and founders.
* [`docs/CONTEXT_SYNC.md`](docs/CONTEXT_SYNC.md): Repository-native checkpoint ledger; older entries are historical.
* [`docs/PROJECT_CONTEXT.md`](docs/PROJECT_CONTEXT.md): Strategic context, target customers, Founding Beta concierge operating model, and business hypotheses.
* [`docs/PRODUCT.md`](docs/PRODUCT.md): Full product specification, navigation, autopilot vs. depth philosophy, baseline photo capture, and care loop.
* [`docs/OWNERSHIP.md`](docs/OWNERSHIP.md): Granular file ownership and contract change rules.
* [`docs/ENVIRONMENT.md`](docs/ENVIRONMENT.md): Environment-variable inventory, credential boundaries, and safe Supabase setup workflow.
* [`docs/ROADMAP.md`](docs/ROADMAP.md): Current single-owner milestones, prerequisites, and historical delivery record.
* [`docs/FIRST_CUSTOMER_TEST.md`](docs/FIRST_CUSTOMER_TEST.md): Current first-customer acceptance script.
* [`docs/INTERFACES.md`](docs/INTERFACES.md): Runtime contract specifications, error models, and semantic requirements for backend evolution.
* [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): System topology, security boundaries, and data flow.
* [`docs/DESIGN.md`](docs/DESIGN.md): Direction A Mineral design tokens, spatial grammar, and Apple HIG guidelines.
* [`docs/SAFETY_PRIVACY.md`](docs/SAFETY_PRIVACY.md): Medical boundaries, private photo storage, non-discrimination invariants, and telemetry guardrails.
* [`docs/DECISIONS.md`](docs/DECISIONS.md): Concise log of accepted architecture decisions (ADRs) and open challenges.
* [`docs/RESEARCH.md`](docs/RESEARCH.md): Competitor teardowns, beta learning hypotheses, preliminary customer survey evidence, and peer-reviewed dermatological references.

---

## 5. Continuous Integration (CI)

Every PR must pass:
1. `npm test` — Unit test suite (Safety classifier, routine invariants, ingredient intelligence, contract mocks).
2. `npx tsc --noEmit` — Strict TypeScript compiler check across all routes and components.
3. `EXPO_NO_TELEMETRY=1 npx expo export -p web` — Production bundle build.
