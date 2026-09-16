# Derive Cross-Agent Context Sync Ledger

This ledger tracks durable architectural, product, and contract decisions across founder workstreams (Kanuj: Mobile/UX, Sami: Platform/Intelligence) and their respective AI agents.

**Core Rule**: A fresh agent on either founder's machine must be able to recover full shared project truth by reading `AGENTS.md`, this ledger, and the repository documentation without manual chat debriefing.

---

## 2026-09-16 — Kanuj Mobile/UX: Architecture-Correctness Cleanup (Pass 6)

- **Agent / Workstream**: Kanuj (Mobile Client, UX & Prototyping)
- **Local Branch**: `main`
- **Starting Local HEAD**: `ae4e49d951477d53967196729a4933fb6fb71b30`
- **Ending Commit / HEAD**: `4778026` (pushed checkpoint)
- **Remote Push Status**: `pushed`
- **Drive Status**: `sync-required` (DRIVE_SYNC_PAYLOAD emitted in completion report)
- **Architecture Challenges Raised / Resolved**: None
- **Durable Changes**:
  1. **Corrected CONTEXT_SYNC Truth**: Aligned ADR numbering (ADR-15, ADR-17, ADR-18, ADR-19) and confirmed Pass 5 pushed commit SHA (`ae4e49d`).
  2. **Removed Invented Pricing Range**: Stripped unapproved `~$49–$129/mo` range from all repository documentation. Clarified that personalized all-in monthly pricing is a provisional direction, Arthur's $96/mo is an illustrative deterministic demo fixture (not a pricing commitment), and final commercial terms/ranges require founder alignment between Kanuj and Sami.
  3. **Decoupled SunResponse Semantics**: Sourced `SunResponse` strictly from behavioral self-reported sun reaction (`burns_easily`, `burns_then_tans`, `sometimes_burns_tans`, `rarely_burns_tans_easily`, `not_sure`), removing any implicit mixing with pigmentation depth.
  4. **Enforced Full Evidence Applicability Constraints**: Introduced `EvidenceApplicabilityContext` (`productHasIronOxides`, `photoprotectionRelevant`), enforced that `directRoutineInfluenceAllowed: false` hard-blocks direct routine changes regardless of study grade, and ensured missing context fails closed.
  5. **Removed Pigmentation-Alone Iron-Oxide Benefit Rule**: Iron-oxide photoprotection benefit requires a reported/confirmed post-inflammatory hyperpigmentation signal (`pihTendency: 'sometimes' | 'often'`), never inferred from pigmentation depth alone.
  6. **Distilled White-Cast Logic**: Eliminated speculative formula-category predictions; grounded white cast in catalog-verified or member observation evaluated against member cast concern.
  7. **Removed Unapproved Ingredient Prescription Rule**: Removed automatic recommendation of specific actives (Niacinamide, Azelaic acid) from PIH product documentation.
  8. **Preserved Backend Interface Semantics**: Reframed `docs/INTERFACES.md` Section 7 around semantic provenance and pricing lifecycle requirements without dictating database table/column layouts for Sami.
  9. **Strengthened AGENTS Bootstrap & Sync**: Added fast-forward-only automatic remote reconciliation (`git merge --ff-only origin/main`), divergence guard, and full `ARCHITECTURE_CHALLENGE` packet template.
  10. **Terminology Cleanup**: Replaced "human verification" with "manual final quality check" for initial routine; replaced "medical context" with "sensitive member/skincare data".
- **Decision Status**:
  - `ADR-15: Personalized All-In Monthly Plan Pricing`: **PROVISIONAL / PENDING COFOUNDER BUSINESS REVIEW**
  - `ADR-17: Phenotype-Aware, Never Race-Aware Skin Modeling`: **PROVISIONAL CLIENT ARCHITECTURE IMPLEMENTED**
  - `ADR-18: Research Evidence Grading & Member Applicability Policy`: **IMPLEMENTED (Client Prototype Policy)**
  - `ADR-19: Categorical Tint Compatibility & White Cast Assessment`: **IMPLEMENTED (Client Prototype Policy)**
  - `Backend Schema & Remote Service Evolution`: **PROPOSED (Awaiting Sami Review)**
