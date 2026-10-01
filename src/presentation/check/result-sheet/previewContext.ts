import { describeResultExample } from './examples.ts';
import { currentFeedbackLabels, type CurrentProductFeedback } from '../../p0b-personalization/setup.ts';
import { verdictLabels, type ResultFinding } from './verdict.ts';

/** Local preview contract only. Not persisted, sent to the evaluator, or inferred from profile intent. */
export interface PreviewAnswers {
  scanKey: string;
  intent: 'unanswered' | 'replace' | 'add' | 'not_sure' | 'skipped';
  targetId: string | null;
  texture: 'unanswered' | 'rich' | 'light' | 'cream' | 'foaming' | 'no_preference' | 'skipped';
  feedback: CurrentProductFeedback[];
}
export const createPreviewAnswers = (scanKey: string): PreviewAnswers => ({ scanKey, intent: 'unanswered', targetId: null, texture: 'unanswered', feedback: [] });
type ProductRef = { productId: string; variantId: string | null; formulaVersionId: string | null };
interface PreviewProduct { id: string; label: string; reference: ProductRef }
export interface PreviewScan {
  category: string | null;
  routine: 'complete' | 'none' | 'skipped' | 'partial';
  products: PreviewProduct[];
  texture: 'rich' | 'cream' | null;
  relevantGoal: boolean;
  reference: ProductRef;
}
const scanRef: ProductRef = { productId: 'new-product', variantId: 'new-variant', formulaVersionId: 'new-formula' };
const product = (id: string, label: string): PreviewProduct => ({ id, label, reference: { productId: id, variantId: `${id}-variant`, formulaVersionId: `${id}-formula` } });
export const coverageExamples = [
  ['multiple-moisturizers', 'Two current moisturizers'], ['known-none', 'No current products'],
  ['skipped-routine', 'Routine skipped'], ['partial-routine-question', 'Partially recorded routine'],
  ['irrelevant-goal', 'Goal unrelated to this scan'], ['variant-mismatch', 'Different variant / formula'],
  ['unknown-category', 'Manual / unknown category'], ['deodorant', 'Deodorant'], ['haircare', 'Haircare'],
] as const;
export function previewScan(id: string): PreviewScan | null {
  if (!['moisturizer', 'cleanser', 'sunscreen', ...coverageExamples.map(row => row[0])].includes(id)) return null;
  const category = id === 'unknown-category' ? null : id === 'deodorant' || id === 'haircare' || id === 'cleanser' || id === 'sunscreen' ? id : 'moisturizer';
  const routine = id === 'known-none' ? 'none' : id === 'skipped-routine' ? 'skipped' : id === 'partial-routine-question' ? 'partial' : 'complete';
  const products = id === 'multiple-moisturizers' ? [product('morning', 'Morning lotion'), product('evening', 'Evening cream')]
    : ['cleanser', 'sunscreen', 'variant-mismatch'].includes(id) ? [product('current', `Current ${category}`)] : [];
  if (id === 'variant-mismatch') products[0].reference = { productId: scanRef.productId, variantId: 'older-variant', formulaVersionId: 'older-formula' };
  return { category, routine, products, texture: category === 'moisturizer' ? 'rich' : category === 'cleanser' ? 'cream' : null, relevantGoal: id !== 'irrelevant-goal', reference: scanRef };
}
export function previewQuestions(scan: PreviewScan) {
  return { intent: ['moisturizer', 'cleanser', 'sunscreen'].includes(scan.category ?? '') && scan.products.length > 0,
    texture: scan.texture !== null, feedback: scan.products.length > 0 };
}
export function setPreviewIntent(answers: PreviewAnswers, intent: PreviewAnswers['intent']): PreviewAnswers {
  return { ...answers, intent, targetId: intent === 'replace' ? answers.targetId : null, feedback: intent === 'replace' ? answers.feedback : [] };
}
export function setPreviewTarget(scan: PreviewScan, answers: PreviewAnswers, id: string | null): PreviewAnswers {
  const targetId = answers.intent === 'replace' && scan.products.some(product => product.id === id) ? id : null;
  return targetId === answers.targetId ? answers : { ...answers, targetId, feedback: [] };
}
export function togglePreviewFeedback(answers: PreviewAnswers, value: CurrentProductFeedback): PreviewAnswers {
  const feedback = answers.feedback.includes(value) ? answers.feedback.filter(item => item !== value)
    : value === 'not_sure' ? ['not_sure'] as CurrentProductFeedback[] : [...answers.feedback.filter(item => item !== 'not_sure'), value];
  return { ...answers, feedback };
}
const sameExactProduct = (a: ProductRef, b: ProductRef) => Boolean(a.variantId && a.formulaVersionId && a.productId === b.productId && a.variantId === b.variantId && a.formulaVersionId === b.formulaVersionId);
/** Facts and verdict are projected together; stale answers from another Check cannot influence either. */
export function describeContextualExample(id: string, scanKey: string, supplied: PreviewAnswers) {
  const scan = previewScan(id);
  if (!scan) return describeResultExample(id);
  const a = supplied.scanKey === scanKey ? supplied : createPreviewAnswers(scanKey);
  const baseId = scan.category === 'cleanser' || scan.category === 'sunscreen' ? scan.category : 'moisturizer';
  const example = describeResultExample(baseId);
  const findings = example.verdict.findings.filter(row => !['routine-placement', 'texture'].includes(row.id));
  let state = example.verdict.state;
  let reason = example.verdict.reason;
  if (!scan.category || ['deodorant', 'haircare'].includes(scan.category) || !scan.relevantGoal) {
    state = 'unknown'; reason = 'There is no supported personal goal assessment for this scan.';
    findings.splice(0, findings.length, { id: 'scope', title: 'Evidence limits', reason, evidence: [], limits: [] });
    example.facts.name = scan.category ? `Example ${scan.category}` : 'Manually named product';
    example.facts.categoryLabel = scan.category ?? 'Category unknown';
  }
  const target = a.intent === 'replace' ? scan.products.find(item => item.id === a.targetId) : undefined;
  let placement = scan.routine === 'none' ? 'You explicitly reported no current products.'
    : scan.routine === 'skipped' ? 'You skipped routine information. Missing steps cannot be inferred.'
    : scan.routine === 'partial' ? 'Only part of your routine is recorded. Missing steps cannot be inferred.'
    : scan.products.length ? `You recorded ${scan.products.length} current ${scan.category} ${scan.products.length === 1 ? 'product' : 'products'}. Your intent is unknown.`
    : `Your complete recorded routine has no ${scan.category ?? 'verified product'} step.`;
  if (!scan.category) placement = 'Routine placement is unknown because this product category is unverified.';
  if (previewQuestions(scan).intent) {
    if (a.intent === 'replace') placement = target ? `You want to replace ${target.label}. Better results are not established.` : 'You want to replace a product. The replacement target is still unknown.';
    if (a.intent === 'add') placement = `You want to add a step. You already recorded ${scan.products.length} ${scan.category} ${scan.products.length === 1 ? 'product' : 'products'}; the same role alone does not make adding this a bad fit.`;
    if (a.intent === 'not_sure' || a.intent === 'skipped') placement += a.intent === 'not_sure' ? ' You selected Not sure.' : ' You skipped the intent question.';
  }
  findings.push({ id: 'routine-placement', title: 'In your routine', reason: placement,
    evidence: [{ label: 'Fictional recorded context', detail: `Routine: ${scan.routine}; current products: ${scan.products.map(item => item.label).join(', ') || 'none recorded'}; this Check intent: ${a.intent}; selected target: ${target?.label ?? 'unknown'}.` }],
    limits: ['Routine placement does not prove layering compatibility. Product combinations need supported formula and interaction evidence.'] });
  if (scan.texture) {
    const explicit = !['unanswered', 'skipped', 'no_preference'].includes(a.texture);
    const match = a.texture === scan.texture;
    const mismatch = explicit && !match;
    const textureReason = `The fictional label describes ${scan.texture === 'rich' ? 'a rich cream' : 'a non-foaming cream'}. ${explicit ? `You explicitly chose ${a.texture} texture for this Check${match ? ', which matches that description' : ', which differs from that description'}.` : a.texture === 'no_preference' ? 'You have no texture preference.' : 'Your texture preference is unknown.'}`;
    findings.push({ id: 'texture', title: 'Texture', reason: textureReason,
      evidence: [{ label: 'Fictional package label', detail: scan.texture }, ...(explicit || a.texture === 'no_preference' ? [{ label: 'Demo-only answer for this Check', detail: a.texture }] : [])], limits: ['Texture description does not establish skin tolerance or effectiveness.'] });
    if (mismatch && state === 'good') { state = 'tradeoffs'; reason = 'The label supports your goal, but its texture differs from your explicit preference.'; }
  }
  if (target && a.feedback.length) {
    const reports = a.feedback.map(value => currentFeedbackLabels[value]).join(' · ');
    const adverse = a.feedback.some(value => ['stung', 'broke_out', 'too_drying'].includes(value));
    const exactReaction = adverse && sameExactProduct(target.reference, scan.reference);
    findings.push({ id: 'feedback', title: 'Your current product feedback', reason: `${target.label}: ${reports}. ${a.feedback.includes('still_dry') ? 'This reports how your skin feels with that product; it does not prove this new product will hydrate better. ' : ''}${adverse ? 'A specific adverse report is distinct from dislike. ' : ''}${sameExactProduct(target.reference, scan.reference) ? 'This report concerns the exact variant and formula.' : 'This report does not establish your reaction to the scanned variant and formula.'}`,
      evidence: [{ label: 'Demo-only answer about selected product', detail: `${target.label}: ${reports}; variant ${target.reference.variantId}; formula ${target.reference.formulaVersionId}` }], limits: ['No ingredient cause or general texture preference is inferred. Historical reports remain separate.'] });
    if (exactReaction) { state = 'poor'; reason = 'You reported an adverse experience with this exact variant and formula.'; }
  }
  return { facts: example.facts, verdict: { state, label: verdictLabels[state], reason, findings: findings as ResultFinding[] } };
}
