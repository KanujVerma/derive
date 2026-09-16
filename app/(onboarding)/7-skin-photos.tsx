import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { colors, typography, spacing, radii, shadows } from '@/src/constants/theme';
import { useOnboardingStore } from '@/src/stores/onboardingStore';
import { CameraCapture } from '@/src/components/ui/CameraCapture';
import { Button } from '@/src/components/ui/Button';
import { Icon } from '@/src/components/ui/Icon';
import { VoiceInputButton } from '@/src/components/ui/VoiceInputButton';

type Angle = 'front' | 'left' | 'right';

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

  const [activeCameraAngle, setActiveCameraAngle] = useState<Angle | null>(null);

  const handleCapturePhoto = (uri: string) => {
    if (activeCameraAngle === 'front') setSkinPhotos({ front: uri });
    if (activeCameraAngle === 'left') setSkinPhotos({ left: uri });
    if (activeCameraAngle === 'right') setSkinPhotos({ right: uri });
    setActiveCameraAngle(null);
  };

  const angles: Array<{ key: Angle; label: string; uri: string | null; prompt: string }> = [
    {
      key: 'front',
      label: 'Front View',
      uri: frontPhotoUri,
      prompt: 'Center your full face looking straight ahead',
    },
    {
      key: 'left',
      label: 'Left Profile',
      uri: leftPhotoUri,
      prompt: 'Turn your head slightly to the right to capture left cheek',
    },
    {
      key: 'right',
      label: 'Right Profile',
      uri: rightPhotoUri,
      prompt: 'Turn your head slightly to the left to capture right cheek',
    },
  ];

  if (activeCameraAngle) {
    const currentAngle = angles.find((a) => a.key === activeCameraAngle);
    return (
      <CameraCapture
        type="face"
        instruction={currentAngle?.prompt || 'Center your face in the oval'}
        subtext="Good even light • No filters • Clean skin if practical"
        onCapture={handleCapturePhoto}
        onCancel={() => setActiveCameraAngle(null)}
      />
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.questionTitle}>Guided Skin Photos</Text>
        <Text style={styles.questionSubtitle}>
          Three quick baseline photos help Derive understand visible redness, texture, and compare your progress over time.
        </Text>

        {/* PRIVACY GUARANTEE */}
        <View style={styles.privacyCard}>
          <View style={styles.lockIconContainer}>
            <Icon name="lock" size={18} color={colors.brand} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.privacyTitle}>Private & Protected</Text>
            <Text style={styles.privacyText}>
              Your photos are securely stored with encryption. They are never shared publicly or used for advertising.
            </Text>
          </View>
        </View>

        {/* 3 PHOTO ANGLE CARDS */}
        <View style={styles.anglesRow}>
          {angles.map((item) => (
            <TouchableOpacity
              key={item.key}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setActiveCameraAngle(item.key);
              }}
              activeOpacity={0.8}
              style={[styles.angleCard, item.uri && styles.angleCardCaptured]}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={`Capture ${item.label}`}
            >
              {item.uri ? (
                <Image source={{ uri: item.uri }} style={styles.thumbnail} />
              ) : (
                <View style={styles.placeholderContainer}>
                  <Icon name="camera" size={24} color={colors.inkMuted} />
                  <Text style={styles.captureCta}>Take Photo</Text>
                </View>
              )}
              <View style={styles.angleLabelContainer}>
                <Text style={styles.angleLabel}>{item.label}</Text>
                {item.uri && <Icon name="check" size={14} color={colors.brand} />}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* OPTIONAL PHOTO CONTEXT NOTE */}
        <View style={styles.contextCard}>
          <View style={styles.contextHeaderRow}>
            <Text style={styles.contextTitle}>
              Anything unusual about these photos? (Optional)
            </Text>
            <VoiceInputButton
              context="photo_note"
              size={32}
              onTranscript={(transcribed) => {
                setPhotoContextNote(
                  photoContextNote ? `${photoContextNote} ${transcribed}` : transcribed
                );
              }}
            />
          </View>
          <TextInput
            style={styles.contextInput}
            value={photoContextNote}
            onChangeText={setPhotoContextNote}
            placeholder="e.g., warm bathroom light, active flare-up started yesterday, skin feels unusually tight..."
            placeholderTextColor={colors.inkSubtle}
            multiline
            numberOfLines={3}
          />
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <Button
          label="Continue to Review"
          variant="primary"
          size="large"
          onPress={() => router.push('/(onboarding)/10-summary')}
        />
        <Button
          label="Skip photos for now"
          variant="ghost"
          size="medium"
          onPress={() => router.push('/(onboarding)/10-summary')}
          style={{ marginTop: spacing.xs }}
        />
      </View>
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
    paddingBottom: spacing.xxl + 40,
  },
  questionTitle: {
    fontSize: typography.sizes.screenTitle,
    fontWeight: typography.weights.bold,
    color: colors.ink,
    marginBottom: spacing.xxs,
  },
  questionSubtitle: {
    fontSize: typography.sizes.bodyRegular,
    color: colors.inkMuted,
    lineHeight: typography.lineHeights.bodyRegular,
    marginBottom: spacing.lg,
  },
  privacyCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xl,
    gap: spacing.sm,
    ...shadows.subtle,
  },
  lockIconContainer: {
    width: 28,
    height: 28,
    borderRadius: radii.full,
    backgroundColor: colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },

  privacyTitle: {
    fontSize: typography.sizes.bodyRegular,
    fontWeight: typography.weights.bold,
    color: colors.ink,
    marginBottom: 2,
  },
  privacyText: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
    lineHeight: typography.lineHeights.caption,
  },
  anglesRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  angleCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    aspectRatio: 0.75,
    overflow: 'hidden',
    justifyContent: 'space-between',
    ...shadows.card,
  },
  angleCardCaptured: {
    borderColor: colors.brand,
  },
  placeholderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xs,
  },
  cameraGlyph: {
    fontSize: 28,
    marginBottom: 4,
  },
  captureCta: {
    fontSize: typography.sizes.micro,
    color: colors.brand,
    fontWeight: typography.weights.bold,
  },
  thumbnail: {
    width: '100%',
    flex: 1,
    resizeMode: 'cover',
  },
  angleLabelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.xs,
    paddingVertical: 6,
  },
  angleLabel: {
    fontSize: typography.sizes.micro,
    fontWeight: typography.weights.bold,
    color: colors.ink,
  },
  checkedCheck: {
    fontSize: 12,
    color: colors.brand,
    fontWeight: typography.weights.bold,
  },
  bottomBar: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    backgroundColor: colors.canvas,
  },
  contextCard: {
    marginTop: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  contextHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  contextTitle: {
    flex: 1,
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
  },
  contextInput: {
    fontSize: typography.sizes.bodyRegular,
    color: colors.ink,
    minHeight: 64,
    textAlignVertical: 'top',
    paddingTop: spacing.xs,
  },
});
