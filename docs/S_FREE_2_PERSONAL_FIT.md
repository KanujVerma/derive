# S-FREE-2: optional free profile and personal fit

This is the merged local platform handoff for K-FREE-2. It does not change `app/**`, managed onboarding, membership, skin photos, Shelf/history, or hosted anonymous activation. The implementation has not been deployed or consumed by the mobile UI.

## Interface

After a verified anonymous or permanent Supabase Auth session exists, call `free-personal-fit` with a POST body:

| Operation | Body | Response |
| --- | --- | --- |
| Read | `{ "operation": "get_profile" }` | `{ "profile": FreeSkinProfile \| null }` |
| Save/replace | `{ "operation": "save_profile", "profile": FreeSkinProfileInput }` | `{ "profile": FreeSkinProfile }` |
| Fit | `{ "operation": "fit", "productId": UUID, "variantId"?: UUID }` | `{ "fit": PersonalFitResult }` |

Canonical types are in `src/contracts/FreePersonalFit.ts`; the client wrapper is `src/services/remote/freePersonalFit.ts`. No `userId`, membership, formula, ingredient list, or fit label is accepted from the caller. A missing `variantId` returns `NOT_ENOUGH_INFORMATION`; a verified product alone is not a verified formula. A missing profile is also a valid unknown result, never an API error. Failed Auth is 401, invalid payload is 400, an unverified/nonexistent catalog product or variant is 404, and data-source failures fail closed with 503. All responses are private/no-store.

The free profile is one complete replaceable snapshot: up to three canonical goals, skin behavior, reactivity, explicit pregnancy/nursing status (`yes`, `no`, `prefer_not_to_say`, `unanswered`), explicit sensitivity status and at most ten reported ingredient names, plus explicit current-treatment status and selected treatment classes. "Unanswered" and "prefer not to say" are never stored as "no." The optional UX may skip the profile entirely. It should request the user's answer rather than infer these fields from photos or demographics. No age, race, ethnicity, Fitzpatrick type, budget, baseline photos, long notes, or managed routine details enter this table.

## Evidence and safe limits

The endpoint checks a sourced canonical product, an active verified variant, and exactly one S6-verified formula linked by trusted identifier provenance. Unknown or multiple formula versions return `NOT_ENOUGH_INFORMATION`. Product category and the verified ingredient list are facts; the user's self-report is context, not a medical diagnosis. The result supplies a categorical label, a stable reason, a short explanation, evidence used, missing evidence, and only public source URLs. There is no numerical score and no model-provider dependency.

The deliberately narrow first rules are: an exact normalized ingredient-list match to a user-reported sensitivity warrants caution, while a reported sensitivity with no exact match remains unknown (aliases and triggers are not inferred); a listed retinoid with reported pregnancy/nursing or withheld/unknown context never gets an unqualified positive fit; overlap with reported retinoid/acid/benzoyl-peroxide treatment or easily reactive skin and a listed active warrants caution; a verified moisturizer without those actives *could work* for someone who reports both a dryness goal and dry/tight skin behavior. The retinoid check matches a whole `retinyl` ingredient token rather than enumerating only palmitate/acetate, so retinyl propionate and other named retinyl esters cannot receive a positive moisturizer label by omission. This is a conservative rule, not a claim about individual exposure or risk; [PubChem identifies retinyl propionate as a retinol ester](https://pubchem.ncbi.nlm.nih.gov/compound/Retinyl-propionate). That final label is not proof of effectiveness, tolerance, formula concentration, allergy status, or medical safety. All other cases return `NOT_ENOUGH_INFORMATION` until a separately reviewed rule is justified. The retinoid pregnancy caution is anchored to [AAD pregnancy skin-care guidance](https://www.aad.org/public/everyday-care/skin-care-secrets/routine/pregnancy-skin-care); it tells the customer to consult a clinician, not to self-diagnose or stop a prescription.

Shelf/history persistence belongs to S-FREE-3, which is now merged; the fit service may use same-catalog-product user-reported reactions only as a cautious signal, never ingredient causation. No OCR, camera, or user-provided formula authority is part of this service; S-FREE-4 owns private evidence capture and is also merged locally. Formula Details remains factual and separate from Personal Fit. The current hosted catalog has no verified formula versions, so deploying this alone would yield unknown results rather than personalized product claims.

## Security and release gates

`public.free_skin_profiles` is separate from the managed `skin_profiles` table. It cascades on account deletion, has owner-only RLS policies, and has no `anon` or `authenticated` Data API privileges; the JWT-gated function verifies the user and writes through service role using only the verified `userId`. The profile is not in PostHog, logs, public catalog responses, or service-generated source URLs. The database enforces enum and reported-state consistency in addition to strict Edge validation. Unknown state is not silently defaulted to a negative.

Local verification includes a fresh full migration reset, pgTAP owner/RLS/grant and unknown-state checks, pure-rule/request tests, and real anonymous Auth + HTTP fit tests with verified, unverified, and ambiguous formulas. CI adds the local integration harness. Hosted project `snojlbqovlawewwqbviz` is not deployed or enabled by this ticket; S-OPS-1's abuse/lifecycle gate and Kanuj's physical/mobile acceptance still apply before customer release.

## Kanuj handoff

K-FREE-2 can keep the three-screen profile optional, save the complete snapshot after completion, then call `getPersonalFit(productId, variantId)` to refresh the **same** result. If variant or formula is unresolved, show the returned unknown explanation; do not turn `COULD_WORK` into "safe" or "recommended" and do not infer a global score. `getFreeSkinProfile()` supports editing later in MY STUFF. The contract is merged; fixture replacement is a separate Kanuj-owned integration. Do not wire the legacy paid `skin_profiles` or model-backed `scan-product` into free Check.
