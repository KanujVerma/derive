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
} from '../src/types/schema.ts';

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
