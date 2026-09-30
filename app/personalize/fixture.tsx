import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '@/src/components/ui/Screen';
import { Button } from '@/src/components/ui/Button';
import { ContextFlow } from '@/src/components/p0b-personalization/ContextFlow';
import { RoutineContext } from '@/src/components/p0b-personalization/RoutineContext';
import { ExperienceContext } from '@/src/components/p0b-personalization/ExperienceContext';
import { PersonalDecisionPanel } from '@/src/components/personal-decision/PersonalDecisionPanel';
import { personalDecisionFixtures } from '@/src/fixtures/personal-decision/fixtures';
import { partialRoutine, basicContext, noReactionReport } from '@/src/fixtures/p0b-personalization/examples';
import { publicEnvironment } from '@/src/config/environment';
import { isRemoteServiceEnabled } from '@/src/services/DeriveService';
import { resolveShellPresentation } from '@/src/utils/shellPresentation';
import { createCatalogRequestId } from '@/src/services/productCatalog';
/** Native visual acceptance only. No network requests, auth changes, or persistence. */
export default function PersonalDecisionFixtureScreen() {
  const router = useRouter();
  const closePreview = () => { if (router.canGoBack()) router.back(); else router.replace('/(tabs)/my-stuff'); };
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ scenario?: string; mode?: string; fresh?: string; focused?: string }>();
  const [mode, setMode] = useState(params.mode ?? 'decision');
  const [message, setMessage] = useState<string | null>(null);
  const focused = params.focused === '1';
  const fresh = params.fresh === '1';
  const shell = resolveShellPresentation({ buildFlavor: publicEnvironment.buildFlavor, remoteEnabled: isRemoteServiceEnabled(), supabaseUrl: publicEnvironment.supabaseUrl });
  if (!__DEV__ || publicEnvironment.buildFlavor !== 'development' || shell === 'legacy') return <Screen><Text>Fixture preview unavailable.</Text><Button label="Back" onPress={closePreview} /></Screen>;
  const fixture = personalDecisionFixtures.find(item => item.id === params.scenario) ?? personalDecisionFixtures[0];
  return <View style={{ flex: 1, paddingTop: focused ? insets.top : 0 }}>{!focused && <View style={{ padding: 16, paddingTop: insets.top + 16 }}><Text accessibilityRole="header">DEVELOPMENT FIXTURE</Text>
    <Text>Synthetic context and product examples. Nothing here is saved or evaluated by a live service.</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{['decision', 'profile', 'routine', 'experience'].map(value => <Button key={value} label={value} size="medium" variant="ghost" onPress={() => setMode(value)} />)}</View>
    {message && <Text accessibilityLiveRegion="polite">{message}</Text>}
  </View>}
    {mode === 'profile' && <ContextFlow initialDraft={fresh ? undefined : basicContext} collectIntent={false} completionLabel="Done" onApply={() => { if (focused) closePreview(); else setMessage('Preview finished. Answers were not saved.'); }} onSkip={() => { if (focused) closePreview(); else setMode('decision'); }} />}
    {mode === 'routine' && <RoutineContext initialDraft={partialRoutine} createItemId={createCatalogRequestId} onApply={() => setMessage('Fixture routine applied locally. Nothing saved.')} onSkip={() => setMode('decision')} />}
    {mode === 'experience' && <ExperienceContext createRecordId={createCatalogRequestId} existing={{ draft: noReactionReport, revisionId: '00000000-0000-4000-8000-000000000003' }} onApply={() => setMessage('Fixture correction applied locally. Nothing saved.')} onSkip={() => setMode('decision')} />}
    {mode === 'decision' && <Screen scrollable><Text>Scenario: {fixture.id}</Text><PersonalDecisionPanel packet={fixture.packet} expectedBinding={fixture.binding} onNextStep={step => { if (step === 'add_context') setMode('profile'); else if (step === 'review_routine' || step === 'keep_current') setMode('routine'); else setMessage(`Fixture next step: ${step.replaceAll('_', ' ')}. No live action performed.`); }} /><Button label="Back" variant="ghost" onPress={closePreview} /></Screen>}
  </View>;
}
