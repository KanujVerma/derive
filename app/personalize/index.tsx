import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { PersonalizationFlow } from '@/src/components/personalization/PersonalizationFlow';
import { colors } from '@/src/constants/theme';
import { personalizationGateway, resolvePersonalizationOwnerId } from '@/src/presentation/personalization/gateway';
import { remotePersonalizationGateway } from '@/src/presentation/personalization/remoteGateway';
import type { PersonalizationGateway } from '@/src/presentation/personalization/gateway';
import { Button } from '@/src/components/ui/Button';
import type { PersonalizationDraft } from '@/src/presentation/personalization/draft';
import { useAuthStore } from '@/src/stores/authStore';
import { publicEnvironment } from '@/src/config/environment';
import { isRemoteServiceEnabled } from '@/src/services/DeriveService';
import { resolveShellPresentation } from '@/src/utils/shellPresentation';

/** The same optional editor is opened from Check and My Stuff. Back retains the originating screen. */
export default function PersonalizeScreen() {
  const sessionUserId = useAuthStore((s) => s.sessionUserId);
  const shell = resolveShellPresentation({
    buildFlavor: publicEnvironment.buildFlavor,
    remoteEnabled: isRemoteServiceEnabled(),
    supabaseUrl: publicEnvironment.supabaseUrl,
  });
  const ownerId = resolvePersonalizationOwnerId(sessionUserId, shell);
  const live = shell === 'local_free_integration';
  return <PersonalizeEditor key={ownerId ?? 'signed-out'} ownerId={ownerId}
    gateway={live ? remotePersonalizationGateway : personalizationGateway} live={live} />;
}

function PersonalizeEditor({ ownerId, gateway, live }: {
  ownerId: string | null; gateway: PersonalizationGateway; live: boolean;
}) {
  const router = useRouter();
  const [initialDraft, setInitialDraft] = useState<PersonalizationDraft | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let active = true;
    void gateway.loadProfile(ownerId).then((result) => {
      if (!active) return;
      if (result.kind === 'ready') setInitialDraft(result.profile);
      setLoaded(true);
    }).catch(() => { if (active) { setLoadError(true); setLoaded(true); } });
    return () => { active = false; };
  }, [ownerId, gateway]);

  if (!ownerId || !loaded) return <View style={{ flex: 1, backgroundColor: colors.canvas }} />;
  if (loadError) return <View style={{ flex: 1, backgroundColor: colors.canvas, padding: 24, justifyContent: 'center' }}>
    <Text>We could not load your skin profile. Please try again.</Text>
    <Button label="Back" variant="outline" onPress={() => router.back()} />
  </View>;
  return <View style={{ flex: 1, backgroundColor: colors.canvas }}>
    {saveError && <Text accessibilityRole="alert" style={{ padding: 12, color: colors.actionStop.text }}>
      Your answers were not saved. Please try again.
    </Text>}
    {saving && <Text style={{ padding: 12, color: colors.inkMuted }}>Saving your answers...</Text>}
    <PersonalizationFlow initialDraft={initialDraft ?? undefined}
      onComplete={(answers) => {
        if (saving) return;
        setSaving(true); setSaveError(false);
        void gateway.saveProfile(ownerId, answers).then((result) => {
          if (result.kind === 'ready' || !live) router.back();
          else setSaveError(true);
        }).catch(() => { if (!live) router.back(); else setSaveError(true); })
          .finally(() => setSaving(false));
      }}
      onSkip={() => router.back()} />
  </View>;
}
