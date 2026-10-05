import { canonicalJson, sha256 } from '../part-two/hash.ts';
import { LOCAL_DICTIONARY_RELEASE } from '../part-two/dictionary.ts';
import { PART_THREE_RELEASE, PART_THREE_RELEASE_HASH } from './release.ts';
import { EligibleMenuSchema, JEV_PROTOCOL, type EligibleMenu, type NormalizedSelection } from './provider.ts';

function freeze<T>(value: T): T {
    if (value && typeof value === 'object') {
        for (const child of Object.values(value)) freeze(child);
        Object.freeze(value);
    }
    return value;
}
/** Proposed synthetic comparison contract, never an activation grant or evidence of utility.
 * Corpus/labels/rights/processing/spend gates remain unresolved. No runner calls a model. */
export const PART_THREE_EVALUATION = freeze({
    id: 'part-three-evaluation-proposal-v1', version: 1, status: 'proposed_local_synthetic',
    source: { release: PART_THREE_RELEASE.id, releaseHash: PART_THREE_RELEASE_HASH,
        dictionary: LOCAL_DICTIONARY_RELEASE.version, dictionaryHash: LOCAL_DICTIONARY_RELEASE.contentHash,
        rules: PART_THREE_RELEASE.rule, evidence: PART_THREE_RELEASE.evidence,
        questions: PART_THREE_RELEASE.question, templates: PART_THREE_RELEASE.template, policy: PART_THREE_RELEASE.policy },
    tasks: [
        { id: 'prioritize_tradeoff', definition: 'Select one eligible supported optional finding or abstain; retain judgment and every mandatory finding.', maxCandidates: 8 },
        { id: 'select_question', definition: 'Select one material eligible ordinary optional question or none before first exposure; preserve suppression.', maxCandidates: 4 },
    ],
    excludedTasks: ['headline_judgment', 'source_truth', 'clinical_winner', 'context_write', 'propose_preference'],
    corpus: { development: 80, holdout: 240, authored: 0, adjudicated: 0,
        developmentStrata: { evidencePrivacy: 27, practicalComparison: 27, optionalPriorities: 26 },
        holdoutStrata: { evidencePrivacy: 80, practicalComparison: 80, optionalPriorities: 80 },
        splitUnit: 'product_formula_family_and_context_pattern', authoring: 'independent_from_implementation_and_provider',
        labelsVersion: 'acceptable-vector-labels/v1', corpusHash: null, labelsHash: null, splitHash: null,
        labels: 'multiple_acceptable_vectors_and_required_abstentions', unblinding: 'after_manifest_and_artifact_hash_freeze' },
    candidates: { version: 'eligible-menu/v1', hash: 'sha256_canonical_json_closed_menu', mandatoryContentRankable: false,
        fairness: 'identical_admitted_projection_and_eligible_candidates', baselineRankTransmitted: false },
    provider: { interface: 'DecisionProvider', projection: PART_THREE_RELEASE.refinement.projection,
        prompt: PART_THREE_RELEASE.refinement.prompt, adapter: PART_THREE_RELEASE.refinement.adapter,
        implementation: 'jev', configuredModel: PART_THREE_RELEASE.refinement.configuredModel,
        modelApproval: 'pending_execution_specific_review', floatingModelAllowed: false,
        instructions: {
            prioritize_tradeoff: 'Select one useful supported optional tradeoff, or none. Do not decide the judgment.',
            select_question: 'Select one useful eligible optional question, or none. Do not infer new facts.',
        }, protocol: { ...JEV_PROTOCOL },
        tiePolicy: 'selected_probability_within_tie_epsilon_of_maximum; exact_host_ties_use_stable_semantic_id; gold_may_allow_multiple_ids' },
    scoring: { version: 'paired-acceptable-vector/v1', perJob: 'one_if_selected_id_is_in_any_gold_vector_else_zero',
        wholeVector: 'one_if_exact_pair_is_a_gold_vector_else_zero', failures: 'invalid_timeout_unavailable_disallowed_score_zero_in_attempt_denominator',
        validAbstention: 'score_only_when_gold_allows_null', hardViolationsAllowed: 0,
        auxiliary: ['false_reassurance', 'unnecessary_alarm', 'qualifier_retention', 'useful_coverage', 'abstention', 'question_burden', 'correction_effort'] },
    promotion: { minimumAbsoluteJobGain: 0.05, intervalConfidence: 0.95, intervalLowerBoundMustExceed: 0,
        interval: 'paired_stratified_bootstrap', bootstrapResamples: 10000, bootstrapSeed: 3102026,
        minimumPredeclaredSubset: 30, tuning: 'development_only; no_post_holdout_threshold_or_subset_search',
        localRecomputeP95Ms: 25, refinementP95Ms: 1200, validResponseTarget: 0.995,
        reliabilityClaimPermittedFrom240Cases: false },
    robustness: { version: 'semantic-menu-transform/v1', repeatsPerCase: 3,
        transforms: ['job_order', 'option_order', 'neutral_option_id_rename', 'reviewed_equivalent_wording', 'eligible_menu_membership'],
        consequentialFlipsAllowedWithoutReview: 0 },
    gates: { productReviewer: null, evidenceReviewer: null, privacyReviewer: null, engineeringReviewer: null,
        independentAuthor: null, independentAdjudicator: null, corpusRights: 'pending', retention: 'pending',
        processor: 'pending', artifacts: 'pending', payloadFields: 'pending', spendApproval: 'pending',
        approvedSpendMinorUnits: 0, credentialedCallsAllowed: false, realPersonProcessingAllowed: false,
        productionActivationAllowed: false },
    results: { liveEvaluationRuns: 0, outboundProviderCalls: 0, measuredUtility: null, measuredCost: null },
} as const);
export const PART_THREE_EVALUATION_HASH = sha256(canonicalJson(PART_THREE_EVALUATION));

