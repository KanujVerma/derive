import {canonicalJson,sha256} from '../part-two/hash.ts';

/** A provider record identity, never a verified catalog entry or formula ID.
 * Only a trusted acquisition adapter may construct the source observation.
 * This module checks consistency; it does not establish acquisition authority. */
export interface ObservedProductKey {
 kind:'observed_product';
 namespace:'openbeautyfacts/gtin/v1';
 id:string;
 gtin14:string;
 market:'US'|null;
}
export interface ObservedProductObservation {
 key:ObservedProductKey;
 snapshotId:string;
 declarationId:string;
 declarationRevision:number;
 sourceObservationId:string;
 sourceVersion:string;
 sourceDigest:string;
 sourceCountryTags:readonly string[];
 observedAt:string;
 validUntil:string;
 /** Unknown remains unknown, even when the ingredient text did not change. */
 formulaVersionId:null;
 verification:'provider_observation';
 observationHash:string;
}
export interface TrustedObservedProductInput {
 provider:'openbeautyfacts';
 requestedCode:string;
 returnedCode:string;
 requestedMarket:'US'|null;
 sourceCountryTags:readonly string[];
 snapshotId:string;
 declarationId:string;
 declarationRevision:number;
 sourceObservationId:string;
 sourceVersion:string;
 sourceDigest:string;
 observedAt:string;
 validUntil:string;
}
const text=(v:unknown,max=200):v is string=>typeof v==='string'&&v.length>0&&v.length<=max&&v.trim()===v;
const digest=(v:unknown)=>sha256(canonicalJson(v));
/** Accept explicit GTIN formats only. Leading zero expansion preserves the
 * check digit. Untyped eight-digit values are ambiguous with UPC-E and rejected;
 * an acquisition adapter must expand UPC-E with its actual symbology first.
 * All-zero placeholders are not identities. */
export function canonicalObservedGtin(code:string):string {
 if(typeof code!=='string'||!/^(?:\d{12}|\d{13}|\d{14})$/.test(code)||/^0+$/.test(code))throw Error('invalid_observed_gtin');
 let total=0;
 for(let i=code.length-2,weight=3;i>=0;i--,weight=weight===3?1:3)total+=Number(code[i])*weight;
 if((10-total%10)%10!==Number(code.at(-1)))throw Error('invalid_observed_gtin');
 const normalized=code.padStart(14,'0');
 if(/^00[24]/.test(normalized)||/^02/.test(normalized))throw Error('restricted_observed_gtin');
 return normalized;
}
function keyFor(gtin14:string,market:'US'|null):ObservedProductKey {
 const namespace='openbeautyfacts/gtin/v1' as const;
 return {kind:'observed_product',namespace,id:'observed:'+digest({namespace,gtin14,market}),gtin14,market};
}
export function validateObservedProductKey(raw:ObservedProductKey):ObservedProductKey {
 if(!raw||canonicalJson(Object.keys(raw).sort())!==canonicalJson(['gtin14','id','kind','market','namespace'])
  ||raw.kind!=='observed_product'||raw.namespace!=='openbeautyfacts/gtin/v1'
  ||raw.market!==null&&raw.market!=='US'||typeof raw.gtin14!=='string'||raw.gtin14.length!==14
  ||canonicalObservedGtin(raw.gtin14)!==raw.gtin14)throw Error('invalid_observed_identity');
 const expected=keyFor(raw.gtin14,raw.market);
 if(raw.id!==expected.id)throw Error('invalid_observed_identity');
 return expected;
}
export function createObservedProductObservation(input:TrustedObservedProductInput):ObservedProductObservation {
 if(input.provider!=='openbeautyfacts')throw Error('unsupported_observed_provider');
 const requested=canonicalObservedGtin(input.requestedCode),returned=canonicalObservedGtin(input.returnedCode);
 if(requested!==returned)throw Error('observed_code_mismatch');
 if(input.requestedMarket!==null&&input.requestedMarket!=='US')throw Error('unsupported_observed_market');
 if(!Array.isArray(input.sourceCountryTags)||input.sourceCountryTags.length>200
  ||input.sourceCountryTags.some(tag=>!text(tag)||!/^en:[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tag)))throw Error('invalid_observed_market_evidence');
 // A requested market alone cannot assert that the source identifies that market.
 if(input.requestedMarket==='US'&&!input.sourceCountryTags.includes('en:united-states'))throw Error('observed_market_not_supported');
 if(![input.snapshotId,input.declarationId,input.sourceObservationId,input.sourceVersion].every(v=>text(v))
  ||typeof input.sourceDigest!=='string'||!/^[a-f0-9]{64}$/.test(input.sourceDigest)
  ||!Number.isSafeInteger(input.declarationRevision)||input.declarationRevision<0)throw Error('invalid_observed_provenance');
 if(!isObservedTimestamp(input.observedAt)||!isObservedTimestamp(input.validUntil))throw Error('invalid_observed_lease');
 const observed=Date.parse(input.observedAt),until=Date.parse(input.validUntil);
 if(!Number.isFinite(observed)||!Number.isFinite(until)||until<=observed)throw Error('invalid_observed_lease');
 const observation={key:keyFor(requested,input.requestedMarket),snapshotId:input.snapshotId,
  declarationId:input.declarationId,declarationRevision:input.declarationRevision,
  sourceObservationId:input.sourceObservationId,sourceVersion:input.sourceVersion,sourceDigest:input.sourceDigest,
  sourceCountryTags:[...new Set(input.sourceCountryTags)].sort(),
  observedAt:input.observedAt,validUntil:input.validUntil,formulaVersionId:null,
  verification:'provider_observation' as const};
 return {...observation,observationHash:digest(observation)};
}
/** Repeated snapshots can reference one record while retaining different
 * evidence/version hashes. This NEVER returns an exact-formula match.
 * Conflicting or withdrawn identity assertions must be denied by the server
 * registry before this comparison is used for answer reuse. */
export function sameObservedProduct(a:ObservedProductKey,b:ObservedProductKey):boolean {
 return validateObservedProductKey(a).id===validateObservedProductKey(b).id;
}

export function isObservedTimestamp(v:unknown):v is string {
 return typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
}
/** Strictly re-derive every field. Hash equality alone is not provenance validation. */
export function validateObservedProductObservation(raw:ObservedProductObservation):ObservedProductObservation {
 if(!raw||typeof raw!=='object'||Array.isArray(raw)
  ||Object.keys(raw).sort().join()!=='declarationId,declarationRevision,formulaVersionId,key,observationHash,observedAt,snapshotId,sourceCountryTags,sourceDigest,sourceObservationId,sourceVersion,validUntil,verification')throw Error('invalid_observed_observation');
 const key=validateObservedProductKey(raw.key);
 const expected=createObservedProductObservation({provider:'openbeautyfacts',requestedCode:key.gtin14,returnedCode:key.gtin14,requestedMarket:key.market,
  sourceCountryTags:raw.sourceCountryTags,snapshotId:raw.snapshotId,declarationId:raw.declarationId,declarationRevision:raw.declarationRevision,
  sourceObservationId:raw.sourceObservationId,sourceVersion:raw.sourceVersion,sourceDigest:raw.sourceDigest,observedAt:raw.observedAt,validUntil:raw.validUntil});
 if(canonicalJson(raw)!==canonicalJson(expected))throw Error('invalid_observed_observation');
 return expected;
}
