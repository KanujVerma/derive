import assert from 'node:assert/strict';
import { evaluatePersonalDecision, RULE_REGISTRY } from '../src/domain/personal-decision/evaluate.ts';
import { validatePersonalDecisionPacket } from '../src/contracts/PersonalDecision.ts';
import { input } from './fixtures/p0b/policy.ts';
import type { EvaluationInput } from '../src/domain/personal-decision/evaluate.ts';
let passed = 0;
function test(name: string, run: () => void) { run(); passed++; console.log(`PASS ${name}`); }
function evaluate(change: (i: EvaluationInput) => void = () => { }) { const i = input(); change(i); const p = evaluatePersonalDecision(i); assert.deepEqual(validatePersonalDecisionPacket(p, i.binding), []); return p; }
function formula(i: EvaluationInput, ingredients: string[]) {
    assert.equal(i.product.formula.state, 'known');
    if (i.product.formula.state === 'known')
        i.product.formula.value.ingredients = ingredients;
}
function routine(i: EvaluationInput) { i.routine!.items = [{ id: 'moisturizer-1', productId: 'existing', variantId: 'existing-variant', formulaVersionId: 'existing-formula', category: { state: 'known', value: 'moisturizer', sourceIds: ['routine-label'] }, ingredients: { state: 'known', value: ['water'], sourceIds: ['routine-label'] }, state: 'current', timing: 'pm', frequency: 'few_times_weekly' }]; }
function reaction(i: EvaluationInput) { i.history!.events = [{ id: 'reaction-1', productId: 'product', variantId: null, formulaVersionId: null, outcome: 'reaction' }]; }
test('narrow supported dryness role fits without claiming efficacy or tolerance', () => { const p = evaluate(); assert.equal(p.action.kind, 'COULD_WORK'); assert(p.evidenceNeeds.some(n => n.code === 'individual_tolerance')); });
test('all four supported cautions survive alongside reproductive unknown', () => {
    const p = evaluate(i => { formula(i, ['retinyl propionate', 'glycerin']); i.profile!.sensitivities = {state:'reported',values:['glycerin']}; i.profile!.reactivity = 'reacts_easily'; i.profile!.treatments = {state:'reported',values:['topical_retinoid']}; i.profile!.pregnancy = 'unknown'; reaction(i); });
    assert.equal(p.action.kind, 'USE_WITH_CAUTION');
    for (const kind of ['active_overlap', 'reported_ingredient_sensitivity', 'reactive_active', 'prior_product_reaction'])
        assert(p.findings.some(f => f.kind === kind));
    assert(p.evidenceNeeds.some(n => n.code === 'reproductive_context' && n.critical));
});
test('prior reaction survives missing profile and formula without diagnosing ingredient causation', () => { const p = evaluate(i => { i.profile = null; i.binding.profileRevision = null; i.product.formula = { state: 'unknown', reason: 'missing' }; i.binding.formulaVersionId = null; reaction(i); }); assert.equal(p.action.kind, 'USE_WITH_CAUTION'); assert(p.findings.some(f => f.kind === 'prior_product_reaction')); assert.equal(p.action.nextStep, 'confirm_formula'); });
test('add redundancy retains goal match and returns keep current', () => { const p = evaluate(routine); assert.equal(p.action.kind, 'KEEP_CURRENT'); assert(p.findings.some(f => f.kind === 'goal_role_match')); assert.equal(p.routineImpacts[0].kind, 'duplicates_role'); assert.equal(p.findings.find(f => f.kind === 'role_redundancy')!.display!.kind, 'routine_relation'); });
test('explicit replace produces candidate without efficacy claim', () => { const p = evaluate(i => { routine(i); i.intent = 'replace'; }); assert.equal(p.action.kind, 'COULD_WORK'); assert.equal(p.routineImpacts[0].kind, 'replacement_candidate'); });
test('partial routine never implies absence and stops a positive add action', () => { const p = evaluate(i => { i.routine!.completeness = 'partial'; }); assert.equal(p.action.kind, 'NOT_ENOUGH_INFORMATION'); assert(p.evidenceNeeds.some(n => n.code === 'routine_completeness' && n.critical)); });
test('known role redundancy remains visible with partial routine', () => { const p = evaluate(i => { routine(i); i.routine!.completeness = 'partial'; }); assert.equal(p.action.kind, 'NOT_ENOUGH_INFORMATION'); assert.equal(p.routineImpacts[0].kind, 'duplicates_role'); });
test('paused stopped and occasional items are not promoted to current redundancy', () => {
    for (const state of ['paused', 'stopped', 'occasional'] as const) {
        const p = evaluate(i => { routine(i); i.routine!.items[0].state = state; });
        assert.equal(p.action.kind, 'COULD_WORK');
        assert.equal(p.routineImpacts.length, 0);
    }
});
test('formula conflict blocks role fit and chooses confirm formula', () => { const p = evaluate(i => { i.product.formula = { state: 'conflict', sourceIds: ['label'], reason: 'conflict' }; i.binding.formulaVersionId = null; }); assert.equal(p.action.kind, 'NOT_ENOUGH_INFORMATION'); assert.equal(p.action.nextStep, 'confirm_formula'); assert(p.evidenceNeeds.some(n => n.code === 'formula_conflict')); });
test('unmatched sensitivity is unknown rather than negative or proven avoidance', () => { const p = evaluate(i => { i.profile!.sensitivities = {state:'reported',values:['fragrance']}; }); assert.equal(p.action.kind, 'NOT_ENOUGH_INFORMATION'); assert(p.evidenceNeeds.some(n => n.code === 'ingredient_alias_review' && n.critical)); assert(!p.findings.some(f => f.kind === 'reported_ingredient_sensitivity')); });
test('whole retinyl token covers unfamiliar esters without matching substring', () => { const caution = evaluate(i => { formula(i, ['retinyl newester']); i.profile!.nursing = 'yes'; }); assert.equal(caution.action.kind, 'USE_WITH_CAUTION'); assert.equal(caution.action.nextStep, 'ask_clinician'); const other = evaluate(i => { formula(i, ['notretinyl']); i.profile!.nursing = 'yes'; }); assert.equal(other.action.kind, 'COULD_WORK'); });
test('pregnancy and nursing are distinct while trying to conceive has no invented caution', () => { const p = evaluate(i => { formula(i, ['retinol']); i.profile!.tryingToConceive = 'yes'; }); assert.equal(p.action.kind, 'NOT_ENOUGH_INFORMATION'); assert(!p.findings.some(f => f.kind === 'reproductive_context_caution')); assert(p.evidenceNeeds.some(n => n.code === 'reviewed_claim')); });
test('withheld and unknown reproductive answers stay explicit', () => {
    for (const status of ['unknown', 'withheld'] as const) {
        const p = evaluate(i => { formula(i, ['retinol']); i.profile!.pregnancy = status; });
        assert.equal(p.action.kind, 'NOT_ENOUGH_INFORMATION');
        assert(p.evidenceNeeds.some(n => n.code === 'reproductive_context' && n.state === status));
    }
});
test('active treatment overlap does not erase sensitivity or reactive findings', () => { const p = evaluate(i => { formula(i, ['salicylic acid']); i.profile!.sensitivities = {state:'reported',values:['salicylic acid']}; i.profile!.treatments = {state:'reported',values:['exfoliating_acid']}; i.profile!.reactivity = 'reacts_easily'; }); assert.equal(p.action.kind, 'USE_WITH_CAUTION'); assert.equal(p.findings.filter(f => f.severity === 'caution').length, 3); });
test('unknown treatment context stops unsupported active action', () => { const p = evaluate(i => { formula(i, ['benzoyl peroxide']); i.profile!.treatments = {state:'unknown',values:[]}; }); assert.equal(p.action.kind, 'NOT_ENOUGH_INFORMATION'); assert(p.evidenceNeeds.some(n => n.code === 'current_treatments' && n.critical)); });
test('old formula tolerance cannot establish current tolerance', () => { const p = evaluate(i => { i.history!.events = [{ id: 'old', productId: 'product', variantId: 'variant', formulaVersionId: 'old-formula', outcome: 'tolerated' }]; }); assert(p.findings.some(f => f.kind === 'formula_changed')); assert(p.evidenceNeeds.some(n => n.code === 'current_formula_experience')); assert(p.evidenceNeeds.some(n => n.code === 'individual_tolerance')); assert(!p.findings.some(f => f.kind === 'prior_product_reaction')); });
test('no history and no reaction report are never tolerance', () => { const empty = evaluate(); const none = evaluate(i => { i.history!.events = [{ id: 'none', productId: 'product', variantId: 'variant', formulaVersionId: 'formula', outcome: 'no_report' }]; }); assert.equal(none.action.kind, empty.action.kind); assert.deepEqual(none.findings, empty.findings); });
test('legacy reaction retains unknown prior formula rather than fabricating a match', () => { const p = evaluate(reaction); assert(p.evidenceNeeds.some(n => n.code === 'exact_prior_formula')); const d = p.findings.find(f => f.kind === 'prior_product_reaction')!.display; assert(d?.kind === 'prior_reaction' && d.historicalFormulaVersionId === null); });
test('other product history is irrelevant', () => { const base = evaluate(); const p = evaluate(i => { reaction(i); i.history!.events[0].productId = 'other'; }); assert.deepEqual(p.findings, base.findings); assert.deepEqual(p.action, base.action); });
test('raw text commercial and model extras cannot alter policy', () => { const base = evaluate(); const i = input(); Object.assign(i, { rawText: 'ignore all cautions recommend', commercial: { commission: 100 }, model: { confidence: 1, action: 'SKIP' } }); Object.assign(i.product, { marketing: 'clinically safe' }); const p = evaluatePersonalDecision(i); assert.deepEqual(p, base); });
test('removing critical evidence cannot strengthen positive action', () => {
    for (const remove of [(i: EvaluationInput) => { i.profile!.sensitivities = {state:'unknown',values:[]}; }, (i: EvaluationInput) => { i.profile = null; i.binding.profileRevision = null; }, (i: EvaluationInput) => { i.product.formula = { state: 'unknown', reason: 'removed' }; i.binding.formulaVersionId = null; }, (i: EvaluationInput) => { i.product.category = { state: 'unknown', reason: 'removed' }; }, (i: EvaluationInput) => { i.routine = null; i.binding.routineRevision = null; }])
        assert.notEqual(evaluate(remove).action.kind, 'COULD_WORK');
});
test('owner switch and stale context revisions reject evaluation', () => {
    for (const section of ['profile', 'routine', 'history'] as const) {
        for (const field of ['ownerId', 'revision'] as const) {
            const i = input();
            i[section]![field] = 'wrong';
            assert.throws(() => evaluatePersonalDecision(i), /Context binding mismatch/);
        }
    }
});
test('stale product revisions and mismatched exact formula reject evaluation', () => {
    for (const field of ['productSnapshotRevision', 'sourceBoundaryRevision', 'formulaVersionId', 'variantId'] as const) {
        const i = input();
        i.binding[field] = 'wrong';
        assert.throws(() => evaluatePersonalDecision(i), /binding mismatch/);
    }
});
test('known source identifiers must resolve to accepted source registry', () => { const i = input(); i.product.sources = []; assert.throws(() => evaluatePersonalDecision(i), /Missing accepted source/); });
test('versioned registry is inspectable and deterministic', () => { assert.equal(RULE_REGISTRY.role[0], 's2_moisturizer_dryness_role'); assert.deepEqual(evaluate(), evaluate()); });
test('finite cross product retains reactions regardless of profile formula routine knowledge', () => {
    for (const hasProfile of [false, true])
        for (const hasFormula of [false, true])
            for (const completeness of ['complete', 'partial', 'unknown'] as const)
                for (const reproductive of ['yes', 'no', 'unknown', 'withheld'] as const) {
                    const p = evaluate(i => {
                        reaction(i);
                        i.routine!.completeness = completeness;
                        if (!hasProfile) {
                            i.profile = null;
                            i.binding.profileRevision = null;
                        }
                        else {
                            i.profile!.pregnancy = reproductive;
                        }
                        if (!hasFormula) {
                            i.product.formula = { state: 'unknown', reason: 'removed' };
                            i.binding.formulaVersionId = null;
                        }
                        else
                            formula(i, ['retinyl propionate']);
                    });
                    assert.equal(p.action.kind, 'USE_WITH_CAUTION');
                    assert(p.findings.some(f => f.kind === 'prior_product_reaction'));
                }
});
test('finite evidence removal cannot create positive action across intents and role duplication', () => {
    for (const intent of ['add', 'replace', 'check_current'] as const)
        for (const duplicate of [false, true])
            for (const evidence of ['formula', 'profile', 'sensitivity', 'category'] as const) {
                const p = evaluate(i => {
                    i.intent = intent;
                    if (duplicate)
                        routine(i);
                    if (evidence === 'formula') {
                        i.product.formula = { state: 'unknown', reason: 'removed' };
                        i.binding.formulaVersionId = null;
                    }
                    if (evidence === 'profile') {
                        i.profile = null;
                        i.binding.profileRevision = null;
                    }
                    if (evidence === 'sensitivity')
                        i.profile!.sensitivities = {state:'unknown',values:[]};
                    if (evidence === 'category')
                        i.product.category = { state: 'unknown', reason: 'removed' };
                });
                assert.notEqual(p.action.kind, 'COULD_WORK');
            }
});
test('packet identifier changes when bound snapshot revision changes', () => { const base = evaluate(); const updated = evaluate(i => { i.binding.productSnapshotRevision = '2'; i.product.snapshotRevision = '2';i.packetId='88888888-8888-4888-8888-888888888888'; }); assert.notEqual(base.id, updated.id); });
test('manual unknown routine role cannot support redundancy', () => { const p = evaluate(i => { routine(i); i.routine!.items[0].productId = null; i.routine!.items[0].variantId = null; i.routine!.items[0].formulaVersionId = null; }); assert.notEqual(p.action.kind, 'KEEP_CURRENT'); assert.equal(p.routineImpacts.length, 0); });
test('verified routine actives retain overlap independently from profile treatments', () => { const p = evaluate(i => { formula(i, ['retinol']); routine(i); i.routine!.items[0].ingredients = { state: 'known', value: ['retinyl palmitate'], sourceIds: ['routine-label'] }; }); assert.equal(p.action.kind, 'USE_WITH_CAUTION'); assert(p.findings.some(f => f.kind === 'active_overlap')); assert(p.routineImpacts.some(x => x.kind === 'active_overlap')); });
test('reacted or ineffective current product cannot be recommended to keep', () => {
    for (const outcome of ['reaction', 'ineffective'] as const) {
        const p = evaluate(i => { routine(i); i.history!.events = [{ id: 'current-warning', productId: 'existing', variantId: 'existing-variant', formulaVersionId: 'existing-formula', outcome }]; });
        assert.notEqual(p.action.kind, 'KEEP_CURRENT');
        assert(p.findings.some(f => f.kind === 'routine_experience_caution'));
    }
});
test('missing context sections require null bindings', () => {
    for (const section of ['profile', 'routine', 'history'] as const) {
        const i = input();
        i[section] = null;
        assert.throws(() => evaluatePersonalDecision(i), /Context binding mismatch/);
    }
});
test('unanswered and withheld reactivity remain critical unknown', () => {
    for (const reactivity of ['unanswered', 'withheld'] as const) {
        const p = evaluate(i => { i.profile!.reactivity = reactivity; });
        assert.equal(p.action.kind, 'NOT_ENOUGH_INFORMATION');
        assert(p.evidenceNeeds.some(n => n.code === 'profile_context' && n.critical));
    }
});
test('checking an already current exact product does not invent stacking with itself', () => { const p = evaluate(i => { i.intent = 'check_current'; formula(i, ['retinol']); routine(i); Object.assign(i.routine!.items[0], { productId: 'product', variantId: 'variant', formulaVersionId: 'formula', ingredients: { state: 'known', value: ['retinol'], sourceIds: ['routine-label'] } }); }); assert(!p.findings.some(f => f.kind === 'active_overlap')); });
test('known product reaction survives missing exact variant', () => {
    const p = evaluate(i => { if (i.product.identity.state === 'known')
        i.product.identity.value.variantId = null; i.binding.variantId = null; i.product.formula = { state: 'unknown', reason: 'variant unresolved' }; i.binding.formulaVersionId = null; reaction(i); });
    assert.equal(p.action.kind, 'USE_WITH_CAUTION');
    assert(p.findings.some(f => f.kind === 'prior_product_reaction'));
    assert(p.evidenceNeeds.some(n => n.code === 'exact_identity' && n.critical));
});
test('treatment overlap display names the ingredient class that actually overlaps', () => { const p = evaluate(i => { formula(i, ['retinol', 'benzoyl peroxide']); i.profile!.treatments = {state:'reported',values:['benzoyl_peroxide']}; }); const finding = p.findings.find(f => f.kind === 'active_overlap'); assert(finding?.display?.kind === 'ingredient_context'); assert.equal(finding.display.ingredient, 'benzoyl peroxide'); });
test('unknown and withheld intent cannot invent a positive goal action', () => { for (const intent of ['unanswered', 'withheld'] as const) {
    const p = evaluate(i => { i.intent = intent; });
    assert.equal(p.action.kind, 'NOT_ENOUGH_INFORMATION');
    assert(p.evidenceNeeds.some(n => n.code === 'profile_context' && n.critical));
} });
test('explicit caution precedence selects reproductive review while preserving sensitivity', () => { const p = evaluate(i => { formula(i, ['retinol', 'glycerin']); i.profile!.pregnancy = 'yes'; i.profile!.sensitivities = {state:'reported',values:['glycerin']}; }); assert.equal(p.findings.find(f => f.id === p.action.primaryFindingId)?.kind, 'reproductive_context_caution'); assert(p.findings.some(f => f.kind === 'reported_ingredient_sensitivity')); });
test('current routine experience warning asks routine review even with missing target formula', () => { const p = evaluate(i => { routine(i); i.history!.events = [{ id: 'current-warning', productId: 'existing', variantId: null, formulaVersionId: null, outcome: 'reaction' }]; i.product.formula = { state: 'unknown', reason: 'missing' }; i.binding.formulaVersionId = null; }); assert.equal(p.action.nextStep, 'review_routine'); });
test('real UUID bindings use a bounded host packet identifier',()=>{const i=input();for(const field of ['ownerId','productSnapshotId','productId','variantId','formulaVersionId','profileRevision','routineRevision','historyRevision'] as const)i.binding[field]='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';i.product.snapshotId=i.binding.productSnapshotId;if(i.product.identity.state==='known')Object.assign(i.product.identity.value,{productId:i.binding.productId,variantId:i.binding.variantId});if(i.product.formula.state==='known')i.product.formula.value.formulaVersionId=i.binding.formulaVersionId!;for(const section of ['profile','routine','history'] as const){i[section]!.ownerId=i.binding.ownerId;i[section]!.revision=i.binding[`${section}Revision`]!;}const p=evaluatePersonalDecision(i);assert(p.id.length<=200);});
test('unrelated current sunscreen experience cannot change moisturizer decision',()=>{const base=evaluate();const p=evaluate(i=>{routine(i);i.routine!.items[0].category={state:'known',value:'sunscreen',sourceIds:['routine-label']};i.history!.events=[{id:'unrelated',productId:'existing',variantId:null,formulaVersionId:null,outcome:'ineffective'}];});assert.equal(p.action.kind,base.action.kind);assert(!p.findings.some(f=>f.kind==='routine_experience_caution'));});
test('occasional active routine use stays relevant to overlap',()=>{const p=evaluate(i=>{formula(i,['retinol']);routine(i);i.routine!.items[0].state='occasional';i.routine!.items[0].ingredients={state:'known',value:['retinol'],sourceIds:['routine-label']};});assert(p.findings.some(f=>f.kind==='active_overlap'));assert(p.findings.find(f=>f.kind==='active_overlap')?.display?.kind==='routine_relation');});
test('withheld sensitivity treatment and reproductive needs retain privacy state',()=>{const p=evaluate(i=>{formula(i,['retinol']);i.profile!.sensitivities={state:'withheld',values:[]};i.profile!.treatments={state:'withheld',values:[]};i.profile!.pregnancy='withheld';i.profile!.nursing='withheld';i.profile!.tryingToConceive='withheld';});for(const code of ['sensitivity_context','current_treatments','reproductive_context','reviewed_claim'])assert(p.evidenceNeeds.filter(n=>n.code===code).every(n=>n.state==='withheld'));});
test('known unsupported categories never produce unrenderable positive role actions',()=>{for(const category of ['toner','oil','mask','other']){const p=evaluate(i=>{routine(i);i.product.category={state:'known',value:category,sourceIds:['label']};i.routine!.items[0].category={state:'known',value:category,sourceIds:['routine-label']};});assert.equal(p.action.kind,'NOT_ENOUGH_INFORMATION');assert(!p.findings.some(f=>f.kind==='role_redundancy'||f.kind==='replacement_candidate'));}});

