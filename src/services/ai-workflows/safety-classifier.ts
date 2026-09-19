export interface SafetyCheckResult {
  isMedicalEmergency: boolean;
  severity: 'safe' | 'warning' | 'emergency';
  message?: string;
  matchedKeywords?: string[];
  recommendedAction?: 'continue' | 'caution_barrier' | 'immediate_medical_care';
}

interface SafetyRule {
  label: string;
  pattern: RegExp;
}

// These rules are deliberately deterministic and run before any model call.
// A generative model is never allowed to downgrade a matched red flag.
const EMERGENCY_RULES: SafetyRule[] = [
  {
    label: 'facial_or_eye_swelling',
    pattern:
      /\b(face|facial|eye|eyes|eyelid|eyelids|lip|lips|tongue)\b.{0,32}\b(swelling|swollen|puffy|closing|shut)\b|\b(swelling|swollen|puffy)\b.{0,32}\b(face|facial|eye|eyes|eyelid|eyelids|lip|lips|tongue)\b/i,
  },
  {
    label: 'respiratory_distress',
    pattern:
      /\b(difficulty breathing|trouble breathing|cannot breathe|can't breathe|shortness of breath|throat (?:is )?(?:tight|tightening|closing)|wheezing|anaphylaxis)\b/i,
  },
  {
    label: 'severe_blistering_or_oozing',
    pattern:
      /\b(blistering rash|widespread blisters?|skin blistering|yellow (?:ooze|oozing|crust)|oozing (?:pus|yellow fluid)|pus|weeping rash)\b/i,
  },
  {
    label: 'rapidly_spreading_hot_hives',
    pattern:
      /\b(rapidly spreading|spreading quickly|all over)\b.{0,40}\b(hives?|welts?|hot rash)\b|\b(hives?|welts?|hot rash)\b.{0,40}\b(rapidly spreading|spreading quickly|all over)\b/i,
  },
  {
    label: 'severe_skin_injury',
    pattern: /\b(severe chemical burn|skin (?:is )?peeling off in sheets|large areas? of skin (?:are )?peeling)\b/i,
  },
];

const MEDICAL_REVIEW_RULES: SafetyRule[] = [
  {
    label: 'possible_infection',
    pattern: /\b(cellulitis|spreading red streaks?|fever with (?:a )?rash|infected wound)\b/i,
  },
  {
    label: 'changing_or_bleeding_lesion',
    pattern: /\b(changing mole|bleeding mole|growing lesion|asymmetrical dark spot)\b/i,
  },
];

const BARRIER_WARNING_RULES: SafetyRule[] = [
  {
    label: 'barrier_burning_or_stinging',
    pattern: /\b(burning|stinging|raw skin|severe peeling|painful peeling)\b/i,
  },
];

function matchingLabels(input: string, rules: SafetyRule[]): string[] {
  return rules.filter((rule) => rule.pattern.test(input)).map((rule) => rule.label);
}

export function checkSkincareSafety(input: string): SafetyCheckResult {
  const normalized = input.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
  const emergencyMatches = matchingLabels(normalized, EMERGENCY_RULES);

  if (emergencyMatches.length > 0) {
    return {
      isMedicalEmergency: true,
      severity: 'emergency',
      message:
        'Stop using the product and seek immediate professional medical evaluation in person. If breathing, throat, tongue, or rapidly worsening swelling is involved, call emergency services now.',
      matchedKeywords: emergencyMatches,
      recommendedAction: 'immediate_medical_care',
    };
  }

  const medicalReviewMatches = matchingLabels(normalized, MEDICAL_REVIEW_RULES);
  if (medicalReviewMatches.length > 0) {
    return {
      isMedicalEmergency: false,
      severity: 'warning',
      message:
        'This is outside cosmetic skincare. Stop experimenting with products on the area and arrange prompt in-person medical evaluation.',
      matchedKeywords: medicalReviewMatches,
      recommendedAction: 'caution_barrier',
    };
  }

  const barrierMatches = matchingLabels(normalized, BARRIER_WARNING_RULES);
  if (barrierMatches.length > 0) {
    return {
      isMedicalEmergency: false,
      severity: 'warning',
      message:
        'Your skin barrier may be sensitized. Pause acids and retinoids for 48 hours, use only a gentle cleanser and moisturizer, and seek care if symptoms worsen.',
      matchedKeywords: barrierMatches,
      recommendedAction: 'caution_barrier',
    };
  }

  return {
    isMedicalEmergency: false,
    severity: 'safe',
    matchedKeywords: [],
    recommendedAction: 'continue',
  };
}
