# Part 2 reference input and rights ledger

This ledger covers one bounded formulation-role input used for an original Glycerin sentence in the local Part 2 release. It is separate from the source permissions of a product label or private photo and from the code licence. It grants no blanket glossary, registry, competitor database, chemical image or bulk API import.

## Qualified authoritative support

The integration owner inspected the rendered official [European Commission CosIng GLYCERIN entry 34040](https://ec.europa.eu/growth/tools-databases/cosing/details/34040) on **2026-10-02** and observed the **HUMECTANT** role. The official [CosIng function definitions](https://ec.europa.eu/growth/tools-databases/cosing/reference/functions) describes the relevant role in terms of formula moisture retention during use. This supports a reference formulation role, not proof of what Glycerin does in this selected product, skin hydration, clinical efficacy, safety or personal suitability.

The entry footer links to the [European Commission legal notice](https://commission.europa.eu/legal-notice_en). The integration owner verified that EU-owned content is reusable under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) with appropriate credit and indication of changes. No entry-specific restriction was observed in this inspected role material. No third-party chemical image or third-party data/database/prose was copied. This is a scoped review of the listed fields and operations; future imports or additional sources require their own review.

## Exact original explanation

> Glycerin has a reference humectant role: it can help retain moisture in a formula during use.

This sentence is original Derive wording, `reviewed_editorial`, based on separately qualified `source_inventory` role evidence and the official definition scope. It does not copy an external explanation paragraph. It may attach only to an eligible, uniquely resolved Glycerin occurrence; conditional/source-only qualifiers remain attached. The source supports no inferred concentration, actual product performance or clinical/profile claim.

| Ledger field | Pinned value |
|---|---|
| Explanation ID / revision | `derive-glycerin-humectant-v1` / `1` |
| Ingredient ID / role | `glycerin` / `humectant` |
| Language / explanation release | `en` / `glycerin-reference-v1` |
| Review date / owner | 2026-10-02 / `Codex-local-editorial-review` |
| Review scope | `local_editorial_only`; no founder production-corpus approval implied |
| Source inventory revision | `cosing-rendered-34040-and-functions-2026-10-02` |
| Import version | `minimal-reviewed-projection-v1` |
| Allowed fields | ingredient name, reference humectant role, function-definition scope |
| Allowed operations for these fields | process, store, display, export with licence credit and original-wording notice |
| Policy ID | `cosing-eu-glycerin-humectant-local-v1` |
| Source policy licence | `EU-owned-CC-BY-4.0` |
| Deadline | `2027-01-01T00:00:00Z`, conservative local review deadline |
| Withdrawal dependencies | CosIng entry 34040, humectant definition, EU-owned CC BY 4.0 permission |

Required displayed/exported attribution:

> European Commission CosIng, © European Union, CC BY 4.0. Original Derive wording based on the reference role.

The source entry, definition, licence link, review date and review owner accompany the card. Core snapshots pin its separate policy/dependencies. Withdrawal, disabled source operation or expiration removes the reference card without removing independently permitted identity/literal evidence. The card is omitted if its review/policy deadline cannot cover the evidence binding's current-use deadline. It never refreshes the label's observation or formula date. Durable service-owned recalls may target the card ID, card dependency, policy ID or policy entry/definition/licence dependency. These tombstones stay effective across release rollback. Current normalization omits only the matching role card; saved reads require an authorized fresh immutable card-only projection with a greater result revision, retaining independently permitted ingredient evidence.

## Integrity and release scope

The typed minimal factual projection and original explanation live in [`reference-inputs.ts`](../src/domain/part-two/reference-inputs.ts). Hashes below describe canonical Derive-reviewed metadata/projections and the assembled release. They are **not hashes of downloaded CosIng database files, full HTML pages or third-party data dumps**.

| Hash | SHA256 |
|---|---|
| Minimal reviewed source projection | `bdc952a788d75f8f0f986d69363bb1028bff5b55afa1ff84a31319d8b29bb0f3` |
| Independent source rights policy | `724f433346e3d8cf127ec743f7be67193bc725c824889d4cd6b70d62aaeeb283` |
| Assembled dictionary/reference release | `dcc577b2fa0928c7560a224116229461b94ba62241541f1cd4ab7238163af9e2` |

The combined release remains **`local_only`**, with the same **20 synthetic identities / 23 exact aliases**. Its dictionary release is `derive-local-exact-v2`, explanation release `glycerin-reference-v1`, fact policy `attributed-positive-facts-v5`. The alias corpus still needs founder adjudication and broader source/QA release ownership before production. A rights-cleared narrow source role does not adjudicate the synthetic alias corpus or establish market/optical completeness. No live source lookup is performed during scanning or normalization.
