# Product Check facts companion (P0-B)

This additive backend contract is a factual companion to the existing S6 product-truth snapshot and Personal Decision. It is **not** a scanner-recognition model, catalog expansion, formula verifier, treatment recommendation, or App Store activation. It does not alter the existing safety decision.

`product-check-facts` accepts an authenticated `{caseId,snapshotId}` for a `scan` case. It reads the owner-bound sealed truth snapshot, its immutable evidence IDs, and (only for a verified canonical catalog product) the catalog category. It writes a first-wins `product-check-facts/v1` packet keyed by the exact snapshot. A subsequent call replays the stored packet so a later photo, review, or catalog edit cannot rewrite what this check said. Row-level security permits only the owner to read the stored packet; the service role alone can write it. Deleting the account/case/snapshot cascades to its packet.

The current facts are intentionally narrow:

- A reviewed catalog category is an accepted classification, not a personal-fit claim.
- A verified package formula may list ingredients only when the S6 snapshot proves the exact selected package formula. Unverified, typed ingredient names remain incomplete observations.
- Deodorant, antiperspirant, shampoo, conditioner, body wash, body moisturizer, SPF, broad-spectrum, water-resistance duration, and Drug Facts are reported only when those words appear in sealed, owner-bound label text. The source row ID is attached to every observation. Conflicting SPF values abstain.
- No source-free claims of safety, efficacy, UV protection, concentration, lack of an ingredient, or medical suitability are generated.

The iPhone Check page does **not** call or render this endpoint yet. Once the resolver returns its sealed truth snapshot, the app can call `loadProductCheckFacts(snapshot.resolutionCaseId, snapshot.snapshotId)` and render `describeProductCheckFacts(packet,{caseId,snapshotId})`. It must fence responses to the active owner, request, and snapshot, and keep the existing personal decision and its safety basis separate. This is a concrete integration seam, not evidence of live UX acceptance.

Physical acceptance still needs actual barcode/search encounters across sunscreen, deodorant, hair, and face/body. With no trusted OCR, photo pixels alone do not produce these label facts. A separate catalog-coverage workstream must establish useful scan hit rate; this companion does not solve that metric.

Validation on current main `d96cf55`: 789 application tests, both TypeScript checks, web and iOS exports passed. Fresh local reset applied `20260929080000_product_check_facts.sql`; the complete database suite passed 608 assertions across 26 files, including 15 facts ownership, immutable replay and deletion assertions. `node scripts/smoke-product-check-facts.mjs` exercised the actual local Edge function with two disposable authenticated owners, proving source-row provenance, exact stored replay, cross-owner rejection, missing-snapshot rejection and malformed-request rejection. That runtime check found and fixed the missing `zod` import-map entry; successful source exports alone had not caught it. No hosted deployment or customer UI acceptance is implied by these local checks.
