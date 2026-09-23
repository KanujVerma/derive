# Product Catalog and Check a Product V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Deliver one sourced, searchable product catalog and two mobile consumers without weakening S6 identity or formula trust.

**Architecture:** PR A adds an indexed service-only catalog search and trusted ingestion path on top of `products` and S6 tables, exposed through one authenticated Edge Function. PR B consumes that stable interface from onboarding and Check a Product while keeping personalized fit gated on the live evaluator.

**Tech Stack:** PostgreSQL 15, pg_trgm, Supabase Edge Functions, Expo SDK 57, React Native, TypeScript, pgTAP.

**Spec:** `docs/PRODUCT_CATALOG.md`

## Global Constraints

- Start at merged `main@69fcc1ac31849ef2738fe6830c144c3f048f66f0` and preserve S6 trust states.
- Do not derive canonical formula, variant, GTIN, or personal fit from product names or prototype fixtures.
- Keep the current Remote Staging Ask/Scan gate and do not create a TestFlight build.
- PR A and PR B must land separately with exact-head CI.

---

### Task 1: Catalog schema, indexing, and ranked search (PR A)

**Files:** Create a migration via `supabase migration new product_catalog_search`; create `supabase/tests/catalog_search.test.sql`; modify `supabase/config.toml` only for the new Edge Function.

**Interfaces:** `public.search_product_catalog(p_query text, p_limit integer)` is callable by `service_role` only and returns bounded canonical product summaries. `public.product_search_aliases` holds sourced aliases for `public.products`.

- [x] Write pgTAP cases for exact, prefix, case-insensitive, alias, typo, stable ordering, bounds, invalid query, provisional exclusion, and role denial. Use a fixed set of catalog and provisional fixture UUIDs.
- [x] Run the new pgTAP file against a reset local database and confirm search/RLS expectations fail before the migration.
- [x] Add `pg_trgm`, a private-write alias table, source metadata, partial prefix/trigram indexes, and a service-only `SECURITY INVOKER` search function. Rank matches by exact brand/name, exact name/alias, prefix, then trigram and stable UUID ties.
- [x] Reset the local database, run the new pgTAP file, inspect `EXPLAIN` for prefix and typo queries, and commit the schema/test slice.

### Task 2: Trusted operator ingestion (PR A)

**Files:** Extend the Task 1 migration or add a second migration via `supabase migration new product_catalog_ingest`; create `scripts/catalog-ingest.mjs`; extend `supabase/tests/catalog_search.test.sql`; update `docs/PRODUCT_CATALOG.md`.

**Interfaces:** `private.ingest_catalog_product(p_payload jsonb)` accepts product provenance plus optional alias/variant/identifier/formula facts, runs as the privileged operator only, and returns canonical IDs. The CLI invokes it through authenticated management SQL with escaped JSON, never through a mobile key.

- [x] Add failing tests for product-only creation, replay, aliases, variant/region/package, GTIN constraints, verified formula provenance, mismatched formula/identifier rejection, and customer denial.
- [x] Implement the transactional operator function using S6 tables and constraints. Treat exact ingredients as append-only formula evidence; never silently promote source authority or overwrite a formula version.
- [x] Implement a guarded CLI that validates an input JSON file, shows a read-only preview by default, and applies only with an explicit `--apply` and exact project ref. Test input validation locally without hosted writes.
- [x] Run local pgTAP and CLI tests, then commit.

### Task 3: Authenticated catalog Edge contract (PR A)

**Files:** Create `src/contracts/ProductCatalog.ts`, `supabase/functions/catalog-products/index.ts`, `supabase/functions/catalog-products/deno.json`; add function config to `supabase/config.toml`; add focused API tests.

**Interfaces:** `POST catalog-products` accepts `{operation:'search',query,limit?}` or `{operation:'detail',productId,variantId?}` and returns bounded product facts only. It authenticates through the existing runtime, calls service-only search, and never reads member data.

- [x] Write failing parser/auth/output tests for invalid query, unauthenticated request, result bounds, provisional exclusion, and formula ambiguity.
- [x] Implement search and detail modes with exact input allowlists and safe error codes. Detail returns verified formula facts only when the S6 identifier and formula linkage is explicit.
- [x] Boot the Edge Function locally, run the API tests and full local database suite, then commit.

### Task 4: PR A integration, CI, and hosted rollout

**Files:** Update `docs/PRODUCT_CATALOG.md`, `docs/ROADMAP.md`, `docs/OWNERSHIP.md`, and `docs/CONTEXT_SYNC.md` for the bounded platform handoff.

- [x] Run `npm test`, both TypeScript checks, Expo web export, fresh Supabase reset, `supabase test db`, affected local integration harnesses, and `git diff --check`.
- [ ] Open `Catalog: searchable product knowledge foundation`; require both exact-head CI jobs green and no S6 regression before merging.
- [ ] Apply the merged migration to `snojlbqovlawewwqbviz`, deploy only `catalog-products`, and read back schema, permissions, catalog counts, and authenticated search. Ingest a source-backed starter only if the founder confirms it.
- [ ] Record merge SHA, deployment evidence, remaining data-source boundary, and stable API contract for PR B.

### Task 5: Onboarding product search (PR B)

**Files:** Create `src/services/productCatalog.ts` and a reusable search component; modify `app/(onboarding)/6-shelf.tsx` and `src/utils/shelfProducts.ts`; add `tests/product-catalog-mobile.test.ts`.

**Interfaces:** `searchCatalog(query)` yields canonical summaries with `productId`; `buildCatalogShelfProduct` preserves UUID and catalog status while leaving chemistry empty until supported.

- [ ] Write failing tests for one-tap canonical add, duplicate prevention, repeated search, manual fallback, catalog edit demotion, and no invented chemistry.
- [ ] Implement debounced server search, result states, Add action, and the `Can't find it? Add manually` path without adding an onboarding screen.
- [ ] Run focused tests and both TypeScript checks, then commit.

### Task 6: Check a Product and S6 convergence (PR B)

**Files:** Modify `app/shop/scan.tsx`, `src/services/catalog.ts`, and related presentation/client modules; extend `tests/product-catalog-mobile.test.ts`.

**Interfaces:** Name search selects a canonical `productId`; barcode calls S6 `resolve-product-identity` and uses that same ID; detail shows supported formula facts; personal fit remains unavailable without a verified S6 case and live evaluator.

- [ ] Write failing tests for name/barcode convergence, five S6 states, unknown/ambiguous candidate handling, formula known versus unknown, no numerical score, and Remote Staging deep-link gating.
- [ ] Implement a search-first Check a Product experience with barcode as a second input, candidate confirmation or founder-review status, and distinct formula/personal-fit sections. Keep camera/label/ingredient evidence contract-ready without enabling a provider.
- [ ] Remove prototype fixtures from production lookup, run focused tests and Expo exports, then commit.

### Task 7: PR B validation and landing

- [ ] Run full unit, TypeScript, test TypeScript, web and iOS exports, S6/pgTAP regression, and `git diff --check`.
- [ ] Open `Mobile: low-friction product search and Check a Product`, require exact-head CI green, merge normally, and verify main CI.
- [ ] Read back hosted catalog counts and confirm no new TestFlight submission, External Beta Review, Ask/Scan staging exposure, or S6 trust regression. Return `PRODUCT_CATALOG_CHECK_PRODUCT_PACKET` with remaining data-source limits.
