import { z } from 'zod';
import { DeclarationSchema, FactBundleV1Schema, SaveRequestSchema, ScanResultSchema } from '../../../src/contracts/PartOne.ts';
import { PartTwoLabelAssertionSchema, NormalizationInputSchema, NormalizationRequestSchema, NormalizationResultSchema, type NormalizationInput, type NormalizationRequest, type NormalizationResult } from '../../../src/contracts/PartTwo.ts';
import { normalize, PART_TWO_VERSIONS, validateDictionaryRelease, type DictionaryRelease } from '../../../src/domain/part-two/index.ts';
import { LOCAL_DICTIONARY_RELEASE } from '../../../src/domain/part-two/dictionary.ts';
import { normalizeDatabaseDates } from './part-one-runtime.ts';
import { sha256, canonicalJson } from '../../../src/domain/part-two/hash.ts';

export const PART_TWO_RELEASE_ID=`part-two:${sha256(canonicalJson({dictionaryHash:LOCAL_DICTIONARY_RELEASE.contentHash,versions:PART_TWO_VERSIONS}))}`;
const date=z.string().refine(s=>Number.isFinite(Date.parse(s)));
const id=z.string().min(1).max(200), revision=z.number().int().nonnegative();
const rawRecord=z.strictObject({id,kind:z.enum(['observation','snapshot','declaration']),item_id:id.nullable(),revision,canonical_key:z.string().nullable(),policy_id:id,policy_version:id,owner_id:id.nullable(),scope:z.enum(['public','private_package']),payload:z.record(z.string(),z.unknown()),dependencies:z.array(id),identity_dependencies:z.array(id),supersedes_id:id.nullable(),observed_at:date,expires_at:date,created_at:date});
const dependency=z.strictObject({id,kind:z.enum(['observation','snapshot','declaration']),revision,policyId:id,policyVersion:id,ownerId:id.nullable(),scope:z.enum(['public','private_package']),payload:z.record(z.string(),z.unknown()),dependencies:z.array(id),identityDependencies:z.array(id),observedAt:date,expiresAt:date,status:z.enum(['active','revoked','retracted','superseded']),statusRevision:revision});
const contextSchema=z.strictObject({ownerId:id,scanId:id,capture:z.strictObject({captureSessionId:id,packageObservationId:id,captureRevision:revision,generation:revision,deletionEpoch:revision,removed:z.boolean()}).nullable(),generation:revision,evidenceRevision:revision,bindingRevision:revision,policyEpoch:revision,withdrawnExplanationDependencies:z.array(id).max(1000),deletionEpoch:revision,result:z.record(z.string(),z.unknown()),declaration:rawRecord.nullable(),snapshot:rawRecord.nullable(),dependencies:z.array(dependency).max(512),observations:z.array(dependency).max(512),policies:z.array(z.strictObject({id,version:id,retainAllowed:z.boolean(),displayAllowed:z.boolean(),exportAllowed:z.boolean(),epoch:revision,labelAssertionKinds:z.array(z.enum(['category','usage','purpose','claim'])).max(4).optional(),labelAssertionEpoch:revision.optional(),expiresAt:date.nullable()})).max(512),expiresAt:date.nullable(),state:z.enum(['pending','no_declaration','blocked','parse_limit']),releaseId:id.nullable(),releaseHash:z.string().nullable(),versions:z.record(z.string(),z.unknown()).nullable(),releaseEpoch:revision,contextDigest:z.string().regex(/^[a-f0-9]{64}$/),dependencyDigest:z.string().regex(/^[a-f0-9]{64}$/),bindingKey:id});
const resolvedSchema=z.strictObject({context:contextSchema,resultRevision:revision,state:z.enum(['ready','pending','no_declaration','blocked','expired','parse_limit','failed']),reasonCodes:z.array(z.string()),cached:z.unknown().nullable(),ticket:z.strictObject({bindingKey:id,leaseToken:id,contextDigest:id,expectedResultRevision:revision}).nullable()});
type Context=z.infer<typeof contextSchema>;
type Dependency=z.infer<typeof dependency>;
export interface PartTwoPorts { authorize(request:Request):Promise<string>; operation(action:string,payload:Record<string,unknown>):Promise<unknown>; worker(action:string,payload:Record<string,unknown>):Promise<unknown>; now?():string; localFixtureApproved?:boolean; dictionaryRelease?:DictionaryRelease; }
export class PartTwoHttpError extends Error { readonly status:number; constructor(code:string,status:number){super(code);this.status=status;} }
const headers={'content-type':'application/json','cache-control':'private, no-store, max-age=0','access-control-allow-origin':'*','access-control-allow-headers':'authorization,apikey,content-type,x-client-info','access-control-allow-methods':'POST,OPTIONS'};
function reply(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers});}
function utc(value:string){return new Date(value).toISOString();}
function object(value:unknown):Record<string,unknown>{return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};}
export function sourceText(record:Dependency):string|null {const p=record.payload, inner=object(p.payload); for(const v of [p.rawText,inner.rawIngredients,p.rawIngredients,object(p.observation).text])if(typeof v==='string')return v;return null;}
function literal(ctx:Context):{sections:{sectionId:string;kind:'ingredients'|'active'|'inactive'|'may_contain';text:string}[];expiresAt:string}|null {
 if(ctx.state==='parse_limit'||ctx.dependencies.length===0)return null;
 const display=object(ctx.result.display), sections=Array.isArray(display.sections)?display.sections:[];
 const permitted=sections.map(value=>object(value)).filter(s=>typeof s.sectionId==='string'&&typeof s.text==='string'&&['ingredients','active','inactive','may_contain'].includes(String(s.kind)));
 if(!ctx.expiresAt||!permitted.length)return null;
 return {sections:permitted.map(s=>({sectionId:s.sectionId as string,kind:s.kind as 'ingredients',text:s.text as string})),expiresAt:utc(ctx.expiresAt)};
}
function base(ctx:Context,request:NormalizationRequest,resultRevision:number,now:string){return {schemaVersion:2 as const,requestId:request.requestId,authenticatedOwnerId:ctx.ownerId,scanId:ctx.scanId,captureSessionId:ctx.capture?.captureSessionId??null,bindingKey:ctx.bindingKey,generation:ctx.generation,evidenceRevision:ctx.evidenceRevision,resultRevision,expiresAt:ctx.expiresAt?utc(ctx.expiresAt):new Date(Date.parse(now)+30000).toISOString()};}
export function overlayRequest(value:unknown,request:NormalizationRequest):NormalizationResult {
 const raw=object(value); const result={...raw,requestId:request.requestId};
 if(raw.state==='ready'){
  const output=object(raw.output); const replace=(snapshot:unknown)=>{const s=object(snapshot);return {...s,binding:{...object(s.binding),requestId:request.requestId}};};
  Object.assign(result,{output:{...output,reading:replace(output.reading),...(output.kind==='bound'?{productFacts:replace(output.productFacts)}:{})}});
 }
 return NormalizationResultSchema.parse(result);
}
function sourceRefs(ctx:Context,ids:string[]) {
 return ids.map(observationId=>{
  const o=ctx.observations.find(o=>o.id===observationId);if(!o||o.status==='revoked'||o.status==='retracted'||!ctx.policies.some(p=>p.id===o.policyId&&p.version===o.policyVersion&&p.retainAllowed&&p.displayAllowed))throw new Error('source_unavailable');
  const raw=sourceText(o);if(raw===null)throw new Error('source_text_unavailable');
  const p=o.payload;return {observationId:o.id,sourceRevision:o.revision,sourceTextHash:sha256(raw),contentHash:typeof p.contentHash==='string'&&/^[a-f0-9]{64}$/.test(p.contentHash)?p.contentHash:sha256(raw),policyId:o.policyId,policyVersion:o.policyVersion,evidenceBasis:o.scope==='public'?'public_source' as const:'private_package' as const,observedAt:utc(o.observedAt),sourceUpdatedAt:typeof p.sourceUpdatedAt==='string'?utc(p.sourceUpdatedAt):null,expiresAt:utc(o.expiresAt),permitted:true as const,sourceUrl:typeof p.sourceUrl==='string'?p.sourceUrl:null,attribution:typeof p.provider==='string'?p.provider:o.scope==='private_package'?'Your private label':null};
 });
}
class AuthoritativeParseLimit extends Error {}
const labelAnnotation=z.strictObject({assertionId:id,assertionKind:z.enum(['category','usage','purpose','claim']),text:z.string().min(1).max(2000),start:revision,end:revision,transcription:z.enum(['clear','uncertain','conflict']),conditional:z.string().max(1000).nullable()});
/** Only immutable, service-admitted annotations plus live field grants qualify.
 * Stored fieldPermission flags/category metadata are never copied as authority. */
