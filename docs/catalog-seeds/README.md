# Starter catalog evidence

Each JSON file is a manufacturer-sourced **product identity** proposal for the
catalog operator. The three 2026-09-28 entries add searchable names only. They
do **not** assert a package variant, GTIN/barcode, ingredient list, formula, or
personal-fit verdict. The Vaseline alias is an alternate product name, not an
assertion that every Vaseline item is this product.

Validate an entry with `node scripts/catalog-ingest.mjs --file
docs/catalog-seeds/<name>.json --local` and rehearse `--apply` against a
disposable local Supabase project before any hosted ingestion. Hosted writes
require the separate P0-C rollout review and exact-project approval. A name
result can help a customer identify a possible product, but a real barcode
match requires separately reviewed variant and identifier evidence; a formula
decision requires separately reviewed formula evidence.
