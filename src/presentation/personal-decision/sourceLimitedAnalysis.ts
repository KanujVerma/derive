import type { PersonalContextSnapshot, ContextProductReference } from '../../contracts/PersonalContext.ts';
import type { ProductIngredientQuery } from '../../contracts/ProductIngredientLookup.ts';
import type { VerdictPresentation, ResultFinding } from '../check/result-sheet/verdict.ts';
import { buildPersonalIngredientInsights } from '../external-products/personalIngredientInsights.ts';
import { compareReactionIngredients, reactionProducts, type ReactionIngredientRecord } from './reactionIngredientComparison.ts';
import { REACTION_INGREDIENT_POLICY_VERSION } from '../../domain/reactionIngredientFlags.ts';

export interface AnalysisIngredientList {
  ingredientsText: string; sourceUrl?: string; sourceName?: string; retrievedAt?: string;
}
export interface SourceLimitedAnalysis {
  ownerId: string; productKey: string; scopeKey: string; contextRevision: number;
  basis: 'source_limited_local'; formulaVerified: false;
  verdict: VerdictPresentation;
}
const normalized = (text: string) => text.normalize('NFKC').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export function sourceLimitedProductKey(query: ProductIngredientQuery): string {
  return JSON.stringify([query.barcode, query.name, query.brand, query.size]);
}
function role(name: string): string | null {
  if (/\b(deodorant|antiperspirant)\b/i.test(name)) return 'deodorant';
  if (/\b(shampoo|conditioner|hair)\b/i.test(name)) return 'hair care';
  if (/\b(sunscreen|sunblock|spf)\b/i.test(name)) return 'sunscreen';
  if (/\b(cleanser|face wash|cleansing|body wash)\b/i.test(name)) return 'cleanser';
  if (/\b(lotion|moisturizer|moisturiser|cream)\b/i.test(name)) return 'moisturizer';
  return null;
}
export type SourceLimitedProductCategory = 'skincare' | 'other_personal_care' | 'unsupported';
/** Bounded listing classification, not a claim about an unknown product's intended use. */
export function classifySourceLimitedProduct(name: string): SourceLimitedProductCategory {
  // Negative uses precede cream/conditioner matches, for example ice cream or laundry conditioner.
  if (/\b(toothpaste|toothbrush|mouthwash|dental floss|floss|ice cream|cream soda|soda|energy drink|protein shake|beverage|coffee|juice|yogurt|candy|chocolate|supplement|laundry|detergent|dish soap|hair dryer)\b/i.test(name)) return 'unsupported';
  const productRole = role(name);
  if (productRole === 'deodorant' || productRole === 'hair care') return 'other_personal_care';
  // A named treatment can use skin context without assuming every serum fills
  // the same routine role or guessing the intended use of an unlabelled gel.
  if (/\b(serum|facial toner|skin toner|exfoliant|acne treatment|face mask|facial mask|face oil|facial oil|body oil)\b/i.test(name)) return 'skincare';
  return productRole ? 'skincare' : 'unsupported';
}
function manualName(reference: ContextProductReference): string | null {
  return reference.kind === 'manual' ? reference.name.trim().slice(0, 300) : null;
}
function sameBrand(reference: ContextProductReference, brand: string | null): boolean {
  if (reference.kind !== 'manual' || !brand || !normalized(brand)) return false;
  return normalized(reference.brand ?? '') === normalized(brand)
    || normalized(reference.name).startsWith(normalized(brand) + ' ');
}
const goalNames: Record<string, string> = { breakouts: 'breakouts', dark_spots: 'dark marks', oiliness: 'oiliness', texture: 'texture',
  redness: 'redness', fine_lines: 'fine lines', simplify: 'a simpler routine', maintain: 'maintaining your skin', dryness: 'dryness' };

