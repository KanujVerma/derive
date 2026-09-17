# Derive: "Your skincare, handled."

Managed skincare service ("Your skincare, handled"). Built on Apple-grade minimalism, contextual intelligence, and persistent customer care. Currently preparing for an initial 10-member Founding Beta cohort ($100/month concierge operating experiment; long-term personalized pricing architecture remains provisional).

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

# 3. Environment configuration
cp .env.example .env

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

---

## 2. Tech Stack

- **Mobile Client**: Expo SDK 57, React Native 0.86, TypeScript (strict mode), Expo Router (file-based navigation in `app/`), Zustand state stores.
- **Visual Design**: Direction A Mineral (Warm Ivory `#F6F3EC`, Elevated Surface `#FFFEFB`, Architectural Charcoal `#171A18`, Mineral Green `#345447`).
- **Platform / Backend**: Supabase (PostgreSQL, Row-Level Security, Auth, Edge Functions, Private Storage) — S1A data plane hardened; full S1 platform in progress.
- **Intelligence**: Server-side Google Gemini 2.5 Flash via structured JSON schemas (server-side only; Gemini keys are strictly server secrets; mobile client uses deterministic local reasoning via `MockDeriveService`), coupled with deterministic safety circuit breakers.
- **Commerce**: Planned Stripe web checkout for Founding Beta memberships ($100/month first-10 approved beta experiment; long-term personalized pricing architecture remains provisional). (Currently S5 on roadmap).
- **Telemetry**: Planned privacy-safe telemetry (PostHog with session replay strictly disabled; typed navigation allowlist only; zero health data/photos/symptoms).

---

## 3. Parallel Founder Workstreams

Derive separates development into two independent lanes connected by a thin, stable service contract (`src/contracts/DeriveService.ts`):

* **Kanuj (Customer Experience + Mobile)**:
  - Mobile screens (`app/**`), UI components (`src/components/**`), design tokens (`src/constants/theme.ts`), haptics, voice input, and client AI interactions.
  - Develops against `MockDeriveService` with zero backend blocking.
* **Sami (Platform + Intelligence + Operations)**:
  - Supabase database schema, migrations, RLS policies, Edge Functions (`supabase/**`), intelligence workflows, and founder operations console (`admin/**`).
  - Implements `RemoteDeriveService` fulfilling the exact same contract.

### Toggling Between Mock and Remote Backend
The service factory supports selecting the remote backend adapter:
```bash
# In your local .env:
EXPO_PUBLIC_USE_REMOTE_SERVICE=true
```
*Note: The mobile client currently operates primarily against local Zustand stores and `MockDeriveService`. `RemoteDeriveService` and the Supabase platform are in active development (S1A data plane complete; S1B/S2 remote row mapping and live functions in progress). Enabling this flag alone does not make the application production-ready against a remote backend.*

---

## 4. Repository Documentation Sitemap

Before beginning substantial feature work, consult the core documentation:
* [`AGENTS.md`](AGENTS.md): Essential orienting instructions, bootstrap rules, and architecture challenge protocol for AI agents and founders.
* [`docs/CONTEXT_SYNC.md`](docs/CONTEXT_SYNC.md): Cross-founder and cross-agent durable synchronization ledger.
* [`docs/PROJECT_CONTEXT.md`](docs/PROJECT_CONTEXT.md): Strategic context, target customers, Founding Beta concierge operating model, and business hypotheses.
* [`docs/PRODUCT.md`](docs/PRODUCT.md): Full product specification, navigation, autopilot vs. depth philosophy, baseline photo capture, and care loop.
* [`docs/OWNERSHIP.md`](docs/OWNERSHIP.md): Granular file ownership and contract change rules.
* [`docs/ROADMAP.md`](docs/ROADMAP.md): Independent sprint milestones (K1–K5 and S1–S5).
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
