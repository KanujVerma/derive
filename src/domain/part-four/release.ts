import { APPROVED_INGREDIENT_KNOWLEDGE, APPROVED_37_INGREDIENT_KNOWLEDGE } from './knowledge.ts';
import { canonicalJson, sha256 } from '../part-two/hash.ts';
export const PART_FOUR_RELEASE = Object.freeze({id:'part-four-foundations/v1',knowledgeVersion:APPROVED_37_INGREDIENT_KNOWLEDGE.version,knowledgeHash:APPROVED_37_INGREDIENT_KNOWLEDGE.contentHash,ruleVersion:'F01-F10/local-v3',briefContract:'product-research-brief/v1',offerContract:'trusted-seller-ordinary-offer/v1',saveProtocol:'exact-packet-receipt/v3',routineContract:'routine-formula-evidence/v1',retentionContract:'part-four-retained-evidence/v1',productionApproved:false});
export const PART_FOUR_RELEASE_HASH=sha256(canonicalJson(PART_FOUR_RELEASE));
export const PART_FOUR_EDUCATION47_RELEASE=Object.freeze({...PART_FOUR_RELEASE,knowledgeVersion:APPROVED_INGREDIENT_KNOWLEDGE.version,knowledgeHash:APPROVED_INGREDIENT_KNOWLEDGE.contentHash});
export const PART_FOUR_EDUCATION47_RELEASE_HASH=sha256(canonicalJson(PART_FOUR_EDUCATION47_RELEASE));
/** Explicit local candidate only. The ordinary service keeps its reviewed SQL37
 * tuple until a separately reviewed registry/history transition selects47. */
export const partFourBindingRelease=(selection?:'approved47')=>{const release=selection==='approved47'?PART_FOUR_EDUCATION47_RELEASE:PART_FOUR_RELEASE;return {releaseId:release.id,releaseHash:selection==='approved47'?PART_FOUR_EDUCATION47_RELEASE_HASH:PART_FOUR_RELEASE_HASH,knowledgeVersion:release.knowledgeVersion,knowledgeHash:release.knowledgeHash};};
