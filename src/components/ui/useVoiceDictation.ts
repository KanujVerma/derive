import { useCallback, useRef, useState } from 'react';
import { Platform, Keyboard } from 'react-native';
import * as Haptics from 'expo-haptics';
import { analytics } from '@/src/services/analytics';
import type { VoiceContext } from '@/src/components/ui/VoiceInputButton';
import {
  shouldEmitDemoVoiceTranscript,
  selectDemoVoiceTranscript,
} from './voiceDictationSafety';

export {
  CONTEXT_SAMPLES,
  shouldEmitDemoVoiceTranscript,
  selectDemoVoiceTranscript,
} from './voiceDictationSafety';

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
    if (!shouldEmitDemoVoiceTranscript(typeof __DEV__ !== 'undefined' && __DEV__)) {
      return;
    }
    const selected = selectDemoVoiceTranscript(context, sampleIndexRef.current);
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
        setIsListening(true);
        recognition.start();
        return;
      } catch {
        // Fall through to gated demo fallback.
      }
    }

    if (shouldEmitDemoVoiceTranscript(typeof __DEV__ !== 'undefined' && __DEV__)) {
      nativeFallbackRef.current = true;
      setIsListening(true);
      return;
    }

    // Production native dictation is not available. Keep typed input; do not inject samples.
  }, [commit, context, disabled, isListening]);

  return { isListening, start, stop };
}
