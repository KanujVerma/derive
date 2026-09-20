# Derive Founder Ownership

Every implementation milestone has one founder owner, one primary code lane, prerequisites, and an explicit handoff. A shared interface never makes a milestone co-owned. See [ROADMAP.md](ROADMAP.md) for current assignments and status.

## Kanuj: customer experience and acceptance

Owns `app/**`, `src/components/**`, `src/constants/**`, customer-facing client state/helpers, mobile navigation and recovery, product presentation, Shop UX, and physical-device/TestFlight customer acceptance. Kanuj does not implement `supabase/**`, `admin/**`, `src/services/remote/**`, `src/services/ai-workflows/**`, hosted backend configuration, server Stripe, or product-resolution backend work.

## Sami: platform, intelligence, and founder operations

Owns `supabase/**`, `supabase/functions/**`, `admin/**`, `src/services/remote/**`, `src/services/ai-workflows/**`, hosted Supabase/Auth, server Stripe lifecycle, server Gemini, founder operations, and product identity/formula resolution. Sami does not routinely modify customer mobile UX, `app/**` presentation, or Kanuj's design system.

## Shared contracts and changes

`src/contracts/**`, `src/domain/**`, `src/types/schema.ts`, package manifests, CI, and durable architecture docs are integration boundaries. The milestone that needs a change owns it, keeps it minimal, preserves the other lane's expectations, documents the interface, and hands it off before dependent work starts. Avoid parallel conflicting edits. A deliberate milestone reassignment must be recorded in the roadmap.

The L0/H1A founder authorization makes H1A a single temporary exception: Kanuj owns the hosted post-auth core implementation on a fresh H1A branch after L0 lands. This does not transfer H1E email, H1B Stripe, F1 founder operations, or ongoing platform ownership; those remain Sami work. H1A must hand tested interfaces and evidence back to Sami before the next platform milestone.

## Cross-lane defects

When work exposes a defect in the other founder's lane, record the exact reproduction/evidence, affected interface, owning founder, and whether it blocks the current milestone in the PR or `docs/CONTEXT_SYNC.md`. Continue around it if safe; otherwise stop at that boundary. Kanuj routes backend/platform defects to Sami. Sami routes mobile/customer defects to Kanuj. Neither silently fixes or redesigns the other's implementation.

## Working checkpoint

The working tree is in-progress truth; GitHub `main` is the shared checkpoint. Repository docs are durable product, architecture, and roadmap context. Drive is for customer-research artifacts only. Update the relevant canonical doc and add a short context-ledger entry for material cross-lane changes. Historical ledger entries remain historical evidence.
