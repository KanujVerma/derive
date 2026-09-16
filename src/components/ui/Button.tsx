import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  StyleProp,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, radii, typography, spacing } from '@/src/constants/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'brand';
export type ButtonSize = 'small' | 'medium' | 'large';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  accessibilityHint?: string;
}

export const Button: React.FC<ButtonProps> = ({
  label,
  onPress,
  variant = 'primary',
  size = 'large',
  loading = false,
  disabled = false,
  icon,
  iconPosition = 'left',
  style,
  textStyle,
  accessibilityHint,
}) => {
  const handlePress = async () => {
    if (disabled || loading) return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // Ignore if haptics unavailable
    }
    onPress();
  };

  const getContainerStyle = () => {
    const isSmall = size === 'small';
    const isLarge = size === 'large';
    const baseHeight = isSmall ? 36 : isLarge ? 54 : 46;
    const basePadding = isSmall ? spacing.sm : isLarge ? spacing.xl : spacing.md;

    switch (variant) {
      case 'primary':
        return {
          backgroundColor: colors.ink,
          height: baseHeight,
          paddingHorizontal: basePadding,
        };
      case 'brand':
        return {
          backgroundColor: colors.brand,
          height: baseHeight,
          paddingHorizontal: basePadding,
        };
      case 'secondary':
        return {
          backgroundColor: colors.brandLight,
          height: baseHeight,
          paddingHorizontal: basePadding,
        };
      case 'outline':
        return {
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderColor: colors.border,
          height: baseHeight,
          paddingHorizontal: basePadding,
        };
      case 'ghost':
        return {
          backgroundColor: 'transparent',
          height: baseHeight - 4,
          paddingHorizontal: spacing.sm,
        };
    }
  };

  const getTextColor = () => {
    if (disabled) return colors.inkSubtle;
    switch (variant) {
      case 'primary':
      case 'brand':
        return colors.inkInverse;
      case 'secondary':
        return colors.brand;
      case 'outline':
        return colors.ink;
      case 'ghost':
        return colors.inkMuted;
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={handlePress}
      disabled={disabled || loading}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: disabled || loading }}
      style={[
        styles.base,
        getContainerStyle(),
        disabled && styles.disabledContainer,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={getTextColor()} size="small" />
      ) : (
        <>
          {icon && iconPosition === 'left' && <>{icon}</>}
          <Text
            style={[
              styles.text,
              size === 'large'
                ? styles.textLarge
                : size === 'small'
                ? styles.textSmall
                : styles.textMedium,
              { color: getTextColor() },
              textStyle,
            ]}
          >
            {label}
          </Text>
          {icon && iconPosition === 'right' && <>{icon}</>}
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  text: {
    fontWeight: typography.weights.semibold,
    textAlign: 'center',
  },
  textLarge: {
    fontSize: typography.sizes.bodyLarge,
    lineHeight: typography.lineHeights.bodyLarge,
  },
  textMedium: {
    fontSize: typography.sizes.bodyRegular,
    lineHeight: typography.lineHeights.bodyRegular,
  },
  textSmall: {
    fontSize: typography.sizes.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.medium,
  },
  disabledContainer: {
    opacity: 0.45,
  },
});
