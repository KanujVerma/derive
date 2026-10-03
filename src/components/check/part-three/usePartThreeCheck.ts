import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import {useNetworkState} from 'expo-network';
import type { PartTwoView } from '../../../presentation/part-two/controller';
import { createPartThreeController, type PartThreeView } from '../../../presentation/part-three/controller';
import { partThreeTarget, emptyPartThreeChoices, type PartThreeChoices } from '../../../presentation/part-three/target';
import { PART_THREE_ENABLED, partThreeTransport, loadPartThreeContext, partThreeEncounter, subscribePartThreeSession, loadPartThreeLabels } from '../../../services/partThree';
import type { PartThreeTransport } from '../../../services/partThreeClient';
import type { PersonalContextV2 } from '../../../contracts/PersonalContextV2';
import { PartThreeResponseSchema, type PartThreeResponse, type CandidateIdentity, type PartThreeEvaluateRequest } from '../../../contracts/PartThreeService';
import { createCatalogRequestId } from '../../../services/productCatalog';
import type { ContextProductReference } from '../../../contracts/PersonalContext';
import { canonicalJson } from '../../../domain/part-two/hash';
export interface PartThreePorts {
    transport: PartThreeTransport;
    context: (owner: string) => Promise<PersonalContextV2>;
    session: (owner: string, scan: string) => {
        ownerId: string;
        accountGeneration: number;
        encounterId: string;
    } | null;
    identity?: (request: PartThreeEvaluateRequest) => Promise<CandidateIdentity | null>;
    labels?: (owner: string, references: ContextProductReference[]) => Promise<Record<string,string>>;
    online?: () => boolean;
    createId?: () => string;
}
const livePorts: PartThreePorts = { transport: partThreeTransport, context: loadPartThreeContext, session: partThreeEncounter, labels: loadPartThreeLabels, identity: async request => {const response=await partThreeTransport.request({...request,operation:'identity'});if(response.kind!=='identity')throw Error('Identity changed');return response.identity;} };
type SavedBasis = Extract<PartThreeResponse, {
    kind: 'saved_basis';
}>;
type Historical = Extract<PartThreeResponse, {
    kind: 'historical';
}>;
const emptyView = (): PartThreeView => ({ target: null, result: null, question: null, historical: null, savedAssessmentId: null, savedAt: null, loading: false, saving: false, error: null });
export function usePartThreeCheck({ ownerId, details, enabled = PART_THREE_ENABLED, ports = livePorts, savedAssessmentId = null }: {
    ownerId: string | null;
    details: PartTwoView | null;
    enabled?: boolean;
    ports?: PartThreePorts;
    savedAssessmentId?: string | null;
}) {
    const network=useNetworkState(),networkUsable=network.isConnected===true&&network.isInternetReachable!==false,connected=networkUsable&&ports.online?.()!==false;
    const [view, setView] = useState<PartThreeView>(emptyView);
    const [context, setContext] = useState<PersonalContextV2 | null>(null);
    const [saved, setSaved] = useState<{
        scope: string;
        basis: SavedBasis;
        historical: Historical;
    } | null>(null);
    const [draft, setDraft] = useState<{
        scope: string;
        value: PartThreeChoices;
    } | null>(null);
    const [identity, setIdentity] = useState<{key:string;value:CandidateIdentity|null}|null>(null);
    const [labels, setLabels] = useState<{owner:string;revision:number;values:Record<string,string>}|null>(null);
    const [tick, setTick] = useState(0);
    const controller = useMemo(() => createPartThreeController(ports.transport, ports.createId ?? createCatalogRequestId, setView), [ports]);
    // A saved assessment has its own encounter and independently reauthorized pinned basis.
    const sessionScan = savedAssessmentId ?? details?.target?.scanId;
    const session = ownerId && sessionScan ? ports.session(ownerId, sessionScan) : null;
    const scope = canonicalJson([session?.ownerId, session?.accountGeneration, session?.encounterId, savedAssessmentId]);
    const safeSaved = saved?.scope === scope ? saved : null;
    const restored = safeSaved?.basis.request;
    const choices: PartThreeChoices = draft?.scope === scope ? draft.value : restored ? {
        intent: restored.intent, comparatorId: restored.comparatorId, candidateRoutineItemId: restored.candidateRoutineItemId,
        selectedManualReportIds: restored.selectedManualReportIds, use: restored.use,
    } : emptyPartThreeChoices();
    const source = savedAssessmentId ? safeSaved?.basis.partTwo : details?.result;
    const sourceKey = canonicalJson([scope,source?.bindingKey,source?.resultRevision,source?.generation,source?.evidenceRevision]);
    const authorizedIdentity = identity?.key===sourceKey ? identity : null;
    const canRead = enabled && Boolean(session && context?.ownerId === ownerId && source?.state === 'ready' && source.authenticatedOwnerId === ownerId) && connected && (!ports.identity || Boolean(authorizedIdentity));
    const generation = useRef({ key: '', value: 0 });
    const semanticKey = canonicalJson([scope, context?.revision, source?.bindingKey, source?.resultRevision, authorizedIdentity?.value, choices]);
    if (generation.current.key !== semanticKey)
        generation.current = { key: semanticKey, value: generation.current.value + 1 };
    const target = canRead && context && source && session ? partThreeTarget(context, source, { ...session, generation: generation.current.value }, choices, savedAssessmentId, authorizedIdentity?.value ?? null) : null;
    const targetKey = target ? canonicalJson(target) : null;
    const matches = view.target && target && canonicalJson(view.target) === targetKey;
    const current: PartThreeView = matches ? { ...view } : { ...emptyView(), error: view.target?.binding.ownerId === ownerId ? view.error : null };
    if (safeSaved && connected) {
        current.historical = safeSaved.historical;
        current.savedAssessmentId = savedAssessmentId;
        current.savedAt = safeSaved.historical.savedAt;
    }
    useEffect(() => subscribePartThreeSession(() => {
        controller.bind(null);
        setContext(null);
        setSaved(null);
        setDraft(null);
        setTick(t => t + 1);
    }), [controller]);
    useEffect(() => { setDraft(null); setContext(null); setSaved(null); setIdentity(null); setLabels(null); }, [scope]);
    useEffect(() => {
        let active = true, sequence = 0;
        const isCurrent = () => active && Boolean(ownerId && sessionScan) && canonicalJson(ports.session(ownerId!, sessionScan!)) === canonicalJson(session);
        const clear = () => { controller.setOnline(false); setContext(null); setSaved(null); setIdentity(null); setLabels(null); };
        const refresh = async () => {
            const request = ++sequence;
            if (!enabled || !ownerId || !session || !connected) {
                clear();
                return;
            }
            try {
                const [next, basisRaw, historicalRaw] = await Promise.all([
                    ports.context(ownerId),
                    savedAssessmentId ? ports.transport.request({ operation: 'saved_basis', savedAssessmentId }) : null,
                    savedAssessmentId ? ports.transport.request({ operation: 'read_saved', savedAssessmentId }) : null,
                ]);
                if (!isCurrent() || request !== sequence)
                    return;
                if (next.ownerId !== ownerId)
                    throw Error('Context owner changed');
                if (savedAssessmentId) {
                    const basis = PartThreeResponseSchema.parse(basisRaw), historical = PartThreeResponseSchema.parse(historicalRaw);
                    if (basis.kind !== 'saved_basis' || historical.kind !== 'historical' || historical.savedAssessmentId !== savedAssessmentId)
                        throw Error('Saved assessment changed');
                    const p = basis.partTwo, r = basis.request;
                    if (p && (p.authenticatedOwnerId !== ownerId || r&&(r.scanId !== p.scanId || r.captureSessionId !== p.captureSessionId || r.expectedPartOneGeneration !== p.generation || r.expectedPartOneRevision !== p.evidenceRevision)))
                        throw Error('Saved basis changed');
                    if (historical.assessmentWhenSaved && historical.assessmentWhenSaved.binding.ownerId !== ownerId)
                        throw Error('Saved owner changed');
                    setSaved(previous => previous?.scope === scope && canonicalJson(previous.basis) === canonicalJson(basis) && canonicalJson(previous.historical) === canonicalJson(historical) ? previous : { scope, basis, historical });
                }
                const identitySource=savedAssessmentId?(PartThreeResponseSchema.parse(basisRaw).kind==='saved_basis'?(basisRaw as SavedBasis).partTwo:null):source;
                if(ports.identity&&identitySource?.state==='ready'){
                    const identityTarget=partThreeTarget(next,identitySource,{...session!,generation:0},emptyPartThreeChoices(),savedAssessmentId);
                    if(!identityTarget)throw Error('Identity basis changed');
                    const value=await ports.identity({...identityTarget.request,operation:'evaluate',requestId:(ports.createId??createCatalogRequestId)()});
                    if(!isCurrent()||request!==sequence)return;
                    const resolvedKey=canonicalJson([scope,identitySource.bindingKey,identitySource.resultRevision,identitySource.generation,identitySource.evidenceRevision]);
                    setIdentity(previous=>previous?.key===resolvedKey&&canonicalJson(previous.value)===canonicalJson(value)?previous:{key:resolvedKey,value});
                }
                // Optional display labels cannot delay the immediate judgment.
                if(ports.labels)void ports.labels(ownerId,[...(next.routine?.data.items.map(i=>i.reference)??[]),...next.experiences.map(e=>e.data.reference)]).then(values=>{if(isCurrent()&&request===sequence)setLabels({owner:ownerId,revision:next.revision,values});}).catch(()=>{if(isCurrent()&&request===sequence)setLabels(null);});
                controller.setOnline(true);
                setContext(previous => previous?.revision === next.revision && canonicalJson(previous) === canonicalJson(next) ? previous : next);
            }
            catch {
                if (isCurrent() && request === sequence)
                    clear();
            }
        };
        void refresh().then(() => controller.renew());
        const timer = setInterval(() => { controller.expire(); void refresh(); void controller.renew(); }, 10000);
        const listener = AppState.addEventListener('change', state => { sequence++; controller.invalidate(); setSaved(null); setLabels(null); if (state === 'active')
            void refresh().then(() => controller.renew()); });
        const offline = () => { sequence++; clear(); }, online = () => void refresh();
        if (typeof globalThis.addEventListener === 'function') {
            globalThis.addEventListener('offline', offline);
            globalThis.addEventListener('online', online);
        }
        return () => { active = false; sequence++; clearInterval(timer); listener.remove(); if (typeof globalThis.removeEventListener === 'function') {
            globalThis.removeEventListener('offline', offline);
            globalThis.removeEventListener('online', online);
        } };
    }, [enabled, ownerId, scope, ports, controller, tick, connected, sourceKey]);
    useEffect(() => { controller.bind(target); if (target)
        void controller.evaluate(); return () => controller.close(); }, [controller, targetKey]);
    useEffect(() => { const until = current.result?.validUntil; if (!until)
        return; const timer = setTimeout(() => controller.expire(), Math.max(1, Date.parse(until) - Date.now())); return () => clearTimeout(timer); }, [controller, current.result?.validUntil]);
    const update = (next: PartThreeChoices) => { controller.questionEvent('interact'); controller.invalidate(); setDraft({ scope, value: next }); };
    return {
        displayLabels: labels?.owner===ownerId&&labels.revision===context?.revision?labels.values:{},
        view: current, context: canRead ? context : null, choices, update,
        questionAnswer: (answer: 'add' | 'replace' | 'unsure') => { controller.questionEvent('answer'); controller.invalidate(); setDraft({ scope, value: { ...choices, intent: answer } }); },
        questionSkip: () => controller.questionEvent('skip'), interact: () => controller.questionEvent('interact'), exposeQuestion: (questionId:string) => controller.exposeQuestion(questionId), save: () => controller.save(),
        refresh: () => { controller.allowOptionalRefresh();controller.invalidate(); setSaved(null); setTick(t => t + 1); }, enabled,
    };
}
