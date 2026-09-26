# Derive: Scanner-first personalized skincare product intelligence

Free Check helps a customer understand what Derive actually knows about a skincare product and, when enough supported personal context exists, what that person should do with it and why. Derive does not use a universal numerical compatibility, product-health, or ingredient score. “Personalized Yuka for skincare” is internal shorthand only, not customer-facing positioning.

The paid hypothesis is **$25/month Managed Skincare** for ongoing routine management, adaptation, check-ins, progress, and product decisions. Pricing, retention, and hosted billing activation remain separate validation and implementation questions.

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

## 2. Tech Stack and Current Runtime Boundary

- **Mobile client:** Expo SDK 57, React Native 0.86, TypeScript strict mode, Expo Router, and Zustand.
- **Visual design:** Direction A Mineral tokens and shared design system.
- **Capture:** Check currently uses Expo Camera directly for camera/barcode input. Photo evidence handling is integrated locally; photo-only OCR or image recognition is not implemented.
- **Platform:** Supabase PostgreSQL, Auth, RLS, private Storage, and Edge Functions. The scanner-first free path, profile, fit, history, and evidence flows are bounded local Development integrations. Remote Staging and production retain legacy managed routing; hosted guest activation remains gated.
- **Intelligence:** Current free Personal Fit is a narrow sequential first-match implementation. Existing server-side Gemini paths are partial/configuration-dependent; no product-photo extraction provider has been benchmarked or selected.
- **Commerce:** S5 membership Checkout, Billing Portal, and signed subscription webhooks are implemented. Hosted activation remains pending. Products are purchased separately; C1.5B feeds and C1.5C physical checkout are parked.
- **Managed access:** E1 controls legacy managed Remote access. It does not mean the hosted scanner-first free experience is active. Mock remains the default; physical scanner acceptance is unverified.
- **Telemetry:** PostHog transmission is not active; session replay remains disabled. Do not send health, profile, ingredient, or photo data to analytics.

---

## 3. Feature Ownership

New active work uses one founder DRI per feature, accountable end-to-end across client, backend, persistence, tests, integration, and acceptance.

Current recommended P0 split:

- **P0-A Capture + Product Resolution: Sami.** Sami may implement whatever client, backend, persistence, test, and device work this outcome requires.
- **P0-B Personal Decision Intelligence: Kanuj.** Kanuj may implement whatever backend, persistence, intelligence, test, and client work this outcome requires.

Sami is the default platform/truth steward for cross-cutting Auth, RLS, Storage, identity, billing, product/formula, and migration invariants. Kanuj is the default customer-experience steward for navigation, shared design, Check, result hierarchy, app shell, cross-feature behavior, and physical acceptance standards. Stewardship reviews protected invariants; it does not transfer feature ownership.

Founders and subagents may work in parallel on independent features or workstreams with disjoint write-sets. A dependency may block integration, not independent work against a stable contract or fixture. Keep shared contracts, migration ordering, authoritative truth promotion, and high-contention composition files single-writer, then integrate in one bounded composition pass. Name a cross-product release DRI before final release acceptance.

See [AGENTS.md](AGENTS.md), [docs/ROADMAP.md](docs/ROADMAP.md), and [docs/OWNERSHIP.md](docs/OWNERSHIP.md) for active guidance.

---

## 4. Local Modes and Remote Staging
The service factory supports selecting the remote backend adapter:
```bash
# In your local .env:
EXPO_PUBLIC_USE_REMOTE_SERVICE=true
```
*Note: Mock remains the default. Development Remote is integrated for the scanner-first free path only against an exact local Supabase host. Remote Staging and production retain legacy managed routing, and hosted guest activation remains gated. H1A verified selected hosted post-auth flows; provider proposal/publication, real email OTP, Stripe test-mode lifecycle, and production readiness remain open. Enabling this flag alone is not a production readiness check.*

L0 defines a separate `remote-staging` EAS profile for a store-signed Remote test build. It selects EAS `preview`; H1A verified the existing hosted Derive project and configured the matching public preview URL/key. No device build has been accepted. The production profile remains Mock. The H1A hosted post-auth baseline and blocked provider/publication gates are in [`docs/HOSTED_REMOTE_SMOKE.md`](docs/HOSTED_REMOTE_SMOKE.md); build preflight is in [`docs/ENVIRONMENT.md`](docs/ENVIRONMENT.md).

---

## 5. Repository Documentation Sitemap

Before beginning substantial feature work, consult the core documentation:
* [AGENTS.md](AGENTS.md): Concise agent guardrails, truth hierarchy, ownership, and validation requirements.
* [`docs/CONTEXT_SYNC.md`](docs/CONTEXT_SYNC.md): Repository-native checkpoint ledger; older entries are historical.
* [docs/PROJECT_CONTEXT.md](docs/PROJECT_CONTEXT.md): Current scanner-first direction, local implementation status, and business hypotheses.
* [docs/PRODUCT.md](docs/PRODUCT.md): Current scanner-first product target and clearly labeled historical managed-first details.
* [docs/OWNERSHIP.md](docs/OWNERSHIP.md): Feature DRI, horizontal stewardship, and parallelism.
* [`docs/ENVIRONMENT.md`](docs/ENVIRONMENT.md): Environment-variable inventory, credential boundaries, and safe Supabase setup workflow.
* [docs/ROADMAP.md](docs/ROADMAP.md): Active P0 feature DRIs, release gates, and historical delivery record.
* [`docs/FIRST_CUSTOMER_TEST.md`](docs/FIRST_CUSTOMER_TEST.md): Current first-customer acceptance script.
* [`docs/INTERFACES.md`](docs/INTERFACES.md): Runtime contract specifications, error models, and semantic requirements for backend evolution.
* [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): System topology, security boundaries, and data flow.
* [`docs/DESIGN.md`](docs/DESIGN.md): Direction A Mineral design tokens, spatial grammar, and Apple HIG guidelines.
* [`docs/SAFETY_PRIVACY.md`](docs/SAFETY_PRIVACY.md): Medical boundaries, private photo storage, non-discrimination invariants, and telemetry guardrails.
* [`docs/DECISIONS.md`](docs/DECISIONS.md): Concise log of accepted architecture decisions (ADRs) and open challenges.
* [`docs/RESEARCH.md`](docs/RESEARCH.md): Competitor teardowns, beta learning hypotheses, preliminary customer survey evidence, and peer-reviewed dermatological references.

---

## 6. Continuous Integration (CI)

Every PR must pass:
1. `npm test` — Unit test suite (Safety classifier, routine invariants, ingredient intelligence, contract mocks).
2. `npx tsc --noEmit` — Strict TypeScript compiler check across all routes and components.
3. `EXPO_NO_TELEMETRY=1 npx expo export -p web` — Production bundle build.
