import React from 'react';
import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, typography, spacing, radii, layout } from '@/src/constants/theme';
import { Icon } from '@/src/components/ui/Icon';

interface SelectionRowProps {
  title: string;
  description?: string;
  subtitle?: string;
  selected: boolean;
  onPress: () => void;
  mode?: 'single' | 'multiple';
  type?: 'radio' | 'checkbox';
  badge?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const SelectionRow: React.FC<SelectionRowProps> = ({
  title,
  description,
  subtitle,
  selected,
  onPress,
  mode = 'single',
  type,
  badge,
  disabled = false,
  style,
}) => {
  const handlePress = () => {
    if (disabled) return;
    try {
      Haptics.selectionAsync();
    } catch {}
    onPress();
  };

  const isRadio = type ? type === 'radio' : mode === 'single';
  const desc = description || subtitle;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={handlePress}
      disabled={disabled}
      style={[
        styles.row,
        selected && styles.rowSelected,
        disabled && styles.rowDisabled,
        style,
      ]}
      accessible={true}
      accessibilityRole={isRadio ? 'radio' : 'checkbox'}
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={`${title}${desc ? `, ${desc}` : ''}`}
    >
      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, selected && styles.titleSelected]}>
            {title}
          </Text>
          {badge ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          ) : null}
        </View>
        {desc ? (
          <Text style={styles.description}>{desc}</Text>
        ) : null}
      </View>

      <View
        style={[
          styles.indicator,
          isRadio ? styles.radioIndicator : styles.checkboxIndicator,
          selected && styles.indicatorSelected,
        ]}
      >
        {selected ? (
          isRadio ? (
            <View style={styles.radioDot} />
          ) : (
            <Icon name="check" size={14} color={colors.surfaceElevated} />
          )
        ) : null}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 56,
  },
  rowSelected: {
    backgroundColor: colors.brandLight,
    borderColor: colors.brand,
  },
  rowDisabled: {
    opacity: 0.5,
  },
  content: {
    flex: 1,
    paddingRight: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  title: {
    fontSize: typography.sizes.bodyLarge,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
  },
  titleSelected: {
    color: colors.brandDark,
  },
  description: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
    marginTop: spacing.xxs,
    lineHeight: typography.lineHeights.caption,
  },
  badge: {
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  badgeText: {
    fontSize: typography.sizes.micro,
    fontWeight: typography.weights.medium,
    color: colors.inkMuted,
  },
  indicator: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceElevated,
  },
  radioIndicator: {
    borderRadius: 12,
  },
  checkboxIndicator: {
    borderRadius: radii.xs,
  },
  indicatorSelected: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.surfaceElevated,
  },
});
