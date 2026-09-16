import React from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, typography, spacing, radii, shadows } from '@/src/constants/theme';
import { Button } from '@/src/components/ui/Button';
import { Icon } from '@/src/components/ui/Icon';
import { analytics } from '@/src/services/analytics';

export default function WelcomeScreen() {
  const router = useRouter();

  const handleStart = () => {
    analytics.track('onboarding_started', { entryPoint: 'welcome_cta' });
    router.push('/(onboarding)/2-goals');
  };

  const handleAssistedSetup = () => {
    analytics.track('onboarding_started', { entryPoint: 'founder_assist' });
    Alert.alert(
      'Assisted Onboarding',
      'Prefer a personal touch? We can walk through your routine over a 10-minute call or chat. Send a quick email to concierge@derive.skin or continue self-serve.',
      [
        { text: 'Continue Self-Serve', style: 'cancel' },
        { text: 'Start Setup', onPress: () => router.push('/(onboarding)/2-goals') },
      ]
    );
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.content}>
        <View style={styles.brandRow}>
          <Image
            source={require('@/assets/logo.png')}
            style={styles.logoMark}
            resizeMode="contain"
          />
        </View>

        <Text style={styles.headline}>Let's get to know your skin.</Text>

        <Text style={styles.bodyText}>
          We will look at your goals, review what you are currently using, and build a calm, tailored plan around your skin.
        </Text>

        <View style={styles.featureCard}>
          <View style={styles.featureRow}>
            <View style={styles.iconCircle}>
              <Icon name="progress" size={18} color={colors.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.featureTitle}>About 4 minutes</Text>
              <Text style={styles.featureDesc}>Complete in one sitting or pick up where you left off.</Text>
            </View>
          </View>

          <View style={styles.featureRow}>
            <View style={styles.iconCircle}>
              <Icon name="lock" size={18} color={colors.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.featureTitle}>Private & Encrypted</Text>
              <Text style={styles.featureDesc}>Your skin photos and routine notes are strictly confidential and never shared.</Text>
            </View>
          </View>

          <View style={styles.featureRow}>
            <View style={styles.iconCircle}>
              <Icon name="person" size={18} color={colors.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.featureTitle}>Human-checked before your first plan</Text>
              <Text style={styles.featureDesc}>Your initial routine receives a final manual quality check before it goes live.</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.actions}>
        <Button
          label="Get Started"
          variant="primary"
          size="large"
          onPress={handleStart}
        />
        <Button
          label="Want help setting this up?"
          variant="ghost"
          size="medium"
          onPress={handleAssistedSetup}
          style={{ marginTop: spacing.xs }}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  logoMark: {
    width: 42,
    height: 42,
  },
  badgeContainer: {
    alignSelf: 'center',
    backgroundColor: colors.brandLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  badgeText: {
    fontSize: typography.sizes.micro,
    fontWeight: typography.weights.bold,
    color: colors.brand,
    letterSpacing: 0.8,
  },
  headline: {
    fontFamily: typography.fontFamilies.serif,
    fontSize: typography.sizes.display,
    lineHeight: typography.lineHeights.display,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  bodyText: {
    fontSize: typography.sizes.bodyRegular,
    lineHeight: typography.lineHeights.bodyRegular,
    color: colors.inkMuted,
    marginBottom: spacing.xl,
  },
  featureCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    ...shadows.subtle,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    backgroundColor: colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTitle: {
    fontSize: typography.sizes.bodyRegular,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    marginBottom: 2,
  },
  featureDesc: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
    lineHeight: 18,
  },
  actions: {
    gap: spacing.xs,
    paddingTop: spacing.lg,
  },
});
