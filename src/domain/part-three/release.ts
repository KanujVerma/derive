import { canonicalJson, sha256 } from '../part-two/hash.ts';
import { z } from 'zod';
import { LOCAL_DICTIONARY_RELEASE, validateDictionaryRelease, dictionaryReleaseHash, deepFreeze, type DictionaryRelease } from '../part-two/dictionary.ts';
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
const version=z.string().min(1).max(200);
/** The currently implemented renderer supports this template only. Selecting
 * another semantic release does not authorize unimplemented copy semantics. */
const semanticReleaseSchema=z.strictObject({id:version,rule:version,evidence:version,question:version,template:z.literal('judge-first-v1'),policy:version,locale:z.literal('en'),
 refinement:z.strictObject({projection:z.literal('part-three-provider-projection/v1'),prompt:version,adapter:version,configuredModel:version}),
 reviewScope:z.enum(['local_engineering_fixture','reviewed_original_semantics']),productionApproved:z.boolean(),
 purposes:z.array(z.strictObject({id:version,literal:z.string().min(1).max(2000),purposeId:z.enum(['moisturizing','cleansing']),site:z.enum(['face','hands','body','scalp','lips','eye_area','other']),useForm:z.enum(['leave_on','rinse_off'])})).max(100),
 rules:z.array(z.enum(['exact-avoidance','reported-sensitivity','experience-recall','purpose-value','current-help','pair-comparison','material-question'])).min(1).max(7),
});
export type PartThreeSemanticRelease=z.infer<typeof semanticReleaseSchema>;
export interface PartThreeReleaseSelection {semanticRelease:PartThreeSemanticRelease|typeof PART_THREE_RELEASE;dictionaryRelease:DictionaryRelease}
/** Only trusted composition supplies a bundle. Registry/source grants remain
 * independent; this validation and a public selector confer no authority. */
export function selectedPartThreeRelease(selection?:PartThreeReleaseSelection,ordinaryDeployment?:{url:string;selectedReleaseId:string}){
 const semantic=semanticReleaseSchema.parse(selection?.semanticRelease??PART_THREE_RELEASE);
 if(semantic.productionApproved&&semantic.reviewScope!=='reviewed_original_semantics')throw Error('Unreviewed personal semantic release');
 if(PART_THREE_RELEASE.rules.some(rule=>!semantic.rules.includes(rule)))throw Error('Personal semantic release omits an implemented rule');
 if(new Set(semantic.rules).size!==semantic.rules.length||new Set(semantic.purposes.map(p=>p.id)).size!==semantic.purposes.length||new Set(semantic.purposes.map(p=>p.literal)).size!==semantic.purposes.length)throw Error('Ambiguous personal semantic release');
 const dictionary=validateDictionaryRelease(selection?.dictionaryRelease??LOCAL_DICTIONARY_RELEASE);
 if(ordinaryDeployment&&(ordinaryDeployment.url!=='https://snojlbqovlawewwqbviz.supabase.co'||ordinaryDeployment.selectedReleaseId!==semantic.id||!semantic.productionApproved||dictionary.releaseGate!=='reviewed_public'))throw Error('Ordinary target requires its exact reviewed release');
 return {semantic:deepFreeze(semantic),dictionary,releaseHash:sha256(canonicalJson(semantic))};
}
/** Original lexical fields and engineering semantics only. Automated review,
 * authorship commits, hashes, authority and limitations are recorded in
 * docs/PART_FOUR_ORIGINAL_RELEASE_REVIEW.md. No third-party grants transfer. */
const originalDictionary=structuredClone(LOCAL_DICTIONARY_RELEASE);
originalDictionary.version='derive-original-exact20-v1';
originalDictionary.releaseGate='reviewed_public';
originalDictionary.explanationVersion='no-function-explanations-v1';
originalDictionary.provenance={source:'Derive original exact label vocabulary; no external glossary import',sourceUrl:null,sourceRevision:'0471ea2962810d333ba746d6b7d9bb6896dc7b69:exact20',importVersion:'no-import-v1',allowedFields:['names','exact_aliases'],policyId:'derive-original-lexical-operations-v1',operations:{process:true,store:true,display:true,export:true},attribution:'Derive original label names; bounded automated fidelity review',reviewedAt:'2026-10-04T06:59:06Z',reviewDecision:'approved',releaseOwner:'KanujVerma/derive',rightsOwner:'Derive original authored lexical fields',expiresAt:null,revoked:false};
originalDictionary.identities=originalDictionary.identities.map(identity=>({...identity,nameSystem:'derive_original_exact_label',externalReferences:[]}));
originalDictionary.aliases=originalDictionary.aliases.map(alias=>({...alias,aliasRecordId:`original-exact20:${alias.aliasRecordId}`,nameSystem:'derive_original_exact_label',evidenceSource:'derive-original-exact20-automated-review-v1',reviewDecision:'approved',release:originalDictionary.version}));
originalDictionary.explanations=[];originalDictionary.explanationPolicies=[];
originalDictionary.contentHash=dictionaryReleaseHash(originalDictionary);
const originalSemantics:PartThreeSemanticRelease={...structuredClone(PART_THREE_RELEASE),id:'derive-original-personal-v1',evidence:'cosmetic-purpose-original-v1',reviewScope:'reviewed_original_semantics',productionApproved:true,refinement:{...PART_THREE_RELEASE.refinement,projection:'part-three-provider-projection/v1'},rules:[...PART_THREE_RELEASE.rules],purposes:PART_THREE_RELEASE.purposes.map(p=>({...p,id:`original:${p.id}`}))};
const reviewedOriginal=selectedPartThreeRelease({semanticRelease:originalSemantics,dictionaryRelease:originalDictionary});
/** A compiled expectation, not database registration, release activation,
 * source acquisition permission, clinical approval or an operational grant. */
export const ORDINARY_PART_THREE_RELEASE_SELECTION:PartThreeReleaseSelection=Object.freeze({semanticRelease:reviewedOriginal.semantic,dictionaryRelease:reviewedOriginal.dictionary});
export function ordinaryPartThreeRelease(url:string,selectedReleaseId:string|undefined,selection:PartThreeReleaseSelection|null=ORDINARY_PART_THREE_RELEASE_SELECTION):PartThreeReleaseSelection|null{
 if(!selectedReleaseId||!selection)return null;
 try{const selected=selectedPartThreeRelease(selection,{url,selectedReleaseId});return {semanticRelease:selected.semantic,dictionaryRelease:selected.dictionary};}catch{return null;}
}
