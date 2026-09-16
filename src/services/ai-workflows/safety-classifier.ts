export interface SafetyCheckResult {
  isMedicalEmergency: boolean;
  severity: 'safe' | 'warning' | 'emergency';
  message?: string;
}

const RED_FLAG_PATTERNS = [
  /\b(swelling|swollen|puffy face|eyes swollen shut)\b/i,
  /\b(difficulty breathing|throat tight|anaphylaxis|wheezing)\b/i,
  /\b(blister|blistering|weeping|oozing pus|yellow crust)\b/i,
  /\b(mole|bleeding spot|growing lesion|asymmetrical dark spot)\b/i,
  /\b(severe burn|chemical burn|peeling off skin in sheets)\b/i,
  /\b(infection|cellulitis|spreading red streaks|fever)\b/i,
];

export function checkSkincareSafety(input: string): SafetyCheckResult {
  const normalized = input.toLowerCase();

  for (const pattern of RED_FLAG_PATTERNS) {
    if (pattern.test(normalized)) {
      return {
        isMedicalEmergency: true,
        severity: 'emergency',
        message:
          'This requires immediate professional medical evaluation from a physician or dermatologist. Please pause all active skincare products immediately.',
      };
    }
  }

  // Warning for common strong acid or retinol irritation
  if (
    normalized.includes('stinging') ||
    normalized.includes('burning') ||
    normalized.includes('raw skin')
  ) {
    return {
      isMedicalEmergency: false,
      severity: 'warning',
      message:
        'Your skin barrier is feeling sensitized. We recommend pausing acids and retinoids tonight and applying a gentle moisturizer only.',
    };
  }

  return {
    isMedicalEmergency: false,
    severity: 'safe',
  };
}
