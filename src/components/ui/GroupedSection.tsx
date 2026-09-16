import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { colors, radii, typography, spacing } from '@/src/constants/theme';

interface GroupedSectionProps {
  header?: string;
  footer?: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  containerStyle?: StyleProp<ViewStyle>;
}

export const GroupedSection: React.FC<GroupedSectionProps> = ({
  header,
  footer,
  children,
  style,
  containerStyle,
}) => {
  const validChildren = React.Children.toArray(children).filter(Boolean);

  return (
    <View style={[styles.wrapper, style]}>
      {header && (
        <Text style={styles.header} accessibilityRole="header">
          {header}
        </Text>
      )}

      <View style={[styles.card, containerStyle]}>
        {validChildren.map((child, index) => {
          const isLast = index === validChildren.length - 1;
          return (
            <React.Fragment key={index}>
              {child}
              {!isLast && <View style={styles.divider} />}
            </React.Fragment>
          );
        })}
      </View>

      {footer && <Text style={styles.footer}>{footer}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: spacing.lg,
  },
  header: {
    fontSize: typography.sizes.micro,
    lineHeight: typography.lineHeights.micro,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.inkMuted,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: spacing.lg,
  },
  footer: {
    fontSize: typography.sizes.caption,
    lineHeight: typography.lineHeights.caption,
    color: colors.inkSubtle,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
});
