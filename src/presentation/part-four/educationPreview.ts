import { normalize, LOCAL_DICTIONARY_RELEASE } from '../../domain/part-two/index.ts';
import { sha256 } from '../../domain/part-two/hash.ts';
import { analyzeFormula } from '../../domain/part-four/formula.ts';
import { APPROVED_INGREDIENT_KNOWLEDGE } from '../../domain/part-four/knowledge.ts';
import { PART_FOUR_EDUCATION47_RELEASE } from '../../domain/part-four/release.ts';
import { PartFourPacketSchema, type PartFourPacket } from '../../contracts/PartFour.ts';
import type { NormalizationInput } from '../../contracts/PartTwo.ts';
const id=(n:number)=>`94000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export const educationPreviewCases={revisions:['Pentylene Glycol','1,2-Hexanediol','Ceramide AS','Carnosine'],expansion:['Panthenol','Allantoin','Urea','Salicylic Acid','Glycolic Acid','Lactic Acid','Azelaic Acid','Ascorbic Acid','Retinol','Retinal']} as const;
/** Original synthetic text, no account/authority lookup, source acquisition or
 * personal decision. Only the development-gated route mounts these packets. */
export function educationPreviewPacket(which:keyof typeof educationPreviewCases,now:string):PartFourPacket {
 const expiresAt=new Date(Date.parse(now)+20*60*1000).toISOString(),rawText=educationPreviewCases[which].join(', ');
 const input:NormalizationInput={kind:'source_reading',scope:'private_package',binding:{kind:'capture',scanId:id(1),requestId:id(2),authenticatedOwnerId:id(3),bindingKey:id(4),generation:1,evidenceRevision:1,dependencyDigest:sha256(rawText),deletionEpoch:0,policyEpoch:1,dictionaryEpoch:1,expiresAt,ownerId:id(3),captureSessionId:id(5),packageObservationId:id(6),observations:[{observationId:id(7),revision:1}],attributedEdits:[]},sections:[{sectionId:id(8),kind:'ingredients',rawText,sourceOffset:0,observationId:id(7),sourceRevision:1,transcription:'clear',entryRefs:[]}],sourceRefs:[{observationId:id(7),sourceRevision:1,contentHash:sha256(rawText),policyId:id(9),policyVersion:'original-education-preview-v1',evidenceBasis:'private_package',observedAt:now,sourceUpdatedAt:null,expiresAt,permitted:true,sourceUrl:null,attribution:'Original synthetic education text'}],evidenceOutcome:'partial',claimLimits:{productPresenceAllowed:false,declarationCompleteness:'unestablished',negativeClaimsAllowed:false}};
 const normalized=normalize(input,LOCAL_DICTIONARY_RELEASE,{snapshotId:id(90),createdAt:now,resultRevision:1});
 const formula=analyzeFormula(normalized,{now,knowledge:APPROVED_INGREDIENT_KNOWLEDGE});if(!formula)throw Error('Synthetic education preview refused');
 return PartFourPacketSchema.parse({version:'part-four-foundations/v1',releaseId:PART_FOUR_EDUCATION47_RELEASE.id,formula,insights:[],comparison:{state:'none',routineItemId:null,explanation:'This reference preview contains no personal routine or product decision.',candidateIds:[]},reviews:{state:'unavailable',explanation:'No product reports in this reference preview.',sourceIds:[]},value:{state:'unavailable',explanation:'No product prices in this reference preview.',sourceIds:[]},requiredEvidence:[],decisionState:'pending',action:'Education only; no product decision.',contextRevision:0});
}
