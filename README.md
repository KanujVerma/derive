# Derive: "Your skincare, handled."

Managed skincare service for the 10-customer Founding Beta ($129/month).
Built on Apple-grade minimalism, contextual intelligence, and persistent customer care.

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

---

## 2. Tech Stack

- **Mobile Client**: Expo SDK 57, React Native 0.86, TypeScript (strict mode), Expo Router (file-based navigation in `app/`), Zustand state stores.
- **Visual Design**: Direction A Mineral (Warm Ivory `#F6F3EC`, Elevated Surface `#FFFEFB`, Architectural Charcoal `#171A18`, Mineral Green `#345447`).
- **Platform / Backend**: Supabase (PostgreSQL, Row-Level Security, Auth, Edge Functions, Private Storage).
- **Intelligence**: Server-side Google Gemini 2.5 Flash via structured JSON schemas, coupled with deterministic safety circuit breakers.
- **Commerce**: Stripe web checkout for Founding Beta memberships ($129/month).
- **Telemetry**: PostHog (Session Replay strictly disabled; typed navigation allowlist only).

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
To switch the mobile application from local mock mode to live Supabase services:
```bash
# In your local .env:
EXPO_PUBLIC_USE_REMOTE_SERVICE=true
```

---

## 4. Repository Documentation Sitemap

Before beginning substantial feature work, consult the core documentation:
* [`AGENTS.md`](AGENTS.md): Essential orienting instructions for autonomous AI agents.
* [`docs/PROJECT_CONTEXT.md`](docs/PROJECT_CONTEXT.md): Strategic context, target customers, and business goals.
* [`docs/OWNERSHIP.md`](docs/OWNERSHIP.md): Granular file ownership and contract change rules.
* [`docs/ROADMAP.md`](docs/ROADMAP.md): Independent sprint milestones (K1–K5 and S1–S5).
* [`docs/INTERFACES.md`](docs/INTERFACES.md): Runtime contract specifications and error models.
* [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): System topology and data flow.
* [`docs/DESIGN.md`](docs/DESIGN.md): Direction A Mineral design tokens and Apple HIG guidelines.
* [`docs/SAFETY_PRIVACY.md`](docs/SAFETY_PRIVACY.md): Medical boundaries, private photo storage, and telemetry guardrails.
* [`docs/DECISIONS.md`](docs/DECISIONS.md): Concise log of accepted architecture decisions (ADRs).
* [`docs/RESEARCH.md`](docs/RESEARCH.md): Competitor teardowns and user discovery research.

---

## 5. Continuous Integration (CI)

Every PR must pass:
1. `npm test` — Unit test suite (Safety classifier, routine invariants, ingredient intelligence, contract mocks).
2. `npx tsc --noEmit` — Strict TypeScript compiler check across all routes and components.
3. `EXPO_NO_TELEMETRY=1 npx expo export -p web` — Production bundle build.
