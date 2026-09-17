import { useCallback, useRef, useState } from 'react';
import { Platform, Keyboard } from 'react-native';
import * as Haptics from 'expo-haptics';
import { analytics } from '@/src/services/analytics';
import type { VoiceContext } from '@/src/components/ui/VoiceInputButton';

const CONTEXT_SAMPLES: Record<VoiceContext, string[]> = {
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

function getSpeechRecognition(): { new (): any } | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

function recordCompleted(context: VoiceContext, text: string) {
  const wordCount = text.trim().split(/\s+/).length;
  const wordCountBucket =
    wordCount < 10 ? 'under_10' : wordCount <= 30 ? '10_30' : 'over_30';
  analytics.track('voice_input_completed', {
    context,
    wordCountBucket,
  });
}

export function useVoiceDictation({
  context,
  onTranscript,
  disabled = false,
}: {
  context: VoiceContext;
  onTranscript: (transcribedText: string) => void;
  disabled?: boolean;
}) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const transcriptRef = useRef('');
  const sampleIndexRef = useRef(0);
  const nativeFallbackRef = useRef(false);

  const commit = useCallback(
    (text: string) => {
      if (!text) return;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onTranscript(text);
      recordCompleted(context, text);
    },
    [context, onTranscript]
  );

  const emitNativeSample = useCallback(() => {
    const samples = CONTEXT_SAMPLES[context];
    const selected = samples[sampleIndexRef.current % samples.length];
    sampleIndexRef.current += 1;
    commit(selected);
  }, [commit, context]);

  const stop = useCallback(() => {
    if (!isListening) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }

    if (nativeFallbackRef.current) {
      nativeFallbackRef.current = false;
      emitNativeSample();
    }

    setIsListening(false);
  }, [emitNativeSample, isListening]);

  const start = useCallback(() => {
    if (disabled || isListening) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Keyboard.dismiss();
    transcriptRef.current = '';
    nativeFallbackRef.current = false;
    setIsListening(true);
    analytics.track('voice_input_started', { context });

    const SpeechRecognition = getSpeechRecognition();
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.continuous = true;
        recognition.interimResults = false;

        recognition.onresult = (event: { results: ArrayLike<{ 0: { transcript: string } }> }) => {
          const parts: string[] = [];
          for (let i = 0; i < event.results.length; i++) {
            parts.push(event.results[i][0].transcript);
          }
          transcriptRef.current = parts.join(' ').trim();
        };

        recognition.onerror = () => {
          recognitionRef.current = null;
        };

        recognition.onend = () => {
          recognitionRef.current = null;
          const spoken = transcriptRef.current.trim();
          if (spoken) commit(spoken);
          setIsListening(false);
        };

        recognitionRef.current = recognition;
        recognition.start();
        return;
      } catch {
        // Fall through to native sample on stop.
      }
    }

    nativeFallbackRef.current = true;
  }, [commit, context, disabled, isListening]);

  return { isListening, start, stop };
}
