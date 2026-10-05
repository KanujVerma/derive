import assert from 'node:assert/strict';
import test from 'node:test';
import {evidenceReview,EvidenceReviewSchema} from '../src/contracts/EvidenceReview.ts';
import {ClaimAdmissionSchema} from '../src/contracts/ScientificClaim.ts';
const body={version:'evidence-review/v1' as const,claimHash:'a'.repeat(64),sourcePins:['b'.repeat(64)],mode:'automated_source_review' as const,reviewer:{id:'codex-agent:/root/evidence_claims',kind:'agent' as const,credentialEvidenceRef:null},checkedAt:'2026-10-04T05:19:40Z',decision:'approved' as const,limits:['Original factual reference only; no current bottle or study-dose equivalence.']};
test('automated/editorial review records have exact pins and never human credentials',()=>{
 const review=evidenceReview(body);assert.equal(review.mode,'automated_source_review');assert.equal(review.reviewer.credentialEvidenceRef,null);
 assert.ok(EvidenceReviewSchema.safeParse(evidenceReview({...body,mode:'editorial_source_review'})).success);
 assert.throws(()=>evidenceReview({...body,reviewer:{...body.reviewer,credentialEvidenceRef:'invented-professional'}}));
 assert.throws(()=>evidenceReview({...body,mode:'professional_review'}));
 assert.equal(EvidenceReviewSchema.safeParse({...review,claimHash:'c'.repeat(64)}).success,false);
});
test('review itself supplies no source-operation grant',()=>{
 const review=evidenceReview(body);assert.equal(ClaimAdmissionSchema.safeParse({review}).success,false);
 assert.equal('rights' in review,false);assert.equal('admissions' in review,false);
});

import {assessScientificClaim,scientificClaimHash,claimSourcePin} from '../src/domain/part-four/claimApplicability.ts';
test('trusted admission enforces exact reviewed copy/pins/mode and still independently enforces rights',()=>{
 const claim={id:'original:review-contract-fixture',family:'G01',tier:'reference',scope:'ingredient_reference',sourceRefs:[{id:'original-fixture',url:'https://fixture.invalid/original',locator:'Original synthetic fixture',retrievedAt:'2026-10-03',bodySha256:null}],endpoint:{name:'function',direction:'context',result:'Original fixture context',limitations:['Not finished-product efficacy.']},applicability:[],copy:{reason:'Original fixture context.',action:null,qualifications:[]},admission:{status:'pending',scientificReviewer:null,operationRights:null},nonGoals:[],contradictions:[]};
 const review=evidenceReview({...body,claimHash:scientificClaimHash(claim),sourcePins:claim.sourceRefs.map(claimSourcePin)}),until='2026-10-05T00:00:00Z';
 const admission={claimId:claim.id,claimHash:review.claimHash,status:'approved',reviewerId:review.reviewer.id,qualificationRef:review.contentHash,reviewedAt:review.checkedAt,sourcePins:review.sourcePins,review,rights:{grantId:'original-synthetic-only',version:'1',process:true,store:true,display:true,export:false,validUntil:until,revoked:false},validUntil:until};
 const evaluate=(a:unknown)=>assessScientificClaim(claim,{now:review.checkedAt,features:{},admissions:[a]});
 assert.equal(evaluate(admission).state,'reference');assert.equal(evaluate(admission).action,null);
 assert.equal(evaluate({...admission,qualificationRef:'invented-human-validation'}).state,'pending');
 assert.equal(evaluate({...admission,review:evidenceReview({...body,claimHash:'c'.repeat(64),sourcePins:review.sourcePins})}).state,'pending');
 assert.equal(evaluate({...admission,rights:{...admission.rights,display:false}}).state,'unavailable');
 assert.equal(evaluate({...admission,review:evidenceReview({...body,claimHash:review.claimHash,sourcePins:review.sourcePins,decision:'reference_only'})}).state,'pending');
});
