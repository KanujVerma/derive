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
│  │ (Structured Outputs)   │    │ (Web Checkout $129/mo)  │  │
│  └────────────────────────┘    └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 1. Mobile Client Layer (Kanuj)
* **Framework**: React Native 0.81 on Expo SDK 53/54, structured via Expo Router (file-system routing in `app/`).
* **State Management**: Zustand stores (`useRoutineStore`, `useOnboardingStore`) for reactive client UI state.
* **Styling & Tokens**: Direction A Mineral tokens defined in `src/constants/theme.ts`.
* **Hardware Integrations**:
  - `expo-camera` / viewfinder for shelf scanning.
  - `expo-haptics` for tactile confirmations.
  - Native Web Speech API / native voice dictation for hands-free notes.

---

## 2. Platform & Database Layer (Sami)
* **Database**: Managed PostgreSQL on Supabase.
* **Row-Level Security (RLS)**: Enforced on every table (`profiles`, `skin_profiles`, `routines`, `check_ins`, `refill_requests`). Customer sessions authenticate with JWTs and can only access their own user records.
* **Private Storage**: Buckets for user skin photos (`customer-skin-photos`). No public read access. Photos are rendered client-side via signed time-limited URLs.
* **Auth**: Supabase Email/Password and Passwordless Magic Link auth.

---

## 3. Intelligence Orchestration Layer
* **Model**: Google Gemini 2.5 Flash via structured JSON outputs.
* **Context Assembly**: When evaluating queries, the backend injects:
  1. Customer skin profile (primary goals, midday oil, tightness).
  2. Active prescription products (e.g. Differin 0.1% schedule: Mon/Wed/Fri).
  3. Tolerated shelf products vs. past adverse reactions.
  4. Most recent weekly check-in skin state and barrier symptoms.
* **Safety Circuit Breaker**: Pre-model regex and deterministic classifier that intercepts medical emergencies before model generation.

---

## 4. Founder Console (`admin/**`)
* Dedicated operations interface for Kanuj and Sami to run the 10-customer beta:
  - **Routine Review Queue**: Authorize and adjust proposed routines before member publication.
  - **Fulfillment Desk**: Transition refill requests from `requested` to `shipped` with tracking numbers.
  - **Safety Escalation Queue**: Inspect and resolve flagged adverse reaction events.

---

## 5. Commerce & Billing
* **Platform**: Stripe Checkout for web payment of the $129/month Founding Beta tier.
* **Lifecycle**: Webhook events (`customer.subscription.created`, `invoice.payment_succeeded`) update the member's `memberships` status in Supabase.

---

## 6. Telemetry & Analytics
* **Provider**: PostHog.
* **Strict Privacy Guardrails**:
  - `disable_session_recording: true` (Session replay disabled).
  - No health photos, symptoms, or chat text transmitted.
  - Event payloads restricted to allowlisted navigation and operational milestones.
