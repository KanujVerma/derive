# Derive Agent Guide

## A. What Derive Is
Derive is a **managed skincare service** ("Your skincare, handled").
It is:
- A personalized, set-it-and-forget-it care service for 10 initial Founding Beta members (personalized all-in monthly pricing; baseline ~$49–$129/mo derived dynamically from active routine consumption).
- Grounded in persistent customer history, active schedules, and observed skin tolerance over time.
- Supported by manual founder operations and human verification before routine publication.

It is **NOT**:
- An "AI dermatologist" or clinical diagnostic device.
- A generic barcode scanner with arbitrary numerical scores (no Yuka/OnSkin blacklists).
- An ungrounded conversational chatbot.
- An anxious daily habit tracker (zero streak counters, zero daily check-in guilt).

## B. Current V1 Information Architecture
- **Today**: "What matters right now" (2-second status glance, quiet draft preview mode when initial plan is in review with `DRAFT · NOT ACTIVE` indicator, tappable tonight's routine preview, active refill shipment banner, research insight card, 44x44 pt account affordance).
- **Plan**: Canonical routine schedule & bathroom shelf audit (top SegmentedControl toggling `ROUTINE` vs `PRODUCTS`, `DRAFT · NOT ACTIVE` banner when in review, KEEP / PAUSE / REPLACE / ADD badges, dosage amounts, rationales, disclosure chevrons, consolidated managed refill action, 44x44 pt account affordance).
- **Scan**: Pure camera-first viewfinder (no manual tabs), automatic multi-attribute recognition, fallback name search, split evaluation (`FIT FOR YOU RIGHT NOW` vs `FORMULA QUALITY`), 1-tap handoff to Ask, 44x44 pt account affordance.
- **Ask**: Grounded editorial skincare intelligence, contextual product follow-up banner, starter chip routing to `/scan`, refined composer with integrated voice dictation, multiline action callout wrapping, 44x44 pt account affordance.
- **Progress**: Longitudinal skin record (100% AI-led weekly check-ins, side-by-side photo comparison with full-width SegmentedControl angles, friendly dates, plain-English learned observations, 44x44 pt account affordance).
- **Supporting Member Screens**: Managed Refills & Orders (`app/orders`), Research Detail (`app/insights/[id]`), Cleaned Customer Account Profile (`app/profile`) with personalized plan pricing, Founder Review Queue (`app/founder`).

## C. Founder Ownership
- **Kanuj (Customer Experience + Mobile)**:
  - Mobile application (`app/**`), customer navigation, components (`src/components/**`), visual design & tokens (`src/constants/theme.ts`), haptics, voice UI, camera UX, mobile analytics allowlist, Expo/EAS config.
  - Customer AI experience: how scan verdicts feel, explanation presentation, Ask interaction flow.
  - Client-side phenotype, pricing prototypes, and evidence-policy modules (`src/phenotype/**`, `src/pricing/**`).
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
  3. Clear documentation in PR and `docs/CONTEXT_SYNC.md`.
  4. Communication to / review by the other founder before merge.

## E. Evidence-Grounded Challenge & Priority Protocol
Future agents and founders are authorized and expected to challenge architectural assumptions when strong evidence warrants it.
- **Challenge Authority != Change Authority**: An agent may challenge any decision, but may NOT silently replace material architecture without founder alignment.
- **Valid Evidence**: Grounded in repo code/tests, runtime behavior, platform documentation, or peer-reviewed dermatological/cosmetic research. Not personal preference.
- **Discrepancy Priority**:
  1. **Actual repository, runtime code, and passing tests**
  2. **Explicit founder decisions + actual customer evidence**
  3. **Accepted contracts & decision logs (`docs/DECISIONS.md`, `docs/CONTEXT_SYNC.md`)**
  4. **Primary platform documentation (Expo, Supabase, Postgres, React Native)**
  5. **Dermatological & cosmetic research evidence**
  6. **Intuition**

## F. Safety, Privacy & Phenotype Invariants
- **Cosmetic Skincare Only**: Never diagnose conditions (e.g. eczema, melanoma, cystic acne infection).
- **Clinical Circuit Breaker**: Immediate escalation to in-person medical care upon detecting emergency symptoms (facial swelling, respiratory distress, blistering rash with oozing).
- **Never Race-Aware / Non-Discrimination**: Zero race/ethnicity classifiers, CV colorimeters, or Fitzpatrick ML inference. Skincare recommendations never branch on racial groups or ancestry.
- **Confirmation Invariant**: Explicit member confirmation strictly outranks unconfirmed estimates (`setOrConfirmPhenotypeValue`). Unconfirmed estimates cannot overwrite confirmed truth.
- **Evidence vs. Applicability**: Methodological strength (Grade A/B/C/D) is distinct from member applicability. Grade C/D population claims cannot silently alter active routines.
- **Zero Raw Audio Storage**: Voice dictation transcribes client-side via speech recognition; no raw audio is recorded, stored, or transmitted.
- **Private Health Data**: Skin photos and reaction notes are treated as private medical context; never upload to public storage buckets or log in telemetry.
- **Telemetry Boundaries**: Session replay is strictly OFF (`disable_session_recording: true`). Only allowlisted interaction and navigation events are tracked.
- **No Secrets in Code**: API keys, Supabase service roles, and private tokens belong exclusively in uncommitted `.env` files. Gemini credentials are server/Supabase secrets only — never `EXPO_PUBLIC_*` client variables.

## G. Global Cross-Founder Agent Bootstrap & Sync Protocol
Every substantial agent run on either founder's machine must begin and finish with this protocol:
1. **Bootstrap / Context Recovery**:
   - Read `AGENTS.md`
   - Read `docs/CONTEXT_SYNC.md`
   - Read `docs/PROJECT_CONTEXT.md`
   - Read `docs/DECISIONS.md`
   - Read `docs/ROADMAP.md`
   - Read `docs/OWNERSHIP.md`
   - Inspect local git state: `git status --short`, `git diff --stat`
   - Fetch remote: `git fetch origin` and compare local vs remote without discarding local work.
2. **Durable Context Ledger Sync**:
   - If changing product semantics, architecture, shared contracts, safety rules, or pricing, the agent MUST update `docs/CONTEXT_SYNC.md` and relevant domain docs before completing.
   - Record decision status explicitly: `PROPOSED`, `APPROVED`, or `IMPLEMENTED`.
   - If unable to directly write to the founder Drive brief, emit `DRIVE_SYNC_PAYLOAD` in the completion report.

## H. Completion Rules
Before claiming any task complete:
1. Run test suite: `npm test` (must pass 100%).
2. Run typecheck: `npx tsc --noEmit` (0 errors).
3. Run web build: `EXPO_NO_TELEMETRY=1 npx expo export -p web` (must succeed cleanly).
4. Inspect git diff: verify no unintended files, secrets, or temporary files are staged.
5. Verify that founder ownership boundaries were respected.
