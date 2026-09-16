# Derive Agent Guide

## A. What Derive Is
Derive is a **managed skincare service** ("Your skincare, handled").
It is:
- A personalized, set-it-and-forget-it care service for 10 initial Founding Beta members ($129/month).
- Grounded in persistent customer history, active schedules, and observed skin tolerance over time.
- Supported by manual founder operations and human verification before routine publication.

It is **NOT**:
- An "AI dermatologist" or clinical diagnostic device.
- A generic barcode scanner with arbitrary numerical scores (no Yuka/OnSkin blacklists).
- An ungrounded conversational chatbot.
- An anxious daily habit tracker (zero streak counters, zero daily check-in guilt).

## B. Current V1 Information Architecture
- **Today**: "What matters right now" (2-second status glance, tonight's routine preview, active refill shipment banner, research insight card).
- **Plan**: Canonical routine schedule & bathroom shelf audit (KEEP / PAUSE / REPLACE / ADD badges, dosage amounts, rationales).
- **Scan**: Fast camera shelf/store scanner with 6 categorical verdicts, routine impact, and 1-tap handoff to Ask.
- **Ask**: Grounded editorial skincare intelligence, contextual product follow-up banner, and integrated voice dictation.
- **Progress**: Longitudinal skin record (weekly check-ins, side-by-side photo comparison, plain-English learned observations).
- **Supporting Member Screens**: Managed Refills & Orders (`app/orders`), Research Detail (`app/insights/[id]`), Account Profile (`app/profile`), Founder Review Queue (`app/founder`).

## C. Founder Ownership
- **Kanuj (Customer Experience + Mobile)**:
  - Mobile application (`app/**`), customer navigation, components (`src/components/**`), visual design & tokens (`src/constants/theme.ts`), haptics, voice UI, camera UX, mobile analytics allowlist, Expo/EAS config.
  - Customer AI experience: how scan verdicts feel, explanation presentation, Ask interaction flow.
- **Sami (Platform + Intelligence + Operations)**:
  - Supabase backend (`supabase/**`), database schema, migrations, RLS, private storage, deletion.
  - Server-side intelligence workflows, context assembly, model orchestration, structured outputs.
  - Founder operations console (`admin/**`), routine review queue, fulfillment operations, Stripe commerce backend.

## D. Shared Contract Rule
The contract layer (`src/contracts/**`, `src/domain/**`) is the shared integration boundary.
- **Stable Boundary**: Kanuj develops against `MockDeriveService` (`src/services/mock/**`); Sami implements `RemoteDeriveService` (`src/services/remote/**`).
- Any contract or schema modification requires:
  1. Concrete business/technical rationale.
  2. Backward compatibility where practical.
  3. Clear documentation in PR.
  4. Communication to / review by the other founder before merge.

## E. Evidence Priority
When resolving truth or discrepancies:
1. **Actual repository, runtime code, and passing tests**
2. **Actual customer behavior & feedback**
3. **Accepted contracts & decision logs (`docs/DECISIONS.md`)**
4. **Primary platform documentation (Expo, Supabase, Postgres, React Native)**
5. **Dermatological & cosmetic research evidence**
6. **Intuition**

## F. Safety & Privacy Invariants
- **Cosmetic Skincare Only**: Never diagnose conditions (e.g. eczema, melanoma, cystic acne infection).
- **Clinical Circuit Breaker**: Immediate escalation to in-person medical care upon detecting emergency symptoms (facial swelling, respiratory distress, blistering rash with oozing).
- **Zero Raw Audio Storage**: Voice dictation transcribes client-side via speech recognition; no raw audio is recorded, stored, or transmitted.
- **Private Health Data**: Skin photos and reaction notes are treated as private medical context; never upload to public storage buckets or log in telemetry.
- **Telemetry Boundaries**: Session replay is strictly OFF (`disable_session_recording: true`). Only allowlisted interaction and navigation events are tracked.
- **No Secrets in Code**: API keys, Supabase service roles, and private tokens belong exclusively in uncommitted `.env` files. Gemini credentials are server/Supabase secrets only — never `EXPO_PUBLIC_*` client variables.

## G. Completion Rules
Before claiming any task complete:
1. Run test suite: `npm test` (must pass 100%).
2. Run typecheck: `npx tsc --noEmit` (0 errors).
3. Run web build: `EXPO_NO_TELEMETRY=1 npx expo export -p web` (must succeed cleanly).
4. Inspect git diff: verify no unintended files, secrets, or temporary files are staged.
5. Verify that founder ownership boundaries were respected.

## H. Parallel Agent Rules
- **Do not broadly refactor the other founder's lane.**
- **Do not overwrite accepted work** without an explicit, verifiable technical rationale.
- **Communicate contract/schema changes** immediately.
- **Repository state beats stale prompt context.** Always inspect the current tree before writing code.

## I. Required Reading
Before starting substantial work:
1. [`docs/PROJECT_CONTEXT.md`](docs/PROJECT_CONTEXT.md)
2. [`docs/OWNERSHIP.md`](docs/OWNERSHIP.md)
3. [`docs/ROADMAP.md`](docs/ROADMAP.md)
4. [`docs/INTERFACES.md`](docs/INTERFACES.md)
