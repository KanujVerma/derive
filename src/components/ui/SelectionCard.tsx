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
import { colors, typography, spacing, radii, layout, shadows } from '@/src/constants/theme';
import { Icon } from '@/src/components/ui/Icon';

interface SelectionCardProps {
  title: string;
  subtitle?: string;
  description?: string;
  tag?: string;
  tags?: string[];
  selected: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  selectionType?: 'radio' | 'checkbox';
}

export const SelectionCard: React.FC<SelectionCardProps> = ({
  title,
  subtitle,
  description,
  tag,
  tags,
  selected,
  onPress,
  style,
  selectionType = 'radio',
}) => {
  const handlePress = () => {
    try {
      Haptics.selectionAsync();
    } catch {}
    onPress();
  };

  const allTags = tags || (tag ? [tag] : []);

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={handlePress}
      style={[
        styles.card,
        selected && styles.cardSelected,
        style,
      ]}
      accessible={true}
      accessibilityRole={selectionType === 'checkbox' ? 'checkbox' : 'radio'}
      accessibilityState={{ selected }}
      accessibilityLabel={`${title}${subtitle ? `, ${subtitle}` : ''}${description ? `. ${description}` : ''}`}
    >
      <View style={styles.headerRow}>
        <View style={styles.titleArea}>
          <Text style={[styles.title, selected && styles.titleSelected]}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle}>{subtitle}</Text>
          ) : null}
        </View>

        <View
          style={[
            selectionType === 'checkbox' ? styles.checkboxSquare : styles.radioCircle,
            selected &&
              (selectionType === 'checkbox'
                ? styles.checkboxSquareSelected
                : styles.radioCircleSelected),
          ]}
        >
          {selected ? (
            selectionType === 'checkbox' ? (
              <Icon name="check" size={12} color={colors.surfaceElevated} />
            ) : (
              <View style={styles.radioDot} />
            )
          ) : null}
        </View>
      </View>

      {description ? (
        <Text style={styles.description}>{description}</Text>
      ) : null}

      {allTags.length > 0 ? (
        <View style={styles.tagRow}>
          {allTags.map((t, idx) => (
            <View key={idx} style={styles.tagContainer}>
              <Text style={styles.tagText}>{t}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    padding: layout.cardPadding,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.subtle,
  },
  cardSelected: {
    backgroundColor: colors.brandLight,
    borderColor: colors.brand,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  titleArea: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  title: {
    fontSize: typography.sizes.bodyLarge,
    fontWeight: typography.weights.bold,
    color: colors.ink,
  },
  titleSelected: {
    color: colors.brandDark,
  },
  subtitle: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
    marginTop: 2,
  },
  description: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
    marginTop: spacing.xs,
    lineHeight: typography.lineHeights.caption,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  tagContainer: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.xs,
    paddingVertical: 3,
    borderRadius: radii.xs,
  },
  tagText: {
    fontSize: typography.sizes.micro,
    color: colors.inkMuted,
    fontWeight: typography.weights.medium,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
    marginTop: 2,
  },
  radioCircleSelected: {
    borderColor: colors.brand,
    backgroundColor: colors.brand,
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceElevated,
  },
  checkboxSquare: {
    width: 22,
    height: 22,
    borderRadius: radii.xs,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
    marginTop: 2,
  },
  checkboxSquareSelected: {
    borderColor: colors.brand,
    backgroundColor: colors.brand,
  },
});
