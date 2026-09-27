# Real-image perception benchmark readiness

This is an **offline manifest validation and supplied-output replay tool**, not an image extractor. At the initial implementation checkpoint no images had been supplied. A later private intake now contains **12 preliminary supplied PNGs**, but **zero frozen rights-cleared images with independent gold**. No Gemini, GPT/Luna, OCR or barcode adapter has been run by this increment. No provider has won. Default output remains `CORPUS_NOT_READY`, zero accepted benchmark images, `NOT_RUN` scenarios and null accuracy/latency/cost. Fabricated test gold is a harness self-check, never benchmark performance or catalog evidence.

## Preliminary image intake, not benchmark acceptance

The twelve original images were inspected locally without modification or copying. A private, outside-repository inventory records exact filename, byte count, SHA-256 and PNG dimensions. The user clarified that **all twelve are photographs by Amazon reviewers**, publicly available and supplied for this test—not user-owned photographs. Public availability does not establish permission. Source URLs and reviewer permissions are unavailable; rights remain **unverified**, with zero eligible frozen corpus images. Only preliminary private local inspection is in scope: no cloud upload, image copying, publication or rights-cleared provider benchmark. No private paths or images enter this document or commit.

Independent literal gold is not yet created. Apparent front/back pairs do not establish the same exact package generation, region or formula; visible old/new packaging differences require review, and a back image without visible product identity remains unbound. Missing or partial barcodes stay unreadable. The set is useful preliminary intake, not representative coverage or a provider accuracy result. Rights/consent evidence, independent gold, exact evidence binding and approved provider handling still gate the frozen corpus.

## What was missing and what is now reproducible

The existing [P0-A evaluator](P0_A_PROVIDER_EVALUATION.md) exercises 15 synthetic extraction envelopes and synthetic resolver cases. It is retained unchanged. This separate tool adds the prerequisites for a real-image benchmark: a frozen private manifest, source/permission/gold evidence references, image byte identity, approved provider roster, run identity, strict literal comparisons and sanitized reports. It reuses `parseProductEvidenceExtraction` and its candidate-only resolver projection; no provider output can add truth authority.

Run with Node 22:

```sh
node --experimental-strip-types scripts/perception-benchmark-cli.ts
node --experimental-strip-types scripts/perception-benchmark-cli.ts /private/manifest.json /private/images MANIFEST_SHA256 /private/outputs.json
```

Omit the output file to obtain `NOT_RUN` rows for every registered provider. The independently recorded SHA-256 is over exact UTF-8 manifest bytes. Any edit to rights, gold, roster or image hash requires a new recorded benchmark freeze. Every image is read locally, SHA-256 checked, limited to 10 MiB and magic-byte checked as `.jpg`, `.png` or `.webp`. Image filenames must be simple opaque names, not paths; symlinks and corpus-directory escapes are rejected. These checks establish file identity/type boundaries, **not successful decoding or image quality**. No image or output files should be committed.

Manifest and output JSON must be regular files, not symlinks or directories. The opened file's identity/type and byte bounds are rechecked, and reads are capped at the declared limit plus one detection byte (2 MB manifest / 16 MB outputs). Diagnostics remain sanitized.

Image reads use the same bounded regular-file reader at 10 MiB. It rejects symlinks, checks the opened descriptor against the inspected inode, and reads at most the limit plus one detection byte even if the file grows after inspection. Exact-limit files remain valid; oversize or replaced inputs fail. Existing image signatures, frozen hashes and private diagnostics remain unchanged. This is offline file-input hardening, not photo-recognition or corpus acceptance.

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

This increment changes no app, shared contract, database, hosted state, catalog promotion, environment setting or billing. Actual perception delivery remains blocked by **rights-cleared images with independent gold**, approved terms and real adapters; the twelve preliminary third-party review images do not clear those gates. This tool removes a reproducibility gap rather than pretending those gates are complete.

## Local implementation checks

Against base `465173e`, focused tests passed 8/8. The complete `npm test` loop passed all 67 test files: 51 files emitted TAP with 598 registered tests and zero failures; the remaining assertion-style files also completed. Both application and tests TypeScript checks passed. Web and iOS JavaScript exports passed with environment loading disabled. Default CLI output was independently inspected as zero-image `CORPUS_NOT_READY` with null metrics. These are tooling/replay checks, not real-image acceptance. Independent review and exact-head CI are still publication/merge gates owned by the portfolio orchestrator.

After independent portfolio review, the JSON reader was hardened to reject manifest/output symlinks and non-files, bind checks to the opened descriptor, and bound actual reads. The isolated branch reconciled cleanly with main `aa12e08`, then the newer documentation checkpoint `411bb87`. Fresh focused tests passed 8/8, including the new JSON-input rejection paths. The entire current suite passed **74 test files**, including **56 TAP-reporting files / 620 TAP tests / zero failures**; both TypeScript checks and web/iOS exports passed. A first export attempt was blocked by sandbox write permission for its local log; after granting that worktree write scope, both exports completed. No failure was waived. Independent review did not clear image rights or provider selection; exact-head CI remains the merge gate.

The focused follow-up against main `fc6f923` closes the image-read race with the same bounded Buffer reader. Four new adversarial tests passed, plus all eight existing benchmark tests. The complete current loop passed **76 files**, including **58 TAP-reporting files / 632 TAP tests / zero failures**; both TypeScript checks and web/iOS exports passed. Test fixtures are fabricated temporary bytes, not the preliminary review-photo corpus. No private image was copied, modified or sent to any provider. Publication still requires independent review and exact-head CI.
