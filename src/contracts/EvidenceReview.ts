import {z} from 'zod';
import {canonicalJson,sha256} from '../domain/part-two/hash.ts';
const id=z.string().min(1).max(200),hash=z.string().regex(/^[a-f0-9]{64}$/);
/** Review provenance is separate from source operations and applicability.
 * Agent/editorial review never represents a human credential. */
export const EvidenceReviewSchema=z.strictObject({version:z.literal('evidence-review/v1'),contentHash:hash,claimHash:hash,sourcePins:z.array(hash).min(1).max(20),mode:z.enum(['automated_source_review','editorial_source_review','professional_review']),reviewer:z.strictObject({id,kind:z.enum(['agent','editorial','human_professional']),credentialEvidenceRef:id.nullable()}),checkedAt:z.iso.datetime(),decision:z.enum(['approved','rejected','reference_only','unverified']),limits:z.array(z.string().min(1).max(4000)).min(1).max(30)}).superRefine((r,c)=>{
 if(r.mode==='professional_review'?(r.reviewer.kind!=='human_professional'||!r.reviewer.credentialEvidenceRef):(r.reviewer.kind==='human_professional'||r.reviewer.credentialEvidenceRef!==null))c.addIssue({code:'custom',message:'Review mode cannot fabricate human credentials'});
 if(new Set(r.sourcePins).size!==r.sourcePins.length)c.addIssue({code:'custom',message:'Duplicate reviewed source pin'});
 const {contentHash:_,...body}=r;if(sha256(canonicalJson(body))!==r.contentHash)c.addIssue({code:'custom',message:'Review record hash mismatch'});
});
export type EvidenceReview=z.infer<typeof EvidenceReviewSchema>;
export function evidenceReview(body:Omit<EvidenceReview,'contentHash'>):EvidenceReview{return EvidenceReviewSchema.parse({...body,contentHash:sha256(canonicalJson(body))});}
