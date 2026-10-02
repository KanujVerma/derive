import type { ConfirmedPreference, PersonalContextV2, PersonalContextV2Request, SetupWriteResult, ContextDeleteResult } from '../../contracts/PersonalContextV2.ts';
import { canonicalJson } from '../../domain/part-two/hash.ts';
import { preferenceSetup } from './preferences.ts';
export interface PreferencePorts {
    owner: () => string | null;
    read: (owner: string) => Promise<PersonalContextV2>;
    write: (owner: string, r: Exclude<PersonalContextV2Request, {
        operation: 'read_context_v2';
    }>) => Promise<SetupWriteResult | ContextDeleteResult>;
    createId: () => string;
}
export interface PreferenceView {
    ownerId: string | null;
    context: PersonalContextV2 | null;
    preferences: ConfirmedPreference[];
    loading: boolean;
    saving: boolean;
    error: string | null;
    pendingRemoval: string | null;
}
export function createPreferenceController(ports: PreferencePorts) {
    let epoch = 0, view: PreferenceView = { ownerId: null, context: null, preferences: [], loading: false, saving: false, error: null, pendingRemoval: null };
    let attempt: {
        signature: string;
        request: Exclude<PersonalContextV2Request, {
            operation: 'read_context_v2';
        }>;
    } | null = null;
    let removal: {id:string;request:Extract<PersonalContextV2Request,{operation:'delete_context_record'}>}|null=null;
    const listeners = new Set<() => void>(), emit = () => listeners.forEach(f => f());
    const current = (token: number, owner: string) => epoch === token && view.ownerId === owner && ports.owner() === owner;
    return {
        getState: () => view, subscribe(f: () => void) { listeners.add(f); return () => { listeners.delete(f); }; },
        setOwner(ownerId: string | null) { if (view.ownerId === ownerId)
            return; epoch++; attempt = null; removal=null; view = { ownerId, context: null, preferences: [], loading: false, saving: false, error: null, pendingRemoval: null }; emit(); },
        async load() { const owner = view.ownerId; if (!owner || ports.owner() !== owner || removal)
            return false; const token = epoch; view = { ...view, loading: true, error: null, pendingRemoval: null }; emit(); try {
            const context = await ports.read(owner);
            if (!current(token, owner))
                return false;
            if (context.ownerId !== owner)
                throw Error('Owner changed');
            view = { ...view, context, preferences: context.preferences.map(p => p.data), loading: false };
            emit();
            return true;
        }
        catch {
            if (current(token, owner)) {
                view = { ...view, loading: false, error: 'Confirmed preferences could not be loaded. Your draft remains here.' };
                emit();
            }
            return false;
        } },
        update(preferences: ConfirmedPreference[]) { if (view.saving || !view.ownerId || ports.owner() !== view.ownerId)
            return; view = { ...view, preferences: preferences.filter(p => p.id !== removal?.id), error: null }; attempt = null; emit(); },
        async save() {
            const owner = view.ownerId, c = view.context;
            if (!owner || !c || view.saving || ports.owner() !== owner)
                return false;
            if(removal){view={...view,error:'Retry the pending preference removal before saving other edits.'};emit();return false;}
            const token = epoch;
            try {
                const signature = canonicalJson([owner, c.revision, view.preferences]);
                if (attempt?.signature !== signature)
                    attempt = { signature, request: { operation: 'save_setup', requestId: ports.createId(), baseContextRevision: c.revision, setup: preferenceSetup(c, view.preferences) } };
                view = { ...view, saving: true, error: null, pendingRemoval: null };
                emit();
                await ports.write(owner, attempt.request);
                if (!current(token, owner))
                    return false;
                view = { ...view, saving: false };
                emit();
                return true;
            }
            catch (error) {
                if (current(token, owner)) {
                    view = { ...view, saving: false, error: (error as {
                            code?: string;
                        }).code === 'STALE_CONTEXT' ? 'Your saved context changed. Your draft remains here. Reopen the latest context before saving.' : error instanceof Error && error.message.startsWith('This context') || error instanceof Error && error.message.startsWith('Your history') ? error.message : 'Preferences were not saved. Your draft remains here; try again.' };
                    emit();
                }
                return false;
            }
        },
        async remove(id: string) {
            const owner=view.ownerId,c=view.context;
            if(!owner||!c||view.saving||ports.owner()!==owner)return false;
            if(removal&&removal.id!==id){view={...view,error:'Retry the pending preference removal first.'};emit();return false;}
            if(!removal&&!c.preferences.some(p=>p.data.id===id)){view={...view,preferences:view.preferences.filter(p=>p.id!==id)};emit();return true;}
            const token=epoch;
            if(!removal)removal={id,request:{operation:'delete_context_record',requestId:ports.createId(),baseContextRevision:c.revision,record:{kind:'preference',id}}};
            // Once deletion is confirmed by the person, private bytes leave local state.
            // Only opaque operation metadata is retained for an uncertain remote outcome.
            const request=removal.request;attempt=null;
            view={...view,context:{...c,preferences:c.preferences.filter(p=>p.data.id!==id)},preferences:view.preferences.filter(p=>p.id!==id),saving:true,error:null,pendingRemoval:id};emit();
            try{
                const receipt=await ports.write(owner,request);
                if(!current(token,owner))return false;
                removal=null;
                view={...view,context:{...view.context!,revision:receipt.contextRevision},pendingRemoval:null};emit();
            }catch{
                if(current(token,owner)){view={...view,saving:false,error:'Removal is pending. The preference is hidden here. Retry to confirm stored history was erased.'};emit();}
                return false;
            }
            try{
                const context=await ports.read(owner);
                if(!current(token,owner))return false;
                if(context.ownerId!==owner||context.preferences.some(p=>p.data.id===id))throw Error('Erasure read changed');
                view={...view,context,saving:false,error:null};emit();
            }catch{
                if(current(token,owner)){view={...view,saving:false,error:'Preference removed. Latest context could not be refreshed; your other entries remain here.'};emit();}
            }
            return current(token,owner);
        },
        close() { epoch++; attempt = null; removal=null; view = { ownerId: null, context: null, preferences: [], loading: false, saving: false, error: null, pendingRemoval: null }; emit(); },
    };
}
