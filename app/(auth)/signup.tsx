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
  Pressable,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { colors, typography, spacing, radii, shadows } from '@/src/constants/theme';
import { Button } from '@/src/components/ui/Button';
import { Icon } from '@/src/components/ui/Icon';
import { BuildDiagnostics } from '@/src/components/ui/BuildDiagnostics';
import { createPasswordAccount } from '@/src/services/authClient';
import { isRemoteServiceEnabled } from '@/src/services/DeriveService';
import { useBootstrapStore } from '@/src/stores/bootstrapStore';
import { useAuthStore } from '@/src/stores/authStore';
import { resolveAuthRoute } from '@/src/utils/authRouting';
import { getCustomerErrorMessage } from '@/src/utils/customerErrors';

export default function SignupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const clearError = () => {
    if (errorMessage) setErrorMessage(null);
  };

  const handleSubmit = async () => {
    Keyboard.dismiss();
    setErrorMessage(null);
    setLoading(true);

    const result = await createPasswordAccount({
      firstName,
      lastName,
      email,
      password,
    });
    setLoading(false);

    if (result.success) {
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
      const destination = resolveAuthRoute({
        remoteEnabled: isRemoteServiceEnabled(),
        authStatus: 'SIGNED_IN',
        isOnboardingCompleted: false,
        profileResolution: useBootstrapStore.getState().status,
        sessionUserId: useAuthStore.getState().sessionUserId,
        resolvedUserId: useBootstrapStore.getState().resolvedUserId,
        bootstrapState: useBootstrapStore.getState().bootstrapState,
      });
      if (destination.route) {
        router.replace(destination.route);
      }
    } else {
      setErrorMessage(result.error || getCustomerErrorMessage('auth_signup'));
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } catch {}
    }
  };

  const canSubmit = Boolean(
    firstName.trim() && lastName.trim() && email.trim() && password && !loading
  );

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.brandRow}>
              <Image
                source={require('@/assets/logo.png')}
                style={styles.logoMark}
                resizeMode="contain"
              />
            </View>

            <Text style={styles.title}>Create your account</Text>
            <Text style={styles.subtitle}>
              Use your name, email, and a password. Derive will keep you signed in on this device.
            </Text>

            {errorMessage && (
              <View style={styles.errorCard}>
                <Icon name="info" size={16} color={colors.actionPause.text} />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>FIRST NAME</Text>
              <TextInput
                style={styles.input}
                placeholder="First name"
                placeholderTextColor={colors.inkSubtle}
                autoCapitalize="words"
                autoCorrect={false}
                autoComplete="given-name"
                textContentType="givenName"
                value={firstName}
                onChangeText={(text) => {
                  setFirstName(text);
                  clearError();
                }}
                returnKeyType="next"
                editable={!loading}
              />
            </View>

            <View style={[styles.inputContainer, styles.followingField]}>
              <Text style={styles.inputLabel}>LAST NAME</Text>
              <TextInput
                style={styles.input}
                placeholder="Last name"
                placeholderTextColor={colors.inkSubtle}
                autoCapitalize="words"
                autoCorrect={false}
                autoComplete="family-name"
                textContentType="familyName"
                value={lastName}
                onChangeText={(text) => {
                  setLastName(text);
                  clearError();
                }}
                returnKeyType="next"
                editable={!loading}
              />
            </View>

            <View style={[styles.inputContainer, styles.followingField]}>
              <Text style={styles.inputLabel}>EMAIL ADDRESS</Text>
              <TextInput
                style={styles.input}
                placeholder="name@example.com"
                placeholderTextColor={colors.inkSubtle}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="username"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  clearError();
                }}
                returnKeyType="next"
                editable={!loading}
              />
            </View>

            <View style={[styles.inputContainer, styles.followingField]}>
              <Text style={styles.inputLabel}>PASSWORD</Text>
              <TextInput
                style={styles.input}
                placeholder="At least 8 characters"
                placeholderTextColor={colors.inkSubtle}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
                textContentType="newPassword"
                passwordRules="minlength: 8;"
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  clearError();
                }}
                onSubmitEditing={handleSubmit}
                returnKeyType="go"
                editable={!loading}
              />
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Button
              label={loading ? 'Creating account...' : 'Create Account'}
              onPress={handleSubmit}
              loading={loading}
              disabled={!canSubmit}
              size="large"
            />
            <Pressable
              onPress={() => router.replace('/(auth)/login')}
              disabled={loading}
              accessibilityRole="link"
              style={styles.signinLink}
            >
              <Text style={styles.signinLinkText}>Already have an account? Sign in</Text>
            </Pressable>
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
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
  followingField: {
    marginTop: spacing.md,
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
  signinLink: {
    alignItems: 'center',
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },
  signinLinkText: {
    fontSize: typography.sizes.bodyRegular,
    color: colors.brand,
    fontWeight: typography.weights.medium,
  },
});
