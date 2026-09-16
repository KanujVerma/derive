import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  StyleProp,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, radii, shadows, typography, spacing } from '@/src/constants/theme';

export interface SegmentOption<T extends string | number> {
  value: T;
  label: string;
  badge?: string | number;
}

interface SegmentedControlProps<T extends string | number> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
  size?: 'small' | 'medium';
}

export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  style,
  size = 'medium',
}: SegmentedControlProps<T>) {
  const handleSelect = async (newValue: T) => {
    if (newValue === value) return;
    try {
      await Haptics.selectionAsync();
    } catch {}
    onChange(newValue);
  };

  const isSmall = size === 'small';

  return (
    <View
      style={[
        styles.container,
        isSmall ? styles.containerSmall : styles.containerMedium,
        style,
      ]}
      accessibilityRole="tablist"
    >
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <TouchableOpacity
            key={String(option.value)}
            activeOpacity={0.8}
            onPress={() => handleSelect(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={option.label}
            style={[
              styles.segment,
              isSelected && styles.selectedSegment,
            ]}
          >
            <Text
              style={[
                styles.label,
                isSmall ? styles.labelSmall : styles.labelMedium,
                isSelected ? styles.selectedLabel : styles.unselectedLabel,
              ]}
              numberOfLines={1}
            >
              {option.label}
            </Text>
            {option.badge !== undefined && (
              <View
                style={[
                  styles.badge,
                  isSelected ? styles.badgeSelected : styles.badgeUnselected,
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    isSelected ? styles.badgeTextSelected : styles.badgeTextUnselected,
                  ]}
                >
                  {option.badge}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  containerSmall: {
    height: 36,
  },
  containerMedium: {
    height: 46,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
  },
  selectedSegment: {
    backgroundColor: colors.surface,
    ...shadows.subtle,
  },
  label: {
    fontWeight: typography.weights.semibold,
    textAlign: 'center',
  },
  labelSmall: {
    fontSize: typography.sizes.caption,
    lineHeight: typography.lineHeights.caption,
  },
  labelMedium: {
    fontSize: typography.sizes.bodyRegular,
    lineHeight: typography.lineHeights.bodyRegular,
  },
  selectedLabel: {
    color: colors.ink,
  },
  unselectedLabel: {
    color: colors.inkMuted,
  },
  badge: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radii.full,
  },
  badgeSelected: {
    backgroundColor: colors.brandLight,
  },
  badgeUnselected: {
    backgroundColor: colors.border,
  },
  badgeText: {
    fontSize: typography.sizes.micro,
    fontWeight: typography.weights.bold,
  },
  badgeTextSelected: {
    color: colors.brand,
  },
  badgeTextUnselected: {
    color: colors.inkMuted,
  },
});
