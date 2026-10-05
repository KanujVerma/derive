import type { PersonalContextV2 } from '../../contracts/PersonalContextV2.ts';
import { personalContextV2Schema } from '../../contracts/PersonalContextV2Schema.ts';
import { NormalizationResultSchema, type NormalizationResult } from '../../contracts/PartTwo.ts';
import { analyzeFormula } from '../../domain/part-four/formula.ts';
import type { IngredientKnowledgeRelease } from '../../domain/part-four/knowledge.ts';
import { lookupName } from '../../domain/part-two/dictionary.ts';
import { ingredientRow, partFourDisplayText } from './sections.ts';

export interface IngredientContextInput {
  ownerId: string | null;
  context: PersonalContextV2 | null;
  /** The mounted owner supplies its selected, already approved education. */
  knowledge: IngredientKnowledgeRelease;
}

// These extra cards explicitly describe water binding, water-loss reduction or
// skin softening in the approved copy. Display labels alone are not a classifier.
// No dictionary chemical class, efficacy, dose or tolerability is inferred.
const moistureContextIds = new Set(['petrolatum', 'sorbitol', 'propanediol',
  'propylene-glycol', 'caprylyl-glycol', 'cetyl-alcohol', 'cetearyl-alcohol']);

/** Live presentation of current, permission-qualified reading facts and approved
 * editorial copy. This is not a P3 finding, saved assessment or product verdict.
 * Reading identities remain usable when stricter product association fails. */
export function sourceIngredientContext(resultValue: NormalizationResult | null,
  input: IngredientContextInput, now: number) {
  const parsed = NormalizationResultSchema.safeParse(resultValue);
  if (!Number.isFinite(now) || !parsed.success || parsed.data.state !== 'ready') return null;
  const result = parsed.data, reading = result.output.reading;
  if (!input.ownerId || result.authenticatedOwnerId !== input.ownerId ||
    Date.parse(result.expiresAt) <= now || ['blocked', 'conflict'].includes(reading.evidenceState) ||
    reading.dependencyManifest.sourceRefs.some(source => !source.permitted || Date.parse(source.expiresAt) <= now)) return null;
  const context = input.context === null ? null : personalContextV2Schema.safeParse(input.context);
  if (context && (!context.success || context.data.ownerId !== input.ownerId ||
    context.data.profile && (context.data.profile.ownerId !== input.ownerId ||
      context.data.profile.revision > context.data.revision || Date.parse(context.data.profile.recordedAt) > now))) return null;
  const profile = context?.success ? context.data.profile?.data : null;
  const formula = analyzeFormula(result, {knowledge: input.knowledge, now: new Date(now).toISOString()});
  if (!formula) return null;
  const rows = formula.ingredients.map(ingredientRow);
  const eligible = rows.filter(row => row.card && row.card.ingredientId === formula.ingredients.find(i => i.occurrenceId === row.occurrenceId)?.ingredientId &&
    reading.occurrences.some(o => o.occurrenceId === row.occurrenceId && o.transcription === 'clear' && o.modality === 'unconditional') &&
    reading.facts.some(f => f.kind === 'resolved_ingredient_identity' && f.occurrenceId === row.occurrenceId &&
      f.value.ingredientId === row.card!.ingredientId && Date.parse(f.validUntil) > now &&
      f.sourceDependencies.length > 0 && f.sourceDependencies.every(id => reading.dependencyManifest.sourceRefs.some(s => s.observationId === id && s.permitted && Date.parse(s.expiresAt) > now))));
  const unique = eligible.filter((row, index, all) => all.findIndex(other => other.card!.ingredientId === row.card!.ingredientId) === index);
  const goals = [...(profile?.primaryGoal.state === 'known' ? [profile.primaryGoal.value] : []), ...(profile?.secondaryGoals ?? [])];
  const moisture = unique.filter(row => row.card!.label === 'Helps moisturize' || moistureContextIds.has(row.card!.ingredientId));
  const cautions = unique.filter(row => row.card!.editorial?.caution);
  const sensitivity = profile?.sensitivities.status === 'reported' ? unique.find(row => profile.sensitivities.values.some(term =>
    [row.card!.name, ...row.card!.aliases].some(name => lookupName(name).key === lookupName(term).key))) : null;
  const points: string[] = [];
  if (sensitivity) points.push(`The source list names ${sensitivity.card!.name}, matching your reported sensitivity. Check your package and the ingredient detail; your response remains unknown.`);
  else if (profile?.reactivity === 'reacts_easily' && cautions.length) {
    const card = cautions[0].card!;
    points.push(`You reported skin that reacts easily. ${card.name}: ${card.editorial!.caution} This does not predict your response.`);
  }
  if ((goals.includes('dryness') || profile?.skinBehavior === 'dry_tight') && moisture.length) {
    const reason = goals.includes('dryness') ? 'For your dryness goal' : 'For the dry or tight skin you reported';
    points.push(`${reason}, these source-list functions may be useful context: ${moisture.slice(0, 2).map(row => `${row.card!.name}: ${row.card!.short}`).join('; ')}. This does not establish how much the product will help.`);
  }
  if (profile?.texturePreference?.state === 'known' && profile.texturePreference.value === 'lightweight' &&
    unique.some(row => row.card!.ingredientId === 'petrolatum') && points.length < 2) {
    points.push('Petrolatum’s reference notes a noticeable greasy film. With your lightweight texture preference, check the product’s actual feel; the rest of its formula and the amount matter.');
  }
  if (!points.length) {
    const role = unique.find(row => row.card!.ingredientId !== 'water') ?? unique[0];
    if (role) points.push(`${role.card!.name}: ${role.card!.short}`);
  }
  if (points.length < 2 && !sensitivity && profile?.reactivity !== 'reacts_easily' && cautions.length) {
    const card = cautions[0].card!;
    points.push(`${card.name}: ${card.editorial!.caution}`);
  }
  const scope = reading.evidenceBasis === 'public_source'
    ? `From the published ingredient list${reading.claimLimits.declarationCompleteness !== 'accepted' ? '; it may be incomplete' : ''}.${reading.packageConfirmation === 'unconfirmed' ? ' Your package is not confirmed.' : ''}`
    : 'From the label reading. Product identity and the full formula are not established by ingredient references.';
  return {
    rows,
    sources: formula.sources,
    points: points.slice(0, 2).map(partFourDisplayText),
    scope,
    limit: 'Ingredient functions do not establish this product’s results or your response.',
    profileRevision: context?.success ? context.data.profile?.id ?? null : null,
  };
}
