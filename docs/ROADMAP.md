# Derive V1 Roadmap: Independent Founder Workstreams

Derive divides engineering into two independent, unblocked workstreams anchored on a shared contract layer.

---

## Kanuj Workstream (Customer Experience + Mobile)

### K1: Native Mobile Foundation
* **Scope**: True native 5-tab bar, Apple Liquid Glass materials, tab bottom safe-area insets (`paddingBottom: insets.bottom + 120`), native iOS haptics, motion curves, and Reduce Motion / Reduce Transparency accessibility support.
* **Acceptance Criteria**:
  - Five tabs switch instantly with correct active icons and mineral green accent.
  - Scrollable content and primary CTA buttons never collide with or get trapped behind the tab bar on any iOS device.
  - Haptics fire reliably on physical devices; fallback cleanly on simulators.

### K2: Customer Onboarding & Intake
* **Scope**: Production camera capture for bathroom shelf bottles, confirmed product rows, adverse reaction history, reordered safety questionnaire (known allergies + Differin shelf check), guided 3-angle photos with voice context note, and audit summary.
* **Acceptance Criteria**:
  - Member can complete full onboarding in under 4 minutes.
  - No duplicate questions or medical jargon.
  - Shelf products correctly populate the summary card.
  - Full flow executable against `MockDeriveService`.

### K3: Core Five Tabs Experience
* **Scope**:
  - **Today**: 2-second status card, tonight routine preview, refill shipping tracker banner, and clinical insight card.
  - **Plan**: Canonical routine drawer with dosages, application zones, rationales, and shelf product audit.
  - **Scan**: Center tab viewfinder, instant recognition, categorical verdicts, and 1-tap Ask handoff.
  - **Ask**: Grounded conversation, scanned product context banner, voice dictation, and emergency circuit breaker modal.
  - **Progress**: Weekly check-in flow, side-by-side photo comparison, and plain-English learned observations.
* **Acceptance Criteria**:
  - All 5 tabs deliver distinct, high-signal value.
  - Scan → Ask handoff carries product state without re-scanning.
  - Zero streak counters or anxiety triggers.

### K4: Consumer Polish & Resilience
* **Scope**: Tactile loading skeletons, empty states (e.g. no reactions, no active shipments), network error banners, dynamic type scaling, contrast compliance (WCAG AA), and PostHog privacy-safe client analytics.
* **Acceptance Criteria**:
  - App displays graceful states under slow or absent connectivity.
  - Font scaling passes accessibility testing on small iPhones (iPhone SE).
  - Telemetry strictly validates against the allowlisted event catalog.

### K5: Mobile Release & TestFlight
* **Scope**: EAS configuration, development client builds, production provisioning profiles, TestFlight deployment, and first-customer test script.
* **Acceptance Criteria**:
  - Installable iOS internal TestFlight build distributed to founders.
  - Onboarding, scanning, and chat verified on physical hardware.

---

## Sami Workstream (Platform + Intelligence + Operations)

### S1: Platform Foundation
* **Scope**: Supabase setup, baseline PostgreSQL schema, reproducible migration scripts, customer authentication, private photo storage buckets, Row-Level Security (RLS) policies, and secure environment secrets management.
* **Acceptance Criteria**:
  - Migrations run cleanly from a fresh Supabase database.
  - RLS strictly isolates member data: customer can only read/write their own records.
  - Customer skin photos accessible solely via short-lived signed URLs (no public URLs).
  - Zero secrets committed to version control.

### S2: Core Domain Persistence
* **Scope**: Relational tables and queries for customer profiles, skin profiles, catalog products, formula snapshots, product reactions, ingredient signals, routine versions, weekly check-ins, photo records, and refill orders.
* **Acceptance Criteria**:
  - Canonical state persists reliably across app restarts.
  - Routine updates create new version snapshots rather than overwriting historical records.
  - Product reactions persist historical formula snapshots at the exact time of the reaction.

### S3: Server-Side Intelligence Services
* **Scope**: Edge Functions for routine proposal generation, product scan evaluation with categorical verdicts, Ask Derive conversation synthesis, safety classifier circuit breaker, and probabilistic ingredient signal inference.
* **Acceptance Criteria**:
  - Edge Function endpoints satisfy `IDeriveService` shared contracts.
  - Prompt context includes user's active prescriptions, Differin schedule, and reaction history.
  - All mandatory emergency/red-flag fixtures escalate correctly; no known mandatory-escalation fixture is missed; the classifier remains conservative under uncertainty.
  - Ingredient signals update confidence based on multi-product overlap and tolerated exposure discounting.

### S4: Founder Operations Console
* **Scope**: Lightweight internal administrative portal (`admin/**`) for managing the initial 10 Founding Beta customers ($129/mo). Routine review queue, refill replenishment status updater, product formula auditor, and internal clinical notes.
* **Acceptance Criteria**:
  - Founders can review, edit, and publish routine proposals before member notification.
  - Refill orders can be transitioned (`requested` → `ordered` → `shipped` → `delivered`) with carrier tracking numbers.
  - Safety escalation flags appear in an urgent review queue.

### S5: Commerce & Remote Service Integration
* **Scope**: Stripe checkout / customer portal integration for $129/month Founding Beta memberships, webhook listeners for subscription lifecycle, and `RemoteDeriveService` client adapter implementation.
* **Acceptance Criteria**:
  - Stripe webhook maps customer email to Supabase member record.
  - `RemoteDeriveService` passes the full test suite against live Supabase Edge Functions.
  - Mobile app can toggle from `MockDeriveService` to `RemoteDeriveService` via a single environment flag.

---

## Shared Milestone

### I1: Mock → Remote DeriveService Integration
* **Scope**: Joint end-to-end integration test verifying complete customer lifecycle on live backend:
  Onboarding → Profile → Routine Generation → Founder Review & Approval → Today Display → Shelf Audit → Product Scan → Ask Context → Weekly Check-In → Refill Request → Tracking.
* **Acceptance Criteria**:
  - Kanuj switches `EXPO_PUBLIC_USE_REMOTE_SERVICE=true` without changing UI code.
  - All flows execute flawlessly end-to-end.
