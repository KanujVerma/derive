/** Source-limited screening, not a diagnosis, culprit inference or toxicity score.
 * Policy reviewed 2026-10-01. FDA: Common Allergens and What Consumers Can Do.
 * AAD: Contact dermatitis causes (irritation and allergy are distinct).
 * Warshaw et al., PMID 19321115: abstract verified; referred patch-test cohort.
 * This deliberately bounded set is not a complete allergen or irritant database.
 */
export const REACTION_INGREDIENT_POLICY_VERSION = 'reaction-ingredient-flags-v1-2026-10-01';

export interface ReactionIngredientFlag {
  id: string;
  label: string;
  matchedLabel: string;
  kind: 'contact_allergen' | 'irritation_potential';
  explanation: string;
  sources: { label: string; url: string }[];
  policyVersion: string;
}

const FDA = { label: 'FDA cosmetic allergens', url: 'https://www.fda.gov/cosmetics/cosmetic-ingredients/allergens-cosmetics' };
const AAD = { label: 'AAD contact dermatitis causes', url: 'https://www.aad.org/public/diseases/eczema/types/contact-dermatitis/causes' };
const PG = { label: 'Warshaw et al. propylene glycol study', url: 'https://pubmed.ncbi.nlm.nih.gov/19321115/' };
type Rule = { id: string; label: string; aliases: string[]; group: 'fragrance' | 'named_fragrance' | 'preservative' | 'propylene_glycol' };
const rule = (label: string, group: Rule['group'], aliases = [label]): Rule => ({
  id: label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), label, aliases, group,
});
const RULES: Rule[] = [
  rule('Fragrance', 'fragrance', ['Fragrance', 'Parfum', 'Perfume']),
  ...[
    'Amyl Cinnamal', 'Amylcinnamyl Alcohol', 'Anisyl Alcohol', 'Benzyl Alcohol',
    'Benzyl Benzoate', 'Benzyl Cinnamate', 'Benzyl Salicylate', 'Cinnamyl Alcohol',
    'Cinnamaldehyde', 'Citral', 'Citronellol', 'Coumarin', 'Eugenol', 'Farnesol',
    'Geraniol', 'Hydroxycitronellal', 'Isoeugenol', 'Linalool', 'Methyl 2-Octynoate',
  ].map(label => rule(label, 'named_fragrance')),
  rule('d-Limonene', 'named_fragrance'),
  rule('Methylisothiazolinone', 'preservative'),
  rule('Methylchloroisothiazolinone', 'preservative'),
  rule('Formaldehyde', 'preservative'),
  rule('Bronopol', 'preservative', ['Bronopol', '2-bromo-2-nitropropane-1,3-diol']),
  rule('5-bromo-5-nitro-1,3-dioxane', 'preservative'),
  rule('Diazolidinyl Urea', 'preservative'),
  rule('DMDM Hydantoin', 'preservative'),
  rule('Imidazolidinyl Urea', 'preservative'),
  rule('Sodium Hydroxymethylglycinate', 'preservative'),
  rule('Quaternium-15', 'preservative'),
  rule('Propylene Glycol', 'propylene_glycol'),
];
const normalize = (text: string) => text.trim().replace(/\s+/g, ' ').toLowerCase();
const ALIASES = new Map(RULES.flatMap(item => item.aliases.map(alias => [normalize(alias), item] as const)));

/** Parse label entries, not arbitrary prose or ingredient mentions in reviews.
 * Only explicit names or a parenthesized explicit alias are eligible. Never fuzzy
 * match polymers, fatty alcohols or an unsupported essential oil to an allergen.
 */
function entries(text: string): string[] {
  const clean = text.replace(/^\s*(?:inactive\s+)?ingredients\s*:\s*/i, '');
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < clean.length; i += 1) {
    const char = clean[i];
    if (char === '(') depth += 1;
    if (char === ')') { depth -= 1; if (depth < 0) return []; }
    const chemicalComma = char === ',' && /\d/.test(clean[i - 1] ?? '') && /\d/.test(clean[i + 1] ?? '');
    if (depth === 0 && /[,;\n]/.test(char) && !chemicalComma) {
      parts.push(clean.slice(start, i).trim()); start = i + 1;
    }
  }
  if (depth !== 0) return [];
  parts.push(clean.slice(start).trim());
  if (parts.length > 256) return [];
  return parts.filter(part => part.length > 0 && part.length <= 160);
}

export function reactionIngredientFlags(text: unknown): ReactionIngredientFlag[] {
  if (typeof text !== 'string' || text.length > 12_000 || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(text)) return [];
  const found = new Set<string>();
  const flags: ReactionIngredientFlag[] = [];
  for (const entry of entries(text)) {
    const item = ALIASES.get(normalize(entry)) ?? (() => {
      const paired = /^([^()]+)\(([^()]+)\)$/.exec(entry);
      if (!paired) return undefined;
      const first = ALIASES.get(normalize(paired[1]));
      const second = ALIASES.get(normalize(paired[2]));
      // Both parts must identify the same rule; “fragrance free (parfum)” is prose.
      return first && first.id === second?.id ? first : undefined;
    })();
    if (!item || found.has(item.id)) continue;
    found.add(item.id);
    const explanation = item.group === 'fragrance'
      ? 'Fragrance can trigger contact allergy in some people. This label describes a mixture, not its individual chemicals. It does not identify what caused your reported reaction.'
      : item.group === 'propylene_glycol'
        ? 'Propylene glycol has been associated with irritation and contact allergy. The cited study involved patients referred for patch testing, not your individual likelihood or the cause of your reaction.'
        : `${item.label} appears in the FDA list of cosmetic contact allergens. Its presence does not establish an allergy or explain the cause of your reported reaction.`;
    flags.push({ id: item.id, label: item.label, matchedLabel: entry,
      kind: item.group === 'propylene_glycol' ? 'irritation_potential' : 'contact_allergen',
      explanation, sources: item.group === 'propylene_glycol' ? [{ ...PG }, { ...AAD }] : [{ ...FDA }, { ...AAD }],
      policyVersion: REACTION_INGREDIENT_POLICY_VERSION });
  }
  return flags;
}
