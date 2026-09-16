# Derive Architecture Decision Records (ADRs)

Key technical and product decisions accepted for Derive V1.

---

### ADR-01: React Native + Expo Router over Native Swift
* **Decision**: Build V1 on React Native with Expo Router.
* **Rationale**: Enables unified iOS, web, and future Android support with rapid iteration velocity, while retaining native iOS performance, haptics, and camera capabilities.

### ADR-02: Five Primary Native Tabs with Center Scan
* **Decision**: Adopt a 5-tab architecture: `Today` | `Plan` | `Scan` | `Ask` | `Progress`.
* **Rationale**: Elevates product scanning to a first-class native destination at position 3, providing immediate in-store utility without requiring users to navigate into chat.

### ADR-03: Scan Separated from Ask
* **Decision**: Provide a dedicated Scan tab while allowing 1-tap handoff into Ask.
* **Rationale**: Fast evaluation requires a zero-friction viewfinder and structured categorical verdict. Deeper questions can flow into Ask without cluttering the scanner.

### ADR-04: Direction A (Mineral) Design Language
* **Decision**: Style V1 using Warm Ivory (`#F6F3EC`), Elevated Surface (`#FFFEFB`), Architectural Charcoal (`#171A18`), and Mineral Green (`#345447`).
* **Rationale**: Delivers an understated luxury aesthetic that feels calm and restorative, distinctly separated from neon habit trackers or cold clinical portals.

### ADR-05: Supabase as Core Platform
* **Decision**: Use Supabase (Postgres, RLS, Auth, Edge Functions, Private Storage).
* **Rationale**: Delivers reproducible relational schema migrations, rock-solid row-level security for private health data, and fast serverless functions without heavy cloud infrastructure.

### ADR-06: Mock-First Service Contract Boundary
* **Decision**: Freeze `IDeriveService` shared contract; mobile consumes `MockDeriveService` while backend implements `RemoteDeriveService`.
* **Rationale**: Unblocks Kanuj (mobile) and Sami (backend) to work independently for days without blocking on each other.

### ADR-07: Kanuj & Sami Ownership Split
* **Decision**: Kanuj owns mobile UX, client AI experience, navigation, components, and design tokens. Sami owns Supabase, migrations, RLS, server AI workflows, operations console, and commerce.
* **Rationale**: Eliminates cross-lane merge conflicts and establishes crystal-clear accountability.

### ADR-08: Categorical Verdicts over Numerical Scores
* **Decision**: No arbitrary numerical ratings (e.g. "82/100" or "Clean/Dirty"). Use 6 clear categorical verdicts (`GREAT FIT`, `COULD WORK`, `NOT NEEDED`, `BETTER AS A REPLACEMENT`, `USE WITH CAUTION`, `NOT A GOOD FIT RIGHT NOW`).
* **Rationale**: A product is neither good nor bad in the abstract; fit is entirely contextual to this user's active routine and skin barrier.

### ADR-09: Research Intelligence as P1
* **Decision**: Surface curated clinical research directly in Today and Plan.
* **Rationale**: Builds member trust and demonstrates that Derive is grounded in published dermatological literature rather than influencer marketing.

### ADR-10: Manual Operations & $129/Month Canonical Pricing
* **Decision**: Launch Founding Beta at $129/month for 10 initial members with manual founder review and manual fulfillment desk.
* **Rationale**: High-touch founder concierge ensures quality and fast customer learning before premature operational automation.

### ADR-11: Gemini Credentials Stay Server-Side
* **Decision**: The Expo/mobile client never embeds a Gemini API key and never calls Gemini directly. Live model invocation belongs in the trusted Supabase/server environment behind `RemoteDeriveService`.
* **Rationale**: A client-visible Gemini key would expose a paid API credential and send customer health context from the device. Kanuj continues on `MockDeriveService` with deterministic local reasoning; Sami owns server secrets and Edge Function orchestration.