function qualifiedLabelAssertions(ctx:Context,observationIds:string[]) {
 const assertions:z.infer<typeof PartTwoLabelAssertionSchema>[]=[];let annotatedCount=0;
 for(const observationId of observationIds){
  const source=ctx.observations.find(o=>o.id===observationId);if(!source)continue;
  const text=sourceText(source),policy=ctx.policies.find(p=>p.id===source.policyId&&p.version===source.policyVersion);
  if(text===null||!policy||!policy.retainAllowed||!policy.displayAllowed||typeof policy.labelAssertionEpoch!=='number'||source.status!=='active'||source.scope==='private_package'&&source.ownerId!==ctx.ownerId)continue;
  const annotations=source.payload.labelAssertions;
  if(!Array.isArray(annotations))continue;annotatedCount+=annotations.length;if(annotatedCount>100)throw new AuthoritativeParseLimit('label_annotation_limit');
  for(const annotation of annotations){
   const parsed=labelAnnotation.safeParse(annotation);if(!parsed.success)continue;const a=parsed.data;
   if(!(policy.labelAssertionKinds??[]).includes(a.assertionKind)||a.end<=a.start||a.end>text.length||text.slice(a.start,a.end)!==a.text)continue;
   const deadline=Math.min(Date.parse(source.expiresAt),Date.parse(ctx.expiresAt!),policy.expiresAt?Date.parse(policy.expiresAt):Infinity);
   if(!Number.isFinite(deadline)||deadline<Date.parse(ctx.expiresAt!))continue;
   const candidate=PartTwoLabelAssertionSchema.safeParse({assertionId:a.assertionId,assertionKind:a.assertionKind,text:a.text,sourceText:text,
    span:{observationId:source.id,sourceRevision:source.revision,sectionId:`label:${source.id}`,entryId:a.assertionId,start:a.start,end:a.end,raw:a.text},
    transcription:a.transcription,conditional:a.conditional,fieldPermission:{policyId:policy.id,policyVersion:policy.version,assertionKind:a.assertionKind,policyEpoch:policy.labelAssertionEpoch,expiresAt:new Date(deadline).toISOString(),permitted:true}});
   if(candidate.success&&!assertions.some(existing=>existing.assertionId===candidate.data.assertionId))assertions.push(candidate.data);

  }
 }
 return assertions;
}
/** Materialize only fields persisted by Part 1, never client authority flags. */
export function authoritativeInput(ctx:Context,request:NormalizationRequest):NormalizationInput {
 const common={scanId:ctx.scanId,requestId:request.requestId,authenticatedOwnerId:ctx.ownerId,bindingKey:ctx.bindingKey,generation:ctx.generation,evidenceRevision:ctx.evidenceRevision,dependencyDigest:ctx.dependencyDigest,deletionEpoch:ctx.deletionEpoch,policyEpoch:ctx.policyEpoch,dictionaryEpoch:ctx.releaseEpoch,expiresAt:utc(ctx.expiresAt!)};
 const d=ctx.declaration,p=d?.payload??{},snap=ctx.snapshot;
 const associated=!!(d&&snap&&d.item_id===snap.item_id&&p.snapshotId===snap.id&&object(object(p.predicate).association).passed===true&&(!ctx.capture||p.captureSessionId===ctx.capture.captureSessionId));
 if(associated){
  const fields=Object.fromEntries(Object.keys(DeclarationSchema.shape).map(k=>[k,p[k]]));
  fields.sections=p.structuredSections??p.sections;
  for(const k of ['observedAt','expiresAt','sourceUpdatedAt'])if(typeof fields[k]==='string')fields[k]=utc(fields[k] as string);
  const declaration=DeclarationSchema.parse(fields);
  if(!/^[a-f0-9]{64}$/.test(declaration.textStructureHash))throw new Error('declaration_hash_unavailable');
  if(declaration.declarationId!==d!.id||declaration.revision!==d!.revision||declaration.ownerId!==d!.owner_id||declaration.scope!==d!.scope)throw new Error('declaration_binding');
  const refs=sourceRefs(ctx,declaration.observationIds);
  for(const section of declaration.sections)for(const entry of section.entries)for(const span of entry.sourceSpans){
   const source=ctx.observations.find(o=>o.id===span.observationId);
   const text=source&&sourceText(source);
   if(!source||source.revision!==span.sourceRevision||text===null||text===undefined||span.start===null||span.end===null||span.end>text.length||span.start<0||text.slice(span.start,span.end)!==entry.rawToken)throw new Error('source_span_mismatch');
  }
  const observations=refs.map(r=>({observationId:r.observationId,revision:r.sourceRevision}));
  const attributedEdits=ctx.observations.filter(o=>observations.some(ref=>ref.observationId===o.id)&&o.payload.privateKind==='edit').map(o=>({observationId:o.id,supersedesId:String(object(o.payload.observation).supersedesId),revision:o.revision}));
  const binding={...common,kind:'declaration' as const,captureSessionId:ctx.capture?.captureSessionId??null,itemId:d!.item_id!,snapshotId:snap!.id,snapshotRevision:snap!.revision,declarationId:d!.id,declarationRevision:d!.revision,scope:d!.scope,ownerId:d!.owner_id,packageObservationId:declaration.packageObservationId,packageConfirmation:ctx.result.packageConfirmation,requestedMarket:snap!.payload.requestedMarket??null,sourceMarkets:declaration.sourceMarkets,packageMarket:declaration.packageMarket,observations,attributedEdits};
  const bundle=FactBundleV1Schema.parse({schemaVersion:1,itemId:d!.item_id,snapshotId:snap!.id,snapshotRevision:snap!.revision,declarationId:d!.id,declarationRevision:d!.revision,scope:d!.scope,ownerId:d!.owner_id,packageConfirmation:ctx.result.packageConfirmation,requestedMarket:snap!.payload.requestedMarket??null,sourceMarkets:declaration.sourceMarkets,packageMarket:declaration.packageMarket,sections:declaration.sections,predicate:p.predicate,state:p.state,completenessReasons:declaration.completenessReasons,uncertaintyReasons:declaration.transcriptionUncertainty,conflictIds:declaration.conflictIds,observedAt:declaration.observedAt,expiresAt:utc(ctx.expiresAt!),sources:p.sources??[],parserVersion:declaration.parserVersion,aliasVersion:declaration.aliasVersion,dependencyIds:ctx.dependencies.map(d=>d.id)});
  return NormalizationInputSchema.parse({kind:'bound_declaration',binding,bundle,declaration,sourceRefs:refs,labelAssertions:qualifiedLabelAssertions(ctx,declaration.observationIds)});
 }
 if(!ctx.capture)throw new Error('bound_declaration_unavailable');
 const current=ctx.observations.filter(o=>['ocr','edit'].includes(String(o.payload.privateKind))&&o.payload.role!=='package'&&!ctx.observations.some(child=>object(child.payload.observation).supersedesId===o.id));
 const refs=sourceRefs(ctx,current.map(o=>o.id));
 const observations=refs.map(r=>({observationId:r.observationId,revision:r.sourceRevision}));
 const attributedEdits=current.filter(o=>o.payload.privateKind==='edit').map(o=>({observationId:o.id,supersedesId:String(object(o.payload.observation).supersedesId),revision:o.revision}));
 const binding={...common,kind:'capture' as const,ownerId:ctx.ownerId,captureSessionId:ctx.capture.captureSessionId,packageObservationId:ctx.capture.packageObservationId,observations,attributedEdits};
 const transcription=(o:Dependency)=>object(o.payload.observation).status==='recognized'&&(!Array.isArray(o.payload.uncertaintyReasons)||o.payload.uncertaintyReasons.filter(r=>r!=='line_not_chemically_tokenized').length===0)?'clear' as const:'uncertain' as const;
 const structured=Array.isArray(p.structuredSections)?p.structuredSections:null;
 const sections=structured?structured.map(value=>{
  const section=object(value);if(typeof section.rawText!=='string'||!Array.isArray(section.entries))throw new Error('source_section_unavailable');
  const entries=section.entries.map(e=>object(e));
  const first=entries[0],firstSpan=first&&object((first.sourceSpans as unknown[])?.[0]);
  const o=current.find(o=>o.id===firstSpan?.observationId);if(!o)throw new Error('source_section_dependency');
  const full=sourceText(o)!;const offset=Number(firstSpan.start)-section.rawText.indexOf(String(first.rawToken));
  if(!Number.isInteger(offset)||offset<0||full.slice(offset,offset+section.rawText.length)!==section.rawText)throw new Error('source_section_span');
  const entryRefs=entries.map(entry=>{
   const spans=entry.sourceSpans;if(!Array.isArray(spans)||spans.length!==1)throw new Error('nonliteral_source_entry');const span=object(spans[0]);
   if(span.observationId!==o.id||span.sourceRevision!==o.revision||typeof span.start!=='number'||typeof span.end!=='number'||full.slice(span.start,span.end)!==entry.rawToken)throw new Error('source_entry_span');
   return {entryId:entry.entryId,start:span.start-offset,end:span.end-offset,uncertaintyReasons:entry.uncertaintyReasons??[],conditional:entry.conditional??null};
  });
  return {sectionId:section.sectionId,kind:section.kind,rawText:section.rawText,sourceOffset:offset,observationId:o.id,sourceRevision:o.revision,transcription:transcription(o),entryRefs};
 }):current.map(o=>({sectionId:`reading:${o.id}`,kind:'ingredients' as const,rawText:sourceText(o)!,sourceOffset:0,observationId:o.id,sourceRevision:o.revision,transcription:transcription(o),entryRefs:[]}));
 return NormalizationInputSchema.parse({kind:'source_reading',scope:'private_package',binding,sections,sourceRefs:refs,evidenceOutcome:p.state==='conflict'?'conflict':'partial',claimLimits:{productPresenceAllowed:false,declarationCompleteness:'unestablished',negativeClaimsAllowed:false}});
}
async function jsonBody(request:Request){const reader=request.body?.getReader();if(!reader)throw new PartTwoHttpError('invalid_request',400);let length=0;const chunks:Uint8Array[]=[];while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>16384){await reader.cancel();throw new PartTwoHttpError('payload_too_large',413);}chunks.push(value);}const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw new PartTwoHttpError('invalid_request',400);}}
/** Context strips all dependencies only after source/capture authorization fails.
 * A valid source graph survives a release refusal; ancestry overflow is separate. */
