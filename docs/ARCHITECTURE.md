# Derive System Architecture

## Architecture Overview

Derive couples an Apple-grade client application with a privacy-first, model-orchestrated backend platform.

```
┌─────────────────────────────────────────────────────────────┐
│                 MOBILE CLIENT (Kanuj Lane)                  │
│       Expo Router • React Native • TypeScript • Zustand     │
│   Today  •  Plan  •  Scan (Viewfinder)  •  Ask  •  Progress │
└──────────────────────────────┬──────────────────────────────┘
                               │
               ┌───────────────┴───────────────┐
               │    IDeriveService Contract    │
               │   (Shared Integration Layer)  │
               └───────┬───────────────┬───────┘
                       │               │
        ┌──────────────▼──────┐ ┌──────▼─────────────────────┐
        │  MockDeriveService  │ │ RemoteDeriveService        │
        │  (Local Deterministic│ │ (Supabase Client Adapter)  │
        │   Fast Dev & Tests) │ └──────────────┬─────────────┘
        └─────────────────────┘                │
                                               │ HTTPS / Signed JWT
                                               ▼
┌─────────────────────────────────────────────────────────────┐
│                PLATFORM BACKEND (Sami Lane)                 │
│  Supabase Postgres • Auth • Private Storage • RLS Policies   │
│                                                             │
│  ┌────────────────────────┐    ┌─────────────────────────┐  │
│  │     Edge Functions     │    │  Founder Admin Console  │  │
│  │ - Routine Generator    │    │ - Routine Review Queue  │  │
│  │ - Scan Evaluator       │    │ - Refill Operations     │  │
│  │ - Chat Advisor         │    │ - Clinical Safety Queue │  │
│  │ - Safety Classifier    │    └─────────────────────────┘  │
│  └───────────┬────────────┘                                 │
│              │                                              │
│              ▼                                              │
│  ┌────────────────────────┐    ┌─────────────────────────┐  │
│  │ Google Gemini 2.5 Flash│    │ Stripe Commerce API     │  │
│  │ (Structured Outputs)   │    │ (Web Checkout Personalized Plan)  │  │
│  └────────────────────────┘    └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 1. Mobile Client Layer (Kanuj)
* **Framework**: React Native 0.86 on Expo SDK 57, structured via Expo Router (file-system routing in `app/`).
* **State Management**: Zustand stores (`useRoutineStore`, `useOnboardingStore`) for reactive client UI state.
* **Styling & Tokens**: Direction A Mineral tokens defined in `src/constants/theme.ts`.
* **Hardware Integrations**:
  - `expo-camera` / viewfinder for shelf scanning.
  - `expo-haptics` for tactile confirmations.
  - Native Web Speech API / native voice dictation for hands-free notes.

---

## 2. Platform & Database Layer (Sami)
* **Database**: Managed PostgreSQL on Supabase.
* **Auth Data Lifecycle (S1A Implemented)**: Inserts into `auth.users` provision a matching `public.profiles` row through a `SECURITY DEFINER` trigger in the unexposed `private` schema with an empty pinned search path. Email and non-authoritative display metadata are synchronized without granting customers profile creation or email-write authority.
* **Row-Level Security (S1A Implemented)**: Every existing public application table has RLS enabled. `anon` has no application-table privileges. Authenticated members receive an explicit least-privilege operation matrix: owner-scoped profile/skin/shelf/photo/check-in/refill access, read-only membership/routine/catalog access, and no access to founder review tasks, payment identifiers, founder notes, AI analysis fields, or fulfillment state changes. Trusted service-role operations stay server-side.
* **Private Storage Data Plane (S1A Implemented)**: `customer-skin-photos` is a non-public, 10 MiB image-only bucket. Object names must begin with the authenticated member UUID (`<member-id>/<photo-type>/<opaque-file-name>`). Members can create immutable objects with non-upserting uploads, but have no direct object list/read/sign/update/delete path. Photo metadata is likewise customer-readable and insertable but not customer-deletable.
* **Signed Photo Delivery (S1 Remaining)**: The database intentionally grants no client download or signing path. A trusted JWT-bound server endpoint must validate the caller and metadata ownership, then issue a 900-second signed URL. That endpoint is not implemented yet, so the signed-URL acceptance criterion remains open.
* **Deletion (S1 Remaining)**: Relational rows cascade from profile deletion, but physical Storage objects must be deleted through the Storage API before the auth/profile record is removed. The idempotent deletion workflow is not implemented yet.
* **Client Auth (S1 Remaining)**: Supabase Email/Password and Passwordless Magic Link are the intended methods. Persistent native sessions, callback routing, and route gating require a coordinated mobile/shared implementation.
* **Remote Adapter Compatibility (S1A Implemented, Adapter Still Provisional)**: Sami-owned PostgREST projections enumerate only customer-readable routine, membership, profile, and refill columns, so column-level grants do not fail due to wildcard expansion. The adapter still requires later row-to-domain mapping, routine-item assembly, live functions, and integration tests before the remote feature flag is production-ready.

---

## 3. Intelligence Orchestration Layer
* **Model**: Google Gemini 2.5 Flash via structured JSON outputs, invoked only from the trusted Supabase/server environment.
* **Credential boundary**: Gemini API keys are server secrets. The Expo client must never read, embed, or ship a Gemini key (`EXPO_PUBLIC_*` Gemini variables are forbidden). Mobile talks to intelligence only through `IDeriveService`. `MockDeriveService` uses local deterministic reasoning; `RemoteDeriveService` calls Edge Functions that may invoke Gemini.
* **Context Assembly**: When evaluating queries, the backend injects:
  1. Customer skin profile (primary goals, midday oil, tightness).
  2. Active prescription products (e.g. Differin 0.1% schedule: Mon/Wed/Fri).
  3. Tolerated shelf products vs. past adverse reactions.
  4. Most recent weekly check-in skin state and barrier symptoms.
* **Safety Circuit Breaker**: Pre-model regex and deterministic classifier that intercepts medical emergencies before model generation.

---

## 4. Founder Console & Concierge Operations (`admin/**`)
* Dedicated administrative and concierge operations interface for Kanuj and Sami to run the 10-member Founding Beta:
  - **Routine Review Queue**: Manually review, adjust, and approve proposed routines before initial member publication or subsequent material routine changes.
  - **Fulfillment Desk**: Manually source, purchase, and track product shipments and replenishments (`requested` → `ordered` → `shipped` → `delivered`) with carrier tracking numbers.
  - **Safety Escalation Queue**: Inspect and resolve flagged adverse reaction events.
  - **Concierge MVP Bridge**: High-touch founder delivery for the first 10 members serves as an operational learning bridge; long-term operations are software-managed and AI-led.

---

## 5. Commerce & Billing
* **Platform**: Planned Stripe Checkout for web payment of Founding Beta memberships ($100/month approved first-10 beta experiment; long-term personalized pricing architecture remains provisional).
* **Lifecycle**: Webhook events (`customer.subscription.created`, `invoice.payment_succeeded`) update the member's `memberships` status in Supabase.
* **Pricing Invariant**: Covers care management plus standard routine products. No product wallet or rollover allowance. Existing working products preserved.

---

## 6. Telemetry & Analytics
* **Provider**: Planned privacy-safe telemetry (PostHog; client-side allowlist implemented in `src/services/analytics.ts`; SDK integration planned).
* **Strict Privacy Guardrails**:
  - `disable_session_recording: true` (Session replay strictly disabled).
  - Zero health data, skin photos, symptoms, or conversation text transmitted.
  - Event payloads restricted to allowlisted navigation, operational milestones, and interaction metrics.
