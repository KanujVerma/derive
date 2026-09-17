import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StyleProp, ViewStyle, Keyboard, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, layout, spacing, typography } from '@/src/constants/theme';
import { Button, ButtonVariant } from '@/src/components/ui/Button';

interface StickyActionFooterProps {
  primaryLabel?: string;
  ctaLabel?: string;
  onPrimaryPress?: () => void;
  onPressCta?: () => void;
  primaryDisabled?: boolean;
  disabled?: boolean;
  primaryLoading?: boolean;
  loading?: boolean;
  primaryVariant?: ButtonVariant;
  secondaryLabel?: string;
  onSecondaryPress?: () => void;
  onPressSecondary?: () => void;
  secondaryDisabled?: boolean;
  helperText?: string;
  style?: StyleProp<ViewStyle>;
}

export const StickyActionFooter: React.FC<StickyActionFooterProps> = ({
  primaryLabel,
  ctaLabel,
  onPrimaryPress,
  onPressCta,
  primaryDisabled = false,
  disabled = false,
  primaryLoading = false,
  loading = false,
  primaryVariant = 'primary',
  secondaryLabel,
  onSecondaryPress,
  onPressSecondary,
  secondaryDisabled = false,
  helperText,
  style,
}) => {
  const insets = useSafeAreaInsets();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const label = ctaLabel || primaryLabel || 'Continue';
  const handlePrimary = onPressCta || onPrimaryPress || (() => {});
  const handleSecondary = onPressSecondary || onSecondaryPress;
  const isPrimaryDisabled = disabled || primaryDisabled;
  const isPrimaryLoading = loading || primaryLoading;

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false)
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  if (keyboardVisible) return null;

  return (
    <View
      style={[
        styles.container,
        { paddingBottom: Math.max(insets.bottom, spacing.md) },
        style,
      ]}
    >
      {helperText ? <Text style={styles.helperText}>{helperText}</Text> : null}

      <Button
        label={label}
        variant={primaryVariant}
        onPress={handlePrimary}
        disabled={isPrimaryDisabled}
        loading={isPrimaryLoading}
        style={styles.primaryButton}
      />

      {secondaryLabel && handleSecondary ? (
        <TouchableOpacity
          onPress={handleSecondary}
          disabled={secondaryDisabled}
          style={styles.secondaryButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel={secondaryLabel}
        >
          <Text style={styles.secondaryText}>{secondaryLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: layout.gutter,
    paddingTop: spacing.sm,
    backgroundColor: colors.canvas,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  primaryButton: {
    minHeight: layout.ctaHeight,
  },
  secondaryButton: {
    minHeight: layout.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  secondaryText: {
    fontSize: typography.sizes.bodyRegular,
    fontWeight: typography.weights.medium,
    color: colors.inkMuted,
  },
  helperText: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
});
