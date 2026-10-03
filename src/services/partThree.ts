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
export const PART_THREE_ENABLED = PART_TWO_ENABLED && process.env.EXPO_PUBLIC_PART_THREE_ENABLED === 'true';
let accountGeneration = 0;
let previous = JSON.stringify([useAuthStore.getState().status, useAuthStore.getState().sessionUserId]);
const encounters = new Map<string, string>();
const listeners = new Set<() => void>();
useAuthStore.subscribe(state => { const next = JSON.stringify([state.status, state.sessionUserId]); if (next !== previous) {
    previous = next;
    accountGeneration++;
    encounters.clear();
    partThreeQuestionLatches.clear();
    listeners.forEach(f => f());
} });
export function partThreeSession(ownerId: string) { const s = useAuthStore.getState(); return s.status === 'SIGNED_IN' && s.sessionUserId === ownerId ? { ownerId, accountGeneration } : null; }
export function subscribePartThreeSession(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function partThreeEncounter(ownerId: string, scanId: string) { const session = partThreeSession(ownerId); if (!session)
    return null; const key = JSON.stringify([session, scanId]); if (!encounters.has(key))
    encounters.set(key, createCatalogRequestId()); return { ...session, encounterId: encounters.get(key)! }; }
async function ownerClient(ownerId: string) {
    const expected = partThreeSession(ownerId);
    if (!expected || !supabase || !PART_THREE_ENABLED)
        throw Error('Personal assessment unavailable');
    const guard = () => { if (JSON.stringify(partThreeSession(ownerId)) !== JSON.stringify(expected))
        throw Error('Personal session changed'); };
    const { data, error } = await supabase.auth.getSession();
    guard();
    if (error || data.session?.user.id !== ownerId)
        throw Error('Personal session changed');
    const token = data.session.access_token;
    return { guard, async invoke(path: string, body: string, signal?: AbortSignal) { guard(); const response = await supabase!.functions.invoke(path, { method: 'POST', body, signal, timeout: 15000, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } }); guard(); return response; } };
}
export const partThreeTransport: PartThreeTransport = createPartThreeTransport({ enabled: () => PART_THREE_ENABLED, invoke: async (path, body, signal) => { const owner = useAuthStore.getState().sessionUserId; if (!owner)
        throw Error('Personal session unavailable'); return (await ownerClient(owner)).invoke(path, body, signal); } });
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
