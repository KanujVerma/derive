import {ScientificClaimSchema,ClaimAdmissionSchema} from '../../contracts/ScientificClaim.ts';
import {evidenceReview} from '../../contracts/EvidenceReview.ts';
import {scientificClaimHash,claimSourcePin} from './claimApplicability.ts';
import {buildScientificManifest,PENDING_SCIENTIFIC_MANIFEST} from './scientificDecision.ts';

/** A new, narrowly reviewed proposition; the original ten records remain
 * immutable. Local source-only selection does not activate a hosted release. */
export const AHA_SUN_PLAN_CLAIM_ID='G05-03-reviewed-AHA-sun-plan-v1';
export const REVIEWED_AHA_CLAIM=ScientificClaimSchema.parse({
 id:AHA_SUN_PLAN_CLAIM_ID,family:'G05',tier:'decision_candidate',scope:'label_direction',
 sourceRefs:[{id:'FDA-alpha-hydroxy-acids',url:'https://www.fda.gov/cosmetics/cosmetic-ingredients/alpha-hydroxy-acids',locator:'FDA sun-protection recommendation during AHA use and for a week afterward; acid identity, concentration, final pH and other ingredients affect exfoliation; acids may adjust pH',retrievedAt:'2026-10-03',bodySha256:null}],
 endpoint:{name:'AHA sun-protection planning context',direction:'context',result:'FDA recommends sun protection during AHA use and for a week afterward. Amount alone cannot establish exfoliation strength; pH and the finished formula matter.',limitations:['Regulator guidance, not a clinical efficacy estimate.','Reported routine evidence does not establish actual sunscreen application or protection.']},
 applicability:[
  {field:'ingredientId',expected:['glycolic-acid','lactic-acid'],reason:'Require a clear unconditional resolved named acid; polymer names and other acids do not qualify.'},
  {field:'purpose',expected:['cosmetic-AHA-exfoliant-verified'],reason:'Require a clear unconditional permission-qualified AHA exfoliant label; acid identity alone can represent pH adjustment.'},
  {field:'site',expected:['face'],reason:'This local projection is bounded to reported facial use.'},
  {field:'useForm',expected:['leave-on'],reason:'This local projection is bounded to reported leave-on use.'},
  {field:'routineSunProtection',expected:['not_established'],reason:'An applicable current AM daily sun-protection step with a worker-qualified exact sunscreen label is not established. This is evidence status, not proof of real-world absence.'},
 ],
 copy:{reason:'FDA recommends sun protection with AHA exfoliants. Your reported routine and the available product information do not establish a daily morning sunscreen step.',action:'Before adding or continuing this exfoliant, plan to use sunscreen, wear protective clothing and limit sun exposure during use and for a week afterward.',qualifications:['Night use does not remove this sun-protection context.','Amount alone does not tell us exfoliation strength; final pH and the rest of the formula matter. This does not erase the sun-protection guidance.','This guidance cannot predict the benefit you will get or whether the product will suit your skin.']},
 admission:{status:'pending',scientificReviewer:null,operationRights:null},
 nonGoals:['individual safety clearance','finished-product efficacy','sun-protection certification','CIR thresholds as universal legal or benefit limits','exfoliation from acid presence alone'],
 contradictions:['A pH-adjusting acid or acid copolymer alone cannot establish an AHA exfoliant.','A manual sunscreen name or PM-only step cannot establish this bounded reported AM daily plan.'],
});
const claimHash=scientificClaimHash(REVIEWED_AHA_CLAIM),sourcePins=REVIEWED_AHA_CLAIM.sourceRefs.map(claimSourcePin);
// Honest editorial provenance: this projection uses the held independent
// source review (mvp-evidence-review/REVIEW.md), not a human credential or a
// newly fetched/hash-verified body. The exact implementation is challenged
// separately before a local checkpoint. No manufacturer acquisition rights.
export const REVIEWED_AHA_REVIEW=evidenceReview({version:'evidence-review/v1',claimHash,sourcePins,mode:'editorial_source_review',reviewer:{id:'codex-editorial:bounded-aha-20261004',kind:'editorial',credentialEvidenceRef:null},checkedAt:'2026-10-04T11:29:53.000Z',decision:'approved',limits:['Held independent source review dated 2026-10-04T05:19:40Z supports FDA original facts; no raw source body or body hash was retained.','New scoped original paraphrase only; no FDA endorsement or human professional credential.','Local source-only use; no hosted release or manufacturer data-acquisition grant.','Applicability and routine evidence must be checked independently on every current decision.']});
export const REVIEWED_AHA_ADMISSION=ClaimAdmissionSchema.parse({claimId:AHA_SUN_PLAN_CLAIM_ID,claimHash,status:'approved',reviewerId:REVIEWED_AHA_REVIEW.reviewer.id,qualificationRef:REVIEWED_AHA_REVIEW.contentHash,reviewedAt:REVIEWED_AHA_REVIEW.checkedAt,sourcePins,review:REVIEWED_AHA_REVIEW,rights:{grantId:'task-authorized-local-original-FDA-AHA-projection',version:'original-FDA-AHA-copy/v1',process:true,store:true,display:true,export:true,validUntil:'2026-12-31T00:00:00.000Z',revoked:false},validUntil:'2026-12-31T00:00:00.000Z'});
export const REVIEWED_AHA_MANIFEST=buildScientificManifest([...PENDING_SCIENTIFIC_MANIFEST.claims,REVIEWED_AHA_CLAIM],[REVIEWED_AHA_ADMISSION]);
