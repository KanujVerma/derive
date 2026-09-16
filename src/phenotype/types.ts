/**
 * Phenotype and Evidence Types for Derive
 *
 * Grounded in dermatological science, distinct from race, ethnicity, or ancestry.
 * Prototyped strictly in client/mock layer (src/phenotype/).
 * Zero race classifiers, zero Fitzpatrick ML inference, zero colorimetric scoring.
 */

export type EvidenceSource =
  | 'self_reported'
  | 'photo_estimate'
  | 'observed_history'
  | 'derived_from_history'
  | 'external_context';

export type ConfidenceLevel = 'low' | 'medium' | 'high';

export interface ProvenancedValue<T> {
  value: T;
  source: EvidenceSource;
  confidence: ConfidenceLevel;
  userConfirmed: boolean;
  observedAt?: string;
}

export type PigmentationFamily =
  | 'very_light'
  | 'light'
  | 'light_medium'
  | 'medium'
  | 'medium_deep'
  | 'deep'
  | 'very_deep'
  | 'unknown';

export type Undertone =
  | 'cool'
  | 'neutral'
  | 'warm'
  | 'olive'
  | 'unknown';

/**
 * Self-reported sun behavior only.
 * Strictly decoupled from pigmentation depth.
 */
export type SunResponse =
  | 'burns_easily'
  | 'burns_then_tans'
  | 'sometimes_burns_tans'
  | 'rarely_burns_tans_easily'
  | 'not_sure';

export type PihTendency =
  | 'rarely'
  | 'sometimes'
  | 'often'
  | 'unknown';

export type WhiteCastConcern =
  | 'none'
  | 'slight'
  | 'moderate'
  | 'severe'
  | 'unknown';

export type RazorBumpHistory =
  | 'none'
  | 'occasional'
  | 'frequent'
  | 'unknown';

export type HairCurlPattern =
  | 'straight'
  | 'wavy'
  | 'curly'
  | 'coily'
  | 'unknown';

export interface SkinPhenotypeProfile {
  pigmentationFamily?: ProvenancedValue<PigmentationFamily>;
  undertone?: ProvenancedValue<Undertone>;
  sunResponse?: ProvenancedValue<SunResponse>;
  pihTendency?: ProvenancedValue<PihTendency>;
  whiteCastConcern?: ProvenancedValue<WhiteCastConcern>;
  razorBumpHistory?: ProvenancedValue<RazorBumpHistory>;
  hairCurlPattern?: ProvenancedValue<HairCurlPattern>;
}

/**
 * Dermatological & Cosmetic Research Evidence Grades
 *
 * Grade A: High-quality randomized controlled trials (RCTs), systematic reviews, meta-analyses
 * Grade B: Well-designed cohort or case-control analytic studies, robust observational trials
 * Grade C: Small trials, uncontrolled observational studies, mechanistic studies, consensus opinions
 * Grade D: Anecdotal reports, preliminary in-vitro/ex-vivo data, unsubstantiated claims
 */
export type EvidenceGrade = 'A' | 'B' | 'C' | 'D';

export interface ApplicabilityCriteria {
  targetPigmentationFamilies?: PigmentationFamily[];
  requiresIronOxides?: boolean;
  requiresPhotoprotection?: boolean;
  pihTendencyApplies?: PihTendency[];
}

export interface ResearchEvidence {
  id: string;
  title: string;
  citation: string;
  url?: string;
  grade: EvidenceGrade;
  summary: string;
  populationStudied?: string;
  applicability: ApplicabilityCriteria;
  directRoutineInfluenceAllowed: boolean;
}

/**
 * Recommendation / evaluation context for research applicability
 */
export interface EvidenceApplicabilityContext {
  productHasIronOxides?: boolean;
  photoprotectionRelevant?: boolean;
}

/**
 * Grounded product white cast observation.
 * Sourced strictly from catalog verification, member history, or formula analysis,
 * not speculative formula-category predictions.
 */
export interface ProductWhiteCastObservation {
  reportedCastLevel: 'none' | 'minimal' | 'noticeable' | 'marked' | 'unverified';
  source: 'catalog_verified' | 'member_observation' | 'formula_note';
  confidence: ConfidenceLevel;
}

export interface TintMetadata {
  shadeFamily: PigmentationFamily;
  undertoneCompatibility: Undertone[];
  ironOxides: boolean; // Photoprotective against High-Energy Visible (HEV) / blue light
  whiteCastObservation?: ProductWhiteCastObservation;
}

export interface WhiteCastProfile {
  reportedCastLevel: 'none' | 'minimal' | 'noticeable' | 'marked' | 'unverified';
  tinted: boolean;
  provenance: ProductWhiteCastObservation;
}

export type TintCompatibilityStatus =
  | 'likely_match'
  | 'possible_match'
  | 'needs_confirmation'
  | 'unlikely_match'
  | 'not_applicable';

export interface TintCompatibilityResult {
  status: TintCompatibilityStatus;
  rationale: string;
  requiresConfirmation: boolean;
  ironOxideBenefitIdentified?: boolean;
}
