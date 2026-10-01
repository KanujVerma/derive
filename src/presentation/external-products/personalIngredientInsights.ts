import type { PersonalContextSnapshot as PersonalContextEnvelope } from '../../contracts/PersonalContext.ts';
import type { PublishedIngredientEvidence } from '../../contracts/ProductIngredientLookup.ts';
import { cosmeticContextFromPersonalProfile, type IngredientCosmeticContext } from '../../domain/ingredient-context.ts';

export interface PersonalIngredientInsights {
  status: 'ready' | 'profile_missing' | 'ingredients_missing';
  sentences: string[];
  basis: 'local_rules';
  /** Only bounded exact-name matches used in these notes, not a parsed full formula. */
  ingredientNames: string[];
}

const ALIASES: ReadonlyArray<{ name: string; names: readonly string[] }> = [
  { name: 'Fragrance', names: ['fragrance', 'parfum', 'perfume', 'fragrance parfum', 'parfum fragrance'] },
  { name: 'Alcohol denat.', names: ['alcohol denat', 'denatured alcohol', 'sd alcohol 40', 'sd alcohol 40 b', 'sd alcohol 40b'] },
  { name: 'Glycerin', names: ['glycerin', 'glycerol'] },
  { name: 'Petrolatum', names: ['petrolatum', 'white petrolatum'] },
  { name: 'Dimethicone', names: ['dimethicone'] },
  { name: 'Hyaluronic acid', names: ['hyaluronic acid', 'sodium hyaluronate'] },
];