export interface EvaluationLabels {
    /** Independently adjudicated, compatible semantic choices; null is explicit abstention. */
    acceptableVectors: Array<[string | null, string | null]>;
}
export function scoreEvaluationSelection(labels: EvaluationLabels, selection: NormalizedSelection) {
    if (!labels.acceptableVectors.length) throw Error('Evaluation requires adjudicated acceptable vectors');
    const trade = selection.selectedTradeoffId, question = selection.selectedQuestionId;
    const valid = selection.outcome === 'accepted' && (trade !== null || question !== null) ||
        selection.outcome === 'abstained' && trade === null && question === null;
    return {
        prioritizeTradeoff: Number(valid && labels.acceptableVectors.some(([t]) => t === trade)),
        selectQuestion: Number(valid && labels.acceptableVectors.some(([, q]) => q === question)),
        wholeVector: Number(valid && labels.acceptableVectors.some(([t, q]) => t === trade && q === question)),
        outcome: selection.outcome,
    };
}
export interface EvaluationMenuTransform { reverseJobs?: boolean; reverseOptions?: boolean; renameNeutralIds?: boolean }
/** Metamorphic replay only: no old authority is reused. Every transformed menu has
 * a new hash, explicit compatible pairs, and a job-specific semantic inverse. */
export function evaluationMenuVariant(value: EligibleMenu, transform: EvaluationMenuTransform) {
    const original = EligibleMenuSchema.parse(value);
    const semanticIds = [...new Set(original.jobs.flatMap(j => j.options.map(o => o.id)).filter(id => id !== 'none'))].sort();
    const replacements = new Map(semanticIds.map((id, index) => [id, transform.renameNeutralIds ? `neutral-${String(index).padStart(3, '0')}` : id]));
    const replace = (id: string | null) => id === null || id === 'none' ? id : replacements.get(id) ?? id;
    const jobs = original.jobs.map(j => ({ ...j, options: j.options.map(o => ({ ...o, id: replace(o.id)! })) }));
    if (transform.reverseOptions) for (const job of jobs) job.options.reverse();
    if (transform.reverseJobs) jobs.reverse();
    const base = { candidateSetId: `evaluation-menu:${sha256(canonicalJson([original.candidateSetHash, transform])).slice(0, 32)}`,
        jobs, compatiblePairs: original.compatiblePairs.map(([t, q]) => [replace(t), replace(q)] as [string | null, string | null]) };
    const menu = EligibleMenuSchema.parse({ ...base, candidateSetHash: sha256(canonicalJson(base)) });
    const restore = (job: EligibleMenu['jobs'][number]['id'], id: string | null) => {
        if (id === null) return null;
        const option = original.jobs.find(j => j.id === job)?.options.find(o => replace(o.id) === id);
        if (!option || option.id === 'none') throw Error('Selection does not belong to the transformed job');
        return option.id;
    };
    return { menu, restore(selection: NormalizedSelection): NormalizedSelection {
        return { ...selection, selectedTradeoffId: restore('prioritize_tradeoff', selection.selectedTradeoffId),
            selectedQuestionId: restore('select_question', selection.selectedQuestionId) };
    } };
}
