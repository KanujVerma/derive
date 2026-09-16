import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { colors, radii, typography, spacing } from '@/src/constants/theme';
import { RoutineAction } from '@/src/types/schema';

interface BadgeProps {
  action?: RoutineAction;
  label?: string;
  variant?: 'keep' | 'pause' | 'stop' | 'replace' | 'add' | 'safety' | 'neutral';
  style?: StyleProp<ViewStyle>;
  size?: 'small' | 'medium';
}

export const Badge: React.FC<BadgeProps> = ({
  action,
  label,
  variant,
  style,
  size = 'medium',
}) => {
  const resolvedVariant = variant || (action ? action.toLowerCase() : 'neutral');

  const getStyle = () => {
    switch (resolvedVariant) {
      case 'keep':
        return colors.actionKeep;
      case 'pause':
        return colors.actionPause;
      case 'stop':
        return colors.actionStop;
      case 'replace':
        return colors.actionReplace;
      case 'add':
        return colors.actionAdd;
      case 'safety':
        return colors.safetyAlert;
      default:
        return {
          text: colors.inkMuted,
          bg: colors.surfaceMuted,
          border: colors.border,
        };
    }
  };


  const currentStyle = getStyle();
  const displayLabel = label || (action ? action : 'STATUS');

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: currentStyle.bg,
          borderColor: currentStyle.border,
          paddingHorizontal: size === 'small' ? spacing.xs : spacing.sm,
          paddingVertical: size === 'small' ? 2 : spacing.xxs,
        },
        style,
      ]}
      accessible={true}
      accessibilityRole="text"
      accessibilityLabel={`Status: ${displayLabel}`}
    >
      <Text
        style={[
          styles.text,
          {
            color: currentStyle.text,
            fontSize: size === 'small' ? typography.sizes.micro : typography.sizes.caption,
          },
        ]}
      >
        {displayLabel}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignSelf: 'flex-start',
    borderRadius: radii.sm,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontWeight: typography.weights.bold,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
