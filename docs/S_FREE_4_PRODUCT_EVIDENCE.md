# S-FREE-4: Private Free Product Evidence

Status: local platform implementation, stacked on S-FREE-3 PR #58. It is not hosted or wired into Kanuj's camera flow. Hosted anonymous access remains gated by S-OPS-1.

## Exact mobile handoff

1. Capture a front-label, ingredient-panel, or packaging photo in Kanuj's existing Check UI. Do not upload a facial/skin photo to this product-evidence path.
2. Generate one UUID per photo. Call `prepareFreeProductEvidence({requestId, role, mimeType})` from `src/services/remote/freeProductEvidence.ts`. Reuse the UUID on a network retry. The JWT-authenticated server returns a private `customer-product-evidence` path under `<auth-user-id>/free_scan/<role>/<opaque-uuid>.<extension>`; the client cannot choose that path.
3. Decode/copy the image to an `ArrayBuffer` and call `uploadFreeProductEvidence(target, bytes)`, or use the returned target with the same private Storage upload API. Keep `upsert: false`. The 10 MiB bucket limit is enforced by Storage, and the helper checks it before upload. There is no public URL or direct client read/list grant.
4. Call the existing `resolve-product-identity` with a fresh case `requestId`, `consumer: 'scan'`, and at most three `evidencePhotos: [{storagePath,role,extractedText?}]`. An on-device OCR string, when available, is only candidate evidence. A photo without extractable text can legitimately return `insufficient_evidence`. Render S6 `state`, `candidates`, and `nextAction` truthfully; never label a candidate verified. Kanuj owns the capture-to-resolver adapter and UI copy after this contract merges.

`prepare-free-product-evidence` accepts exactly `requestId` (UUID), `role` (`front_label`, `ingredients`, `packaging`), and `mimeType` (JPEG/PNG/WebP/HEIC/HEIF). It returns `bucket`, `storagePath`, `role`, `mimeType`, `maxBytes`. Invalid requests are 400; retrying a UUID with a different role/type is 409; six issued paths per owner per rolling 24 hours yield 429. The grant is not an upload completion signal: if Storage upload fails, retry the same path, or use a new request UUID as quota permits. A path grant authorizes a single immutable object only. The resolver checks the Auth owner, exact grant, role, and object existence before saving evidence.

## Security and truth boundaries

The existing paid/managed `<user-id>/<role>/<filename>` insert policy is unchanged. A free Auth user may only insert into a server-granted `free_scan` path for their own immutable Auth UUID. RLS grants no client update/delete and no public read. Grant issuance is service-only, serialized per owner, and bounded; raw grants are owner-selectable only. The existing Storage-first account deletion recursively removes both uploaded and orphaned objects, then Auth deletion cascades grants and resolution rows.

Free `consumer: 'shelf'` now requires managed membership; it cannot be used to write a paid Shelf case. Free Check uses only the publicly sourced catalog subset. Visual resemblance and OCR text can produce candidates, not a verified formula. Only authoritative S6 identifier/formula provenance can do that. Unresolved free cases do not create founder review tasks. No OCR provider, model image inference, ingredient extraction guarantee, cosmetic diagnosis, or automatic product identification is claimed by this ticket.

## Release gate

Local integration tests cover two guests, Storage/RLS isolation, unknown and text-candidate outcomes, quota, paid Shelf separation, and account deletion. The `S-OPS-1` milestone still must address guest-account farming, storage cleanup/retention, broader abuse controls, identity linking/session loss, and hosted rollout. Do not deploy this migration/Edge function or turn on hosted guest sign-ins merely because this local contract passes tests. The present hosted catalog also has too little verified formula coverage to promise useful photo-based fit.
