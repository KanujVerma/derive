import type {
  PigmentationFamily,
  SkinPhenotypeProfile,
  TintCompatibilityResult,
  TintMetadata,
  WhiteCastProfile,
} from './types.ts';

const PIGMENTATION_ORDER: PigmentationFamily[] = [
  'very_light',
  'light',
  'light_medium',
  'medium',
  'medium_deep',
  'deep',
  'very_deep',
];

/**
 * Evaluates categorical shade compatibility for tinted products (e.g. tinted sunscreens).
 *
 * Invariant: Never computes arbitrary numerical match scores (e.g. 84%).
 * Categorical matching only. If member's shade family is unconfirmed or estimated,
 * returns 'needs_confirmation' rather than assuming certainty.
 */
export function evaluateTintCompatibility(
  productTint?: TintMetadata,
  profile?: SkinPhenotypeProfile
): TintCompatibilityResult {
  if (!productTint) {
    return {
      status: 'not_applicable',
      rationale: 'Product does not contain tint pigments or shade-specific formulations.',
      requiresConfirmation: false,
    };
  }

  const memberPigmentation = profile?.pigmentationFamily;

  // Unconfirmed or missing phenotype cannot claim certainty
  if (!memberPigmentation || memberPigmentation.value === 'unknown' || !memberPigmentation.userConfirmed) {
    return {
      status: 'needs_confirmation',
      rationale: 'Member skin-tone family is not yet confirmed. Member confirmation required before verifying shade match.',
      requiresConfirmation: true,
      ironOxideBenefitIdentified: productTint.ironOxides,
    };
  }

  const memberVal = memberPigmentation.value;
  const productVal = productTint.shadeFamily;

  const memberIndex = PIGMENTATION_ORDER.indexOf(memberVal);
  const productIndex = PIGMENTATION_ORDER.indexOf(productVal);

  const ironBenefit = productTint.ironOxides && (
    profile?.pihTendency?.value === 'sometimes' ||
    profile?.pihTendency?.value === 'often' ||
    memberIndex >= 3 // medium to very deep
  );

  // Exact shade family match
  if (memberVal === productVal) {
    const memberUndertone = profile?.undertone?.value;
    if (memberUndertone && memberUndertone !== 'unknown' && !productTint.undertoneCompatibility.includes(memberUndertone)) {
      return {
        status: 'possible_match',
        rationale: `Matches ${memberVal.replace('_', ' ')} depth, but product undertone may lean different from member's ${memberUndertone} undertone.`,
        requiresConfirmation: false,
        ironOxideBenefitIdentified: ironBenefit,
      };
    }

    return {
      status: 'likely_match',
      rationale: `Formulated specifically for ${memberVal.replace('_', ' ')} depth with compatible undertone blending.`,
      requiresConfirmation: false,
      ironOxideBenefitIdentified: ironBenefit,
    };
  }

  // Adjacent shade family match
  if (memberIndex !== -1 && productIndex !== -1 && Math.abs(memberIndex - productIndex) === 1) {
    return {
      status: 'possible_match',
      rationale: `Product shade (${productVal.replace('_', ' ')}) is adjacent to member's confirmed depth (${memberVal.replace('_', ' ')}). May sheer out cleanly.`,
      requiresConfirmation: false,
      ironOxideBenefitIdentified: ironBenefit,
    };
  }

  // Significantly different shade
  return {
    status: 'unlikely_match',
    rationale: `Product shade (${productVal.replace('_', ' ')}) differs noticeably from member's confirmed depth (${memberVal.replace('_', ' ')}). Likely visible mismatch.`,
    requiresConfirmation: false,
    ironOxideBenefitIdentified: ironBenefit,
  };
}

/**
 * Assesses white-cast risk for sunscreen formulations based on mineral filter composition and tinting.
 */
export function evaluateWhiteCastRisk(
  profile: WhiteCastProfile,
  memberProfile?: SkinPhenotypeProfile
): {
  castRisk: 'none' | 'low' | 'moderate' | 'high';
  rationale: string;
} {
  // Tinted formulations with iron oxides mask white cast
  if (profile.tinted) {
    return {
      castRisk: 'none',
      rationale: 'Tinted formulation with iron oxides neutralizes mineral sunscreen white cast.',
    };
  }

  // Non-mineral (chemical) filters have minimal cast risk
  if (profile.mineralFilters.length === 0) {
    return {
      castRisk: 'none',
      rationale: 'Organic (chemical) UV filters leave no mineral white cast.',
    };
  }

  const memberDepth = memberProfile?.pigmentationFamily?.value;
  const isDeeperTone = memberDepth === 'medium_deep' || memberDepth === 'deep' || memberDepth === 'very_deep';

  if (profile.nanoParticle) {
    return {
      castRisk: isDeeperTone ? 'moderate' : 'low',
      rationale: isDeeperTone
        ? 'Micronized mineral filters reduce cast, but may appear slightly ash on deeper skin tones.'
        : 'Micronized mineral filters blend clearly on light to medium skin tones.',
    };
  }

  // Non-nano untinted mineral
  return {
    castRisk: isDeeperTone ? 'high' : 'moderate',
    rationale: isDeeperTone
      ? 'Untinted non-nano mineral zinc/titanium leaves a noticeable chalky or purple/white cast on deeper skin.'
      : 'Untinted non-nano mineral sunscreen leaves a visible cast and requires thorough rubbing to sheer out.',
  };
}
