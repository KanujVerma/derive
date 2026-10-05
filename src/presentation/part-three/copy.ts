import type { PersonalResultV2, FindingV2, MaterialGap } from '../../contracts/PersonalResultV2.ts';
import { PART_THREE_RELEASE } from '../../domain/part-three/release.ts';
const text = (value: string) => value.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, ' ');
/** Typed local templates. No unbounded model prose or legacy-label promotion. */
export function findingCopy(f: FindingV2): string {
    if (f.templateVersion !== PART_THREE_RELEASE.template)
        return 'This supporting detail is unavailable.';
    const name = f.arguments.name ? text(f.arguments.name) : 'this product';
    switch (f.kind) {
        case 'goal_evidence':
        case 'routine_evidence': return f.scientificEvidence?[f.scientificEvidence.reason,...f.scientificEvidence.qualifications].map(text).join(' '):'This evidence is unavailable.';
        case 'avoidance': return f.arguments.detail === 'preference' ? `This conflicts with your confirmed choice to avoid ${name}.` : 'A confirmed preference needs review.';
        case 'sensitivity': return `This list includes ${name}, which you reported as a sensitivity.`;
        case 'experience': {
            const detail = { reaction: 'a reaction', ineffective: 'that it did not help', liked: 'liking it', tolerated: 'tolerating it', no_reaction_reported: 'no reaction', finished: 'finishing it' }[f.arguments.detail as 'reaction'] ?? 'an experience';
            return `You reported ${detail}${f.arguments.reportTrace?.role==='comparator'?' with the current item selected for comparison':f.arguments.relation === 'exact_version' ? ' with this version' : f.arguments.relation === 'selected_manual' ? ' for the report you selected' : ' with this product family'}.`;
        }
        case 'purpose_value': return f.arguments.detail === 'replacement' ? 'Its label matches the step you want to replace.' : 'Its stated moisturizing purpose matches your explicit dryness goal.';
        case 'current_help': return 'You reported that this current item helps with the purpose you want to maintain.';
        case 'comparison': return f.arguments.detail === 'already_helpful' ? 'Your selected current item already helps with this purpose and site.' : f.arguments.detail === 'replacement' ? 'This is a replacement comparison with the current item you selected.' : f.arguments.detail === 'self' ? 'You selected the same item; this does not add another step.' : 'The selected items have different or unresolved purposes, sites or use forms.';
        case 'preference_tradeoff': return 'This may conflict with a preference you reported.';
        case 'evidence_limit': return f.arguments.detail === 'conditional' ? 'This is conditional or source-only wording; definite product presence is unconfirmed.' : f.arguments.name?`Your confirmed avoidance term “${name}” remains unresolved; a match cannot be established.`:'A material evidence detail remains unresolved.';
    }
}
export const gapCopy = (g: MaterialGap) => g.state==='conflict'?'Sources disagree on a material fact. This Check keeps that conflict unresolved.':({ identity_or_use: 'Product identity or intended use remains unresolved.', avoidance_unresolved: 'A confirmed avoidance preference has an unresolved match.', formula_association: 'This formula is not confirmed for your package.', relevant_history: 'Relevant history could not be completely checked.', purpose_coverage: 'The available evidence cannot support a judgment for this purpose.', purpose_or_site: 'Purpose, application site or use form needs clarification.', intent: 'Add or replace intent remains unresolved.', current_status: 'Whether the selected item is still in use remains unresolved.', goal_evidence: 'There isn’t enough evidence to say if this product will help your skin goal.' })[g.reason];
export function decisionCopy(result: PersonalResultV2) {
 const s=result.summary, primary=result.findings.find(f=>f.id===s?.primaryFindingId), packet=result.partFour;
 const feel=packet?.insights.find(i=>i.id==='foundation:F09:reported_feel'&&i.action&&i.state==='limited');
 const relevance=packet?.insights.find(i=>i.id==='foundation:F01:ingredient_relevance'&&i.state==='limited');
 const hasConcern=result.findings.some(f=>['decisive','concern'].includes(f.consequence));
 const reportConflict=packet?.insights.find(i=>i.ruleId==='F04'&&i.state==='conflict');
 const pending=packet?.decisionState==='pending', conflict=packet?.decisionState==='conflict';
 return {name:s?text(s.namedDecision.name):'Personal Check',
 label:conflict?'Review conflicting evidence':pending?'Not enough info':s?.displayVariant==='worth_keeping'?'Worth keeping':s?({worth_considering:'Worth considering',check_first:'Check first',skip:'Skip this one',not_enough_info:'Not enough info'})[s.judgment]:'Personal assessment unavailable',
 reason:conflict?(reportConflict?text(reportConflict.explanation):'The formula evidence disagrees on a fact needed for this decision.'):pending&&feel&&!hasConcern?text(feel.explanation):pending&&relevance&&!hasConcern?'Some listed ingredients have moisturizing functions relevant to your dryness goal. The finished product’s benefit and tolerance remain unknown.':pending&&s?.judgment==='worth_considering'?'The label describes moisturizing use. How much it will help your goal is unknown.':primary?findingCopy(primary):result.materialGaps[0]?gapCopy(result.materialGaps[0]):'There is no supported personal premise for this judgment.',
 ...(packet?{action:pending&&!hasConcern&&!feel&&!relevance?'Review the listed ingredients below and check that the product name matches your label.':packet.action}:{}),
 scope:s?({published_version:'Published list · Package not confirmed',confirmed_package:'Confirmed package evidence',source_reading:'Photo reading · Product presence unconfirmed',report:'Based on your report',comparison:'Comparison with one selected current item'})[s.scope]:null};
}

export function reportQualifierCopy(f:FindingV2):string[]{const t=f.arguments.reportTrace;if(!t)return [];const date=(d:typeof t.period.start)=>d.state==='known'?`${d.value.value} (${d.value.precision} precision)`:d.state==='unsure'?'unsure':d.state==='withheld'?'withheld':'not reported';const use=t.useContext,freq=use?.frequency;return [`Reported period: ${date(t.period.start)} to ${date(t.period.end)}.`,...(t.reference.kind==='catalog'?[t.reference.formulaVersionId?'The report records a formula version; matching this package is unconfirmed.':'The report identifies a product family; its formula version is unconfirmed.']:['Manual report association; exact formula identity is unconfirmed.']),...(use?[`Reported use: ${freq?.kind==='exact'?`${freq.count} times per ${freq.unit}`:freq?.kind==='qualitative'?freq.value.replaceAll('_',' '):'frequency unknown'}; started ${date(use.startedOn)}; stopped ${date(use.stoppedOn)}.`]:[])];}
