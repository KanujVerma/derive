import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { colors, typography, spacing, layout } from '@/src/constants/theme';
import { Icon, IconName } from '@/src/components/ui/Icon';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  titleFont?: 'serif' | 'sans';
  rightAction?: {
    icon?: IconName;
    label?: string;
    onPress: () => void;
    accessibilityLabel: string;
  };
  style?: StyleProp<ViewStyle>;
  hasBottomDivider?: boolean;
}

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({
  title,
  subtitle,
  showBack = false,
  onBack,
  titleFont = 'sans',
  rightAction,
  style,
  hasBottomDivider = false,
}) => {
  const router = useRouter();

  const handleBack = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  return (
    <View
      style={[
        styles.container,
        hasBottomDivider && styles.bottomDivider,
        style,
      ]}
    >
      <View style={styles.topRow}>
        {showBack && (
          <TouchableOpacity
            onPress={handleBack}
            style={styles.actionButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Icon name="back" size={20} color={colors.ink} />
          </TouchableOpacity>
        )}

        <View style={styles.titleContainer}>
          <Text
            style={[
              styles.title,
              titleFont === 'serif' ? styles.serifTitle : styles.sansTitle,
            ]}
            numberOfLines={2}
          >
            {title}
          </Text>
        </View>

        {rightAction ? (
          <TouchableOpacity
            onPress={rightAction.onPress}
            style={styles.actionButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel={rightAction.accessibilityLabel}
          >
            {rightAction.icon ? (
              <Icon name={rightAction.icon} size={20} color={colors.ink} />
            ) : (
              <Text style={styles.rightActionLabel}>{rightAction.label}</Text>
            )}
          </TouchableOpacity>
        ) : showBack ? (
          <View style={styles.placeholder} />
        ) : null}
      </View>

      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: layout.gutter,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    backgroundColor: colors.canvas,
  },
  bottomDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: layout.minTouchTarget,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    color: colors.ink,
    fontSize: typography.sizes.screenTitle,
    lineHeight: typography.lineHeights.screenTitle,
  },
  serifTitle: {
    fontFamily: typography.fontFamilies.serif,
    fontWeight: typography.weights.regular,
  },
  sansTitle: {
    fontFamily: typography.fontFamilies.sans,
    fontWeight: typography.weights.bold,
  },
  subtitle: {
    fontSize: typography.sizes.bodyRegular,
    lineHeight: typography.lineHeights.bodyRegular,
    color: colors.inkMuted,
    marginTop: spacing.xxs,
  },
  actionButton: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: layout.minTouchTarget / 2,
  },
  rightActionLabel: {
    fontSize: typography.sizes.bodyRegular,
    fontWeight: typography.weights.medium,
    color: colors.brand,
  },
  placeholder: {
    width: layout.minTouchTarget,
  },
});