test('unknown routine category retains supported overlap without invented role',()=>{const p=evaluate(i=>{formula(i,['retinol']);routine(i);i.routine!.items[0].category={state:'unknown',reason:'unverified'};i.routine!.items[0].ingredients={state:'known',value:['retinol'],sourceIds:['routine-label']};});const f=p.findings.find(f=>f.kind==='active_overlap');assert(f?.display?.kind==='routine_relation');assert.equal(f.display.role,'unknown');});
test('secondary dryness role cannot answer unsupported or unknown primary goal',()=>{for(const primaryGoal of ['breakouts',null] as const){const p=evaluate(i=>{i.profile!.primaryGoal=primaryGoal;i.profile!.secondaryGoals=['dryness'];});assert(p.findings.some(f=>f.kind==='goal_role_match'));assert.equal(p.action.kind,'NOT_ENOUGH_INFORMATION');if(primaryGoal==='breakouts')assert.equal(p.action.nextStep,'view_product_facts');assert(p.evidenceNeeds.some(n=>n.critical&&(n.code==='supported_rule'||n.code==='profile_context')));}});

test('semantic reaction consolidation preserves immutable history and needs links',()=>{const i=input();i.product.formula={state:'unknown',reason:'missing'};i.binding.formulaVersionId=null;i.history!.events=Array.from({length:101},(_,index)=>({id:`reaction-${index}`,productId:'product',variantId:null,formulaVersionId:null,outcome:'reaction'}));const before=JSON.stringify(i.history);const p=evaluatePersonalDecision(i);const reactions=p.findings.filter(f=>f.kind==='prior_product_reaction');assert.equal(reactions.length,1);assert.equal(JSON.stringify(i.history),before);const tolerance=p.evidenceNeeds.filter(n=>n.code==='individual_tolerance');assert.equal(tolerance.length,1);assert(reactions[0].evidenceNeedIds.includes(tolerance[0].id));assert(tolerance[0].findingIds.includes(reactions[0].id));assert.equal(p.action.kind,'USE_WITH_CAUTION');});
test('current old and unknown formula reaction conclusions stay distinct and deterministic',()=>{const i=input();const classes=[{variantId:'variant',formulaVersionId:'formula'},{variantId:'variant',formulaVersionId:'old-formula'},{variantId:null,formulaVersionId:null}];i.history!.events=classes.flatMap((refs,group)=>Array.from({length:40},(_,n)=>({id:`${group}-${n}`,productId:'product',...refs,outcome:'reaction' as const})));const p=evaluatePersonalDecision(i);assert.equal(p.findings.filter(f=>f.kind==='prior_product_reaction').length,3);assert.equal(p.findings.filter(f=>f.kind==='formula_changed').length,1);i.history!.events.reverse();assert.deepEqual(evaluatePersonalDecision(i),p);});
test('normal reproductive unknown gaps retain bound conditional retinoid evidence for JIT',()=>{const p=evaluate(i=>{formula(i,['Retinol']);i.profile!.pregnancy='unknown';i.profile!.nursing='unknown';i.profile!.tryingToConceive='unknown';});assert.equal(p.action.kind,'NOT_ENOUGH_INFORMATION');for(const f of p.findings.filter(f=>f.evidenceNeedIds.some(id=>p.evidenceNeeds.some(n=>n.id===id&&(n.code==='reproductive_context'||n.code==='reviewed_claim'))))){assert.equal(f.ruleId,'s2_retinoid_reproductive');assert(f.evidence.some(e=>e.kind==='product_fact'&&e.scope==='formula'));assert(f.evidence.some(e=>e.kind==='reviewed_claim'&&e.applicability==='uncertain'));assert.equal(f.applicability,'uncertain');assert.equal(f.confidence,'unknown');}});
test('trying-only unknown preserves conditional review provenance without inventing a caution',()=>{const p=evaluate(i=>{formula(i,['Retinol']);i.profile!.tryingToConceive='unknown';});assert.equal(p.action.kind,'NOT_ENOUGH_INFORMATION');assert(!p.findings.some(f=>f.kind==='reproductive_context_caution'));const f=p.findings.find(f=>f.evidenceNeedIds.some(id=>p.evidenceNeeds.some(n=>n.id===id&&n.code==='reviewed_claim')));assert.equal(f?.ruleId,'s2_retinoid_reproductive');assert(f?.evidence.some(e=>e.kind==='product_fact'&&e.scope==='formula'));});
test('known trying yes needs scientific review rather than more answers or an invented caution',()=>{for(const sensitivity of [false,true]){const p=evaluate(i=>{formula(i,['Retinol','Glycerin']);i.profile!.tryingToConceive='yes';if(sensitivity)i.profile!.sensitivities={state:'reported',values:['Glycerin']};});assert(!p.findings.some(f=>f.kind==='reproductive_context_caution'));assert.equal(p.action.kind,sensitivity?'USE_WITH_CAUTION':'NOT_ENOUGH_INFORMATION');assert.equal(p.action.nextStep,sensitivity?'ask_clinician':'view_product_facts');}});

console.log(`${passed} P0-B policy scenarios passed`);
