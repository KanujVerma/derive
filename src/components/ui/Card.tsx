import React from 'react';
import {
  TouchableOpacity,
  View,
  StyleSheet,
  ViewStyle,
  StyleProp,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, radii, shadows, spacing } from '@/src/constants/theme';

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
  variant?: 'elevated' | 'muted' | 'outline' | 'flat' | 'borderless';
  padding?: keyof typeof spacing;
}

export const Card: React.FC<CardProps> = ({
  children,
  onPress,
  selected = false,
  style,
  variant = 'flat',
  padding = 'lg',
}) => {
  const handlePress = async () => {
    if (!onPress) return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    onPress();
  };

  const getBackgroundColor = () => {
    if (selected) return colors.brandLight;
    switch (variant) {
      case 'elevated':
        return colors.surface;
      case 'muted':
        return colors.surfaceMuted;
      case 'flat':
        return colors.surface;
      case 'borderless':
        return colors.surface;
      case 'outline':
        return 'transparent';
    }
  };

  const isBorderless = variant === 'borderless';
  const isElevated = variant === 'elevated';

  const containerStyle: ViewStyle = {
    backgroundColor: getBackgroundColor(),
    borderColor: selected ? colors.brand : isBorderless ? 'transparent' : colors.border,
    borderWidth: selected ? 2 : isBorderless ? 0 : 1,
    padding: spacing[padding],
    borderRadius: radii.lg,
    ...(isElevated ? shadows.card : shadows.subtle),
  };


  if (onPress) {
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={handlePress}
        style={[containerStyle, style]}
        accessible={true}
        accessibilityRole="button"
        accessibilityState={{ selected }}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={[containerStyle, style]}>{children}</View>;
};
