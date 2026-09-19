export type VoiceDictationContext = 'ask' | 'photo_note' | 'reaction_note' | 'checkin_note';

export const CONTEXT_SAMPLES: Record<VoiceDictationContext, string[]> = {
  ask: [
    'Should I skip Differin tonight if my skin feels slightly tight?',
    'Is the Anthelios sunscreen safe to use right after morning cleanser?',
    'Can I reintroduce vitamin C while keeping Differin on Mon Wed Fri?',
  ],
  photo_note: [
    'Mild redness around the left cheek after sun exposure yesterday.',
    'Flaking around the mouth has calmed down since switching to gentle cleanser.',
    'Texture looks slightly smoother on forehead today.',
  ],
  reaction_note: [
    'Caused immediate burning and stinging on cheeks that lasted 20 minutes.',
    'Broke out in small whiteheads along my jawline after two days.',
    'Left skin very dry, red, and irritated around the nose.',
  ],
  checkin_note: [
    'Tolerating Differin well 3 nights a week with no new redness.',
    'Skin feels balanced in the morning, barrier feels resilient.',
    'Slight tightness after morning wash, but moisturizer resolved it.',
  ],
};

export function shouldEmitDemoVoiceTranscript(isDev: boolean): boolean {
  return isDev === true;
}

export function selectDemoVoiceTranscript(
  context: VoiceDictationContext,
  sampleIndex: number
): string {
  const samples = CONTEXT_SAMPLES[context];
  return samples[sampleIndex % samples.length];
}
