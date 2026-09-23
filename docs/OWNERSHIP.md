# Derive Founder Ownership

Every implementation milestone has one founder owner. This approved split supports long parallel work with minimal file overlap. The current next wave is K-FREE-1 (Kanuj) and S-FREE-1 (Sami); [ROADMAP.md](ROADMAP.md) has the full sequence and acceptance gates.

## Kanuj: customer and mobile lane

Owns `app/**`, `src/components/**`, `src/constants/**`, customer-facing client state/helpers, customer navigation/presentation, and physical device/TestFlight acceptance. Kanuj may build against fixtures or a local customer-state abstraction while the platform contract is being built.

- **K-FREE-1, next / Wave 1:** Scanner-First App Shell and target CHECK / MY STUFF / PLAN / SHOP presentation. No Supabase backend, hosted Auth/RLS, or free entitlement implementation.
- **K-FREE-2 / Wave 2:** optional minimal personalization after factual first Check, same-result refresh, skip/remind and later editing. Consumes S-FREE-2's merged profile/fit contract.
- **K-FREE-3 / Wave 3:** MY STUFF presentation for profile, current products, product states, history and reactions. No backend persistence.
- **K-FREE-4 / Wave 4:** capture and candidate-confirmation UX. It emits evidence, not authoritative product/formula identity.
- **K-PAID-1 / Wave 5:** free Plan presentation and managed upgrade, plus actual managed Plan/care experience using Sami's entitlement and F1 interfaces.
- **K-ACCEPT-1:** scanner-first physical/TestFlight acceptance after platform contracts and release hardening.
- **K-GROWTH, later:** shareable Check result and referral UX.

## Sami: platform, intelligence, and operations lane

Owns `supabase/**`, `admin/**`, `src/services/remote/**`, `src/services/ai-workflows/**`, hosted Supabase/Auth/RLS/configuration, server billing, product identity/formula truth, and founder operations. Sami does not implement customer mobile UI.

- **S-FREE-1, next / Wave 1:** anonymous identity and free access, account-kind distinction, free/managed separation, FREE / MANAGED / BOTH operation inventory, least-privilege RLS review, and stable access contract. No mobile UI and no fake `founding_beta` membership for free users.
- **S-FREE-2 / Wave 2:** persisted minimal profile and deterministic categorical fit with evidence explanation and safe unknown behavior. No provider hard dependency and no diagnosis.
- **S-FREE-3 / Wave 3:** owner-bound free Check history, shelf/product states, reactions/tolerance and profile context data plane, including anonymous ownership.
- **S-FREE-4 / Wave 4:** private evidence storage, S6 candidate/formula resolution and review states. OCR/model output is not authoritative identity.
- **S-PAID-1 / Wave 5:** permanent identity and managed entitlement separation plus F1 founder construction, validation, publication and member readback. F1 is part of this milestone.
- **S-OPS-1:** anonymous cleanup, rate/abuse controls, account linking/conflicts, deletion, session-loss behavior and privacy-safe operational observability.
- **S-CATALOG, ongoing:** demand-driven verified coverage, aliases, package/identifier/formula evidence, reformulation history and safe unknown fallback.

H1P remains a provider-backed intelligence milestone. H1B remains later managed billing/entitlement activation. H1E remains parked unless recovery needs it. None reinstates a hard H1P dependency for free factual Check or deterministic fit.

## Wave handoffs

| Wave | Parallel owner pair | Handoff required before integration |
| --- | --- | --- |
| 1 | K-FREE-1 / S-FREE-1 | Sami merges stable anonymous/free access contract; Kanuj can develop to fixtures meanwhile. |
| 2 | K-FREE-2 / S-FREE-2 | Sami merges profile and fit contract; Kanuj consumes it. |
| 3 | K-FREE-3 / S-FREE-3 | Sami merges free-context/history read/write contracts; Kanuj integrates after handoff. |
| 4 | K-FREE-4 / S-FREE-4 | Sami merges private evidence/resolution contract; Kanuj sends evidence and renders explicit candidate/unknown states. |
| 5 | K-PAID-1 / S-PAID-1 | Sami merges permanent identity, managed entitlement and F1 interfaces; Kanuj consumes them. |
| Release | K-ACCEPT-1 / S-OPS-1 | Operations/security behavior and mobile acceptance are evidenced before scanner-first external beta. |

## Shared-contract rule

A shared contract is not co-owned implementation. The milestone that first requires a contract owns its minimal change, records the exact request/response and failure states, validates and merges it, then hands it to the dependent milestone. The dependent owner does not edit that contract in parallel. Do not create “Kanuj + Sami” implementation milestones.

## Historical ownership and evidence

Older F1, H1P, L1/L2, C1, Build 8/9/10, and catalog branch entries preserve their checkpoint-specific assignments and evidence. They do not override the current milestone table. PR #39's selected catalog UUID preservation is closed; Sami does not own that same fix as current work. Cross-lane defects still require exact evidence, affected interface, owner, and blocker status in the PR or [CONTEXT_SYNC.md](CONTEXT_SYNC.md).
