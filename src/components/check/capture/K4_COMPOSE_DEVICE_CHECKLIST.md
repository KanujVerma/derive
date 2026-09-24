# K4-COMPOSE device acceptance

Use a physical iPhone with camera permission granted and a product with a readable UPC/EAN barcode. Confirm each item before wiring this host into canonical Check.

- [ ] Open and close capture through its host callback; Check keeps its own navigation and state.
- [ ] Scan a barcode. The callback carries only a numeric barcode lookup input, marked as customer evidence.
- [ ] Capture front label, ingredients, and packaging. Each remains a separate local photo reference; no photo is uploaded or resolved by this host.
- [ ] Retake one photo and review again. The callback contains the new photo reference and no stale review or candidate selection.
- [ ] Exercise unknown and ambiguous processor responses, then choose a candidate. The callback keeps the unresolved review state and records the choice only as `selectedCandidateId`.
- [ ] Deny camera permission, retry permission, and close capture. No scan or photo is silently fabricated.
- [ ] Inspect device logs and network traffic during capture and handoff. No barcode, local URI, image bytes, or candidate detail is logged or sent by this module.
