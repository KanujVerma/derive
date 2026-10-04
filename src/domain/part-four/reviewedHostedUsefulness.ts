import {ClaimAdmissionSchema} from '../../contracts/ScientificClaim.ts';
import {evidenceReview} from '../../contracts/EvidenceReview.ts';
import {buildScientificManifest} from './scientificDecision.ts';
import {REVIEWED_USEFULNESS_MANIFEST} from './reviewedUsefulness.ts';

/** Prepared public original-paraphrase candidate, not a hosted grant. The held
 * source reviews and their limitations remain historical evidence. Activation
 * must admit the exact three records in the independent SQL authority registry.
 * No raw abstracts, professional credentials or product-efficacy claims transfer.
 */
const admissions=REVIEWED_USEFULNESS_MANIFEST.admissions.map(prior=>{
 const {contentHash:_,...priorReview}=prior.review!;
 const review=evidenceReview({...priorReview,reviewer:{...priorReview.reviewer,id:`codex-editorial:public-usefulness-20261004:${prior.claimId}`,credentialEvidenceRef:null},checkedAt:'2026-10-04T19:39:40.000Z',limits:[...priorReview.limits,'Historical source-only review is reused without a new source retrieval or body hash.','Proposed hosted process/store/display/export of this exact qualified original factual paraphrase only; inactive until founder approval and independent SQL authority admission.','Automated/editorial source fidelity review, not professional clinical approval, personal safety clearance or finished-product efficacy.']});
 return ClaimAdmissionSchema.parse({...prior,reviewerId:review.reviewer.id,qualificationRef:review.contentHash,reviewedAt:review.checkedAt,review,rights:{...prior.rights,grantId:'derive-original-public-usefulness-facts-v1',version:'qualified-original-paraphrases-20261004/v1'}});
});
export const REVIEWED_PUBLIC_USEFULNESS_MANIFEST=buildScientificManifest(REVIEWED_USEFULNESS_MANIFEST.claims,admissions);
export const isReviewedUsefulnessManifest=(hash:string|undefined)=>hash===REVIEWED_USEFULNESS_MANIFEST.contentHash||hash===REVIEWED_PUBLIC_USEFULNESS_MANIFEST.contentHash;
