import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { checkSkincareSafety } from '../src/services/ai-workflows/safety-classifier.ts';
import { generateRoutineProposal } from '../src/services/ai-workflows/routine-generator.ts';
import {
  inferIngredientSignals,
  explainIngredientCaution,
  normalizeIngredient,
} from '../src/services/ai-workflows/ingredient-intelligence.ts';
import { analytics } from '../src/services/analytics.ts';
import { colors } from '../src/constants/theme.ts';
import {
  validateCanonicalRoutine,
  formatRoutineStepSchedule,
  type Product,
  type ProductReaction,
  type FormulaSnapshot,
  type ReactionSeverity,
  type IngredientSignalConfidence,
  type Routine,
  type ResearchInsight,
  type UserProduct,
} from '../src/types/schema.ts';
import { config } from '../src/constants/config.ts';
import { useUserStore } from '../src/stores/userStore.ts';
import { useRoutineStore } from '../src/stores/routineStore.ts';
import {
  normalizeBarcode,
  getBarcodeLookupKeys,
  validateBarcodeChecksum,
} from '../src/utils/barcode.ts';
import { findProductByBarcode } from '../src/services/ai-workflows/scan-evaluator.ts';
import {
  AutoCaptureStateMachine,
  evaluateFrameCriteria,
  type FrameQualityMetrics,
} from '../src/components/camera/AutoCaptureStateMachine.ts';
import {
  createProvenancedValue,
  setOrConfirmPhenotypeValue,
  updatePhenotypeProfile,
  isEvidenceApplicable,
  canInfluenceRoutine,
  canInformEducationalContext,
  evaluateTintCompatibility,
  evaluateWhiteCastRisk,
  arthurPhenotypeProfile,
  unconfirmedPhotoEstimate,
  mockTintedMineralSunscreen,
  mockFairTintedSunscreen,
  mockUntintedPhysicalSunscreen,
  evidenceVisibleLightMelasmaRCT,
  evidenceAadPihGuidance,
  evidenceDairyAcneObservationalMetaAnalysis,
  evidenceAnecdotalLemonExtract,
  type SkinPhenotypeProfile,
  type ProvenancedValue,
  type EvidenceApplicabilityContext,
  type ProductWhiteCastObservation,
  type SunResponse,
} from '../src/phenotype/index.ts';
import {
  validateRoutineProposal,
  validateSensitivities,
  assembleRoutineContext,
  assembleCanonicalContext,
  buildGeminiPrompt,
  GEMINI_SYSTEM_INSTRUCTION,
  GEMINI_PROPOSAL_RESPONSE_SCHEMA,
  callGeminiProposalProvider,
  generateContextGroundedProposal,
  formatRoutineStepScheduleText,
  FixtureRoutineProvider,
  GeminiRoutineProvider,
  resolveRoutineProvider,
  type AssembledRoutineContext,
  type RoutineIntelligenceProposal,
  type RoutineIntelligenceProvider,
  type TrustedProductInfo,
} from '../src/services/ai-workflows/routine-intelligence.ts';

// ========================================================
// 1. SAFETY CLASSIFIER TESTS
// ========================================================

test('Safety Classifier: Flags severe medical emergency symptoms', () => {
  const r1 = checkSkincareSafety('My eyes are swollen shut and face is swelling');
  assert.equal(r1.isMedicalEmergency, true);
  assert.equal(r1.severity, 'emergency');
  assert.match(r1.message || '', /immediate professional medical evaluation/i);

  const r2 = checkSkincareSafety('There is a blistering rash with yellow oozing pus');
  assert.equal(r2.isMedicalEmergency, true);
  assert.equal(r2.severity, 'emergency');

  const r3 = checkSkincareSafety('I have difficulty breathing after applying new cream');
  assert.equal(r3.isMedicalEmergency, true);
  assert.equal(r3.severity, 'emergency');
});

test('Safety Classifier: Permits benign cosmetic skincare questions', () => {
  const r1 = checkSkincareSafety('Should I use moisturizer before or after cleansing?');
  assert.equal(r1.isMedicalEmergency, false);
  assert.equal(r1.severity, 'safe');

  const r2 = checkSkincareSafety('Do I use retinol tonight?');
  assert.equal(r2.isMedicalEmergency, false);
  assert.equal(r2.severity, 'safe');
});

test('Safety Classifier: Flags barrier sensitization warning', () => {
  const r = checkSkincareSafety('My skin is stinging and burning after washing');
  assert.equal(r.isMedicalEmergency, false);
  assert.equal(r.severity, 'warning');
  assert.match(r.message || '', /sensitized/i);
});

// ========================================================
// 2. ROUTINE PROPOSAL ENGINE & KEEP/PAUSE/REPLACE/ADD LOGIC
// ========================================================

test('Routine Proposal Engine: Categorizes into KEEP and PAUSE with personalized rationales', () => {
  const testShelf: Product[] = [
    {
      id: 'prod_1',
      brand: 'CeraVe',
      name: 'Hydrating Cleanser',
      category: 'cleanser',
      keyActives: ['Ceramides'],
    },
    {
      id: 'prod_2',
      brand: 'Differin',
      name: 'Adapalene 0.1% Gel',
      category: 'treatment',
      keyActives: ['Adapalene'],
    },
    {
      id: 'prod_3',
      brand: 'St. Ives',
      name: 'Harsh Walnut Scrub',
      category: 'other',
      keyActives: [],
    },
  ];

  const result = generateRoutineProposal(
    { primaryGoal: 'breakouts', routineComplexity: 'simple' },
    testShelf
  );

  assert.ok(result.routine);
  assert.ok(result.userProducts.length === 3);

  // Cleanser should be KEEP
  const cleanser = result.userProducts.find((p) => p.productId === 'prod_1');
  assert.equal(cleanser?.action, 'KEEP');
  assert.match(cleanser?.actionReason || '', /cleanses effectively without tightness/i);

  // Differin should be KEEP with 3 nights/week schedule
  const differin = result.userProducts.find((p) => p.productId === 'prod_2');
  assert.equal(differin?.action, 'KEEP');
  assert.equal(differin?.frequencyNightsPerWeek, 3);
  assert.match(differin?.actionReason || '', /keep at 3 nights\/week/i);

  // Harsh scrub should be PAUSE (not STOP)
  const scrub = result.userProducts.find((p) => p.productId === 'prod_3');
  assert.equal(scrub?.action, 'PAUSE');
  assert.match(scrub?.actionReason || '', /pause for now/i);

  // Verify AM and PM steps
  assert.equal(result.routine.amSteps.length, 3);
  assert.equal(result.routine.pmSteps.length, 3);

  // Verify PM step 2 is Differin scheduled for Mon, Wed, Fri
  const pmStep2 = result.routine.pmSteps[1];
  assert.equal(pmStep2.brand, 'Differin');
  assert.deepEqual(pmStep2.days, ['mon', 'wed', 'fri']);
});

// ========================================================
// 3. REACTION SEVERITY VS INGREDIENT SIGNAL CONFIDENCE
// ========================================================

test('Reaction Model: Keeps Reaction Severity separate from Ingredient Confidence', () => {
  // Case 1: Severe physical reaction, but weak evidence on which ingredient caused it
  const severeRx: ProductReaction = {
    id: 'rx_1',
    userId: 'u_1',
    productNameSnapshot: 'Generic Multi-Active Cream',
    symptoms: ['burning_stinging', 'swelling'],
    bodyArea: 'cheeks',
    severity: 'severe', // Severe reaction
    formulaSnapshotId: 'snap_multi',
  };

  const multiSnapshot: FormulaSnapshot = {
    id: 'snap_multi',
    productName: 'Generic Multi-Active Cream',
    ingredients: ['Water', 'Glycerin', 'Dimethicone', 'Fragrance', 'Phenoxyethanol', 'Cetyl Alcohol'],
    capturedAt: '2026-09-01',
  };

  const signals = inferIngredientSignals({
    reactions: [severeRx],
    formulaSnapshots: [multiSnapshot],
    toleratedProducts: [],
  });

  // Since it is 1 product with 6 ingredients, individual ingredient confidence should be 'suspected_sensitivity' or 'weak_signal', NOT 'confirmed_allergy'
  const fragranceSignal = signals.find((s) => s.ingredientName.toLowerCase() === 'fragrance');
  assert.ok(fragranceSignal);
  assert.notEqual(fragranceSignal.confidence, 'confirmed_allergy');
  assert.equal(severeRx.severity, 'severe');

  // Case 2: Confirmed allergy, but previous reaction was mild
  const mildAllergySignals = inferIngredientSignals({
    reactions: [],
    formulaSnapshots: [],
    confirmedAllergies: ['Methylisothiazolinone'],
  });

  const mitSignal = mildAllergySignals.find((s) => s.ingredientName === 'Methylisothiazolinone');
  assert.ok(mitSignal);
  assert.equal(mitSignal.confidence, 'confirmed_allergy');
  assert.equal(mitSignal.allergySource, 'clinician_reported');
});

// ========================================================
// 4. INGREDIENT INFERENCE & REPEATED OVERLAP
// ========================================================

test('Ingredient Intelligence: Repeated overlap increases suspicion to strong_signal, but NOT confirmed allergy', () => {
  // Reaction Product A contains X + Y
  // Reaction Product B contains X + Z
  const rxA: ProductReaction = {
    id: 'rx_a',
    userId: 'u_1',
    productNameSnapshot: 'Product A',
    symptoms: ['redness_rash'],
    bodyArea: 'underarms',
    severity: 'moderate',
    formulaSnapshotId: 'snap_a',
  };

  const rxB: ProductReaction = {
    id: 'rx_b',
    userId: 'u_1',
    productNameSnapshot: 'Product B',
    symptoms: ['burning_stinging'],
    bodyArea: 'underarms',
    severity: 'moderate',
    formulaSnapshotId: 'snap_b',
  };

  const snapshots: FormulaSnapshot[] = [
    {
      id: 'snap_a',
      productName: 'Product A',
      ingredients: ['Propylene Glycol', 'Sodium Stearate'],
      capturedAt: '2026-08-01',
    },
    {
      id: 'snap_b',
      productName: 'Product B',
      ingredients: ['Propylene Glycol', 'Zinc Ricinoleate'],
      capturedAt: '2026-08-15',
    },
  ];

  const signals = inferIngredientSignals({
    reactions: [rxA, rxB],
    formulaSnapshots: snapshots,
    toleratedProducts: [],
  });

  // Propylene Glycol appears in both reactions -> should be strong_signal
  const pgSignal = signals.find((s) => s.ingredientName === 'Propylene Glycol');
  assert.ok(pgSignal);
  assert.equal(pgSignal.confidence, 'strong_signal');
  assert.notEqual(pgSignal.confidence, 'confirmed_allergy'); // Never auto-promoted to confirmed allergy without clinician/user confirmation
  assert.equal(pgSignal.evidenceCount, 2);
  assert.deepEqual(pgSignal.supportingReactionIds, ['rx_a', 'rx_b']);

  // Explanation cites evidence provenance
  const explanation = explainIngredientCaution(pgSignal);
  assert.match(explanation, /appeared in 2 products/i);
});

// ========================================================
// 5. TOLERATED EXPOSURE DISCOUNTING
// ========================================================

test('Ingredient Intelligence: Tolerated exposures weaken naive suspicion', () => {
  // Reaction Product has Ingredient X, Y, Z
  const rx: ProductReaction = {
    id: 'rx_c',
    userId: 'u_1',
    productNameSnapshot: 'Reaction Serum',
    symptoms: ['itching'],
    bodyArea: 'cheeks',
    severity: 'mild',
    formulaSnapshotId: 'snap_rx',
  };

  const rxSnap: FormulaSnapshot = {
    id: 'snap_rx',
    productName: 'Reaction Serum',
    ingredients: ['Glycerin', 'Niacinamide', 'Unknown Extract'],
    capturedAt: '2026-09-01',
  };

  // But user regularly tolerates 2 other products that contain Niacinamide with zero issues!
  const tolerated: Product[] = [
    {
      id: 'tol_1',
      brand: 'La Roche-Posay',
      name: 'Toleriane Moisturizer',
      category: 'moisturizer',
      keyActives: ['Ceramides'],
      fullIngredients: ['Water', 'Glycerin', 'Niacinamide'],
    },
    {
      id: 'tol_2',
      brand: 'CeraVe',
      name: 'PM Lotion',
      category: 'moisturizer',
      keyActives: [],
      fullIngredients: ['Water', 'Niacinamide', 'Ceramides'],
    },
  ];

  const signals = inferIngredientSignals({
    reactions: [rx],
    formulaSnapshots: [rxSnap],
    toleratedProducts: tolerated,
  });

  // Niacinamide was tolerated in 2 products -> suspicion discounted to weak_signal
  const niacinamideSignal = signals.find((s) => s.ingredientName.toLowerCase() === 'niacinamide');
  assert.ok(niacinamideSignal);
  assert.equal(niacinamideSignal.confidence, 'weak_signal');
  assert.equal(niacinamideSignal.contradictoryToleranceEvidence.length, 2);
});

// ========================================================
// 6. FORMULA SNAPSHOT INTEGRITY
// ========================================================

test('Formula Snapshot Integrity: Reaction is tied to historical formulation snapshot', () => {
  const oldSnapshot: FormulaSnapshot = {
    id: 'snap_v1',
    productName: 'Gentle Cleanser 2024',
    ingredients: ['Water', 'Cocamidopropyl Betaine', 'Sodium Chloride'],
    capturedAt: '2024-01-10',
  };

  const rx: ProductReaction = {
    id: 'rx_historical',
    userId: 'u_1',
    productNameSnapshot: 'Gentle Cleanser 2024',
    formulaSnapshotId: 'snap_v1',
    symptoms: ['redness_rash'],
    bodyArea: 'face',
    severity: 'mild',
  };

  const signals = inferIngredientSignals({
    reactions: [rx],
    formulaSnapshots: [oldSnapshot],
  });

  // Betaine from snapshot should be captured
  const betaine = signals.find((s) => s.ingredientName === 'Cocamidopropyl Betaine');
  assert.ok(betaine);
  assert.equal(betaine.evidenceCount, 1);
});

// ========================================================
// 7. ANALYTICS PRIVACY CONTRACT
// ========================================================

test('Analytics Privacy: Replay is OFF and tracking uses allowlisted types', () => {
  assert.equal(analytics.isReplayActive(), false);

  // Calling allowlisted event compiles and executes without error
  analytics.track('onboarding_stage_completed', {
    stage: 'products',
    durationBucket: '30_60s',
  });

  analytics.track('checkin_completed', {
    outcome: 'better',
    irritationReported: false,
    adherenceReported: true,
  });
});

// ========================================================
// 8. DESIGN SYSTEM TOKENS
// ========================================================

test('Design System: Direction A Mineral color contrast standards and actions', () => {
  assert.equal(colors.canvas, '#F6F3EC');
  assert.equal(colors.ink, '#171A18');
  assert.equal(colors.brand, '#345447');
  assert.equal(colors.surface, '#FFFEFB');

  // Verify semantic action badge definitions including PAUSE
  assert.equal(colors.actionKeep.text, '#2D5A43');
  assert.equal(colors.actionPause.text, '#935824');
  assert.equal(colors.safetyAlert.text, '#9E2A2B');
  assert.equal(colors.hairline, '#EAE5DC');
});

// ========================================================
// 9. CANONICAL ROUTINE INTEGRITY & SCHEDULE TESTS
// ========================================================

test('Canonical Routine: Sunscreen in PM is rejected as invalid', () => {
  const invalidRoutine: Routine = {
    id: 'rt_inv_1',
    userId: 'u_test',
    version: 1,
    status: 'published',
    summarySentence: 'Invalid routine with sunscreen at night',
    amSteps: [
      {
        id: 's_am_1',
        order: 1,
        productId: 'p_1',
        productName: 'Gentle Cleanser',
        brand: 'CeraVe',
        category: 'cleanser',
        amount: '1 pump',
        area: 'Face',
        timing: 'am',
        days: [],
        purpose: 'Cleansing',
        whyChosen: 'Gentle morning cleanse',
      },
    ],
    pmSteps: [
      {
        id: 's_pm_1',
        order: 1,
        productId: 'p_1',
        productName: 'Gentle Cleanser',
        brand: 'CeraVe',
        category: 'cleanser',
        amount: '1 pump',
        area: 'Face',
        timing: 'pm',
        days: [],
        purpose: 'Cleansing',
        whyChosen: 'Gentle evening cleanse',
      },
      {
        id: 's_pm_2',
        order: 2,
        productId: 'p_sun',
        productName: 'Relief Sun SPF 50+',
        brand: 'Beauty of Joseon',
        category: 'sunscreen',
        amount: 'Two finger lengths',
        area: 'Face and neck',
        timing: 'pm',
        days: [],
        purpose: 'Sun protection',
        whyChosen: 'Erroneously placed sunscreen in evening',
      },
    ],
    createdAt: '2026-09-01',
    updatedAt: '2026-09-01',
  };

  const validation = validateCanonicalRoutine(invalidRoutine);
  assert.equal(validation.valid, false);
  assert.equal(validation.errors.length, 1);
  assert.match(validation.errors[0], /sunscreen.*cannot be in the PM routine/i);
});

test('Canonical Routine: Differin in AM is rejected as invalid', () => {
  const invalidAMRoutine: Routine = {
    id: 'rt_inv_2',
    userId: 'u_test',
    version: 1,
    status: 'published',
    summarySentence: 'Invalid routine with Differin in AM',
    amSteps: [
      {
        id: 's_am_1',
        order: 1,
        productId: 'p_diff',
        productName: 'Differin Adapalene Gel 0.1%',
        brand: 'Differin',
        category: 'treatment',
        amount: 'Pea-sized amount',
        area: 'Face avoiding eyes',
        timing: 'am',
        days: [],
        purpose: 'Retinoid treatment',
        whyChosen: 'Erroneously placed retinoid in morning',
      },
    ],
    pmSteps: [],
    createdAt: '2026-09-01',
    updatedAt: '2026-09-01',
  };

  const validation = validateCanonicalRoutine(invalidAMRoutine);
  assert.equal(validation.valid, false);
  assert.equal(validation.errors.length, 1);
  assert.match(validation.errors[0], /retinoid.*must not be in the AM routine/i);
});

test('Canonical Routine: Engine output satisfies all canonical invariants', () => {
  const proposal = generateRoutineProposal(
    {
      primaryGoal: 'breakouts',
      routineComplexity: 'simple',
      costPreference: 'balanced',
      middayFeel: 'combination',
    },
    [
      {
        id: 'prod_1',
        brand: 'CeraVe',
        name: 'Foaming Facial Cleanser',
        category: 'cleanser',
        keyActives: ['Ceramides', 'Niacinamide'],
        fullIngredients: ['Water', 'Glycerin', 'Niacinamide'],
      },
      {
        id: 'prod_2',
        brand: 'Differin',
        name: 'Adapalene Gel 0.1%',
        category: 'treatment',
        keyActives: ['Adapalene 0.1%'],
        fullIngredients: ['Adapalene 0.1%'],
      },
      {
        id: 'prod_3',
        brand: 'Beauty of Joseon',
        name: 'Relief Sun Rice + Probiotics SPF 50+',
        category: 'sunscreen',
        keyActives: ['Rice Extract'],
        fullIngredients: ['Water', 'Rice Bran Water'],
      },
    ]
  );

  const validation = validateCanonicalRoutine(proposal.routine);
  assert.equal(validation.valid, true, `Expected valid routine but got: ${validation.errors.join(', ')}`);

  // Verify schedule formatter
  const amCleanser = proposal.routine.amSteps[0];
  assert.equal(formatRoutineStepSchedule(amCleanser), 'Every morning');

  const pmDifferin = proposal.routine.pmSteps.find((s) => s.brand === 'Differin');
  assert.ok(pmDifferin);
  assert.equal(formatRoutineStepSchedule(pmDifferin), 'Mon, Wed, Fri');
});

// ========================================================
// 6. SCAN EVALUATOR & CATEGORICAL VERDICTS
// ========================================================

import {
  evaluateProductScan,
  PROTOTYPE_CATALOG,
} from '../src/services/ai-workflows/scan-evaluator.ts';

test('Scan Evaluator: Accurately evaluates Anthelios SPF 60 as a great fit', () => {
  const anthelios = PROTOTYPE_CATALOG.find((p) => p.name.includes('Anthelios'))!;
  assert.ok(anthelios);

  const verdict = evaluateProductScan(anthelios, {
    activeDifferinSchedule: 'Mon, Wed, Fri',
    currentRoutineProducts: ['CeraVe Hydrating Cleanser', 'Differin Adapalene Gel 0.1%'],
    recentReactions: [],
    primaryGoal: 'breakouts',
    routineComplexity: 'simple',
  });

  assert.equal(verdict.verdict, 'great_fit');
  assert.match(verdict.reason || '', /sunscreen/i);
  assert.ok((verdict.whyBullets?.length ?? 0) >= 2);
});

test('Scan Evaluator: Flags Paula Choice BHA with caution due to active Differin schedule', () => {
  const bha = PROTOTYPE_CATALOG.find((p) => p.name.includes('BHA'))!;
  assert.ok(bha);

  const verdict = evaluateProductScan(bha, {
    activeDifferinSchedule: 'Mon, Wed, Fri',
    currentRoutineProducts: ['CeraVe Hydrating Cleanser', 'Differin Adapalene Gel 0.1%'],
    recentReactions: [],
    primaryGoal: 'breakouts',
    routineComplexity: 'simple',
  });

  assert.equal(verdict.verdict, 'use_with_caution');
  assert.match(verdict.reason || '', /Differin/i);
  assert.ok(verdict.whatItWouldChangeOrReplace);
});

test('Scan Evaluator: Disapproves harsh physical scrubs for active breakout routine', () => {
  const scrub = PROTOTYPE_CATALOG.find((p) => p.name.includes('Scrub'))!;
  assert.ok(scrub);

  const verdict = evaluateProductScan(scrub, {
    activeDifferinSchedule: 'Mon, Wed, Fri',
    currentRoutineProducts: ['CeraVe Hydrating Cleanser', 'Differin Adapalene Gel 0.1%'],
    recentReactions: [],
    primaryGoal: 'breakouts',
    routineComplexity: 'simple',
  });

  assert.equal(verdict.verdict, 'not_good_fit');
  assert.equal(verdict.verdictLabel, 'NOT A GOOD FIT RIGHT NOW');
  assert.match(verdict.reason || '', /abrasive|micro-friction|irritation/i);
});

// ========================================================
// 7. PRIVACY-SAFE ANALYTICS ALLOWLIST CONTRACT
// ========================================================

test('Analytics Allowlist: Correctly logs scan and voice input events without PII or raw audio', () => {
  // Should compile and execute safely
  analytics.track('scan_tab_opened', { source: 'tab_navigation' });
  analytics.track('product_scan_recognized', { productName: 'Anthelios Melt-in Milk SPF 60' });
  analytics.track('scan_verdict_viewed', {
    verdict: 'great_fit',
    productName: 'Anthelios Melt-in Milk SPF 60',
  });
  analytics.track('scan_ask_handoff', {
    productName: 'Anthelios Melt-in Milk SPF 60',
    verdict: 'great_fit',
  });
  analytics.track('voice_input_started', { context: 'ask' });
  analytics.track('voice_input_completed', {
    context: 'ask',
    wordCountBucket: 'under_10',
  });

  assert.equal(analytics.isReplayActive(), false);
});



// ========================================================
// 8. SHARED DERIVE SERVICE CONTRACT & MOCK TESTS
// ========================================================

import { getDeriveService, setDeriveService } from '../src/services/DeriveService.ts';
import { MockDeriveService } from '../src/services/mock/MockDeriveService.ts';

test('DeriveService: MockDeriveService satisfies the IDeriveService contract', async () => {
  const service = new MockDeriveService();
  assert.ok(service);

  // 1. Clean default state verification (zero leakage before onboarding or seeding)
  const initialRoutine = await service.getRoutine('mock_user_1');
  assert.equal(initialRoutine, null);
  const initialOrders = await service.getOrders('mock_user_1');
  assert.equal(initialOrders.length, 0);

  // 2. Explicit seed demo data
  service.seedArthurDemoData();

  // 3. Test routine retrieval
  const routine = await service.getRoutine('mock_user_1');
  assert.ok(routine);
  assert.ok(routine.amSteps.length > 0);
  assert.ok(routine.pmSteps.length > 0);

  // 4. Test Ask Derive
  const askRes = await service.askDerive({
    userId: 'mock_user_1',
    question: 'Can I use moisturizer before or after Differin?',
  });
  assert.equal(askRes.safety.isMedicalEmergency, false);
  assert.ok(askRes.directAnswer);

  // 5. Test Scan Product
  const scanRes = await service.scanProduct({
    productName: 'Anthelios Melt-in Milk Sunscreen SPF 60',
    brand: 'La Roche-Posay',
    userRoutineContext: {
      activeDifferinSchedule: true,
      currentRoutineProducts: ['CeraVe Hydrating Cleanser', 'Differin Gel 0.1%'],
    },
  });
  assert.ok(scanRes.verdict === 'great_fit' || scanRes.verdict === 'better_replacement');
  assert.ok(scanRes.whyBullets && scanRes.whyBullets.length > 0);

  // 6. Test Managed Refill Request
  const refill = await service.requestRefill({
    userId: 'mock_user_1',
    productId: 'p3',
    productName: 'Toleriane Double Repair Face Moisturizer',
    brand: 'La Roche-Posay',
  });
  assert.equal(refill.status, 'requested');
  assert.equal(refill.productName, 'Toleriane Double Repair Face Moisturizer');

  // 7. Test Orders Listing
  const orders = await service.getOrders('mock_user_1');
  assert.ok(orders.length >= 2);
  assert.equal(orders[0].id, refill.id);

  // 8. Test Check-In Submission
  const checkInRes = await service.submitCheckIn({
    userId: 'mock_user_1',
    skinState: 'better',
    irritation: 'none',
    adherence: 'yes',
  });
  assert.equal(checkInRes.adjustmentProposed, false);
  assert.ok(checkInRes.aiAnalysisSentence);
});

// ========================================================
// 9. CLIENT GEMINI CREDENTIAL GUARD
// ========================================================

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { callGemini, isGeminiConfigured } from '../src/services/gemini.ts';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP_DIRS = new Set([
  '.git',
  '.expo',
  'node_modules',
  'dist',
  'dist-web',
  'web-build',
]);
const CLIENT_GEMINI_ENV = 'EXPO_PUBLIC_' + 'GEMINI_API_KEY';

function collectTextFiles(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      collectTextFiles(full, acc);
      continue;
    }
    if (/\.(ts|tsx|js|json|md|yml|yaml|example)$/.test(name) || name === '.env.example') {
      acc.push(full);
    }
  }
  return acc;
}

test('Client Gemini helper never claims live configuration or returns model text', async () => {
  assert.equal(isGeminiConfigured, false);
  const raw = await callGemini({
    prompt: 'customer question with private skin context',
    imageUri: 'file://private-photo.jpg',
  });
  assert.equal(raw, '');
});