function terminalReasonCodes(ctx:Context,state:string,reasons:string[]):string[] {
 return state==='blocked'&&ctx.state==='blocked'&&ctx.dependencies.length===0
  ?['source_evidence_unavailable',...reasons.filter(code=>code!=='source_evidence_unavailable')]
  :reasons;
}
function selectedDictionary(ctx:Context,ports:PartTwoPorts,now:string):DictionaryRelease {
 const dictionary=validateDictionaryRelease(ports.dictionaryRelease??LOCAL_DICTIONARY_RELEASE);
 if(dictionary.releaseGate==='local_only'&&!ports.localFixtureApproved)throw new Error('dictionary_release_not_approved');
 if(dictionary.provenance.expiresAt&&Date.parse(dictionary.provenance.expiresAt)<=Date.parse(now))throw new Error('dictionary_release_not_approved');
 const versions={...PART_TWO_VERSIONS,dictionary:dictionary.version,explanation:dictionary.explanationVersion};
 const releaseId=`part-two:${sha256(canonicalJson({dictionaryHash:dictionary.contentHash,versions}))}`;
 if(ctx.releaseId!==releaseId||ctx.releaseHash!==dictionary.contentHash||canonicalJson(ctx.versions)!==canonicalJson(versions))throw new Error('release_unavailable');
 return dictionary;
}
function authorizedCached(value:unknown,ctx:Context,request:NormalizationRequest,resultRevision:number,ports:PartTwoPorts,now:string):NormalizationResult {
 try{
  const dictionary=selectedDictionary(ctx,ports,now),result=overlayRequest(value,request);
  if(result.state==='ready')for(const snapshot of [result.output.reading,...(result.output.kind==='bound'?[result.output.productFacts]:[])]){
   const versions={...PART_TWO_VERSIONS,dictionary:dictionary.version,explanation:dictionary.explanationVersion};
   if(snapshot.dependencyManifest.dictionaryHash!==dictionary.contentHash||Object.entries(versions).some(([key,v])=>snapshot.versions[key as keyof typeof versions]!==v))throw new Error('cached_release_mismatch');
  }
  return result;
 }catch(error){const policy=error instanceof Error&&error.message==='dictionary_release_not_approved';return NormalizationResultSchema.parse({...base(ctx,request,resultRevision,now),state:policy?'blocked':'failed',reasonCodes:[policy?'dictionary_release_not_approved':'authoritative_normalization_unavailable'],permittedText:literal(ctx)});}
}
export async function normalizeAuthorized(request:NormalizationRequest,ownerId:string,ports:PartTwoPorts):Promise<NormalizationResult>{
 const now=ports.now?.()??new Date().toISOString();
 const resolved=resolvedSchema.parse(await ports.operation('resolve',request));
 const ctx=resolved.context;
 if(ctx.ownerId!==ownerId||ctx.scanId!==request.scanId||(ctx.capture?.captureSessionId??null)!==request.captureSessionId)throw new PartTwoHttpError('invalid_server_binding',503);
 const initial=base(ctx,request,resolved.resultRevision,now);
 if(resolved.cached!==null)return authorizedCached(resolved.cached,ctx,request,resolved.resultRevision,ports,now);
 if(resolved.state!=='pending'||!resolved.ticket)return NormalizationResultSchema.parse({...initial,state:resolved.state==='ready'?'failed':resolved.state,...(resolved.state==='pending'?{}:{reasonCodes:terminalReasonCodes(ctx,resolved.state,resolved.reasonCodes)}),permittedText:literal(ctx)});
 let result:NormalizationResult;
 try{
  // The trusted server composition selects bytes; request flags never select
  // a release or grant permission. The live registry must match every pin.
  const dictionary=selectedDictionary(ctx,ports,now);
  const input=authoritativeInput(ctx,request);
  result=normalize(input,dictionary,{snapshotId:globalThis.crypto.randomUUID(),createdAt:now,resultRevision:resolved.resultRevision,withdrawnExplanationDependencies:ctx.withdrawnExplanationDependencies});
 }catch(error){const policy=error instanceof Error&&error.message==='dictionary_release_not_approved',limit=error instanceof AuthoritativeParseLimit;result=NormalizationResultSchema.parse({...initial,state:policy?'blocked':limit?'parse_limit':'failed',reasonCodes:[policy?'dictionary_release_not_approved':limit?'label_annotation_limit':'authoritative_normalization_unavailable'],permittedText:literal(ctx)});}
 let published:Record<string,unknown>;
 try{published=object(await ports.worker('publish',{...resolved.ticket,result}));}
 catch{published={published:false};}
 if(published.published===true)return overlayRequest(published.result,request);
 // Reauthorize after every asynchronous publication failure/refusal. Revocation
 // and deletion can happen while work awaits storage; never reuse old literals.
 const fresh=resolvedSchema.parse(await ports.operation('resolve',request));
 if(fresh.context.ownerId!==ownerId||fresh.context.scanId!==request.scanId||(fresh.context.capture?.captureSessionId??null)!==request.captureSessionId)throw new PartTwoHttpError('invalid_server_binding',503);
 if(fresh.cached!==null)return authorizedCached(fresh.cached,fresh.context,request,fresh.resultRevision,ports,now);
 return NormalizationResultSchema.parse({...base(fresh.context,request,fresh.resultRevision,now),state:fresh.state==='ready'?'failed':fresh.state,...(fresh.state==='pending'?{}:{reasonCodes:terminalReasonCodes(fresh.context,fresh.state,fresh.reasonCodes)}),permittedText:literal(fresh.context)});
}
export async function handlePartTwoRequest(request:Request,ports:PartTwoPorts):Promise<Response>{
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 try{const owner=await ports.authorize(request);const path=new URL(request.url).pathname;
  if(request.method==='POST'&&path.endsWith('/part-two/capture-interpretations')) {
   const payload=z.strictObject({captureSessionId:id,bindingKey:id,expectedPartTwoRevision:revision}).parse(await jsonBody(request));
   const saved=z.discriminatedUnion('state',[z.strictObject({state:z.literal('saved'),interpretationId:id,bindingKey:id,resultRevision:revision}),z.strictObject({state:z.literal('conflict'),code:z.literal('part_two_details_changed')})]).parse(await ports.operation('captures/save',payload));
   return reply(saved,saved.state==='conflict'?409:200);
  }
  if(request.method==='POST'&&path.endsWith('/part-two/captured-details')) {
   const payload=z.strictObject({captureSessionId:id,interpretationId:id.nullable(),requestId:id}).parse(await jsonBody(request));
   const saved=z.strictObject({result:z.unknown().nullable(),withdrawn:z.boolean(),interpretationId:id.nullable()}).parse(await ports.operation('captures/saved-read',{captureSessionId:payload.captureSessionId,interpretationId:payload.interpretationId}));
   if(saved.result!==null)return reply({...saved,result:overlayRequest(saved.result,{schemaVersion:1,requestId:payload.requestId,scanId:'saved',captureSessionId:payload.captureSessionId,expectedGeneration:0,expectedEvidenceRevision:0})});
   return reply(saved);
  }
  if(request.method==='POST'&&path.endsWith('/part-two/saves')) {
   const payload=z.strictObject({save:SaveRequestSchema,bindingKey:id,expectedPartTwoRevision:revision}).parse(await jsonBody(request));
   const saved=object(normalizeDatabaseDates(await ports.operation('saves/create',payload)));
   if(saved.conflict===true){ScanResultSchema.parse(saved.result);return reply(saved,409);}
   if(typeof saved.saveId!=='string')throw new PartTwoHttpError('invalid_server_projection',503);
   if(saved.result)ScanResultSchema.parse(saved.result);return reply(saved);
  }
  if(request.method==='POST'&&path.endsWith('/part-two/saved-details')) {
   const payload=z.strictObject({saveId:id,requestId:id}).parse(await jsonBody(request));
   const saved=object(await ports.operation('saves/read',{saveId:payload.saveId}));
   if(saved.result!==null&&saved.result!==undefined)return reply({result:overlayRequest(saved.result,{schemaVersion:1,requestId:payload.requestId,scanId:'saved',captureSessionId:null,expectedGeneration:0,expectedEvidenceRevision:0}),withdrawn:false});
   return reply({result:null,withdrawn:true});
  }
  if(request.method!=='POST'||!path.endsWith('/part-two/normalize'))throw new PartTwoHttpError('not_found',404);
  const parsed=NormalizationRequestSchema.parse(await jsonBody(request));const result=await normalizeAuthorized(parsed,owner,ports);return reply(result,result.state==='pending'?202:200);
 }catch(error){if(error instanceof PartTwoHttpError)return reply({code:error.message},error.status);if(error&&typeof error==='object'&&'name'in error&&error.name==='ZodError')return reply({code:'invalid_request'},400);return reply({code:'part_two_unavailable'},503);}
}
export { PART_TWO_VERSIONS, LOCAL_DICTIONARY_RELEASE };
