import type { PersonalContextV2 } from '../../contracts/PersonalContextV2.ts';
import type { NormalizationResult } from '../../contracts/PartTwo.ts';
import type { FormulaAnalysis } from '../../contracts/PartFour.ts';
import { canonicalJson, sha256 } from '../part-two/hash.ts';
import { deepFreeze } from '../part-two/dictionary.ts';
import { activeRoutineItem } from './comparison.ts';
import { analyzeFormula } from './formula.ts';
import { PART_FOUR_RELEASE } from './release.ts';
import { APPROVED_INGREDIENT_KNOWLEDGE, ingredientKnowledgeAvailable, type IngredientKnowledgeRelease } from './knowledge.ts';
import { ExactRoutineReferenceSchema, RoutineFormulaRequestSchema, RoutineFormulaEvidenceSchema, type RoutineFormulaRequest, type RoutineFormulaReadyEvidence } from '../../contracts/RoutineFormula.ts';
export { ExactRoutineReferenceSchema, RoutineFormulaRequestSchema, RoutineFormulaReadyEvidenceSchema, RoutineFormulaEvidenceSchema } from '../../contracts/RoutineFormula.ts';
export type { RoutineFormulaRequest, RoutineFormulaReadyEvidence, RoutineFormulaEvidence } from '../../contracts/RoutineFormula.ts';
export type RoutineFormulaState='ready'|'missing'|'denied'|'conflict'|'stale'|'unavailable'|'pending';
export interface RoutineFormulaItemState { routineItemId:string;state:RoutineFormulaState;reasonCodes:string[] }
export interface QualifiedRoutineFormula {
 routineItemId:string;reference:RoutineFormulaRequest['reference'];qualification:'exact_formula';partTwo:NormalizationResult;formula:FormulaAnalysis;
 evidence:RoutineFormulaReadyEvidence;dependencyIds:string[];validUntil:string;
}
export interface RoutineFormulaAdmission {items:RoutineFormulaItemState[];qualified:QualifiedRoutineFormula[];dependencyIds:string[];validUntil:string|null}
export interface RoutineFormulaOptions {now:string;knowledge?:IngredientKnowledgeRelease;withdrawnDependencies?:readonly string[]}
/** These envelopes must come from the authenticated trusted worker, after its
 * independently stored association/source-grant lookup. Parsing echoed grants
 * from HTTP/client JSON is not authorization. This module performs no lookup,
 * acquisition or promotion of catalog names/ingredient arrays into evidence. */
