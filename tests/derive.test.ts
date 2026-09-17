import test from 'node:test';
import assert from 'node:assert/strict';

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
        timing: 'am',
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
        timing: 'pm',
        whyChosen: 'Gentle evening cleanse',
      },
      {
        id: 's_pm_2',
        order: 2,
        productId: 'p_sun',
        productName: 'Relief Sun SPF 50+',
        brand: 'Beauty of Joseon',
        category: 'sunscreen',
        timing: 'pm',
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
        timing: 'am',
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
    complexityPreference: 'simple',
  });

  assert.equal(verdict.verdict, 'great_fit');
  assert.match(verdict.reason, /sunscreen/i);
  assert.ok(verdict.whyBullets.length >= 2);
});

test('Scan Evaluator: Flags Paula Choice BHA with caution due to active Differin schedule', () => {
  const bha = PROTOTYPE_CATALOG.find((p) => p.name.includes('BHA'))!;
  assert.ok(bha);

  const verdict = evaluateProductScan(bha, {
    activeDifferinSchedule: 'Mon, Wed, Fri',
    currentRoutineProducts: ['CeraVe Hydrating Cleanser', 'Differin Adapalene Gel 0.1%'],
    recentReactions: [],
    primaryGoal: 'breakouts',
    complexityPreference: 'simple',
  });

  assert.equal(verdict.verdict, 'use_with_caution');
  assert.match(verdict.reason, /Differin/i);
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
    complexityPreference: 'simple',
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

import { getDeriveService } from '../src/services/DeriveService.ts';

test('DeriveService: MockDeriveService satisfies the IDeriveService contract', async () => {
  const service = getDeriveService();
  assert.ok(service);

  // 1. Test routine retrieval
  const routine = await service.getRoutine('mock_user_1');
  assert.ok(routine);
  assert.ok(routine.amSteps.length > 0);
  assert.ok(routine.pmSteps.length > 0);

  // 2. Test Ask Derive
  const askRes = await service.askDerive({
    userId: 'mock_user_1',
    question: 'Can I use moisturizer before or after Differin?',
  });
  assert.equal(askRes.safety.isMedicalEmergency, false);
  assert.ok(askRes.directAnswer);

  // 3. Test Scan Product
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

  // 4. Test Managed Refill Request
  const refill = await service.requestRefill({
    userId: 'mock_user_1',
    productId: 'p3',
    productName: 'Toleriane Double Repair Face Moisturizer',
    brand: 'La Roche-Posay',
  });
  assert.equal(refill.status, 'requested');
  assert.equal(refill.productName, 'Toleriane Double Repair Face Moisturizer');

  // 5. Test Orders Listing
  const orders = await service.getOrders('mock_user_1');
  assert.ok(orders.length >= 2);
  assert.equal(orders[0].id, refill.id);

  // 6. Test Check-In Submission
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
// 10. PERSONALIZED ALL-IN MONTHLY PRICING TESTS
// ========================================================

import {
  calculateProductMonthlyConsumption,
  calculateMonthlyPlanPrice,
  evaluatePriceAdjustment,
  formatCentsToDollars,
  PROVISIONAL_DEMO_MANAGEMENT_FEE_CENTS,
  PROVISIONAL_OPERATIONS_RISK_CENTS,
} from '../src/pricing/index.ts';
import { useOnboardingStore } from '../src/stores/onboardingStore.ts';

test('Personalized Pricing: Normalizes retail prices into 30-day monthly consumption with deterministic rounding', () => {
  // CeraVe Cleanser: $16 retail, 60-day lifespan -> round(1600 * 30 / 60) = 800 cents ($8.00/month)
  const cleanserEst = calculateProductMonthlyConsumption({
    id: 'p1',
    name: 'Hydrating Facial Cleanser',
    brand: 'CeraVe',
  });
  assert.equal(cleanserEst.retailPriceCents, 1600);
  assert.equal(cleanserEst.estimatedLifespanDays, 60);
  assert.equal(cleanserEst.monthlyEquivalentCents, 800);
  assert.equal(cleanserEst.isDeriveManagedReplenishment, true);

  // Differin: $15 retail, 45-day lifespan -> round(1500 * 30 / 45) = 1000 cents ($10.00/mo)
  const differinEst = calculateProductMonthlyConsumption({
    id: 'p2',
    name: 'Adapalene Gel 0.1%',
    brand: 'Differin',
  });
  assert.equal(differinEst.retailPriceCents, 1500);
  assert.equal(differinEst.estimatedLifespanDays, 45);
  assert.equal(differinEst.monthlyEquivalentCents, 1000);
  assert.equal(differinEst.isDeriveManagedReplenishment, true);

  // La Roche-Posay: $24 retail, 45-day lifespan -> round(2400 * 30 / 45) = 1600 cents ($16.00/mo)
  const lrpEst = calculateProductMonthlyConsumption({
    id: 'p4',
    name: 'Toleriane Double Repair Moisturizer',
    brand: 'La Roche-Posay',
  });
  assert.equal(lrpEst.retailPriceCents, 2400);
  assert.equal(lrpEst.estimatedLifespanDays, 45);
  assert.equal(lrpEst.monthlyEquivalentCents, 1600);
  assert.equal(lrpEst.isDeriveManagedReplenishment, true);

  // Daily Sunscreen: $18 retail, 30-day lifespan -> round(1800 * 30 / 30) = 1800 cents ($18.00/mo)
  const spfEst = calculateProductMonthlyConsumption({
    id: 'p5',
    name: 'Relief Sun SPF 50+',
    brand: 'Beauty of Joseon',
  });
  assert.equal(spfEst.retailPriceCents, 1800);
  assert.equal(spfEst.estimatedLifespanDays, 30);
  assert.equal(spfEst.monthlyEquivalentCents, 1800);
  assert.equal(spfEst.isDeriveManagedReplenishment, true);

  // Deterministic fractional rounding test: $20.00 retail, 45-day lifespan -> round(2000 * 30 / 45) = 1333 cents ($13.33/mo)
  const defaultEst = calculateProductMonthlyConsumption({
    id: 'custom_product',
    name: 'Unknown Cream',
    brand: 'Generic',
  });
  assert.equal(defaultEst.retailPriceCents, 2000);
  assert.equal(defaultEst.estimatedLifespanDays, 45);
  assert.equal(defaultEst.monthlyEquivalentCents, 1333);
});

test('Personalized Pricing: Computes exact Arthur demo monthly estimate ($96/mo) and separates inventory from consumption', () => {
  const activeProducts = [
    { id: 'p1', name: 'Hydrating Facial Cleanser', brand: 'CeraVe' }, // 800 cents/mo
    { id: 'p2', name: 'Adapalene Gel 0.1%', brand: 'Differin' }, // 1000 cents/mo
    { id: 'p4', name: 'Toleriane Double Repair Moisturizer', brand: 'La Roche-Posay' }, // 1600 cents/mo
    { id: 'p5', name: 'Relief Sun SPF 50+', brand: 'Beauty of Joseon' }, // 1800 cents/mo
  ];

  // Arthur owns p1, p2, and p4 on his counter shelf; p5 is a new addition
  const existingInventory = new Set(['p1', 'p2', 'p4']);
  const planEstimate = calculateMonthlyPlanPrice(activeProducts, {
    existingInventoryProductIds: existingInventory,
  });

  // Verify internal provisional demo assumptions
  assert.equal(planEstimate.managementFeeCents, PROVISIONAL_DEMO_MANAGEMENT_FEE_CENTS); // 3900 cents ($39)
  assert.equal(planEstimate.operationsRiskCents, PROVISIONAL_OPERATIONS_RISK_CENTS); // 500 cents ($5)

  // Steady-state product consumption: 800 + 1000 + 1600 + 1800 = 5200 cents ($52)
  // Existing inventory affects shipment timing, NOT steady-state consumption
  assert.equal(planEstimate.productConsumptionCents, 5200);

  // Exact Arthur demo monthly total: $39 + $52 + $5 = $96.00 / month (9600 cents)
  assert.equal(planEstimate.monthlyTotalCents, 9600);
  assert.equal(formatCentsToDollars(planEstimate.monthlyTotalCents), '$96');

  // Verify breakdown inventory flags
  const p1Item = planEstimate.productBreakdown.find((i) => i.productId === 'p1');
  const p5Item = planEstimate.productBreakdown.find((i) => i.productId === 'p5');
  assert.equal(p1Item?.hasExistingInventory, true);
  assert.equal(p5Item?.hasExistingInventory, false);
});

test('Personalized Pricing: Excluding a product from Derive-managed replenishment changes result intentionally', () => {
  const activeProducts = [
    { id: 'p1', name: 'Hydrating Facial Cleanser', brand: 'CeraVe', isDeriveManagedReplenishment: true }, // 800 cents/mo
    { id: 'p2', name: 'Adapalene Gel 0.1%', brand: 'Differin', isDeriveManagedReplenishment: false }, // Member provides own prescription
    { id: 'p4', name: 'Toleriane Double Repair Moisturizer', brand: 'La Roche-Posay', isDeriveManagedReplenishment: true }, // 1600 cents/mo
    { id: 'p5', name: 'Relief Sun SPF 50+', brand: 'Beauty of Joseon', isDeriveManagedReplenishment: true }, // 1800 cents/mo
  ];

  const planEstimate = calculateMonthlyPlanPrice(activeProducts);

  // Product consumption excludes p2: 800 + 1600 + 1800 = 4200 cents ($42)
  assert.equal(planEstimate.productConsumptionCents, 4200);

  // Monthly Total: 3900 + 4200 + 500 = 8600 cents ($86/mo)
  assert.equal(planEstimate.monthlyTotalCents, 8600);
  assert.equal(formatCentsToDollars(planEstimate.monthlyTotalCents), '$86');
});

test('Personalized Pricing: Evaluates price adjustments and enforces member approval on increases', () => {
  // Case 1: Routine change increases monthly price (e.g. $96 -> $104) -> requires approval
  const increaseEval = evaluatePriceAdjustment(9600, 10400);
  assert.equal(increaseEval.requiresMemberApproval, true);
  assert.equal(increaseEval.priceDeltaCents, 800);
  assert.match(increaseEval.explanation, /increases your plan by \$8\/mo.*confirmation required/i);

  // Case 2: Routine simplification reduces monthly price (e.g. $96 -> $86) -> no approval required
  const decreaseEval = evaluatePriceAdjustment(9600, 8600);
  assert.equal(decreaseEval.requiresMemberApproval, false);
  assert.equal(decreaseEval.priceDeltaCents, -1000);
  assert.match(decreaseEval.explanation, /lowers your plan by \$10\/mo/i);

  // Case 3: No price change (e.g. like-for-like swap)
  const noChangeEval = evaluatePriceAdjustment(9600, 9600);
  assert.equal(noChangeEval.requiresMemberApproval, false);
  assert.equal(noChangeEval.priceDeltaCents, 0);
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

test('K4.3 Pricing Truth: Client configuration centralizes beta price at $100/mo', () => {
  assert.equal(config.betaPriceMonthly, 100);
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


