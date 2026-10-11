import {canonicalJson} from '../part-two/hash.ts';
import {validateObservedProductKey,validateObservedProductObservation,isObservedTimestamp,type ObservedProductKey,type ObservedProductObservation} from './observedProductIdentity.ts';

/** Registry state is server-owned. These transitions are pure reference logic
 * for SQL parity, not permission to write or revive an identity from the client. */
export interface ObservedContinuity {
 key:ObservedProductKey;
 generation:number;
 revision:number;
 state:'active'|'conflict'|'withdrawn';
 latestObservationHash:string;
 latestObservedAt:string;
 latestValidUntil:string;
}
export interface ObservedUseScope {
 kind:'observed_product_use_experience';
 observedProduct:ObservedProductKey;
 continuityGeneration:number;
 category:string;
 site:string;
 useForm:'leave_on'|'rinse_off'|'other';
 experienceKey:string;
}
const safe=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;
const text=(v:unknown)=>typeof v==='string'&&v.trim().length>0&&v.length<=200&&!['unknown','unsure','unanswered','other'].includes(v);
const validHash=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
export function initialObservedContinuity(observation:ObservedProductObservation):ObservedContinuity {
 validateObservedProductObservation(observation);
 return {key:structuredClone(observation.key),generation:0,revision:0,state:'active',latestObservationHash:observation.observationHash,latestObservedAt:observation.observedAt,latestValidUntil:observation.validUntil};
}
function current(state:ObservedContinuity,expectedRevision:number):void {
 validateObservedProductKey(state.key);
 if(!safe(state.generation)||!safe(state.revision)||state.revision!==expectedRevision
  ||!['active','conflict','withdrawn'].includes(state.state)||!validHash(state.latestObservationHash)
  ||!isObservedTimestamp(state.latestObservedAt)||!isObservedTimestamp(state.latestValidUntil)
  ||Date.parse(state.latestValidUntil)<=Date.parse(state.latestObservedAt))throw Error('observed_continuity_changed');
}
/** Refreshing provider bytes cannot clear a prior conflict or withdrawal. */
export function refreshObservedContinuity(state:ObservedContinuity,observation:ObservedProductObservation,expectedRevision:number):ObservedContinuity {
 current(state,expectedRevision);validateObservedProductObservation(observation);
 if(state.key.id!==observation.key.id)throw Error('different_observed_product');
 if(Date.parse(observation.observedAt)<Date.parse(state.latestObservedAt))throw Error('stale_observed_snapshot');
 if(observation.observationHash===state.latestObservationHash)return structuredClone(state);
 // Two separately bound scans can share one cached acquisition timestamp.
 // That is not an identity conflict. The authoritative producer must check
 // source contradictions independently before calling this refresh transition.
 if(state.revision===Number.MAX_SAFE_INTEGER)throw Error('observed_revision_exhausted');
 return {...structuredClone(state),revision:state.revision+1,latestObservationHash:observation.observationHash,latestObservedAt:observation.observedAt,latestValidUntil:observation.validUntil};
}
export function invalidateObservedContinuity(state:ObservedContinuity,reason:'conflict'|'withdrawn',expectedRevision:number):ObservedContinuity {
 current(state,expectedRevision);
 if(reason!=='conflict'&&reason!=='withdrawn')throw Error('invalid_observed_invalidation');
 if(state.state===reason)return structuredClone(state);
 if(state.revision===Number.MAX_SAFE_INTEGER||state.generation===Number.MAX_SAFE_INTEGER)throw Error('observed_revision_exhausted');
 return {...structuredClone(state),state:reason,generation:state.generation+1,revision:state.revision+1};
}
/** A separate authoritative reconciliation may restore the registry. It must
 * preserve the incremented generation. There is intentionally no automatic
 * resolve transition that trusts the next arbitrary provider response. */
export function observedUseScopeKey(scope:ObservedUseScope):string {
 if(!scope||Object.keys(scope).sort().join()!=='category,continuityGeneration,experienceKey,kind,observedProduct,site,useForm'
  ||scope.kind!=='observed_product_use_experience'||!safe(scope.continuityGeneration)
  ||![scope.category,scope.site,scope.experienceKey].every(text)||!['leave_on','rinse_off','other'].includes(scope.useForm))throw Error('invalid_observed_use_scope');
 const key=validateObservedProductKey(scope.observedProduct);
 return canonicalJson([scope.kind,key,scope.continuityGeneration,scope.category,scope.site,scope.useForm,scope.experienceKey]);
}
export function matchObservedUseScope(recorded:ObservedUseScope,requested:ObservedUseScope,currentRegistry:ObservedContinuity,now:string):'product_use_only'|'different' {
 current(currentRegistry,currentRegistry.revision);
 if(!isObservedTimestamp(now)||Date.parse(currentRegistry.latestObservedAt)>Date.parse(now)||Date.parse(currentRegistry.latestValidUntil)<=Date.parse(now)
  ||observedUseScopeKey(recorded)!==observedUseScopeKey(requested)||currentRegistry.state!=='active'
  ||requested.observedProduct.id!==currentRegistry.key.id||requested.continuityGeneration!==currentRegistry.generation)return 'different';
 return 'product_use_only';
}
