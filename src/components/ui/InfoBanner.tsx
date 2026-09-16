import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { colors, radii, typography, spacing } from '@/src/constants/theme';
import { Icon, IconName } from './Icon';

export type InfoBannerVariant = 'info' | 'review' | 'alert' | 'success';

interface InfoBannerProps {
  title?: string;
  message: string;
  variant?: InfoBannerVariant;
  actionLabel?: string;
  onAction?: () => void;
  icon?: IconName;
  dismissible?: boolean;
  onDismiss?: () => void;
  style?: StyleProp<ViewStyle>;
}

export const InfoBanner: React.FC<InfoBannerProps> = ({
  title,
  message,
  variant = 'info',
  actionLabel,
  onAction,
  icon,
  dismissible = false,
  onDismiss,
  style,
}) => {
  const getTheme = () => {
    switch (variant) {
      case 'review':
        return {
          bg: colors.actionReview.bg,
          border: colors.actionReview.border,
          text: colors.actionReview.text,
          icon: (icon || 'sparkle') as IconName,
        };
      case 'alert':
        return {
          bg: colors.safetyAlert.bg,
          border: colors.safetyAlert.border,
          text: colors.safetyAlert.text,
          icon: (icon || 'warning') as IconName,
        };
      case 'success':
        return {
          bg: colors.actionKeep.bg,
          border: colors.actionKeep.border,
          text: colors.actionKeep.text,
          icon: (icon || 'checkCircle') as IconName,
        };
      case 'info':
      default:
        return {
          bg: colors.surfaceMuted,
          border: colors.border,
          text: colors.ink,
          icon: (icon || 'info') as IconName,
        };
    }
  };

  const theme = getTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.bg,
          borderColor: theme.border,
        },
        style,
      ]}
      accessibilityRole="alert"
    >
      <View style={styles.iconColumn}>
        <Icon name={theme.icon} size={18} color={theme.text} />
      </View>

      <View style={styles.contentColumn}>
        {title && (
          <Text style={[styles.title, { color: theme.text }]}>
            {title}
          </Text>
        )}
        <Text style={[styles.message, { color: theme.text }]}>
          {message}
        </Text>
        {actionLabel && onAction && (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={onAction}
            style={styles.actionButton}
            accessibilityRole="button"
          >
            <Text style={[styles.actionLabel, { color: theme.text }]}>
              {actionLabel}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {dismissible && onDismiss && (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onDismiss}
          style={styles.dismissButton}
          accessibilityLabel="Dismiss notice"
          accessibilityRole="button"
        >
          <Icon name="close" size={16} color={theme.text} />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  iconColumn: {
    marginRight: spacing.sm,
    marginTop: 2,
  },
  contentColumn: {
    flex: 1,
  },
  title: {
    fontSize: typography.sizes.bodyRegular,
    lineHeight: typography.lineHeights.bodyRegular,
    fontWeight: typography.weights.semibold,
    marginBottom: 4,
  },
  message: {
    fontSize: typography.sizes.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.regular,
  },
  actionButton: {
    marginTop: spacing.xs,
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  actionLabel: {
    fontSize: typography.sizes.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.bold,
    textDecorationLine: 'underline',
  },
  dismissButton: {
    padding: spacing.xs,
    marginLeft: spacing.xs,
  },
});
