import type {
  ProductScanResult,
  ProductScanVerdict,
  Routine,
  UserProduct,
  ProductReaction,
  CheckIn,
  Goal,
  RoutineComplexity,
  ProductCostPreference,
  ProductCategory,
} from '../../types/schema.ts';
import { getBarcodeLookupKeys } from '../../utils/barcode.ts';

export const ProductScanVerdictLabels: Record<ProductScanVerdict, string> = {
  great_fit: 'GREAT FIT',
  could_work: 'COULD WORK',
  fits_plan: 'GREAT FIT',
  not_needed: 'NOT NEEDED',
  better_replacement: 'BETTER AS A REPLACEMENT',
  use_with_caution: 'USE WITH CAUTION',
  not_good_fit: 'NOT A GOOD FIT RIGHT NOW',
};

export interface ScannableProductInput {
  name: string;
  brand: string;
  category: ProductCategory;
  keyActives?: string[];
  ingredients?: string[];
  barcode?: string;
}

export interface UserEvaluationContext {
  routine?: Routine | null;
  userProducts?: UserProduct[];
  reactions?: ProductReaction[];
  checkIns?: CheckIn[];
  primaryGoal?: Goal | null;
  routineComplexity?: RoutineComplexity;
  costPreference?: ProductCostPreference;
  photoContextNote?: string;
  activeDifferinSchedule?: string;
  currentRoutineProducts?: string[];
  recentReactions?: string[];
}

/**
 * Evaluates a scanned product against this specific customer's canonical routine,
 * active schedules, reaction history, check-in stability, and complexity preference.
 *
 * Core question: "Does this product make sense for THIS person right now?"
 */
