import type { PersonalContextRequest, PersonalContextSnapshot, PersonalContextWriteResult } from '../../contracts/PersonalContext.ts';
import { supabase } from '../supabase.ts';
type FunctionClient = { functions: { invoke: (name:string, options:{body:object}) => Promise<{data:unknown;error:unknown}> } };
export class PersonalContextRemoteError extends Error {
  readonly code: string;
  constructor(code:string) { super('Personal context is unavailable'); this.code=code; }
}
/** Caller retains request ID and base revision for retries. No owner is accepted from client input. */
export async function requestPersonalContext(request: PersonalContextRequest, client:FunctionClient = supabase as FunctionClient):Promise<PersonalContextSnapshot | PersonalContextWriteResult | Record<string,unknown>> {
  if (!client) throw new PersonalContextRemoteError('CONTEXT_UNAVAILABLE');
  const {data,error} = await client.functions.invoke('personal-context',{body:request});
  if (error) {
    let code = 'CONTEXT_UNAVAILABLE';
    const context = (error as {context?:Response}).context;
    if (context && typeof context.clone === 'function') {
      try { const body = await context.clone().json(); if (typeof body?.code === 'string') code=body.code; } catch { /* Generic error retained. */ }
    }
    throw new PersonalContextRemoteError(code);
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new PersonalContextRemoteError('INVALID_CONTEXT_RESPONSE');
  return data as PersonalContextSnapshot | PersonalContextWriteResult;
}
export async function getPersonalContext(client?:FunctionClient):Promise<PersonalContextSnapshot> {
  const value = await requestPersonalContext({operation:'get_context'},client);
  if (!('version' in value) || value.version !== 'personal-context-v1' || !('ownerId' in value) || typeof value.ownerId !== 'string'
    || !('revision' in value) || typeof value.revision !== 'number' || !('experiences' in value) || !Array.isArray(value.experiences)) throw new PersonalContextRemoteError('INVALID_CONTEXT_RESPONSE');
  return value as PersonalContextSnapshot;
}
export async function writePersonalContext(request:Exclude<PersonalContextRequest,{operation:'get_context'|'get_revision'|'get_experiences'}>,client?:FunctionClient):Promise<PersonalContextWriteResult> {
  const value=await requestPersonalContext(request,client);
  if (!('replayed' in value) || typeof value.replayed !== 'boolean' || !('revision' in value) || !value.revision || typeof value.revision !== 'object') throw new PersonalContextRemoteError('INVALID_CONTEXT_RESPONSE');
  return value as PersonalContextWriteResult;
}

/** V2 writes use the same owner-authenticated Edge entry point; retain IDs for retry. */
export async function getPersonalContextV2(client:FunctionClient = supabase as FunctionClient):Promise<import('../../contracts/PersonalContextV2.ts').PersonalContextV2> {
  const {data,error}=await client.functions.invoke('personal-context',{body:{operation:'read_context_v2'}});
  if(error)throw new PersonalContextRemoteError('CONTEXT_UNAVAILABLE');
  const {personalContextV2Schema}=await import('../../contracts/PersonalContextV2Schema.ts');
  const parsed=personalContextV2Schema.safeParse(data);if(!parsed.success)throw new PersonalContextRemoteError('INVALID_CONTEXT_RESPONSE');return parsed.data;
}
export async function writePersonalContextV2(request:Exclude<import('../../contracts/PersonalContextV2.ts').PersonalContextV2Request,{operation:'read_context_v2'}>,client:FunctionClient = supabase as FunctionClient):Promise<import('../../contracts/PersonalContextV2.ts').SetupWriteResult | import('../../contracts/PersonalContextV2.ts').ContextDeleteResult> {
  const {data,error}=await client.functions.invoke('personal-context',{body:request});
  if(error){let code='CONTEXT_UNAVAILABLE';try{const response=(error as {context?:Response}).context;if(response){const body=await response.clone().json();if(typeof body?.code==='string')code=body.code;}}catch{}throw new PersonalContextRemoteError(code);}
  const {setupWriteResultSchema,contextDeleteResultSchema}=await import('../../contracts/PersonalContextV2Schema.ts');
  const parsed=request.operation==='save_setup'?setupWriteResultSchema.safeParse(data):contextDeleteResultSchema.safeParse(data);
  if(!parsed.success)throw new PersonalContextRemoteError('INVALID_CONTEXT_RESPONSE');
  if(request.operation==='save_setup' && 'revisionReferences' in parsed.data){
    const refs=parsed.data.revisionReferences;
    for(const field of ['experiences','preferences','assessments','notes'] as const){const expected=request.setup[field].map(item=>item.id).sort(),actual=Object.keys(refs[field]).sort();if(JSON.stringify(expected)!==JSON.stringify(actual))throw new PersonalContextRemoteError('INVALID_CONTEXT_RESPONSE');}
  }
  return parsed.data;
}
