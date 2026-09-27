# Real-image perception benchmark readiness

This is an **offline manifest validation and supplied-output replay tool**, not an image extractor. No real-image corpus has been supplied; no Gemini, GPT/Luna, OCR or barcode adapter has been run by this increment. No provider has won. Default output is `CORPUS_NOT_READY`, zero images, `NOT_RUN` scenarios and null accuracy/latency/cost. Fabricated test gold is a harness self-check, never benchmark performance or catalog evidence.

## What was missing and what is now reproducible

The existing [P0-A evaluator](P0_A_PROVIDER_EVALUATION.md) exercises 15 synthetic extraction envelopes and synthetic resolver cases. It is retained unchanged. This separate tool adds the prerequisites for a real-image benchmark: a frozen private manifest, source/permission/gold evidence references, image byte identity, approved provider roster, run identity, strict literal comparisons and sanitized reports. It reuses `parseProductEvidenceExtraction` and its candidate-only resolver projection; no provider output can add truth authority.

Run with Node 22:

```sh
node --experimental-strip-types scripts/perception-benchmark-cli.ts
node --experimental-strip-types scripts/perception-benchmark-cli.ts /private/manifest.json /private/images MANIFEST_SHA256 /private/outputs.json
```

Omit the output file to obtain `NOT_RUN` rows for every registered provider. The independently recorded SHA-256 is over exact UTF-8 manifest bytes. Any edit to rights, gold, roster or image hash requires a new recorded benchmark freeze. Every image is read locally, SHA-256 checked, limited to 10 MiB and magic-byte checked as `.jpg`, `.png` or `.webp`. Image filenames must be simple opaque names, not paths; symlinks and corpus-directory escapes are rejected. These checks establish file identity/type boundaries, **not successful decoding or image quality**. No image or output files should be committed.

## Private manifest schema (version 1)

- `schemaVersion: 1`, opaque `benchmarkId`, nonempty `cases` (maximum 1,000), nonempty `providers` (maximum 20). Unknown fields are rejected.
- Each case: unique opaque `id`; unique simple `imageFile`; unique exact `imageSha256`; scenario tags; `rights`; `goldEvidenceRef`; and independently reviewed `gold` in the existing provider-neutral extraction envelope. Repeating identical image bytes under another filename is rejected to avoid inflating sample count. Gold's evidence ID must equal the case ID. Roles remain the existing `front_label`, `ingredients`, `packaging` contract; this tool does not add a new camera classifier contract.
- `rights`: opaque `sourceEvidenceRef`, `permissionEvidenceRef`, `allowedUses`. `local_evaluation` is mandatory; `provider_evaluation` is additionally required for each cloud-executed case. References point to **actual privately retained rights/consent records**, not unchecked retailer-image URLs. A populated reference is an audit prerequisite, not automated legal certification.
- Each provider: opaque `id`, `processing: local | cloud`, optional `privacyReviewRef` (mandatory for cloud). The review must document terms, training use, retention/deletion, processing region, access controls and explicit approved image purpose before any external execution. This tool never performs or grants that review.
- Case tags: `clear_front`, `ingredients`, `curved`, `reflective`, `tiny_barcode`, `blur`, `low_light`, `store_aisle`, `bathroom`, `old_new_packaging`, `similar_variants`, `kj_beauty`, `multilingual`. Reports expose coverage counts, not a claim that every required condition was tested. One case may have several tags; counts are not independent image totals.

## Supplied run schema

The output file is an array of runs. Each run has `providerId`, pinned opaque `modelVersion`, SHA-256 of the adapter implementation and prompt (`adapterSha256`, `promptSha256`), and nonempty `entries`. Each entry contains `caseId`, the exact frozen `imageSha256`, independently produced `output`, measured nonnegative `latencyMs` and `costUsd`. A zero cost must reflect an actual zero-charge run; it is not permission to invent free provider economics. Missing case outputs stay `NOT_RUN`. Duplicate providers/cases, wrong image hashes, nonfinite measurements, unregistered providers and missing cloud consent fail closed.

The tool validates declarations and replays them; it cannot prove that an adapter really saw the image, measurements are honest or the run wasn't a gold replay. Retain private invocation logs and reviewed adapters alongside the freeze. Never copy gold into outputs to claim real performance.

## Metrics and limits

Exact brand/name/variant/barcode/region/label strings, ordered ingredient occurrences, literal decimal/unit/context triples, outcome/abstention and role are checked separately. Field rates use only executed cases with that field present in gold; missing outputs are excluded, malformed executed outputs fail. Exact-candidate success also rejects invented extra observations. Role mismatch fails the existing authorized evidence-role parser; this is not a benchmark of the future five-way AUTO classifier. Reports omit image paths, rights/source records, package text, gold and raw provider outputs.

`unsupportedCandidateCount` counts non-abstained proposals on gold-abstention cases. It is **not a universal confidence score** and does not detect every plausible-but-wrong proposal; inspect exact field errors too. Latency/cost cover supplied extraction executions only, not full time to a useful resolved product. Formula verification, package authenticity, canonical exact variant authority, resolver outcomes, privacy-policy correctness, operational complexity and physical barcode quality require their separate acceptance programs. The report never automatically picks a winner, even if all rows pass.

## Next actual work and blockers

1. Collect representative rights-cleared images and independent literal gold; include exact package/version/size/region source evidence privately. No customer-photo reuse without explicit purpose-specific rights.
2. Review privacy and provider terms. Decide native OCR versus still-image cloud adapters with founders; do not cloud-stream the viewfinder.
3. Freeze corpus and run current barcode, practical on-device OCR, Gemini candidate and GPT/Luna candidate on the same images. Adapters must remain server-side or local benchmark tooling, not Expo client secrets.
4. Compare literal extraction, abstention, difficult-scene coverage, latency/cost and time-to-useful-resolution. Document operational/privacy tradeoffs before selecting any extractor.

This increment changes no app, shared contract, database, hosted state, catalog promotion, environment setting or billing. Actual perception delivery remains blocked by real images, independent gold, approved terms and real adapters; this tool removes a reproducibility gap rather than pretending those gates are complete.

## Local implementation checks

Against base `465173e`, focused tests passed 8/8. The complete `npm test` loop passed all 67 test files: 51 files emitted TAP with 598 registered tests and zero failures; the remaining assertion-style files also completed. Both application and tests TypeScript checks passed. Web and iOS JavaScript exports passed with environment loading disabled. Default CLI output was independently inspected as zero-image `CORPUS_NOT_READY` with null metrics. These are tooling/replay checks, not real-image acceptance. Independent review and exact-head CI are still publication/merge gates owned by the portfolio orchestrator.
