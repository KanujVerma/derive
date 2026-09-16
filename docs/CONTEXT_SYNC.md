# Derive Cross-Agent Context Sync Ledger

This ledger tracks durable architectural, product, and contract decisions across founder workstreams (Kanuj: Mobile/UX, Sami: Platform/Intelligence) and their respective AI agents.

**Core Rule**: A fresh agent on either founder's machine must be able to recover full shared project truth by reading `AGENTS.md`, this ledger, and the repository documentation without manual chat debriefing.

---

## 2026-09-16 — Kanuj Mobile/UX: Phenotype Architecture, Provenance & Evidence Policy (Pass 5)

- **Agent / Workstream**: Kanuj (Mobile Client, UX & Prototyping)
- **Local Branch**: `main`
- **Starting Local HEAD**: `4d4f41faa34a53a9a0abc8516676a37368cdbf04`
- **Ending Commit / HEAD**: `2866d8b` (checkpoint commit)
- **Remote Push Status**: `pushed` (verified against `origin/main`)
- **Drive Status**: `sync-required` (DRIVE_SYNC_PAYLOAD emitted in completion report)
- **Architecture Challenges Raised / Resolved**: None (all prompt assumptions validated against repository invariants)
- **Durable Changes**:
  1. **Phenotype-Aware, Never Race-Aware Architecture**: Built client/mock module `src/phenotype/` (`types.ts`, `profile.ts`, `evidence-policy.ts`, `tint-compatibility.ts`, `fixtures.ts`, `index.ts`). Explicitly prohibits race/ethnicity classifiers, CV colorimetry, Fitzpatrick ML inference, and demographic recommendation rules.
  2. **Categorical Provenance & Confirmation Invariant**: Modeled `ProvenancedValue<T>` with categorical confidence (`low` | `medium` | `high`) and source tracking (`self_reported`, `photo_estimate`, `observed_history`, `derived_from_history`, `external_context`). Enforced that explicit member confirmation strictly outranks unconfirmed estimates (`setOrConfirmPhenotypeValue`).
  3. **V1 Onboarding Adaptive PIH Signal**: Added single adaptive follow-up *"Do breakouts or irritation usually leave dark marks that stick around?"* with structured choices (`Rarely`, `Sometimes`, `Often`, `Not sure`) shown when `breakouts` or `dark_spots` goals are selected. Recorded as `self_reported`, `userConfirmed: true`.
  4. **Evidence Strength vs. Member Applicability**: Codified evidence policy separating methodological grade (`A` / `B` / `C` / `D`) from member applicability. Grade A/B eligible only when member criteria match; Grade C (observational/mechanistic) cannot silently alter routine steps; Grade D (preliminary/anecdotal) cannot drive product behavior.
  5. **Tinted-Product Categorical Compatibility**: Implemented shade matching without fake numerical scores. Returns `needs_confirmation` when member depth is unconfirmed; detects iron-oxide visible light photoprotection benefits for PIH-prone skin.
  6. **Personalized Pricing Prototype Correctness**: Retained deterministic 30-day consumption arithmetic ($96/mo Arthur demo estimate) with explicit separation of active routine consumption, inventory lifespan, and provisional operations.
- **Decision Status**:
  - `ADR-005: Personalized Dynamic Routine Pricing`: **IMPLEMENTED (Client/Mock Prototype)**
  - `ADR-006: Phenotype-Aware, Never Race-Aware Skin Modeling`: **IMPLEMENTED (Client/Mock Prototype)**
  - `ADR-007: Research Evidence Grading & Member Applicability Policy`: **IMPLEMENTED**
  - `ADR-008: Categorical Tint Compatibility & White Cast Assessment`: **IMPLEMENTED**
  - `Backend Schema & Remote Service Phenotype Extension`: **PROPOSED (Awaiting Sami Review)**
- **Repo Docs Updated**:
  - `AGENTS.md` (Agent bootstrap protocol, cross-founder recovery, challenge rule)
  - `docs/PROJECT_CONTEXT.md`
  - `docs/PRODUCT.md`
  - `docs/RESEARCH.md`
  - `docs/SAFETY_PRIVACY.md`
  - `docs/DECISIONS.md`
  - `docs/ROADMAP.md`
  - `docs/INTERFACES.md`
  - `docs/OWNERSHIP.md`
  - `docs/DESIGN.md`
- **Unresolved Founder Decisions**:
  - Migration of `SkinPhenotypeProfile` from `src/phenotype/` to backend database schema (`supabase/migrations/`) when Sami implements remote persistence.
  - Final Stripe commerce contract and founder billing dashboard integration.

---

## 2026-09-16 — Kanuj Mobile/UX: Personalized Pricing Architecture & Correctness Pass (Pass 4)

- **Agent / Workstream**: Kanuj (Mobile Client & Prototyping)
- **Local Branch**: `main`
- **Starting Local HEAD**: `50c5a3f` -> `4d4f41f`
- **Remote Push Status**: `pushed`
- **Drive Status**: `sync-required`
- **Durable Changes**:
  - Established 3-part economic concept: retail unit price, inventory lifespan (e.g. 60–90 days), and 30-day normalized consumption.
  - Arthur fixture verified at $96/month ($39 management + $52 products + $5 provisional operations).
  - Price stability contract: routine edits do not change billing unless product consumption changes; price increases require member confirmation; price drops apply automatically.
