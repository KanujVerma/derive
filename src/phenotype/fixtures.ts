import type {
  ResearchEvidence,
  SkinPhenotypeProfile,
  TintMetadata,
  WhiteCastProfile,
} from './types.ts';
import { createProvenancedValue } from './profile.ts';

/**
 * Arthur's Phenotype Profile Fixture
 *
 * Demonstrates confirmed member phenotype context.
 * Strictly non-racial, grounded in observable cosmetic & response attributes.
 */
export const arthurPhenotypeProfile: SkinPhenotypeProfile = {
  pigmentationFamily: createProvenancedValue('medium', 'self_reported', 'high', true),
  undertone: createProvenancedValue('neutral', 'self_reported', 'medium', true),
  sunResponse: createProvenancedValue('burns_moderately_tans_gradually', 'self_reported', 'high', true),
  pihTendency: createProvenancedValue('sometimes', 'self_reported', 'high', true),
  whiteCastConcern: createProvenancedValue('slight', 'self_reported', 'medium', true),
  razorBumpHistory: createProvenancedValue('occasional', 'self_reported', 'medium', true),
  hairCurlPattern: createProvenancedValue('curly', 'self_reported', 'medium', true),
};

/**
 * Sample unconfirmed photo estimate simulation fixture.
 * Demonstrates a low-friction camera estimate prior to member confirmation.
 */
export const unconfirmedPhotoEstimate: SkinPhenotypeProfile = {
  pigmentationFamily: createProvenancedValue('medium_deep', 'photo_estimate', 'medium', false),
  undertone: createProvenancedValue('warm', 'photo_estimate', 'low', false),
};

/**
 * Sample Tinted Product Metadata Fixtures
 */
export const mockTintedMineralSunscreen: TintMetadata = {
  shadeFamily: 'medium',
  undertoneCompatibility: ['neutral', 'warm'],
  ironOxides: true, // Visible light / HEV photoprotection benefit
  whiteCastRisk: 'none',
};

export const mockFairTintedSunscreen: TintMetadata = {
  shadeFamily: 'light',
  undertoneCompatibility: ['cool', 'neutral'],
  ironOxides: true,
  whiteCastRisk: 'none',
};

export const mockUntintedPhysicalSunscreen: WhiteCastProfile = {
  mineralFilters: ['zinc_oxide', 'titanium_dioxide'],
  nanoParticle: false,
  tinted: false,
  estimatedCastLevel: 'marked',
};

/**
 * Dermatological Research Evidence Fixtures
 * Grounded in peer-reviewed clinical literature.
 */
export const evidenceVisibleLightMelasmaRCT: ResearchEvidence = {
  id: 'ev_rct_iron_oxides_melasma',
  title: 'Randomized Trial of Iron-Oxide Sunscreen in Preventing Visible-Light Hyperpigmentation Relapse',
  citation: 'Castanedo-Cazares JP, et al. Photodermatol Photoimmunol Photomed. 2014;30(1):35-42.',
  url: 'https://pubmed.ncbi.nlm.nih.gov/24313385/',
  grade: 'A',
  summary: 'Randomized controlled trial demonstrating that iron-oxide pigments blocking visible light significantly reduce hyperpigmentation relapses compared to broad-spectrum UVB/UVA filters alone in darker phototypes.',
  populationStudied: 'Patients with melasma and darker phototypes (Fitzpatrick IV-V)',
  applicability: {
    targetPigmentationFamilies: ['medium', 'medium_deep', 'deep', 'very_deep'],
    requiresIronOxides: true,
    requiresPhotoprotection: true,
    pihTendencyApplies: ['sometimes', 'often'],
  },
  directRoutineInfluenceAllowed: true,
};

export const evidenceAadPihGuidance: ResearchEvidence = {
  id: 'ev_aad_dark_spots_photoprotection',
  title: 'AAD Clinical Guidance on Fading Dark Spots and Post-Inflammatory Hyperpigmentation',
  citation: 'American Academy of Dermatology Association. Practice Guidelines: Routine Care for Dark Spots. 2024.',
  url: 'https://www.aad.org/public/everyday-care/skin-care-secrets/routine/fade-dark-spots',
  grade: 'B',
  summary: 'Robust clinical consensus and observational trials supporting consistent daily broad-spectrum SPF 30+ photoprotection with mineral or tinted iron oxides to prevent persistent post-inflammatory marks from darkening.',
  populationStudied: 'Individuals with persistent post-breakout dark marks or melasma',
  applicability: {
    requiresPhotoprotection: true,
    pihTendencyApplies: ['sometimes', 'often'],
  },
  directRoutineInfluenceAllowed: true,
};

export const evidenceDairyAcneObservationalMetaAnalysis: ResearchEvidence = {
  id: 'ev_dairy_acne_meta_analysis',
  title: 'Systematic Review and Meta-Analysis of Dairy Intake and Acne',
  citation: 'Aghasi M, et al. Clin Nutr. 2018;38(3):1067-1077.',
  url: 'https://pubmed.ncbi.nlm.nih.gov/30096883/',
  grade: 'C',
  summary: 'Observational meta-analysis demonstrating a weak statistical association between dairy consumption and acne risk. Lacks randomized controlled trials; represents observational association, not proven individual causation.',
  populationStudied: 'Observational cohort and case-control studies across mixed populations',
  applicability: {},
  directRoutineInfluenceAllowed: false, // Grade C cannot silently alter active skincare routines
};

export const evidenceAnecdotalLemonExtract: ResearchEvidence = {
  id: 'ev_anecdotal_lemon_juice',
  title: 'Preliminary In-Vitro Lemon Extract Topical Application',
  citation: 'Unpublished in-vitro lab study on citrus limon extract.',
  grade: 'D',
  summary: 'Preliminary in-vitro testing showing mild ascorbic acid presence; high phytophotodermatitis risk in vivo.',
  applicability: {},
  directRoutineInfluenceAllowed: false, // Grade D cannot drive product behavior
};
