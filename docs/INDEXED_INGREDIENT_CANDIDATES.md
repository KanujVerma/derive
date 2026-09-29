# Indexed ingredient candidates: bounded composition handoff

This additive workstream implements ingredient candidate retrieval, not a new resolver or truth promotion. `ingredient-candidates.ts` is **not wired into Check or the resolver**. The existing resolver, public contracts, customer UI and earlier migrations are unchanged. Sami owns the bounded composition after indexed-resolution replay is reconciled.

## Exact evidence, not the legacy fingerprint

The RPC `lookup_ingredient_candidate_ids(text[], boolean, uuid)` derives its digest from actual ordered ingredient text. Each element uses NFKC, contextual Unicode lowercase, ECMAScript whitespace collapse and trimming. Punctuation, order, duplicate entries and slash boundaries remain meaningful. It never reads or trusts `normalized_ingredient_fingerprint` as its match key.

The partial verified-formula expression index selects digest matches; an ordered normalized-array recheck protects against digest collisions. The service helper then fetches only the returned IDs and rechecks the actual arrays again. Missing, duplicate, malformed or changed rows fail closed rather than reducing a contradictory set to a unique result. This second read is not a transactional snapshot: final resolver composition must use existing immutable truth/sealing checks, and the helper must not be treated as an approval issuer.

PostgreSQL's default lowercase can disagree with JavaScript for Greek final sigma. The SQL key therefore uses `und-x-icu`, with a parity regression. A future database ICU/Unicode version upgrade requires parity review and index rebuild before enabling this retrieval path.

## Visibility and bounds

- Only verified formulas match; attached variants must be active.
- Free callers receive only formulas on verified public-standard products and verified variants with an explicit public formula source.
- Managed callers retain standard products and their own shelf-linked private products. Shelf visibility is checked in the indexed query, before its limit.
- Ownerless/detached formulas have no owner field. Only detached verified formulas with an explicit public source are eligible; an unrelated private detached formula cannot become an owner's candidate.
- All formula markets are retained. Retrieval does not filter by requested region or select a regional winner; the existing resolver must preserve region-mismatch abstention.
- Inputs require an owner ID, an explicit free/managed boolean and 1–300 nonblank elements, with a bounded serialized request. The service helper applies the same request bound before querying.
- The SQL result has a 101-row sentinel. The helper rejects overflow before hydration; it never turns `top N` into a unique claim. Zero, one and multiple exact candidates retain their meaning.
- The RPC and private normalization helpers are service-only. This is not a customer raw-catalog endpoint; no raw ingredient text is logged or sent to external services.

## Validation evidence

The new migration is `20260929090000_indexed_ingredient_candidates.sql`. Six focused Node test groups cover helper bounds, ordered normalization, malformed responses, region preservation, ambiguity and overflow. The new pgTAP file has 23 assertions covering privilege boundaries, actual service-role execution, public/private/ownerless visibility, legacy-key disagreement, all-market recall and visibility-before-limit.

`scripts/benchmark-indexed-ingredients.sql` is an explicitly synthetic, rollback-only local harness. It inserts 12,001 distinct verified formula fixtures, analyzes the table, requires the planner to naturally choose the dedicated ingredient digest index and checks exactly one returned candidate. No forced planner setting or full catalog fetch is used. One isolated local run measured 0.033 ms for indexed equality and 0.586 ms for the full RPC; these are development measurements, **not** production latency or recognition-accuracy claims.

Run the harness only in a disposable database:

```sh
psql "$DISPOSABLE_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/benchmark-indexed-ingredients.sql
```

Local pgTAP/harness checks used a separate schema-only database, leaving the shared Supabase stack and founder data unchanged. Four unrelated GraphQL-extension ACL statements could not be restored into that disposable database; the relevant table/function grants and all 23 assertions passed. This is not described as a fresh full Supabase reset. Exact-head database CI and the reconciled root reset remain the full migration replay gates.

## Composition constraints

The root must union returned formula/variant IDs with existing barcode and exact identity candidate sets, hydrate related rows by IDs, and retain the existing pure resolver's ambiguity/conflict/region decisions. Do not call the old full-catalog reader as an ingredient fallback. Label and packaging substring retrieval require a separate reviewed recall-preserving indexed plan; this module does not weaken those matches with token search or similarity top-N.

No hosted activation, deployment, customer data ingestion, provider purchase or public release occurred in this workstream.
