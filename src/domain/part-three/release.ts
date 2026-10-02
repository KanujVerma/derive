import { canonicalJson, sha256 } from '../part-two/hash.ts';
/** Original engineering semantics/copy, local-only. Independent evidence and
 * privacy approval is required before any production release can select it. */
export const PART_THREE_RELEASE = Object.freeze({
 id:'part-three-local-v1', rule:'bounded-personal-v1', evidence:'cosmetic-purpose-local-v1', question:'material-question-v1', template:'judge-first-v1', policy:'earned-judgment-v1', locale:'en' as const,
 refinement:{projection:'part-three-provider-projection/v1',prompt:'jev-choice-v1',adapter:'jev-http-v1',configuredModel:'jev-1.13.0'},
 reviewScope:'local_engineering_fixture', productionApproved:false,
 purposes:[
  {id:'moisturizing-face-v1',literal:'Moisturizes facial skin. Leave on.',purposeId:'moisturizing' as const,site:'face' as const,useForm:'leave_on' as const},
  {id:'moisturizing-hands-v1',literal:'Moisturizes hands. Leave on.',purposeId:'moisturizing' as const,site:'hands' as const,useForm:'leave_on' as const},
  {id:'cleansing-face-v1',literal:'Cleanses facial skin. Rinse off.',purposeId:'cleansing' as const,site:'face' as const,useForm:'rinse_off' as const},
 ],
 rules:['exact-avoidance','reported-sensitivity','experience-recall','purpose-value','current-help','pair-comparison','material-question'] as const,
});
export const PART_THREE_RELEASE_HASH=sha256(canonicalJson(PART_THREE_RELEASE));
