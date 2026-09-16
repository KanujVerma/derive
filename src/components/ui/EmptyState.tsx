import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { colors, radii, typography, spacing } from '@/src/constants/theme';
import { Icon, IconName } from './Icon';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: IconName;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = 'sparkle',
  title,
  description,
  actionLabel,
  onAction,
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.iconCircle}>
        <Icon name={icon} size={28} color={colors.brand} />
      </View>

      <Text style={styles.title}>{title}</Text>

      {description && <Text style={styles.description}>{description}</Text>}

      {actionLabel && onAction && (
        <View style={styles.actionContainer}>
          <Button
            label={actionLabel}
            onPress={onAction}
            variant="secondary"
            size="medium"
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: radii.full,
    backgroundColor: colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.sizes.sectionTitle,
    lineHeight: typography.lineHeights.sectionTitle,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  description: {
    fontSize: typography.sizes.bodyRegular,
    lineHeight: typography.lineHeights.bodyRegular,
    color: colors.inkMuted,
    textAlign: 'center',
    maxWidth: 300,
  },
  actionContainer: {
    marginTop: spacing.lg,
  },
});
