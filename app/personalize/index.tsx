import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { PersonalizationFlow } from '@/src/components/personalization/PersonalizationFlow';
import { colors } from '@/src/constants/theme';
import { personalizationGateway } from '@/src/presentation/personalization/gateway';
import type { PersonalizationDraft } from '@/src/presentation/personalization/draft';

/** The same optional editor is opened from Check and My Stuff. Back retains the originating screen. */
export default function PersonalizeScreen() {
  const router = useRouter();
  const [initialDraft, setInitialDraft] = useState<PersonalizationDraft | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let active = true;
    void personalizationGateway.loadProfile().then((result) => {
      if (!active) return;
      if (result.kind === 'ready') setInitialDraft(result.profile);
      setLoaded(true);
    }).catch(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, []);

  if (!loaded) return <View style={{ flex: 1, backgroundColor: colors.canvas }} />;
  return <PersonalizationFlow initialDraft={initialDraft ?? undefined}
    onComplete={(answers) => { void personalizationGateway.saveProfile(answers).then(() => router.back(), () => router.back()); }}
    onSkip={() => router.back()} />;
}
