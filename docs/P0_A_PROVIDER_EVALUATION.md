# P0-A synthetic evidence evaluation

No extraction provider is selected, enabled or contacted. This increment is an offline harness, not a working image extractor. No credentials, photos, customer data, network requests, catalog imports or truth promotions are involved. All brands, variants, formula assertions, identifiers and transcriptions in the corpus are fabricated and must never populate a production catalog. Synthetic catalog authority flags exist solely to exercise deterministic resolver behavior.

## Boundary

`ProductEvidenceExtraction.ts` defines an untrusted, provider-neutral candidate envelope with an opaque evidence binding, role, literal label strings, ordered ingredient occurrences, literal number/unit/context triples, and explicit abstention. It contains no authority, truth snapshot, score, provider credentials, image bytes, URI or Storage path. The experimental validator in the fixture directory rejects extra fields, mismatched evidence IDs, malformed arrays, empty guesses and observations mixed into abstention. Validation proves shape, not correctness. Number strings are observations, not normalized concentrations or regulatory limits.

The evaluation-only projection sends extraction strings to resolver label resemblance and ingredients to ingredient fingerprint matching. It deliberately never treats extracted barcode text as device barcode input or extracted brand/name as exact typed identity. Thus provider proposals cannot independently reach `verified_product_formula`. This projection is not integrated into Edge or the app; production activation still requires a server-owned adapter, source/evidence binding, privacy review and integration validation.

## Run

With Node 22's existing type stripping:

```sh
node --experimental-strip-types tests/p0a-evaluation.test.ts
node --experimental-strip-types scripts/evaluate-product-evidence.ts
node --experimental-strip-types scripts/evaluate-product-evidence.ts /absolute/path/to/synthetic-outputs.json
```

The optional local JSON file is a case-ID keyed map of independently supplied extraction envelopes. Missing cases remain `NOT_RUN`. The evaluator prints a machine-readable report and exits 1 on a resolver or extraction gold mismatch. It uses no heavy dependency and makes no network call. Strict field equality preserves punctuation, ingredient order, duplicates, decimal text and units; a later reviewed normalization policy may add a separate metric but must not conceal critical number/order errors.

## Recorded baseline at 45f1773

| Measurement | Result | Meaning |
| --- | --- | --- |
| Extraction outputs independently supplied | 0/15 executed; 15 `NOT_RUN` | No extraction accuracy reported; exact-candidate rate is null |
| Synthetic gold replay | 15/15 equal | Evaluator self-check only, not provider performance |
| Injected extraction mistakes | 5/5 detected | Invented variant, changed order, decimal, unit, false non-abstention |
| Candidate-authority isolation | 15/15 remain non-verified | Evaluation projection does not promote OCR or barcode strings |
| Deterministic synthetic resolver gold | 13/15 pass; 2 fail | Baseline conflict handling needs the separately owned resolver fix |
| Real image scenarios | 0/4 executed; 4 `NOT_RUN` | Glare, curved packaging, low light and multilingual labels untested |
| Real image accuracy, latency, cost | null | No winner or production-quality claim |

The two baseline failures are `mismatched-barcode-region` (gold `ambiguous_candidates`) and `mismatched-barcode-ingredients` (gold `identified_formula_unverified`). Both return `verified_product_formula` at the baseline because barcode resolution returns before conflicting evidence is considered. These failures remain visible; they are not waived or counted as passes. The root resolver workstream owns the fix and must rerun this command after composition. The remaining cases exercise exact unique barcode and formula linkage, unknown barcode, shared reformulation without guessed formula, size/concentration/region and similar-name variants, front-only candidates, formula-only ingredient evidence, changed ingredient order, empty evidence and misleading instructions.

## Validation and next evidence

Focused harness tests: 5/5 pass. Isolated strict TypeScript check of all added source/script/test files: zero errors. `git diff --check`: clean. The application-wide unit/type/export gates belong to the root composition pass; this leaf worktree has no installed dependencies and reuses the root worktree's TypeScript executable only for the isolated check. Snapshot-aware metrics remain deferred until the root authoritative snapshot implementation is composed; the synthetic resolver checks do not establish durable snapshot persistence or runtime truth correctness.

Before any real-image benchmark, obtain a representative rights-cleared corpus with exact variant, package size, region, formula version, transcription and number/unit gold; approve provider terms, training use, retention/deletion, processing region, access controls and server-side credentials. Review customer consent for every intended image purpose. Run actual adapters and measure hallucination/abstention, exact variant/formula behavior, critical-number and ingredient-order errors, difficult captures, device/offline behavior, latency, cost and review burden separately. Until then all real-image and provider-selection claims remain untested.
