# v7 header image and scan date: bounded review proposal

This is evidence and a minimal parent review proposal, not permission activation or deployment. PR198 remains client presentation only.

## Actual Hydro Boost identity

The existing saved assessment `f4b8491e-fc69-4b88-a784-1e908a97c143` refers to scan `da64013b-0768-40bd-8940-732ad8a57204`, item `431021d6-295b-4b9c-b0e0-ef2cbdb747ba` and snapshot `cfe069cc-d365-4ab0-8df8-21d7afee3786`. Owner-authorized filtered identity supplies **Neutrogena / Hydro Boost Water Gel**, `image:null`, and empty `variantText`. Snapshot size/unit and source quantity are null. Product/variant/formula IDs are null; published-version identity must not be promoted into confirmed package truth.

The scan ledger's actual `created_at` is **2026-10-05T14:55:15.215407Z**. Save occurred at 14:58:27.299337Z. The strict client ScanResult response exposes neither scan-created timestamp nor a equivalent scan-time field. Part2 interpretation creation and source-observed dates are not scan time. This client change therefore omits the date and unknown size instead of substituting save/source time or guessing volume.

## Image diagnosis

A read-only request to the already approved public source for barcode `0070501110478`, selecting code/name/brand/quantity/front URL, returned Neutrogena Hydro Boost Water Gel and this front image:

[Exact public barcode front photo](https://images.openbeautyfacts.org/images/products/007/050/111/0478/front_en.3.400.jpg)

The source response omitted quantity. Visual inspection showed the blue Neutrogena Hydro Boost Water Gel jar; no exact package quantity was established. No OCR, private photo, paid model or new provider was used.

This is a **policy/license gate**, not a missing renderer or broken host allowlist. `OBF_PUBLIC_SOURCE_RELEASE` in `supabase/functions/_shared/part-one-ordinary.ts` (`derive-obf-public-content-v1`) retains identity/ingredients and explicitly excludes images, OCR, private capture and rehosting; hotlink remains false. `permittedOpenFactsImage` in `part-one-providers.ts` already restricts HTTPS host and exact returned barcode front path. The lookup supplies an image only after that permission predicate. Open Facts product images have separate CC BY-SA rights from the database/content licenses: [official license guidance](https://openfoodfacts.github.io/openfoodfacts-server/api/tutorials/license-be-on-the-legal-side/).

## Minimal changes for parent review

1. Review a separate versioned public front-image release granting only the existing source's exact barcode-bound front URL, image retention metadata, hotlink and shared display. Preserve the current HTTPS/host/path/version predicate and expiry/withdrawal checks. Add verified image attribution and CC BY-SA license evidence plus reachable attribution/license presentation. No private capture, OCR, image inference, cropping/rehosting or unrelated source transfer. Review the actual policy artifact before activating; this PR does not widen the grant.
2. Project the original scan ledger timestamp as an optional owner-authorized `saved_basis.scanCreatedAt` (or equivalent explicitly named scan field), fenced to the saved owner and pinned original scan/snapshot. Update strict server/client schema and tests for foreign owner, wrong scan and timestamp provenance. Do not use current reassessment, source observation or save time. This proposal adds no decision rule and needs its own reviewed backend activation.
3. Leave size absent until an admitted identity field explicitly supplies exact package quantity. No policy change can manufacture a missing source value.

The client can restore brand from a normal owner-authorized original scan read, verifying original scan/generation/item/snapshot and live source deadlines. It never swaps the saved answer for the current computed answer. An already permitted exact identity image would render through the existing client image component; no source grant is activated here.
