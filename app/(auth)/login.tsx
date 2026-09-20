import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { colors, typography, spacing, radii, shadows } from '@/src/constants/theme';
import { Button } from '@/src/components/ui/Button';
import { Icon } from '@/src/components/ui/Icon';
import { BuildDiagnostics } from '@/src/components/ui/BuildDiagnostics';
import { sendEmailOtp, isValidEmail } from '@/src/services/authClient';
import { getCustomerErrorMessage } from '@/src/utils/customerErrors';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async () => {
    Keyboard.dismiss();
    const trimmedEmail = email.trim().toLowerCase();

    if (!isValidEmail(trimmedEmail)) {
      setErrorMessage(getCustomerErrorMessage('auth_invalid_email'));
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } catch {}
      return;
    }

    setErrorMessage(null);
    setLoading(true);

    const result = await sendEmailOtp(trimmedEmail);
    setLoading(false);

    if (result.success) {
      router.push({
        pathname: '/(auth)/verify-otp',
        params: { email: trimmedEmail },
      });
    } else {
      setErrorMessage(result.error || getCustomerErrorMessage('auth_send_code'));
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } catch {}
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}
        >
          <View style={styles.content}>
            <View style={styles.brandRow}>
              <Image
                source={require('@/assets/logo.png')}
                style={styles.logoMark}
                resizeMode="contain"
              />
            </View>

            <Text style={styles.title}>Sign in to Derive</Text>
            <Text style={styles.subtitle}>
              Enter your email to receive a 6-digit access code. No password needed.
            </Text>

            {errorMessage && (
              <View style={styles.errorCard}>
                <Icon name="info" size={16} color={colors.actionPause.text} />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>EMAIL ADDRESS</Text>
              <TextInput
                style={styles.input}
                placeholder="name@example.com"
                placeholderTextColor={colors.inkSubtle}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (errorMessage) setErrorMessage(null);
                }}
                onSubmitEditing={handleSubmit}
                returnKeyType="send"
                editable={!loading}
              />
            </View>
          </View>

          <View style={styles.footer}>
            <Button
              label={loading ? 'Sending code...' : 'Continue with Email'}
              onPress={handleSubmit}
              loading={loading}
              disabled={!email.trim() || loading}
              size="large"
            />
            <BuildDiagnostics />
          </View>
        </KeyboardAvoidingView>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  keyboardView: {
    flex: 1,
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  brandRow: {
    marginBottom: spacing.xl,
  },
  logoMark: {
    width: 38,
    height: 38,
  },
  title: {
    fontFamily: typography.fontFamilies.serif,
    fontSize: typography.sizes.screenTitle,
    lineHeight: typography.lineHeights.screenTitle,
    color: colors.ink,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: typography.sizes.bodyRegular,
    lineHeight: typography.lineHeights.bodyRegular,
    color: colors.inkMuted,
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.actionPause.bg,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  errorText: {
    flex: 1,
    fontSize: typography.sizes.caption,
    color: colors.actionPause.text,
    fontWeight: typography.weights.medium,
  },
  inputContainer: {
    gap: spacing.xs,
  },
  inputLabel: {
    fontSize: typography.sizes.micro,
    fontWeight: typography.weights.bold,
    color: colors.inkMuted,
    letterSpacing: 0.5,
  },
  input: {
    height: 52,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    fontSize: typography.sizes.bodyRegular,
    color: colors.ink,
    ...shadows.subtle,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
});