export function evaluateProductScan(
  product: ScannableProductInput,
  context: UserEvaluationContext
): ProductScanResult {
  const nameLower = product.name.toLowerCase();
  const brandLower = product.brand.toLowerCase();
  const actives = (product.keyActives || []).map((a) => a.toLowerCase());
  const ingredients = (product.ingredients || []).map((i) => i.toLowerCase());

  const routine = context.routine;
  const reactions = context.reactions || [];
  const checkIns = context.checkIns || [];
  const complexity = context.routineComplexity || 'simple';

  const hasDifferin =
    Boolean(context.activeDifferinSchedule) ||
    (context.currentRoutineProducts?.some(
      (p) => p.toLowerCase().includes('differin') || p.toLowerCase().includes('adapalene')
    ) ?? false) ||
    (routine?.pmSteps.some(
      (s) => s.productName.toLowerCase().includes('differin') || s.productName.toLowerCase().includes('adapalene')
    ) ?? false);

  const differinStep = routine?.pmSteps.find(
    (s) => s.productName.toLowerCase().includes('differin') || s.productName.toLowerCase().includes('adapalene')
  );
  const differinSchedule =
    context.activeDifferinSchedule || differinStep?.scheduleText || 'Monday, Wednesday, Friday';

  // Helper to build return object with both field name styles
  const buildResult = (
    base: Omit<ProductScanResult, 'reason' | 'whyBullets'>
  ): ProductScanResult => ({
    ...base,
    reason: base.verdictSummary,
    whyBullets: base.factsUsedToDecide,
  });

  // 1. REACTION / SENSITIVITY CHECK (Strong caution or not good fit)
  const hasFragrance = ingredients.some((i) => i.includes('fragrance') || i.includes('parfum'));
  const isPhysicalScrub = nameLower.includes('scrub') || nameLower.includes('microdermabrasion');

  if (isPhysicalScrub || ((hasFragrance || nameLower.includes('exfoliat')) && hasDifferin)) {
    return buildResult({
      productName: product.name,
      brand: product.brand,
      category: product.category,
      keyActives: product.keyActives || ['Exfoliating particles'],
      verdict: 'not_good_fit',
      verdictLabel: ProductScanVerdictLabels.not_good_fit,
      verdictSummary: isPhysicalScrub
        ? 'Physical scrubs create mechanical micro-friction that significantly elevates irritation risk while you are using Differin.'
        : 'Fragranced formulas carry elevated irritation potential when your skin barrier is adjusting to a retinoid schedule.',
      whatItWouldChangeOrReplace: 'Not recommended for your current routine.',
      factsUsedToDecide: [
        `You use Differin three nights per week (${differinSchedule})`,
        isPhysicalScrub ? 'Physical abrasives damage retinoid-sensitized skin' : 'Contains fragrance, which increases sensitivity risk',
        reactions.length > 0 ? `You have ${reactions.length} logged past reaction(s)` : 'Your barrier is currently prioritizing retinoid tolerance',
      ],
      whyPersonalized: 'Derive prioritizes keeping your barrier calm so your active acne treatment can work without peeling.',
    });
  }

  // 2. REDUNDANCY CHECK (e.g. Niacinamide serum when already in moisturizer)
  const isNiacinamideProduct =
    nameLower.includes('niacinamide') || actives.some((a) => a.includes('niacinamide'));
  const moisturizerHasNiacinamide = routine?.pmSteps.some(
    (s) =>
      s.productName.toLowerCase().includes('toleriane') ||
      s.productName.toLowerCase().includes('cerave') ||
      s.whyChosen.toLowerCase().includes('niacinamide')
  );

  if (isNiacinamideProduct && moisturizerHasNiacinamide) {
    return buildResult({
      productName: product.name,
      brand: product.brand,
      category: product.category,
      keyActives: product.keyActives || ['Niacinamide 10%', 'Zinc PCA 1%'],
      verdict: 'not_needed',
      verdictLabel: ProductScanVerdictLabels.not_needed,
      verdictSummary:
        'You already get niacinamide from your moisturizer, and this would add another step without solving a gap in your plan.',
      whatItWouldChangeOrReplace: 'Redundant with Toleriane Double Repair in your evening routine.',
      factsUsedToDecide: [
        'Your current moisturizer already contains niacinamide',
        `You use Differin three nights per week (${differinSchedule})`,
        checkIns.length > 0
          ? 'Your last two check-ins reported no significant irritation'
          : 'Your skin has shown stable barrier tolerance',
        `You selected a ${complexity === 'simple' ? 'Simple (3-4 steps)' : 'Focused'} routine preference`,
      ],
      whyPersonalized:
        'Derive keeps your routine lean: adding another active product risks barrier overload without extra clearance.',
    });
  }

  // 3. SUNSCREEN CHECK (Better as replacement vs fits plan)
  if (product.category === 'sunscreen') {
    const currentSPF =
      routine?.amSteps.find((s) => s.category === 'sunscreen')?.productName ||
      context.currentRoutineProducts?.find(
        (p) => p.toLowerCase().includes('sunscreen') || p.toLowerCase().includes('spf')
      );
    const hasCurrentSPF = Boolean(currentSPF);
    const verdict: ProductScanVerdict = hasCurrentSPF ? 'better_replacement' : 'great_fit';

    return buildResult({
      productName: product.name,
      brand: product.brand,
      category: 'sunscreen',
      keyActives: product.keyActives || ['UV Filters SPF 50+'],
      verdict,
      verdictLabel: ProductScanVerdictLabels[verdict],
      verdictSummary: hasCurrentSPF
        ? `This is a solid formula that could replace ${currentSPF} if you want to switch, but you don't need both.`
        : 'Daily morning sunscreen and UV protection is essential to prevent post-acne dark marks while using Differin.',
      whatItWouldChangeOrReplace: hasCurrentSPF
        ? `Would replace ${currentSPF} in morning routine.`
        : 'Would add a dedicated morning sunscreen step.',
      factsUsedToDecide: [
        hasCurrentSPF ? `You already have ${currentSPF} in your morning routine` : 'No current sunscreen in AM plan',
        'Daily broad-spectrum SPF is required alongside retinoid usage',
        'Formula matches your balanced cost preference',
      ],
      whyPersonalized: hasCurrentSPF
        ? 'You only need one dependable sunscreen at a time. This fits your plan as a 1:1 replacement.'
        : 'Retinoids increase sun sensitivity; adding high-protection SPF protects skin and speeds dark mark fading.',
    });
  }

  // 4. SECOND STRONG RETINOID / AHA / BHA (Use with caution or not a good fit)
  const isStrongAcidOrRetinoid =
    nameLower.includes('retinol') ||
    nameLower.includes('tretinoin') ||
    nameLower.includes('glycolic') ||
    nameLower.includes('salicylic') ||
    nameLower.includes('bha') ||
    nameLower.includes('aha');

  if (isStrongAcidOrRetinoid && hasDifferin) {
    return buildResult({
      productName: product.name,
      brand: product.brand,
      category: product.category,
      keyActives: product.keyActives || ['Exfoliating Acid / Retinoid'],
      verdict: 'use_with_caution',
      verdictLabel: ProductScanVerdictLabels.use_with_caution,
      verdictSummary:
        'Stacking this with Differin can trigger barrier breakdown, burning, and rapid peeling.',
      whatItWouldChangeOrReplace: 'Would compete with your prescribed Differin application nights.',
      factsUsedToDecide: [
        `You are already scheduled for Differin 3 nights/week (${differinSchedule})`,
        'Combining additional strong exfoliants multiplies barrier permeability',
        'Your primary goal (Breakouts) is best served by consistent Differin adherence',
      ],
      whyPersonalized:
        'Derive safeguards your skin against multi-acid stacking so you get results without a barrier crash.',
    });
  }

  // 5. GENTLE HYDRATING OR SOOTHING PRODUCT (Great fit / Could work)
  return buildResult({
    productName: product.name,
    brand: product.brand,
    category: product.category,
    keyActives: product.keyActives || ['Hydrating / Soothing agents'],
    verdict: 'could_work',
    verdictLabel: ProductScanVerdictLabels.could_work,
    verdictSummary:
      'This is a gentle, supportive formula that aligns with your skin tolerance and barrier goals.',
    whatItWouldChangeOrReplace: 'Could be slotted in as an optional soothing step or used as a backup.',
    factsUsedToDecide: [
      'Formula contains no conflicting actives with Differin',
      'No allergens or irritants matching your reaction history',
      'Matches your balanced cost and skin tolerance baseline',
    ],
    whyPersonalized:
      'While not strictly mandatory for your current 3-step baseline, it is gentle enough to use safely.',
  });
}

