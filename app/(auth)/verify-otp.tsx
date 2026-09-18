import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  TouchableOpacity,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { colors, typography, spacing, radii, shadows } from '@/src/constants/theme';
import { Button } from '@/src/components/ui/Button';
import { Icon } from '@/src/components/ui/Icon';
import { verifyEmailOtp, sendEmailOtp, isValidOtpToken } from '@/src/services/authClient';
import { isRemoteServiceEnabled } from '@/src/services/DeriveService';
import { resolveAuthRoute } from '@/src/utils/authRouting';
import { getCustomerErrorMessage } from '@/src/utils/customerErrors';

const RESEND_COOLDOWN_SECONDS = 30;

export default function VerifyOtpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ email?: string }>();
  const email = (params.email || '').trim().toLowerCase();

  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    // Focus input on mount
    const timeout = setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  const handleVerify = async (codeToVerify?: string) => {
    Keyboard.dismiss();
    const token = (codeToVerify !== undefined ? codeToVerify : otp).trim();

    if (!isValidOtpToken(token)) {
      setErrorMessage(getCustomerErrorMessage('auth_invalid_otp'));
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } catch {}
      return;
    }

    setErrorMessage(null);
    setLoading(true);

    const result = await verifyEmailOtp(email, token);
    setLoading(false);

    if (result.success) {
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
      const destination = resolveAuthRoute({
        remoteEnabled: isRemoteServiceEnabled(),
        authStatus: 'SIGNED_IN',
        isOnboardingCompleted: false,
      });
      if (destination.route) {
        router.replace(destination.route);
      }
    } else {
      setErrorMessage(result.error || getCustomerErrorMessage('auth_invalid_otp'));
      setOtp('');
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } catch {}
      inputRef.current?.focus();
    }
  };

  const handleOtpChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '').slice(0, 6);
    setOtp(cleaned);
    if (errorMessage) setErrorMessage(null);

    if (cleaned.length === 6) {
      handleVerify(cleaned);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending || !email) return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    setResending(true);
    setErrorMessage(null);
    const result = await sendEmailOtp(email);
    setResending(false);

    if (result.success) {
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } else {
      setErrorMessage(result.error || getCustomerErrorMessage('auth_send_code'));
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
            <View style={styles.headerRow}>
              <TouchableOpacity
                onPress={() => router.back()}
                style={styles.backButton}
                accessibilityRole="button"
                accessibilityLabel="Back to login"
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Icon name="back" size={18} color={colors.ink} />
              </TouchableOpacity>
            </View>

            <Text style={styles.title}>Enter access code</Text>
            <Text style={styles.subtitle}>
              We sent a 6-digit code to{' '}
              <Text style={styles.emailHighlight}>{email || 'your email'}</Text>.
            </Text>

            {errorMessage && (
              <View style={styles.errorCard}>
                <Icon name="info" size={16} color={colors.actionPause.text} />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>6-DIGIT CODE</Text>
              <TextInput
                ref={inputRef}
                style={styles.otpInput}
                placeholder="000000"
                placeholderTextColor={colors.inkSubtle}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
                maxLength={6}
                value={otp}
                onChangeText={handleOtpChange}
                editable={!loading}
              />
            </View>

            <View style={styles.resendRow}>
              <TouchableOpacity
                onPress={handleResend}
                disabled={cooldown > 0 || resending}
                accessibilityRole="button"
                style={styles.resendButton}
              >
                <Text
                  style={[
                    styles.resendText,
                    cooldown > 0 && styles.resendTextDisabled,
                  ]}
                >
                  {resending
                    ? 'Sending...'
                    : cooldown > 0
                    ? `Resend code in ${cooldown}s`
                    : 'Resend code'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.footer}>
            <Button
              label={loading ? 'Verifying...' : 'Verify & Continue'}
              onPress={() => handleVerify()}
              loading={loading}
              disabled={otp.trim().length !== 6 || loading}
              size="large"
            />
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
    paddingTop: spacing.sm,
  },
  headerRow: {
    marginBottom: spacing.md,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
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
  emailHighlight: {
    fontWeight: typography.weights.semibold,
    color: colors.ink,
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
  otpInput: {
    height: 56,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    fontSize: 28,
    fontWeight: typography.weights.bold,
    letterSpacing: 8,
    textAlign: 'center',
    color: colors.ink,
    ...shadows.subtle,
  },
  resendRow: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  resendButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  resendText: {
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.semibold,
    color: colors.brand,
  },
  resendTextDisabled: {
    color: colors.inkSubtle,
    fontWeight: typography.weights.regular,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
});
