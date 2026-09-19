# I1-B4 Membership, Commerce & Check-In Context Impact Map

Audit base: `89d69d68cbf174969942c6b95853ec9236edaaf1` (`origin/main`, 2026-09-18).

This is the pre-implementation map for the founder-approved reconciliation. It distinguishes active implementation from historical documentation and keeps the milestone bounded: membership semantics, current customer truth, check-in context persistence, and commerce direction are in scope; Stripe billing and a full Shop are not.

## 1. Membership identity and persistence

| Touchpoint | Current implementation truth | Required action |
| --- | --- | --- |
| `supabase/migrations/20260915_init.sql` | Applied baseline defaults `memberships.tier` to `founding_beta_129`. | Preserve as immutable history. Add a new migration that backfills legacy rows and changes the default to price-neutral `founding_beta`. |
| `src/domain/types.ts` | `CustomerProfile.tier` is the literal `founding_beta_129`. | Introduce canonical `MembershipTier = 'founding_beta'` and use it in `CustomerProfile`. |
| `src/services/remote/RemoteDeriveService.ts` | Rejects every tier except `founding_beta_129` and projects that literal. | Accept and project only canonical `founding_beta` after migration. Keep no active legacy identity fallback. |
| `src/services/mock/MockDeriveService.ts` | Demo and onboarding profiles emit `founding_beta_129`. | Emit `founding_beta`. |
| Tests and fixtures | Several fixtures assert `founding_beta_129`. | Reconcile fixtures and add migration/mapper regression coverage. |

The current `$25/month` experiment remains presentation configuration in this milestone. Trusted billed amount, currency, Stripe price/version, webhook lifecycle, and transaction records are intentionally deferred to the bounded commerce milestone; the client display constant is not authoritative billing state.

## 2. Superseded routine-derived membership pricing

| Touchpoint | Current implementation truth | Required action |
| --- | --- | --- |
| `src/pricing/**` | Implements `$39 + normalized product consumption + $5` and Arthur `$96/month`. | Delete the obsolete production/client prototype and its tests; it has no independent legitimate use. |
| `app/(onboarding)/10-summary.tsx` | Calculates a routine-derived estimate and says products are included. | Remove the calculation; show flat `$25/month`, managed-skincare inclusions, and explicit separate product purchases before checkout. |
| `app/profile/index.tsx` | Calculates a routine-derived estimate and demo copy references `$96/month`. | Remove dynamic pricing code and stale demo price. Show centralized `$25/month` experiment truth. |
| `app/orders/index.tsx` | Says refills are included with membership. | Explain that products are separate purchases and every charge requires approval. |
| `src/constants/config.ts` | Current display price is `$100`. | Rename to an explicitly non-authoritative Founding Beta display price in cents and set `$25/month`. |
| README and durable docs | Active sections still describe `$100` all-in and provisional dynamic pricing. | Mark ADR-15 and ADR-21 pricing portions historical/superseded, add the new ADR, and reconcile active product/architecture/research/roadmap truth. Preserve clearly labeled historical ledger entries. |

## 3. Check-in structured context

| Touchpoint | Current implementation truth | Required action |
| --- | --- | --- |
| `app/check-in/index.tsx` | Conditional, single-select change reason only appears after worsening/irritation; selection is not submitted. Notes use a plain `TextInput`. | Replace with an always-available optional multi-select tag section plus one optional `VoiceTextArea` using standard `checkin_note` behavior. Preserve the fast path. |
| `src/types/schema.ts` | `CheckIn.changeReason?: string` is the only structured change field. | Add canonical `CheckInContextTag`, `contextTags`, and `contextNote`; retain `changeReason` only as deprecated legacy compatibility. |
| `src/domain/types.ts` | `CheckInInput` cannot carry structured context. | Add optional `contextTags` and `contextNote`. |
| `public.check_ins` | Stores only skin state, irritation, notes, and server analysis. | Add user-input columns for goal/adherence plus `context_tags` and `context_note`, with enum/subset and length constraints and least-privilege insert grants. |
| `MockDeriveService` | Persists only the old input shape in memory. | Preserve tags and note in returned/history records. |
| `RemoteDeriveService` | Invokes nonexistent `submit-checkin` and `get-progress` Edge Functions on current main. | Use authenticated, owner-scoped PostgREST inserts/reads against `check_ins`, with explicit projections and canonical row mapping. Do not invent model analysis. |
| pgTAP/local integration/tests | No structured-context persistence coverage. | Verify allowed multi-select values, rejection of invalid tags, owner isolation, direct-write restrictions on server analysis, Mock/Remote mapping, and database round-trip. |

Context tags remain observations, never causal claims. They do not authorize dietary restriction, medication changes, cycle tracking, or silent routine changes.

## 4. Commerce and refill semantics

- Keep the five root tabs unchanged.
- Keep Plan → Products and Account → Orders as the current commerce entry points.
- Same-SKU refill remains a low-friction request, but the customer must approve the separate product charge.
- New/substitute products require explicit customer consent.
- Recommendation and safety/fit ranking remain independent of margin, sponsorship, affiliate commission, or coupon availability.
- Stripe membership checkout, product charge persistence, coupons, affiliate systems, inventory forecasting, and a full Shop are explicitly deferred.

## 5. Durable documentation and milestone ledger

Update `README.md`, `docs/PRODUCT.md`, `docs/PROJECT_CONTEXT.md`, `docs/DECISIONS.md`, `docs/ARCHITECTURE.md`, `docs/INTERFACES.md`, `docs/RESEARCH.md`, `docs/ROADMAP.md`, and `docs/CONTEXT_SYNC.md`. `docs/OWNERSHIP.md` requires only removal of the obsolete `src/pricing/**` ownership reference. Historical ledger entries remain immutable and may retain old prices when clearly presented as predecessor history.
