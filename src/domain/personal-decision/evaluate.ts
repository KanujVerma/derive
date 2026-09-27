import { validatePersonalDecisionPacket } from '../../contracts/PersonalDecision.ts';
import type { DecisionBinding, DecisionKnowledge, DecisionEvidence, EvidenceNeedCode, Finding, FindingDisplayFacts, PersonalDecisionPacketV1, P0BProductEvaluationProjectionV1 } from '../../contracts/PersonalDecision.ts';
import type { Goal } from '../../types/schema.ts';
type Answer = 'yes' | 'no' | 'unknown' | 'withheld';
interface Revision {
    ownerId: string;
    revision: string;
}
export interface EvaluationInput {
    packetId: string;
    binding: DecisionBinding;
    product: P0BProductEvaluationProjectionV1;
    evaluatedAt: string;
    intent: 'add' | 'replace' | 'check_current' | 'unanswered' | 'withheld';
    profile: (Revision & {
        primaryGoal: Goal | null;
        secondaryGoals: Goal[];
        skinBehavior: string;
        reactivity: string;
        sensitivities: {state:'reported'|'none_known'|'unknown'|'withheld';values:string[]};
        treatments: {state:'reported'|'none'|'unknown'|'withheld';values:string[]};
        pregnancy: Answer;
        nursing: Answer;
        tryingToConceive: Answer;
    }) | null;
    routine: (Revision & {
        completeness: 'complete' | 'partial' | 'unknown';
        sources: Array<{
            id: string;
            revision: string;
        }>;
        items: Array<{
            id: string;
            productId: string | null;
            variantId: string | null;
            formulaVersionId: string | null;
            category: DecisionKnowledge<string>;
            ingredients: DecisionKnowledge<string[]>;
            state: 'current' | 'paused' | 'stopped' | 'occasional';
            timing: 'am' | 'pm' | 'both' | 'unknown';
            frequency: 'daily' | 'few_times_weekly' | 'weekly' | 'occasional' | 'unknown';
        }>;
    }) | null;
    history: (Revision & {
        events: Array<{
            id: string;
            productId: string;
            variantId: string | null;
            formulaVersionId: string | null;
            outcome: 'reaction' | 'tolerated' | 'no_report' | 'ineffective';
        }>;
    }) | null;
}
export const RULE_REGISTRY = {
    identity: ['exact_identity', '1'], formula: ['verified_formula', '1'], profile: ['profile_context', '1'],
    sensitivity: ['s2_exact_sensitivity', '1'], reproductive: ['s2_retinoid_reproductive', '1'],
    overlap: ['s2_treatment_overlap', '1'], reactive: ['s2_reactive_active', '1'],
    reaction: ['s2_same_product_reaction', '1'], role: ['s2_moisturizer_dryness_role', '1'],
    routine: ['p0b_practical_role_relation', '1'], history: ['p0b_formula_experience', '1'], unsupported: ['supported_rule', '1'],
} as const;
export const RULE_SOURCES = {
    reviewedS2: { revision: '45f1773e4983c3c28848839c65640b7681b89d8e', path: 'supabase/functions/free-personal-fit/fit.ts', limitation: 'Port of bounded reviewed S2 meanings; not new scientific validation.' },
    reproductive: { url: 'https://www.aad.org/public/everyday-care/skin-care-secrets/routine/pregnancy-skin-care', applicability: 'Retinoid pregnancy/nursing caution only; trying-to-conceive requires review.' },
    practical: { basis: 'Owner-reported current routine role and explicit decision intent', limitation: 'No efficacy or tolerance comparison.' },
} as const;
export const ENGINE_VERSION = 'p0b-findings/5';
export const POLICY_VERSION = 'p0b-policy/3';
/** Consequence precedence, not a numerical compatibility score. */
export const CAUTION_PRECEDENCE: Finding['kind'][] = ['reproductive_context_caution', 'prior_product_reaction', 'routine_experience_caution', 'active_overlap', 'reported_ingredient_sensitivity', 'reactive_active'];
const SUPPORTED_ROLES = new Set(['moisturizer','cleanser','sunscreen','serum','treatment']);
const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');
const contains = (ingredients: string[], token: string) => ingredients.some(i => new RegExp(`(^|[^a-z])${token}(?=$|[^a-z])`).test(i));
/** Trusted typed boundary. Host establishes ownership, truth provenance and expected revisions. */
export function evaluatePersonalDecision(input: EvaluationInput): PersonalDecisionPacketV1 {
    const { binding: b, product: p } = input;
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.packetId))throw new Error('Invalid packet identifier');
    if (p.snapshotId !== b.productSnapshotId || p.snapshotRevision !== b.productSnapshotRevision || p.sourceBoundaryRevision !== b.sourceBoundaryRevision)
        throw new Error('Product binding mismatch');
    for (const section of ['profile', 'routine', 'history'] as const) {
        const context = input[section];
        if ((!context && b[`${section}Revision`] !== null) || (context && (b[`${section}Revision`] === null || context.ownerId !== b.ownerId || context.revision !== b[`${section}Revision`])))
            throw new Error('Context binding mismatch');
    }
    const identity = p.identity.state === 'known' ? p.identity.value : null;
    const formula = p.formula.state === 'known' ? p.formula.value : null;
    if ((identity?.productId ?? null) !== b.productId || (identity?.variantId ?? null) !== b.variantId || (formula?.formulaVersionId ?? null) !== b.formulaVersionId)
        throw new Error('Identity/formula binding mismatch');
    const packet: PersonalDecisionPacketV1 = { schemaVersion: 'personal-decision/v1', id:input.packetId, evaluatedAt: input.evaluatedAt, binding: { ...b }, versions: { engine: ENGINE_VERSION, policy: POLICY_VERSION, projection: p.schemaVersion }, findings: [], routineImpacts: [], evidenceNeeds: [], action: { kind: 'NOT_ENOUGH_INFORMATION', findingIds: [], primaryFindingId: '', nextStep: 'add_context' } };
    const context = (section: 'profile' | 'routine' | 'history', id: string): DecisionEvidence => ({ kind: 'context_fact', section, ownerId: b.ownerId, revision: b[`${section}Revision`]!, recordId: id });
    const facts = (scope: 'identity' | 'formula' | 'category'): DecisionEvidence[] => {
        const knowledge = p[scope];
        if (!identity || knowledge.state !== 'known' || (scope === 'formula' && !identity.variantId))
            return [];
        return knowledge.sourceIds.map(id => {
            const source = p.sources.find(s => s.id === id);
            if (!source)
                throw new Error('Missing accepted source');
            return { kind: 'product_fact', scope, snapshotRevision: p.snapshotRevision, sourceId: id, sourceRevision: source.revision, productId: identity.productId, variantId: identity.variantId, formulaVersionId: scope === 'formula' ? formula?.formulaVersionId ?? null : null };
        });
    };
    const add = (key: keyof typeof RULE_REGISTRY, kind: Finding['kind'], evidence: DecisionEvidence[], severity: Finding['severity'] = 'informational', display?: FindingDisplayFacts): Finding => {
        const reviewed: DecisionEvidence[] = ['reproductive', 'overlap', 'reactive', 'role'].includes(key) ? [{ kind: 'reviewed_claim', claimId: RULE_REGISTRY[key][0], claimRevision: RULE_REGISTRY[key][1], sourceId: 'derive:reviewed-s2', sourceRevision: RULE_SOURCES.reviewedS2.revision, applicability: 'applicable', limitations: [RULE_SOURCES.reviewedS2.limitation] }] : [];
        const f: Finding = { id: `${key}:${packet.findings.length}`, kind, applicability: 'applicable', severity, confidence: 'supported', ruleId: RULE_REGISTRY[key][0], ruleVersion: RULE_REGISTRY[key][1], evidence: [...evidence, ...reviewed], uncertainty: [], evidenceNeedIds: [], ...(display ? { display } : {}) };
        packet.findings.push(f);
        return f;
    };
    const gap = (code: EvidenceNeedCode, critical: boolean, related?: Finding, state: 'missing' | 'unknown' | 'withheld' | 'conflict' = 'unknown') => {
        const f = related ?? add('unsupported', 'missing_evidence', []);
        const existing=packet.evidenceNeeds.find(need=>need.code===code&&need.state===state&&need.critical===critical);
        const id=existing?.id??`need:${packet.evidenceNeeds.length}`;
        if(existing){if(!existing.findingIds.includes(f.id))existing.findingIds.push(f.id);}
        else packet.evidenceNeeds.push({id,code,state,critical,findingIds:[f.id]});
        if(!f.evidenceNeedIds.includes(id))f.evidenceNeedIds.push(id);
        if (!related) {
            f.confidence = 'unknown';
            f.applicability = 'uncertain';
            f.display = { kind: 'evidence_gap', code, evidenceIndexes: [] };
        }
    };
    if (!identity || !identity.variantId || !facts('identity').length)
        gap('exact_identity', true);
    const formulaFacts = facts('formula');
    const usable = !!identity && !!formula?.ingredients.length && !!formulaFacts.length;
    if (!usable)
        gap(p.formula.state === 'conflict' ? 'formula_conflict' : 'verified_formula', true, undefined, p.formula.state === 'conflict' ? 'conflict' : 'unknown');
    if (input.intent === 'unanswered' || input.intent === 'withheld')
        gap('profile_context', true, undefined, input.intent === 'withheld' ? 'withheld' : 'unknown');
    const profile = input.profile;
    if (!profile)
        gap('profile_context', true);
    const ingredients = usable ? formula!.ingredients.map(normalize) : [];
    const retinoid = ['retinol', 'retinal', 'retinaldehyde', 'retinyl', 'tretinoin', 'adapalene', 'tazarotene'].find(t => contains(ingredients, t));
    const exfoliant = ['glycolic acid', 'lactic acid', 'mandelic acid', 'salicylic acid'].find(t => contains(ingredients, t));
    const bp = contains(ingredients, 'benzoyl peroxide');
    const active = retinoid ?? exfoliant ?? (bp ? 'benzoyl peroxide' : null);
    const profileEvidence = profile ? [...formulaFacts, context('profile', 'profile')] : [];
    const ingredientDisplay = (ingredient: string, kind: 'reported_sensitivity' | 'reactivity' | 'treatment_overlap' | 'pregnancy' | 'nursing'): FindingDisplayFacts => ({ kind: 'ingredient_context', ingredient, context: kind, evidenceIndexes: profileEvidence.map((_, i) => i) });
    if (profile && !['reacts_easily', 'generally_tolerates'].includes(profile.reactivity))
        gap('profile_context', true, undefined, profile.reactivity === 'withheld' ? 'withheld' : 'unknown');
    if (profile && usable) {
        if (profile.sensitivities.state === 'unknown' || profile.sensitivities.state === 'withheld')
            gap('sensitivity_context', true,undefined,profile.sensitivities.state==='withheld'?'withheld':'unknown');
        else if (profile.sensitivities.values.length) {
            const exact = profile.sensitivities.values.filter(s => ingredients.includes(normalize(s)));
            for (const sensitivity of exact)
                gap('individual_tolerance', false, add('sensitivity', 'reported_ingredient_sensitivity', profileEvidence, 'caution', ingredientDisplay(normalize(sensitivity), 'reported_sensitivity')));
            if (exact.length < profile.sensitivities.values.length)
                gap('ingredient_alias_review', true);
        }
        if (retinoid) {
            const reproductiveGap=(code:'reproductive_context'|'reviewed_claim',state:'unknown'|'withheld')=>{const f=add('reproductive','missing_evidence',profileEvidence);f.applicability='uncertain';f.confidence='unknown';for(const evidence of f.evidence)if(evidence.kind==='reviewed_claim')evidence.applicability='uncertain';gap(code,true,f,state);f.display={kind:'evidence_gap',code,evidenceIndexes:f.evidence.map((_,index)=>index)};};
            for (const key of ['pregnancy', 'nursing'] as const) {
                if (profile[key] === 'yes')
                    gap('clinician_review', true, add('reproductive', 'reproductive_context_caution', profileEvidence, 'caution', ingredientDisplay(retinoid, key)));
                else if (profile[key] !== 'no')
                    reproductiveGap('reproductive_context',profile[key]==='withheld'?'withheld':'unknown');
            }
            if (profile.tryingToConceive !== 'no')
                reproductiveGap('reviewed_claim',profile.tryingToConceive==='withheld'?'withheld':'unknown');
        }
        if (active) {
            if (profile.treatments.state === 'unknown' || profile.treatments.state === 'withheld')
                gap('current_treatments', true,undefined,profile.treatments.state==='withheld'?'withheld':'unknown');
            else {
                const overlaps = [
                    retinoid && profile.treatments.values.includes('topical_retinoid') ? retinoid : null,
                    profile.treatments.values.includes('exfoliating_acid') ? retinoid ?? exfoliant : null,
                    bp && profile.treatments.values.includes('benzoyl_peroxide') ? 'benzoyl peroxide' : null,
                ].filter((term): term is string => !!term);
                for (const term of new Set(overlaps)) {
                    const f = add('overlap', 'active_overlap', profileEvidence, 'caution', ingredientDisplay(term, 'treatment_overlap'));
                    gap('application_schedule', false, f);
                    gap('individual_tolerance', false, f);
                }
            }
            if (profile.reactivity === 'reacts_easily')
                gap('individual_tolerance', false, add('reactive', 'reactive_active', profileEvidence, 'caution', ingredientDisplay(active, 'reactivity')));
        }
        if (profile.treatments.values.includes('other_prescription'))
            gap('current_treatments', true,undefined,profile.treatments.state==='withheld'?'withheld':'unknown');
        if ([profile.primaryGoal, ...profile.secondaryGoals].includes('dryness') && profile.skinBehavior === 'dry_tight' && p.category.state === 'known' && p.category.value === 'moisturizer' && facts('category').length && !active) {
            const evidence = [...formulaFacts, ...facts('category'), context('profile', 'profile')];
            const f = add('role', 'goal_role_match', evidence, 'informational', { kind: 'role_match', goal: 'dryness', category: 'moisturizer', evidenceIndexes: evidence.map((_, i) => i) });
            gap('individual_tolerance', false, f);
            if(profile.primaryGoal===null)gap('profile_context',true);
            else if(profile.primaryGoal!=='dryness')gap('supported_rule',true);
        }
    }
    const historyEvents=[...(input.history?.events??[])].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
    const historicalClass=(event:NonNullable<EvaluationInput['history']>['events'][number],variantId:string|null,formulaVersionId:string|null)=>!event.variantId||!event.formulaVersionId?'unknown':event.variantId===variantId&&event.formulaVersionId===formulaVersionId?'current':'old';
    const historyConclusions=new Map<string,Finding>();
    for (const event of historyEvents) {
        if (event.productId !== b.productId)
            continue;
        const evidence = [context('history', event.id)];
        if (event.outcome === 'reaction') {
            const key=`target:reaction:${historicalClass(event,b.variantId,b.formulaVersionId)}`;
            let f=historyConclusions.get(key);
            if(!f){f=add('reaction','prior_product_reaction',evidence,'caution',{kind:'prior_reaction',historyEventId:event.id,historicalFormulaVersionId:event.formulaVersionId,evidenceIndexes:[0]});f.uncertainty.push(`history_formula_class:${historicalClass(event,b.variantId,b.formulaVersionId)}`);historyConclusions.set(key,f);}
            gap('individual_tolerance', false, f);
            if (!event.formulaVersionId || !event.variantId)
                gap('exact_prior_formula', false, f);
        }
        if(event.formulaVersionId&&b.formulaVersionId&&(event.formulaVersionId!==b.formulaVersionId||(event.variantId!==null&&event.variantId!==b.variantId))){
            const key=`target:change:${historicalClass(event,b.variantId,b.formulaVersionId)}`;let f=historyConclusions.get(key);if(!f){f=add('history','formula_changed',[...formulaFacts,...evidence]);historyConclusions.set(key,f);}gap('current_formula_experience',false,f);
        }
    }
    const routine = input.routine;
    if (!routine || routine.completeness !== 'complete')
        gap('routine_completeness', input.intent !== 'check_current');
    type RoutineItem = NonNullable<EvaluationInput['routine']>['items'][number];
    const routineFacts = (item: RoutineItem, scope: 'category' | 'formula'): DecisionEvidence[] => {
        const knowledge = scope === 'category' ? item.category : item.ingredients;
        if (!routine || !item.productId || knowledge.state !== 'known' || (scope === 'formula' && (!item.variantId || !item.formulaVersionId)))
            return [];
        return knowledge.sourceIds.flatMap(id => {
            const source = routine.sources.find(s => s.id === id);
            return source ? [{ kind: 'routine_product_fact' as const, ownerId: b.ownerId, routineRevision: routine.revision, routineItemId: item.id, productId: item.productId!, variantId: item.variantId, formulaVersionId: item.formulaVersionId, scope, sourceId: id, sourceRevision: source.revision }] : [];
        });
    };
    if (routine && input.intent !== 'check_current' && routine.items.some(item => item.state === 'current' && !routineFacts(item, 'category').length))
        gap('routine_completeness', true);
    if (routine && p.category.state === 'known' && SUPPORTED_ROLES.has(p.category.value) && identity && facts('category').length) {
        const category = p.category.value;
        const matches = routine.items.filter(i => i.state === 'current' && i.category.state === 'known' && i.category.value === category && routineFacts(i, 'category').length);
        for (const item of matches) {
            const evidence = [...facts('category'), context('routine', item.id), ...routineFacts(item, 'category')];
            const kind = input.intent === 'replace' ? 'replacement_candidate' : 'role_redundancy';
            const f = add('routine', kind, evidence, 'informational', { kind: 'routine_relation', routineItemIds: [item.id], role: p.category.value, timing: item.timing, frequency: item.frequency, evidenceIndexes: evidence.map((_, i) => i) });
            packet.routineImpacts.push({ id: `impact:${item.id}`, kind: input.intent === 'replace' ? 'replacement_candidate' : 'duplicates_role', candidate: { productId: b.productId, variantId: b.variantId, formulaVersionId: b.formulaVersionId }, routineItemIds: [item.id], findingIds: [f.id], uncertainty: ['Role relation does not compare efficacy or tolerance.'] });
        }
    }
    if (routine) {
        for (const item of routine.items.filter(i => i.state === 'current'||i.state==='occasional')) {
            const evidence = [context('routine', item.id)];
            const currentFormulaFacts = routineFacts(item, 'formula');
            const knownIngredients = !!currentFormulaFacts.length;
            const isCurrentCandidate = item.productId === b.productId && item.variantId === b.variantId && item.formulaVersionId === b.formulaVersionId;
            if (active && knownIngredients && item.ingredients.state === 'known' && !(input.intent === 'check_current' && isCurrentCandidate)) {
                const current = item.ingredients.value.map(normalize);
                const currentRetinoid = ['retinol', 'retinal', 'retinaldehyde', 'retinyl', 'tretinoin', 'adapalene', 'tazarotene'].some(t => contains(current, t));
                const currentAcid = ['glycolic acid', 'lactic acid', 'mandelic acid', 'salicylic acid'].some(t => contains(current, t));
                const currentBP = contains(current, 'benzoyl peroxide');
                const overlaps = [
                    retinoid && currentRetinoid ? retinoid : null,
                    currentAcid ? retinoid ?? exfoliant : null,
                    bp && currentBP ? 'benzoyl peroxide' : null,
                ].filter((term): term is string => !!term);
                for (const term of new Set(overlaps)) {
                    const overlapEvidence = [...formulaFacts, ...evidence, ...currentFormulaFacts,...routineFacts(item,'category')];
                    const f = add('overlap', 'active_overlap', overlapEvidence, 'caution', {kind:'routine_relation',routineItemIds:[item.id],role:item.category.state==='known'&&SUPPORTED_ROLES.has(item.category.value)&&routineFacts(item,'category').length?item.category.value:'unknown',timing:item.timing,frequency:item.frequency,evidenceIndexes:overlapEvidence.map((_,i)=>i)});
                    gap('application_schedule', false, f);
                    gap('individual_tolerance', false, f);
                    packet.routineImpacts.push({ id: `overlap:${item.id}:${term}`, kind: 'active_overlap', candidate: { productId: b.productId, variantId: b.variantId, formulaVersionId: b.formulaVersionId }, routineItemIds: [item.id], findingIds: [f.id], uncertainty: [] });
                }
            }
            const material=item.productId===b.productId&&input.intent==='check_current'||packet.routineImpacts.some(impact=>impact.routineItemIds.includes(item.id));
            if(!material)continue;
            for (const event of historyEvents) {
                if (!item.productId || event.productId !== item.productId || (event.outcome !== 'reaction' && event.outcome !== 'ineffective'))
                    continue;
                const related = [...evidence, context('history', event.id)];
                const key=`routine:${item.id}:${event.outcome}:${historicalClass(event,item.variantId,item.formulaVersionId)}`;let f=historyConclusions.get(key);
                if(!f){f=add('history','routine_experience_caution',related,'caution',{kind:'routine_experience',routineItemIds:[item.id],historyEventId:event.id,outcome:event.outcome,evidenceIndexes:[0,1]});f.uncertainty.push(`history_formula_class:${historicalClass(event,item.variantId,item.formulaVersionId)}`);historyConclusions.set(key,f);}
                gap('current_formula_experience', true, f);
            }
        }
    }
    if (!packet.findings.length)
        gap('supported_rule', true);
    const caution = CAUTION_PRECEDENCE.map(kind => packet.findings.find(f => f.kind === kind && f.severity === 'caution')).find(f => f !== undefined);
    const critical = packet.evidenceNeeds.find(n => n.critical);
    const redundant = input.intent === 'add' ? packet.findings.find(f => f.kind === 'role_redundancy') : undefined;
    const role = packet.findings.find(f => f.kind === 'goal_role_match');
    const selected = caution ?? (critical ? packet.findings.find(f => critical.findingIds.includes(f.id)) : undefined) ?? redundant ?? role ?? packet.findings[0];
    const kind = caution ? 'USE_WITH_CAUTION' : critical ? 'NOT_ENOUGH_INFORMATION' : redundant ? 'KEEP_CURRENT' : role ? 'COULD_WORK' : 'NOT_ENOUGH_INFORMATION';
    const nextStep = kind === 'COULD_WORK' ? 'consider_use' : kind === 'KEEP_CURRENT' ? 'keep_current' : packet.evidenceNeeds.some(n => n.code === 'clinician_review') || (!!caution&&!!retinoid&&profile?.tryingToConceive==='yes') ? 'ask_clinician' : caution?.kind === 'routine_experience_caution' ? 'review_routine' : packet.evidenceNeeds.some(n => n.code === 'verified_formula' || n.code === 'formula_conflict' || n.code === 'exact_identity') ? 'confirm_formula' : !caution && (packet.evidenceNeeds.some(n=>n.critical&&n.code==='supported_rule') || (!!retinoid&&profile?.tryingToConceive==='yes')) ? 'view_product_facts' : caution?.kind === 'active_overlap' ? 'review_routine' : 'add_context';
    packet.action = { kind, findingIds: packet.findings.map(f => f.id), primaryFindingId: selected.id, nextStep };
    const issues = validatePersonalDecisionPacket(packet, b);
    if (issues.length)
        throw new Error(`Invalid evaluation packet: ${issues.join(',')}`);
    return packet;
}
