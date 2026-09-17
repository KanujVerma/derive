import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { colors, typography, spacing, radii, shadows } from '@/src/constants/theme';
import { useOnboardingStore } from '@/src/stores/onboardingStore';
import { CameraCapture } from '@/src/components/ui/CameraCapture';
import { Button } from '@/src/components/ui/Button';
import { Icon } from '@/src/components/ui/Icon';
import { VoiceTextArea } from '@/src/components/ui/VoiceTextArea';
import { StickyActionFooter } from '@/src/components/ui/StickyActionFooter';

type AngleKey = 'front' | 'left' | 'right';

interface AngleConfig {
  key: AngleKey;
  title: string;
  stepNum: number;
  instruction: string;
  subtext: string;
}

const ANGLES: AngleConfig[] = [
  {
    key: 'front',
    title: 'Front View',
    stepNum: 1,
    instruction: 'Look straight ahead in clear, even light',
    subtext: 'Keeps focus on forehead, nose, and chin texture',
  },
  {
    key: 'left',
    title: 'Left Profile',
    stepNum: 2,
    instruction: 'Turn head slightly to show your left cheek',
    subtext: 'Captures side cheek and jawline clarity',
  },
  {
    key: 'right',
    title: 'Right Profile',
    stepNum: 3,
    instruction: 'Turn head slightly to show your right cheek',
    subtext: 'Captures right cheek, jawline, and texture clarity',
  },
];

