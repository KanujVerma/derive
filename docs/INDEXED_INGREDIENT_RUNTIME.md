# Ingredient lookup: runtime composition receipt

This bounded composition makes the actual `resolve-product-identity` HTTP path use the indexed ingredient candidate RPC from #179. It builds on #174's immutable same-Check continuation and barcode provenance without editing that continuation's logic, public contracts, UI or migrations.

Ingredient-only input, and ingredient input combined with a barcode or exact typed identity, unions complete indexed candidate sets. It hydrates only returned formula IDs and their related active variant/product IDs, rechecks ordered ingredient equality and market fields, and rechecks free/public or managed/owner visibility. Missing or newly invisible rows fail closed rather than dropping a member of an ambiguous set. Detached private formulas remain excluded. The service helper's 101 sentinel becomes the existing `CATALOG_TOO_LARGE` 503 response.

Owner shelf reads now include only requested private product IDs, in batches of 100. The existing unique owner/product link index keeps those reads bounded. No full owner shelf is scanned. The existing pure resolver still decides authority, contradiction, ambiguity and region mismatch: ingredient resemblance cannot override an authoritative barcode, and formula-only evidence cannot become product approval.

Label/packaging text retains the existing conservative capped broad path because silently discarding cross-product literal contradictions would weaken truth. This pass does not add label indexing, OCR, model calls, catalog data, payment activation or hosted deployment. The current barcode/search-first release does not claim photo recognition.

## Verification

- Fresh local full reset replayed the composed tree through `20260929090000_indexed_ingredient_candidates.sql`; all 29 pgTAP files / 664 assertions passed.
- Focused tests execute the actual private hydration and owner-visibility functions with injected reads, without starting the Deno endpoint or importing credentials. They test changed/missing/invisible evidence, complete region retention, explicit overflow, union routing and bounded 100-ID owner batches.
- `scripts/test-indexed-ingredient-runtime-local.mjs` is local-only and exercises real Auth → Edge → database → immutable snapshot responses with 12,001 synthetic verified formulas. It proves exact recall beyond the old 10k ceiling, punctuation/order/duplicate abstention, immutable retry, ambiguity, region mismatch, private ownership, authoritative barcode contradiction and 101-candidate overflow. Formula fixtures remain immutable until final owner/case cleanup; nothing is uploaded externally.
- Existing continuation/provenance, P0-A truth and S-FREE-4 Storage/RLS integration smokes passed against this runtime.

The new local harness is a verification tool, not target-user coverage or recognition accuracy evidence. Physical device, real catalog hit rate and hosted scanner activation remain separate release gates. Root owns serialized upstream reconciliation, exact-head CI, merge and activation decisions.
