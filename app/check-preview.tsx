import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '@/src/components/ui/Screen';
import { Button } from '@/src/components/ui/Button';
import { ChoiceChip } from '@/src/components/ui/ChoiceChip';
import { QuestionGroup } from '@/src/components/ui/QuestionGroup';
import { CheckResultView } from '@/src/components/check/result-sheet/CheckResultContent';
import { ResultSheetSurface } from '@/src/components/check/result-sheet/ResultSheetSurface';
import { resultExamples } from '@/src/presentation/check/result-sheet/examples';
import { coverageExamples, createPreviewAnswers, describeContextualExample, previewScan, previewQuestions, setPreviewIntent, setPreviewTarget, togglePreviewFeedback } from '@/src/presentation/check/result-sheet/previewContext';
import { currentFeedbackChoices } from '@/src/presentation/p0b-personalization/setup';
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
  const [answers, setAnswers] = useState(() => createPreviewAnswers(`${params.scenario ?? resultExamples[0][0]}:0`));
  if (!__DEV__ || publicEnvironment.buildFlavor !== 'development' || publicEnvironment.useRemoteService) return <Screen><Text>Preview unavailable.</Text><Button label="Back" onPress={() => router.back()} /></Screen>;
  const scan = previewScan(scenario);
  const questions = scan ? previewQuestions(scan) : null;
  const example = describeContextualExample(scenario, `${scenario}:${serial}`, answers);
  const selectedTarget = scan?.products.find(product => product.id === answers.targetId);
  const chips = { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: spacing.xs };
  return <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.canvas }}>
    <Screen scrollable><Text accessibilityRole="header">Result examples</Text>
      <Text>Fictional products, label facts, people and routines. Nothing here is saved or live advice.</Text>
      <View style={{ gap: spacing.xs }}>{[...resultExamples, ...coverageExamples].map(([id, label]) => <Button key={id} label={label} variant="secondary" onPress={() => { const next = serial + 1; setScenario(id); setSerial(next); setAnswers(createPreviewAnswers(`${id}:${next}`)); setOpen(true); }} />)}</View>
      <Button label="Open result again" variant="ghost" onPress={() => setOpen(true)} />
      <Button label="Five-step profile" variant="ghost" onPress={() => router.push('/personalize/fixture?mode=profile&fresh=1&focused=1')} />
      <Button label="Back to Check" variant="ghost" onPress={() => router.replace('/(tabs)/check')} />
    </Screen>
    <ResultSheetSurface visible={open} presentationKey={`${scenario}:${serial}`} onClose={() => setOpen(false)} initialDetent={params.expanded === '1' ? 1 : 0}
      summary={<CheckResultView {...example} section="summary" />}>
      <CheckResultView {...example} section="findings">
        {scan && questions && (questions.intent || questions.texture) && <View style={{ gap: spacing.md }}>
          <Text>Optional demo-only questions. Answers update this fictional Check, aren’t saved, and don’t affect live Checks.</Text>
          {questions.intent && <QuestionGroup label="Replacing a product or adding a step?" support="Optional, for this Check only.">
            <View style={chips}>{([['replace', 'Replace'], ['add', 'Add'], ['not_sure', 'Not sure'], ['skipped', 'Skip intent']] as const).map(([value, label]) => <ChoiceChip key={value} label={label} selected={answers.intent === value} selectionType="single" onSelect={() => setAnswers(setPreviewIntent(answers, value))} />)}</View>
            {answers.intent === 'replace' && <QuestionGroup label="Which product would you replace?" support="Choose explicitly, or leave the target unknown.">
              <View style={chips}>{scan.products.map(product => <ChoiceChip key={product.id} label={product.label} selected={answers.targetId === product.id} selectionType="single" onSelect={() => setAnswers(setPreviewTarget(scan, answers, product.id))} />)}
                <ChoiceChip label="Target not sure" selected={answers.targetId === null} selectionType="single" onSelect={() => setAnswers(setPreviewTarget(scan, answers, null))} /></View>
            </QuestionGroup>}
            {answers.intent === 'replace' && selectedTarget && <QuestionGroup label={`How’s ${selectedTarget.label} working for you?`} support="Choose all that apply to this product. Optional demo feedback.">
              <View style={chips}>{currentFeedbackChoices(scan.category ?? undefined).map(([value, label]) => <ChoiceChip key={value} label={label} selected={answers.feedback.includes(value)} selectionType="multiple" onSelect={() => setAnswers(togglePreviewFeedback(answers, value))} />)}</View>
              <Button label="Clear product feedback" variant="ghost" onPress={() => setAnswers({ ...answers, feedback: [] })} />
            </QuestionGroup>}
          </QuestionGroup>}
          {questions.texture && <QuestionGroup label="Which texture would you prefer for this Check?" support="The fictional package supplies a texture description. Past product dislike doesn’t answer this.">
            <View style={chips}>{(scan.texture === 'rich' ? [['rich', 'Rich cream'], ['light', 'Light texture']] as const : [['cream', 'Non-foaming cream'], ['foaming', 'Foaming']] as const).map(([value, label]) => <ChoiceChip key={value} label={label} selected={answers.texture === value} selectionType="single" onSelect={() => setAnswers({ ...answers, texture: value })} />)}
              <ChoiceChip label="No preference" selected={answers.texture === 'no_preference'} selectionType="single" onSelect={() => setAnswers({ ...answers, texture: 'no_preference' })} />
              <ChoiceChip label="Skip texture" selected={answers.texture === 'skipped'} selectionType="single" onSelect={() => setAnswers({ ...answers, texture: 'skipped' })} /></View>
          </QuestionGroup>}
          <Button label="Clear Check answers" variant="ghost" onPress={() => setAnswers(createPreviewAnswers(`${scenario}:${serial}`))} />
        </View>}
      </CheckResultView>
    </ResultSheetSurface>
  </View>;
}