export function planRoutineFormulaRequests(context:PersonalContextV2):{requests:RoutineFormulaRequest[];items:RoutineFormulaItemState[]} {
 const routine=context.routine;
 if(routine&&(routine.ownerId!==context.ownerId||routine.revision>context.revision))throw Error('Foreign or future routine revision');
 const active=routine?.data.items.filter(activeRoutineItem)??[];
 if(active.length>50)throw Error('Routine formula item limit exceeded');
 const requests:RoutineFormulaRequest[]=[],items:RoutineFormulaItemState[]=[];
 for(const item of active){
  const reference=ExactRoutineReferenceSchema.safeParse(item.reference);
  if(!reference.success){items.push({routineItemId:item.id,state:'missing',reasonCodes:[item.reference.kind==='manual'?'manual_reference_not_formula_identity':'exact_formula_reference_missing']});continue;}
  requests.push(RoutineFormulaRequestSchema.parse({version:'routine-formula-request/v1',ownerId:context.ownerId,contextRevision:context.revision,routineRevisionId:routine!.id,routineItemId:item.id,routineItemHash:sha256(canonicalJson(item)),reference:reference.data,knowledgeVersion:PART_FOUR_RELEASE.knowledgeVersion,knowledgeHash:PART_FOUR_RELEASE.knowledgeHash}));
  items.push({routineItemId:item.id,state:'pending',reasonCodes:['formula_lookup_required']});
 }
 return {requests,items};
}
const equal=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
function validateReady(expected:RoutineFormulaRequest,evidence:RoutineFormulaReadyEvidence,options:RoutineFormulaOptions):{qualified:QualifiedRoutineFormula}|{state:RoutineFormulaState;reason:string} {
 const refuse=(state:RoutineFormulaState,reason:string)=>({state,reason});
 const now=Date.parse(options.now),authorization=evidence.authorization,association=evidence.association;
 if(!equal(expected,evidence.request))return refuse(evidence.request.ownerId!==expected.ownerId?'denied':'conflict','routine_binding_mismatch');
 if(!equal(expected.reference,association.reference))return refuse('conflict','exact_formula_association_mismatch');
 if(authorization.revoked||association.revoked||!authorization.evaluate||!authorization.display||!authorization.store)return refuse('denied','formula_permission_denied');
 if(Date.parse(authorization.checkedAt)>now||Date.parse(authorization.validUntil)<=now||Date.parse(association.validUntil)<=now)return refuse('stale','formula_authority_stale');
 const p=evidence.partTwo;
 if(p.authenticatedOwnerId!==expected.ownerId)return refuse('denied','normalization_owner_mismatch');
 if(Date.parse(p.expiresAt)<=now)return refuse('stale','normalization_expired');
 if(p.state!=='ready')return refuse(p.state==='pending'?'pending':p.state==='blocked'?'denied':p.state==='expired'?'stale':'unavailable','normalization_unavailable');
 if(p.output.kind!=='bound'||p.output.productFacts.binding.kind!=='declaration')return refuse('unavailable','product_formula_binding_missing');
 const snapshot=p.output.productFacts,b=snapshot.binding;
 if(b.kind!=='declaration')return refuse('unavailable','product_formula_binding_missing');
 if(snapshot.scope==='private_package'&&b.ownerId!==expected.ownerId)return refuse('denied','private_formula_owner_mismatch');
 if(snapshot.evidenceState==='conflict'||p.output.reading.evidenceState==='conflict')return refuse('conflict','formula_evidence_conflict');
 if(snapshot.evidenceState==='blocked'||p.output.reading.evidenceState==='blocked')return refuse('denied','formula_evidence_blocked');
 if(b.itemId!==association.partOneItemId||b.snapshotId!==association.partOneSnapshotId||b.declarationId!==association.declarationId||b.declarationRevision!==association.declarationRevision||p.bindingKey!==association.partTwoBindingKey||p.resultRevision!==association.partTwoRevision||b.dependencyDigest!==association.dependencyDigest)return refuse('conflict','normalization_association_mismatch');
 const sourceRefs=snapshot.dependencyManifest.sourceRefs;
 const sourceIds=[...new Set(sourceRefs.map(source=>source.observationId))].sort();
 if(!equal([...new Set(association.sourceDependencies)].sort(),sourceIds))return refuse('conflict','association_source_mismatch');
 const permissions=new Map<string,typeof authorization.sourcePermissions[number]>();
 for(const permission of authorization.sourcePermissions){const key=`${permission.observationId}:${permission.sourceRevision}`;if(permissions.has(key))return refuse('conflict','duplicate_source_permission');permissions.set(key,permission);}
 if(permissions.size!==sourceRefs.length)return refuse('denied','formula_source_authorization_missing');
 for(const source of sourceRefs){
  const permission=permissions.get(`${source.observationId}:${source.sourceRevision}`);
  if(!permission||permission.policyId!==source.policyId||permission.policyVersion!==source.policyVersion)return refuse('denied','formula_source_authorization_mismatch');
  if(permission.revoked||!permission.evaluate||!permission.display||!permission.store)return refuse('denied','formula_source_permission_denied');
  if(Date.parse(source.expiresAt)<=now||Date.parse(permission.validUntil)<=now)return refuse('stale','formula_source_expired');
 }
 const knowledge=options.knowledge??APPROVED_INGREDIENT_KNOWLEDGE;
 if(knowledge.version!==expected.knowledgeVersion||knowledge.contentHash!==expected.knowledgeHash)return refuse('unavailable','shared_knowledge_mismatch');
 const withdrawn=[...new Set([...(options.withdrawnDependencies??[]),...authorization.withdrawnDependencies])];
 const dependencyIds=[...new Set([association.id,association.partOneItemId,association.partOneSnapshotId,association.declarationId,association.partTwoSnapshotId,authorization.authorityId,p.bindingKey,association.dependencyDigest,expected.knowledgeVersion,expected.knowledgeHash,...sourceRefs.flatMap(source=>[source.observationId,source.policyId,source.contentHash]),...authorization.sourcePermissions.map(permission=>permission.grantId),...snapshot.facts.flatMap(fact=>[fact.factId,...fact.sourceDependencies,...fact.dictionaryDependencies]),...snapshot.dependencyManifest.dictionaryRecordIds])].sort();
 if(dependencyIds.some(id=>withdrawn.includes(id)))return refuse('denied','formula_dependency_withdrawn');
 if(!ingredientKnowledgeAvailable(knowledge,{now:options.now,withdrawnDependencies:withdrawn}))return refuse('denied','shared_knowledge_unavailable');
 const formula=analyzeFormula(p,{now:options.now,knowledge,withdrawnDependencies:withdrawn,expectedBinding:{bindingKey:association.partTwoBindingKey,resultRevision:association.partTwoRevision,dependencyDigest:association.dependencyDigest}});
 if(!formula||formula.knowledgeHash!==expected.knowledgeHash||formula.knowledgeVersion!==expected.knowledgeVersion)return refuse('unavailable','formula_analysis_unavailable');
 const validUntil=new Date(Math.min(Date.parse(p.expiresAt),Date.parse(authorization.validUntil),Date.parse(association.validUntil),...sourceRefs.map(source=>Date.parse(source.expiresAt)),...authorization.sourcePermissions.map(permission=>Date.parse(permission.validUntil)),...(knowledge.provenance.expiresAt?[Date.parse(knowledge.provenance.expiresAt)]:[]))).toISOString();
 return {qualified:deepFreeze({routineItemId:expected.routineItemId,reference:expected.reference,qualification:'exact_formula' as const,partTwo:p,formula,evidence,dependencyIds,validUntil})};
}
export function admitRoutineFormulaEvidence(context:PersonalContextV2,evidence:readonly unknown[],options:RoutineFormulaOptions):RoutineFormulaAdmission {
 if(!Number.isFinite(Date.parse(options.now)))throw Error('Routine formula evaluation time must be valid');
 if(evidence.length>50)throw Error('Routine formula evidence limit exceeded');
 const plan=planRoutineFormulaRequests(context),requests=new Map(plan.requests.map(request=>[request.routineItemId,request]));
 const byItem=new Map<string,unknown[]>();
 for(const raw of evidence){
  if(!raw||typeof raw!=='object')continue;
  const request=(raw as {request?:{routineItemId?:unknown}}).request;
  if(typeof request?.routineItemId!=='string'||!requests.has(request.routineItemId))continue;
  const rows=byItem.get(request.routineItemId)??[];rows.push(raw);byItem.set(request.routineItemId,rows);
 }
 const qualified:QualifiedRoutineFormula[]=[];
 const items=plan.items.map(item=>{
  const expected=requests.get(item.routineItemId);if(!expected)return item;
  const rows=byItem.get(item.routineItemId)??[];
  if(!rows.length)return {...item,state:'missing' as const,reasonCodes:['authorized_formula_not_supplied']};
  if(rows.length!==1)return {...item,state:'conflict' as const,reasonCodes:['multiple_formula_packets']};
  const parsed=RoutineFormulaEvidenceSchema.safeParse(rows[0]);
  if(!parsed.success)return {...item,state:'conflict' as const,reasonCodes:['invalid_formula_envelope']};
  const packet=parsed.data;
  if(!equal(packet.request,expected))return {...item,state:packet.request.ownerId!==expected.ownerId?'denied' as const:'conflict' as const,reasonCodes:['routine_binding_mismatch']};
  if(packet.state!=='ready')return {...item,state:packet.state,reasonCodes:packet.reasonCodes};
  const validated=validateReady(expected,packet,options);
  if('qualified' in validated){qualified.push(validated.qualified);return {...item,state:'ready' as const,reasonCodes:[]};}
  return {...item,state:validated.state,reasonCodes:[validated.reason]};
 });
 return deepFreeze({items,qualified,dependencyIds:[...new Set(qualified.flatMap(item=>item.dependencyIds))].sort(),validUntil:qualified.length?new Date(Math.min(...qualified.map(item=>Date.parse(item.validUntil)))).toISOString():null});
}
