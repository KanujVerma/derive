import {ScientificClaimSchema,ClaimAdmissionSchema,ClaimFeatureSchema,ClaimAssessmentSchema,type ScientificClaim,type ClaimField,type ClaimAssessment} from '../../contracts/ScientificClaim.ts';
import {canonicalJson,sha256} from '../part-two/hash.ts';
export const scientificClaimHash=(claim:unknown)=>sha256(canonicalJson(ScientificClaimSchema.parse(claim)));
export const claimSourcePin=(source:ScientificClaim['sourceRefs'][number])=>sha256(canonicalJson(source));
export interface ClaimApplicabilityInput {now:string;features:Partial<Record<ClaimField,unknown>>;admissions?:readonly unknown[];withdrawnDependencies?:readonly string[]}
/** Pure claim-specific matcher. A record, percentage match, editorial approval,
 * or model output never supplies independent scientific/source admission. */
export function assessScientificClaim(value:unknown,input:ClaimApplicabilityInput):ClaimAssessment {
 const claim=ScientificClaimSchema.parse(value),claimHash=scientificClaimHash(claim),clock=Date.parse(input.now);
 if(!Number.isFinite(clock))throw Error('Claim assessment requires evaluation time');
 const withdrawn=new Set(input.withdrawnDependencies??[]),reasons:string[]=[],missingFields:ClaimField[]=[],factIds=new Set<string>(),contextRevisionIds=new Set<string>(),sourceIds=new Set(claim.sourceRefs.map(s=>s.id));
 let state:ClaimAssessment['state']='supported',deadline=Infinity;
 const finish=(next:ClaimAssessment['state'],admissionId:string|null=null,reason:string|null=null,action:string|null=null)=>ClaimAssessmentSchema.parse({claimId:claim.id,claimHash,family:claim.family,state:next,reasons,missingFields,factIds:[...factIds],contextRevisionIds:[...contextRevisionIds],sourceIds:[...sourceIds],admissionId,validUntil:Number.isFinite(deadline)?new Date(deadline).toISOString():null,reason,action});
 if([claim.id,claimHash,...claim.sourceRefs.flatMap(s=>[s.id,s.url,claimSourcePin(s),...(s.bodySha256?[s.bodySha256]:[])])].some(id=>withdrawn.has(id))){reasons.push('Claim or source evidence was withdrawn.');return finish('unavailable');}
 if(claim.sourceRefs.some(source=>Date.parse(source.retrievedAt)>clock)){reasons.push('Source retrieval is later than this assessment.');return finish('unavailable');}
 for(const predicate of claim.applicability){
  const parsed=ClaimFeatureSchema.safeParse(input.features[predicate.field]);
  if(!parsed.success||parsed.data.state==='unknown'||Date.parse(parsed.data.validUntil)<=clock||[...parsed.data.factIds,...parsed.data.contextRevisionIds,...parsed.data.sourceIds].some(id=>withdrawn.has(id))){missingFields.push(predicate.field);reasons.push(`${predicate.field}: ${predicate.reason} Applicable current evidence is unknown.`);if(state==='supported')state='unknown';continue;}
  const feature=parsed.data;feature.factIds.forEach(id=>factIds.add(id));feature.contextRevisionIds.forEach(id=>contextRevisionIds.add(id));feature.sourceIds.forEach(id=>sourceIds.add(id));deadline=Math.min(deadline,Date.parse(feature.validUntil));
  if(feature.state==='contradiction'||!['ingredientId','purpose','routineOtherMedication'].includes(predicate.field)&&new Set(feature.values??[]).size>1){state='contradiction';reasons.push(`${predicate.field}: conflicting evidence requires resolution.`);}
  else if(!feature.values?.some(v=>predicate.expected.includes(v))){if(state!=='contradiction')state='mismatch';reasons.push(`${predicate.field}: known evidence does not match the reviewed predicate.`);}
 }
 if(state!=='supported')return finish(state);
 const sourcePins=claim.sourceRefs.map(claimSourcePin).sort();
 const matches=(input.admissions??[]).flatMap(value=>{const parsed=ClaimAdmissionSchema.safeParse(value);return parsed.success&&parsed.data.claimId===claim.id&&parsed.data.claimHash===claimHash&&canonicalJson([...parsed.data.sourcePins].sort())===canonicalJson(sourcePins)?[parsed.data]:[];});
 if(matches.length!==1){reasons.push(matches.length?'Conflicting or duplicate admission records require resolution.':'Independent scientific and source-operation admission is pending.');return finish(matches.length?'contradiction':'pending');}
 const admission=matches[0],rights=admission.rights;
 if(claim.sourceRefs.some(source=>Date.parse(source.retrievedAt)>Date.parse(admission.reviewedAt))){reasons.push('Source retrieval is later than the exact review.');return finish('unavailable');}
 if(admission.status==='rejected'){reasons.push('The exact proposition was rejected by its independent reviewer.');return finish('rejected',admission.reviewerId);}
 if(Date.parse(admission.reviewedAt)>clock||Date.parse(admission.validUntil)<=clock||Date.parse(rights.validUntil)<=clock||rights.revoked||!rights.process||!rights.store||!rights.display||!rights.export||[admission.reviewerId,admission.qualificationRef,rights.grantId,rights.version].some(id=>withdrawn.has(id))){reasons.push('Exact admission or required durable evidence operation is unavailable.');return finish('unavailable');}
 deadline=Math.min(deadline,Date.parse(admission.validUntil),Date.parse(rights.validUntil));
 reasons.push(...claim.copy.qualifications,...claim.endpoint.limitations);
 const reference=claim.tier!=='decision_candidate'||claim.scope==='ingredient_reference'||claim.scope==='policy_reference';
 return finish(reference?'reference':'supported',admission.reviewerId,claim.copy.reason,reference?null:claim.copy.action);
}
