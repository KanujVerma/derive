import { PartThreeResponseSchema, type PartThreeResponse, type PartThreeRequest } from '../../contracts/PartThreeService.ts';
import type { PersonalResultV2, EligibleQuestion } from '../../contracts/PersonalResultV2.ts';
import {PART_THREE_RELEASE} from '../../domain/part-three/release.ts';
import { canonicalJson, sha256 } from '../../domain/part-two/hash.ts';
import type { PartThreeTransport } from '../../services/partThreeClient.ts';
import type { PartThreeTarget } from './target.ts';
import type { PartThreeSaveRecoveryPort, PendingSaveRequest, SaveRecoveryScope } from './saveRecovery.ts';
export function createQuestionLatchStore() { const rows = new Map<string, {
    id: string;
    suppressed: boolean;
}>(); return { get: (key: string) => rows.get(key), expose(key: string, id: string) { if (!rows.has(key))
        rows.set(key, { id, suppressed: false }); return rows.get(key)!; }, suppress(key: string) { const row = rows.get(key); if (row)
        row.suppressed = true;
    else
        rows.set(key, { id: '', suppressed: true }); }, clear() { rows.clear(); } }; }
export const partThreeQuestionLatches = createQuestionLatchStore();
export interface PartThreeView {
    target: PartThreeTarget | null;
    result: PersonalResultV2 | null;
    question: EligibleQuestion | null;
    historical: Extract<PartThreeResponse, {
        kind: 'historical';
    }> | null;
    savedAssessmentId: string | null;
    savedAt: string | null;
    loading: boolean;
    saving: boolean;
    error: string | null;
    pendingSave?: boolean;
}
const key = (t: PartThreeTarget) => canonicalJson(t), encounterKey = (t: PartThreeTarget) => canonicalJson([t.binding.ownerId, t.binding.accountGeneration, t.binding.encounterId]);
/** Every publication requires the full expected authority and live grant.
 * Optional durable recovery retains only exact Save request metadata. */
