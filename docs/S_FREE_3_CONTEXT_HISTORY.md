# S-FREE-3: Free Context and Check History

Status: stacked on S-FREE-2 PR #54; local implementation only. Do not deploy this migration or Edge Function until S-FREE-2 lands and the exact-head checks run. GitHub Actions is currently blocked before job startup by the repository billing/spending gate.

## What exists

`20260924010000_s_free_3_context_history.sql` adds three free-only tables. `free_saved_products` holds a product identity and `using`, `considering`, or `stopped`. `free_check_history` records a sourced catalog product or an existing owner-bound S6 scan case, including unresolved cases. `free_product_experiences` records `tolerated`, `reacted`, `liked`, or `finished` with an optional note. All rows cascade when the Auth-backed owner profile is deleted; none provisions a managed membership or writes paid Shelf/reaction tables.

All three tables have RLS enabled and no direct `authenticated`/`anon` grants. The `free-context` Edge Function verifies the Supabase JWT, derives the owner, validates exact request fields, projects bounded responses and enforces request-ID idempotency. It checks catalog provenance for product UUIDs, rejects foreign cases, uses owner-filtered updates/deletes, and paginates by a private database sequence using the last *owner-owned entry ID* as cursor. The sequence itself is never returned. A database trigger separately rejects cross-owner scan-case references.

The free-product reference distinguishes catalog UUIDs from manually entered name/brand. A manual entry stays `user_reported`; it cannot assert a formula, ingredient fact, or sourced identity. Check history is written when the consumer explicitly records a viewed result, not for each search. An unresolved S6 case is labeled `Product not identified`. Experiences are user reports, not diagnosed allergy records; a `reacted` event for the same catalog product can make a subsequent verified-formula fit cautious without claiming the old and current formulas match.

Removing a free history entry removes it from this free-memory store. If the entry was based on an S6 resolution case, that separate evidence/case record remains under its existing owner and account-deletion rules; do not label the per-entry action “delete all scan data.” Full account deletion remains the existing Storage-first flow.

## Kanuj handoff

Consume the typed functions in `src/services/remote/freeContext.ts` and the exact request/response types in `src/contracts/FreeContext.ts`. On MY STUFF, load the S-FREE-2 profile separately, then page products, checks, and experiences. Present manual entries and unresolved Checks explicitly. Call `recordFreeCheck` only after a result is actually shown/saved. Generate a stable UUID per mutation and reuse it for retries. Do not infer allergy from `reacted`, elevate user text to catalog truth, or show raw notes in analytics. Kanuj owns mapping to `MyStuffViewModel` and all screen/copy integration; this branch deliberately changes no `app/**` or `src/components/**` files.

## Still gated

Hosted anonymous Auth, abuse/rate limits, identity linking and lost-session handling remain S-OPS-1. Product-photo capture/storage remains S-FREE-4. This branch has no customer-visible MY STUFF persistence until Kanuj integrates it, and has no hosted deployment. The present hosted catalog also lacks verified formulas, so reaction-aware positive-fit behavior cannot be demonstrated on production catalog data yet.
