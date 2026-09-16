import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { colors, typography, radii, spacing } from '@/src/constants/theme';

export type StatusBadgeVariant =
  | 'keep'
  | 'pause'
  | 'replace'
  | 'add'
  | 'stop'
  | 'review'
  | 'active'
  | 'alert'
  | 'info';

interface StatusBadgeProps {
  label: string;
  variant?: StatusBadgeVariant;
  size?: 'small' | 'medium';
  style?: StyleProp<ViewStyle>;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  label,
  variant = 'keep',
  size = 'small',
  style,
}) => {
  const getColors = () => {
    switch (variant) {
      case 'keep':
      case 'active':
        return colors.actionKeep;
      case 'pause':
        return colors.actionPause;
      case 'stop':
        return colors.actionStop;
      case 'replace':
        return colors.actionReplace;
      case 'add':
        return colors.actionAdd;
      case 'review':
        return colors.actionReview;
      case 'alert':
        return colors.safetyAlert;
      case 'info':
        return {
          text: colors.inkMuted,
          bg: colors.surfaceMuted,
          border: colors.border,
        };
    }
  };

  const badgeColors = getColors();
  const isSmall = size === 'small';

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: badgeColors.bg,
          borderColor: badgeColors.border,
          paddingHorizontal: isSmall ? spacing.xs : spacing.sm,
          paddingVertical: isSmall ? 3 : 5,
        },
        style,
      ]}
      accessibilityRole="text"
      accessibilityLabel={`Status: ${label}`}
    >
      <Text
        style={[
          styles.label,
          {
            color: badgeColors.text,
            fontSize: isSmall ? typography.sizes.micro : typography.sizes.caption,
            lineHeight: isSmall ? typography.lineHeights.micro : typography.lineHeights.caption,
          },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    borderRadius: radii.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontWeight: typography.weights.bold,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
