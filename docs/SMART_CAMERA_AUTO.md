# Smart Camera — bounded Auto increment

Sami is DRI. Starting reconciled capture head: `e0591eacd3a7b35d6d96f79497c18242dcda5963`; reconciled main base `411bb87b3facebed7a00684d7e99921c100fb1bd`. This increment preserves #95/#99 and Kanuj's merged #102/#107/#101. Kanuj's canonical Check/root/P0-B composition is unchanged.

## Actual behavior

Open either existing camera entry → Auto. Supported barcode detection stays active and a shutter is available; no mandatory evidence-role picker. A valid observed GTIN can take the existing zero-shutter handoff. If photos already exist, mixed evidence still requires review. The synchronous operation gate blocks barcode completion during photo capture, including the pre-render interval.

An Auto still has no working image-classification signal. Its preview asks **Which part is in this photo?** The customer chooses product/front label, ingredients or packaging before Use photo appears. Retake needs no classification. The selected role is private capture routing, not canonical identity or formula authority. A single **Choose what to capture** action reveals manual modes; explicit manual photo intent preselects only the routing role. Return to Auto remains available. Torch is manual; support/performance needs actual device testing.

The local GTIN check rejects bad lengths/check digits, not out-of-catalog products. Capture currently supports UPC-A, EAN-13 and EAN-8, with symbology-bound lengths. Compressed UPC-E is excluded until explicit expansion is implemented and tested: the existing `src/utils/barcode.ts` does not perform that expansion despite its header comment, so its eight digits must not masquerade as EAN-8. Unsupported codes retain photo/search recovery. Successful decoding is not a catalog match, exact formula or authenticity proof. No cloud video, image provider, OCR, automatic shutter firing, confidence score, new truth contract, paid dependency or Check quota is added.

## Increment boundaries

This is the honest first Auto interaction, **not complete intelligent perception**. A later validated classifier/extractor can provide role candidates, with engine/version/bounds/uncertainty and a server-authorized evidence binding. It must not fabricate certainty from camera metadata or convert model barcode text into device-observed GTIN authority. Benchmark/provider selection and sensitive-image transfer review remain independent gates.

Existing owner fences, private grants, immutable upload, retry IDs, lost-ACK recovery and S6 → immutable ProductTruthSnapshot → P0-B pipeline remain unchanged. No app/root/Check composition, hosted activation, catalog population, migration, billing or analytics changes.

## Acceptance

Focused tests cover uncertain roles, barcode gating/check digits and the synchronous callback boundary, including barcode → review before the next render; processing and handoff read the current evidence snapshot. Source assertions guard composition. Full unit/app/test TypeScript/web+iOS exports, scope/secret/diff review and both exact-head CI jobs are merge gates. These are not physical proof.

Previously the founder confirmed only the full-screen shutter/tab overlap fix. Auto shutter → clarification → Use photo, valid/invalid barcode, mixed retained evidence, manual correction, torch, cancel/retake, interruption, small screen and large fonts require a fresh physical run. Do not inherit physical acceptance from #99.

## Local validation checkpoint

On the reconciled main above plus this increment, all 74 current unit-test files completed successfully: 56 emitted TAP with 619 registered cases and zero failures; assertion-style scripts also passed. Both application and test TypeScript checks, web and iOS exports, and diff/scope checks passed. Independent review found and corrected a same-tick barcode → process stale-render race; the seven focused Auto tests pass. No local database reset, hosted state change or physical-device run was performed for this leaf. Both exact-head CI jobs remain publication/merge gates; these local results do not claim their success.
