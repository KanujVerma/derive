import { APPROVED_INGREDIENT_KNOWLEDGE } from './knowledge.ts';
import { canonicalJson, sha256 } from '../part-two/hash.ts';
export const PART_FOUR_RELEASE = Object.freeze({id:'part-four-foundations/v1',knowledgeVersion:APPROVED_INGREDIENT_KNOWLEDGE.version,knowledgeHash:APPROVED_INGREDIENT_KNOWLEDGE.contentHash,ruleVersion:'F01-F10/local-v2',briefContract:'product-research-brief/v1',offerContract:'trusted-seller-ordinary-offer/v1',saveProtocol:'exact-packet-receipt/v2',productionApproved:false});
export const PART_FOUR_RELEASE_HASH=sha256(canonicalJson(PART_FOUR_RELEASE));
export const partFourBindingRelease=()=>({releaseId:PART_FOUR_RELEASE.id,releaseHash:PART_FOUR_RELEASE_HASH,knowledgeVersion:PART_FOUR_RELEASE.knowledgeVersion,knowledgeHash:PART_FOUR_RELEASE.knowledgeHash});
