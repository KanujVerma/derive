# P0-A resolver, catalog and promotion audit

Audited base `45f1773e4983c3c28848839c65640b7681b89d8e` on 2026-09-26. This leaf changes only the pure S6 resolver and focused regressions. The root owns snapshot contracts, migrations, Edge composition and global documentation. No hosted activation, new provider, invented catalog facts or P0-B changes.

## Reproduced defects and changes

- The barcode-first early return discarded contradictory submitted brand, product name, variant and region. Each contradiction returned `verified_product_formula` before the fix. Authoritative identifier candidates now remain unresolved with explicit internal `identity_mismatch` / `region_mismatch` codes; submitted text cannot replace catalog truth.
- An ordered ingredient mismatch also returned `verified_product_formula`. The resolver now preserves identifier-supported identity, withholds the selected formula, requests ingredient evidence and records `ingredient_mismatch`. An unknown fingerprint is unsupported evidence, not confirmation.
- Numeric manufacturer SKUs, mismatched/missing GTIN types and invalid check digits could establish barcode authority. Barcode resolution now requires exact digit value, matching `gtin_<length>` type, valid check digit, authoritative source and completed verification.
- First-row deduplication could hide an explicitly linked verified formula behind the same identity/formula projection without linkage. Deduplication prioritizes a complete authoritative linkage before reducing display candidates. Identity and ingredient conflicts are inspected against all identifier assertions before deduplication. Complete product/variant IDs and labels are required to verify a formula.

Focused tests initially failed eight of ten cases. The final corpus adds positive matching evidence, incomplete labels and cross-variant identifier conflicts. Customer ingredients never select a reformulation: a reused GTIN mapping to two formula versions remains formula-unverified even when typed ingredients match one version. OCR/packaging resemblance remains candidate-only.

Implementation references: `supabase/functions/_shared/product-identity.ts`, `uniqueRecords`, `verifiedFormulaForIdentifier` and the authoritative barcode branch; regressions: `tests/p0a-resolution.test.ts`. Existing S6 cases in `tests/derive.test.ts:9214` already supply explicit GTIN types.

## Existing schema and authorization evidence

- `20260922220000_s6_product_identity_resolution.sql:66` separates identifiers from product/variant/formula. Type/length and authoritative verification constraints exist; the same GTIN can retain multiple formula links. The formula/variant trigger at line 102 prevents cross-variant linkage. Formula and identifier update-rejection triggers at lines 129–137 preserve append-only records.
- `20260922230123_product_catalog_ingest.sql:53` is the existing transactional catalog-ingestion authority; service-only grants are at lines 391–392. The CLI ingestion path and SQL GTIN validation already exist. No replacement promotion path is needed for this increment.
- `resolve-product-identity/index.ts:261` loads deterministically paged catalog projections, separately including product summaries, active variants, formulas and identifier assertions. Free reads filter sourced products, verified variants, verified publicly sourced formulas and completed identifier verification. The pure resolver cannot upgrade those projections from text/model resemblance.
- `founder_resolve_product_identity` at migration line 511 checks an active founder, pending case, product/variant/formula relationships and verified formula status, then logs the promotion. Execution is service-only (lines 624–627); founder Edge dispatch derives its actor from verified founder access. It is a guarded catalog-formula selection, not a model promotion pipeline.
- Free acquisition deliberately suppresses founder queue creation using `managedAccess && decision.requiresFounderReview` (`resolve-product-identity/index.ts:506`). The internal resolver review flag expresses evidence uncertainty; it must not become an unbounded free operations promise in snapshot/customer projections.

## Plan challenges and root dependencies

1. Immutable snapshot persistence must also cover founder review. The existing founder RPC updates the resolution case in place (migration lines 593–607). Initial resolver snapshots alone cannot capture later reviewed truth. Append a new snapshot for a reviewed decision and preserve the prior revision; do not reconstruct historical snapshots from current catalog rows.
2. Five legacy states cannot express conflict details by themselves. Root snapshot projection should map optional internal `ResolverDecision.conflicts` (`identity_mismatch`, `region_mismatch`, `ingredient_mismatch`, `identifier_conflict`) to its approved public conflict contract, without raw ingredient/identity text. Existing state/candidate enums are unchanged.
3. Typed family matching sees product summary and exact variant projections together. A single family with one variant may still be ambiguous. This is conservative; dropping the summary and automatically claiming the exact variant would infer package truth from a typed family. Keep it unresolved until root chooses a supported product-only representation.
4. The existing record projection exposes variant region and formula provenance but not formula-region applicability as a separate fact. Snapshot composition must not invent package-market compatibility from a variant when formula evidence is market-specific. Root should audit Edge/schema applicability before broadening authority.
5. No physical camera acceptance, OCR accuracy, provider latency/cost, hosted coverage or real-image winner is proven by this synthetic resolver corpus. The plan's explicit unverified/blocker ledger is necessary.

