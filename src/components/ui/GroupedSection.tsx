import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { colors, radii, typography, spacing } from '@/src/constants/theme';
import { SectionHeader, type SectionHeaderAction } from './SectionHeader';

interface GroupedSectionProps {
  header?: string;
  footer?: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  headerAction?: SectionHeaderAction;
  embedded?: boolean;
}

export const GroupedSection: React.FC<GroupedSectionProps> = ({
  header,
  footer,
  children,
  style,
  containerStyle,
  headerAction,
  embedded = false,
}) => {
  const validChildren = React.Children.toArray(children).filter(Boolean);

  return (
    <View style={[styles.wrapper, embedded && styles.embeddedWrapper, style]}>
      {header && (
        <View style={styles.header}><SectionHeader title={header} action={headerAction} /></View>
      )}

      <View style={[styles.card, embedded && styles.embeddedCard, containerStyle]}>
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
    marginBottom: spacing.xs,
  },
  embeddedWrapper: { marginBottom: 0 },
  embeddedCard: { backgroundColor: 'transparent', borderWidth: 0, borderRadius: 0 },
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
    color: colors.inkMuted,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
});