- **Repo Docs Updated**:
  - `AGENTS.md`
  - `docs/CONTEXT_SYNC.md`
  - `docs/PROJECT_CONTEXT.md`
  - `docs/PRODUCT.md`
  - `docs/RESEARCH.md`
  - `docs/SAFETY_PRIVACY.md`
  - `docs/DECISIONS.md`
  - `docs/ROADMAP.md`
  - `docs/INTERFACES.md`
  - `docs/ARCHITECTURE.md`
- **Unresolved Founder Decisions**:
  - Final business model, commercial pricing ranges, management/operations components, first-basket financing, refund policy, and cancellation rules (Kanuj & Sami alignment).
  - Database schema & entity persistence design for phenotype provenance and routine-linked pricing snapshots (Sami review).

---

## 2026-09-16 — Kanuj Mobile/UX: Phenotype Architecture, Provenance & Evidence Policy (Pass 5)

- **Agent / Workstream**: Kanuj (Mobile Client, UX & Prototyping)
- **Local Branch**: `main`
- **Starting Local HEAD**: `4d4f41faa34a53a9a0abc8516676a37368cdbf04`
- **Ending Commit / HEAD**: `ae4e49d951477d53967196729a4933fb6fb71b30`
- **Remote Push Status**: `pushed` (verified against `origin/main`)
- **Drive Status**: `sync-required` (DRIVE_SYNC_PAYLOAD emitted in completion report)
- **Architecture Challenges Raised / Resolved**: None
- **Durable Changes**:
  1. **Phenotype-Aware, Never Race-Aware Architecture**: Built client/mock module `src/phenotype/` (`types.ts`, `profile.ts`, `evidence-policy.ts`, `tint-compatibility.ts`, `fixtures.ts`, `index.ts`). Explicitly prohibits race/ethnicity classifiers, CV colorimetry, Fitzpatrick ML inference, and demographic recommendation rules.
  2. **Categorical Provenance & Confirmation Invariant**: Modeled `ProvenancedValue<T>` with categorical confidence (`low` | `medium` | `high`) and source tracking (`self_reported`, `photo_estimate`, `observed_history`, `derived_from_history`, `external_context`). Enforced that explicit member confirmation strictly outranks unconfirmed estimates (`setOrConfirmPhenotypeValue`).
  3. **V1 Onboarding Adaptive PIH Signal**: Added single adaptive follow-up *"Do breakouts or irritation usually leave dark marks that stick around?"* with structured choices (`Rarely`, `Sometimes`, `Often`, `Not sure`) shown when `breakouts` or `dark_spots` goals are selected. Recorded as `self_reported`, `userConfirmed: true`.
  4. **Evidence Strength vs. Member Applicability**: Codified evidence policy separating methodological grade (`A` / `B` / `C` / `D`) from member applicability. Grade A/B eligible only when member criteria match; Grade C (observational/mechanistic) cannot silently alter routine steps; Grade D (preliminary/anecdotal) cannot drive product behavior.
  5. **Tinted-Product Categorical Compatibility**: Implemented shade matching without fake numerical scores. Returns `needs_confirmation` when member depth is unconfirmed; detects iron-oxide visible light photoprotection benefits for PIH-prone skin.
  6. **Personalized Pricing Prototype Correctness**: Retained deterministic 30-day consumption arithmetic ($96/mo Arthur demo estimate) with explicit separation of active routine consumption, inventory lifespan, and provisional operations.
- **Decision Status**:
  - `ADR-15: Personalized All-In Monthly Plan Pricing`: **PROVISIONAL / PENDING COFOUNDER BUSINESS REVIEW**
  - `ADR-17: Phenotype-Aware, Never Race-Aware Skin Modeling`: **PROVISIONAL CLIENT ARCHITECTURE IMPLEMENTED**
  - `ADR-18: Research Evidence Grading & Member Applicability Policy`: **IMPLEMENTED**
  - `ADR-19: Categorical Tint Compatibility & White Cast Assessment`: **IMPLEMENTED**
  - `Backend Schema & Remote Service Evolution`: **PROPOSED (Awaiting Sami Review)**
- **Repo Docs Updated**:
  - `AGENTS.md`
  - `docs/CONTEXT_SYNC.md`
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
