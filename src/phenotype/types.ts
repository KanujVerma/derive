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

export type SunResponse =
  | 'burns_easily_never_tans'
  | 'burns_easily_tans_minimally'
  | 'burns_moderately_tans_gradually'
  | 'burns_minimally_tans_well'
  | 'rarely_burns_tans_profusely'
  | 'never_burns_deeply_pigmented'
  | 'unknown';

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

export interface TintMetadata {
  shadeFamily: PigmentationFamily;
  undertoneCompatibility: Undertone[];
  ironOxides: boolean; // Photoprotective against High-Energy Visible (HEV) / blue light
  whiteCastRisk: 'none' | 'low' | 'moderate' | 'high';
}

export interface WhiteCastProfile {
  mineralFilters: ('zinc_oxide' | 'titanium_dioxide')[];
  nanoParticle: boolean;
  tinted: boolean;
  estimatedCastLevel: 'none' | 'low' | 'moderate' | 'marked';
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
