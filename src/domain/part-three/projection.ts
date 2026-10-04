import { NormalizationResultSchema, type NormalizationResult } from '../../contracts/PartTwo.ts';
import { ProductPurposeFactSchema, type ProductPurposeFact, type DecisionBindingV2 } from '../../contracts/PersonalResultV2.ts';
import { selectedPartThreeRelease, type PartThreeReleaseSelection } from './release.ts';
import { sha256,canonicalJson } from '../part-two/hash.ts';
export function purposeFacts(value:NormalizationResult,binding:DecisionBindingV2,now:number,selection?:PartThreeReleaseSelection):ProductPurposeFact[]{
 const {semantic:release,dictionary,releaseHash}=selectedPartThreeRelease(selection);
 const result=NormalizationResultSchema.parse(value);
 if(result.state!=='ready'||result.output.kind!=='bound'||binding.subject.kind!=='declaration'||result.authenticatedOwnerId!==binding.ownerId||result.bindingKey!==binding.partTwoBindingKey||result.resultRevision!==binding.partTwoRevision||Date.parse(result.expiresAt)<=now)return [];
 const snapshot=result.output.productFacts,subject=binding.subject;
 if(binding.releases.releaseHash!==releaseHash||snapshot.versions.dictionary!==dictionary.version||snapshot.dependencyManifest.dictionaryHash!==dictionary.contentHash)return [];
 if(snapshot.binding.kind!=='declaration'||snapshot.binding.itemId!==subject.itemId||snapshot.binding.declarationId!==subject.declarationId||snapshot.binding.declarationRevision!==subject.declarationRevision||snapshot.evidenceState==='conflict'||snapshot.evidenceState==='blocked')return [];
 const output:ProductPurposeFact[]=[];
 for(const assertion of snapshot.labelAssertions){
  const mapping=release.purposes.find(x=>x.literal===assertion.text);
  const fact=snapshot.facts.find(f=>f.kind==='product_label_assertion'&&f.subject.assertionId===assertion.assertionId&&f.value.assertionKind==='purpose'&&f.value.text===assertion.text);
  if(!mapping||!fact||assertion.assertionKind!=='purpose'||assertion.transcription!=='clear'||assertion.conditional!==null||Date.parse(assertion.fieldPermission.expiresAt)<=now)continue;
  const source=snapshot.dependencyManifest.sourceRefs.find(s=>s.observationId===assertion.span.observationId&&s.sourceRevision===assertion.span.sourceRevision);
  if(!source||Date.parse(source.expiresAt)<=now)continue;
  output.push(ProductPurposeFactSchema.parse({factId:`purpose:${sha256(canonicalJson([fact.factId,mapping.id,releaseHash])).slice(0,32)}`,revision:result.resultRevision,itemId:subject.itemId,variantId:subject.variantId,purposeId:mapping.purposeId,site:mapping.site,useForm:mapping.useForm,basis:'admitted_label_assertion',assertionId:assertion.assertionId,partTwoFactId:fact.factId,spans:fact.spans,declarationId:subject.declarationId,declarationRevision:subject.declarationRevision,sourceRevision:assertion.span.sourceRevision,packageScope:subject.packageScope,mappingId:mapping.id,mappingVersion:release.evidence,operations:{evaluate:true,externalProcess:false},dependencies:{sourceIds:fact.sourceDependencies,sourceFields:[`${assertion.span.observationId}:purpose:${assertion.assertionId}`],contextRevisionIds:[],factIds:[fact.factId],occurrenceIds:[],releaseIds:[releaseHash],validUntil:fact.validUntil}}));
 }
 return output;
}
