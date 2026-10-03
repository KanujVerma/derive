import { PART_TWO_ENABLED } from './partTwo';
import { supabase } from './supabase';
import { useAuthStore } from '../stores/authStore';
import { catalogReferenceLabels } from '../presentation/part-three/catalogLabels';
import type { ContextProductReference } from '../contracts/PersonalContext';
import { getCatalogProductDetail } from './productCatalog';
import { createCatalogRequestId } from './productCatalog';
import { createPartThreeTransport, type PartThreeTransport } from './partThreeClient';
import { personalContextV2Schema } from '../contracts/PersonalContextV2Schema';
import { partThreeQuestionLatches } from '../presentation/part-three/controller';
import { z } from 'zod';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {createPartThreeSaveRecoveryStore} from '../presentation/part-three/saveRecovery';
import {createPartThreeSessionRecovery,sessionRecoveryGeneration} from '../presentation/part-three/sessionRecovery';
import {registerSessionRetirement} from './sessionRetirement';
import type {SaveRecoveryAccount} from '../presentation/part-three/saveRecovery';
export const PART_THREE_ENABLED = PART_TWO_ENABLED && process.env.EXPO_PUBLIC_PART_THREE_ENABLED === 'true';
export const PART_FOUR_ENABLED = PART_THREE_ENABLED && process.env.EXPO_PUBLIC_PART_FOUR_LOCAL_FOUNDATION === 'true';
const encounters = new Map<string, string>();
const listeners = new Set<(event?:'retired') => void>();
let lastAccount:string|null=null;
const sessionRecovery=createPartThreeSessionRecovery({auth:()=>useAuthStore.getState(),getSession:async()=>{
    if(!supabase)throw Error('Personal session unavailable');
    const {data,error}=await supabase.auth.getSession();if(error)throw Error('Personal session unavailable');return data.session;
},retire:account=>partThreeSaveRecovery.retireOwner(account.ownerId,account.accountGeneration),retireUnanchored:owner=>partThreeSaveRecovery.eraseOwner(owner),changed:event=>{
    const current=sessionRecovery.current(),next=current?JSON.stringify(current):null;
    if(next&&lastAccount&&next!==lastAccount)partThreeQuestionLatches.clear();
    if(next)lastAccount=next;
    listeners.forEach(f=>f(event));
}});
export const partThreeSaveRecovery=createPartThreeSaveRecoveryStore(AsyncStorage,()=>sessionRecovery.current());
export const retirePartThreeSession=()=>{encounters.clear();partThreeQuestionLatches.clear();return sessionRecovery.retire();};
registerSessionRetirement(retirePartThreeSession);
useAuthStore.subscribe(state=>{
    void sessionRecovery.observeAuth().catch(()=>{listeners.forEach(f=>f());});
    if(state.status==='SIGNED_IN'&&state.sessionUserId)void initializePartThreeSession(state.sessionUserId).catch(()=>undefined);
});
export async function initializePartThreeSession(ownerId:string){if(!supabase||!PART_THREE_ENABLED)throw Error('Personal assessment unavailable');return sessionRecovery.initialize(ownerId);}
export function partThreeSession(ownerId: string) {return sessionRecovery.current(ownerId);}
export function subscribePartThreeSession(listener: (event?:'retired') => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
const encounterKey=(session:{ownerId:string;accountGeneration:number},scanId:string,captureSessionId:string|null)=>JSON.stringify([session,scanId,captureSessionId]);
export function partThreeEncounter(ownerId: string, scanId: string,captureSessionId:string|null=null) {const session=partThreeSession(ownerId);if(!session)return null;const id=encounters.get(encounterKey(session,scanId,captureSessionId));return id?{...session,encounterId:id}:null;}
export async function recoverPartThreeEncounter(ownerId:string,scanId:string,captureSessionId:string|null=null){
    const session=await initializePartThreeSession(ownerId),recovered=await partThreeSaveRecovery.discover({...session,scanId,captureSessionId});
    if(JSON.stringify(partThreeSession(ownerId))!==JSON.stringify(session))throw Error('Personal session changed');
    if(recovered.state==='ambiguous')throw Error('Save recovery is ambiguous');
    const key=encounterKey(session,scanId,captureSessionId);
    encounters.set(key,recovered.state==='pending'?recovered.scope.encounterId:encounters.get(key)??createCatalogRequestId());
    return {...session,encounterId:encounters.get(key)!};
}
async function ownerClient(ownerId: string,expectedAccount?:SaveRecoveryAccount|null) {
    if (!supabase || !PART_THREE_ENABLED)
        throw Error('Personal assessment unavailable');
    // Ordinary owned reads may initialize the anchor (for example My Stuff on
    // a fresh process). Save transport captures its prior authority explicitly.
    const expected=expectedAccount===undefined?await initializePartThreeSession(ownerId):expectedAccount;
    if(!expected)throw Error('Personal session unavailable');
    const guard = () => { if (JSON.stringify(partThreeSession(ownerId)) !== JSON.stringify(expected))
        throw Error('Personal session changed'); };
    await initializePartThreeSession(ownerId);
    guard();
    const { data, error } = await supabase.auth.getSession();
    guard();
    if (error || !data.session || data.session.user.id !== ownerId || sessionRecoveryGeneration(data.session,ownerId)!==expected.accountGeneration)
        throw Error('Personal session changed');
    const token = data.session.access_token;
    return { guard, async invoke(path: string, body: string, signal?: AbortSignal) { guard(); const response = await supabase!.functions.invoke(path, { method: 'POST', body, signal, timeout: 15000, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } }); guard(); return response; } };
}
export const partThreeTransport: PartThreeTransport = createPartThreeTransport({ enabled: () => PART_THREE_ENABLED, invoke: async (path, body, signal) => { const owner = useAuthStore.getState().sessionUserId; if (!owner)
        throw Error('Personal session unavailable'); return (await ownerClient(owner,partThreeSession(owner))).invoke(path, body, signal); } });
export async function loadPartThreeContext(ownerId: string) { const client = await ownerClient(ownerId); const response = await client.invoke('personal-context', JSON.stringify({ operation: 'read_context_v2' })); if (response.error)
    throw Error('Context unavailable'); const c = personalContextV2Schema.parse(response.data); if (c.ownerId !== ownerId)
    throw Error('Context owner changed'); return c; }
export const savedAssessmentIndexSchema = z.strictObject({ kind: z.literal('saved_list'), items: z.array(z.strictObject({ savedAssessmentId: z.uuid(), scanId: z.uuid().nullable(), savedAt: z.iso.datetime({ offset: true }) })) });
export type SavedAssessmentIndex = z.infer<typeof savedAssessmentIndexSchema>['items'];
export async function listPartThreeSaved(ownerId: string): Promise<SavedAssessmentIndex> { if (!PART_THREE_ENABLED)
    return []; const client = await ownerClient(ownerId), response = await client.invoke('part-three', JSON.stringify({ operation: 'list_saved' })); if (response.error)
    throw Error('Saved assessments unavailable'); return savedAssessmentIndexSchema.parse(response.data).items; }

/** Display names use the existing catalog read boundary and never supply formula authority. */
export async function loadPartThreeLabels(owner: string, references: ContextProductReference[]): Promise<Record<string,string>> {
  const client = await ownerClient(owner);
  return catalogReferenceLabels(references,client.guard,id=>getCatalogProductDetail(id,{functions:{invoke:(path:string,request:{body:unknown})=>client.invoke(path,JSON.stringify(request.body))}}));
}
