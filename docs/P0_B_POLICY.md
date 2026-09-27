# P0-B finding engine and decision policy

Implemented independent module: `src/domain/personal-decision/evaluate.ts`. It consumes a trusted, nonauthoritative P0-B evaluation projection plus host-bound owner/context revisions. It does not establish catalog truth, authentication, scientific review, or persistence. Storage adapters and customer UI integration belong to composition.

The evaluator retains every supported material finding. Explicit caution precedence is reproductive clinician review, prior target-product reaction, current routine experience warning, active overlap, reported sensitivity, then reactivity. This is consequence precedence without numerical scores. A known caution selects USE_WITH_CAUTION even when other critical evidence is missing; critical needs remain in the packet. Without cautions, critical needs stop positive use, unknown/withheld decision intent remains a critical need, then an explicit add intent with known current role duplication selects KEEP_CURRENT, then the narrow supported moisturizer role fit selects COULD_WORK. Everything else remains NOT_ENOUGH_INFORMATION. SKIP is deliberately not selected by this port because reviewed S2 meanings support caution for reported reaction/sensitivity, not an automatic contraindication.

## Versioned rule and source registry

`RULE_REGISTRY`, `RULE_SOURCES`, `ENGINE_VERSION` and `POLICY_VERSION` are inspectable in the module. S2 rule meanings are ported from `supabase/functions/free-personal-fit/fit.ts` at main checkpoint `45f1773e4983c3c28848839c65640b7681b89d8e`. They remain bounded cosmetic decisions, not diagnosis or clinical safety findings.

| Rule | Existing rationale and limits |
| --- | --- |
| s2_exact_sensitivity/1 | Exact normalized ingredient name matches a user report. No allergy causation, no alias inference. Unmatched reports require alias review. |
| s2_retinoid_reproductive/1 | Whole retinoid token, including retinyl ester names; pregnancy or nursing reported yes requires clinician review. The existing source is [AAD pregnancy skin care](https://www.aad.org/public/everyday-care/skin-care-secrets/routine/pregnancy-skin-care). Unknown/withheld stays explicit. Trying to conceive requires reviewed applicability; no new clinical rule is inferred. |
| s2_treatment_overlap/1 | Preserve reviewed S2 combinations of retinoid, exfoliating acid and benzoyl peroxide with reported current treatments. No prescription modification, concentration assumption or timing inference. |
| s2_reactive_active/1 | Easily reactive skin with listed supported active requires individual tolerance review. |
| s2_same_product_reaction/1 | Self-reported product reaction remains a caution despite absent profile/formula. Unknown prior formula stays unknown. It is not ingredient causation. |
| s2_moisturizer_dryness_role/1 | Verified moisturizer category, dryness goal and dry/tight behavior with no supported listed active. Role match does not establish efficacy or tolerance. |
| p0b_practical_role_relation/1 | Known category and owner-reported current routine category support practical role duplication or an explicit replacement candidate. No comparison of effectiveness. Partial routine cannot establish absence. |
| p0b_formula_experience/1 | Old-formula events produce a visible current-formula experience need. No-history and no-report never establish tolerance. |

The product projection source IDs must resolve in its accepted source registry. Bound evidence and typed display arguments are validated by the B1 packet validator. The host must supply revisions independently and never trust a previously saved packet as ownership authority. Unknown JSON, arbitrary source text and untrusted model fields require trusted adapters before this typed API.

## Input boundary

`EvaluationInput` keeps the product projection separate from engine-local owner/revision DTOs. Profile sensitivity/treatment null means unknown, arrays mean explicitly reported none or named entries. Pregnancy, nursing and trying to conceive are distinct yes/no/unknown/withheld answers. Profile primary and secondary goals remain distinct. Routine category and ingredients are explicit known/unknown facts with accepted source references and supported product references (exact variant/formula are required for ingredient overlap). Manual or unverified role labels cannot support redundancy. Actual current routine active overlap uses only verified ingredient facts and the existing S2 combinations. Routine role comparisons use only current items; paused, stopped and occasional are not treated as current duplication. Frequency retains few_times_weekly as a qualitative value. History distinguishes reaction, ineffective, explicitly tolerated and no_report; known reaction or ineffective experience for a current item remains a separate scoped warning and prevents recommending KEEP_CURRENT. no tolerance finding or safety clearance is emitted.

## Evaluation evidence

`tests/p0b-policy.test.ts` and `tests/fixtures/p0b/policy.ts` cover role fit, replacement versus addition, overlapping cautions, prior reaction with missing critical evidence, routine completeness, formula conflicts, unknown reproductive context, old-formula history, owner/revision mismatch and irrelevant commercial/raw-text fields. Finite metamorphic cases verify that removing critical evidence cannot create a stronger positive action.

Runtime, hosted persistence, actual source verification and physical/customer acceptance are outside this independent module and remain composition/release gates.
