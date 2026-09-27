import type { PersonalDecisionRequest, PersonalDecisionResponse } from '../../contracts/PersonalDecisionService.ts';
import { supabase } from '../supabase.ts';
export class PersonalDecisionRemoteError extends Error {readonly code:string;constructor(code:string){super('Personal decision is unavailable');this.code=code;}}
export async function requestPersonalDecision(request:PersonalDecisionRequest):Promise<PersonalDecisionResponse>{
 if(!supabase)throw new PersonalDecisionRemoteError('DECISION_UNAVAILABLE');const {data,error}=await supabase.functions.invoke('personal-decision',{body:request});
 if(error){let code='DECISION_UNAVAILABLE';const response=(error as {context?:Response}).context;if(response)try{const body=await response.clone().json();if(typeof body?.code==='string')code=body.code;}catch{}throw new PersonalDecisionRemoteError(code);}
 if(!data||data.kind!=='ready'||typeof data.ownerId!=='string'||typeof data.contextRevision!=='number')throw new PersonalDecisionRemoteError('INVALID_DECISION_RESPONSE');return data as PersonalDecisionResponse;
}