/** Local, source-bound findings for the existing Personal Fit surface. Never a canonical packet or score. */
export function buildSourceLimitedAnalysis(input: {
  ownerId: string; query: ProductIngredientQuery; context: PersonalContextSnapshot | null;
  lists: AnalysisIngredientList[]; sourceType?: 'published' | 'user_label'; reactionIngredients?: ReactionIngredientRecord[];
}): SourceLimitedAnalysis | null {
  const { ownerId, query, context } = input;
  if (!context || context.ownerId !== ownerId || context.profile && context.profile.ownerId !== ownerId
    || context.routine && context.routine.ownerId !== ownerId || context.experiences.some(e => e.ownerId !== ownerId)) return null;
  const lists = input.lists.slice(0, 3).filter(item => item.ingredientsText.trim() && item.ingredientsText.length <= 24_000);
  const productKey = sourceLimitedProductKey(query);
  const scopeKey = JSON.stringify([ownerId, productKey, context.revision, context.profile?.id, context.profile?.revision,
    context.routine?.id, context.routine?.revision, context.historyRevision,
    context.profile?.data, context.routine?.data, context.experiences.slice(0, 100).map(e => [e.id, e.revision, e.data]),
    context.legacy.experiences.slice(0, 100), context.historyTruncated, context.legacy.truncated,
    input.sourceType ?? 'published', lists, input.reactionIngredients ?? [], REACTION_INGREDIENT_POLICY_VERSION]);
  const category = classifySourceLimitedProduct(query.name ?? '');
  const productRole = role(query.name ?? '');
  const personalCare = category === 'other_personal_care';
  const findings: ResultFinding[] = [];
  const add = (id: string, title: string, reason: string, section: string, limits: string[] = []) => {
    const evidence = section === 'Published ingredients' ? lists.map(item => ({ label: item.sourceName ?? 'Published ingredient source',
      detail: input.sourceType === 'user_label' ? 'The label text you entered.'
        : [item.sourceUrl, item.retrievedAt ? `Retrieved ${item.retrievedAt}` : null].filter(Boolean).join(' ') || 'A published ingredient list, not a package verified formula.' }))
      : [{ label: section, detail: section === 'Your product experience' ? 'Your own report. It does not establish ingredient causation.'
        : section === 'Recorded routine' ? 'Your saved named routine products. Their formulas were not compared.'
          : section === 'Skin profile' ? 'Your saved primary and secondary goals.' : 'The matching product listing and your saved context.' }];
    findings.push({ id, title, reason, limits, evidence });
  };
  let caution: string | null = null;
  const exactName = normalized(query.name ?? '');
  const superseded = new Set(context.experiences.map(e => e.supersedesRevisionId).filter(Boolean));
  const currentHistory = context.experiences.filter(e => !superseded.has(e.id)).slice(0, 100);
  // Earlier owner-bound Free Context reports remain observations, not verified identity or allergies.
  const legacyReports = context.legacy.experiences.slice(0, 100).flatMap(e => {
    const name = typeof e.productName === 'string' && e.productName.trim() ? e.productName
      : typeof e.product_name === 'string' ? e.product_name : null;
    if (e.kind !== 'reacted' || !name?.trim()) return [];
    return [{ id: String(e.id ?? ''), ownerId, revision: context.revision,
      data: { reference: { kind: 'manual' as const, name, ...(typeof e.brand === 'string' ? { brand: e.brand } : {}) },
        kind: 'reacted' as const, symptoms: [] as string[], note: typeof e.note === 'string' ? e.note : null } }];
  });
  const history = [...currentHistory, ...legacyReports];
  const exactReports = exactName ? history.filter(e => e.data.reference.kind === 'manual'
    && normalized(e.data.reference.name) === exactName) : [];
  const exactReaction = exactReports.find(e => e.data.kind === 'reacted');
  if (exactReaction) {
    caution = 'You reported a reaction to this named product. Reconsider using it while the exact formula and cause remain unknown.';
    add('exact-product-reaction', 'Your past experience', caution, 'Your product experience',
      ['A matching name does not prove the current package has the same formula. No ingredient allergy is inferred.']);
  } else {
    const brandReaction = history.find(e => e.data.kind === 'reacted' && sameBrand(e.data.reference, query.brand))
      ?? history.find(e => e.data.kind === 'reacted' && productRole && e.data.reference.kind === 'manual'
        && role(e.data.reference.name) === productRole);
    if (brandReaction) {
      const previous = manualName(brandReaction.data.reference)!;
      const burning = brandReaction.data.symptoms.some(s => /^(?:pit burns|burning|burns|stinging)$/i.test(s.trim()))
        || /^(?:pit burns|burning|stinging|(?:it )?gave me pit burns)[.!]?$/i.test((brandReaction.data.note ?? '').trim());
      const relation = sameBrand(brandReaction.data.reference, query.brand) ? 'from the same brand' : `in the same ${productRole} step`;
      add('related-product-reaction', 'A different product caused trouble',
        `You reported ${burning ? 'burning or stinging' : 'a reaction'} with ${previous}. This is a different product ${relation}, so that experience is a reason to check carefully, not proof this formula will cause the same reaction.`,
        'Your product experience', ['We have not compared the two exact ingredient lists or identified a culprit ingredient.']);
    }
  }
  if (category === 'unsupported') add('product-scope-limit', 'Outside this skin comparison',
    'We found the product listing, but its name does not establish a supported skin care use. We do not apply facial skin goals or ingredient guidance to oral care, food or unidentified product types.', 'Product listing');
  const distinctLists = new Set(lists.map(item => normalized(item.ingredientsText)));
  if (distinctLists.size > 1) {
    add('formula-conflict', 'Different ingredient lists', 'The sources disagree on this product’s ingredient list. We cannot choose one formula silently.', 'Published ingredients');
  } else if (lists.length && category !== 'unsupported') {
    const notes = buildPersonalIngredientInsights(context, [lists[0]], input.sourceType ?? 'published', personalCare ? 'other_personal_care' : 'skincare');
    if (notes.status === 'ready') {
      const bounded = notes.sentences.slice(0, -1).filter(s => !s.startsWith('We found no specific ingredient note'));
      bounded.forEach((text, i) => add('ingredient-context-' + i,
        /fragrance|alcohol denat/i.test(text) ? 'Your skin reactivity' : 'Moisture support', text, 'Published ingredients',
        [input.sourceType === 'user_label' ? 'Based on the label text you entered.' : 'Published ingredients have not been confirmed against your package.']));
      if (!caution && context.profile?.data.reactivity === 'reacts_easily' && notes.ingredientNames.some(n => ['Fragrance', 'Alcohol denat.'].includes(n))) {
        caution = `The ingredient list includes ${notes.ingredientNames.includes('Fragrance') ? 'fragrance' : 'alcohol denat.'}, and you said your skin reacts easily. Consider an option without that ingredient, while recognizing we cannot predict your response.`;
      }
    }
    const goals = [context.profile?.data.primaryGoal, ...(context.profile?.data.secondaryGoals ?? [])].filter((g): g is NonNullable<typeof g> => Boolean(g));
    const entries = new Set(lists[0].ingredientsText.split(/[,;\n]/).map(s => normalized(s.replace(/\([^)]*\)/g, '').replace(/\d+(?:\.\d+)?\s*%/g, ''))));
    if (category === 'skincare') {
      if (productRole === 'cleanser') add('cleanser-contact', 'A rinse off step', 'This is listed as a cleanser. Rinse off contact differs from a leave on treatment, so its ingredient list alone cannot predict treatment strength or breakout improvement.', 'Product listing');
      if (productRole === 'sunscreen') add('sunscreen-label', 'Check the protection label', 'For sunscreen, the declared SPF, broad spectrum claim and how you apply it matter. An ingredient list alone does not confirm protection or how it will feel on your skin.', 'Product listing');
      if (goals.includes('breakouts') && (entries.has('salicylic acid') || entries.has('benzoyl peroxide'))) add('breakout-ingredient', 'Your breakout goal',
        `The list includes ${entries.has('salicylic acid') ? 'salicylic acid' : 'benzoyl peroxide'}, an ingredient used in acne products. The declared strength and product directions are needed before judging this product’s role.`, 'Published ingredients');
      const unsupported = [...new Set(goals)].filter(g => !['dryness', 'simplify', 'maintain'].includes(g)
        && !(g === 'breakouts' && (entries.has('salicylic acid') || entries.has('benzoyl peroxide'))));
      if (unsupported.length) add('goal-evidence-gap', 'Your goals',
        `${context.profile?.data.primaryGoal && unsupported.includes(context.profile.data.primaryGoal) ? `Your primary goal is ${goalNames[context.profile.data.primaryGoal]}. ` : ''}We do not have product specific evidence to say this formula will improve ${unsupported.map(g => goalNames[g]).join(' and ')}.`, 'Skin profile');
    } else if (goals.length) add('body-area-limit', 'Use the right context', 'Your facial skin goals do not establish how a deodorant or hair product will suit your underarms or scalp. Your reported product experiences and general reactivity are considered separately.', 'Skin profile');
  } else if (!lists.length) add('ingredients-missing', 'Ingredient list still needed', 'The product listing was found, but its ingredient list is missing. We can use your product history, not make ingredient based claims yet.', 'Product listing');

  if (lists.length && distinctLists.size === 1 && category !== 'unsupported') {
    const records = input.reactionIngredients ?? [];
    if (reactionProducts(context, query, 3).length > 2) add('reaction-comparison-limit', 'Some comparisons are still pending',
      'This private test looks up ingredient lists for at most two named past reaction products. Other saved reports remain in your history and were not ruled out by these comparisons.', 'Your product experience');
    for (const product of reactionProducts(context, query)) {
      const record = records.find(r => r.product.key === product.key && r.product.name === product.name);
      if (record?.status === 'found' && record.evidence?.formulaVerified === false && record.evidence.basis === 'published_web') {
        const compared = compareReactionIngredients(lists[0].ingredientsText, record.evidence.ingredientsText);
        const reason = compared.flagged.length
          ? `This list and the published list for ${product.name} both include ${compared.flagged.join(' and ')}. Research identifies these entries as possible contact allergy or irritation concerns. Given your reported reaction, consider an option without this overlap. It does not identify what caused your reaction.`
          : compared.shared.length
            ? `This list shares ${compared.shared.slice(0, 8).join(', ')} with the published list for ${product.name}. We did not find shared entries in our current research flags. That does not rule out other triggers or predict that this product will suit you.`
            : `We found no matching ingredient names between this list and the published list for ${product.name}. That does not establish that this product is safe for you or identify the cause of your earlier reaction.`;
        findings.push({ id: 'reaction-ingredients-' + product.key, title: 'Compared with your past reaction product', reason,
          limits: ['Current published lists may differ from the packages used when you reacted. Fragrance can contain different undisclosed mixtures. Shared ingredients are not proven triggers.'],
          evidence: [...lists.map(list => ({ label: list.sourceName ?? 'Current published list', detail: list.sourceUrl ?? 'Label text you entered' })),
            { label: record.evidence.sourceName, detail: `${record.evidence.sourceUrl} Retrieved ${record.evidence.retrievedAt}` },
            ...[...new Map(compared.flags.flatMap(flag => flag.sources).map(source => [source.url, source])).values()]
              .map(source => ({ label: source.label, detail: source.url }))] });
        if (compared.flagged.length && !caution) caution = reason;
      } else {
        add('reaction-comparison-' + product.key, 'Your past reaction product', record?.status === 'loading'
          ? `Checking a published ingredient list for ${product.name}. Your personal analysis is available while this comparison loads.`
          : record?.status === 'ambiguous' && record.candidates?.length
            ? `We found more than one product for ${product.name}. Choose the one you used in your saved product report so we can compare its ingredients.`
            : `We have not found a matching published ingredient list for ${product.name} yet. Your report is still considered, but ingredient overlap cannot be assessed without both lists.`, 'Your product experience');
      }
    }
  }

  const routine = context.routine?.data;
  if (routine && productRole && category !== 'unsupported') {
    const same = routine.items.filter(item => item.state === 'current' && item.reference.kind === 'manual'
      && role(item.reference.name) === productRole).slice(0, 3);
    if (same.length) add('routine-role', 'Your current routine',
      `You already recorded ${same.map(item => manualName(item.reference)).join(' and ')}. This listing appears to cover the same ${productRole} step. It may be a replacement rather than another addition, but ingredient overlap has not been verified.`, 'Recorded routine');
  }
  if (context.historyTruncated || context.legacy.truncated) add('history-partial', 'Some history is not loaded', 'Only the loaded product experiences were considered. Missing reports do not mean you have never reacted to a product.', 'Your product experience');
  const state = caution && distinctLists.size <= 1 && category !== 'unsupported' ? 'tradeoffs' : 'unknown';
  const reason = findings.find(f => f.id === 'product-scope-limit')?.reason ?? caution ?? (distinctLists.size > 1 ? 'The sources contain different ingredient lists. Confirm your package before relying on ingredient based advice.'
    : findings.find(f => f.id === 'related-product-reaction')?.reason
      ?? (context.profile?.data.primaryGoal && context.profile.data.primaryGoal !== 'dryness' ? findings.find(f => f.id === 'goal-evidence-gap')?.reason : null)
      ?? findings.find(f => f.id.startsWith('ingredient-context'))?.reason
      ?? findings.find(f => f.id === 'routine-role')?.reason
      ?? (lists.length ? 'We found published ingredients. The findings below show what relates to your saved context and what remains unknown.'
        : 'We found the product, but need its ingredient list before assessing ingredient based fit.'));
  return { ownerId, productKey, scopeKey, contextRevision: context.revision, basis: 'source_limited_local', formulaVerified: false,
    verdict: { state, label: state === 'tradeoffs' ? 'Some tradeoffs'
      : lists.length && distinctLists.size === 1 && findings.some(f => f.id === 'goal-evidence-gap')
        ? 'No clear goal match' : 'Not enough information', reason, findings } };
}
