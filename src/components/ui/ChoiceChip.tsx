import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  StyleProp,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, radii, typography, spacing, layout } from '@/src/constants/theme';
import { Icon, IconName } from './Icon';
import { choiceAccessibility } from '../../presentation/ui/selection';

interface ChoiceChipProps {
  label: string;
  selected?: boolean;
  onSelect: () => void;
  icon?: IconName;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  size?: 'small' | 'medium';
  selectionType?: 'single' | 'multiple';
}

export const ChoiceChip: React.FC<ChoiceChipProps> = ({
  label,
  selected = false,
  onSelect,
  icon,
  disabled = false,
  style,
  size = 'medium',
  selectionType = 'multiple',
}) => {
  const handlePress = async () => {
    if (disabled) return;
    try {
      await Haptics.selectionAsync();
    } catch {}
    onSelect();
  };

  const isSmall = size === 'small';
  const accessibility = choiceAccessibility(selectionType, selected, disabled);

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={handlePress}
      disabled={disabled}
      accessible={true}
      accessibilityRole={accessibility.role}
      aria-checked={selected}
      accessibilityState={accessibility.state}
      accessibilityLabel={label}
      style={[
        styles.chip,
        isSmall ? styles.chipSmall : styles.chipMedium,
        selected ? styles.selectedChip : styles.unselectedChip,
        disabled && styles.disabledChip,
        style,
      ]}
    >
      {icon && (
        <View style={styles.iconContainer}>
          <Icon
            name={icon}
            size={isSmall ? 14 : 16}
            color={selected ? colors.inkInverse : colors.inkMuted}
          />
        </View>
      )}
      <Text
        style={[
          styles.label,
          isSmall ? styles.labelSmall : styles.labelMedium,
          selected ? styles.selectedLabel : styles.unselectedLabel,
          disabled && styles.disabledLabel,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  chip: {
    minWidth: layout.minTouchTarget,
    borderRadius: radii.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  chipSmall: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    minHeight: 44,
  },
  chipMedium: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    minHeight: 44,
  },
  unselectedChip: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  selectedChip: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  disabledChip: {
    opacity: 0.45,
  },
  iconContainer: {
    marginRight: 6,
  },
  label: {
    fontWeight: typography.weights.medium,
  },
  labelSmall: {
    fontSize: typography.sizes.caption,
    lineHeight: typography.lineHeights.caption,
  },
  labelMedium: {
    fontSize: typography.sizes.bodyRegular,
    lineHeight: typography.lineHeights.bodyRegular,
  },
  unselectedLabel: {
    color: colors.ink,
  },
  selectedLabel: {
    color: colors.inkInverse,
  },
  disabledLabel: {
    color: colors.inkSubtle,
  },
});