export default function SkinPhotosScreen() {
  const router = useRouter();
  const {
    frontPhotoUri,
    leftPhotoUri,
    rightPhotoUri,
    photoContextNote,
    setPhotoContextNote,
    setSkinPhotos,
  } = useOnboardingStore();

  const [currentStepIndex, setCurrentStepIndex] = useState<number>(() => {
    if (!frontPhotoUri) return 0;
    if (!leftPhotoUri) return 1;
    if (!rightPhotoUri) return 2;
    return 0;
  });
  const [isCameraActive, setIsCameraActive] = useState(false);

  const currentAngle = ANGLES[currentStepIndex];

  const getPhotoUri = (key: AngleKey): string | null => {
    switch (key) {
      case 'front':
        return frontPhotoUri;
      case 'left':
        return leftPhotoUri;
      case 'right':
        return rightPhotoUri;
    }
  };

  const currentUri = getPhotoUri(currentAngle.key);
  const allCaptured = !!(frontPhotoUri && leftPhotoUri && rightPhotoUri);
  const capturedCount = [frontPhotoUri, leftPhotoUri, rightPhotoUri].filter(Boolean).length;

  const handleCapture = (uri: string) => {
    setIsCameraActive(false);
    if (currentAngle.key === 'front') setSkinPhotos({ front: uri });
    if (currentAngle.key === 'left') setSkinPhotos({ left: uri });
    if (currentAngle.key === 'right') setSkinPhotos({ right: uri });

    // Auto-advance to next uncaptured angle
    if (currentStepIndex < 2) {
      setCurrentStepIndex(currentStepIndex + 1);
    }
  };

  const handleSelectAngleStep = (index: number) => {
    Haptics.selectionAsync();
    setCurrentStepIndex(index);
  };

  const handleContinue = () => {
    if (!allCaptured) return;
    router.push('/(onboarding)/9-clarification');
  };

  if (isCameraActive) {
    return (
      <CameraCapture
        type="face"
        stepBadge={`STEP ${currentAngle.stepNum} OF 3: ${currentAngle.title.toUpperCase()}`}
        instruction={currentAngle.instruction}
        subtext="Good even lighting • No filters"
        onCapture={handleCapture}
        onCancel={() => setIsCameraActive(false)}
      />
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.questionTitle}>Baseline Skin Photos</Text>
        <Text style={styles.questionSubtitle}>
          These photos establish your visible baseline and help us compare changes over time.
        </Text>

        {/* STEP PROGRESS TRACKER: Front → Left → Right */}
        <View style={styles.stepTracker}>
          {ANGLES.map((angle, idx) => {
            const uri = getPhotoUri(angle.key);
            const isSelected = idx === currentStepIndex;
            const isDone = !!uri;

            return (
              <TouchableOpacity
                key={angle.key}
                onPress={() => handleSelectAngleStep(idx)}
                activeOpacity={0.7}
                style={[
                  styles.stepPill,
                  isSelected && styles.stepPillSelected,
                  isDone && !isSelected && styles.stepPillDone,
                ]}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={`${angle.title}, step ${angle.stepNum} of 3, ${isDone ? 'completed' : 'pending'}`}
              >
                {isDone ? (
                  <Icon
                    name="check"
                    size={12}
                    color={isSelected ? colors.inkInverse : colors.brand}
                  />
                ) : (
                  <Text
                    style={[
                      styles.stepPillNum,
                      isSelected && styles.stepPillNumSelected,
                    ]}
                  >
                    {angle.stepNum}
                  </Text>
                )}
                <Text
                  style={[
                    styles.stepPillLabel,
                    isSelected && styles.stepPillLabelSelected,
                    isDone && !isSelected && styles.stepPillLabelDone,
                  ]}
                >
                  {angle.title}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* CURRENT ANGLE FOCUS CARD */}
        <View style={styles.currentCard}>
          <View style={styles.currentCardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.currentStepBadge}>
                STEP {currentAngle.stepNum} OF 3
              </Text>
              <Text style={styles.currentAngleTitle}>{currentAngle.title}</Text>
              <Text style={styles.currentAngleInstruction}>
                {currentAngle.instruction}
              </Text>
            </View>
          </View>

          {/* PREVIEW OR VIEWPORT */}
          {currentUri ? (
            <View style={styles.previewContainer}>
              <Image source={{ uri: currentUri }} style={styles.capturedImage} />
              <View style={styles.capturedOverlay}>
                <Button
                  label="Retake"
                  variant="outline"
                  size="small"
                  icon={<Icon name="camera" size={14} color={colors.ink} />}
                  onPress={() => setIsCameraActive(true)}
                  style={styles.retakeButton}
                />
              </View>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setIsCameraActive(true);
              }}
              activeOpacity={0.8}
              style={styles.cameraPlaceholder}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={`Open camera for ${currentAngle.title}`}
            >
              <View style={styles.cameraCircle}>
                <Icon name="camera" size={28} color={colors.brand} />
              </View>
              <Text style={styles.cameraPromptTitle}>Take {currentAngle.title}</Text>
              <Text style={styles.cameraPromptSub}>{currentAngle.subtext}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* OPTIONAL CONTEXT NOTE WITH VOICE */}
        <VoiceTextArea
          label="Anything unusual about these photos? (Optional)"
          value={photoContextNote}
          onChangeText={setPhotoContextNote}
          placeholder="e.g. slight flaking around nose from sun yesterday..."
          context="photo_note"
          minHeight={80}
        />

        {/* PRIVACY REASSURANCE */}
        <View style={styles.privacyCard}>
          <Icon name="lock" size={18} color={colors.brand} />
          <View style={{ flex: 1 }}>
            <Text style={styles.privacyTitle}>Private Skincare Data</Text>
            <Text style={styles.privacyText}>
              We treat your skin photos as private skincare data. They are used to calibrate routine adjustments and monitor visible progress over time.
            </Text>
          </View>
        </View>
      </ScrollView>

      <StickyActionFooter
        ctaLabel={allCaptured ? 'Continue to Review' : `Take All 3 Photos (${capturedCount}/3)`}
        onPressCta={handleContinue}
        disabled={!allCaptured}
        helperText={!allCaptured ? 'Front, left, and right photos are required for your baseline.' : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl + 100,
  },
  questionTitle: {
    fontFamily: typography.fontFamilies.serif,
    fontSize: typography.sizes.screenTitle,
    lineHeight: typography.lineHeights.screenTitle,
    color: colors.ink,
    marginBottom: spacing.xxs,
  },
  questionSubtitle: {
    fontSize: typography.sizes.bodyRegular,
    color: colors.inkMuted,
    lineHeight: typography.lineHeights.bodyRegular,
    marginBottom: spacing.md,
  },
  stepTracker: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  stepPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  stepPillSelected: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  stepPillDone: {
    borderColor: colors.brandLight,
    backgroundColor: colors.brandLight,
  },
  stepPillNum: {
    fontSize: typography.sizes.micro,
    fontWeight: typography.weights.bold,
    color: colors.inkMuted,
  },
  stepPillNumSelected: {
    color: colors.inkInverse,
  },
  stepPillLabel: {
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.medium,
    color: colors.ink,
  },
  stepPillLabelSelected: {
    color: colors.inkInverse,
    fontWeight: typography.weights.bold,
  },
  stepPillLabelDone: {
    color: colors.brand,
  },
  currentCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  currentCardHeader: {
    marginBottom: spacing.md,
  },
  currentStepBadge: {
    fontSize: typography.sizes.micro,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.8,
    color: colors.brand,
    marginBottom: 2,
  },
  currentAngleTitle: {
    fontSize: typography.sizes.sectionTitle,
    fontWeight: typography.weights.bold,
    color: colors.ink,
    marginBottom: 4,
  },
  currentAngleInstruction: {
    fontSize: typography.sizes.bodyRegular,
    color: colors.inkMuted,
    lineHeight: typography.lineHeights.bodyRegular,
  },
  previewContainer: {
    position: 'relative',
    height: 220,
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  capturedImage: {
    width: '100%',
    height: '100%',
  },
  capturedOverlay: {
    position: 'absolute',
    bottom: spacing.sm,
    right: spacing.sm,
  },
  retakeButton: {
    backgroundColor: 'rgba(255, 254, 251, 0.92)',
  },
  cameraPlaceholder: {
    height: 180,
    backgroundColor: colors.canvas,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  cameraCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  cameraPromptTitle: {
    fontSize: typography.sizes.bodyRegular,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    marginBottom: 2,
  },
  cameraPromptSub: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
    textAlign: 'center',
  },
  privacyCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md,
    borderRadius: radii.md,
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  privacyTitle: {
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    marginBottom: 2,
  },
  privacyText: {
    fontSize: typography.sizes.micro,
    color: colors.inkMuted,
    lineHeight: typography.lineHeights.caption,
  },
});
