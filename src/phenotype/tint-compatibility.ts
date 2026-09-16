import type {
  PigmentationFamily,
  SkinPhenotypeProfile,
  TintCompatibilityResult,
  TintMetadata,
  WhiteCastProfile,
  ProductWhiteCastObservation,
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
 *
 * Treatment benefit (e.g. iron oxides blocking visible light) is ONLY identified when
 * the member has a relevant confirmed signal (e.g. reported PIH tendency), NEVER from
 * pigmentation depth alone.
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
      ironOxideBenefitIdentified: Boolean(
        productTint.ironOxides && (
          profile?.pihTendency?.value === 'sometimes' ||
          profile?.pihTendency?.value === 'often'
        )
      ),
    };
  }

  const memberVal = memberPigmentation.value;
  const productVal = productTint.shadeFamily;

  const memberIndex = PIGMENTATION_ORDER.indexOf(memberVal);
  const productIndex = PIGMENTATION_ORDER.indexOf(productVal);

  // Relevant signal: PIH tendency (never pigmentation depth alone)
  const ironBenefit = Boolean(
    productTint.ironOxides && (
      profile?.pihTendency?.value === 'sometimes' ||
      profile?.pihTendency?.value === 'often'
    )
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
 * Assesses white-cast friction based on catalog-verified or member-observed product data,
 * evaluated against the member's reported white-cast concern.
 *
 * Avoids pseudo-scientific formula-only predictions (e.g. non-nano = instant cast).
 */
export function evaluateWhiteCastRisk(
  observation?: WhiteCastProfile | ProductWhiteCastObservation,
  memberProfile?: SkinPhenotypeProfile
): {
  castRisk: 'none' | 'low' | 'moderate' | 'high' | 'unverified';
  rationale: string;
} {
  if (!observation) {
    return {
      castRisk: 'unverified',
      rationale: 'No verified product white-cast observation available.',
    };
  }

  const castLevel = observation.reportedCastLevel;
  const memberConcern = memberProfile?.whiteCastConcern?.value;

  if (castLevel === 'unverified') {
    return {
      castRisk: 'unverified',
      rationale: 'Product white-cast characteristics have not been catalog-verified.',
    };
  }

  if (castLevel === 'none') {
    return {
      castRisk: 'none',
      rationale: 'Verified product testing indicates no discernible white cast.',
    };
  }

  if (castLevel === 'minimal') {
    return {
      castRisk: 'low',
      rationale: 'Verified product observation reports minimal cast that blends out cleanly.',
    };
  }

  if (castLevel === 'noticeable') {
    const isConcerned = memberConcern === 'moderate' || memberConcern === 'severe';
    return {
      castRisk: isConcerned ? 'high' : 'moderate',
      rationale: isConcerned
        ? 'Reported noticeable cast may present friction given member concern regarding sunscreen cast.'
        : 'Reported noticeable cast upon application; typically requires thorough blending.',
    };
  }

  // Marked cast
  return {
    castRisk: 'high',
    rationale: 'Verified product observation reports marked cast on application.',
  };
}
