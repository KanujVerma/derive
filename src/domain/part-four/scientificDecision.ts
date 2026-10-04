import {ScientificManifestSchema,ScientificFeaturesEnvelopeSchema,ScientificDecisionPacketSchema,type ScientificManifest,type ScientificFeaturesEnvelope,type ScientificDecisionPacket,type ClaimFeature} from '../../contracts/ScientificClaim.ts';
import type {PersonalContextV2} from '../../contracts/PersonalContextV2.ts';
import type {ContextGoal} from '../../contracts/PersonalContext.ts';
import {NormalizationResultSchema,type NormalizationResult} from '../../contracts/PartTwo.ts';
import {canonicalJson,sha256} from '../part-two/hash.ts';
import {assessScientificClaim,claimSourcePin} from './claimApplicability.ts';
import {PENDING_SCIENTIFIC_RECORDS} from './science-candidates.ts';
export const scientificManifestHash=(manifest:ScientificManifest)=>{const {contentHash:_,...data}=manifest;return sha256(canonicalJson(data));};
export function buildScientificManifest(claims:unknown,admissions:unknown=[]):ScientificManifest {
 const value=ScientificManifestSchema.parse({version:'part-four-science-candidates/v1',contentHash:'0'.repeat(64),claims,admissions});value.contentHash=scientificManifestHash(value);return value;
}
export const PENDING_SCIENTIFIC_MANIFEST=buildScientificManifest(PENDING_SCIENTIFIC_RECORDS);
const targets:Record<string,readonly ContextGoal[]>={'G01-03-reviewed-barrier-reference-v1':['dryness'],'G03-03-reviewed-photoaging-reference-v1':['fine_lines','dark_spots'],'G01-01':['dryness'],'G01-02':['dryness'],'G02-01':['oiliness'],'G02-02':['breakouts'],'G03-01':['fine_lines','dark_spots'],'G03-02':['fine_lines']};
const targetEndpoint:Partial<Record<ContextGoal,string>>={fine_lines:'fine-lines-wrinkles',dark_spots:'hyperpigmented-spots'};
/** The feature envelope is loaded by a trusted host after its independent
 * formula/source/applicability lookup. Client requests never carry it. Exact
 * context/formula/manifest binding prevents cross-user or stale replay. */
export function assessScientificDecision(input:{manifest:unknown;evidence?:unknown;context:PersonalContextV2;partTwo:NormalizationResult;now:string;withdrawnDependencies?:readonly string[]}):ScientificDecisionPacket {
 const manifest=ScientificManifestSchema.parse(input.manifest),p=NormalizationResultSchema.parse(input.partTwo),c=input.context;
 if(manifest.contentHash!==scientificManifestHash(manifest))throw Error('Scientific manifest hash mismatch');
 if(c.ownerId!==p.authenticatedOwnerId)throw Error('Scientific context owner binding mismatch');
 let evidence:ScientificFeaturesEnvelope|null=null;
 if(input.evidence){evidence=ScientificFeaturesEnvelopeSchema.parse(input.evidence);if(evidence.ownerId!==c.ownerId||evidence.contextRevision!==c.revision||evidence.partTwoBindingKey!==p.bindingKey||evidence.partTwoRevision!==p.resultRevision||p.state!=='ready'||evidence.sourceDigest!==p.output.reading.binding.dependencyDigest||evidence.manifestHash!==manifest.contentHash)throw Error('Scientific feature envelope binding mismatch');}
 const profile=c.profile?.data,goals=[...new Set([...(profile?.primaryGoal.state==='known'?[profile.primaryGoal.value]:[]),...(profile?.secondaryGoals??[])])];
 const assessments:ScientificDecisionPacket['assessments']=[];
 for(const claim of manifest.claims){
  const relevant=targets[claim.id]?.filter(goal=>goals.includes(goal))??(claim.family==='G04'||claim.family==='G05'?[null]:[]);
  for(const goal of relevant){
   const rows=evidence?.claims.filter(row=>row.claimId===claim.id&&row.goal===goal)??[];
   if(rows.length>1)throw Error('Duplicate scientific feature envelope binding');
   const features:Partial<Record<import('../../contracts/ScientificClaim.ts').ClaimField,ClaimFeature>>={...(rows[0]?.features??{})};
   // One source record can support several endpoints, each assessed separately.
   // A reported redness/texture goal does not inherit photoaging blotchiness.
   if((claim.id==='G03-01'||claim.id==='G03-03-reviewed-photoaging-reference-v1')&&goal&&targetEndpoint[goal]&&features.endpoint?.state==='known'&&!features.endpoint.values?.includes(targetEndpoint[goal]!))features.endpoint={...features.endpoint,values:[`different-reported-goal:${goal}`]};
   const admission=p.state==='ready'&&Date.parse(p.expiresAt)>Date.parse(input.now)&&!['blocked','conflict'].includes(p.output.reading.evidenceState)&&!(p.output.kind==='bound'&&['blocked','conflict'].includes(p.output.productFacts.evidenceState))?manifest.admissions:[];
   assessments.push({goal,assessment:assessScientificClaim(claim,{now:input.now,features,admissions:admission,withdrawnDependencies:input.withdrawnDependencies})});
  }
 }
 const unresolvedGoals=goals.filter(goal=>!['maintain','simplify'].includes(goal)&&!assessments.some(row=>row.goal===goal&&row.assessment.state==='supported'));
 // A base source identity must retain one exact metadata pin. Separate
 // admission review dates and independently bounded goal leases remain distinct.
 const pins=new Map<string,string>();
 for(const row of assessments.filter(row=>['supported','reference'].includes(row.assessment.state))){const claim=manifest.claims.find(c=>c.id===row.assessment.claimId)!;for(const source of claim.sourceRefs){const pin=claimSourcePin(source);if(pins.has(source.id)&&pins.get(source.id)!==pin)throw Error('Scientific source identity has conflicting pins');pins.set(source.id,pin);}}
 const sourceRefs=[...new Map(assessments.filter(row=>['supported','reference'].includes(row.assessment.state)).flatMap(row=>{
  const claim=manifest.claims.find(c=>c.id===row.assessment.claimId)!;
  const admission=manifest.admissions.find(a=>a.claimId===claim.id&&a.claimHash===row.assessment.claimHash&&a.reviewerId===row.assessment.admissionId&&canonicalJson([...a.sourcePins].sort())===canonicalJson(claim.sourceRefs.map(claimSourcePin).sort()))!;
  return claim.sourceRefs.map(source=>{const ref={...source,reviewedAt:admission.reviewedAt,validUntil:row.assessment.validUntil!};return [canonicalJson(ref),ref] as const;});
 })).values()];
 return ScientificDecisionPacketSchema.parse({version:'part-four-scientific-decision/v1',manifestHash:manifest.contentHash,assessments,sourceRefs,unresolvedGoals,coverage:'bounded_claims_not_full_goal_coverage'});
}