function token(value: string): string {
  return value.toLowerCase().replace(/^\s*(?:active|inactive)?\s*ingredients?\s*:\s*/, '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b\d+(?:\.\d+)?\s*%/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

function matchedNames(text: string): string[] {
  // Compare complete bounded list entries. Do not confuse fragrance-free claims,
  // polyglycerin or fatty alcohols with the exact fragrance/glycerin/denat. entries.
  const entries = new Set(text.split(/[,;\n\r\u2022]/).slice(0, 400).map(token));
  return ALIASES.filter((ingredient) => ingredient.names.some((name) => entries.has(name))).map((ingredient) => ingredient.name);
}

function namesInSentence(names: string[]): string {
  if (names.length < 3) return names.join(' and ');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

const PROFILE_PROMPT = 'Save your skin type, goals or reactivity to get local ingredient notes matched to that context.';

/**
 * Private local cosmetic notes only: no provider calls or authoritative fit score.
 * General moisture/fragrance notes are grounded in AAD guidance:
 * https://www.aad.org/public/everyday-care/skin-care-basics/dry/dermatologists-tips-relieve-dry-skin
 * https://www.aad.org/public/everyday-care/skin-care-basics/care/skin-care-tips-hands
 * Only the first source list is used; never union potentially different formulas.
 */
export function buildPersonalIngredientInsights(
  context: PersonalContextEnvelope | null,
  evidence: Array<Pick<PublishedIngredientEvidence, 'ingredientsText'>>,
  sourceType: 'published' | 'user_label' = 'published',
  category: 'skincare' | 'other_personal_care' = 'skincare',
): PersonalIngredientInsights {
  const first = evidence.slice(0, 3).find((entry) => typeof entry.ingredientsText === 'string'
    && Boolean(entry.ingredientsText.trim()) && entry.ingredientsText.length <= 24_000);
  if (!first) return { status: 'ingredients_missing', basis: 'local_rules', ingredientNames: [],
    sentences: ['There is no usable ingredient list to compare with your saved profile yet.'] };
  const ingredientNames = matchedNames(first.ingredientsText);
  const profile = context?.profile;
  if (!context || !profile || profile.ownerId !== context.ownerId) {
    return { status: 'profile_missing', basis: 'local_rules', ingredientNames,
      sentences: [PROFILE_PROMPT] };
  }
  const projected = cosmeticContextFromPersonalProfile(profile.data);
  if (!projected) return { status: 'profile_missing', basis: 'local_rules', ingredientNames,
    sentences: [PROFILE_PROMPT] };
  const hasSkinDetails = !['unanswered', 'withheld', 'unsure'].includes(projected.skinBehavior)
    || !['unanswered', 'withheld', 'unsure'].includes(projected.reactivity)
    || projected.goals.length > 0;
  if (!hasSkinDetails) return { status: 'profile_missing', basis: 'local_rules', ingredientNames,
    sentences: ['Your saved profile does not include skin details we can compare with this ingredient list yet.', PROFILE_PROMPT] };
  // Facial goals/type do not establish deodorant, hair or scalp suitability.
  // Retain only general skin-contact reactivity for other personal care.
  const relevantContext: IngredientCosmeticContext = category === 'other_personal_care'
    ? { goals: [], skinBehavior: 'unanswered', reactivity: projected.reactivity } : projected;
  const dry = relevantContext.skinBehavior === 'dry_tight' || relevantContext.goals.includes('dryness');
  const reactive = relevantContext.reactivity === 'reacts_easily';
  const list = sourceType === 'user_label' ? 'the ingredient text you pasted' : 'this published list';
  const has = (name: string) => ingredientNames.includes(name);
  const sentences: string[] = [];
  // Surface possible friction before benefits, without converting caution into a verdict.
  if (has('Fragrance') && (dry || reactive)) {
    sentences.push(`${reactive ? 'You reported that your skin reacts easily' : 'You reported dryness or tightness'}, and ${list} includes fragrance or parfum. A fragrance free alternative may be worth considering. This is a reason for caution, not proof that this product will irritate you.`);
  }
  if (has('Alcohol denat.') && (dry || reactive)) {
    sentences.push(`${dry ? 'Because you reported dryness or tightness' : 'Because you reported that your skin reacts easily'}, alcohol denat. is worth noting in ${list}. It can feel drying or irritating for some people, but its concentration and the full formula matter.`);
  }
  if (dry) {
    const moistureNotes: string[] = [];
    const humectants = ingredientNames.filter((name) => ['Glycerin', 'Hyaluronic acid'].includes(name));
    if (humectants.length) moistureNotes.push(`${namesInSentence(humectants)} ${humectants.length === 1 ? 'helps' : 'help'} draw water into the skin`);
    if (has('Petrolatum')) moistureNotes.push('Petrolatum helps reduce moisture loss');
    if (has('Dimethicone')) moistureNotes.push('Dimethicone is commonly used in moisturizing formulas');
    if (moistureNotes.length) {
      sentences.push(`You reported dryness or tightness, and ${list} includes ingredients used for moisture support. ${moistureNotes.join('. ')}. The ingredient list alone cannot show how well this finished product will moisturize your skin.`);
    }
  }
  if (!sentences.length) {
    const limit = category === 'other_personal_care'
      ? 'Your facial skin type and goals do not tell us how a deodorant or hair care product will suit you. We only compare general skin reactivity for these products.'
      : projected.goals.some((goal) => !['dryness', 'simplify', 'maintain'].includes(goal))
        ? 'These rules compare moisture support and possible irritation. They do not assess whether this product will meet your other skin goals.'
        : 'These rules compare moisture support and possible irritation, not every ingredient or every skin concern.';
    sentences.push(`We found no specific ingredient note for the skin details you saved. ${limit} That is not a compatibility verdict, and it does not mean the product cannot irritate your skin.`);
  }
  sentences.push(sourceType === 'user_label'
    ? 'These notes use ingredient text you pasted, not a formula verified by Derive. Check that the text matches your exact package. They do not identify the cause of a past reaction or predict your individual tolerance.'
    : 'These notes use an unverified published list, not a formula confirmed against your exact package. They do not identify the cause of a past reaction or predict your individual tolerance.');
  return { status: 'ready', basis: 'local_rules', sentences, ingredientNames };
}
