import type { PersonalDecisionRequest, PersonalDecisionResponse } from '../../contracts/PersonalDecisionService.ts';
import { supabase } from '../supabase.ts';
export type PersonalDecisionFunctionClient={functions:{invoke:(name:string,options:{body:object})=>Promise<{data:unknown;error:unknown}>}};
export class PersonalDecisionRemoteError extends Error {readonly code:string;constructor(code:string){super('Personal decision is unavailable');this.code=code;}}
export async function requestPersonalDecision(request:PersonalDecisionRequest,client:PersonalDecisionFunctionClient|null=supabase as PersonalDecisionFunctionClient|null):Promise<PersonalDecisionResponse>{
 if(!client)throw new PersonalDecisionRemoteError('DECISION_UNAVAILABLE');const {data,error}=await client.functions.invoke('personal-decision',{body:request});
 if(error){let code='DECISION_UNAVAILABLE';const response=(error as {context?:Response}).context;if(response)try{const body=await response.clone().json();if(typeof body?.code==='string')code=body.code;}catch{}throw new PersonalDecisionRemoteError(code);}
 if(!data||typeof data!=='object'||Array.isArray(data)||(data as Record<string,unknown>).kind!=='ready'||typeof (data as Record<string,unknown>).ownerId!=='string'||typeof (data as Record<string,unknown>).contextRevision!=='number')throw new PersonalDecisionRemoteError('INVALID_DECISION_RESPONSE');return data as PersonalDecisionResponse;
}