/**
 * Common catalog items for instant test scan / barcode identification in prototype.
 */
export const PROTOTYPE_CATALOG: ScannableProductInput[] = [
  {
    name: 'Niacinamide 10% + Zinc 1%',
    brand: 'The Ordinary',
    category: 'serum',
    keyActives: ['Niacinamide 10%', 'Zinc PCA 1%'],
    ingredients: ['Water', 'Niacinamide', 'Pentylene Glycol', 'Zinc PCA', 'Dimethyl Isosorbide'],
    barcode: '769915190602',
  },
  {
    name: 'Anthelios Ultra Light Fluid SPF 60',
    brand: 'La Roche-Posay',
    category: 'sunscreen',
    keyActives: ['Avobenzone', 'Homosalate', 'Octisalate'],
    ingredients: ['Water', 'Dimethicone', 'Isododecane', 'Alcohol Denat.'],
    barcode: '883140012993',
  },
  {
    name: 'Skin Perfecting 2% BHA Liquid Exfoliant',
    brand: "Paula's Choice",
    category: 'treatment',
    keyActives: ['Salicylic Acid 2%', 'Green Tea Extract'],
    ingredients: ['Water', 'Methylpropanediol', 'Butylene Glycol', 'Salicylic Acid', 'Polysorbate 20'],
    barcode: '655439020108',
  },
  {
    name: 'Fresh Apricot Scrub',
    brand: "St. Ives",
    category: 'treatment',
    keyActives: ['Walnut Shell Powder', 'Apricot Extract'],
    ingredients: ['Water', 'Juglans Regia Shell Powder', 'Glyceryl Stearate', 'Glycerin', 'Fragrance'],
    barcode: '077043103847',
  },
  {
    name: 'Hydrating Hyaluronic Acid Serum',
    brand: 'CeraVe',
    category: 'serum',
    keyActives: ['Hyaluronic Acid', 'Ceramides 1, 3, 6-II', 'Vitamin B5'],
    ingredients: ['Water', 'Glycerin', 'Cetearyl Alcohol', 'Ceramide NP', 'Ceramide AP', 'Sodium Hyaluronate'],
    barcode: '360600052793',
  },
];

/**
 * Looks up a catalog product by scanned barcode using resilient key normalization.
 */
export function findProductByBarcode(
  rawBarcode: string,
  catalog: ScannableProductInput[] = PROTOTYPE_CATALOG
): ScannableProductInput | null {
  const lookupKeys = getBarcodeLookupKeys(rawBarcode);
  if (lookupKeys.length === 0) return null;

  for (const item of catalog) {
    if (item.barcode) {
      const itemKeys = getBarcodeLookupKeys(item.barcode);
      if (lookupKeys.some((k) => itemKeys.includes(k))) {
        return item;
      }
    }
  }

  return null;
}