## Validation

- `node --experimental-strip-types tests/p0a-resolution.test.ts`: 13/13 pass after the fix.
- `npm test`: full repository unit suite passes, 473/473 tests.
- `npx --no-install tsc --noEmit` and `npm run typecheck:tests`: attempted with a temporary symlink to the existing app dependencies; blocked by missing baseline `expo-application` / `expo-file-system` packages. No resolver TypeScript diagnostic was emitted. Root must rerun with the lockfile dependency environment before integration. The temporary dependency symlink was removed after validation.
- `git diff --check`: passes.
- Database reset, pgTAP, Edge integration, web/iOS exports and exact-head CI are root integration gates; this leaf does not claim they ran or passed.

## Adversarial follow-up

The first fix still inherited the legacy normalizer's ASCII/punctuation loss. Read-only reproductions showed submitted brand `東京` disappearing, `Retinol 0/5%` comparing equal to `Retinol 0.5%`, `α-Arbutin` and `β-Arbutin` sharing a fingerprint, and `['水', 'Water']` collapsing to `['Water']`. Same-formula duplicate source references also selected whichever equally verified assertion appeared first.

The approved follow-up separates evidence equality from the persisted fingerprint format. Identity comparisons retain Unicode and decimal/slash notation. When `formulaIngredients` exists, ingredient comparison uses exact ordered strings after NFKC, case, surrounding-space and repeated-whitespace normalization; punctuation and occurrence count remain meaningful. Legacy projections lacking raw ingredients abstain for non-ASCII or punctuation-sensitive ingredient evidence. The stored fingerprint generator and catalog-ingestion format remain unchanged. Fingerprints do not establish concentration assertions.

`formulaRegionCode`, when supplied, must agree with known submitted/variant region before a formula can verify. Inconsistent duplicate formula source, observation time, verification status, fingerprint, raw ingredients or formula region preserve exact identity only and record `identifier_conflict`, with manual review. Duplicate linkage presence alone is not a contradictory formula fact and still preserves a completed explicit linkage.

Root integration must project raw `product_formula_versions.ingredients` and `region_code` into these optional pure-record fields. These columns already exist; the leaf adds no migration or Edge edits. The pure module can now detect the market mismatch flagged above once Edge supplies it. Typed family selection remains conservative and never gains formula authority.

Follow-up validation: focused `tests/p0a-resolution.test.ts` 19/19 and full `npm test` 479/479 pass; `git diff --check` passes. `npx --no-install tsc --noEmit` and `npm run typecheck:tests` both pass with zero errors against the root's complete dependency environment. The temporary dependency symlink was removed. Database, Edge, exports and CI remain root gates.

## Final integrated-tree review

Read-only review of the root integration found ingredient-only matches still ignored known submitted/formula market contradictions. Although the snapshot correctly marked formula-only as not applicable to a selected package, returning that formula association without conflict was misleading. Formula-only matching now excludes known incompatible formula markets; if all otherwise matching formula records are excluded, it returns insufficient evidence with `region_mismatch`. Unknown formula markets remain unknown and do not invent compatibility.

A barcode plus a label naming another complete known catalog brand/product previously returned verified barcode truth. The pure resolver now preserves both candidates as ambiguous with `identity_mismatch`. Matching uses complete literal brand/name phrases with word boundaries, retains Unicode and decimal/slash notation, and never promotes a label to authority. Generic unreadable text and incomplete/sub-string product names are not treated as recognized contradictions.

The capture processor, automatic barcode handoff and Check composition separately discard simultaneous photos. Root owns the serial fix: preserve existing photos when adding barcode, upload all supplied photo roles, resolve once with the combined evidence, bind retries to all evidence and prefer an existing exact mixed-evidence result. This leaf does not edit those surfaces or claim photo extraction exists.

Final validation: focused regression cases 21/21, full `npm test` 481/481, both TypeScript checks and `git diff --check` pass. This review does not expand typed-family authority or introduce a broad label parser.
