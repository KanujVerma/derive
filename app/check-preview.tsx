import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '@/src/components/ui/Screen';
import { Button } from '@/src/components/ui/Button';
import { CheckResultView } from '@/src/components/check/result-sheet/CheckResultContent';
import { ResultSheetSurface } from '@/src/components/check/result-sheet/ResultSheetSurface';
import { describeResultExample, resultExamples } from '@/src/presentation/check/result-sheet/examples';
import { publicEnvironment } from '@/src/config/environment';
import { colors, spacing } from '@/src/constants/theme';

/** Isolated, unsaved semantic fixtures. No camera, product-truth promotion or service calls. */
export default function CheckPreviewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ scenario?: string; expanded?: string }>();
  const [scenario, setScenario] = useState<string>(params.scenario ?? resultExamples[0][0]);
  const [open, setOpen] = useState(true);
  const [serial, setSerial] = useState(0);
  if (!__DEV__ || publicEnvironment.buildFlavor !== 'development' || publicEnvironment.useRemoteService) return <Screen><Text>Preview unavailable.</Text><Button label="Back" onPress={() => router.back()} /></Screen>;
  const example = describeResultExample(scenario);
  return <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.canvas }}>
    <Screen scrollable><Text accessibilityRole="header">Result examples</Text>
      <Text>Fictional products, label facts, people and routines. Nothing here is saved or live advice.</Text>
      <View style={{ gap: spacing.xs }}>{resultExamples.map(([id, label]) => <Button key={id} label={label} variant="secondary" onPress={() => { setScenario(id); setSerial(value => value + 1); setOpen(true); }} />)}</View>
      <Button label="Open result again" variant="ghost" onPress={() => { setSerial(value => value + 1); setOpen(true); }} />
      <Button label="Five-step profile" variant="ghost" onPress={() => router.push('/personalize/fixture?mode=profile&fresh=1&focused=1')} />
      <Button label="Back to Check" variant="ghost" onPress={() => router.replace('/(tabs)/check')} />
    </Screen>
    <ResultSheetSurface visible={open} presentationKey={`${scenario}:${serial}`} onClose={() => setOpen(false)} initialDetent={params.expanded === '1' ? 1 : 0}
      summary={<CheckResultView {...example} section="summary" />}>
      <CheckResultView {...example} section="findings" />
    </ResultSheetSurface>
  </View>;
}