export function createPartThreeController(transport: PartThreeTransport, createId: () => string, changed: (v: PartThreeView) => void, now = Date.now, latches = partThreeQuestionLatches, recovery?: PartThreeSaveRecoveryPort) {
    let epoch = 0, online = true, view: PartThreeView = { target: null, result: null, question: null, historical: null, savedAssessmentId: null, savedAt: null, loading: false, saving: false, error: null };
    let flight: {
        promise: Promise<boolean>;
        abort: AbortController;
    } | null = null, last: PersonalResultV2 | null = null;
    let saveAttempt: { key: string; id: string } | null = null;
    // Uncertain transport outcomes retain the original owner-bound request.
    // Receipt replay is allowed after the current display lease expires.
    const pendingSaves = new Map<string, { scope: SaveRecoveryScope; ownerId: string; accountGeneration: number; request: PendingSaveRequest }>();
    const recoveryScope=(t:PartThreeTarget):SaveRecoveryScope=>({ownerId:t.binding.ownerId,accountGeneration:t.binding.accountGeneration,encounterId:t.binding.encounterId,scanId:t.binding.scanId,captureSessionId:t.binding.captureSessionId});
    const saveScope=(t:PartThreeTarget)=>canonicalJson([t.binding.ownerId,t.binding.accountGeneration,t.binding.encounterId,t.binding.scanId,t.binding.captureSessionId]);
    const pendingFor=(t:PartThreeTarget|null)=>t?pendingSaves.get(saveScope(t)):undefined;
    const pendingMessage='Save confirmation is pending. Retry the original Save to recover its confirmation.';
    let recoveredEpoch=-1, recoveryFlight:{token:number;target:string;promise:Promise<boolean>}|null=null;
    let interaction:{target:string;resultId:string;selectedTradeoffId:string|null}|null=null;
    const highest = new Map<string, {
        revision: number;
        content: string;
    }>();
    const emit = () => changed({ ...view });
    const cancel = () => { const f = flight; flight = null; f?.abort.abort(); };
    const active = (token: number, t: PartThreeTarget) => online && token === epoch && view.target !== null && key(t) === key(view.target);
    const hide = (message: string) => { view = { ...view, result: null, question: null, historical: null, loading: false, saving: false, error: message }; emit(); };
    async function recoverPendingSave(force=false):Promise<boolean> {
        const t=view.target,token=epoch;
        if(!t||!online)return false;
        if(!recovery)return true;
        if(recoveryFlight?.token===token&&recoveryFlight.target===key(t))return recoveryFlight.promise;
        if(!force&&recoveredEpoch===token)return true;
        const operation=(async()=>{
            try {
                const request=await recovery.recover(recoveryScope(t));
                if(!active(token,t))return false;
                if(request)pendingSaves.set(saveScope(t),{scope:recoveryScope(t),ownerId:t.binding.ownerId,accountGeneration:t.binding.accountGeneration,request});
                else pendingSaves.delete(saveScope(t));
                recoveredEpoch=token;
                view={...view,pendingSave:Boolean(request),error:request?pendingMessage:null,...(request?{result:null,question:null,historical:null}: {})};emit();
                return true;
            } catch {
                if(active(token,t))hide('Save recovery is unavailable. Try again before reviewing or saving this assessment.');
                return false;
            }
        })();
        const f={token,target:key(t),promise:operation};recoveryFlight=f;
        void operation.finally(()=>{if(recoveryFlight===f)recoveryFlight=null;});
        return operation;
    }
    async function event(t: PartThreeTarget, r: PersonalResultV2, q: string, kind: 'expose' | 'skip' | 'answer' | 'interact', token: number) { try {
        const raw = PartThreeResponseSchema.parse(await transport.request({ operation: 'question_event', encounterId: t.request.encounterId, resultId: r.resultId, questionId: q, expectedResultRevision:r.resultRevision, event: kind }));
        if (active(token, t) && raw.kind !== 'acknowledged')
            hide('Personal assessment changed. Refresh to review.');
    }
    catch {
        if (active(token, t))
            hide('Personal assessment unavailable. Your choices remain here.');
    } }
    function publish(raw: unknown, t: PartThreeTarget, requestId: string, token: number): boolean {
        const parsed = PartThreeResponseSchema.safeParse(raw);
        if (!parsed.success || !active(token, t))
            return false;
        if (parsed.data.kind !== 'result') {
            hide('Personal assessment unavailable. Product saving remains available.');
            return false;
        }
        const r = parsed.data.result, trace=r.refinementTrace, expected = { ...t.binding, attemptId: requestId, refinement:trace?{candidateSetHash:trace.menu.candidateSetHash,projectionVersion:PART_THREE_RELEASE.refinement.projection,promptVersion:PART_THREE_RELEASE.refinement.prompt,adapterVersion:PART_THREE_RELEASE.refinement.adapter,configuredModel:PART_THREE_RELEASE.refinement.configuredModel,resolvedModel:trace.selection.resolvedModel}:null };
        if (canonicalJson(r.binding) !== canonicalJson(expected) || r.generation !== t.request.generation || Date.parse(r.validUntil) <= now())
            return false;
        const serialized = canonicalJson(r), prior = highest.get(r.resultId);
        if (prior && (r.resultRevision < prior.revision || r.resultRevision === prior.revision && prior.content !== serialized))
            return false;
        highest.set(r.resultId, { revision: r.resultRevision, content: serialized });
        const exposed=latches.get(encounterKey(t));if(exposed&&!exposed.suppressed&&view.question&&r.refinementTrace?.applied&&r.question?.id!==view.question.id&&view.result&&canonicalJson(r.summary)===canonicalJson(view.result.summary)&&canonicalJson(r.findings)===canonicalJson(view.result.findings)){view={...view,loading:false};emit();return true;}
        if(interaction?.target===key(t)&&interaction.resultId===r.resultId&&r.refinementTrace?.applied&&r.selectedTradeoffId!==interaction.selectedTradeoffId&&view.result&&canonicalJson(r.summary)===canonicalJson(view.result.summary)&&canonicalJson(r.findings)===canonicalJson(view.result.findings)){view={...view,loading:false};emit();return true;}
        last = r;
        let question: EligibleQuestion | null = null;
        if (r.question) {
            const latch = latches.get(encounterKey(t));
            if (!latch || latch.id === r.question.id && !latch.suppressed)
                question = r.question;
        }
        view = { ...view, result: r, question, loading: false, error: null };
        emit();

        return true;
    }
    async function requestBound(request: PartThreeRequest, t: PartThreeTarget, requestId: string, token: number, signal: AbortSignal) {
        try {
            const response = await transport.request(request, signal);
            if(response.kind==='result'&&response.result.refinementTrace&&request.operation!=='read'){const receipt=PartThreeResponseSchema.parse(await transport.request({operation:'read',resultId:response.result.resultId},signal));if(receipt.kind!=='result'||canonicalJson(receipt.result)!==canonicalJson(response.result))throw Error('Refinement authority changed');}
            if (signal.aborted || !publish(response, t, requestId, token)) {
                if (active(token, t))
                    hide('Personal assessment changed. Refresh to review.');
                return false;
            }
            return true;
        }
        catch {
            if (active(token, t))
                hide('Personal assessment unavailable. Your choices remain here.');
            return false;
        }
    }
    async function run(read: boolean): Promise<boolean> {
        const t = view.target;
        const token=epoch;
        if (!t || !online || recovery && !await recoverPendingSave() || !active(token,t) || pendingFor(t))
            return false;
        if (flight)
            return flight.promise;
        const requestId = read && last ? last.binding.attemptId : createId();
        const request: PartThreeRequest = read && last ? { operation: 'read', resultId: last.resultId } : { operation: 'evaluate', requestId, ...t.request };
        const abort = new AbortController();
        let finish!: (v: boolean) => void;
        const f = { promise: new Promise<boolean>(resolve => { finish = resolve; }), abort };
        flight = f;
        view = { ...view, loading: true, error: null };
        emit();
        const timeout = setTimeout(() => abort.abort(), 15000);
        const stopped = new Promise<boolean>(resolve => abort.signal.addEventListener('abort', () => resolve(false), { once: true }));
        void Promise.race([requestBound(request, t, requestId, token, abort.signal), stopped]).then(value => { clearTimeout(timeout); if (flight === f) {
            flight = null;
            if (!value && active(token, t) && view.loading)
                hide('Personal assessment unavailable.');
        } finish(value); });
        return f.promise;
    }
    return {
        getView: () => ({ ...view }),
        bind(t: PartThreeTarget | null) { if (t && view.target && key(t) === key(view.target))
            return; const old = view.target; if (old && t && (old.binding.ownerId !== t.binding.ownerId || old.binding.accountGeneration !== t.binding.accountGeneration))
            latches.clear(); if(t)for(const [scope,pending] of pendingSaves)if(t.binding.ownerId!==pending.ownerId||t.binding.accountGeneration!==pending.accountGeneration)pendingSaves.delete(scope); if (t?.request.savedAssessmentId)
            latches.suppress(encounterKey(t)); epoch++; cancel(); last = null; interaction=null;saveAttempt = null; highest.clear(); view = { target: t, result: null, question: null, historical: null, savedAssessmentId: null, savedAt: null, loading: false, saving: false, error: pendingFor(t) ? 'Save confirmation is pending. Retry the original Save to recover its confirmation.' : null, pendingSave: Boolean(pendingFor(t)) }; emit(); },
        evaluate: () => run(false), renew: () => run(true), recoverPendingSave: () => recoverPendingSave(),
        // The mounted UI calls this only after native visibility or an actual
        // accessibility announcement. Receiving a packet is not exposure.
        exposeQuestion(expectedQuestionId?:string) { const t=view.target,r=view.result,q=view.question;if(!t||!r||!q||!online||expectedQuestionId!==undefined&&expectedQuestionId!==q.id)return null;const prior=latches.get(encounterKey(t));const latch=latches.expose(encounterKey(t),q.id);if(latch.suppressed||latch.id!==q.id)return null;if(!prior)void event(t,r,q.id,'expose',epoch);return q; },
        questionEvent(kind: 'skip' | 'answer' | 'interact') {
            const t = view.target, r = view.result, q = view.question;
            if (!t) return;
            if (kind === 'interact' && r && interaction?.target === key(t) && interaction.resultId === r.resultId && interaction.selectedTradeoffId === r.selectedTradeoffId) return;
            if (r) interaction = {target:key(t),resultId:r.resultId,selectedTradeoffId:r.selectedTradeoffId};
            // Touch freezes optional selection. It does not answer or dismiss
            // an exposed question; only an explicit answer/skip does that.
            if (kind !== 'interact') { latches.suppress(encounterKey(t)); view = {...view,question:null}; emit(); }
            if (r && (q || kind === 'interact')) void event(t,r,q?.id ?? 'encounter:interaction',kind,epoch);
        },
        setOnline(value: boolean) { online = value; if (!value) {
            epoch++;
            cancel();
            hide('Offline · Current personal assessment unavailable');
        } },
        // An explicit refresh requests a new assessment from the current bound
        // basis. A refused/expired receipt must not become an endless read loop.
        // invalidate still owns epoch cancellation; pending Save recovery is retained.
        allowOptionalRefresh(){interaction=null;last=null;},
        suspend() { epoch++; cancel(); if (view.result && Date.parse(view.result.validUntil) <= now()) { last=null; hide('Personal assessment expired. Refresh to review.'); } else { view={...view,loading:false};emit(); } },
        invalidate() { epoch++; cancel(); hide('Checking current personal assessment'); },
        expire() { if (view.result && Date.parse(view.result.validUntil) <= now()) {
            epoch++;
            cancel();
            last = null;
            hide('Personal assessment expired. Refresh to review.');
        } },
        clearPendingSave():Promise<void> {
            const accounts=new Map<string,{ownerId:string;accountGeneration:number}>();
            for(const pending of pendingSaves.values())accounts.set(canonicalJson([pending.ownerId,pending.accountGeneration]),pending);
            if(view.target){const {ownerId,accountGeneration}=view.target.binding;accounts.set(canonicalJson([ownerId,accountGeneration]),{ownerId,accountGeneration});}
            epoch++;cancel();pendingSaves.clear();saveAttempt=null;view={...view,result:null,question:null,historical:null,saving:false,pendingSave:false};emit();
            return recovery?Promise.all([...accounts.values()].map(account=>recovery.retireOwner(account.ownerId,account.accountGeneration))).then(()=>undefined):Promise.resolve();
        },
        async save(): Promise<string | null> {
            const t=view.target, r=view.result;
            if (!t || !online || view.saving) return null;
            const token=epoch;
            view={...view,saving:true,error:null}; emit();
            try {
                if(!await recoverPendingSave(true)||!active(token,t))return null;
                if(!pendingFor(t)&&(!r||!['ready','unavailable','blocked'].includes(r.state))){view={...view,saving:false};emit();return null;}
                if(!pendingFor(t)) {
                    const read=await transport.request({operation:'read',resultId:r!.resultId});
                    if(read.kind!=='result'||canonicalJson(read.result)!==canonicalJson(r)) throw Error('Displayed assessment revision changed');
                    if(!active(token,t)||!publish(read,t,r!.binding.attemptId,token)||canonicalJson(view.result)!==canonicalJson(r)) throw Error('Changed basis');
                    const bindingHash=sha256(canonicalJson(r!.binding)),packetHash=sha256(canonicalJson(r)),attemptKey=canonicalJson([r!.resultId,r!.resultRevision,bindingHash,packetHash]);
                    if(saveAttempt?.key!==attemptKey)saveAttempt={key:attemptKey,id:createId()};
                    pendingSaves.set(saveScope(t),{scope:recoveryScope(t),ownerId:t.binding.ownerId,accountGeneration:t.binding.accountGeneration,request:{operation:'save',requestId:saveAttempt.id,resultId:r!.resultId,expectedResultRevision:r!.resultRevision,expectedBindingHash:bindingHash,expectedPacketHash:packetHash}});
                    view={...view,pendingSave:true};
                }
                const attempt=pendingFor(t)!;
                await recovery?.retain(attempt.scope,attempt.request);
                if(!active(token,t))return null;
                const rawSaved=await transport.request(attempt.request);
                const saved=PartThreeResponseSchema.parse(rawSaved);
                if(saved.kind!=='saved') {
                    // Only the explicit refusal contract is a definitive outcome.
                    // A valid response for another operation remains uncertain.
                    if(saved.kind==='unavailable'){await recovery?.complete(attempt.scope,attempt.request);pendingSaves.delete(saveScope(t));if(active(token,t))view={...view,pendingSave:false};}
                    throw Error('Save was not confirmed');
                }
                if(saved.resultRevision!==attempt.request.expectedResultRevision)throw Error('Unexpected save receipt');
                await recovery?.complete(attempt.scope,attempt.request);
                pendingSaves.delete(saveScope(t));
                if(!active(token,t))return null;
                view={...view,savedAssessmentId:saved.savedAssessmentId,saving:false,pendingSave:false,error:null};emit();return saved.savedAssessmentId;
            } catch {
                if(active(token,t)) {
                    if(pendingFor(t)) { view={...view,saving:false,pendingSave:true,error:pendingMessage};emit(); }
                    else hide('Save confirmation is unavailable from this result. Review the current result.');
                }
                return null;
            }
        },
        async readSaved(id: string): Promise<boolean> { const t = view.target; if (!t || !online)
            return false; const token = epoch; try {
            const response = PartThreeResponseSchema.parse(await transport.request({ operation: 'read_saved', savedAssessmentId: id }));
            if (!active(token, t))
                return false;
            if (response.kind !== 'historical' || response.savedAssessmentId !== id || response.assessmentWhenSaved?.binding.ownerId && response.assessmentWhenSaved.binding.ownerId !== t.binding.ownerId)
                throw Error('Changed saved assessment');
            view = { ...view, historical: response, savedAssessmentId: id, savedAt: response.savedAt, error: null };
            emit();
            return true;
        }
        catch {
            if (active(token, t))
                hide('Saved assessment unavailable. Current assessment unavailable.');
            return false;
        } },
        close() { if(view.target&&online&&(flight||last)){const encounterId=view.target.request.encounterId;void transport.request({operation:'cancel_encounter',encounterId}).catch(()=>undefined);}
        if (view.target && latches.get(encounterKey(view.target)))
            latches.suppress(encounterKey(view.target)); epoch++; cancel(); last = null; interaction=null;highest.clear(); saveAttempt = null; view = { target: null, result: null, question: null, historical: null, savedAssessmentId: null, savedAt: null, loading: false, saving: false, error: null, pendingSave:false }; emit(); },
    };
}
