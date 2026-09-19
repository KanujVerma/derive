# Derive Engineering Ownership & Boundaries

To enable Kanuj and Sami to work with maximum velocity and zero blocking, Derive strictly separates ownership lanes while preserving a thin, stable shared contract boundary.

---

## 1. Founder Lanes

### KANUJ: Customer Experience + Mobile
* **Primary Objective**: Make Derive feel effortless, calm, and trustworthy to the customer.
* **Primary Files & Directories**:
  - `app/**` (All customer navigation, layouts, tabs, screens)
  - `src/components/**` (UI components, cards, headers, sheets, modals, voice button)
  - `src/constants/theme.ts` (Design tokens, Direction A Mineral colors, typography)
  - `src/services/mock/**` (Mock fixtures, deterministic client simulations)
  - `src/phenotype/**`, `src/pricing/**` (Client-side phenotype and evidence-policy prototypes; `src/pricing/**` is the superseded all-in membership engine, scheduled for removal in I1-B4A — still Kanuj-owned until then)
  - `src/services/analytics.ts` (Client-side tracking allowlist)
  - `assets/**` (Brand marks, icons, media)
  - `app.json`, `eas.json` (Mobile configuration & native build profiles)
* **Kanuj's AI Scope**: Customer-facing interaction design of intelligence (scan verdict presentations, contextual Ask banners, clarification sheets).

### SAMI: Platform + Intelligence + Operations
* **Primary Objective**: Make Derive reliably work behind the interface with ironclad persistence, safety, and operations.
* **Primary Files & Directories**:
  - `supabase/**` (Postgres schemas, migrations, RLS policies, seed scripts)
  - `supabase/functions/**` (Edge functions, API handlers, webhook receivers)
  - `admin/**` (Founder review queue, fulfillment operations console)
  - `src/services/remote/**` (RemoteDeriveService Supabase integration)
  - `src/services/ai-workflows/**` (Context assembly, LLM prompts, structured outputs)
  - Server-side commerce (Stripe checkout, customer subscription management)
  - Backend telemetry & private storage buckets
* **Sami's AI Scope**: Server-side model orchestration, multi-turn context synthesis, ingredient intelligence inference, safety classification accuracy.

---

## 2. Shared Territory & Contract Governance

The following areas are shared:
- `src/contracts/**` (`IDeriveService`)
- `src/domain/**` (Shared canonical data models)
- `src/types/schema.ts` (Validation schemas & core types)
- `package.json`, `package-lock.json`
- `tsconfig.json`
- `.github/**` (CI workflows & PR templates)
- `docs/**` (Architecture, decisions, roadmap)

### Strict Contract Change Procedure
Shared contracts are frozen during feature sprints. If a change is needed:
1. Keep the change minimal and backward-compatible.
2. Discuss with the other founder before modifying.
3. Document the rationale in the PR using the Pull Request Template.
4. Obtain explicit approval before merging to `main`.

---

## 3. Discouraged Cross-Lane Changes

| Owner | Discouraged / Prohibited Area | Rationale |
| :--- | :--- | :--- |
| **Kanuj** | `supabase/**`, backend RLS, migration files | Prevents database schema drift and permission regressions. |
| **Sami** | `app/**`, mobile design tokens, visual layouts | Prevents UI regressions and broken customer mobile flows. |

---

## 4. Git Branching & Merging Guidelines
- `main` is always green, tested, and deployable.
- Feature branches are short-lived:
  - `kanuj/<feature>` (e.g. `kanuj/native-tabs`, `kanuj/scan-viewfinder`)
  - `sami/<feature>` (e.g. `sami/supabase-auth`, `sami/edge-functions`)
- When working on the same machine, use **Git worktrees** to isolate working directories cleanly without stash juggling.