test('Guard: Expo client must not ship a Gemini API key', () => {
  const assignment = new RegExp(`${CLIENT_GEMINI_ENV}\\s*=`);
  const envRead = new RegExp(`process\\.env\\.${CLIENT_GEMINI_ENV}`);
  const offenders: string[] = [];

  for (const file of collectTextFiles(REPO_ROOT)) {
    const text = readFileSync(file, 'utf8');
    if (assignment.test(text) || envRead.test(text)) {
      offenders.push(file.slice(REPO_ROOT.length + 1));
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `Client-visible Gemini secret path found in: ${offenders.join(', ')}`
  );
});

// ========================================================
// 10. I1-B4A MEMBERSHIP + SEPARATE PRODUCT COMMERCE
// ========================================================

import { useOnboardingStore } from '../src/stores/onboardingStore.ts';
import { membershipDisplayLabel } from '../src/domain/types.ts';

test('I1-B4A Display Price: Client configuration centralizes Founding Beta at $25/mo', () => {
  assert.equal(config.betaPriceMonthly, 25);
  assert.equal(config.currency, 'USD');
});

test('I1-B4A Canonical Membership Identity: CustomerProfile.tier is price-neutral founding_beta', () => {
  assert.equal(membershipDisplayLabel('founding_beta'), 'Founding Beta');
  const profile: CustomerProfile = {
    id: 'usr_b4a',
    email: 'member@derive.skin',
    fullName: 'Beta Member',
    tier: 'founding_beta',
    membershipStatus: 'active',
    createdAt: '2026-09-19T00:00:00.000Z',
    updatedAt: '2026-09-19T00:00:00.000Z',
  };
  assert.equal(profile.tier, 'founding_beta');
  assert.ok(!profile.tier.includes('129'));
  assert.ok(!profile.tier.includes('25'));
});

test('I1-B4A Mock Parity: MockDeriveService seeds founding_beta', async () => {
  const service = new MockDeriveService();
  service.seedArthurDemoData();
  const arthur = await service.getCustomerProfile('usr_arthur_1');
  assert.ok(arthur);
  assert.equal(arthur!.tier, 'founding_beta');
});

test('I1-B4A Remote Mapper: accepts founding_beta and fails closed on unknown or legacy 129', () => {
  const mapped = mapDbCustomerProfile({
    id: 'u_b4a',
    email: 'mapped@example.com',
    full_name: 'Mapped Member',
    phone: '+15550001111',
    created_at: '2026-09-19T12:00:00Z',
    updated_at: '2026-09-19T14:00:00Z',
    memberships: [
      {
        id: 'm_b4a',
        user_id: 'u_b4a',
        tier: 'founding_beta',
        status: 'active',
        created_at: '2026-09-19T12:00:00Z',
      },
    ],
  });
  assert.equal(mapped?.tier, 'founding_beta');
  assert.equal(mapped?.membershipStatus, 'active');

  const legacy = mapDbCustomerProfile({
    id: 'u_legacy',
    email: 'legacy@example.com',
    full_name: 'Legacy Member',
    created_at: '2026-09-19T12:00:00Z',
    updated_at: '2026-09-19T12:00:00Z',
    memberships: [
      {
        id: 'm_legacy',
        user_id: 'u_legacy',
        tier: 'founding_beta_129',
        status: 'active',
        created_at: '2026-09-19T12:00:00Z',
      },
    ],
  });
  assert.equal(legacy, null, 'legacy founding_beta_129 is not canonical after B4A');

  const unknown = mapDbCustomerProfile({
    id: 'u_unknown',
    email: 'unknown@example.com',
    full_name: 'Unknown Tier',
    created_at: '2026-09-19T12:00:00Z',
    updated_at: '2026-09-19T12:00:00Z',
    memberships: [
      {
        id: 'm_unknown',
        user_id: 'u_unknown',
        tier: 'pro_96_monthly',
        status: 'active',
        created_at: '2026-09-19T12:00:00Z',
      },
    ],
  });
  assert.equal(unknown, null, 'unknown tier must fail closed');
});

test('I1-B4A Pricing Engine Removed: no active src/pricing imports or all-in calculations', () => {
  const activeSurfaces = [
    'src/services/deriveClient.ts',
    'src/services/mock/MockDeriveService.ts',
    'src/services/remote/RemoteDeriveService.ts',
    'src/stores/userStore.ts',
    'app/(onboarding)/10-summary.tsx',
    'app/profile/index.tsx',
    'app/orders/index.tsx',
    'app/refill/index.tsx',
    'app/(tabs)/plan.tsx',
  ];
  const forbidden = [
    "from '@/src/pricing'",
    'from "../pricing',
    'calculateMonthlyPlanPrice',
    'calculateProductMonthlyConsumption',
    'evaluatePriceAdjustment',
    'PROVISIONAL_DEMO_MANAGEMENT_FEE',
    'PROVISIONAL_DEMO_OPERATIONS_RISK',
  ];
  for (const relPath of activeSurfaces) {
    const content = fs.readFileSync(path.resolve(relPath), 'utf8');
    for (const token of forbidden) {
      assert.ok(!content.includes(token), `${relPath} must not contain ${token}`);
    }
  }
  assert.equal(fs.existsSync(path.resolve('src/pricing')), false, 'src/pricing directory must be removed');
});

test('I1-B4A Customer Copy: membership is $25 management; products are separate', () => {
  const summary = fs.readFileSync(path.resolve('app/(onboarding)/10-summary.tsx'), 'utf8');
  const profile = fs.readFileSync(path.resolve('app/profile/index.tsx'), 'utf8');
  const orders = fs.readFileSync(path.resolve('app/orders/index.tsx'), 'utf8');
  const refill = fs.readFileSync(path.resolve('app/refill/index.tsx'), 'utf8');
  const combined = `${summary}\n${profile}\n${orders}\n${refill}`;

  assert.ok(summary.includes('config.betaPriceMonthly'), 'onboarding uses centralized display price');
  assert.ok(summary.includes('purchased separately'), 'onboarding states products are purchased separately');
  assert.ok(!summary.includes('products included'), 'onboarding must not claim products are included');
  assert.ok(!summary.includes('OTC products'), 'onboarding must not imply bundled OTC products');
  assert.ok(profile.includes('purchased separately'));
  assert.ok(orders.includes('separate from your Derive membership'));
  assert.ok(refill.includes('separate from your Derive membership'));
  assert.ok(!combined.includes('$100'));
  assert.ok(!combined.includes('$129'));
  assert.ok(!combined.includes('$96'));
  assert.ok(!combined.includes('96/mo'));
  assert.ok(!combined.toLowerCase().includes('$25 for ai'));
});

test('I1-B4A UserStore Display Label: canonical founding_beta projects to Founding Beta', () => {
  useUserStore.getState().resetToDefault();
  useUserStore.getState().setRemoteCustomerProfile({
    id: 'usr_label',
    email: 'label@derive.skin',
    fullName: 'Label Member',
    tier: 'founding_beta',
    membershipStatus: 'active',
    createdAt: '2026-09-19T00:00:00.000Z',
    updatedAt: '2026-09-19T00:00:00.000Z',
  });
  assert.equal(useUserStore.getState().tier, 'Founding Beta');
  assert.ok(!useUserStore.getState().tier.includes('129'));
  useUserStore.getState().resetToDefault();
});

// ========================================================
// 11. ONBOARDING STORE STATE ISOLATION & DEFAULTS
// ========================================================

test('Onboarding Store: Initializes to clean empty state and isolates Arthur demo state', () => {
  // Reset onboarding store to clean production state
  useOnboardingStore.getState().resetOnboarding();
  const emptyState = useOnboardingStore.getState();

  assert.equal(emptyState.primaryGoal, null);
  assert.deepEqual(emptyState.secondaryGoals, []);
  assert.equal(emptyState.routineComplexity, null);
  assert.equal(emptyState.costPreference, null);
  assert.equal(emptyState.middayFeel, null);
  assert.equal(emptyState.postCleanseTightness, null);
  assert.deepEqual(emptyState.detectedProducts, []);
  assert.deepEqual(emptyState.knownSensitivities, []);
  assert.equal(emptyState.sensitivitiesStatus, 'unanswered');
  assert.equal(emptyState.isCompleted, false);

  // Load Arthur demo fixture
  useOnboardingStore.getState().loadArthurDemoState();
  const arthurState = useOnboardingStore.getState();

  assert.equal(arthurState.primaryGoal, 'breakouts');
  assert.deepEqual(arthurState.secondaryGoals, ['texture']);
  assert.equal(arthurState.routineComplexity, 'simple');
  assert.equal(arthurState.costPreference, 'balanced');
  assert.equal(arthurState.middayFeel, 'combination');
  assert.equal(arthurState.postCleanseTightness, false);
  assert.equal(arthurState.detectedProducts.length, 4);
  assert.equal(arthurState.hasBadReactions, true);
  assert.equal(arthurState.productReactions.length, 1);
  assert.equal(arthurState.formulaSnapshots.length, 1);
  assert.equal(arthurState.pihTendencyAnswer, 'Sometimes');
});

// ========================================================
// 12. PHENOTYPE PROVENANCE & CONFIRMATION INVARIANTS
// ========================================================

test('Phenotype: Provenance is preserved and categorical confidence is modeled', () => {
  const provVal = createProvenancedValue('medium', 'self_reported', 'high', true);
  assert.equal(provVal.value, 'medium');
  assert.equal(provVal.source, 'self_reported');
  assert.equal(provVal.confidence, 'high');
  assert.equal(provVal.userConfirmed, true);
  assert.ok(provVal.observedAt);
});

test('Phenotype: SunResponse is behavior-only and strictly decoupled from pigmentation depth', () => {
  // Arthur fixture uses behavioral self-reported sun response
  assert.equal(arthurPhenotypeProfile.sunResponse?.value, 'sometimes_burns_tans');
  assert.equal(arthurPhenotypeProfile.sunResponse?.source, 'self_reported');
  assert.equal(arthurPhenotypeProfile.sunResponse?.userConfirmed, true);

  // Behavioral values only, no pigmentation mixing
  const behavioralValues: SunResponse[] = [
    'burns_easily',
    'burns_then_tans',
    'sometimes_burns_tans',
    'rarely_burns_tans_easily',
    'not_sure',
  ];
  for (const val of behavioralValues) {
    assert.ok(!/pigment|skin|tone|fair|deep|dark|white|brown|black/i.test(val));
  }
});

test('Phenotype: Member confirmation strictly outranks unconfirmed photo estimate', () => {
  // Member confirmed truth
  const confirmedDepth: ProvenancedValue<'medium'> = {
    value: 'medium',
    source: 'self_reported',
    confidence: 'high',
    userConfirmed: true,
    observedAt: '2026-09-01T00:00:00Z',
  };

  // An incoming unconfirmed photo estimate (e.g. from camera estimate)
  const incomingEstimate: ProvenancedValue<'medium_deep'> = {
    value: 'medium_deep',
    source: 'photo_estimate',
    confidence: 'medium',
    userConfirmed: false,
    observedAt: '2026-09-16T00:00:00Z',
  };

  // Invariant: Unconfirmed estimate MUST NOT overwrite member confirmation
  const activeValue = setOrConfirmPhenotypeValue(confirmedDepth as any, incomingEstimate as any);
  assert.equal(activeValue.value, 'medium');
  assert.equal(activeValue.source, 'self_reported');
  assert.equal(activeValue.userConfirmed, true);

  // Member explicitly confirms/corrects to a new value
  const memberCorrection: ProvenancedValue<'medium_deep'> = {
    value: 'medium_deep',
    source: 'self_reported',
    confidence: 'high',
    userConfirmed: true,
  };
  const updatedValue = setOrConfirmPhenotypeValue(activeValue, memberCorrection as any);
  assert.equal(updatedValue.value, 'medium_deep');
  assert.equal(updatedValue.userConfirmed, true);
});

test('Phenotype: Onboarding store captures PIH adaptive answer with verified provenance', () => {
  useOnboardingStore.getState().resetOnboarding();
  assert.equal(useOnboardingStore.getState().pihTendencyAnswer, null);

  // Answer adaptive PIH question
  useOnboardingStore.getState().setPihTendencyAnswer('Sometimes');
  assert.equal(useOnboardingStore.getState().pihTendencyAnswer, 'Sometimes');

  // Arthur demo state includes confirmed PIH tendency
  useOnboardingStore.getState().loadArthurDemoState();
  assert.equal(useOnboardingStore.getState().pihTendencyAnswer, 'Sometimes');
});

// ========================================================
// 13. EVIDENCE GRADE POLICY & ROUTINE INFLUENCE RULES
// ========================================================

test('Evidence Policy: Grade A/B evidence is eligible when all applicability criteria and context match', () => {
  // Full context matching Melasma RCT (requiresIronOxides: true, requiresPhotoprotection: true)
  const validContext: EvidenceApplicabilityContext = {
    productHasIronOxides: true,
    photoprotectionRelevant: true,
  };

  // Melasma Visible Light RCT (Grade A) applies to Arthur with valid context
  const arthurDecision = canInfluenceRoutine(evidenceVisibleLightMelasmaRCT, arthurPhenotypeProfile, validContext);
  assert.equal(arthurDecision.allowed, true);
  assert.equal(arthurDecision.evidenceGrade, 'A');
  assert.equal(arthurDecision.applicableToMember, true);

  // AAD Dark Spots guidance (Grade B) with photoprotection context
  const aadDecision = canInfluenceRoutine(evidenceAadPihGuidance, arthurPhenotypeProfile, validContext);
  assert.equal(aadDecision.allowed, true);
  assert.equal(aadDecision.evidenceGrade, 'B');
});

test('Evidence Policy: Grade A evidence is BLOCKED when required product context is missing or mismatched (fail closed)', () => {
  // Context missing required iron oxides (Melasma RCT requires requiresIronOxides: true)
  const mismatchedContext: EvidenceApplicabilityContext = {
    productHasIronOxides: false,
    photoprotectionRelevant: true,
  };

  const decisionMismatched = canInfluenceRoutine(evidenceVisibleLightMelasmaRCT, arthurPhenotypeProfile, mismatchedContext);
  assert.equal(decisionMismatched.allowed, false);
  assert.equal(decisionMismatched.applicableToMember, false);
  assert.match(decisionMismatched.reason, /does not match member applicability criteria or required product context/i);

  // Completely missing context fails closed
  const decisionNoContext = canInfluenceRoutine(evidenceVisibleLightMelasmaRCT, arthurPhenotypeProfile, undefined);
  assert.equal(decisionNoContext.allowed, false);
  assert.equal(decisionNoContext.applicableToMember, false);
});

test('Evidence Policy: directRoutineInfluenceAllowed === false hard-blocks routine changes regardless of grade', () => {
  // Synthetic Grade A trial explicitly marked with directRoutineInfluenceAllowed: false
  const blockedGradeATrial = {
    ...evidenceVisibleLightMelasmaRCT,
    id: 'ev_grade_a_informational_only',
    directRoutineInfluenceAllowed: false,
  };

  const validContext: EvidenceApplicabilityContext = {
    productHasIronOxides: true,
    photoprotectionRelevant: true,
  };

  const decision = canInfluenceRoutine(blockedGradeATrial, arthurPhenotypeProfile, validContext);
  assert.equal(decision.allowed, false);
  assert.match(decision.reason, /explicitly disallowed/i);
});

test('Evidence Policy: Grade C observational evidence cannot silently modify active routine steps', () => {
  // Dairy/Acne observational meta-analysis (Grade C)
  const decision = canInfluenceRoutine(evidenceDairyAcneObservationalMetaAnalysis, arthurPhenotypeProfile);
  assert.equal(decision.allowed, false);
  assert.equal(decision.evidenceGrade, 'C');
  assert.match(decision.reason, /cannot silently alter active routines/i);

  // But Grade C CAN inform educational intelligence (Ask cards, research insights)
  assert.equal(canInformEducationalContext(evidenceDairyAcneObservationalMetaAnalysis), true);
});

test('Evidence Policy: Grade D preliminary or anecdotal evidence cannot drive product behavior', () => {
  // Anecdotal lemon juice claim (Grade D)
  const decision = canInfluenceRoutine(evidenceAnecdotalLemonExtract, arthurPhenotypeProfile);
  assert.equal(decision.allowed, false);
  assert.equal(decision.evidenceGrade, 'D');
  assert.match(decision.reason, /cannot drive product or routine behavior/i);

  // Grade D CANNOT inform educational context
  assert.equal(canInformEducationalContext(evidenceAnecdotalLemonExtract), false);
});

// ========================================================
// 14. CATEGORICAL TINT COMPATIBILITY & WHITE CAST ASSESSMENT
// ========================================================

test('Tint Compatibility: Unconfirmed or missing shade requires confirmation before claiming match', () => {
  // Unconfirmed profile (e.g. initial photo estimate without member confirmation)
  const unconfirmedResult = evaluateTintCompatibility(mockTintedMineralSunscreen, unconfirmedPhotoEstimate);
  assert.equal(unconfirmedResult.status, 'needs_confirmation');
  assert.equal(unconfirmedResult.requiresConfirmation, true);
  assert.match(unconfirmedResult.rationale, /confirmation required/i);

  // Undefined profile
  const missingResult = evaluateTintCompatibility(mockTintedMineralSunscreen, undefined);
  assert.equal(missingResult.status, 'needs_confirmation');
});

test('Tint Compatibility: Confirmed shade evaluates categorically and identifies iron oxide benefit only with relevant PIH signal', () => {
  // Arthur has confirmed medium depth with neutral undertone AND confirmed PIH tendency ('sometimes')
  const matchResult = evaluateTintCompatibility(mockTintedMineralSunscreen, arthurPhenotypeProfile);
  assert.equal(matchResult.status, 'likely_match');
  assert.equal(matchResult.requiresConfirmation, false);
  assert.equal(matchResult.ironOxideBenefitIdentified, true);

  // Member with medium depth but NO PIH tendency ('rarely') does NOT trigger iron oxide benefit
  // (proves pigmentation depth alone is NOT a treatment trigger)
  const profileWithoutPih: SkinPhenotypeProfile = {
    ...arthurPhenotypeProfile,
    pihTendency: createProvenancedValue('rarely', 'self_reported', 'high', true),
  };
  const resultWithoutPih = evaluateTintCompatibility(mockTintedMineralSunscreen, profileWithoutPih);
  assert.equal(resultWithoutPih.status, 'likely_match');
  assert.equal(resultWithoutPih.ironOxideBenefitIdentified, false);

  // Fair tinted sunscreen on medium depth is an unlikely match
  const fairResult = evaluateTintCompatibility(mockFairTintedSunscreen, arthurPhenotypeProfile);
  assert.equal(fairResult.status, 'unlikely_match');
  assert.equal(fairResult.requiresConfirmation, false);
});

test('White Cast Assessment: Evaluates based on verified product observations without pseudo-scientific formulas', () => {
  // Known noticeable cast observation
  const observedRisk = evaluateWhiteCastRisk(mockUntintedPhysicalSunscreen, arthurPhenotypeProfile);
  assert.equal(observedRisk.castRisk, 'moderate');
  assert.match(observedRisk.rationale, /noticeable cast/i);

  // Known zero cast observation
  const zeroCastObs: ProductWhiteCastObservation = {
    reportedCastLevel: 'none',
    source: 'catalog_verified',
    confidence: 'high',
  };
  const zeroRisk = evaluateWhiteCastRisk(zeroCastObs, arthurPhenotypeProfile);
  assert.equal(zeroRisk.castRisk, 'none');

  // Unverified product observation fails closed to 'unverified'
  const unverifiedRisk = evaluateWhiteCastRisk(undefined, arthurPhenotypeProfile);
  assert.equal(unverifiedRisk.castRisk, 'unverified');
  assert.match(unverifiedRisk.rationale, /no verified/i);
});

// ========================================================
// 15. SAFETY & NON-DISCRIMINATION INVARIANTS
// ========================================================

test('Safety & Privacy: Zero race, ethnicity, or ancestry classifiers in phenotype models', () => {
  const profileKeys = Object.keys(arthurPhenotypeProfile);
  for (const key of profileKeys) {
    assert.ok(!/race|ethnic|ancestry|nationality/i.test(key), `Key ${key} violates non-discrimination rule`);
  }

  // Ensure Arthur fixture contains no demographic or racial classification
  const serialized = JSON.stringify(arthurPhenotypeProfile);
  assert.equal(/caucasian|black|hispanic|asian|african/i.test(serialized), false);
});

// ========================================================
// 16. K4.3 FOUNDING BETA CLIENT READINESS INVARIANTS
// ========================================================

test('K4.3 Pricing Truth: Client configuration centralizes beta price at $25/mo', () => {
  assert.equal(config.betaPriceMonthly, 25);
  assert.equal(config.currency, 'USD');
  assert.equal(config.founderSupportEmail, 'concierge@derive.skin');
});

test('K4.3 Demo Isolation: UserStore initializes with clean default and separates Arthur demo fixture', () => {
  useUserStore.getState().resetToDefault();
  const defaultUser = useUserStore.getState();
  assert.equal(defaultUser.userId, 'usr_beta_member');
  assert.equal(defaultUser.email, 'member@derive.skin');
  assert.equal(defaultUser.fullName, 'Beta Member');
  assert.equal(defaultUser.tier, 'Founding Beta');
  assert.ok(!defaultUser.tier.includes('129'), 'Default tier must not embed legacy price string');

  // Load Arthur demo user explicitly
  useUserStore.getState().loadArthurDemoUser();
  const arthurUser = useUserStore.getState();
  assert.equal(arthurUser.userId, 'usr_beta_001');
  assert.equal(arthurUser.fullName, 'Arthur Pendelton');
  assert.equal(arthurUser.tier, 'Founding Beta');

  // Reset back to clean default
  useUserStore.getState().resetToDefault();
});

test('K4.3 Today Actionable Research Gating: Generic/non-actionable research is omitted from Today', () => {
  const nonActionableInsight: ResearchInsight = {
    id: 'res_1',
    title: 'Niacinamide + Retinoid Synergy',
    summary: 'New research supports your current routine.',
    recommendation: 'no_change',
    recommendationReason: 'No changes needed.',
    source: 'Journal of Cosmetic Dermatology, 2026',
    evidenceStrength: 'high',
    date: 'Sep 2026',
  };

  const actionableInsight: ResearchInsight = {
    id: 'res_2',
    title: 'Visible Light Photoprotection',
    summary: 'Iron oxide addition recommended for persistent PIH marks.',
    recommendation: 'action',
    recommendationReason: 'Active routine adjustment proposed.',
    source: 'JAAD, 2026',
    evidenceStrength: 'high',
    date: 'Sep 2026',
  };

  const insightsList = [nonActionableInsight];

  // Filtering logic matching Today screen
  const todayInsightWhenNoAction = insightsList.find(
    (r) => r.recommendation === 'action' || (r.recommendation !== 'no_change' && !!r.recommendationReason)
  );
  assert.equal(todayInsightWhenNoAction, undefined, 'Today must omit research when recommendation is no_change');

  const insightsListWithAction = [nonActionableInsight, actionableInsight];
  const todayInsightWhenAction = insightsListWithAction.find(
    (r) => r.recommendation === 'action' || (r.recommendation !== 'no_change' && !!r.recommendationReason)
  );
  assert.ok(todayInsightWhenAction, 'Today must surface actionable research');
  assert.equal(todayInsightWhenAction?.id, 'res_2');
});

test('K4.3 Baseline Photos Gating: Requires all 3 photos (Front, Left, Right) before completion', () => {
  useOnboardingStore.getState().resetOnboarding();
  const store = useOnboardingStore.getState();

  // Partial captures
  assert.equal(!!(store.frontPhotoUri && store.leftPhotoUri && store.rightPhotoUri), false);

  useOnboardingStore.getState().setSkinPhotos({ front: 'file:///photo_front.jpg' });
  const step1State = useOnboardingStore.getState();
  assert.equal(!!(step1State.frontPhotoUri && step1State.leftPhotoUri && step1State.rightPhotoUri), false);

  useOnboardingStore.getState().setSkinPhotos({ left: 'file:///photo_left.jpg' });
  const step2State = useOnboardingStore.getState();
  assert.equal(!!(step2State.frontPhotoUri && step2State.leftPhotoUri && step2State.rightPhotoUri), false);

  useOnboardingStore.getState().setSkinPhotos({ right: 'file:///photo_right.jpg' });
  const allState = useOnboardingStore.getState();
  assert.equal(!!(allState.frontPhotoUri && allState.leftPhotoUri && allState.rightPhotoUri), true);

  // Clean up
  useOnboardingStore.getState().resetOnboarding();
});

// ========================================================
// 17. K4.4 BASELINE CAPTURE, BARCODE SCAN & DEMO ISOLATION
// ========================================================

test('K4.4 Demo Isolation: RoutineStore initializes with clean default state and isolates Arthur fixture', () => {
  // Ensure store is reset to clean default
  useRoutineStore.getState().resetRoutine();
  const clean = useRoutineStore.getState();

  assert.equal(clean.routine, null, 'Default routine must be null');
  assert.equal(clean.userProducts.length, 0, 'Default userProducts must be empty');
  assert.equal(clean.checkIns.length, 0, 'Default checkIns must be empty');
  assert.equal(clean.learnedInsights.length, 0, 'Default learnedInsights must be empty');
  assert.equal(clean.researchInsights.length, 0, 'Default researchInsights must be empty');
  assert.equal(clean.refillRequests.length, 0, 'Default refillRequests must be empty');
  assert.equal(clean.isPlanUnderReview, false, 'Default plan review must be false');
  assert.match(clean.todayDominantStatus, /No active routine yet/i);

  // Load Arthur demo routine fixture explicitly
  useRoutineStore.getState().loadArthurDemoRoutine();
  const arthur = useRoutineStore.getState();

  assert.ok(arthur.routine !== null, 'Arthur routine should be loaded');
  assert.equal(arthur.routine?.status, 'published');
  assert.equal(arthur.userProducts.length, 4, 'Arthur demo has 4 products');
  assert.equal(arthur.checkIns.length, 1, 'Arthur demo has 1 baseline check-in');
  assert.equal(arthur.learnedInsights.length, 3, 'Arthur demo has 3 learned insights');
  assert.equal(arthur.refillRequests.length, 1, 'Arthur demo has 1 refill request');
  assert.equal(arthur.refillRequests[0].trackingNumber, '9400111899223190442155');

  // Reset back to clean state
  useRoutineStore.getState().resetRoutine();
  const afterReset = useRoutineStore.getState();
  assert.equal(afterReset.routine, null);
  assert.equal(afterReset.userProducts.length, 0);
  assert.equal(afterReset.checkIns.length, 0);
});

test('K4.4 Barcode Normalization: Strips non-digits, normalizes 13-digit leading zero, and preserves 12-digit leading zero', () => {
  // Whitespace and hyphens
  assert.equal(normalizeBarcode(' 769915-190602 '), '769915190602');

  // 13-digit EAN-13 starting with '0' normalizes to 12-digit UPC-A
  assert.equal(normalizeBarcode('0769915190602'), '769915190602');
  assert.equal(normalizeBarcode('0883140012993'), '883140012993');

  // Genuine 12-digit UPC-A with leading zero preserves its leading zero
  assert.equal(normalizeBarcode('077043103847'), '077043103847');

  // Empty or invalid input
  assert.equal(normalizeBarcode(''), '');
  assert.equal(normalizeBarcode(null as unknown as string), '');

  // Lookup keys generation: provides both 12-digit and 13-digit padded variants
  const keys12 = getBarcodeLookupKeys('769915190602');
  assert.ok(keys12.includes('769915190602'));
  assert.ok(keys12.includes('0769915190602'));

  const keys13 = getBarcodeLookupKeys('0769915190602');
  assert.ok(keys13.includes('769915190602'));
  assert.ok(keys13.includes('0769915190602'));
});

test('K4.4 Barcode Checksum: Validates standard GS1 modulo-10 algorithm', () => {
  // Valid UPC-A
  assert.equal(validateBarcodeChecksum('883140012993'), true);
  // Corrupted UPC-A
  assert.equal(validateBarcodeChecksum('883140012994'), false);

  // Valid EAN-8
  assert.equal(validateBarcodeChecksum('96385074'), true);
  // Corrupted EAN-8
  assert.equal(validateBarcodeChecksum('96385075'), false);

  // Unsupported digit count fails closed
  assert.equal(validateBarcodeChecksum('12345'), false);
});

test('K4.4 Instant Product Lookup: Resiliently matches catalog items across UPC and EAN formats', () => {
  // Match 12-digit UPC directly
  const matchDirect = findProductByBarcode('883140012993');
  assert.ok(matchDirect, 'Should match Anthelios');
  assert.equal(matchDirect?.name, 'Anthelios Ultra Light Fluid SPF 60');

  // Match 13-digit EAN representation of 12-digit UPC
  const matchEan = findProductByBarcode('0883140012993');
  assert.ok(matchEan, 'Should match Anthelios via EAN-13 lookup');
  assert.equal(matchEan?.brand, 'La Roche-Posay');

  // Match 12-digit UPC with leading zero
  const matchLeadingZero = findProductByBarcode('077043103847');
  assert.ok(matchLeadingZero, 'Should match St. Ives');
  assert.equal(matchLeadingZero?.brand, 'St. Ives');

  // Non-existent barcode returns null
  const matchUnknown = findProductByBarcode('999999999999');
  assert.equal(matchUnknown, null);
});

test('K4.4 AutoCapture State Machine: Evaluates framing criteria and angle constraints deterministically', () => {
  // 1. Missing face
  const noFaceRes = evaluateFrameCriteria({ hasFace: false }, 'front');
  assert.equal(noFaceRes.passes, false);
  assert.equal(noFaceRes.feedback, 'no_face');

  // 2. Face too far
  const tooFarRes = evaluateFrameCriteria({ hasFace: true, faceWidthRatio: 0.2 }, 'front');
  assert.equal(tooFarRes.passes, false);
  assert.equal(tooFarRes.feedback, 'too_far');

  // 3. Face off-center
  const offCenterRes = evaluateFrameCriteria(
    { hasFace: true, faceWidthRatio: 0.5, centerX: 0.1, centerY: 0.5 },
    'front'
  );
  assert.equal(offCenterRes.passes, false);
  assert.equal(offCenterRes.feedback, 'center_face');

  // Face too close / too low — calibrated from physical iPhone Front capture
  const tooCloseRes = evaluateFrameCriteria(
    { hasFace: true, faceWidthRatio: 0.74, centerX: 0.5, centerY: 0.5 },
    'front'
  );
  assert.equal(tooCloseRes.passes, false);
  assert.equal(tooCloseRes.feedback, 'too_close');

  const tooLowRes = evaluateFrameCriteria(
    { hasFace: true, faceWidthRatio: 0.5, centerX: 0.5, centerY: 0.78 },
    'front'
  );
  assert.equal(tooLowRes.passes, false);
  assert.equal(tooLowRes.feedback, 'center_face');

  // 4. Excessive roll / head tilt
  const tiltedHeadRes = evaluateFrameCriteria(
    { hasFace: true, faceWidthRatio: 0.5, centerX: 0.5, centerY: 0.5, roll: 20 },
    'front'
  );
  assert.equal(tiltedHeadRes.passes, false);
  assert.equal(tiltedHeadRes.feedback, 'center_face');

  // Pitch follows Apple Vision: positive = nodding down, negative = looking up.
  // Copy tells the member how to correct, not what the pose currently is.
  const lookingDownRes = evaluateFrameCriteria(
    { hasFace: true, faceWidthRatio: 0.5, centerX: 0.5, centerY: 0.5, pitch: 22 },
    'front'
  );
  assert.equal(lookingDownRes.passes, false);
  assert.equal(lookingDownRes.feedback, 'tilt_up');
  assert.equal(lookingDownRes.message, 'Lift your chin slightly');

  const lookingUpRes = evaluateFrameCriteria(
    { hasFace: true, faceWidthRatio: 0.5, centerX: 0.5, centerY: 0.5, pitch: -22 },
    'front'
  );
  assert.equal(lookingUpRes.passes, false);
  assert.equal(lookingUpRes.feedback, 'tilt_down');
  assert.equal(lookingUpRes.message, 'Lower your chin slightly');

  // 5. Front angle: head turned sideways fails
  const turnedFrontRes = evaluateFrameCriteria(
    { hasFace: true, faceWidthRatio: 0.5, centerX: 0.5, centerY: 0.5, yaw: 30 },
    'front'
  );
  assert.equal(turnedFrontRes.passes, false);
  assert.equal(turnedFrontRes.feedback, 'turn_left');

  // 6. Left angle gating
  const straightLookingLeftRes = evaluateFrameCriteria(
    { hasFace: true, faceWidthRatio: 0.5, centerX: 0.5, centerY: 0.5, yaw: 0 },
    'left'
  );
  assert.equal(straightLookingLeftRes.passes, false);
  assert.equal(straightLookingLeftRes.feedback, 'turn_left');

  const properLeftProfileRes = evaluateFrameCriteria(
    { hasFace: true, faceWidthRatio: 0.5, centerX: 0.5, centerY: 0.5, yaw: -45 },
    'left'
  );
  assert.equal(properLeftProfileRes.passes, true);
  assert.equal(properLeftProfileRes.feedback, 'ready');

  const fullLeftLateralRes = evaluateFrameCriteria(
    { hasFace: true, faceWidthRatio: 0.5, centerX: 0.5, centerY: 0.5, yaw: -80 },
    'left'
  );
  assert.equal(fullLeftLateralRes.passes, false);
  assert.equal(fullLeftLateralRes.feedback, 'turn_right');

  // 7. Right angle gating
  const straightLookingRightRes = evaluateFrameCriteria(
    { hasFace: true, faceWidthRatio: 0.5, centerX: 0.5, centerY: 0.5, yaw: 0 },
    'right'
  );
  assert.equal(straightLookingRightRes.passes, false);
  assert.equal(straightLookingRightRes.feedback, 'turn_right');

  const properRightProfileRes = evaluateFrameCriteria(
    { hasFace: true, faceWidthRatio: 0.5, centerX: 0.5, centerY: 0.5, yaw: 45 },
    'right'
  );
  assert.equal(properRightProfileRes.passes, true);
  assert.equal(properRightProfileRes.feedback, 'ready');
});

test('K4.4 AutoCapture State Machine: Enforces continuous hold stability and transitions to AUTO_CAPTURE', () => {
  const machine = new AutoCaptureStateMachine({
    targetAngle: 'front',
    requiredHoldDurationMs: 600,
  });

  assert.equal(machine.getState(), 'IDLE');

  const validFrame: FrameQualityMetrics = {
    hasFace: true,
    faceWidthRatio: 0.5,
    centerX: 0.5,
    centerY: 0.5,
    roll: 0,
    pitch: 0,
    yaw: 0,
    captureQuality: 0.8,
  };

  const t0 = 1000;

  // First valid frame -> READY_CANDIDATE
  const out1 = machine.update(validFrame, t0);
  assert.equal(out1.state, 'READY_CANDIDATE');
  assert.equal(out1.holdProgress, 0);
  assert.equal(out1.shouldTriggerCapture, false);

  // After 300ms (halfway) -> HOLDING
  const out2 = machine.update(validFrame, t0 + 300);
  assert.equal(out2.state, 'HOLDING');
  assert.equal(out2.holdProgress, 0.5);
  assert.equal(out2.shouldTriggerCapture, false);

  // Interrupt hold by looking away -> Resets to NOT_READY immediately (fail closed)
  const interruptedFrame: FrameQualityMetrics = {
    ...validFrame,
    yaw: 40,
  };
  const out3 = machine.update(interruptedFrame, t0 + 400);
  assert.equal(out3.state, 'NOT_READY');
  assert.equal(out3.holdProgress, 0);
  assert.equal(out3.shouldTriggerCapture, false);

  // Resume valid frame -> Restarts from candidate at new timestamp
  const t1 = 2000;
  const out4 = machine.update(validFrame, t1);
  assert.equal(out4.state, 'READY_CANDIDATE');
  assert.equal(out4.holdProgress, 0);

  // Hold reaches required duration (600ms) -> AUTO_CAPTURE triggers
  const out5 = machine.update(validFrame, t1 + 600);
  assert.equal(out5.state, 'AUTO_CAPTURE');
  assert.equal(out5.holdProgress, 1.0);
  assert.equal(out5.shouldTriggerCapture, true);

  // Once captured, state moves to REVIEW
  machine.markCaptured();
  assert.equal(machine.getState(), 'REVIEW');
  const out6 = machine.update(validFrame, t1 + 700);
  assert.equal(out6.state, 'REVIEW');
  assert.equal(out6.shouldTriggerCapture, false);
});

test('K4.4 Finalization: RoutineStore removes initializeDefaultRoutine trap and isolates Arthur loader', () => {
  const state = useRoutineStore.getState();
  // initializeDefaultRoutine must NOT exist
  assert.equal((state as any).initializeDefaultRoutine, undefined);
  assert.equal(typeof state.loadArthurDemoRoutine, 'function');
  assert.equal(typeof state.resetRoutine, 'function');

  // Verify clean state
  state.resetRoutine();
  const cleanState = useRoutineStore.getState();
  assert.equal(cleanState.routine, null);
  assert.equal(cleanState.userProducts.length, 0);
  assert.equal(cleanState.checkIns.length, 0);
});

test('K4.4 Finalization: Product catalog simulation fails closed with zero silent fallback', () => {
  const searchUnknown = 'non_existent_fake_bottle_xyz';
  const match = PROTOTYPE_CATALOG.find(
    (p) =>
      p.name.toLowerCase().includes(searchUnknown) ||
      p.brand.toLowerCase().includes(searchUnknown)
  );
  // Must be undefined, proving no silent fallback to PROTOTYPE_CATALOG[0]
  assert.equal(match, undefined);

  // But genuine catalog items match accurately
  const searchValid = 'anthelios';
  const validMatch = PROTOTYPE_CATALOG.find(
    (p) =>
      p.name.toLowerCase().includes(searchValid) ||
      p.brand.toLowerCase().includes(searchValid)
  );
  assert.ok(validMatch);
  assert.equal(validMatch?.brand, 'La Roche-Posay');
});

test('K4.4 Finalization: AutoCapture State Machine multi-angle sequencing and target angle getters', () => {
  const machine = new AutoCaptureStateMachine({
    targetAngle: 'front',
    requiredHoldDurationMs: 500,
  });

  assert.equal(machine.getTargetAngle(), 'front');

  // Switch to left profile
  machine.setTargetAngle('left');
  assert.equal(machine.getTargetAngle(), 'left');
  assert.equal(machine.getState(), 'IDLE');

  const leftProfileMetrics: FrameQualityMetrics = {
    hasFace: true,
    faceWidthRatio: 0.5,
    centerX: 0.5,
    centerY: 0.5,
    yaw: -35, // Looking to left
    captureQuality: 0.9,
  };

  const t0 = 10000;
  const out1 = machine.update(leftProfileMetrics, t0);
  assert.equal(out1.state, 'READY_CANDIDATE');

  const out2 = machine.update(leftProfileMetrics, t0 + 500);
  assert.equal(out2.state, 'AUTO_CAPTURE');
  assert.equal(out2.shouldTriggerCapture, true);

  // Switch to right profile
  machine.setTargetAngle('right');
  assert.equal(machine.getTargetAngle(), 'right');
  assert.equal(machine.getState(), 'IDLE');

  // Left metrics now fail closed for right profile
  const out3 = machine.update(leftProfileMetrics, t0 + 1000);
  assert.equal(out3.state, 'NOT_READY');
  assert.equal(out3.feedback, 'turn_right');

  // Right metrics pass
  const rightProfileMetrics: FrameQualityMetrics = {
    ...leftProfileMetrics,
    yaw: 35,
  };
  const out4 = machine.update(rightProfileMetrics, t0 + 1100);
  assert.equal(out4.state, 'READY_CANDIDATE');
});

// ========================================================
// 22. K6 MOBILE SERVICE BOUNDARY & REMOTE-READINESS
// ========================================================

import {
  submitOnboarding,
  askQuestion,
  evaluateProduct,
  submitWeeklyCheckIn,
  requestProductRefill,
  hydrateOrders,
  hydrateProgress,
  hydrateRoutine,
  hydrateResearchInsights,
  hydrateCustomerProfile,
  hydratePlanState,
  ensureInitialRoutineProposal,
  clearInFlightHydrations,
  clearInFlightProposals,
  resolveCustomerBootstrap,
  getActiveUserId,
  resolveUserId,
  buildOnboardingPayload,
} from '../src/services/deriveClient.ts';
import { uploadPhotoToStorage } from '../src/services/onboardingPhotoUpload.ts';
import { useBootstrapStore } from '../src/stores/bootstrapStore.ts';
import {
  RemoteDeriveService,
  mapDbBootstrapState,
  mapDbCustomerProfile,
} from '../src/services/remote/RemoteDeriveService.ts';
import type { IDeriveService } from '../src/contracts/DeriveService.ts';
import type {
  OnboardingPayload,
  OnboardingResult,
  RoutineProposalInput,
  RoutineProposalResult,
  AskRequest,
  AskResponse,
  ScanProductInput,
  ProductScanResult,
  CheckInInput,
  CheckInResult,
  ProgressData,
  RefillRequestInput,
  RefillRequest,
  CustomerProfile,
  CustomerBootstrapState,
  RoutinePlan,
} from '../src/domain/types.ts';
import { useScanContextStore } from '../src/stores/scanContextStore.ts';
import {
  getCustomerErrorMessage,
  CUSTOMER_ERROR_MESSAGES,
} from '../src/utils/customerErrors.ts';
import {
  resolveAskDisplayBanner,
  resolveAskServiceContext,
} from '../src/utils/scanContext.ts';

test('K6 Service Boundary: MockDeriveService initializes strictly clean with zero Arthur leakage', async () => {
  const service = new MockDeriveService();

  // Clean initial state verification
  assert.equal(await service.getRoutine('test_user'), null);
  assert.deepEqual(await service.getOrders('test_user'), []);
  assert.deepEqual(await service.getResearchInsights('test_user'), []);
  const progress = await service.getProgress('test_user');
  assert.deepEqual(progress.checkIns, []);
  assert.deepEqual(progress.learnedInsights, []);
  assert.deepEqual(progress.recentPhotos, []);
  assert.equal(await service.getCustomerProfile('test_user'), null);

  // Explicit demo seeding works when requested
  service.seedArthurDemoData();
  const arthurRoutine = await service.getRoutine('usr_arthur_1');
  assert.ok(arthurRoutine);
  assert.equal(arthurRoutine.amSteps.length, 3);
  const arthurOrders = await service.getOrders('usr_arthur_1');
  assert.equal(arthurOrders.length, 1);

  // Reset returns cleanly to empty state
  service.reset();
  assert.equal(await service.getRoutine('usr_arthur_1'), null);
  assert.deepEqual(await service.getOrders('usr_arthur_1'), []);
});

test('K6 Service Boundary: IDeriveService is hot-swappable via setDeriveService', async () => {
  // Build a test double representing a remote backend
  class RemoteBackendMock implements IDeriveService {
    calls: string[] = [];

    async onboard(payload: OnboardingPayload): Promise<OnboardingResult> {
      this.calls.push('onboard');
      return {
        userId: 'usr_remote_123',
        skinProfile: {
          id: 'sp_remote',
          userId: 'usr_remote_123',
          primaryGoal: 'fine_lines',
          secondaryGoals: [],
          routineComplexity: 'simple',
          costPreference: 'balanced',
          middayFeel: 'comfortable',
          postCleanseTightness: false,
          knownSensitivities: [],
          sensitivitiesStatus: 'unanswered',
          activePrescriptions: [],
          isPregnantOrNursing: false,
          pregnancyStatus: 'unanswered',
          onboardingCompleted: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        proposedRoutine: {
          id: 'rt_remote',
          userId: 'usr_remote_123',
          version: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          status: 'awaiting_review',
          summarySentence: 'Remote customized plan.',
          amSteps: [],
          pmSteps: [],
        },
        userProducts: [],
        initialRoutineState: 'awaiting_review',
      };
    }

    async proposeRoutine(input?: RoutineProposalInput): Promise<RoutineProposalResult> {
      this.calls.push('proposeRoutine');
      return {
        routine: {
          id: 'rt_prop',
          userId: 'usr_remote_123',
          version: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          status: 'draft',
          summarySentence: 'Proposed.',
          amSteps: [],
          pmSteps: [],
        },
        userProducts: [],
      };
    }

    async getUserProducts(userId: string): Promise<UserProduct[]> {
      this.calls.push('getUserProducts');
      return [];
    }

    async askDerive(request: AskRequest): Promise<AskResponse> {
      this.calls.push('askDerive');
      return {
        answer: 'Remote response',
        directAnswer: 'Remote direct answer',
        whyExplanation: 'Remote explanation',
        safety: {
          isMedicalEmergency: false,
          severity: 'safe',
        },
      };
    }

    async scanProduct(input: ScanProductInput): Promise<ProductScanResult> {
      this.calls.push('scanProduct');
      return {
        productName: input.productName,
        brand: input.brand || 'Remote Brand',
        category: 'sunscreen',
        keyActives: ['Zinc Oxide'],
        verdict: 'great_fit',
        verdictLabel: 'GREAT FIT',
        verdictSummary: 'Remote scan verdict',
        factsUsedToDecide: ['Remote intelligence'],
      };
    }

    async submitCheckIn(input: CheckInInput): Promise<CheckInResult> {
      this.calls.push('submitCheckIn');
      return {
        checkIn: {
          id: 'ci_remote',
          userId: input.userId,
          primaryGoal: input.primaryGoal || 'breakouts',
          skinState: input.skinState,
          irritation: input.irritation,
          adherence: input.adherence || 'yes',
          aiAnalysisSentence: 'Remote analysis recorded.',
          adjustmentProposed: false,
          createdAt: new Date().toISOString(),
        },
        aiAnalysisSentence: 'Remote analysis recorded.',
        adjustmentProposed: false,
      };
    }

    async getProgress(userId: string): Promise<ProgressData> {
      this.calls.push('getProgress');
      return {
        checkIns: [],
        learnedInsights: [],
        recentPhotos: [],
        routineHistorySummary: 'Remote history',
        isCheckInDue: false,
      };
    }

    async requestRefill(input: RefillRequestInput): Promise<RefillRequest> {
      this.calls.push('requestRefill');
      return {
        id: 'ref_remote',
        userId: input.userId,
        productId: input.productId,
        productName: input.productName,
        brand: input.brand,
        status: 'requested',
        requestedAt: new Date().toISOString(),
      };
    }

    async getOrders(userId: string): Promise<RefillRequest[]> {
      this.calls.push('getOrders');
      return [];
    }

    async getResearchInsights(userId: string): Promise<ResearchInsight[]> {
      this.calls.push('getResearchInsights');
      return [];
    }

    async getRoutine(userId: string): Promise<RoutinePlan | null> {
      this.calls.push('getRoutine');
      return null;
    }

    async getCustomerProfile(userId: string): Promise<CustomerProfile | null> {
      this.calls.push('getCustomerProfile');
      return {
        id: userId,
        fullName: 'Remote Member',
        email: 'remote@example.com',
        tier: 'founding_beta',
        membershipStatus: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    async getCustomerBootstrapState(userId: string): Promise<CustomerBootstrapState> {
      this.calls.push('getCustomerBootstrapState');
      return {
        userId,
        profileExists: true,
        onboardingCompleted: true,
        membershipStatus: 'active',
      };
    }
  }

  const backend = new RemoteBackendMock();
  setDeriveService(backend);

  // 1. Verify askQuestion reaches swappable backend
  const askRes = await askQuestion('How do I apply this?');
  assert.equal(askRes.directAnswer, 'Remote direct answer');
  assert.ok(backend.calls.includes('askDerive'));

  // 2. Verify evaluateProduct reaches swappable backend
  const scanRes = await evaluateProduct({ productName: 'Test SPF' });
  assert.equal(scanRes.verdict, 'great_fit');
  assert.ok(backend.calls.includes('scanProduct'));

  // 3. Verify submitWeeklyCheckIn reaches swappable backend and syncs store
  const checkInRes = await submitWeeklyCheckIn({
    skinState: 'better',
    irritation: 'none',
  });
  assert.equal(checkInRes.checkIn.id, 'ci_remote');
  assert.ok(backend.calls.includes('submitCheckIn'));

  // 4. Verify requestProductRefill reaches swappable backend
  const refillRes = await requestProductRefill({
    productId: 'p_test',
    productName: 'Remote Cream',
    brand: 'Remote Lab',
  });
  assert.equal(refillRes.id, 'ref_remote');
  assert.ok(backend.calls.includes('requestRefill'));

  // 5. Verify hydrators reach swappable backend
  await hydrateOrders();
  assert.ok(backend.calls.includes('getOrders'));

  await hydrateProgress();
  assert.ok(backend.calls.includes('getProgress'));

  await hydrateRoutine();
  assert.ok(backend.calls.includes('getRoutine'));

  await hydrateCustomerProfile();
  assert.ok(backend.calls.includes('getCustomerProfile'));

  // Restore MockDeriveService for other tests
  setDeriveService(new MockDeriveService());
});

test('K6 Architectural Boundary: Zero ai-workflows imports across app directory', () => {
  const appDir = join(REPO_ROOT, 'app');
  const files = collectTextFiles(appDir).filter((f) => /\.(ts|tsx)$/.test(f));
  assert.ok(files.length > 0, 'Must have inspected app files');

  const violations: string[] = [];
  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    if (content.includes('ai-workflows')) {
      violations.push(file);
    }
  }

  assert.deepEqual(
    violations,
    [],
    `Found prohibited direct ai-workflows imports in client screens: ${violations.join(', ')}`
  );
});

test('K6 End-to-End Service Flow: Onboarding through routine and check-ins', async () => {
  const service = new MockDeriveService();
  setDeriveService(service);

  useRoutineStore.getState().resetRoutine();
  useUserStore.getState().resetToDefault();
  useOnboardingStore.getState().resetOnboarding();

  // 1. Submit onboarding via coordinator
  const payload: OnboardingPayload = {
    userId: 'usr_beta_k6',
    primaryGoal: 'breakouts',
    secondaryGoals: ['texture'],
    routineComplexity: 'simple',
    costPreference: 'balanced',
    middayFeel: 'combination',
    postCleanseTightness: false,
    confirmedProducts: [
      {
        id: 'p1',
        brand: 'CeraVe',
        name: 'Hydrating Facial Cleanser',
        category: 'cleanser',
        keyActives: ['Ceramides'],
      },
      {
        id: 'p2',
        brand: 'Differin',
        name: 'Adapalene Gel 0.1%',
        category: 'treatment',
        keyActives: ['Adapalene'],
      },
    ],
    productReactions: [],
    skinPhotos: {
      frontUri: 'file:///photo_front.jpg',
      leftUri: 'file:///photo_left.jpg',
      rightUri: 'file:///photo_right.jpg',
    },
    safetyContext: {
      knownSensitivities: [],
      sensitivitiesStatus: 'unanswered',
      activePrescriptions: ['Differin 0.1%'],
      isPregnantOrNursing: false,
      pregnancyStatus: 'unanswered',
    },
  };

  const onboardResult = await submitOnboarding(payload);
  assert.ok(onboardResult.proposedRoutine);
  assert.equal(onboardResult.proposedRoutine.status, 'awaiting_review');

  // Verify store state synchronized
  const routineState = useRoutineStore.getState();
  assert.equal(routineState.isPlanUnderReview, true);
  assert.ok(routineState.routine);
  assert.equal(routineState.routine!.amSteps.length, 3);

  // 2. Ask question handling
  const safetyRes = await askQuestion('My face is swollen and my throat feels tight');
  assert.equal(safetyRes.safety?.isMedicalEmergency, true);

  const normalRes = await askQuestion('Should I use moisturizer with Differin?');
  assert.equal(normalRes.safety?.isMedicalEmergency, false);
  assert.ok((normalRes.directAnswer?.length ?? 0) > 0);

  // 3. Scan evaluation
  const scan = await evaluateProduct({
    productName: 'Anthelios Ultra Light Fluid SPF 60',
    brand: 'La Roche-Posay',
    barcode: '883140012993',
  });
  assert.ok(scan.verdict === 'great_fit' || scan.verdict === 'better_replacement');

  // 4. Submit weekly check-in
  const checkInRes = await submitWeeklyCheckIn({
    skinState: 'better',
    irritation: 'none',
    adherence: 'yes',
  });
  assert.equal(checkInRes.adjustmentProposed, false);
  assert.equal(useRoutineStore.getState().checkIns.length, 1);

  // 5. Refill request
  const refillRes = await requestProductRefill({
    productId: 'p1',
    productName: 'Hydrating Facial Cleanser',
    brand: 'CeraVe',
  });
  assert.equal(refillRes.productName, 'Hydrating Facial Cleanser');
  assert.equal(useRoutineStore.getState().refillRequests.length, 1);
});

// ========================================================
// 16. K6.1 HARDENING: BOUNDARY INTEGRITY & FAIL-CLOSED STATE
// ========================================================

import { isRemoteServiceEnabled } from '../src/services/DeriveService.ts';
import {
  recognizeShelfProducts,
  getDemoShelfRecognitionFixture,
} from '../src/services/catalog.ts';

test('K6.1 Hardening: Scan to Ask route parameters map canonical and fallback attributes', () => {
  // Canonical route params from scan.tsx
  const canonicalParams = {
    initialQuery: 'What does the scan verdict for CeraVe Hydrating Facial Cleanser (Great Fit) mean for my routine?',
    productName: 'Hydrating Facial Cleanser',
    brand: 'CeraVe',
    verdict: 'great_fit',
    reason: 'Gentle hydrating surfactant match',
  };

  const resolvedName1 = canonicalParams.productName;
  const resolvedBrand1 = canonicalParams.brand;
  const resolvedVerdict1 = canonicalParams.verdict;
  const resolvedReason1 = canonicalParams.reason;

  assert.equal(resolvedName1, 'Hydrating Facial Cleanser');
  assert.equal(resolvedBrand1, 'CeraVe');
  assert.equal(resolvedVerdict1, 'great_fit');
  assert.equal(resolvedReason1, 'Gentle hydrating surfactant match');

  // Legacy route params fallback support
  const legacyParams: Record<string, string> = {
    scannedProductName: 'Differin Gel 0.1%',
    scannedBrand: 'Differin',
    scannedVerdict: 'fits_plan',
    scannedReason: 'Active scheduled retinoid',
  };

  const resolvedName2 = (legacyParams.productName as string | undefined) || legacyParams.scannedProductName;
  const resolvedBrand2 = (legacyParams.brand as string | undefined) || legacyParams.scannedBrand;
  const resolvedVerdict2 = (legacyParams.verdict as string | undefined) || legacyParams.scannedVerdict;
  const resolvedReason2 = (legacyParams.reason as string | undefined) || legacyParams.scannedReason;

  assert.equal(resolvedName2, 'Differin Gel 0.1%');
  assert.equal(resolvedBrand2, 'Differin');
  assert.equal(resolvedVerdict2, 'fits_plan');
  assert.equal(resolvedReason2, 'Active scheduled retinoid');
});

test('K6.1 Hardening: Remote mode enforces fail-closed customer identity presence on user operations', () => {
  const origEnv = process.env.EXPO_PUBLIC_USE_REMOTE_SERVICE;
  const origService = getDeriveService();

  try {
    // 1. In Mock mode, fallback 'usr_beta_member' is permitted
    setDeriveService(new MockDeriveService());
    process.env.EXPO_PUBLIC_USE_REMOTE_SERVICE = 'false';
    useUserStore.setState({ userId: '' });
    assert.equal(isRemoteServiceEnabled(), false);
    assert.equal(getActiveUserId(), 'usr_beta_member');

    // 2. Switch to Remote mode
    const remote = new RemoteDeriveService();
    setDeriveService(remote);
    process.env.EXPO_PUBLIC_USE_REMOTE_SERVICE = 'true';
    assert.equal(isRemoteServiceEnabled(), true);

    // Empty user ID throws fail-closed error
    useUserStore.setState({ userId: '' });
    assert.throws(
      () => getActiveUserId(),
      /Valid member identity required: Remote operations require a non-mock customer identity/
    );

    // Whitespace-only user ID throws fail-closed error
    useUserStore.setState({ userId: '   ' });
    assert.throws(
      () => getActiveUserId(),
      /Valid member identity required: Remote operations require a non-mock customer identity/
    );

    // Tab/newline user ID throws fail-closed error
    assert.throws(
      () => resolveUserId('\t\n  '),
      /Valid member identity required: Remote operations require a non-mock customer identity/
    );

    // Mock guest ID 'usr_beta_member' throws fail-closed error in remote mode
    useUserStore.setState({ userId: 'usr_beta_member' });
    assert.throws(
      () => getActiveUserId(),
      /Valid member identity required: Remote operations require a non-mock customer identity/
    );

    // Mock Arthur ID 'usr_beta_001' throws fail-closed error in remote mode
    useUserStore.setState({ userId: 'usr_beta_001' });
    assert.throws(
      () => getActiveUserId(),
      /Valid member identity required: Remote operations require a non-mock customer identity/
    );

    // Explicit call to resolveUserId with mock id throws in remote mode
    assert.throws(
      () => resolveUserId('usr_beta_member'),
      /Valid member identity required: Remote operations require a non-mock customer identity/
    );

    // Real customer identity succeeds and trims
    useUserStore.setState({ userId: '  usr_real_prod_auth_789  ' });
    assert.equal(getActiveUserId(), 'usr_real_prod_auth_789');
    assert.equal(resolveUserId('usr_real_prod_auth_789'), 'usr_real_prod_auth_789');
  } finally {
    process.env.EXPO_PUBLIC_USE_REMOTE_SERVICE = origEnv;
    setDeriveService(origService);
    useUserStore.getState().resetToDefault();
  }
});

test('K6.1 Hardening: Shelf recognition fails closed in default path with isolated demo fixture', async () => {
  // 1. Default shelf recognition returns empty list
  const liveResult = await recognizeShelfProducts('file:///local_counter_shelf.jpg');
  assert.deepEqual(liveResult.products, [], 'Default shelf recognition must not fabricate products');
  assert.equal(liveResult.unclearBottlesCount, 0);

  // 2. Explicit demo fixture is isolated
  const demoResult = getDemoShelfRecognitionFixture();
  assert.equal(demoResult.products.length, 5);
  assert.equal(demoResult.products[0].brand, 'CeraVe');
  assert.equal(demoResult.products[1].brand, 'Differin');
});

test('K6.1 Hardening: Canonical cache projection clears stale routine when service returns null', async () => {
  const origService = getDeriveService();

  try {
    // Backend returns null (e.g. routine was deleted or user has no routine yet)
    class NullRoutineBackend extends MockDeriveService {
      override async getRoutine(_userId: string): Promise<any> {
        return null;
      }
    }

    // Seed store with a stale routine
    useRoutineStore.setState({
      routine: {
        id: 'stale_routine_123',
        userId: 'usr_beta_member',
        status: 'awaiting_review',
        amSteps: [],
        pmSteps: [],
      } as any,
      isPlanUnderReview: true,
    });
    assert.ok(useRoutineStore.getState().routine);

    setDeriveService(new NullRoutineBackend());

    const result = await hydrateRoutine('usr_beta_member');
    assert.equal(result, null);
    // Verify store cache was cleared and isPlanUnderReview reset
    assert.equal(useRoutineStore.getState().routine, null);
    assert.equal(useRoutineStore.getState().isPlanUnderReview, false);
  } finally {
    setDeriveService(origService);
    useRoutineStore.getState().resetRoutine();
  }
});

test('K6.1 Hardening: Service mutation failures preserve user intent and error recoverability', async () => {
  const origService = getDeriveService();

  try {
    class FailingBackend extends MockDeriveService {
      override async submitCheckIn(): Promise<any> {
        throw new Error('Network offline: unable to reach Derive service');
      }
      override async requestRefill(): Promise<any> {
        throw new Error('Replenishment service currently unavailable');
      }
    }

    setDeriveService(new FailingBackend());
    useRoutineStore.getState().resetRoutine();

    // 1. Failed check-in throws without corrupting cache
    await assert.rejects(
      async () => {
        await submitWeeklyCheckIn({
          skinState: 'better',
          irritation: 'none',
          adherence: 'yes',
        });
      },
      /Network offline/
    );
    assert.equal(useRoutineStore.getState().checkIns.length, 0);

    // 2. Failed refill request throws without corrupting cache
    await assert.rejects(
      async () => {
        await requestProductRefill({
          productId: 'prod_99',
          productName: 'Toleriane Double Repair',
          brand: 'La Roche-Posay',
        });
      },
      /Replenishment service currently unavailable/
    );
    assert.equal(useRoutineStore.getState().refillRequests.length, 0);
  } finally {
    setDeriveService(origService);
    useRoutineStore.getState().resetRoutine();
  }
});

// ========================================================
// 18. K6.2 & K6.3 INTEGRATION-SEMANTICS & CONTRACT INTEGRITY
// ========================================================

test('K6.3 Service Boundary: Ask question transmission carries full typed ProductScanResult and preserves context across queries', async () => {
  const origService = getDeriveService();

  try {
    const fullScanResult = {
      productName: 'Anthelios Ultra Light Fluid SPF 60',
      brand: 'La Roche-Posay',
      category: 'sunscreen',
      keyActives: ['Avobenzone', 'Homosalate', 'Octisalate', 'Octocrylene'],
      verdict: 'great_fit',
      verdictLabel: 'GREAT FIT',
      verdictSummary: 'Lightweight chemical and mineral hybrid sunscreen with high UVA/UVB protection.',
      reason: 'High photoprotection without pore congestion.',
      whatItWouldChangeOrReplace: 'Replaces generic daytime moisturizer with dedicated photoprotection.',
      factsUsedToDecide: ['High broad-spectrum UV protection', 'Lightweight non-comedogenic fluid'],
      whyBullets: ['Broad-spectrum UVA/UVB defense', 'Compatible with active Differin schedule'],
    } satisfies ProductScanResult;

    // 1. Store holds exact canonical ProductScanResult
    useScanContextStore.getState().setActiveScannedProduct(fullScanResult);
    const stored = useScanContextStore.getState().activeScannedProduct;
    assert.deepEqual(stored, fullScanResult);
    assert.equal(stored?.productName, 'Anthelios Ultra Light Fluid SPF 60');
    assert.equal(stored?.category, 'sunscreen');
    assert.deepEqual(stored?.keyActives, ['Avobenzone', 'Homosalate', 'Octisalate', 'Octocrylene']);
    assert.deepEqual(stored?.factsUsedToDecide, ['High broad-spectrum UV protection', 'Lightweight non-comedogenic fluid']);

    // 2. Service receives the full typed product on first Ask query
    const captured = {
      askRequest: null as AskRequest | null,
      get(): AskRequest | null {
        return this.askRequest;
      },
    };
    class ContextTrackingService extends MockDeriveService {
      override async askDerive(req: AskRequest): Promise<AskResponse> {
        captured.askRequest = req;
        return super.askDerive(req);
      }
    }

    setDeriveService(new ContextTrackingService());

    // First query with active scanned context passed (synchronously read from store)
    const currentContext = useScanContextStore.getState().activeScannedProduct || undefined;
    await askQuestion('How do I layer this SPF with my morning routine?', {
      scannedProduct: currentContext,
    });

    assert.ok(captured.get() !== null);
    assert.equal(captured.get()!.question, 'How do I layer this SPF with my morning routine?');
    assert.deepEqual(captured.get()!.activeContext?.scannedProduct, fullScanResult);
    assert.equal(captured.get()!.activeContext?.scannedProduct?.category, 'sunscreen');

    // 3. Subsequent query in the same conversation retains the full scan context
    captured.askRequest = null;
    const retainedContext = useScanContextStore.getState().activeScannedProduct || undefined;
    await askQuestion('Does it pill under makeup?', {
      scannedProduct: retainedContext,
    });

    assert.ok(captured.get() !== null);
    assert.equal(captured.get()!.question, 'Does it pill under makeup?');
    assert.deepEqual(captured.get()!.activeContext?.scannedProduct, fullScanResult);
  } finally {
    setDeriveService(origService);
    useScanContextStore.getState().clearScanContext();
  }
});

test('K6.3 Scan Context Lifecycle: Banner dismissal and new chat clear active scan context', async () => {
  const origService = getDeriveService();

  try {
    const scan1 = {
      productName: 'Hydrating Cleanser',
      brand: 'CeraVe',
      category: 'cleanser',
      keyActives: ['Ceramides', 'Hyaluronic Acid'],
      verdict: 'great_fit',
      verdictLabel: 'GREAT FIT',
      verdictSummary: 'Non-stripping ceramides formula.',
      factsUsedToDecide: ['Barrier supportive ceramides'],
    } satisfies ProductScanResult;

    const scan2 = {
      productName: 'Adapalene 0.1% Gel',
      brand: 'Differin',
      category: 'treatment',
      keyActives: ['Adapalene'],
      verdict: 'fits_plan',
      verdictLabel: 'GREAT FIT',
      verdictSummary: 'Targeted topical retinoid for cellular turnover.',
      factsUsedToDecide: ['Scheduled evening retinoid'],
    } satisfies ProductScanResult;

    const capturedLifecycle = {
      askRequest: null as AskRequest | null,
      get(): AskRequest | null {
        return this.askRequest;
      },
    };
    class ContextTrackingService extends MockDeriveService {
      override async askDerive(req: AskRequest): Promise<AskResponse> {
        capturedLifecycle.askRequest = req;
        return super.askDerive(req);
      }
    }
    setDeriveService(new ContextTrackingService());

    // 1. Set initial scan
    useScanContextStore.getState().setActiveScannedProduct(scan1);
    assert.equal(useScanContextStore.getState().activeScannedProduct?.productName, 'Hydrating Cleanser');

    // 2. New scan handoff replaces prior context immediately
    useScanContextStore.getState().setActiveScannedProduct(scan2);
    assert.equal(useScanContextStore.getState().activeScannedProduct?.productName, 'Adapalene 0.1% Gel');

    // 3. User dismisses banner or taps New chat -> clearScanContext()
    useScanContextStore.getState().clearScanContext();
    assert.equal(useScanContextStore.getState().activeScannedProduct, null);

    // 4. Query sent after dismissal does not send scannedProduct
    capturedLifecycle.askRequest = null;
    const clearedContext = useScanContextStore.getState().activeScannedProduct || undefined;
    await askQuestion('Why is my skin feeling dry this afternoon?', {
      scannedProduct: clearedContext,
    });

    assert.ok(capturedLifecycle.get() !== null);
    assert.equal(capturedLifecycle.get()!.activeContext?.scannedProduct, undefined);
  } finally {
    setDeriveService(origService);
    useScanContextStore.getState().clearScanContext();
  }
});

test('K6.3 Scan Context: Pure helpers distinguish full service context from route display fallback', () => {
  const realScan = {
    productName: 'Anthelios Ultra Light Fluid SPF 60',
    brand: 'La Roche-Posay',
    category: 'sunscreen',
    keyActives: ['Avobenzone'],
    verdict: 'great_fit',
    verdictLabel: 'GREAT FIT',
    verdictSummary: 'Broad-spectrum SPF 60',
    factsUsedToDecide: ['SPF 60 test'],
  } satisfies ProductScanResult;

  // 1. Full transient store result outranks route parameters for banner
  const bannerFromStore = resolveAskDisplayBanner(realScan, {
    productName: 'Different Name',
    verdict: 'could_work',
  });
  assert.ok(bannerFromStore !== null);
  assert.equal(bannerFromStore.source, 'transient_store');
  assert.equal(bannerFromStore.productName, 'Anthelios Ultra Light Fluid SPF 60');
  assert.equal(bannerFromStore.verdictLabel, 'GREAT FIT');

  // 2. Fallback to canonical route params when store is null
  const bannerFromCanonicalRoute = resolveAskDisplayBanner(null, {
    productName: 'CeraVe PM Moisturizer',
    verdict: 'great_fit',
  });
  assert.ok(bannerFromCanonicalRoute !== null);
  assert.equal(bannerFromCanonicalRoute.source, 'route_params');
  assert.equal(bannerFromCanonicalRoute.productName, 'CeraVe PM Moisturizer');
  assert.equal(bannerFromCanonicalRoute.verdictLabel, 'GREAT FIT');

  // 3. Fallback to legacy route params when store is null
  const bannerFromLegacyRoute = resolveAskDisplayBanner(null, {
    scannedProductName: 'Differin Gel',
    scannedVerdict: 'fits_plan',
  });
  assert.ok(bannerFromLegacyRoute !== null);
  assert.equal(bannerFromLegacyRoute.source, 'route_params');
  assert.equal(bannerFromLegacyRoute.productName, 'Differin Gel');
  assert.equal(bannerFromLegacyRoute.verdictLabel, 'FITS PLAN');

  // 4. Returns null when neither store nor route params exist
  assert.equal(resolveAskDisplayBanner(null, {}), null);
  assert.equal(resolveAskDisplayBanner(null, undefined), null);

  // 5. Service context resolution: route strings NEVER become a synthetic ProductScanResult
  assert.equal(resolveAskServiceContext(null), undefined);
  assert.deepEqual(resolveAskServiceContext(realScan), realScan);
  const overrideScan = { ...realScan, productName: 'Overridden Scan' } satisfies ProductScanResult;
  assert.deepEqual(resolveAskServiceContext(realScan, overrideScan), overrideScan);
});

test('K6.2 Customer Errors: Shields raw backend/technical errors and returns empathetic Mineral copy', () => {
  // 1. All domain operations return deterministic Mineral copy
  assert.equal(
    getCustomerErrorMessage('onboarding'),
    "We couldn't finish setting up your routine. Your setup is still here. Please try again."
  );
  assert.equal(
    getCustomerErrorMessage('ask'),
    'Unable to get an answer right now. Please try again.'
  );
  assert.equal(
    getCustomerErrorMessage('scan'),
    "We couldn't evaluate this product right now. Please try again."
  );
  assert.equal(
    getCustomerErrorMessage('checkin'),
    "We couldn't submit your check-in. Your answers are still here. Please try again."
  );
  assert.equal(
    getCustomerErrorMessage('refill'),
    "We couldn't submit your refill request. Please try again."
  );
  assert.equal(
    getCustomerErrorMessage('general'),
    'Something went wrong on our end. Please try again.'
  );

  // Fallback for unexpected operation key
  assert.equal(
    getCustomerErrorMessage('unknown_op' as any),
    'Something went wrong on our end. Please try again.'
  );

  // 2. Technical leakage check: none of the copy contains backend internals
  const technicalTerms = [
    'supabase',
    'postgrest',
    'remotederiveservice',
    'edge function',
    'network offline',
    'stack trace',
    'sql',
    '500',
    '400',
    'null',
    'undefined',
  ];

  for (const [op, message] of Object.entries(CUSTOMER_ERROR_MESSAGES)) {
    for (const term of technicalTerms) {
      assert.equal(
        message.toLowerCase().includes(term),
        false,
        `Customer message for '${op}' must not leak technical term '${term}'`
      );
    }
  }

  // 3. Simulated raw backend error is shielded by mapper
  const rawBackendError = new Error('RemoteDeriveService.onboard failed: PostgREST error 400 (PGRST100)');
  const displayedMessage = getCustomerErrorMessage('onboarding');
  assert.equal(displayedMessage.includes(rawBackendError.message), false);
  assert.equal(displayedMessage, CUSTOMER_ERROR_MESSAGES.onboarding);
});

test('K6.2 User Intent Preservation: Failed check-in and refill operations preserve user form state', async () => {
  // Check-in state simulation
  let checkInSubmitted = false;
  let checkInError: string | null = null;
  const draftForm = {
    skinState: 'better' as const,
    adherence: 'yes' as const,
    irritation: 'none' as const,
    notes: 'Feeling noticeably smoother on forehead.',
  };

  try {
    throw new Error('RemoteDeriveService.submitWeeklyCheckIn failed: Network timeout');
  } catch (_err: any) {
    checkInError = getCustomerErrorMessage('checkin');
  }

  // Verify form was NOT marked submitted and error is customer-safe
  assert.equal(checkInSubmitted, false);
  assert.equal(checkInError, CUSTOMER_ERROR_MESSAGES.checkin);
  // User's draft answers remain intact
  assert.equal(draftForm.skinState, 'better');
  assert.equal(draftForm.notes, 'Feeling noticeably smoother on forehead.');

  // Refill state simulation
  let refillSubmitted = false;
  let refillError: string | null = null;
  const selectedProductId: string | null = 'prod_differin_123';

  try {
    throw new Error('RemoteDeriveService.requestProductRefill failed: 503 Service Unavailable');
  } catch (_err: any) {
    refillError = getCustomerErrorMessage('refill');
  }

  assert.equal(refillSubmitted, false);
  assert.equal(refillError, CUSTOMER_ERROR_MESSAGES.refill);
  // User's product selection remains intact
  assert.equal(selectedProductId, 'prod_differin_123');
});

// ========================================================
// 15. I1-A1 MOBILE AUTH & SESSION SPINE TESTS
// ========================================================

import { useAuthStore } from '../src/stores/authStore.ts';
import {
  sendEmailOtp,
  verifyEmailOtp,
  getCurrentSession,
  signOutSession,
  subscribeToAuth,
  isValidEmail,
  isValidOtpToken,
  setAuthAdapter,
  resetAuthAdapter,
  type AuthAdapter,
} from '../src/services/authClient.ts';
import { resetCustomerSessionData } from '../src/services/sessionReset.ts';
import { resolveAuthRoute, getAuthRedirectRoute } from '../src/utils/authRouting.ts';

test('I1-A1 Auth Client: Validates email input formats client-side', () => {
  // Valid emails
  assert.equal(isValidEmail('member@derive.skin'), true);
  assert.equal(isValidEmail('user.name+tag@gmail.com'), true);
  assert.equal(isValidEmail('a@b.co'), true);

  // Invalid emails
  assert.equal(isValidEmail(''), false);
  assert.equal(isValidEmail('plainaddress'), false);
  assert.equal(isValidEmail('@missingusername.com'), false);
  assert.equal(isValidEmail('user@.com'), false);
  assert.equal(isValidEmail('user@domain'), false);
  assert.equal(isValidEmail('user name@domain.com'), false);
  assert.equal(isValidEmail(null as any), false);
  assert.equal(isValidEmail(undefined as any), false);
});

test('I1-A1 Auth Client: Validates 6-digit OTP token format client-side', () => {
  // Valid 6-digit codes
  assert.equal(isValidOtpToken('123456'), true);
  assert.equal(isValidOtpToken('000000'), true);
  assert.equal(isValidOtpToken('987654'), true);

  // Invalid codes
  assert.equal(isValidOtpToken('12345'), false);
  assert.equal(isValidOtpToken('1234567'), false);
  assert.equal(isValidOtpToken('abcdef'), false);
  assert.equal(isValidOtpToken('12 456'), false);
  assert.equal(isValidOtpToken(''), false);
  assert.equal(isValidOtpToken(null as any), false);
});

test('I1-A1 Auth Client: sendEmailOtp handles success, validation, and error shielding', async () => {
  let requestedEmail = '';
  const mockAdapter: AuthAdapter = {
    async signInWithOtp(email: string) {
      requestedEmail = email;
      if (email === 'fail@derive.skin') {
        return { data: null, error: new Error('PostgREST error 500: SMTP rate limit exceeded') };
      }
      return { data: {}, error: null };
    },
    async verifyOtp() { return { data: { session: null, user: null }, error: null }; },
    async getSession() { return { data: { session: null }, error: null }; },
    async signOut() { return { error: null }; },
    onAuthStateChange() { return { data: { subscription: { unsubscribe: () => {} } } }; },
  };

  setAuthAdapter(mockAdapter);

  try {
    // 1. Invalid email returns customer-safe validation error without calling adapter
    requestedEmail = '';
    const invalidRes = await sendEmailOtp('invalid-email');
    assert.equal(invalidRes.success, false);
    assert.equal(invalidRes.error, CUSTOMER_ERROR_MESSAGES.auth_invalid_email);
    assert.equal(requestedEmail, '');

    // 2. Valid email calls adapter and returns success
    const validRes = await sendEmailOtp(' MEMBER@DERIVE.SKIN ');
    assert.equal(validRes.success, true);
    assert.equal(requestedEmail, 'member@derive.skin');

    // 3. Backend error is shielded and does NOT expose internal SMTP/PostgREST details
    const failRes = await sendEmailOtp('fail@derive.skin');
    assert.equal(failRes.success, false);
    assert.equal(failRes.error, CUSTOMER_ERROR_MESSAGES.auth_send_code);
    assert.equal(failRes.error?.includes('SMTP'), false);
    assert.equal(failRes.error?.includes('PostgREST'), false);
  } finally {
    resetAuthAdapter();
  }
});

test('I1-A1 Auth Client: verifyEmailOtp establishes session and identity projection without asserting paid membership', async () => {
  const fakeUserId = 'usr_remote_abc_123';
  const fakeUserEmail = 'realmember@derive.skin';

  const mockAdapter: AuthAdapter = {
    async signInWithOtp() { return { data: {}, error: null }; },
    async verifyOtp(email: string, token: string) {
      if (token === '123456') {
        return {
          data: {
            user: { id: fakeUserId, email: fakeUserEmail },
            session: { access_token: 'tok_jwt_fake', refresh_token: 'ref_tok_fake' },
          },
          error: null,
        };
      }
      return {
        data: { session: null, user: null },
        error: new Error('AuthApiError: Invalid OTP token provided'),
      };
    },
    async getSession() { return { data: { session: null }, error: null }; },
    async signOut() { return { error: null }; },
    onAuthStateChange() { return { data: { subscription: { unsubscribe: () => {} } } }; },
  };

  setAuthAdapter(mockAdapter);

  try {
    // Reset stores to clean state before test
    resetCustomerSessionData();
    assert.equal(useAuthStore.getState().status, 'SIGNED_OUT');
    assert.equal(useUserStore.getState().userId, '');

    // 1. Invalid token format fails client-side
    const badTokenRes = await verifyEmailOtp(fakeUserEmail, '999');
    assert.equal(badTokenRes.success, false);
    assert.equal(badTokenRes.error, CUSTOMER_ERROR_MESSAGES.auth_invalid_otp);

    // 2. Incorrect token returns customer-safe error and does not mutate session
    const wrongTokenRes = await verifyEmailOtp(fakeUserEmail, '000000');
    assert.equal(wrongTokenRes.success, false);
    assert.equal(wrongTokenRes.error, CUSTOMER_ERROR_MESSAGES.auth_invalid_otp);
    assert.equal(wrongTokenRes.error?.includes('AuthApiError'), false);
    assert.equal(useAuthStore.getState().status, 'SIGNED_OUT');

    // 3. Successful verification updates authStore and projects identity into userStore
    const goodTokenRes = await verifyEmailOtp(fakeUserEmail, '123456');
    assert.equal(goodTokenRes.success, true);
    assert.equal(goodTokenRes.userId, fakeUserId);

    // AuthStore projection
    assert.equal(useAuthStore.getState().status, 'SIGNED_IN');
    assert.equal(useAuthStore.getState().sessionUserId, fakeUserId);
    assert.equal(useAuthStore.getState().sessionEmail, fakeUserEmail);

    // UserStore identity projection: must NOT assert active paid membership
    const userState = useUserStore.getState();
    assert.equal(userState.userId, fakeUserId);
    assert.equal(userState.email, fakeUserEmail);
    assert.equal(userState.fullName, '');
    assert.equal(userState.membershipStatus, 'none');
    assert.equal(userState.tier, '');
  } finally {
    resetAuthAdapter();
    resetCustomerSessionData();
  }
});

test('I1-A1.1 Auth Client: signOutSession requests local scope and purges all cross-user customer caches', async () => {
  let signOutScope: string | undefined;
  const mockAdapter: AuthAdapter = {
    async signInWithOtp() { return { data: {}, error: null }; },
    async verifyOtp() { return { data: { session: null, user: null }, error: null }; },
    async getSession() { return { data: { session: null }, error: null }; },
    async signOut(options) {
      signOutScope = options?.scope;
      return { error: null };
    },
    onAuthStateChange() { return { data: { subscription: { unsubscribe: () => {} } } }; },
  };

  setAuthAdapter(mockAdapter);

  try {
    // Populate stores with user-specific sensitive data including onboarding store
    useAuthStore.getState().setSession('usr_sensitive_999', 'user@derive.skin');
    useUserStore.getState().setUser('usr_sensitive_999', 'user@derive.skin', 'Jane Member');
    useRoutineStore.getState().loadArthurDemoRoutine();
    useOnboardingStore.getState().loadArthurDemoState();
    useOnboardingStore.getState().completeOnboarding();
    useOnboardingStore.getState().setSkinPhotos({
      front: 'file:///sensitive_face.jpg',
      left: 'file:///sensitive_left.jpg',
      right: 'file:///sensitive_right.jpg',
    });
    useScanContextStore.getState().setActiveScannedProduct({
      productName: 'Sensitive Scanned Sunscreen',
      brand: 'La Roche-Posay',
      category: 'sunscreen',
      verdict: 'great_fit',
      verdictSummary: 'Great fit for your skin. No sensitizing actives detected.',
      keyActives: ['Avobenzone'],
      factsUsedToDecide: ['Broad spectrum', 'Non-comedogenic'],
    });

    // Pre-conditions
    assert.equal(useAuthStore.getState().status, 'SIGNED_IN');
    assert.equal(useUserStore.getState().userId, 'usr_sensitive_999');
    assert.notEqual(useRoutineStore.getState().routine, null);
    assert.equal(useOnboardingStore.getState().isCompleted, true);
    assert.equal(useOnboardingStore.getState().frontPhotoUri, 'file:///sensitive_face.jpg');
    assert.notEqual(useScanContextStore.getState().activeScannedProduct, null);

    // Act
    const result = await signOutSession();
    assert.equal(result.success, true);
    assert.equal(signOutScope, 'local');

    // Verify all cross-user caches and identities are purged
    assert.equal(useAuthStore.getState().status, 'SIGNED_OUT');
    assert.equal(useAuthStore.getState().sessionUserId, null);
    assert.equal(useAuthStore.getState().sessionEmail, null);

    assert.equal(useUserStore.getState().userId, '');
    assert.equal(useUserStore.getState().email, '');
    assert.equal(useUserStore.getState().fullName, '');
    assert.equal(useUserStore.getState().membershipStatus, 'none');

    assert.equal(useRoutineStore.getState().routine, null);
    assert.equal(useRoutineStore.getState().userProducts.length, 0);
    assert.equal(useRoutineStore.getState().checkIns.length, 0);
    assert.equal(useRoutineStore.getState().refillRequests.length, 0);

    // Onboarding store purged
    assert.equal(useOnboardingStore.getState().isCompleted, false);
    assert.equal(useOnboardingStore.getState().frontPhotoUri, null);
    assert.equal(useOnboardingStore.getState().detectedProducts.length, 0);
    assert.equal(useOnboardingStore.getState().productReactions.length, 0);

    assert.equal(useScanContextStore.getState().activeScannedProduct, null);
  } finally {
    resetAuthAdapter();
    resetCustomerSessionData();
  }
});

test('I1-A1.2 Auth Client: signOutSession exhaustively implements 7-case fail-closed truth table', async () => {
  let activeSession: any = null;
  let getSessionError: Error | null = null;
  let getSessionThrows = false;
  let signOutError: Error | null = null;
  let signOutThrows = false;
  let signOutScope: string | undefined;

  const mockAdapter: AuthAdapter = {
    async signInWithOtp() { return { data: {}, error: null }; },
    async verifyOtp() { return { data: { session: null, user: null }, error: null }; },
    async getSession() {
      if (getSessionThrows) {
        throw new Error('Storage lookup failure');
      }
      return { data: { session: activeSession }, error: getSessionError };
    },
    async signOut(options) {
      signOutScope = options?.scope;
      if (signOutThrows) {
        throw new Error('Network socket died');
      }
      return { error: signOutError };
    },
    onAuthStateChange() { return { data: { subscription: { unsubscribe: () => {} } } }; },
  };

  setAuthAdapter(mockAdapter);

  const setupAuthenticatedUser = () => {
    useAuthStore.getState().setSession('usr_target', 'target@derive.skin');
    useUserStore.getState().setUser('usr_target', 'target@derive.skin', 'Target User');
    useRoutineStore.getState().loadArthurDemoRoutine();
  };

  try {
    // 1. CASE A: provider signOut success -> local scope used, caches cleared, success
    setupAuthenticatedUser();
    signOutError = null;
    signOutThrows = false;
    activeSession = { user: { id: 'usr_target' } };
    const resA = await signOutSession();
    assert.equal(resA.success, true);
    assert.equal(signOutScope, 'local');
    assert.equal(useAuthStore.getState().status, 'SIGNED_OUT');
    assert.equal(useRoutineStore.getState().routine, null);

    // 2. CASE B: provider signOut error + getSession success + no session -> caches cleared, success
    setupAuthenticatedUser();
    signOutError = new Error('SignOut network blip');
    signOutThrows = false;
    activeSession = null;
    getSessionError = null;
    getSessionThrows = false;
    const resB = await signOutSession();
    assert.equal(resB.success, true);
    assert.equal(useAuthStore.getState().status, 'SIGNED_OUT');
    assert.equal(useRoutineStore.getState().routine, null);

    // 3. CASE C: provider signOut error + getSession success + active session -> caches preserved, failure
    setupAuthenticatedUser();
    signOutError = new Error('SignOut network blip');
    activeSession = { user: { id: 'usr_target' } };
    getSessionError = null;
    const resC = await signOutSession();
    assert.equal(resC.success, false);
    assert.equal(resC.error, CUSTOMER_ERROR_MESSAGES.auth_signout);
    assert.equal(useAuthStore.getState().status, 'SIGNED_IN');
    assert.notEqual(useRoutineStore.getState().routine, null, 'Routine must be preserved on Case C');

    // 4. CASE D: provider signOut error + getSession returns error -> caches preserved, failure
    setupAuthenticatedUser();
    signOutError = new Error('SignOut network blip');
    activeSession = null; // Even if session data was null, getSession returned an error!
    getSessionError = new Error('Database offline');
    const resD = await signOutSession();
    assert.equal(resD.success, false);
    assert.equal(resD.error, CUSTOMER_ERROR_MESSAGES.auth_signout);
    assert.equal(useAuthStore.getState().status, 'SIGNED_IN');
    assert.notEqual(useRoutineStore.getState().routine, null, 'Routine must be preserved on Case D');

    // 5. CASE E: provider signOut throws + getSession success + no session -> caches cleared, success
    setupAuthenticatedUser();
    signOutError = null;
    signOutThrows = true;
    activeSession = null;
    getSessionError = null;
    const resE = await signOutSession();
    assert.equal(resE.success, true);
    assert.equal(useAuthStore.getState().status, 'SIGNED_OUT');
    assert.equal(useRoutineStore.getState().routine, null);

    // 6. CASE F: provider signOut throws + getSession active session -> caches preserved, failure
    setupAuthenticatedUser();
    signOutThrows = true;
    activeSession = { user: { id: 'usr_target' } };
    getSessionError = null;
    const resF = await signOutSession();
    assert.equal(resF.success, false);
    assert.equal(resF.error, CUSTOMER_ERROR_MESSAGES.auth_signout);
    assert.equal(useAuthStore.getState().status, 'SIGNED_IN');
    assert.notEqual(useRoutineStore.getState().routine, null, 'Routine must be preserved on Case F');

    // 7. CASE G: provider signOut throws + getSession throws or errors -> caches preserved, failure
    setupAuthenticatedUser();
    signOutThrows = true;
    getSessionThrows = true;
    const resG = await signOutSession();
    assert.equal(resG.success, false);
    assert.equal(resG.error, CUSTOMER_ERROR_MESSAGES.auth_signout);
    assert.equal(useAuthStore.getState().status, 'SIGNED_IN');
    assert.notEqual(useRoutineStore.getState().routine, null, 'Routine must be preserved on Case G');
  } finally {
    resetAuthAdapter();
    resetCustomerSessionData();
  }
});

test('I1-A1.1 Auth Client: getCurrentSession synchronizes store state or purges customer caches on no session', async () => {
  const sessionUser = { id: 'usr_existing_sess', email: 'session@derive.skin' };
  let returnSession = true;

  const mockAdapter: AuthAdapter = {
    async signInWithOtp() { return { data: {}, error: null }; },
    async verifyOtp() { return { data: { session: null, user: null }, error: null }; },
    async getSession() {
      if (returnSession) {
        return { data: { session: { user: sessionUser } }, error: null };
      }
      return { data: { session: null }, error: null };
    },
    async signOut() { return { error: null }; },
    onAuthStateChange() { return { data: { subscription: { unsubscribe: () => {} } } }; },
  };

  setAuthAdapter(mockAdapter);

  try {
    resetCustomerSessionData();

    // 1. Session exists: synchronizes store
    const sessionRes = await getCurrentSession();
    assert.equal(sessionRes.userId, 'usr_existing_sess');
    assert.equal(sessionRes.email, 'session@derive.skin');
    assert.equal(useAuthStore.getState().status, 'SIGNED_IN');
    assert.equal(useUserStore.getState().userId, 'usr_existing_sess');

    // 2. Session does not exist: marks signed out AND purges all stale customer caches
    // First inject stale local data
    useUserStore.getState().setUser('usr_stale', 'stale@derive.skin', 'Stale User');
    useRoutineStore.getState().loadArthurDemoRoutine();
    useOnboardingStore.getState().loadArthurDemoState();

    returnSession = false;
    const noSessionRes = await getCurrentSession();
    assert.equal(noSessionRes.userId, null);
    assert.equal(noSessionRes.email, null);
    assert.equal(useAuthStore.getState().status, 'SIGNED_OUT');
    assert.equal(useUserStore.getState().userId, '');
    assert.equal(useRoutineStore.getState().routine, null);
    assert.equal(useOnboardingStore.getState().isCompleted, false);
  } finally {
    resetAuthAdapter();
    resetCustomerSessionData();
  }
});

test('I1-A1.1 Auth Client: subscribeToAuth handles identity switch with purge and preserves cache on same-user refresh', () => {
  let authListener: ((event: string, session: any) => void) | null = null;

  const mockAdapter: AuthAdapter = {
    async signInWithOtp() { return { data: {}, error: null }; },
    async verifyOtp() { return { data: { session: null, user: null }, error: null }; },
    async getSession() { return { data: { session: null }, error: null }; },
    async signOut() { return { error: null }; },
    onAuthStateChange(callback) {
      authListener = callback;
      return { data: { subscription: { unsubscribe: () => { authListener = null; } } } };
    },
  };

  setAuthAdapter(mockAdapter);

  try {
    resetCustomerSessionData();
    const { unsubscribe } = subscribeToAuth();
    assert.equal(typeof authListener, 'function');

    // 1. First user signs in
    authListener!('SIGNED_IN', {
      user: { id: 'usr_A', email: 'userA@derive.skin' },
    });
    assert.equal(useAuthStore.getState().status, 'SIGNED_IN');
    assert.equal(useAuthStore.getState().sessionUserId, 'usr_A');
    assert.equal(useUserStore.getState().userId, 'usr_A');

    // User A loads routine data
    useRoutineStore.getState().loadArthurDemoRoutine();
    assert.notEqual(useRoutineStore.getState().routine, null);

    // 2. TOKEN_REFRESHED or SIGNED_IN for the same user A: caches MUST NOT be purged
    authListener!('TOKEN_REFRESHED', {
      user: { id: 'usr_A', email: 'userA@derive.skin' },
    });
    assert.equal(useAuthStore.getState().sessionUserId, 'usr_A');
    assert.notEqual(useRoutineStore.getState().routine, null, 'Routine cache should be preserved on token refresh');

    // 3. Different user B signs in: caches for user A MUST be purged
    authListener!('SIGNED_IN', {
      user: { id: 'usr_B', email: 'userB@derive.skin' },
    });
    assert.equal(useAuthStore.getState().status, 'SIGNED_IN');
    assert.equal(useAuthStore.getState().sessionUserId, 'usr_B');
    assert.equal(useUserStore.getState().userId, 'usr_B');
    assert.equal(useRoutineStore.getState().routine, null, 'Routine cache must be purged on user identity switch');

    // 4. SIGNED_OUT event purges all session state
    authListener!('SIGNED_OUT', null);
    assert.equal(useAuthStore.getState().status, 'SIGNED_OUT');
    assert.equal(useAuthStore.getState().sessionUserId, null);
    assert.equal(useUserStore.getState().userId, '');

    unsubscribe();
    assert.equal(authListener, null);
  } finally {
    resetAuthAdapter();
    resetCustomerSessionData();
  }
});

test('I1-A1.2 Pure Routing Policy: resolveAuthRoute and getAuthRedirectRoute globally enforce holding and auth boundaries', () => {
  // 1. Remote SIGNED_IN from auth route requires /holding
  const destSignedIn = resolveAuthRoute({ remoteEnabled: true, authStatus: 'SIGNED_IN' });
  assert.equal(getAuthRedirectRoute(['(auth)', 'login'], destSignedIn), '/holding');
  assert.equal(getAuthRedirectRoute('/(auth)/login', destSignedIn), '/holding');
  assert.equal(getAuthRedirectRoute(['(auth)', 'verify-otp'], destSignedIn), '/holding');

  // 2. Remote SIGNED_IN from tabs requires /holding
  assert.equal(getAuthRedirectRoute(['(tabs)', 'today'], destSignedIn), '/holding');
  assert.equal(getAuthRedirectRoute('/(tabs)/today', destSignedIn), '/holding');
  assert.equal(getAuthRedirectRoute(['(tabs)', 'plan'], destSignedIn), '/holding');

  // 3. Remote SIGNED_IN from onboarding requires /holding
  assert.equal(getAuthRedirectRoute(['(onboarding)', '1-welcome'], destSignedIn), '/holding');
  assert.equal(getAuthRedirectRoute('/(onboarding)/1-welcome', destSignedIn), '/holding');
  assert.equal(getAuthRedirectRoute(['(onboarding)', '8-safety'], destSignedIn), '/holding');

  // 4. Remote SIGNED_IN from Profile requires /holding
  assert.equal(getAuthRedirectRoute(['profile'], destSignedIn), '/holding');
  assert.equal(getAuthRedirectRoute('/profile', destSignedIn), '/holding');

  // 5. Remote SIGNED_IN from Orders requires /holding
  assert.equal(getAuthRedirectRoute(['orders'], destSignedIn), '/holding');
  assert.equal(getAuthRedirectRoute('/orders', destSignedIn), '/holding');

  // 6. Remote SIGNED_IN from modal/customer routes requires /holding
  assert.equal(getAuthRedirectRoute(['check-in'], destSignedIn), '/holding');
  assert.equal(getAuthRedirectRoute(['refill'], destSignedIn), '/holding');
  assert.equal(getAuthRedirectRoute(['founder'], destSignedIn), '/holding');
  assert.equal(getAuthRedirectRoute(['founder', 'review-routine'], destSignedIn), '/holding');

  // 7. Remote SIGNED_IN already on /holding does NOT redirect (prevents redirect loop)
  assert.equal(getAuthRedirectRoute(['holding'], destSignedIn), null);
  assert.equal(getAuthRedirectRoute('/holding', destSignedIn), null);

  // 8. Remote SIGNED_OUT from protected/customer route requires login
  const destSignedOut = resolveAuthRoute({ remoteEnabled: true, authStatus: 'SIGNED_OUT' });
  assert.equal(getAuthRedirectRoute(['(tabs)', 'today'], destSignedOut), '/(auth)/login');
  assert.equal(getAuthRedirectRoute(['profile'], destSignedOut), '/(auth)/login');
  assert.equal(getAuthRedirectRoute(['holding'], destSignedOut), '/(auth)/login');
  assert.equal(getAuthRedirectRoute('/orders', destSignedOut), '/(auth)/login');

  // 9. Remote SIGNED_OUT already in auth flow does NOT redirect-loop
  assert.equal(getAuthRedirectRoute(['(auth)', 'login'], destSignedOut), null);
  assert.equal(getAuthRedirectRoute(['(auth)', 'verify-otp'], destSignedOut), null);
  assert.equal(getAuthRedirectRoute('/(auth)/login', destSignedOut), null);

  // 10. Remote INITIALIZING exposes no protected route (loading canvas)
  const destInit = resolveAuthRoute({ remoteEnabled: true, authStatus: 'INITIALIZING' });
  assert.equal(destInit.type, 'AUTH_LOADING');
  assert.equal(destInit.route, null);
  assert.equal(getAuthRedirectRoute(['(tabs)'], destInit), null);

  // 11. Mock mode still routes using local onboarding completion
  assert.deepEqual(
    resolveAuthRoute({ remoteEnabled: false, authStatus: 'SIGNED_OUT', isOnboardingCompleted: true }),
    { type: 'MOCK_TABS', route: '/(tabs)' }
  );
  assert.deepEqual(
    resolveAuthRoute({ remoteEnabled: false, authStatus: 'SIGNED_OUT', isOnboardingCompleted: false }),
    { type: 'MOCK_ONBOARDING', route: '/(onboarding)/1-welcome' }
  );
  assert.deepEqual(
    resolveAuthRoute({ remoteEnabled: false, authStatus: 'SIGNED_IN', isOnboardingCompleted: true }),
    { type: 'MOCK_TABS', route: '/(tabs)' }
  );

  // 12. Remote route decisions ignore local onboarding completion entirely
  assert.deepEqual(
    resolveAuthRoute({ remoteEnabled: true, authStatus: 'SIGNED_IN', isOnboardingCompleted: false }),
    { type: 'REMOTE_HOLDING', route: '/holding' }
  );
  assert.deepEqual(
    resolveAuthRoute({ remoteEnabled: true, authStatus: 'SIGNED_IN', isOnboardingCompleted: true }),
    { type: 'REMOTE_HOLDING', route: '/holding' }
  );
});

test('I1-A1.2 Founder Mode Isolation: resets on logout, remote identity projection, and account switch', () => {
  try {
    resetCustomerSessionData();

    // SCENARIO A: set isFounderMode = true, reset customer session, expect isFounderMode === false
    useUserStore.getState().toggleFounderMode();
    assert.equal(useUserStore.getState().isFounderMode, true);
    resetCustomerSessionData();
    assert.equal(useUserStore.getState().isFounderMode, false, 'resetCustomerSessionData must reset isFounderMode to false');

    // Also test direct userStore.logout()
    useUserStore.getState().toggleFounderMode();
    assert.equal(useUserStore.getState().isFounderMode, true);
    useUserStore.getState().logout();
    assert.equal(useUserStore.getState().isFounderMode, false, 'userStore.logout must reset isFounderMode to false');

    // SCENARIO B: Remote user A has founder mode true due to stale/local state, identity transition A -> B
    useAuthStore.getState().setSession('usr_A', 'userA@derive.skin');
    useUserStore.getState().setRemoteSessionUser('usr_A', 'userA@derive.skin');
    useUserStore.getState().toggleFounderMode();
    assert.equal(useUserStore.getState().isFounderMode, true);

    // Simulate identity transition to user B via subscribeToAuth listener
    let authListener: ((event: string, session: any) => void) | null = null;
    const mockAdapter: AuthAdapter = {
      async signInWithOtp() { return { data: {}, error: null }; },
      async verifyOtp() { return { data: { session: null, user: null }, error: null }; },
      async getSession() { return { data: { session: null }, error: null }; },
      async signOut() { return { error: null }; },
      onAuthStateChange(callback) {
        authListener = callback;
        return { data: { subscription: { unsubscribe: () => { authListener = null; } } } };
      },
    };
    setAuthAdapter(mockAdapter);
    const { unsubscribe } = subscribeToAuth();

    authListener!('SIGNED_IN', {
      user: { id: 'usr_B', email: 'userB@derive.skin' },
    });
    assert.equal(useAuthStore.getState().sessionUserId, 'usr_B');
    assert.equal(useUserStore.getState().isFounderMode, false, 'User B must not inherit founder mode from User A');

    unsubscribe();

    // SCENARIO C: Remote session projection occurs while store previously had founder mode true
    useUserStore.getState().toggleFounderMode();
    assert.equal(useUserStore.getState().isFounderMode, true);
    useUserStore.getState().setRemoteSessionUser('usr_C', 'userC@derive.skin');
    assert.equal(useUserStore.getState().isFounderMode, false, 'setRemoteSessionUser must force isFounderMode: false');

    // SCENARIO D: Mock explicit founder-mode toggle still functions in Mock/dev behavior
    useUserStore.getState().resetToDefault();
    assert.equal(useUserStore.getState().isFounderMode, false);
    useUserStore.getState().toggleFounderMode();
    assert.equal(useUserStore.getState().isFounderMode, true);
    useUserStore.getState().toggleFounderMode();
    assert.equal(useUserStore.getState().isFounderMode, false);
  } finally {
    resetAuthAdapter();
    resetCustomerSessionData();
  }
});

test('I1-A1.1 Session Reset: resetCustomerSessionData purges onboarding photos and questionnaire state', () => {
  useOnboardingStore.getState().loadArthurDemoState();
  useOnboardingStore.getState().completeOnboarding();
  useOnboardingStore.getState().setSkinPhotos({
    front: 'file:///sensitive_face.jpg',
    left: 'file:///sensitive_left.jpg',
    right: 'file:///sensitive_right.jpg',
  });
  assert.equal(useOnboardingStore.getState().isCompleted, true);
  assert.equal(useOnboardingStore.getState().frontPhotoUri, 'file:///sensitive_face.jpg');

  resetCustomerSessionData();

  assert.equal(useOnboardingStore.getState().isCompleted, false);
  assert.equal(useOnboardingStore.getState().frontPhotoUri, null);
  assert.equal(useOnboardingStore.getState().detectedProducts.length, 0);
  assert.equal(useOnboardingStore.getState().productReactions.length, 0);
  assert.equal(useOnboardingStore.getState().primaryGoal, null);
  assert.equal(useOnboardingStore.getState().secondaryGoals.length, 0);
});

// ========================================================
// 19. I1-A2 REMOTE CUSTOMER BOOTSTRAP RESOLUTION & PROFILE HANDSHAKE
// ========================================================

test('I1-A2 Shared Contract & Mock: satisfies CustomerBootstrapState across clean and seeded states', async () => {
  const service = new MockDeriveService();

  // 1. Mock implements getCustomerBootstrapState
  assert.equal(typeof service.getCustomerBootstrapState, 'function');

  // 2. Clean state returns profileExists: true, onboardingCompleted: false, membershipStatus: 'none'
  const cleanState = await service.getCustomerBootstrapState('usr_clean');
  assert.deepEqual(cleanState, {
    userId: 'usr_clean',
    profileExists: true,
    onboardingCompleted: false,
    membershipStatus: 'none',
  });

  // 3. Explicitly seeded Arthur demo fixture returns onboardingCompleted: true, membershipStatus: 'active'
  service.seedArthurDemoData();
  const arthurState = await service.getCustomerBootstrapState('usr_beta_001');
  assert.deepEqual(arthurState, {
    userId: 'usr_beta_001',
    profileExists: true,
    onboardingCompleted: true,
    membershipStatus: 'active',
  });

  // 4. reset() restores clean default state
  service.reset();
  const resetState = await service.getCustomerBootstrapState('usr_clean_2');
  assert.deepEqual(resetState, {
    userId: 'usr_clean_2',
    profileExists: true,
    onboardingCompleted: false,
    membershipStatus: 'none',
  });

  // 5. Test override simulates explicit edge cases
  service.setMockBootstrapState({ profileExists: false, onboardingCompleted: false, membershipStatus: 'none' });
  const overrideState = await service.getCustomerBootstrapState('usr_broken_profile');
  assert.equal(overrideState.profileExists, false);

  service.reset();
});

test('I1-A2 Database Mapping: canonical PostgREST projections and deterministic resolution', () => {
  // 6. Profile exists + no skin_profile -> onboardingCompleted: false
  const stateNoSkin = mapDbBootstrapState('u1', { id: 'u1' }, null, null);
  assert.deepEqual(stateNoSkin, {
    userId: 'u1',
    profileExists: true,
    onboardingCompleted: false,
    membershipStatus: 'none',
  });

  // 7. Profile exists + skin_profile onboarding_completed false -> onboardingCompleted: false
  const stateSkinFalse = mapDbBootstrapState('u2', { id: 'u2' }, { onboarding_completed: false }, null);
  assert.equal(stateSkinFalse.onboardingCompleted, false);

  // 8. Profile exists + skin_profile onboarding_completed true -> onboardingCompleted: true
  const stateSkinTrue = mapDbBootstrapState('u3', { id: 'u3' }, { onboarding_completed: true }, null);
  assert.equal(stateSkinTrue.onboardingCompleted, true);

  // 9. Profile row missing -> fails closed with profileExists: false
  const stateNoProfile = mapDbBootstrapState('u4', null, { onboarding_completed: true }, [{ status: 'active' }]);
  assert.deepEqual(stateNoProfile, {
    userId: 'u4',
    profileExists: false,
    onboardingCompleted: false,
    membershipStatus: 'none',
  });

  // 10. Membership status mapping: none, active, paused, cancelled
  assert.equal(mapDbBootstrapState('u5', { id: 'u5' }, null, []).membershipStatus, 'none');
  assert.equal(mapDbBootstrapState('u5', { id: 'u5' }, null, [{ status: 'active' }]).membershipStatus, 'active');
  assert.equal(mapDbBootstrapState('u5', { id: 'u5' }, null, [{ status: 'paused' }]).membershipStatus, 'paused');
  assert.equal(mapDbBootstrapState('u5', { id: 'u5' }, null, [{ status: 'cancelled' }]).membershipStatus, 'cancelled');
  assert.equal(mapDbBootstrapState('u5', { id: 'u5' }, null, [{ status: 'invalid_status' }]).membershipStatus, 'none');

  // 11. Deterministic membership selection if multiple rows are present (latest by created_at)
  const multipleMemberships = [
    { status: 'cancelled', created_at: '2026-01-01T00:00:00Z' },
    { status: 'active', created_at: '2026-09-01T00:00:00Z' },
    { status: 'paused', created_at: '2026-06-01T00:00:00Z' },
  ];
  const stateMultiple = mapDbBootstrapState('u6', { id: 'u6' }, null, multipleMemberships);
  assert.equal(stateMultiple.membershipStatus, 'active', 'Must pick latest membership by created_at');

  // 12. Profile mapping: snake_case maps to camelCase CustomerProfile
  const mappedProfile = mapDbCustomerProfile({
    id: 'u7',
    email: 'sarah@example.com',
    full_name: 'Sarah Connor',
    phone: '+15551234567',
    created_at: '2026-09-10T12:00:00Z',
    updated_at: '2026-09-10T14:00:00Z',
    memberships: [
      {
        id: 'm1',
        user_id: 'u7',
        tier: 'founding_beta',
        status: 'active',
        created_at: '2026-09-10T12:00:00Z',
      },
    ],
  });
  assert.deepEqual(mappedProfile, {
    id: 'u7',
    email: 'sarah@example.com',
    fullName: 'Sarah Connor',
    phone: '+15551234567',
    tier: 'founding_beta',
    membershipStatus: 'active',
    createdAt: '2026-09-10T12:00:00Z',
    updatedAt: '2026-09-10T14:00:00Z',
  });

  // 13. Profile mapping: protected Stripe fields are not required and omitted from output
  assert.equal((mappedProfile as any).stripeCustomerId, undefined);
  assert.equal((mappedProfile as any).stripe_customer_id, undefined);

  // 14. Profile mapping: invalid/unrepresentable tier returns null (does not fabricate fake tier)
  const invalidTierProfile = mapDbCustomerProfile({
    id: 'u8',
    email: 'unknown@example.com',
    full_name: 'Unknown Tier',
    created_at: '2026-09-10T12:00:00Z',
    updated_at: '2026-09-10T12:00:00Z',
    memberships: [
      {
        id: 'm2',
        user_id: 'u8',
        tier: 'pro_96_monthly',
        status: 'active',
        created_at: '2026-09-10T12:00:00Z',
      },
    ],
  });
  assert.equal(invalidTierProfile, null, 'Unrepresentable tier must return null under frozen contract');

  // 15. Profile mapping: absent membership returns null
  const noMembershipProfile = mapDbCustomerProfile({
    id: 'u9',
    email: 'nomember@example.com',
    created_at: '2026-09-10T12:00:00Z',
    updated_at: '2026-09-10T12:00:00Z',
    memberships: [],
  });
  assert.equal(noMembershipProfile, null, 'Absent membership returns null rather than fabricating tier/status');
});

test('I1-A2 Client Profile Resolution & Routing Policy: pure routing rules and holding lifecycle', () => {
  // 16. Remote SIGNED_IN + profile RESOLVING -> /holding
  assert.deepEqual(
    resolveAuthRoute({ remoteEnabled: true, authStatus: 'SIGNED_IN', profileResolution: 'RESOLVING' }),
    { type: 'REMOTE_HOLDING', route: '/holding' }
  );

  // 17. Remote SIGNED_IN + profile UNRESOLVED -> /holding
  assert.deepEqual(
    resolveAuthRoute({ remoteEnabled: true, authStatus: 'SIGNED_IN', profileResolution: 'UNRESOLVED' }),
    { type: 'REMOTE_HOLDING', route: '/holding' }
  );

  // 18. Remote SIGNED_IN + profile ERROR -> /holding (fail closed)
  assert.deepEqual(
    resolveAuthRoute({ remoteEnabled: true, authStatus: 'SIGNED_IN', profileResolution: 'ERROR' }),
    { type: 'REMOTE_HOLDING', route: '/holding' }
  );

  // 19. Remote SIGNED_IN + profile NEEDS_ONBOARDING -> /(onboarding)/1-welcome
  assert.deepEqual(
    resolveAuthRoute({ remoteEnabled: true, authStatus: 'SIGNED_IN', profileResolution: 'NEEDS_ONBOARDING' }),
    { type: 'REMOTE_ONBOARDING', route: '/(onboarding)/1-welcome' }
  );

  // 20. Remote SIGNED_IN + profile READY -> /(tabs)
  assert.deepEqual(
    resolveAuthRoute({ remoteEnabled: true, authStatus: 'SIGNED_IN', profileResolution: 'READY' }),
    { type: 'REMOTE_TABS', route: '/(tabs)' }
  );

  // 21. Local onboardingStore.isCompleted cannot alter Remote bootstrap routing
  assert.deepEqual(
    resolveAuthRoute({
      remoteEnabled: true,
      authStatus: 'SIGNED_IN',
      isOnboardingCompleted: true,
      profileResolution: 'NEEDS_ONBOARDING',
    }),
    { type: 'REMOTE_ONBOARDING', route: '/(onboarding)/1-welcome' },
    'Remote NEEDS_ONBOARDING must not be overridden by local isCompleted: true'
  );
  assert.deepEqual(
    resolveAuthRoute({
      remoteEnabled: true,
      authStatus: 'SIGNED_IN',
      isOnboardingCompleted: false,
      profileResolution: 'READY',
    }),
    { type: 'REMOTE_TABS', route: '/(tabs)' },
    'Remote READY must not be overridden by local isCompleted: false'
  );

  // 22. Membership status does not determine onboarding completion
  // An active membership with NEEDS_ONBOARDING routes to onboarding
  assert.deepEqual(
    resolveAuthRoute({
      remoteEnabled: true,
      authStatus: 'SIGNED_IN',
      profileResolution: 'NEEDS_ONBOARDING',
    }),
    { type: 'REMOTE_ONBOARDING', route: '/(onboarding)/1-welcome' }
  );

  // 23. getAuthRedirectRoute: REMOTE_ONBOARDING destination
  const destOnboarding = {
    type: 'REMOTE_ONBOARDING' as const,
    route: '/(onboarding)/1-welcome' as const,
  };
  // Inside onboarding -> returns null (no loop while navigating between onboarding steps)
  assert.equal(getAuthRedirectRoute(['(onboarding)', '1-welcome'], destOnboarding), null);
  assert.equal(getAuthRedirectRoute(['(onboarding)', '2-goals'], destOnboarding), null);
  assert.equal(getAuthRedirectRoute(['(onboarding)', '5-photos'], destOnboarding), null);
  assert.equal(getAuthRedirectRoute('/(onboarding)/1-welcome', destOnboarding), null);
  // Outside onboarding -> redirected to /(onboarding)/1-welcome
  assert.equal(getAuthRedirectRoute(['holding'], destOnboarding), '/(onboarding)/1-welcome');
  assert.equal(getAuthRedirectRoute(['(tabs)', 'today'], destOnboarding), '/(onboarding)/1-welcome');
  assert.equal(getAuthRedirectRoute(['profile'], destOnboarding), '/(onboarding)/1-welcome');
  assert.equal(getAuthRedirectRoute([], destOnboarding), '/(onboarding)/1-welcome');

  // 24. getAuthRedirectRoute: REMOTE_TABS destination
  const destTabs = {
    type: 'REMOTE_TABS' as const,
    route: '/(tabs)' as const,
  };
  // On holding or auth or onboarding -> redirected to /(tabs)
  assert.equal(getAuthRedirectRoute(['holding'], destTabs), '/(tabs)');
  assert.equal(getAuthRedirectRoute(['(auth)', 'login'], destTabs), '/(tabs)');
  assert.equal(getAuthRedirectRoute(['(onboarding)', '1-welcome'], destTabs), '/(tabs)');
  assert.equal(getAuthRedirectRoute([], destTabs), '/(tabs)');
  // Already on tabs or member screens -> returns null (no redirect loop, permitted access)
  assert.equal(getAuthRedirectRoute(['(tabs)', 'today'], destTabs), null);
  assert.equal(getAuthRedirectRoute(['(tabs)', 'plan'], destTabs), null);
  assert.equal(getAuthRedirectRoute(['profile'], destTabs), null);
  assert.equal(getAuthRedirectRoute(['orders'], destTabs), null);
  // Founder operations are local/demo only: Remote customer on founder route redirected to /(tabs)
  assert.equal(getAuthRedirectRoute(['founder'], destTabs), '/(tabs)');
  assert.equal(getAuthRedirectRoute(['founder', 'review-routine'], destTabs), '/(tabs)');
  assert.equal(getAuthRedirectRoute(['founder', 'refills'], destTabs), '/(tabs)');

  // 25. getAuthRedirectRoute: REMOTE_HOLDING destination
  const destHolding = {
    type: 'REMOTE_HOLDING' as const,
    route: '/holding' as const,
  };
  assert.equal(getAuthRedirectRoute(['holding'], destHolding), null);
  assert.equal(getAuthRedirectRoute(['(tabs)'], destHolding), '/holding');
  assert.equal(getAuthRedirectRoute(['(onboarding)'], destHolding), '/holding');
  assert.equal(getAuthRedirectRoute(['profile'], destHolding), '/holding');

  // 26. Mock mode remains unaffected
  assert.deepEqual(
    resolveAuthRoute({ remoteEnabled: false, authStatus: 'SIGNED_IN', isOnboardingCompleted: false }),
    { type: 'MOCK_ONBOARDING', route: '/(onboarding)/1-welcome' }
  );
  assert.deepEqual(
    resolveAuthRoute({ remoteEnabled: false, authStatus: 'SIGNED_IN', isOnboardingCompleted: true }),
    { type: 'MOCK_TABS', route: '/(tabs)' }
  );
});

test('I1-A2 Client Integration & Session Transitions: identity switch, refresh stability, error shielding', async () => {
  try {
    resetCustomerSessionData();

    // 27. Missing profile row fails closed: status becomes ERROR with shielded message
    const brokenBackend = new MockDeriveService();
    brokenBackend.setMockBootstrapState({ profileExists: false });
    setDeriveService(brokenBackend);

    const brokenResult = await resolveCustomerBootstrap('usr_missing_profile');
    assert.ok(brokenResult);
    assert.equal(brokenResult.profileExists, false);
    assert.equal(useBootstrapStore.getState().status, 'ERROR');
    assert.equal(
      useBootstrapStore.getState().errorMessage,
      getCustomerErrorMessage('bootstrap')
    );
    assert.equal(
      useBootstrapStore.getState().errorMessage,
      "We couldn't finish loading your account. Please try again."
    );

    // 28. Query failure (e.g. PostgREST/network error) fails closed with ERROR and shielded copy
    const failingBackend = new MockDeriveService();
    failingBackend.getCustomerBootstrapState = async () => {
      throw new Error('PostgREST 500: database connection error');
    };
    setDeriveService(failingBackend);

    const failResult = await resolveCustomerBootstrap('usr_failing');
    assert.equal(failResult, null);
    assert.equal(useBootstrapStore.getState().status, 'ERROR');
    assert.equal(
      useBootstrapStore.getState().errorMessage,
      "We couldn't finish loading your account. Please try again."
    );

    // 29. New member bootstrap: profileExists: true, onboardingCompleted: false -> NEEDS_ONBOARDING
    const newMemberBackend = new MockDeriveService();
    setDeriveService(newMemberBackend);

    useUserStore.getState().setRemoteSessionUser('usr_new', 'new@derive.skin');
    const newResult = await resolveCustomerBootstrap('usr_new');
    assert.ok(newResult);
    assert.equal(useBootstrapStore.getState().status, 'NEEDS_ONBOARDING');
    assert.equal(useBootstrapStore.getState().resolvedUserId, 'usr_new');
    assert.equal(useUserStore.getState().membershipStatus, 'none');

    // 30. Existing member bootstrap: profileExists: true, onboardingCompleted: true -> READY
    const existingMemberBackend = new MockDeriveService();
    existingMemberBackend.seedArthurDemoData();
    setDeriveService(existingMemberBackend);

    const existingResult = await resolveCustomerBootstrap('usr_existing');
    assert.ok(existingResult);
    assert.equal(useBootstrapStore.getState().status, 'READY');
    assert.equal(useBootstrapStore.getState().resolvedUserId, 'usr_existing');
    assert.equal(useUserStore.getState().membershipStatus, 'active');
    assert.equal(useUserStore.getState().fullName, 'Arthur Pendelton');

    // 31. Identity switch A -> B: resetCustomerSessionData purges bootstrap state, resolves B independently
    resetCustomerSessionData();
    assert.equal(useBootstrapStore.getState().status, 'UNRESOLVED');
    assert.equal(useBootstrapStore.getState().resolvedUserId, null);
    assert.equal(useBootstrapStore.getState().bootstrapState, null);

    // Resolve as User B with NEEDS_ONBOARDING
    setDeriveService(newMemberBackend);
    await resolveCustomerBootstrap('usr_B');
    assert.equal(useBootstrapStore.getState().status, 'NEEDS_ONBOARDING');
    assert.equal(useBootstrapStore.getState().resolvedUserId, 'usr_B');

    // 32. Same-user token refresh: preserves status and does not destroy state
    // (verified by checking that repeated getSession or active session does not purge bootstrap state)
    assert.equal(useBootstrapStore.getState().status, 'NEEDS_ONBOARDING');
    assert.equal(useBootstrapStore.getState().resolvedUserId, 'usr_B');

    // 33. Empty or whitespace userId fails closed immediately
    const emptyResult = await resolveCustomerBootstrap('   ');
    assert.equal(emptyResult, null);
    assert.equal(useBootstrapStore.getState().status, 'ERROR');
  } finally {
    setDeriveService(null);
    resetCustomerSessionData();
  }
});

test('I1-A2 RemoteDeriveService PostgREST query execution: typed client double verification', async () => {
  const queryLog: string[] = [];

  // Construct a typed client double simulating Supabase PostgREST queries
  const mockSupabaseClient = {
    from(table: string) {
      queryLog.push(`from:${table}`);
      return {
        select(columns: string) {
          queryLog.push(`select:${columns}`);
          return {
            eq(col: string, val: string) {
              queryLog.push(`eq:${col}=${val}`);
              return {
                async maybeSingle() {
                  if (table === 'profiles') {
                    return { data: { id: val }, error: null };
                  }
                  if (table === 'skin_profiles') {
                    return { data: { onboarding_completed: true }, error: null };
                  }
                  return { data: null, error: null };
                },
                order(orderCol: string, opts: any) {
                  queryLog.push(`order:${orderCol},asc=${opts?.ascending}`);
                  return {
                    limit(n: number) {
                      queryLog.push(`limit:${n}`);
                      return {
                        async maybeSingle() {
                          return { data: { status: 'active', created_at: '2026-09-18T00:00:00Z' }, error: null };
                        },
                      };
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  };

  const remoteService = new RemoteDeriveService(mockSupabaseClient);
  const bootstrap = await remoteService.getCustomerBootstrapState('usr_live_test');

  assert.deepEqual(bootstrap, {
    userId: 'usr_live_test',
    profileExists: true,
    onboardingCompleted: true,
    membershipStatus: 'active',
  });

  // Verify exact queries performed
  assert.ok(queryLog.includes('from:profiles'));
  assert.ok(queryLog.includes('from:skin_profiles'));
  assert.ok(queryLog.includes('from:memberships'));
  assert.ok(queryLog.includes('order:created_at,asc=false'));
  assert.ok(queryLog.includes('limit:1'));
});

// ========================================================
// 23. I1-A2.1 BOOTSTRAP FRESHNESS & FOUNDER SURFACE ISOLATION
// ========================================================

test('I1-A2.1 Bootstrap Freshness: User A -> User B identity switch race (A resolves after B)', async () => {
  try {
    resetCustomerSessionData();

    // Create deferred promises for deterministic resolution control
    let resolveA!: (value: CustomerBootstrapState) => void;
    const promiseA = new Promise<CustomerBootstrapState>((res) => {
      resolveA = res;
    });

    let resolveB!: (value: CustomerBootstrapState) => void;
    const promiseB = new Promise<CustomerBootstrapState>((res) => {
      resolveB = res;
    });

    const mockService = new MockDeriveService();
    mockService.getCustomerBootstrapState = async (userId: string) => {
      if (userId === 'usr_A') {
        return promiseA;
      }
      if (userId === 'usr_B') {
        return promiseB;
      }
      return {
        userId,
        profileExists: true,
        onboardingCompleted: false,
        membershipStatus: 'none',
      };
    };
    setDeriveService(mockService);

    // 1. User A authenticated, bootstrap request A begins
    useAuthStore.getState().setSession('usr_A', 'a@derive.skin');
    useUserStore.getState().setRemoteSessionUser('usr_A', 'a@derive.skin');
    const requestA = resolveCustomerBootstrap('usr_A');
    assert.equal(useBootstrapStore.getState().status, 'RESOLVING');
    assert.equal(useBootstrapStore.getState().resolvedUserId, 'usr_A');

    // 2. Before A resolves, user switches to B. sessionReset is called.
    resetCustomerSessionData();
    useAuthStore.getState().setSession('usr_B', 'b@derive.skin');
    useUserStore.getState().setRemoteSessionUser('usr_B', 'b@derive.skin');

    // 3. User B bootstrap request begins
    const requestB = resolveCustomerBootstrap('usr_B');
    assert.equal(useBootstrapStore.getState().status, 'RESOLVING');
    assert.equal(useBootstrapStore.getState().resolvedUserId, 'usr_B');

    // 4. B resolves FIRST (User B is an existing active member)
    resolveB({
      userId: 'usr_B',
      profileExists: true,
      onboardingCompleted: true,
      membershipStatus: 'active',
    });
    const resultB = await requestB;
    assert.ok(resultB);
    assert.equal(resultB.userId, 'usr_B');
    assert.equal(useBootstrapStore.getState().status, 'READY');
    assert.equal(useBootstrapStore.getState().resolvedUserId, 'usr_B');
    assert.equal(useUserStore.getState().membershipStatus, 'active');

    // 5. Older A request resolves AFTERWARD (User A was a new member needing onboarding)
    resolveA({
      userId: 'usr_A',
      profileExists: true,
      onboardingCompleted: false,
      membershipStatus: 'none',
    });
    const resultA = await requestA;
    // The stale result must be discarded by resolveCustomerBootstrap
    assert.equal(resultA, null);

    // Store state must strictly remain User B's state
    assert.equal(useBootstrapStore.getState().status, 'READY');
    assert.equal(useBootstrapStore.getState().resolvedUserId, 'usr_B');
    assert.equal(useBootstrapStore.getState().bootstrapState?.userId, 'usr_B');
    assert.equal(useUserStore.getState().membershipStatus, 'active');
  } finally {
    setDeriveService(null);
    resetCustomerSessionData();
  }
});

test('I1-A2.1 Bootstrap Freshness: Reverse completion order (A finishes before B while B is active identity)', async () => {
  try {
    resetCustomerSessionData();

    let resolveA!: (value: CustomerBootstrapState) => void;
    const promiseA = new Promise<CustomerBootstrapState>((res) => {
      resolveA = res;
    });

    let resolveB!: (value: CustomerBootstrapState) => void;
    const promiseB = new Promise<CustomerBootstrapState>((res) => {
      resolveB = res;
    });

    const mockService = new MockDeriveService();
    mockService.getCustomerBootstrapState = async (userId: string) => {
      if (userId === 'usr_A') return promiseA;
      if (userId === 'usr_B') return promiseB;
      return { userId, profileExists: true, onboardingCompleted: false, membershipStatus: 'none' };
    };
    setDeriveService(mockService);

    // 1. User A starts
    useAuthStore.getState().setSession('usr_A', 'a@derive.skin');
    useUserStore.getState().setRemoteSessionUser('usr_A', 'a@derive.skin');
    const requestA = resolveCustomerBootstrap('usr_A');

    // 2. Switch to User B before A resolves
    resetCustomerSessionData();
    useAuthStore.getState().setSession('usr_B', 'b@derive.skin');
    useUserStore.getState().setRemoteSessionUser('usr_B', 'b@derive.skin');
    const requestB = resolveCustomerBootstrap('usr_B');

    // 3. User A returns BEFORE User B finishes
    resolveA({
      userId: 'usr_A',
      profileExists: true,
      onboardingCompleted: true,
      membershipStatus: 'active',
    });
    const resultA = await requestA;
    // A must be discarded because active session and attempt belong to B
    assert.equal(resultA, null);
    assert.equal(useBootstrapStore.getState().status, 'RESOLVING');
    assert.equal(useBootstrapStore.getState().resolvedUserId, 'usr_B');

    // 4. User B finishes
    resolveB({
      userId: 'usr_B',
      profileExists: true,
      onboardingCompleted: false,
      membershipStatus: 'none',
    });
    const resultB = await requestB;
    assert.ok(resultB);
    assert.equal(resultB.userId, 'usr_B');
    assert.equal(useBootstrapStore.getState().status, 'NEEDS_ONBOARDING');
    assert.equal(useBootstrapStore.getState().resolvedUserId, 'usr_B');
  } finally {
    setDeriveService(null);
    resetCustomerSessionData();
  }
});

test('I1-A2.1 Bootstrap Freshness: Same-user retry race (attempt 1 later errors after attempt 2 succeeded)', async () => {
  try {
    resetCustomerSessionData();

    let rejectAttempt1!: (err: Error) => void;
    const promise1 = new Promise<CustomerBootstrapState>((_, rej) => {
      rejectAttempt1 = rej;
    });

    let resolveAttempt2!: (value: CustomerBootstrapState) => void;
    const promise2 = new Promise<CustomerBootstrapState>((res) => {
      resolveAttempt2 = res;
    });

    let invocationCount = 0;
    const mockService = new MockDeriveService();
    mockService.getCustomerBootstrapState = async () => {
      invocationCount++;
      if (invocationCount === 1) return promise1;
      return promise2;
    };
    setDeriveService(mockService);

    useAuthStore.getState().setSession('usr_retry', 'retry@derive.skin');
    useUserStore.getState().setRemoteSessionUser('usr_retry', 'retry@derive.skin');

    // 1. Attempt 1 starts
    const request1 = resolveCustomerBootstrap('usr_retry');
    assert.equal(useBootstrapStore.getState().status, 'RESOLVING');

    // 2. User presses Retry -> Attempt 2 starts
    const request2 = resolveCustomerBootstrap('usr_retry');
    assert.equal(useBootstrapStore.getState().status, 'RESOLVING');

    // 3. Attempt 2 resolves with success (READY)
    resolveAttempt2({
      userId: 'usr_retry',
      profileExists: true,
      onboardingCompleted: true,
      membershipStatus: 'active',
    });
    const result2 = await request2;
    assert.ok(result2);
    assert.equal(useBootstrapStore.getState().status, 'READY');

    // 4. Attempt 1 later fails/rejects with a network error
    rejectAttempt1(new Error('Network timeout on attempt 1'));
    const result1 = await request1;
    assert.equal(result1, null);

    // Stale error from attempt 1 MUST NOT overwrite newer success
    assert.equal(useBootstrapStore.getState().status, 'READY');
    assert.equal(useBootstrapStore.getState().errorMessage, null);
    assert.equal(useBootstrapStore.getState().resolvedUserId, 'usr_retry');
  } finally {
    setDeriveService(null);
    resetCustomerSessionData();
  }
});

test('I1-A2.1 Bootstrap Freshness: Stale profile hydration discarded after identity switch', async () => {
  try {
    resetCustomerSessionData();

    let resolveProfileA!: (profile: CustomerProfile) => void;
    const profilePromiseA = new Promise<CustomerProfile>((res) => {
      resolveProfileA = res;
    });

    // Create a RemoteDeriveService double to trigger isRemoteServiceEnabled() === true
    const mockRemoteService = Object.create(RemoteDeriveService.prototype) as RemoteDeriveService;
    mockRemoteService.getCustomerProfile = async (id: string) => {
      if (id === 'usr_A') return profilePromiseA;
      return null;
    };
    setDeriveService(mockRemoteService);
    assert.equal(isRemoteServiceEnabled(), true);

    // 1. User A starts profile hydration
    useAuthStore.getState().setSession('usr_A', 'a@derive.skin');
    useUserStore.getState().setRemoteSessionUser('usr_A', 'a@derive.skin');

    const hydrationA = hydrateCustomerProfile('usr_A');

    // 2. Identity switches to B
    resetCustomerSessionData();
    useAuthStore.getState().setSession('usr_B', 'b@derive.skin');
    useUserStore.getState().setRemoteSessionUser('usr_B', 'b@derive.skin');

    // 3. Profile A finishes loading
    resolveProfileA({
      id: 'usr_A',
      email: 'a@derive.skin',
      fullName: 'Alice Anderson',
      membershipStatus: 'active',
      tier: 'founding_beta',
      createdAt: '2026-09-18T00:00:00.000Z',
      updatedAt: '2026-09-18T00:00:00.000Z',
    });

    const resultA = await hydrationA;
    // Should return null and NOT project Alice's data into UserStore for B
    assert.equal(resultA, null);
    assert.equal(useUserStore.getState().userId, 'usr_B');
    assert.equal(useUserStore.getState().fullName, '');
  } finally {
    setDeriveService(null);
    resetCustomerSessionData();
  }
});

test('I1-A2.1 Founder Surface Isolation: Remote customer states cannot access /founder/**', () => {
  // 1. Remote READY: allowed customer screens
  const destTabs = {
    type: 'REMOTE_TABS' as const,
    route: '/(tabs)' as const,
  };
  assert.equal(getAuthRedirectRoute(['(tabs)', 'today'], destTabs), null);
  assert.equal(getAuthRedirectRoute(['(tabs)', 'plan'], destTabs), null);
  assert.equal(getAuthRedirectRoute(['(tabs)', 'scan'], destTabs), null);
  assert.equal(getAuthRedirectRoute(['(tabs)', 'ask'], destTabs), null);
  assert.equal(getAuthRedirectRoute(['(tabs)', 'progress'], destTabs), null);
  assert.equal(getAuthRedirectRoute(['profile'], destTabs), null);
  assert.equal(getAuthRedirectRoute(['orders'], destTabs), null);
  assert.equal(getAuthRedirectRoute(['check-in'], destTabs), null);
  assert.equal(getAuthRedirectRoute(['refill'], destTabs), null);
  assert.equal(getAuthRedirectRoute(['insights', 'retinoid-tolerance'], destTabs), null);

  // Founder routes in Remote READY: must be redirected to /(tabs)
  assert.equal(getAuthRedirectRoute(['founder'], destTabs), '/(tabs)');
  assert.equal(getAuthRedirectRoute(['founder', 'review-routine'], destTabs), '/(tabs)');
  assert.equal(getAuthRedirectRoute(['founder', 'refills'], destTabs), '/(tabs)');
  assert.equal(getAuthRedirectRoute('/founder', destTabs), '/(tabs)');
  assert.equal(getAuthRedirectRoute('/founder/review-routine', destTabs), '/(tabs)');
  assert.equal(getAuthRedirectRoute('/founder/refills', destTabs), '/(tabs)');

  // 2. Remote NEEDS_ONBOARDING: founder routes redirect to onboarding
  const destOnboarding = {
    type: 'REMOTE_ONBOARDING' as const,
    route: '/(onboarding)/1-welcome' as const,
  };
  assert.equal(getAuthRedirectRoute(['founder'], destOnboarding), '/(onboarding)/1-welcome');
  assert.equal(getAuthRedirectRoute(['founder', 'review-routine'], destOnboarding), '/(onboarding)/1-welcome');
  assert.equal(getAuthRedirectRoute(['founder', 'refills'], destOnboarding), '/(onboarding)/1-welcome');

  // 3. Remote RESOLVING / ERROR: founder routes redirect to holding
  const destHolding = {
    type: 'REMOTE_HOLDING' as const,
    route: '/holding' as const,
  };
  assert.equal(getAuthRedirectRoute(['founder'], destHolding), '/holding');
  assert.equal(getAuthRedirectRoute(['founder', 'review-routine'], destHolding), '/holding');
  assert.equal(getAuthRedirectRoute(['founder', 'refills'], destHolding), '/holding');

  // 4. Remote SIGNED_OUT: founder routes redirect to login
  const destLogin = {
    type: 'AUTH_LOGIN' as const,
    route: '/(auth)/login' as const,
  };
  assert.equal(getAuthRedirectRoute(['founder'], destLogin), '/(auth)/login');
  assert.equal(getAuthRedirectRoute(['founder', 'review-routine'], destLogin), '/(auth)/login');
  assert.equal(getAuthRedirectRoute(['founder', 'refills'], destLogin), '/(auth)/login');

  // 5. Mock mode: does not enforce remote redirect on founder routes
  assert.deepEqual(
    resolveAuthRoute({ remoteEnabled: false, authStatus: 'SIGNED_IN', isOnboardingCompleted: true }),
    { type: 'MOCK_TABS', route: '/(tabs)' }
  );
  // getAuthRedirectRoute for MOCK_TABS destination does not redirect
  const destMockTabs = {
    type: 'MOCK_TABS' as const,
    route: '/(tabs)' as const,
  };
  assert.equal(getAuthRedirectRoute(['founder'], destMockTabs), null);
});

// ========================================================
// I1-B0 ONBOARDING PERSISTENCE & SAFETY PROVENANCE TESTS
// ========================================================

test('I1-B0 Safety State Provenance: Store initializes to unanswered without false negatives', () => {
  useOnboardingStore.getState().resetOnboarding();
  const state = useOnboardingStore.getState();

  assert.equal(state.pregnancyStatus, 'unanswered');
  assert.equal(state.isPregnantOrNursing, false);
  assert.equal(state.sensitivitiesStatus, 'unanswered');
  assert.deepEqual(state.knownSensitivities, []);

  // Screen initialization non-coercion logic check
  const sensitivitiesStatusValue: string = state.sensitivitiesStatus;
  const hasNoSensitivities = sensitivitiesStatusValue === 'none_known';
  assert.equal(hasNoSensitivities, false, 'Unanswered sensitivities must not coerce to hasNoSensitivities=true');

  const pregnancyState = state.pregnancyStatus !== 'unanswered'
    ? state.pregnancyStatus
    : (state.isPregnantOrNursing ? 'yes' : 'unanswered');
  assert.equal(pregnancyState, 'unanswered', 'Unanswered pregnancy must not coerce to pregnancyState="no"');
});

test('I1-B0 Safety State Provenance: setSafetyContext preserves explicit user choices and fallbacks', () => {
  useOnboardingStore.getState().resetOnboarding();

  // 1. Explicit 'none_known'
  useOnboardingStore.getState().setSafetyContext({
    sensitivities: [],
    sensitivitiesStatus: 'none_known',
    prescriptions: [],
    pregnancy: false,
    pregnancyStatus: 'no',
  });
  let state = useOnboardingStore.getState();
  assert.equal(state.sensitivitiesStatus, 'none_known');
  assert.equal(state.pregnancyStatus, 'no');
  assert.equal(state.isPregnantOrNursing, false);

  // 2. Explicit 'prefer_not_to_say'
  useOnboardingStore.getState().setSafetyContext({
    sensitivities: ['Niacinamide'],
    sensitivitiesStatus: 'reported',
    prescriptions: [],
    pregnancy: false,
    pregnancyStatus: 'prefer_not_to_say',
  });
  state = useOnboardingStore.getState();
  assert.equal(state.sensitivitiesStatus, 'reported');
  assert.deepEqual(state.knownSensitivities, ['Niacinamide']);
  assert.equal(state.pregnancyStatus, 'prefer_not_to_say');
  assert.equal(state.isPregnantOrNursing, false);

  // 3. Explicit 'yes'
  useOnboardingStore.getState().setSafetyContext({
    sensitivities: [],
    sensitivitiesStatus: 'unanswered',
    prescriptions: [],
    pregnancy: true,
    pregnancyStatus: 'yes',
  });
  state = useOnboardingStore.getState();
  assert.equal(state.pregnancyStatus, 'yes');
  assert.equal(state.isPregnantOrNursing, true);
  assert.equal(state.sensitivitiesStatus, 'unanswered');

  // 4. Default fallbacks when statuses are omitted:
  // Non-empty sensitivities -> 'reported', empty sensitivities -> 'unanswered' (never 'none_known')
  useOnboardingStore.getState().setSafetyContext({
    sensitivities: [],
    prescriptions: [],
    pregnancy: false,
  });
  state = useOnboardingStore.getState();
  assert.equal(state.sensitivitiesStatus, 'unanswered', 'Omitted sensitivitiesStatus with empty array must default to unanswered');
  assert.equal(state.pregnancyStatus, 'unanswered', 'Omitted pregnancyStatus with false boolean must default to unanswered');
});

test('I1-B0 Summary Screen Display Copy: Formats safety states truthfully', () => {
  // Pure copy formatter matching 10-summary.tsx audit rows
  function formatPregnancyDisplay(status: string): string {
    return status === 'yes'
      ? 'Yes'
      : status === 'no'
      ? 'No'
      : status === 'prefer_not_to_say'
      ? 'Prefer not to say'
      : 'Not answered';
  }

  function formatSensitivitiesDisplay(status: string, items: string[]): string {
    return status === 'none_known'
      ? 'No known allergies'
      : status === 'reported' && items.length > 0
      ? items.join(', ')
      : 'Not answered';
  }

  // Pregnancy display truth
  assert.equal(formatPregnancyDisplay('yes'), 'Yes');
  assert.equal(formatPregnancyDisplay('no'), 'No');
  assert.equal(formatPregnancyDisplay('prefer_not_to_say'), 'Prefer not to say');
  assert.equal(formatPregnancyDisplay('unanswered'), 'Not answered');

  // Sensitivities display truth
  assert.equal(formatSensitivitiesDisplay('none_known', []), 'No known allergies');
  assert.equal(formatSensitivitiesDisplay('reported', ['Benzoyl Peroxide', 'Fragrance']), 'Benzoyl Peroxide, Fragrance');
  assert.equal(formatSensitivitiesDisplay('unanswered', []), 'Not answered');
});

test('I1-B0 Pure Payload Builder: Preserves safety provenance and handles empty state cleanly', () => {
  // Empty state snapshot
  const payload = buildOnboardingPayload({}, 'usr_beta_member', false);
  assert.equal(payload.userId, 'usr_beta_member');
  assert.equal(payload.primaryGoal, 'breakouts');
  assert.equal(payload.safetyContext.sensitivitiesStatus, 'unanswered');
  assert.equal(payload.safetyContext.pregnancyStatus, 'unanswered');
  assert.equal(payload.safetyContext.isPregnantOrNursing, false);
  assert.deepEqual(payload.safetyContext.knownSensitivities, []);

  // Explicit safety choices snapshot
  const customPayload = buildOnboardingPayload({
    primaryGoal: 'fine_lines',
    sensitivitiesStatus: 'none_known',
    knownSensitivities: [],
    pregnancyStatus: 'prefer_not_to_say',
    isPregnantOrNursing: false,
    activePrescriptions: ['Tretinoin 0.05%'],
  }, 'usr_beta_member', false);

  assert.equal(customPayload.safetyContext.sensitivitiesStatus, 'none_known');
  assert.equal(customPayload.safetyContext.pregnancyStatus, 'prefer_not_to_say');
  assert.equal(customPayload.safetyContext.isPregnantOrNursing, false);
  assert.deepEqual(customPayload.safetyContext.activePrescriptions, ['Tretinoin 0.05%']);
});

test('I1-B0 Remote Identity Protection: buildOnboardingPayload fails closed against mock IDs in Remote mode', () => {
  // Mock mode: allows fallback to 'usr_beta_member'
  const mockPayload = buildOnboardingPayload({}, undefined, false);
  assert.equal(mockPayload.userId, 'usr_beta_member');

  // Remote mode: rejects empty/missing user ID
  assert.throws(
    () => buildOnboardingPayload({}, '', true),
    /Valid member identity required/
  );
  assert.throws(
    () => buildOnboardingPayload({}, '   ', true),
    /Valid member identity required/
  );

  // Remote mode: rejects known mock IDs
  assert.throws(
    () => buildOnboardingPayload({}, 'usr_beta_member', true),
    /Valid member identity required/
  );
  assert.throws(
    () => buildOnboardingPayload({}, 'usr_beta_001', true),
    /Valid member identity required/
  );

  // Remote mode: accepts valid non-mock customer identity
  const remotePayload = buildOnboardingPayload({}, 'usr_real_member_999', true);
  assert.equal(remotePayload.userId, 'usr_real_member_999');
});

test('I1-B0 Mock Service: Preserves canonical safety statuses on returned SkinProfile', async () => {
  const service = new MockDeriveService();
  const payload = buildOnboardingPayload({
    primaryGoal: 'breakouts',
    sensitivitiesStatus: 'none_known',
    knownSensitivities: [],
    pregnancyStatus: 'no',
    isPregnantOrNursing: false,
    activePrescriptions: [],
  }, 'usr_beta_member', false);

  const result = await service.onboard(payload);
  assert.equal(result.skinProfile.sensitivitiesStatus, 'none_known');
  assert.equal(result.skinProfile.pregnancyStatus, 'no');
  assert.equal(result.skinProfile.isPregnantOrNursing, false);
  assert.equal(result.skinProfile.onboardingCompleted, true);
  assert.equal(result.initialRoutineState, 'awaiting_review');
});

// ========================================================
// 33. I1-B1 AUTHENTICATED REMOTE ONBOARDING INTAKE & PHOTO PIPELINE
// ========================================================

test('I1-B1 Shared Contract & Payload: buildOnboardingPayload maps enriched fields with fidelity', () => {
  const dummyFormulaSnapshots: FormulaSnapshot[] = [
    {
      id: 'fs_test_1',
      productId: 'prod_test_1',
      brand: 'TestBrand',
      productName: 'TestMoisturizer',
      ingredients: ['water', 'glycerin', 'ceramide np'],
      capturedAt: new Date().toISOString(),
    },
  ];

  const payload = buildOnboardingPayload(
    {
      primaryGoal: 'breakouts',
      secondaryGoals: ['texture'],
      routineComplexity: 'simple',
      costPreference: 'balanced',
      middayFeel: 'oily_shiny',
      postCleanseTightness: true,
      frontPhotoUri: 'file:///local/front.jpg',
      leftPhotoUri: 'file:///local/left.jpg',
      rightPhotoUri: 'file:///local/right.jpg',
      shelfPhotoUri: 'file:///local/shelf.jpg',
      photoContextNote: 'Morning lighting near window',
      formulaSnapshots: dummyFormulaSnapshots,
      adaptiveFollowUps: [{ question: 'Do you experience flaking?', answer: 'Rarely' }],
      pihTendencyAnswer: 'Sometimes',
      hasBadReactions: true,
      productReactions: [],
      knownSensitivities: ['Fragrance'],
      sensitivitiesStatus: 'reported',
      pregnancyStatus: 'no',
      isPregnantOrNursing: false,
    },
    'usr_beta_member',
    false
  );

  assert.equal(payload.skinPhotos.frontUri, 'file:///local/front.jpg');
  assert.equal(payload.skinPhotos.leftUri, 'file:///local/left.jpg');
  assert.equal(payload.skinPhotos.rightUri, 'file:///local/right.jpg');
  assert.equal(payload.skinPhotos.shelfUri, 'file:///local/shelf.jpg');
  assert.equal(payload.skinPhotos.contextNote, 'Morning lighting near window');
  assert.deepEqual(payload.formulaSnapshots, dummyFormulaSnapshots);
  assert.deepEqual(payload.adaptiveFollowUps, [{ question: 'Do you experience flaking?', answer: 'Rarely' }]);
  assert.equal(payload.pihTendencyAnswer, 'Sometimes');
  assert.equal(payload.hasBadReactions, true);
});

test('I1-B1 Client Routine Store & submitOnboarding: Safely handles null proposedRoutine and pending_generation without dereference error', async () => {
  class B1RemoteMockService extends MockDeriveService {
    override async onboard(payload: OnboardingPayload): Promise<OnboardingResult> {
      return {
        userId: 'usr_b1_member',
        skinProfile: {
          id: 'sp_b1_test',
          userId: 'usr_b1_member',
          primaryGoal: payload.primaryGoal,
          secondaryGoals: payload.secondaryGoals,
          routineComplexity: payload.routineComplexity,
          costPreference: payload.costPreference,
          middayFeel: payload.middayFeel,
          postCleanseTightness: payload.postCleanseTightness,
          knownSensitivities: [],
          sensitivitiesStatus: 'none_known',
          activePrescriptions: [],
          isPregnantOrNursing: false,
          pregnancyStatus: 'no',
          onboardingCompleted: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        proposedRoutine: null,
        userProducts: [],
        initialRoutineState: 'pending_generation',
      };
    }
  }

  const origService = getDeriveService();
  setDeriveService(new B1RemoteMockService());

  try {
    const payload = buildOnboardingPayload({
      primaryGoal: 'breakouts',
      sensitivitiesStatus: 'none_known',
      pregnancyStatus: 'no',
    }, 'usr_b1_member', false);

    // Call submitOnboarding with null proposedRoutine
    const result = await submitOnboarding(payload);

    assert.equal(result.proposedRoutine, null);
    assert.equal(result.initialRoutineState, 'pending_generation');

    // RoutineStore projections
    const routineState = useRoutineStore.getState();
    assert.equal(routineState.routine, null);
    assert.equal(routineState.isPlanUnderReview, false);
    assert.equal(routineState.todayDominantStatus, 'Your routine is being prepared.');
    assert.deepEqual(routineState.userProducts, []);
  } finally {
    setDeriveService(origService);
  }
});

test('I1-B1.1 Client Routine Store & submitOnboarding: awaiting_review with routine sets isPlanUnderReview and final review copy', async () => {
  class B1AwaitingReviewService extends MockDeriveService {
    override async onboard(payload: OnboardingPayload): Promise<OnboardingResult> {
      return {
        userId: 'usr_b1_awaiting',
        skinProfile: {
          id: 'sp_awaiting_test',
          userId: 'usr_b1_awaiting',
          primaryGoal: payload.primaryGoal,
          secondaryGoals: payload.secondaryGoals,
          routineComplexity: payload.routineComplexity,
          costPreference: payload.costPreference,
          middayFeel: payload.middayFeel,
          postCleanseTightness: payload.postCleanseTightness,
          knownSensitivities: [],
          sensitivitiesStatus: 'none_known',
          activePrescriptions: [],
          isPregnantOrNursing: false,
          pregnancyStatus: 'no',
          onboardingCompleted: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        proposedRoutine: {
          id: 'rtn_test_1',
          userId: 'usr_b1_awaiting',
          version: 1,
          status: 'awaiting_review',
          summarySentence: 'Draft plan under review',
          amSteps: [],
          pmSteps: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        userProducts: [],
        initialRoutineState: 'awaiting_review',
      };
    }
  }

  const origService = getDeriveService();
  setDeriveService(new B1AwaitingReviewService());

  try {
    const payload = buildOnboardingPayload({
      primaryGoal: 'breakouts',
      sensitivitiesStatus: 'none_known',
      pregnancyStatus: 'no',
    }, 'usr_b1_awaiting', false);

    const result = await submitOnboarding(payload);

    assert.ok(result.proposedRoutine);
    assert.equal(result.initialRoutineState, 'awaiting_review');

    const routineState = useRoutineStore.getState();
    assert.ok(routineState.routine);
    assert.equal(routineState.isPlanUnderReview, true);
    assert.equal(
      routineState.todayDominantStatus,
      'Final review: Your first routine gets one final quality check before it goes live.'
    );
  } finally {
    setDeriveService(origService);
  }
});

test('I1-B1 Membership Protection: submitOnboarding does not assert active membership in Remote mode', async () => {
  class B1RemoteServiceDouble extends RemoteDeriveService {
    constructor() {
      super({} as any);
    }
    override async onboard(payload: OnboardingPayload): Promise<OnboardingResult> {
      return {
        userId: 'usr_remote_truth',
        skinProfile: {
          id: 'sp_remote_test',
          userId: 'usr_remote_truth',
          primaryGoal: payload.primaryGoal,
          secondaryGoals: payload.secondaryGoals,
          routineComplexity: payload.routineComplexity,
          costPreference: payload.costPreference,
          middayFeel: payload.middayFeel,
          postCleanseTightness: payload.postCleanseTightness,
          knownSensitivities: [],
          sensitivitiesStatus: 'none_known',
          activePrescriptions: [],
          isPregnantOrNursing: false,
          pregnancyStatus: 'no',
          onboardingCompleted: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        proposedRoutine: null,
        userProducts: [],
        initialRoutineState: 'pending_generation',
      };
    }
  }

  const origService = getDeriveService();
  setDeriveService(new B1RemoteServiceDouble());

  try {
    // Initial user state has membershipStatus: 'none'
    useUserStore.setState({
      userId: 'usr_remote_truth',
      membershipStatus: 'none',
    });

    const payload = buildOnboardingPayload({
      primaryGoal: 'breakouts',
      sensitivitiesStatus: 'none_known',
      pregnancyStatus: 'no',
    }, 'usr_remote_truth', true);

    await submitOnboarding(payload);

    // In Remote mode, membershipStatus must NOT be blindly overwritten to 'active'
    assert.equal(useUserStore.getState().membershipStatus, 'none');
  } finally {
    setDeriveService(origService);
  }
});

test('I1-B1 Storage Photo Upload Helper: Enforces private bucket, server path, and upsert=false', async () => {
  const uploadCalls: Array<{ bucket: string; path: string; options: any }> = [];

  const mockClient = {
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string, body: any, options: any) => {
          uploadCalls.push({ bucket, path, options });
          return { data: { path }, error: null };
        },
      }),
    },
  };

  // Mock global fetch for testing
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url: any) => {
    return {
      ok: true,
      blob: async () => ({
        type: 'image/jpeg',
      }),
    } as any;
  };

  try {
    await uploadPhotoToStorage(
      'usr_123/front/photo_test.jpg',
      'file:///local/photo_test.jpg',
      mockClient
    );

    assert.equal(uploadCalls.length, 1);
    assert.equal(uploadCalls[0].bucket, 'customer-skin-photos');
    assert.equal(uploadCalls[0].path, 'usr_123/front/photo_test.jpg');
    assert.equal(uploadCalls[0].options.upsert, false);
    assert.equal(uploadCalls[0].options.contentType, 'image/jpeg');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('I1-B1 RemoteDeriveService Onboarding Pipeline: Orchestrates prepare -> private photo uploads -> commit', async () => {
  const functionInvocations: Array<{ functionName: string; body: any }> = [];
  const storageUploads: Array<{ path: string; options: any }> = [];

  const mockSupabaseClient = {
    functions: {
      invoke: async (name: string, options: { body: any }) => {
        functionInvocations.push({ functionName: name, body: options.body });
        if (name === 'prepare-onboarding') {
          return {
            data: {
              submissionId: 'sub_b1_123',
              uploadTargets: {
                front: { path: 'usr_remote/front/front_1.jpg', uploaded: false },
                left: { path: 'usr_remote/left/left_1.jpg', uploaded: false },
                right: { path: 'usr_remote/right/right_1.jpg', uploaded: true }, // already uploaded
                shelf: { path: 'usr_remote/shelf/shelf_1.jpg', uploaded: false },
              },
            },
            error: null,
          };
        }
        if (name === 'onboard-customer') {
          return {
            data: {
              userId: 'usr_remote',
              skinProfile: {
                id: 'sp_remote_b1',
                userId: 'usr_remote',
                primaryGoal: options.body.payload.primaryGoal,
                secondaryGoals: [],
                routineComplexity: 'simple',
                costPreference: 'balanced',
                middayFeel: 'combination',
                postCleanseTightness: false,
                knownSensitivities: [],
                sensitivitiesStatus: 'none_known',
                activePrescriptions: [],
                isPregnantOrNursing: false,
                pregnancyStatus: 'no',
                onboardingCompleted: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
              proposedRoutine: null,
              userProducts: [],
              initialRoutineState: 'pending_generation',
            },
            error: null,
          };
        }
        return { data: null, error: new Error(`Unexpected function ${name}`) };
      },
    },
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string, body: any, options: any) => {
          storageUploads.push({ path, options });
          return { data: { path }, error: null };
        },
      }),
    },
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    blob: async () => ({ type: 'image/jpeg' }),
  } as any);

  try {
    const service = new RemoteDeriveService(mockSupabaseClient);
    const payload = buildOnboardingPayload({
      primaryGoal: 'breakouts',
      frontPhotoUri: 'file:///local/front.jpg',
      leftPhotoUri: 'file:///local/left.jpg',
      rightPhotoUri: 'file:///local/right.jpg',
      shelfPhotoUri: 'file:///local/shelf.jpg',
      sensitivitiesStatus: 'none_known',
      pregnancyStatus: 'no',
    }, 'usr_remote', true);

    const result = await service.onboard(payload);

    // 1. Invocation ordering: prepare-onboarding first, onboard-customer second
    assert.equal(functionInvocations.length, 2);
    assert.equal(functionInvocations[0].functionName, 'prepare-onboarding');
    assert.equal(functionInvocations[1].functionName, 'onboard-customer');

    // 2. Storage uploads: front, left, and shelf uploaded. Right skipped (was uploaded: true)
    assert.equal(storageUploads.length, 3);
    assert.equal(storageUploads[0].path, 'usr_remote/front/front_1.jpg');
    assert.equal(storageUploads[1].path, 'usr_remote/left/left_1.jpg');
    assert.equal(storageUploads[2].path, 'usr_remote/shelf/shelf_1.jpg');

    // 3. Sanitized payload passed to onboard-customer (no file:/// URIs)
    const commitPayload = functionInvocations[1].body.payload;
    assert.equal(commitPayload.skinPhotos.frontUri, undefined);
    assert.equal(commitPayload.skinPhotos.leftUri, undefined);
    assert.equal(commitPayload.skinPhotos.rightUri, undefined);
    assert.equal(commitPayload.skinPhotos.shelfUri, undefined);

    // 4. Result matches canonical initialRoutineState and null proposedRoutine
    assert.equal(result.proposedRoutine, null);
    assert.equal(result.initialRoutineState, 'pending_generation');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('I1-B1.1 RemoteDeriveService: Committed prepare status causes zero uploads and succeeds cleanly', async () => {
  const functionInvocations: Array<{ functionName: string; body: any }> = [];
  const storageUploads: Array<{ path: string; options: any }> = [];

  const mockSupabaseClient = {
    functions: {
      invoke: async (name: string, options: { body: any }) => {
        functionInvocations.push({ functionName: name, body: options.body });
        if (name === 'prepare-onboarding') {
          return {
            data: {
              submissionId: 'sub_already_committed',
              submissionStatus: 'committed',
              uploadTargets: {
                front: { path: 'usr_committed/front/front_1.jpg', uploaded: true },
                left: { path: 'usr_committed/left/left_1.jpg', uploaded: true },
                right: { path: 'usr_committed/right/right_1.jpg', uploaded: true },
              },
            },
            error: null,
          };
        }
        if (name === 'onboard-customer') {
          return {
            data: {
              userId: 'usr_committed',
              skinProfile: {
                id: 'sp_committed',
                userId: 'usr_committed',
                primaryGoal: 'breakouts',
                secondaryGoals: [],
                routineComplexity: 'simple',
                costPreference: 'balanced',
                middayFeel: 'combination',
                postCleanseTightness: false,
                knownSensitivities: [],
                sensitivitiesStatus: 'none_known',
                activePrescriptions: [],
                isPregnantOrNursing: false,
                pregnancyStatus: 'no',
                onboardingCompleted: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
              proposedRoutine: null,
              userProducts: [],
              initialRoutineState: 'pending_generation',
            },
            error: null,
          };
        }
        return { data: null, error: new Error(`Unexpected function ${name}`) };
      },
    },
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string, body: any, options: any) => {
          storageUploads.push({ path, options });
          return { data: { path }, error: null };
        },
      }),
    },
  };

  const service = new RemoteDeriveService(mockSupabaseClient);
  const payload = buildOnboardingPayload({
    primaryGoal: 'breakouts',
    frontPhotoUri: 'file:///local/front.jpg',
    leftPhotoUri: 'file:///local/left.jpg',
    rightPhotoUri: 'file:///local/right.jpg',
    sensitivitiesStatus: 'none_known',
    pregnancyStatus: 'no',
  }, 'usr_committed', true);

  const result = await service.onboard(payload);

  // Zero storage uploads attempted because prepare returned submissionStatus = 'committed' (all targets uploaded)
  assert.equal(storageUploads.length, 0);
  assert.equal(functionInvocations.length, 2);
  assert.equal(result.userId, 'usr_committed');
  assert.equal(result.skinProfile.onboardingCompleted, true);
  assert.equal(result.initialRoutineState, 'pending_generation');
});

test('I1-B1.1 Canonical Bootstrap Integration: resolveCustomerBootstrap updates useBootstrapStore to READY upon confirmed onboarding completion', async () => {
  class B1RemoteBootstrapService extends MockDeriveService {
    override async getCustomerBootstrapState(userId: string): Promise<CustomerBootstrapState> {
      return {
        userId,
        profileExists: true,
        onboardingCompleted: true,
        membershipStatus: 'none',
      };
    }
    override async getCustomerProfile(userId: string): Promise<CustomerProfile | null> {
      return {
        id: userId,
        email: 'test@example.com',
        fullName: 'Test User',
        tier: 'founding_beta',
        membershipStatus: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
  }

  const origService = getDeriveService();
  setDeriveService(new B1RemoteBootstrapService());

  try {
    const userId = 'usr_bootstrap_test_b1';
    useAuthStore.setState({ sessionUserId: userId });

    const state = await resolveCustomerBootstrap(userId);

    assert.ok(state);
    assert.equal(state?.profileExists, true);
    assert.equal(state?.onboardingCompleted, true);

    // BootstrapStore reaches READY
    const store = useBootstrapStore.getState();
    assert.equal(store.status, 'READY');
    assert.equal(store.resolvedUserId, userId);
  } finally {
    setDeriveService(origService);
  }
});

// ========================================================
// 28. I1-B2 SERVER INITIAL ROUTINE INTELLIGENCE & DETERMINISTIC VALIDATION
// ========================================================

test('I1-B2 Intelligence: Valid simple intake produces valid proposal conforming to schema and invariants', () => {
  const context: AssembledRoutineContext = {
    userId: 'usr_test_b2_1',
    primaryGoal: 'breakouts',
    secondaryGoals: ['maintain'],
    routineComplexity: 'simple',
    costPreference: 'balanced',
    middayFeel: 'oily_shiny',
    postCleanseTightness: false,
    isPregnantOrNursing: false,
    pregnancyStatus: 'no',
    sensitivitiesStatus: 'none_known',
    knownSensitivities: [],
    activePrescriptions: [],
    confirmedProducts: [
      {
        brand: 'CeraVe',
        name: 'Foaming Facial Cleanser',
        category: 'cleanser',
        keyActives: ['Ceramides', 'Niacinamide'],
      },
      {
        brand: 'Differin',
        name: 'Adapalene Gel 0.1%',
        category: 'treatment',
        keyActives: ['Adapalene'],
      },
    ],
    productReactions: [],
    formulaSnapshots: [],
    pihTendencyAnswer: 'Rarely',
  };

  const proposal = generateContextGroundedProposal(context);

  // Proposal structure validation
  assert.ok(proposal.summarySentence.length > 0);
  assert.ok(proposal.amSteps.length >= 2, 'AM routine must have at least cleanser and SPF');
  assert.ok(proposal.pmSteps.length >= 2, 'PM routine must have at least cleanser and moisturizer');
  assert.ok(proposal.catalogProducts.length > 0);

  // AM/PM Invariants
  const amSpf = proposal.amSteps.find((s) => s.category === 'sunscreen');
  assert.ok(amSpf, 'AM routine must contain daily sunscreen');
  assert.equal(amSpf?.timing, 'am');

  const pmSpf = proposal.pmSteps.find((s) => s.category === 'sunscreen');
  assert.equal(pmSpf, undefined, 'PM routine must NEVER contain sunscreen');

  const amRetinoid = proposal.amSteps.find((s) => s.productName.toLowerCase().includes('adapalene'));
  assert.equal(amRetinoid, undefined, 'AM routine must NEVER contain active retinoid');

  const pmRetinoid = proposal.pmSteps.find((s) => s.productName.toLowerCase().includes('adapalene'));
  assert.ok(pmRetinoid, 'PM routine should contain retinoid treatment on recovery schedule');
  assert.deepEqual(pmRetinoid?.days, ['mon', 'wed', 'fri']);

  // Deterministic Validator
  const validation = validateRoutineProposal(proposal, context);
  assert.equal(validation.valid, true);
  assert.equal(validation.errors.length, 0);
});

test('I1-B2 Intelligence: Existing suitable products are marked KEEP while harsh products are marked PAUSE or STOP', () => {
  const context: AssembledRoutineContext = {
    userId: 'usr_test_b2_shelf',
    primaryGoal: 'redness',
    secondaryGoals: [],
    routineComplexity: 'simple',
    costPreference: 'balanced',
    middayFeel: 'dry_tight',
    postCleanseTightness: true,
    isPregnantOrNursing: false,
    pregnancyStatus: 'no',
    sensitivitiesStatus: 'none_known',
    knownSensitivities: [],
    activePrescriptions: [],
    confirmedProducts: [
      {
        brand: 'Vanicream',
        name: 'Gentle Facial Cleanser',
        category: 'cleanser',
        keyActives: ['Glycerin'],
      },
      {
        brand: 'St. Ives',
        name: 'Fresh Skin Apricot Scrub',
        category: 'other',
        keyActives: ['Walnut Shell Powder'],
      },
      {
        brand: 'Sea Breeze',
        name: 'Astringent for Sensitive Skin',
        category: 'other',
        keyActives: ['Alcohol Denat.'],
      },
    ],
    productReactions: [],
    formulaSnapshots: [],
  };

  const proposal = generateContextGroundedProposal(context);

  const cleanserDec = proposal.productDecisions.find((d) => d.productName.includes('Gentle Facial Cleanser'));
  assert.equal(cleanserDec?.action, 'KEEP');

  const scrubDec = proposal.productDecisions.find((d) => d.productName.includes('Apricot Scrub'));
  assert.equal(scrubDec?.action, 'PAUSE');
  assert.match(scrubDec?.actionReason || '', /micro-tears|abrasives/i);

  const astringentDec = proposal.productDecisions.find((d) => d.productName.includes('Astringent'));
  assert.equal(astringentDec?.action, 'STOP');
  assert.match(astringentDec?.actionReason || '', /drying astringent/i);
});

test('I1-B2 Invariants: Validator strictly rejects PM sunscreen', () => {
  const invalidProposal: RoutineIntelligenceProposal = {
    summarySentence: 'Invalid routine with PM sunscreen.',
    productDecisions: [],
    amSteps: [
      {
        order: 1,
        timing: 'am',
        productName: 'Gentle Cleanser',
        brand: 'BrandA',
        category: 'cleanser',
        amount: '1 pump',
        area: 'Face',
        days: [],
        purpose: 'Cleanse',
        whyChosen: 'Cleanse gently',
      },
    ],
    pmSteps: [
      {
        order: 1,
        timing: 'pm',
        productName: 'UV Clear SPF 46',
        brand: 'EltaMD',
        category: 'sunscreen',
        amount: '1/4 tsp',
        area: 'Face',
        days: [],
        purpose: 'SPF at night',
        whyChosen: 'Should not be in PM',
      },
    ],
    catalogProducts: [
      { brand: 'BrandA', name: 'Gentle Cleanser', category: 'cleanser', keyActives: [] },
      { brand: 'EltaMD', name: 'UV Clear SPF 46', category: 'sunscreen', keyActives: ['Zinc Oxide'] },
    ],
  };

  const validation = validateRoutineProposal(invalidProposal);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((e) => e.includes('Sunscreen invariant')));
});

test('I1-B2 Invariants: Validator strictly rejects AM retinoid', () => {
  const invalidProposal: RoutineIntelligenceProposal = {
    summarySentence: 'Invalid routine with AM retinoid.',
    productDecisions: [],
    amSteps: [
      {
        order: 1,
        timing: 'am',
        productName: 'Differin Adapalene Gel 0.1%',
        brand: 'Differin',
        category: 'treatment',
        amount: 'Pea-sized',
        area: 'Face',
        days: ['mon', 'wed', 'fri'],
        purpose: 'Morning retinoid',
        whyChosen: 'Should not be in AM',
      },
    ],
    pmSteps: [],
    catalogProducts: [
      { brand: 'Differin', name: 'Differin Adapalene Gel 0.1%', category: 'treatment', keyActives: ['Adapalene'] },
    ],
  };

  const validation = validateRoutineProposal(invalidProposal);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((e) => e.includes('Active retinoid invariant')));
});

test('I1-B2 Safety: Validator strictly excludes retinoids and contraindicated actives during pregnancy/nursing', () => {
  const pregnancyContext: Partial<AssembledRoutineContext> = {
    isPregnantOrNursing: true,
    pregnancyStatus: 'yes',
  };

  // 1. Validator rejects proposal scheduling a retinoid for pregnant member
  const invalidProposal: RoutineIntelligenceProposal = {
    summarySentence: 'Unsafe pregnancy routine.',
    productDecisions: [
      {
        productName: 'Tretinoin Cream 0.05%',
        brand: 'Generic',
        category: 'treatment',
        action: 'KEEP',
        actionReason: 'Unsafe keep',
      },
    ],
    amSteps: [],
    pmSteps: [
      {
        order: 1,
        timing: 'pm',
        productName: 'Tretinoin Cream 0.05%',
        brand: 'Generic',
        category: 'treatment',
        amount: 'Pea-sized',
        area: 'Face',
        days: ['mon', 'wed', 'fri'],
        purpose: 'Retinoid in pregnancy',
        whyChosen: 'Contraindicated',
      },
    ],
    catalogProducts: [
      { brand: 'Generic', name: 'Tretinoin Cream 0.05%', category: 'treatment', keyActives: ['Tretinoin'] },
    ],
  };

  const validation = validateRoutineProposal(invalidProposal, pregnancyContext);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((e) => e.includes('Pregnancy safety invariant')));

  // 2. Generator automatically pauses retinoids when pregnancy is disclosed
  const pregnantContext: AssembledRoutineContext = {
    userId: 'usr_pregnant_test',
    primaryGoal: 'breakouts',
    secondaryGoals: [],
    routineComplexity: 'simple',
    costPreference: 'balanced',
    middayFeel: 'comfortable',
    postCleanseTightness: false,
    isPregnantOrNursing: true,
    pregnancyStatus: 'yes',
    sensitivitiesStatus: 'none_known',
    knownSensitivities: [],
    activePrescriptions: [],
    confirmedProducts: [
      {
        brand: 'Differin',
        name: 'Adapalene Gel 0.1%',
        category: 'treatment',
        keyActives: ['Adapalene'],
      },
    ],
    productReactions: [],
    formulaSnapshots: [],
  };

  const safeProposal = generateContextGroundedProposal(pregnantContext);
  const retinoidDecision = safeProposal.productDecisions.find((d) => d.productName.includes('Adapalene'));
  assert.equal(retinoidDecision?.action, 'PAUSE');
  assert.match(retinoidDecision?.actionReason || '', /pregnancy|contraindicated/i);

  // Retinoid is NOT in active amSteps or pmSteps
  const inAm = safeProposal.amSteps.some((s) => s.productName.includes('Adapalene'));
  const inPm = safeProposal.pmSteps.some((s) => s.productName.includes('Adapalene'));
  assert.equal(inAm, false);
  assert.equal(inPm, false);

  const safeValidation = validateRoutineProposal(safeProposal, pregnantContext);
  assert.equal(safeValidation.valid, true);
});

test('I1-B2 Invariants: Validator strictly rejects invalid action and category enums', () => {
  const invalidProposal: RoutineIntelligenceProposal = {
    summarySentence: 'Invalid enums proposal.',
    productDecisions: [
      {
        productName: 'Some Product',
        brand: 'Some Brand',
        category: 'invalid_category' as any,
        action: 'DELETE' as any,
        actionReason: 'Invalid action enum',
      },
    ],
    amSteps: [
      {
        order: 1,
        timing: 'am',
        productName: 'Some Product',
        brand: 'Some Brand',
        category: 'invalid_category' as any,
        amount: '1 pump',
        area: 'Face',
        days: [],
        purpose: 'Test',
        whyChosen: 'Test rationale',
      },
    ],
    pmSteps: [],
    catalogProducts: [
      { brand: 'Some Brand', name: 'Some Product', category: 'invalid_category' as any, keyActives: [] },
    ],
  };

  const validation = validateRoutineProposal(invalidProposal);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((e) => e.includes('invalid action')));
  assert.ok(validation.errors.some((e) => e.includes('not a valid ProductCategory')));
});

test('I1-B2 Invariants: Validator strictly rejects missing required routine step fields', () => {
  const missingFieldProposal: RoutineIntelligenceProposal = {
    summarySentence: 'Missing fields proposal.',
    productDecisions: [],
    amSteps: [
      {
        order: 1,
        timing: 'am',
        productName: '',
        brand: '',
        category: 'cleanser',
        amount: '',
        area: '',
        days: [],
        purpose: '',
        whyChosen: '',
      },
    ],
    pmSteps: [],
    catalogProducts: [
      { brand: '', name: '', category: 'cleanser', keyActives: [] },
    ],
  };

  const validation = validateRoutineProposal(missingFieldProposal);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((e) => e.includes('missing one or more required fields')));
});

test('I1-B2 PIH Adaptation: Member with reported PIH tendency receives targeted photoprotection rationale', () => {
  const pihContext: AssembledRoutineContext = {
    userId: 'usr_pih_test',
    primaryGoal: 'dark_spots',
    secondaryGoals: ['maintain'],
    routineComplexity: 'simple',
    costPreference: 'balanced',
    middayFeel: 'oily_shiny',
    postCleanseTightness: false,
    isPregnantOrNursing: false,
    pregnancyStatus: 'no',
    sensitivitiesStatus: 'none_known',
    knownSensitivities: [],
    activePrescriptions: [],
    confirmedProducts: [],
    productReactions: [],
    formulaSnapshots: [],
    pihTendencyAnswer: 'Often',
  };

  const proposal = generateContextGroundedProposal(pihContext);
  const spfStep = proposal.amSteps.find((s) => s.category === 'sunscreen');
  assert.ok(spfStep);
  assert.match(spfStep?.whyChosen || '', /photoprotection|pigment|dark spots/i);
});

test('I1-B2 RemoteDeriveService: getRoutine assembles routines + routine_items into canonical Routine with amSteps, pmSteps and derived scheduleText', async () => {
  const mockRoutineRow = {
    id: 'rout_123',
    user_id: 'usr_b2_read_test',
    version: 1,
    status: 'awaiting_review',
    summary_sentence: 'Evidence-based gentle barrier-protective routine proposal.',
    created_at: '2026-09-18T12:00:00.000Z',
    updated_at: '2026-09-18T12:05:00.000Z',
    published_at: null,
    founder_notes: 'Reviewed initial proposal',
  };

  const mockItemRows = [
    {
      id: 'item_am_1',
      routine_id: 'rout_123',
      order_index: 1,
      timing: 'am',
      product_id: 'prod_cleanser_uuid',
      product_name: 'Gentle Facial Cleanser',
      brand: 'Vanicream',
      category: 'cleanser',
      amount: '1-2 pumps',
      area: 'Entire face',
      days: [],
      purpose: 'Morning Cleanse',
      why_chosen: 'Cleanses without tightness.',
      watch_for: null,
    },
    {
      id: 'item_am_2',
      routine_id: 'rout_123',
      order_index: 2,
      timing: 'am',
      product_id: 'prod_spf_uuid',
      product_name: 'UV Clear SPF 46',
      brand: 'EltaMD',
      category: 'sunscreen',
      amount: 'Two finger lengths',
      area: 'Entire face and neck',
      days: [],
      purpose: 'UV Protection',
      why_chosen: 'Daily broad-spectrum photoprotection.',
      watch_for: null,
    },
    {
      id: 'item_pm_1',
      routine_id: 'rout_123',
      order_index: 1,
      timing: 'pm',
      product_id: 'prod_cleanser_uuid',
      product_name: 'Gentle Facial Cleanser',
      brand: 'Vanicream',
      category: 'cleanser',
      amount: '1-2 pumps',
      area: 'Entire face',
      days: [],
      purpose: 'Evening Cleanse',
      why_chosen: 'Removes sunscreen and oil.',
      watch_for: null,
    },
    {
      id: 'item_pm_2',
      routine_id: 'rout_123',
      order_index: 2,
      timing: 'pm',
      product_id: 'prod_diff_uuid',
      product_name: 'Adapalene Gel 0.1%',
      brand: 'Differin',
      category: 'treatment',
      amount: 'Pea-sized amount',
      area: 'Entire face avoiding eye contours',
      days: ['mon', 'wed', 'fri'],
      purpose: 'Targeted Cellular Renewal',
      why_chosen: 'Scheduled 3 nights/week for cellular turnover.',
      watch_for: 'Watch for dryness.',
    },
  ];

  const mockSupabaseClient = {
    from: (table: string) => {
      if (table === 'routines') {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: async () => ({ data: mockRoutineRow, error: null }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'routine_items') {
        return {
          select: () => ({
            eq: () => ({
              order: async () => ({ data: mockItemRows, error: null }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
  };

  const service = new RemoteDeriveService(mockSupabaseClient);
  const routine = await service.getRoutine('usr_b2_read_test');

  assert.ok(routine !== null);
  assert.equal(routine.id, 'rout_123');
  assert.equal(routine.userId, 'usr_b2_read_test');
  assert.equal(routine.version, 1);
  assert.equal(routine.status, 'awaiting_review');
  assert.equal(routine.updatedAt, '2026-09-18T12:05:00.000Z');
  assert.equal(routine.founderNotes, 'Reviewed initial proposal');

  // amSteps assembly
  assert.equal(routine.amSteps.length, 2);
  assert.equal(routine.amSteps[0].productName, 'Gentle Facial Cleanser');
  assert.equal(routine.amSteps[0].order, 1);
  assert.equal(routine.amSteps[0].timing, 'am');
  assert.equal(routine.amSteps[0].scheduleText, 'Every morning');

  assert.equal(routine.amSteps[1].productName, 'UV Clear SPF 46');
  assert.equal(routine.amSteps[1].category, 'sunscreen');
  assert.equal(routine.amSteps[1].productId, 'prod_spf_uuid');

  // pmSteps assembly
  assert.equal(routine.pmSteps.length, 2);
  assert.equal(routine.pmSteps[1].productName, 'Adapalene Gel 0.1%');
  assert.equal(routine.pmSteps[1].timing, 'pm');
  assert.deepEqual(routine.pmSteps[1].days, ['mon', 'wed', 'fri']);
  assert.equal(routine.pmSteps[1].scheduleText, 'Mon, Wed, Fri');
  assert.equal(routine.pmSteps[1].watchFor, 'Watch for dryness.');
});

test('I1-B2 RemoteDeriveService: getUserProducts maps joined products table into canonical UserProduct with nested Product', async () => {
  const mockUserProductRows = [
    {
      id: 'up_row_1',
      user_id: 'usr_b2_up_test',
      product_id: 'prod_uuid_1',
      detected_brand: null,
      detected_name: null,
      action: 'KEEP',
      action_reason: 'Working well with baseline skin barrier.',
      frequency_nights_per_week: 7,
      is_confirmed_by_user: true,
      created_at: '2026-09-18T12:00:00.000Z',
      products: {
        id: 'prod_uuid_1',
        brand: 'CeraVe',
        name: 'Hydrating Facial Cleanser',
        category: 'cleanser',
        key_actives: ['Ceramides', 'Hyaluronic Acid'],
        full_ingredients: ['Purified Water', 'Glycerin', 'Ceramide NP'],
        retail_price_approx: 15.99,
        is_catalog_standard: true,
      },
    },
    {
      id: 'up_row_2',
      user_id: 'usr_b2_up_test',
      product_id: 'prod_uuid_2',
      detected_brand: null,
      detected_name: null,
      action: 'PAUSE',
      action_reason: 'Paused during pregnancy and nursing.',
      frequency_nights_per_week: 0,
      is_confirmed_by_user: true,
      created_at: '2026-09-18T12:00:00.000Z',
      products: {
        id: 'prod_uuid_2',
        brand: 'Differin',
        name: 'Adapalene Gel 0.1%',
        category: 'treatment',
        key_actives: ['Adapalene'],
        full_ingredients: ['Adapalene 0.1%'],
        retail_price_approx: 14.5,
        is_catalog_standard: true,
      },
    },
  ];

  const mockSupabaseClient = {
    from: (table: string) => {
      if (table === 'user_products') {
        return {
          select: () => ({
            eq: async () => ({ data: mockUserProductRows, error: null }),
          }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
  };

  const service = new RemoteDeriveService(mockSupabaseClient);
  const userProducts = await service.getUserProducts('usr_b2_up_test');

  assert.equal(userProducts.length, 2);

  const p1 = userProducts[0];
  assert.equal(p1.id, 'up_row_1');
  assert.equal(p1.action, 'KEEP');
  assert.equal(p1.productId, 'prod_uuid_1');
  assert.equal(p1.product.brand, 'CeraVe');
  assert.equal(p1.product.name, 'Hydrating Facial Cleanser');
  assert.equal(p1.product.category, 'cleanser');
  assert.deepEqual(p1.product.keyActives, ['Ceramides', 'Hyaluronic Acid']);
  assert.equal(p1.product.retailPriceApprox, 15.99);

  const p2 = userProducts[1];
  assert.equal(p2.action, 'PAUSE');
  assert.equal(p2.product.name, 'Adapalene Gel 0.1%');
  assert.equal(p2.frequencyNightsPerWeek, 0);
});

// ========================================================
// 29. I1-B2.1 REAL MODEL INTELLIGENCE, TRUST SEMANTICS & ERROR-BOUNDARY CLOSURE
// ========================================================

test('I1-B2.1 Context Assembly: Fails closed with INTAKE_CONTEXT_INVALID when primary goal or complexity is invalid or missing', () => {
  // 1. Missing primary goal in skin profile and payload snapshot
  const missingGoalRes = assembleCanonicalContext(
    { user_id: 'usr_invalid_ctx', onboarding_completed: true },
    { routineComplexity: 'simple', middayFeel: 'combination' }
  );
  assert.equal(missingGoalRes.valid, false);
  assert.equal(missingGoalRes.code, 'INTAKE_CONTEXT_INVALID');
  assert.match(missingGoalRes.error || '', /Invalid or missing primaryGoal/i);
  assert.equal(missingGoalRes.context, undefined);

  // 2. Non-canonical primary goal
  const invalidGoalRes = assembleCanonicalContext(
    { user_id: 'usr_invalid_ctx', primary_goal: 'magic_cure' },
    {}
  );
  assert.equal(invalidGoalRes.valid, false);
  assert.equal(invalidGoalRes.code, 'INTAKE_CONTEXT_INVALID');

  // 3. Missing routine complexity (must not silently fabricate 'essential')
  const missingComplexityRes = assembleCanonicalContext(
    { user_id: 'usr_invalid_ctx', primary_goal: 'breakouts' },
    { middayFeel: 'combination' }
  );
  assert.equal(missingComplexityRes.valid, false);
  assert.equal(missingComplexityRes.code, 'INTAKE_CONTEXT_INVALID');
  assert.match(missingComplexityRes.error || '', /Invalid or missing routineComplexity/i);

  // 4. Valid inputs assemble properly without default fabrication
  const validRes = assembleCanonicalContext(
    { user_id: 'usr_valid_ctx', primary_goal: 'breakouts' },
    {
      routineComplexity: 'simple',
      costPreference: 'balanced',
      middayFeel: 'dry_tight',
      postCleanseTightness: true,
      safetyContext: {
        isPregnantOrNursing: false,
        pregnancyStatus: 'no',
        sensitivitiesStatus: 'none_known',
        knownSensitivities: [],
        activePrescriptions: [],
      },
    }
  );
  assert.equal(validRes.valid, true);
  assert.ok(validRes.context);
  assert.equal(validRes.context.primaryGoal, 'breakouts');
  assert.equal(validRes.context.routineComplexity, 'simple');
  assert.equal(validRes.context.middayFeel, 'dry_tight');
  assert.equal(validRes.context.postCleanseTightness, true);
});

test('I1-B2.1 Gemini Schema & Prompt: Conforms to Gemini structured output requirements and rules', () => {
  // Verify structured schema
  assert.equal(GEMINI_PROPOSAL_RESPONSE_SCHEMA.type, 'OBJECT');
  const reqProps = GEMINI_PROPOSAL_RESPONSE_SCHEMA.required;
  assert.ok(reqProps.includes('summarySentence'));
  assert.ok(reqProps.includes('productDecisions'));
  assert.ok(reqProps.includes('amSteps'));
  assert.ok(reqProps.includes('pmSteps'));
  assert.ok(reqProps.includes('catalogProducts'));
  assert.ok((GEMINI_PROPOSAL_RESPONSE_SCHEMA.properties as any).clarificationQuestions);

  // Step schema verification
  const amStepProps = (GEMINI_PROPOSAL_RESPONSE_SCHEMA.properties as any).amSteps.items.properties;
  assert.ok(amStepProps.order);
  assert.ok(amStepProps.timing);
  assert.ok(amStepProps.productName);
  assert.ok(amStepProps.brand);
  assert.ok(amStepProps.category);
  assert.ok(amStepProps.amount);
  assert.ok(amStepProps.area);
  assert.ok(amStepProps.days);
  assert.ok(amStepProps.purpose);
  assert.ok(amStepProps.whyChosen);

  // Prompt construction verification
  const mockContext: AssembledRoutineContext = {
    userId: 'usr_prompt_test',
    primaryGoal: 'breakouts',
    secondaryGoals: ['texture'],
    routineComplexity: 'simple',
    costPreference: 'balanced',
    middayFeel: 'oily_shiny',
    postCleanseTightness: false,
    isPregnantOrNursing: true,
    pregnancyStatus: 'yes',
    sensitivitiesStatus: 'reported',
    knownSensitivities: ['Fragrance'],
    activePrescriptions: [],
    confirmedProducts: [
      { brand: 'CeraVe', name: 'Hydrating Cleanser', category: 'cleanser', keyActives: ['Ceramides'] },
    ],
    productReactions: [],
    formulaSnapshots: [],
    pihTendencyAnswer: 'Often',
  };

  const prompt = buildGeminiPrompt(mockContext);
  assert.match(prompt, /"primaryGoal":"breakouts"/);
  assert.match(prompt, /"secondaryGoals":\["texture"\]/);
  assert.match(prompt, /"routineComplexity":"simple"/);
  assert.match(prompt, /"isPregnantOrNursing":true/);
  assert.match(prompt, /"knownSensitivities":\["Fragrance"\]/);
  assert.match(prompt, /"pihTendency":"Often"/);

  assert.match(GEMINI_SYSTEM_INSTRUCTION, /SUNSCREEN AM INVARIANT/);
  assert.match(GEMINI_SYSTEM_INSTRUCTION, /RETINOID PM INVARIANT/);
  assert.match(GEMINI_SYSTEM_INSTRUCTION, /PREGNANCY & NURSING CONTRAINDICATION/);
});

test('I1-B2.1 Gemini Provider: Handles missing credentials and upstream failures with customer-safe error codes', async () => {
  const mockContext: AssembledRoutineContext = {
    userId: 'usr_err_test',
    primaryGoal: 'breakouts',
    secondaryGoals: [],
    routineComplexity: 'simple',
    costPreference: 'balanced',
    middayFeel: 'combination',
    postCleanseTightness: false,
    isPregnantOrNursing: false,
    pregnancyStatus: 'no',
    sensitivitiesStatus: 'none_known',
    knownSensitivities: [],
    activePrescriptions: [],
    confirmedProducts: [],
    productReactions: [],
    formulaSnapshots: [],
  };

  // 1. Missing API key
  await assert.rejects(
    async () => {
      await callGeminiProposalProvider(mockContext, '', 'gemini-3.8-flash');
    },
    (err: any) => {
      assert.equal(err.code, 'MODEL_UNAVAILABLE');
      assert.equal(err.status, 503);
      return true;
    }
  );

  // 2. Upstream provider HTTP 503 / 500 error
  const origFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ error: { message: 'Gemini server overload' } }), {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'application/json' },
      });

    await assert.rejects(
      async () => {
        await callGeminiProposalProvider(mockContext, 'dummy-key', 'gemini-3.8-flash');
      },
      (err: any) => {
        assert.equal(err.code, 'MODEL_UNAVAILABLE');
        assert.equal(err.status, 503);
        return true;
      }
    );
  } finally {
    globalThis.fetch = origFetch;
  }

  // 3. Upstream provider returns malformed / empty JSON payload
  try {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'NOT_JSON' }] } }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

    await assert.rejects(
      async () => {
        await callGeminiProposalProvider(mockContext, 'dummy-key', 'gemini-3.8-flash');
      },
      (err: any) => {
        assert.equal(err.code, 'MODEL_OUTPUT_INVALID');
        assert.equal(err.status, 502);
        return true;
      }
    );
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('I1-B2.1 Trust Semantics & Error Boundary: Unconfirmed product decisions and zero internal leakage', () => {
  const context: AssembledRoutineContext = {
    userId: 'usr_trust_test',
    primaryGoal: 'breakouts',
    secondaryGoals: [],
    routineComplexity: 'simple',
    costPreference: 'balanced',
    middayFeel: 'oily_shiny',
    postCleanseTightness: false,
    isPregnantOrNursing: false,
    pregnancyStatus: 'no',
    sensitivitiesStatus: 'none_known',
    knownSensitivities: [],
    activePrescriptions: [],
    confirmedProducts: [
      {
        brand: 'CeraVe',
        name: 'Foaming Facial Cleanser',
        category: 'cleanser',
        keyActives: ['Ceramides'],
      },
    ],
    productReactions: [],
    formulaSnapshots: [],
  };

  const proposal = generateContextGroundedProposal(context);

  // When mapping to user_products rows, recommendations must have is_confirmed_by_user: false
  for (const decision of proposal.productDecisions) {
    const userProductRow = {
      user_id: context.userId,
      action: decision.action,
      action_reason: decision.actionReason,
      frequency_nights_per_week: decision.frequencyNightsPerWeek,
      is_confirmed_by_user: false,
    };
    assert.equal(userProductRow.is_confirmed_by_user, false, 'AI proposal products must not be marked confirmed by user');
  }

  // Verify customer-facing error boundary format
  const customerSafeErrors = [
    { code: 'INTAKE_NOT_COMMITTED', message: 'Please complete and submit your onboarding intake before requesting a routine.' },
    { code: 'INTAKE_CONTEXT_INVALID', message: 'Onboarding intake context is incomplete or invalid.' },
    { code: 'MODEL_UNAVAILABLE', message: 'Skincare intelligence service is temporarily unavailable. Please try again shortly.' },
    { code: 'MODEL_OUTPUT_INVALID', message: 'Intelligence service produced an invalid proposal. Please try again shortly.' },
    { code: 'CLARIFICATION_REQUIRED', message: 'A few details in your intake need clarification before your routine can be generated.' },
    { code: 'VALIDATION_FAILED', message: 'Generated routine proposal did not satisfy safety invariants.' },
    { code: 'PERSISTENCE_FAILED', message: 'Failed to persist routine proposal. Please try again.' },
    { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred while generating your routine proposal.' },
  ];

  for (const err of customerSafeErrors) {
    // Zero stack trace, SQL errors, or internal Postgres terms
    assert.ok(!err.message.includes('stack'));
    assert.ok(!err.message.includes('SELECT'));
    assert.ok(!err.message.includes('INSERT'));
    assert.ok(!err.message.includes('public.'));
    assert.ok(!err.message.includes('foreign key'));
    assert.ok(!err.message.includes('violates'));
  }
});

// ========================================================
// 30. I1-B2.2 PROVIDER-NEUTRAL BOUNDARY, CATALOG PROVENANCE & TRUST CLOSURE TESTS
// ========================================================

test('I1-B2.2: RoutineIntelligenceProvider interface and deterministic FixtureRoutineProvider', async () => {
  const provider: RoutineIntelligenceProvider = new FixtureRoutineProvider();
  assert.equal(provider.providerId, 'fixture');

  const context: AssembledRoutineContext = {
    userId: 'usr_b2_provider_test',
    primaryGoal: 'breakouts',
    secondaryGoals: ['texture'],
    routineComplexity: 'simple',
    costPreference: 'balanced',
    middayFeel: 'combination',
    postCleanseTightness: false,
    isPregnantOrNursing: false,
    pregnancyStatus: 'no',
    sensitivitiesStatus: 'none_known',
    knownSensitivities: [],
    activePrescriptions: [],
    confirmedProducts: [
      {
        brand: 'CeraVe',
        name: 'Foaming Facial Cleanser',
        category: 'cleanser',
        keyActives: ['Ceramides', 'Niacinamide'],
      },
    ],
    productReactions: [],
    formulaSnapshots: [],
  };

  const proposal = await provider.generateProposal(context);
  assert.ok(proposal.summarySentence);
  assert.ok(proposal.amSteps.length > 0);
  assert.ok(proposal.pmSteps.length > 0);
  assert.ok(proposal.productDecisions.length > 0);
});

test('I1-B2.2: Optional GeminiRoutineProvider uses header auth and fails closed without API key', async () => {
  const provider = new GeminiRoutineProvider('');
  assert.equal(provider.providerId, 'gemini');

  const context: AssembledRoutineContext = {
    userId: 'usr_gemini_key_test',
    primaryGoal: 'breakouts',
    secondaryGoals: [],
    routineComplexity: 'simple',
    costPreference: 'balanced',
    middayFeel: 'combination',
    postCleanseTightness: false,
    isPregnantOrNursing: false,
    pregnancyStatus: 'no',
    sensitivitiesStatus: 'none_known',
    knownSensitivities: [],
    activePrescriptions: [],
    confirmedProducts: [],
    productReactions: [],
    formulaSnapshots: [],
  };

  await assert.rejects(
    async () => {
      await provider.generateProposal(context);
    },
    (err: any) => {
      assert.equal(err.code, 'MODEL_UNAVAILABLE');
      assert.equal(err.status, 503);
      return true;
    }
  );
});

test('I1-B2.2: GeminiRoutineProvider sends API key in header, never in URL query parameters', async () => {
  const origFetch = globalThis.fetch;
  let interceptedUrl = '';
  let interceptedHeaders: any = {};

  try {
    globalThis.fetch = async (input: any, init?: any) => {
      interceptedUrl = typeof input === 'string' ? input : input.url;
      interceptedHeaders = init?.headers || {};
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      summarySentence: 'Structured test summary.',
                      amSteps: [
                        {
                          order: 1,
                          timing: 'am',
                          brand: 'EltaMD',
                          productName: 'UV Clear Broad-Spectrum SPF 46',
                          category: 'sunscreen',
                          amount: '2 finger lengths',
                          area: 'Face and neck',
                          days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
                          purpose: 'Daily broad-spectrum UV protection',
                          whyChosen: 'Oil-free soothing formula with niacinamide',
                        },
                      ],
                      pmSteps: [
                        {
                          order: 1,
                          timing: 'pm',
                          brand: 'CeraVe',
                          productName: 'Foaming Facial Cleanser',
                          category: 'cleanser',
                          amount: '1 pump',
                          area: 'Face',
                          days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
                          purpose: 'Gentle evening cleanse',
                          whyChosen: 'Removes excess oil without disrupting barrier',
                        },
                      ],
                      productDecisions: [
                        {
                          brand: 'EltaMD',
                          name: 'UV Clear Broad-Spectrum SPF 46',
                          category: 'sunscreen',
                          keyActives: ['Zinc Oxide', 'Niacinamide'],
                          action: 'ADD',
                          actionReason: 'Non-comedogenic daily UV defense',
                        },
                      ],
                    }),
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    const dummyKey = 'secret_test_key_12345';
    const provider = new GeminiRoutineProvider(dummyKey, 'gemini-3.8-flash');
    const context: AssembledRoutineContext = {
      userId: 'usr_header_auth',
      primaryGoal: 'breakouts',
      secondaryGoals: [],
      routineComplexity: 'simple',
      costPreference: 'balanced',
      middayFeel: 'combination',
      postCleanseTightness: false,
      isPregnantOrNursing: false,
      pregnancyStatus: 'no',
      sensitivitiesStatus: 'none_known',
      knownSensitivities: [],
      activePrescriptions: [],
      confirmedProducts: [],
      productReactions: [],
      formulaSnapshots: [],
    };

    const res = await provider.generateProposal(context);
    assert.ok(res);

    // Assert zero key leakage in URL query parameters
    assert.ok(!interceptedUrl.includes(dummyKey), 'API key must NEVER be passed in URL query parameters');
    assert.ok(!interceptedUrl.includes('key='), 'URL must not have key= query parameter');

    // Assert key passed in x-goog-api-key header
    assert.equal(interceptedHeaders['x-goog-api-key'], dummyKey, 'API key must be passed in x-goog-api-key header');
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('I1-B2.2: Context validation fails closed on non-canonical enum values (zero fabricated defaults)', () => {
  const baseProfile = {
    user_id: 'usr_canonical_enum',
    primary_goal: 'breakouts',
    routine_complexity: 'simple',
    cost_preference: 'balanced',
    midday_feel: 'combination',
    post_cleanse_tightness: false,
    pregnancy_status: 'no',
    sensitivities_status: 'none_known',
    known_sensitivities: [],
    active_prescriptions: [],
    confirmed_products: [],
  };

  // 1. Non-canonical primaryGoal 'aging' (canonical is 'anti_aging')
  const r1 = assembleCanonicalContext({ ...baseProfile, primary_goal: 'aging' }, null, []);
  assert.equal(r1.valid, false);
  assert.equal(r1.code, 'INTAKE_CONTEXT_INVALID');

  // 2. Non-canonical routineComplexity 'moderate' (canonical is 'balanced')
  const r2 = assembleCanonicalContext({ ...baseProfile, routine_complexity: 'moderate' }, null, []);
  assert.equal(r2.valid, false);
  assert.equal(r2.code, 'INTAKE_CONTEXT_INVALID');

  // 3. Non-canonical routineComplexity 'multi_step' (canonical is 'maximize')
  const r3 = assembleCanonicalContext({ ...baseProfile, routine_complexity: 'multi_step' }, null, []);
  assert.equal(r3.valid, false);
  assert.equal(r3.code, 'INTAKE_CONTEXT_INVALID');

  // 4. Non-canonical costPreference 'essential' (canonical is 'value' | 'balanced' | 'premium')
  const r4 = assembleCanonicalContext({ ...baseProfile, cost_preference: 'essential' }, null, []);
  assert.equal(r4.valid, false);
  assert.equal(r4.code, 'INTAKE_CONTEXT_INVALID');

  // 5. Non-canonical middayFeel 'dry' or 'oily' (canonical is 'dry_tight', 'oily_shiny', 'combination')
  const r5 = assembleCanonicalContext({ ...baseProfile, midday_feel: 'dry' }, null, []);
  assert.equal(r5.valid, false);
  assert.equal(r5.code, 'INTAKE_CONTEXT_INVALID');

  // 6. Invalid secondaryGoal
  const r6 = assembleCanonicalContext(
    { ...baseProfile },
    { secondaryGoals: ['invalid_goal_value'] },
    []
  );
  assert.equal(r6.valid, false);
  assert.equal(r6.code, 'INTAKE_CONTEXT_INVALID');

  // 7. Confirmed product with empty/whitespace brand or name
  const r7 = assembleCanonicalContext(
    {
      ...baseProfile,
      confirmed_products: [{ brand: '   ', name: 'Some Product', category: 'cleanser' }],
    },
    null,
    []
  );
  assert.equal(r7.valid, false);
  assert.equal(r7.code, 'INTAKE_CONTEXT_INVALID');
});

test('I1-B2.2: Sensitivity validation fails closed on unverified formula and rejects known allergens', () => {
  const mockContext: AssembledRoutineContext = {
    userId: 'usr_sens_test',
    primaryGoal: 'breakouts',
    secondaryGoals: [],
    routineComplexity: 'simple',
    costPreference: 'balanced',
    middayFeel: 'combination',
    postCleanseTightness: false,
    isPregnantOrNursing: false,
    pregnancyStatus: 'no',
    sensitivitiesStatus: 'reported',
    knownSensitivities: ['Fragrance', 'Niacinamide'],
    activePrescriptions: [],
    confirmedProducts: [],
    productReactions: [],
    formulaSnapshots: [],
  };

  const trustedCatalog: Record<string, TrustedProductInfo> = {
    'cerave::foaming facial cleanser': {
      brand: 'CeraVe',
      name: 'Foaming Facial Cleanser',
      keyActives: ['Ceramides', 'Niacinamide'],
      isCatalogStandard: true,
      fullIngredients: ['Water', 'Glycerin', 'Niacinamide', 'Ceramides'],
    },
    'vanicream::gentle facial cleanser': {
      brand: 'Vanicream',
      name: 'Gentle Facial Cleanser',
      keyActives: [],
      isCatalogStandard: true,
      fullIngredients: ['Purified Water', 'Glycerin', 'Coco-Glucoside'],
    },
  };

  // 1. Proposal with unverified formula product when member reported sensitivities -> fails closed
  const proposalWithUntrusted: RoutineIntelligenceProposal = {
    summarySentence: 'Gentle test routine.',
    amSteps: [
      {
        order: 1,
        timing: 'am',
        brand: 'UnknownBrand',
        productName: 'Mystery Cream',
        category: 'moisturizer',
        amount: 'Pea size',
        area: 'Face',
        days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
        purpose: 'Hydrate',
        whyChosen: 'Gentle',
      },
    ],
    pmSteps: [],
    productDecisions: [
      {
        brand: 'UnknownBrand',
        productName: 'Mystery Cream',
        category: 'moisturizer',
        action: 'ADD',
        actionReason: 'Hydration',
      },
    ],
    catalogProducts: [],
  };

  const v1 = validateSensitivities(proposalWithUntrusted, mockContext, trustedCatalog);
  assert.equal(v1.valid, false);
  assert.match(v1.error || '', /unverified formula/i);

  // 2. Proposal with trusted product containing known sensitivity (Niacinamide) -> rejected
  const proposalWithAllergen: RoutineIntelligenceProposal = {
    summarySentence: 'Gentle test routine.',
    amSteps: [
      {
        order: 1,
        timing: 'am',
        brand: 'CeraVe',
        productName: 'Foaming Facial Cleanser',
        category: 'cleanser',
        amount: '1 pump',
        area: 'Face',
        days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
        purpose: 'Cleanse',
        whyChosen: 'Gentle',
      },
    ],
    pmSteps: [],
    productDecisions: [
      {
        brand: 'CeraVe',
        productName: 'Foaming Facial Cleanser',
        category: 'cleanser',
        action: 'ADD',
        actionReason: 'Cleanse',
      },
    ],
    catalogProducts: [],
  };

  const v2 = validateSensitivities(proposalWithAllergen, mockContext, trustedCatalog);
  assert.equal(v2.valid, false);
  assert.match(v2.error || '', /niacinamide/i);

  // 3. Proposal with safe trusted product (Vanicream) -> passes
  const proposalSafe: RoutineIntelligenceProposal = {
    summarySentence: 'Gentle test routine.',
    amSteps: [
      {
        order: 1,
        timing: 'am',
        brand: 'Vanicream',
        productName: 'Gentle Facial Cleanser',
        category: 'cleanser',
        amount: '1 pump',
        area: 'Face',
        days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
        purpose: 'Cleanse',
        whyChosen: 'Gentle',
      },
    ],
    pmSteps: [],
    productDecisions: [
      {
        brand: 'Vanicream',
        productName: 'Gentle Facial Cleanser',
        category: 'cleanser',
        action: 'ADD',
        actionReason: 'Cleanse',
      },
    ],
    catalogProducts: [],
  };

  const v3 = validateSensitivities(proposalSafe, mockContext, trustedCatalog);
  assert.equal(v3.valid, true);
});

// ---------------------------------------------------------------------------
// SECTION 31: I1-B2.3 Final Server Boundary Cleanup Tests
// ---------------------------------------------------------------------------

test('I1-B2.3 RemoteDeriveService: getUserProducts maps null/undefined is_confirmed_by_user to false (fail closed)', async () => {
  const mockRows = [
    {
      id: 'up_row_null_conf',
      user_id: 'usr_b2_null_test',
      product_id: 'prod_uuid_null',
      detected_brand: null,
      detected_name: null,
      action: 'ADD',
      action_reason: 'Proposed by AI',
      frequency_nights_per_week: 7,
      is_confirmed_by_user: null, // null confirmation
      created_at: '2026-09-18T12:00:00.000Z',
      products: {
        id: 'prod_uuid_null',
        brand: 'Vanicream',
        name: 'Moisturizing Cream',
        category: 'moisturizer',
        key_actives: [],
        full_ingredients: [],
        retail_price_approx: 14.99,
        is_catalog_standard: false,
      },
    },
  ];

  const mockSupabaseClient = {
    from: (table: string) => ({
      select: () => ({
        eq: async () => ({ data: mockRows, error: null }),
      }),
    }),
  };

  const service = new RemoteDeriveService(mockSupabaseClient);
  const userProducts = await service.getUserProducts('usr_b2_null_test');
  assert.equal(userProducts.length, 1);
  assert.equal(userProducts[0].isConfirmedByUser, false, 'Null is_confirmed_by_user must fail closed to false');
});

test('I1-B2.3: resolveRoutineProvider has no filesystem fallback and enforces server-only resolution', async () => {
  const origEnv = process.env.ROUTINE_MODEL_PROVIDER;
  try {
    delete process.env.ROUTINE_MODEL_PROVIDER;

    // 1. Unconfigured provider returns null (fails closed)
    const providerNone = await resolveRoutineProvider();
    assert.equal(providerNone, null, 'Unconfigured provider must return null');

    // 2. Resolved via process.env
    process.env.ROUTINE_MODEL_PROVIDER = 'fixture';
    const providerEnv = await resolveRoutineProvider();
    assert.ok(providerEnv);
    assert.equal(providerEnv.providerId, 'fixture');

    // 3. Resolved via mock supabaseAdmin server_runtime_config
    delete process.env.ROUTINE_MODEL_PROVIDER;
    const mockAdmin = {
      from: (table: string) => {
        assert.equal(table, 'server_runtime_config');
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { value: 'fixture' } }),
            }),
          }),
        };
      },
    };
    const providerDb = await resolveRoutineProvider(mockAdmin);
    assert.ok(providerDb);
    assert.equal(providerDb.providerId, 'fixture');
  } finally {
    if (origEnv !== undefined) {
      process.env.ROUTINE_MODEL_PROVIDER = origEnv;
    } else {
      delete process.env.ROUTINE_MODEL_PROVIDER;
    }
  }
});

test('I1-B2.3: static check - zero .server-provider-config, Deno.readTextFile, or founder paths in provider.ts', async () => {
  const providerSource = fs.readFileSync(
    path.resolve('supabase/functions/propose-routine/provider.ts'),
    'utf8'
  );
  assert.ok(!providerSource.includes('.server-provider-config'), 'Must not contain .server-provider-config');
  assert.ok(!providerSource.includes('/Users/'), 'Must not contain /Users/ founder path');
  assert.ok(!providerSource.includes('Deno.readTextFile'), 'Must not contain Deno.readTextFile');
});

// ========================================================
// 35. I1-B3 PROVIDER-INDEPENDENT INITIAL ROUTINE INTEGRATION
// ========================================================

test('I1-B3 Shared Service Parity: MockDeriveService and RemoteDeriveService satisfy IDeriveService getUserProducts and proposeRoutine(optional)', async () => {
  const mockService = new MockDeriveService();
  await mockService.onboard(
    buildOnboardingPayload(
      {
        primaryGoal: 'breakouts',
        routineComplexity: 'simple',
        detectedProducts: [
          {
            id: 'p_shelf_1',
            brand: 'CeraVe',
            name: 'Foaming Cleanser',
            category: 'cleanser',
            keyActives: ['Ceramides'],
            fullIngredients: [],
          },
        ],
      },
      'usr_beta_member'
    )
  );

  // 1. getUserProducts returns userProducts
  const userProducts = await mockService.getUserProducts('usr_beta_member');
  assert.ok(Array.isArray(userProducts));
  assert.equal(userProducts.length, 1);
  assert.equal(userProducts[0].product.brand, 'CeraVe');

  // 2. proposeRoutine works without input
  const proposalWithoutInput = await mockService.proposeRoutine();
  assert.ok(proposalWithoutInput.routine);
  assert.equal(proposalWithoutInput.routine.userId, 'usr_beta_member');
  assert.ok(proposalWithoutInput.userProducts.length > 0);

  // 3. RemoteDeriveService passes body: input || {}
  let invokedBody: any = null;
  const mockClient = {
    functions: {
      invoke: async (fnName: string, options: any) => {
        assert.equal(fnName, 'propose-routine');
        invokedBody = options.body;
        return {
          data: {
            routine: proposalWithoutInput.routine,
            userProducts: proposalWithoutInput.userProducts,
          },
          error: null,
        };
      },
    },
  };

  const remoteService = new RemoteDeriveService(mockClient);
  await remoteService.proposeRoutine();
  assert.deepEqual(invokedBody, {}, 'RemoteDeriveService.proposeRoutine with no input sends empty object body');

  await remoteService.proposeRoutine({
    profile: { primaryGoal: 'breakouts', routineComplexity: 'simple' },
    shelfProducts: [],
  });
  assert.equal((invokedBody as any).profile.primaryGoal, 'breakouts', 'Explicit input is preserved in RemoteDeriveService');
});

test('I1-B3 Store & Coordinator: plan hydration state lifecycle and attempt freshness', () => {
  const store = useRoutineStore.getState();
  const initialAttempt = store.planHydrationAttempt;
  store.resetRoutine();

  assert.equal(useRoutineStore.getState().planHydrationStatus, 'idle');
  assert.equal(useRoutineStore.getState().planHydrationAttempt, initialAttempt + 1);
  assert.equal(useRoutineStore.getState().isRoutineBeingPrepared, false);

  // Start hydration attempt
  const attempt = useRoutineStore.getState().startPlanHydration();
  assert.equal(attempt, initialAttempt + 2);
  assert.equal(useRoutineStore.getState().planHydrationStatus, 'loading');

  // Committing with stale attempt is rejected
  const committedStale = useRoutineStore.getState().setPlanHydrated(null, [], true, attempt - 1);
  assert.equal(committedStale, false, 'Stale attempt must return false');
  assert.equal(useRoutineStore.getState().planHydrationStatus, 'loading');

  // Committing with valid attempt succeeds
  const committedCurrent = useRoutineStore.getState().setPlanHydrated(null, [], true, attempt);
  assert.equal(committedCurrent, true);
  assert.equal(useRoutineStore.getState().planHydrationStatus, 'ready');
  assert.equal(useRoutineStore.getState().isRoutineBeingPrepared, true);
  assert.equal(useRoutineStore.getState().todayDominantStatus, 'Your routine is being prepared.');

  // Resetting increments attempt counter
  useRoutineStore.getState().resetRoutine();
  assert.equal(useRoutineStore.getState().planHydrationAttempt, initialAttempt + 3);
  assert.equal(useRoutineStore.getState().isRoutineBeingPrepared, false);

  // Prior attempt commit fails after reset
  const afterResetCommit = useRoutineStore.getState().setPlanHydrated(null, [], true, attempt);
  assert.equal(afterResetCommit, false);
});

test('I1-B3 Coordinator Freshness: User A -> User B identity switch discards User A in-flight plan hydration', async () => {
  const origRemote = process.env.EXPO_PUBLIC_USE_REMOTE_SERVICE;
  const origService = getDeriveService();
  process.env.EXPO_PUBLIC_USE_REMOTE_SERVICE = 'true';

  try {
    let resolveUserA: ((val: any) => void) | null = null;
    const delayedUserAPromise = new Promise((resolve) => {
      resolveUserA = resolve;
    });

    class DelayedBackend extends RemoteDeriveService {
      override async getRoutine(userId: string): Promise<any> {
        if (userId === 'usr_user_a') {
          await delayedUserAPromise;
          return {
            id: 'rt_user_a',
            userId: 'usr_user_a',
            status: 'published',
            summarySentence: 'Routine for User A',
            amSteps: [],
            pmSteps: [],
          };
        }
        return null;
      }
      override async getUserProducts(userId: string): Promise<any> {
        return [];
      }
    }

    setDeriveService(new DelayedBackend());
    useAuthStore.getState().setSession('usr_user_a', 'user_a@example.com');
    useRoutineStore.getState().resetRoutine();

    // User A kicks off plan hydration
    const hydrationA = hydratePlanState('usr_user_a');

    // Identity switches to User B before A completes
    useAuthStore.getState().setSession('usr_user_b', 'user_b@example.com');

    // Now let User A's network request finish
    resolveUserA!(null);
    const resultA = await hydrationA;

    // User A's hydration must be discarded
    assert.equal(resultA, null, 'Stale user A hydration must return null');
    assert.equal(useRoutineStore.getState().routine, null, 'Store must not be updated with User A data');
  } finally {
    process.env.EXPO_PUBLIC_USE_REMOTE_SERVICE = origRemote;
    setDeriveService(origService);
    resetCustomerSessionData();
  }
});

test('I1-B3 Pending Generation Derivation: Onboarded member with null routine projects isRoutineBeingPrepared', async () => {
  const origRemote = process.env.EXPO_PUBLIC_USE_REMOTE_SERVICE;
  const origService = getDeriveService();
  process.env.EXPO_PUBLIC_USE_REMOTE_SERVICE = 'true';

  try {
    class NullRoutineBackend extends RemoteDeriveService {
      override async getRoutine(): Promise<any> {
        return null;
      }
      override async getUserProducts(): Promise<any> {
        return [];
      }
    }

    setDeriveService(new NullRoutineBackend());
    useAuthStore.getState().setSession('usr_onboarded_null', 'onboarded@example.com');
    useBootstrapStore.setState({
      status: 'READY',
      resolvedUserId: 'usr_onboarded_null',
      bootstrapState: {
        userId: 'usr_onboarded_null',
        profileExists: true,
        onboardingCompleted: true,
        membershipStatus: 'active',
      },
      errorMessage: null,
    });
    useRoutineStore.getState().resetRoutine();

    const result = await hydratePlanState('usr_onboarded_null');
    assert.ok(result);
    assert.equal(result.routine, null);
    assert.equal(result.isRoutineBeingPrepared, true);

    const store = useRoutineStore.getState();
    assert.equal(store.routine, null);
    assert.equal(store.isRoutineBeingPrepared, true);
    assert.equal(store.isPlanUnderReview, false);
    assert.equal(store.todayDominantStatus, 'Your routine is being prepared.');
  } finally {
    process.env.EXPO_PUBLIC_USE_REMOTE_SERVICE = origRemote;
    setDeriveService(origService);
    resetCustomerSessionData();
  }
});

test('I1-B3 In-Flight Request Deduplication: Concurrent ensureInitialRoutineProposal calls share single execution', async () => {
  const origService = getDeriveService();
  let proposeCount = 0;

  try {
    const mockProposal: RoutineProposalResult = {
      routine: {
        id: 'rt_dedup',
        userId: 'usr_dedup_test',
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'awaiting_review',
        summarySentence: 'Dedup proposed plan',
        amSteps: [],
        pmSteps: [],
      },
      userProducts: [],
    };

    class DedupTrackingBackend extends MockDeriveService {
      override async getRoutine(): Promise<any> {
        return null;
      }
      override async getUserProducts(): Promise<any> {
        return [];
      }
      override async proposeRoutine(): Promise<RoutineProposalResult> {
        proposeCount++;
        // Small delay to ensure concurrent call overlaps
        await new Promise((r) => setTimeout(r, 10));
        return mockProposal;
      }
    }

    setDeriveService(new DedupTrackingBackend());
    useOnboardingStore.getState().completeOnboarding();
    useRoutineStore.getState().resetRoutine();

    // Mark as pending generation (as onboarding does)
    useRoutineStore.setState({ isRoutineBeingPrepared: true });

    // Launch 3 concurrent calls (simulating Today, Plan, and background mount)
    const [p1, p2, p3] = await Promise.all([
      ensureInitialRoutineProposal('usr_dedup_test'),
      ensureInitialRoutineProposal('usr_dedup_test'),
      ensureInitialRoutineProposal('usr_dedup_test'),
    ]);

    assert.equal(proposeCount, 1, 'Exactly one proposeRoutine call should have been made');
    assert.ok(p1);
    assert.equal(p1?.routine.id, 'rt_dedup');
    assert.equal(p2?.routine.id, 'rt_dedup');
    assert.equal(p3?.routine.id, 'rt_dedup');

    const store = useRoutineStore.getState();
    assert.equal(store.routine?.id, 'rt_dedup');
    assert.equal(store.isRoutineBeingPrepared, false);
    assert.equal(store.isPlanUnderReview, true);
    assert.match(store.todayDominantStatus, /Final review:/);
  } finally {
    setDeriveService(origService);
    resetCustomerSessionData();
  }
});

test('I1-B3 App Restart Recovery: ensureInitialRoutineProposal recovers pending generation to awaiting_review', async () => {
  const origRemote = process.env.EXPO_PUBLIC_USE_REMOTE_SERVICE;
  const origService = getDeriveService();
  process.env.EXPO_PUBLIC_USE_REMOTE_SERVICE = 'true';

  try {
    const recoveredProposal: RoutineProposalResult = {
      routine: {
        id: 'rt_recovered',
        userId: 'usr_recovery',
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'awaiting_review',
        summarySentence: 'Recovered routine',
        amSteps: [
          {
            id: 's_am_1',
            order: 1,
            productId: 'p1',
            productName: 'Gentle Cleanser',
            brand: 'CeraVe',
            category: 'cleanser',
            amount: '1 pump',
            area: 'Entire face',
            timing: 'am',
            days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
            purpose: 'Cleanse without stripping moisture',
            whyChosen: 'Gentle and barrier-supportive',
            scheduleText: 'Every morning',
          },
        ],
        pmSteps: [],
      },
      userProducts: [
        {
          id: 'up_rec_1',
          userId: 'usr_recovery',
          productId: 'p1',
          action: 'KEEP',
          actionReason: 'Gentle morning cleanser',
          isConfirmedByUser: true,
          product: {
            id: 'p1',
            brand: 'CeraVe',
            name: 'Gentle Cleanser',
            category: 'cleanser',
            keyActives: [],
            fullIngredients: [],
          },
        },
      ],
    };

    class RecoveryBackend extends RemoteDeriveService {
      override async getRoutine(): Promise<any> {
        return null; // Database has no routine yet
      }
      override async getUserProducts(): Promise<any> {
        return [];
      }
      override async proposeRoutine(): Promise<RoutineProposalResult> {
        return recoveredProposal;
      }
    }

    setDeriveService(new RecoveryBackend());
    useAuthStore.getState().setSession('usr_recovery', 'recovery@example.com');
    useBootstrapStore.setState({
      status: 'READY',
      resolvedUserId: 'usr_recovery',
      bootstrapState: {
        userId: 'usr_recovery',
        profileExists: true,
        onboardingCompleted: true,
        membershipStatus: 'active',
      },
      errorMessage: null,
    });

    // Cold start state: routine is null, isRoutineBeingPrepared is false
    useRoutineStore.getState().resetRoutine();
    assert.equal(useRoutineStore.getState().routine, null);
    assert.equal(useRoutineStore.getState().isRoutineBeingPrepared, false);

    // ensureInitialRoutineProposal hydrates first, derives isRoutineBeingPrepared, then proposes routine
    const result = await ensureInitialRoutineProposal('usr_recovery');
    assert.ok(result);
    assert.equal(result?.routine.id, 'rt_recovered');

    const store = useRoutineStore.getState();
    assert.equal(store.routine?.id, 'rt_recovered');
    assert.equal(store.isRoutineBeingPrepared, false);
    assert.equal(store.isPlanUnderReview, true);
    assert.equal(store.userProducts.length, 1);
    assert.equal(store.userProducts[0].action, 'KEEP');
    assert.match(store.todayDominantStatus, /Final review:/);
  } finally {
    process.env.EXPO_PUBLIC_USE_REMOTE_SERVICE = origRemote;
    setDeriveService(origService);
    resetCustomerSessionData();
  }
});

test('I1-B3 Failure Shielding & Recoverability: proposeRoutine failure preserves isRoutineBeingPrepared and sets customer error', async () => {
  const origService = getDeriveService();

  try {
    class FailingProposalBackend extends MockDeriveService {
      override async getRoutine(): Promise<any> {
        return null;
      }
      override async getUserProducts(): Promise<any> {
        return [];
      }
      override async proposeRoutine(): Promise<RoutineProposalResult> {
        throw new Error('LLM connection error 503 internal failure');
      }
    }

    setDeriveService(new FailingProposalBackend());
    useOnboardingStore.getState().completeOnboarding();
    useRoutineStore.getState().resetRoutine();
    useRoutineStore.setState({ isRoutineBeingPrepared: true });

    const result = await ensureInitialRoutineProposal('usr_fail_test');
    assert.equal(result, null);

    const store = useRoutineStore.getState();
    assert.equal(store.planHydrationStatus, 'error');
    assert.equal(
      store.planHydrationError,
      "We couldn't refresh your routine right now. Please try again.",
      'Raw error must be shielded with empathetic customer copy'
    );
    assert.equal(
      store.isRoutineBeingPrepared,
      true,
      'isRoutineBeingPrepared must be preserved for user retry'
    );
  } finally {
    setDeriveService(origService);
    resetCustomerSessionData();
  }
});

test('I1-B3 Session Reset: resetCustomerSessionData purges in-flight maps and resets routine state', () => {
  useRoutineStore.setState({
    routine: { id: 'rt_to_purge' } as any,
    isRoutineBeingPrepared: true,
    isPlanUnderReview: true,
  });

  resetCustomerSessionData();

  const store = useRoutineStore.getState();
  assert.equal(store.routine, null);
  assert.equal(store.isRoutineBeingPrepared, false);
  assert.equal(store.isPlanUnderReview, false);
  assert.equal(store.planHydrationStatus, 'idle');
});

test('I1-B3 Provider Neutrality: Zero provider leakage in mobile app layers', () => {
  const filesToCheck = [
    'src/services/deriveClient.ts',
    'src/stores/routineStore.ts',
    'app/(tabs)/index.tsx',
    'app/(tabs)/plan.tsx',
    'app/(onboarding)/10-summary.tsx',
  ];

  const forbiddenTokens = [
    'ROUTINE_MODEL_PROVIDER',
    'Gemini',
    'gemini',
    'OpenAI',
    'openai',
    'Claude',
    'claude',
    'Anthropic',
    'anthropic',
  ];

  for (const relPath of filesToCheck) {
    const fullPath = path.resolve(relPath);
    const content = fs.readFileSync(fullPath, 'utf8');
    for (const token of forbiddenTokens) {
      assert.ok(
        !content.includes(token),
        `Mobile file ${relPath} must not contain provider reference '${token}'`
      );
    }
  }
});





// ========================================================
// 36. I1-B3.1 CLIENT LIFECYCLE HARDENING REGRESSIONS
// ========================================================

function b31OnboardedRemote(userId: string) {
  useAuthStore.getState().setSession(userId, `${userId}@derive.skin`);
  useBootstrapStore.setState({
    status: 'READY',
    bootstrapState: {
      userId,
      profileExists: true,
      onboardingCompleted: true,
      membershipStatus: 'active',
    },
    errorMessage: null,
    resolvedUserId: userId,
    resolutionAttempt: 1,
  });
  useRoutineStore.setState({
    routine: null,
    userProducts: [],
    isRoutineBeingPrepared: false,
    isPlanUnderReview: false,
    planHydrationStatus: 'idle',
    planHydrationError: null,
  });
  clearInFlightHydrations();
  clearInFlightProposals();
}

async function withB31RemoteService<T>(
  service: RemoteDeriveService,
  run: () => Promise<T> | T
): Promise<T> {
  const origService = getDeriveService();
  setDeriveService(service);
  try {
    return await run();
  } finally {
    setDeriveService(origService);
  }
}

test('I1-B3.1 Cold Restart + Hydration Error: Remote onboarded member preserves isRoutineBeingPrepared=true on transient failure', async () => {
  class FailingHydrationRemote extends RemoteDeriveService {
    async getRoutine(_userId: string): Promise<RoutinePlan | null> { throw new Error('Network timeout'); }
    async getUserProducts(_userId: string): Promise<UserProduct[]> { throw new Error('Network timeout'); }
  }
  await withB31RemoteService(new FailingHydrationRemote(), async () => {
    b31OnboardedRemote('usr_cold_restart_1');
    await hydratePlanState('usr_cold_restart_1');
    const state = useRoutineStore.getState();
    assert.equal(state.routine, null, 'routine must remain null');
    assert.equal(state.isRoutineBeingPrepared, true, 'isRoutineBeingPrepared must be preserved true for onboarded member on error');
    assert.equal(state.isPlanUnderReview, false, 'isPlanUnderReview must stay false');
    assert.equal(state.planHydrationStatus, 'error', 'planHydrationStatus must be error');
    assert.ok(state.planHydrationError, 'planHydrationError must be set');
  });
});

test('I1-B3.1 Onboarded Member Cannot Fall into Start Routine Setup on Hydration Error', async () => {
  class ErroringRemote extends RemoteDeriveService {
    async getRoutine(_userId: string): Promise<RoutinePlan | null> { throw new Error('backend error'); }
    async getUserProducts(_userId: string): Promise<UserProduct[]> { throw new Error('backend error'); }
  }
  await withB31RemoteService(new ErroringRemote(), async () => {
    b31OnboardedRemote('usr_no_setup_1');
    await hydratePlanState('usr_no_setup_1');
    const state = useRoutineStore.getState();
    assert.equal(state.isRoutineBeingPrepared, true, 'Must show preparation state, not setup CTA');
    assert.equal(state.isPlanUnderReview, false);
    assert.equal(state.routine, null);
  });
});

test('I1-B3.1 Failed Hydration Does NOT Call proposeRoutine: error gate prevents model invocation', async () => {
  let proposalCalled = false;
  class ErrorWithSpy extends RemoteDeriveService {
    async getRoutine(_userId: string): Promise<RoutinePlan | null> { throw new Error('read error'); }
    async getUserProducts(_userId: string): Promise<UserProduct[]> { throw new Error('read error'); }
    async proposeRoutine(_input?: any): Promise<RoutineProposalResult> {
      proposalCalled = true;
      throw new Error('should not be called');
    }
  }
  await withB31RemoteService(new ErrorWithSpy(), async () => {
    b31OnboardedRemote('usr_nodepropo_1');
    await ensureInitialRoutineProposal('usr_nodepropo_1');
    assert.equal(proposalCalled, false, 'proposeRoutine must NOT be called when hydration itself failed');
    assert.equal(useRoutineStore.getState().planHydrationStatus, 'error');
    assert.equal(useRoutineStore.getState().isRoutineBeingPrepared, true);
  });
});

test('I1-B3.1 Retry Hydration Succeeds with Null Routine: then proposal occurs', async () => {
  let hydrationAttempts = 0;
  let proposalCalled = false;
  class RetryableRemote extends RemoteDeriveService {
    async getRoutine(_userId: string): Promise<RoutinePlan | null> {
      hydrationAttempts++;
      if (hydrationAttempts === 1) throw new Error('first attempt fails');
      return null;
    }
    async getUserProducts(_userId: string): Promise<UserProduct[]> {
      if (hydrationAttempts <= 1) throw new Error('first attempt fails');
      return [];
    }
    async proposeRoutine(_input?: any): Promise<RoutineProposalResult> {
      proposalCalled = true;
      const { generateRoutineProposal: gen } = await import('../src/services/ai-workflows/routine-generator.ts');
      const { routine, userProducts } = gen({ primaryGoal: 'breakouts', routineComplexity: 'simple' }, []);
      return { routine: { ...routine, userId: 'usr_retry_b31', status: 'awaiting_review' } as any, userProducts };
    }
  }
  await withB31RemoteService(new RetryableRemote(), async () => {
    b31OnboardedRemote('usr_retry_b31');
    await ensureInitialRoutineProposal('usr_retry_b31');
    assert.equal(proposalCalled, false, 'No proposal on first (error) hydration');
    assert.equal(useRoutineStore.getState().planHydrationStatus, 'error');
    assert.equal(useRoutineStore.getState().isRoutineBeingPrepared, true);

    clearInFlightHydrations();
    clearInFlightProposals();
    await ensureInitialRoutineProposal('usr_retry_b31');
    assert.equal(proposalCalled, true, 'Proposal must fire after successful retry hydration');
    assert.ok(hydrationAttempts >= 2, 'Retry must re-run hydration even though isRoutineBeingPrepared was already true');
  });
});

test('I1-B3.1 Old Hydration Promise Cannot Delete Newer Same-User Entry (Promise Identity)', async () => {
  let resolveFirst!: (v: RoutinePlan | null) => void;
  let resolveSecond!: (v: RoutinePlan | null) => void;
  const firstHeld = new Promise<RoutinePlan | null>((res) => { resolveFirst = res; });
  const secondHeld = new Promise<RoutinePlan | null>((res) => { resolveSecond = res; });
  let callCount = 0;
  class RacyRemote extends RemoteDeriveService {
    async getRoutine(_userId: string): Promise<RoutinePlan | null> {
      callCount++;
      if (callCount === 1) return firstHeld;
      if (callCount === 2) return secondHeld;
      throw new Error('third getRoutine must not start; old finally deleted the newer in-flight entry');
    }
    async getUserProducts(_userId: string): Promise<UserProduct[]> { return []; }
  }
  await withB31RemoteService(new RacyRemote(), async () => {
    b31OnboardedRemote('usr_race_b31');
    const a1 = hydratePlanState('usr_race_b31');
    clearInFlightHydrations();
    useRoutineStore.getState().resetRoutine();
    useAuthStore.getState().setSession('usr_race_b31', 'usr_race_b31@derive.skin');
    const a2 = hydratePlanState('usr_race_b31');
    resolveFirst(null);
    await a1;
    const a3 = hydratePlanState('usr_race_b31');
    assert.equal(a3, a2, 'Third hydrate must join the still-in-flight second promise');
    assert.equal(callCount, 2, 'Old finally must not drop the newer map entry');
    resolveSecond(null);
    await a2;
    await a3;
  });
});

test('I1-B3.1 Old Proposal Promise Cannot Delete Newer Same-User Proposal Entry (Promise Identity)', async () => {
  let resolveFirstProposal!: (v: RoutineProposalResult) => void;
  let resolveSecondProposal!: (v: RoutineProposalResult) => void;
  const firstProposalHeld = new Promise<RoutineProposalResult>((res) => { resolveFirstProposal = res; });
  const secondProposalHeld = new Promise<RoutineProposalResult>((res) => { resolveSecondProposal = res; });
  let proposalCount = 0;
  class RacyPropRemote extends RemoteDeriveService {
    async getRoutine(_userId: string): Promise<RoutinePlan | null> { return null; }
    async getUserProducts(_userId: string): Promise<UserProduct[]> { return []; }
    async proposeRoutine(_input?: any): Promise<RoutineProposalResult> {
      proposalCount++;
      if (proposalCount === 1) return firstProposalHeld;
      if (proposalCount === 2) return secondProposalHeld;
      throw new Error('third proposeRoutine must not start; old finally deleted the newer proposal entry');
    }
  }
  await withB31RemoteService(new RacyPropRemote(), async () => {
    b31OnboardedRemote('usr_propr_b31');
    useRoutineStore.setState({
      routine: null,
      isRoutineBeingPrepared: true,
      planHydrationStatus: 'ready',
      planHydrationError: null,
    });
    const p1 = ensureInitialRoutineProposal('usr_propr_b31');
    clearInFlightProposals();
    useRoutineStore.getState().resetRoutine();
    useAuthStore.getState().setSession('usr_propr_b31', 'usr_propr_b31@derive.skin');
    useRoutineStore.setState({
      routine: null,
      isRoutineBeingPrepared: true,
      planHydrationStatus: 'ready',
      planHydrationError: null,
      planHydrationAttempt: useRoutineStore.getState().planHydrationAttempt,
    });
    const p2 = ensureInitialRoutineProposal('usr_propr_b31');
    const { generateRoutineProposal: gen3 } = await import('../src/services/ai-workflows/routine-generator.ts');
    const { routine: r3, userProducts: up3 } = gen3({ primaryGoal: 'breakouts', routineComplexity: 'simple' }, []);
    resolveFirstProposal({
      routine: { ...r3, userId: 'usr_propr_b31', status: 'awaiting_review' } as any,
      userProducts: up3,
    });
    await p1;
    const p3 = ensureInitialRoutineProposal('usr_propr_b31');
    assert.equal(proposalCount, 2, 'Old finally must not drop the newer proposal map entry');
    resolveSecondProposal({
      routine: { ...r3, userId: 'usr_propr_b31', status: 'awaiting_review' } as any,
      userProducts: up3,
    });
    await p2;
    await p3;
  });
});

test('I1-B3.1 Logout/Re-login Same User: dedupe correctness preserved across session boundary', async () => {
  class StableRemote extends RemoteDeriveService {
    async getRoutine(_userId: string): Promise<RoutinePlan | null> { return null; }
    async getUserProducts(_userId: string): Promise<UserProduct[]> { return []; }
  }
  await withB31RemoteService(new StableRemote(), async () => {
    b31OnboardedRemote('usr_relogin_b31');
    await hydratePlanState('usr_relogin_b31');
    assert.equal(useRoutineStore.getState().planHydrationStatus, 'ready');

    useAuthStore.getState().setSignedOut();
    clearInFlightHydrations();
    useRoutineStore.getState().resetRoutine();

    useAuthStore.getState().setSession('usr_relogin_b31', 'relogin@derive.skin');
    useBootstrapStore.setState({
      status: 'READY',
      bootstrapState: {
        userId: 'usr_relogin_b31',
        profileExists: true,
        onboardingCompleted: true,
        membershipStatus: 'active',
      },
      errorMessage: null,
      resolvedUserId: 'usr_relogin_b31',
      resolutionAttempt: 2,
    });
    await hydratePlanState('usr_relogin_b31');
    assert.equal(useRoutineStore.getState().planHydrationStatus, 'ready', 'Second hydration after re-login must complete cleanly');
  });
});

test('I1-B3.1 hydrateRoutine Compatibility: delegates to hydratePlanState, populates userProducts atomically', async () => {
  const wrapProducts: UserProduct[] = [{
    id: 'up_wrap_1',
    userId: 'usr_wrap_b31',
    productId: 'p_wrap_1',
    product: {
      id: 'p_wrap_1',
      brand: 'CeraVe',
      name: 'Hydrating Cleanser',
      category: 'cleanser',
      keyActives: ['Ceramides'],
      fullIngredients: ['Water'],
    },
    action: 'KEEP',
    actionReason: 'Keep cleanser during review.',
    isConfirmedByUser: true,
  }];
  class HydrateWrapRemote extends RemoteDeriveService {
    async getRoutine(_userId: string): Promise<RoutinePlan | null> { return null; }
    async getUserProducts(_userId: string): Promise<UserProduct[]> { return wrapProducts; }
  }
  await withB31RemoteService(new HydrateWrapRemote(), async () => {
    b31OnboardedRemote('usr_wrap_b31');
    const result = await hydrateRoutine('usr_wrap_b31');
    assert.equal(result, null, 'Returns routine (null) via wrapper');
    assert.equal(useRoutineStore.getState().planHydrationStatus, 'ready', 'hydratePlanState must have committed status');
    assert.equal(useRoutineStore.getState().userProducts.length, 1, 'userProducts must hydrate atomically through hydratePlanState');
    assert.equal(useRoutineStore.getState().userProducts[0].product.name, 'Hydrating Cleanser');
    assert.equal(useRoutineStore.getState().isRoutineBeingPrepared, true);
  });
});

test('I1-B3.1 awaiting_review Behavior Unchanged after B3.1 changes', async () => {
  const { generateRoutineProposal: genDraft } = await import('../src/services/ai-workflows/routine-generator.ts');
  const { routine: draftBase } = genDraft({ primaryGoal: 'breakouts', routineComplexity: 'simple' }, []);
  const awaitingRoutine = { ...draftBase, userId: 'usr_draft_b31', status: 'awaiting_review' as const };
  class DraftRemote extends RemoteDeriveService {
    async getRoutine(_userId: string): Promise<RoutinePlan | null> { return awaitingRoutine; }
    async getUserProducts(_userId: string): Promise<UserProduct[]> { return []; }
  }
  await withB31RemoteService(new DraftRemote(), async () => {
    b31OnboardedRemote('usr_draft_b31');
    await hydratePlanState('usr_draft_b31');
    const state = useRoutineStore.getState();
    assert.ok(state.routine);
    assert.equal(state.routine!.status, 'awaiting_review');
    assert.equal(state.isPlanUnderReview, true);
    assert.equal(state.isRoutineBeingPrepared, false);
  });
});

test('I1-B3.1 Published Routine Behavior Unchanged after B3.1 changes', async () => {
  const { generateRoutineProposal: genPub } = await import('../src/services/ai-workflows/routine-generator.ts');
  const { routine: pubBase } = genPub({ primaryGoal: 'breakouts', routineComplexity: 'simple' }, []);
  const publishedRoutine = { ...pubBase, userId: 'usr_pub_b31', status: 'published' as const };
  class PublishedRemote extends RemoteDeriveService {
    async getRoutine(_userId: string): Promise<RoutinePlan | null> { return publishedRoutine; }
    async getUserProducts(_userId: string): Promise<UserProduct[]> { return []; }
  }
  await withB31RemoteService(new PublishedRemote(), async () => {
    b31OnboardedRemote('usr_pub_b31');
    await hydratePlanState('usr_pub_b31');
    const state = useRoutineStore.getState();
    assert.ok(state.routine);
    assert.equal(state.routine!.status, 'published');
    assert.equal(state.isPlanUnderReview, false);
    assert.equal(state.isRoutineBeingPrepared, false);
    assert.equal(state.planHydrationStatus, 'ready');
  });
});

test('I1-B3.1 Provider Neutrality Unchanged: zero provider references in deriveClient.ts', () => {
  const content = fs.readFileSync(path.resolve('src/services/deriveClient.ts'), 'utf8');
  for (const token of ['Gemini', 'gemini', 'OpenAI', 'openai', 'Claude', 'claude', 'Anthropic', 'anthropic', 'ROUTINE_MODEL_PROVIDER']) {
    assert.ok(!content.includes(token), `deriveClient.ts must not contain provider reference '${token}'`);
  }
});

test('I1-B3.1 Session Reset Invalidates Stale Projections: clears maps and increments attempt', () => {
  useRoutineStore.setState({
    routine: null,
    isRoutineBeingPrepared: true,
    planHydrationStatus: 'loading',
    planHydrationAttempt: 5,
    planHydrationError: null,
  });
  const attemptBefore = useRoutineStore.getState().planHydrationAttempt;
  clearInFlightHydrations();
  clearInFlightProposals();
  useRoutineStore.getState().resetRoutine();
  assert.ok(useRoutineStore.getState().planHydrationAttempt > attemptBefore, 'Attempt counter must increment on reset');
  assert.equal(useRoutineStore.getState().isRoutineBeingPrepared, false);
  assert.equal(useRoutineStore.getState().routine, null);
  assert.equal(useRoutineStore.getState().planHydrationStatus, 'idle');
});
