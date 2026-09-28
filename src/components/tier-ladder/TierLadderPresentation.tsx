import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, layout, spacing, typography } from '../../constants/theme';
import { GroupedSection } from '../ui/GroupedSection';
import type { ManagedInterestAction, TierLadderView } from '../../presentation/tier-ladder/tierLadder';

interface Props {
  view: TierLadderView;
  /** Host owns both the intent destination and privacy-reviewed measurement. */
  onManagedInterest?: (action: ManagedInterestAction) => void;
}

/** Compact product ladder. It has no billing, enrollment, or entitlement authority. */
export function TierLadderPresentation({ view, onManagedInterest }: Props) {
  return <View>
    <GroupedSection header="Ways to use Derive">
      {view.tiers.map((tier) => {
        const action = tier.id === 'managed' ? view.managedInterestAction : null;
        return <View key={tier.id} style={styles.row}>
          <View style={styles.titleRow}>
            <Text style={styles.name}>{tier.name}</Text>
            {tier.status && <Text style={styles.status}>{tier.status}</Text>}
          </View>
          <Text style={styles.summary}>{tier.summary}</Text>
          <Text style={styles.detail}>{tier.detail}</Text>
          {action && onManagedInterest &&
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Express interest in Managed Skincare"
              style={styles.action}
              onPress={() => onManagedInterest(action)}
            >
              <Text style={styles.actionText}>{action.label}</Text>
            </Pressable>}
        </View>;
      })}
    </GroupedSection>
  </View>;
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.xxs },
  titleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: spacing.xs },
  name: { color: colors.ink, fontSize: typography.sizes.bodyLarge, fontWeight: typography.weights.semibold },
  status: { color: colors.inkMuted, fontSize: typography.sizes.caption },
  summary: { color: colors.ink, fontSize: typography.sizes.bodyRegular, lineHeight: typography.lineHeights.bodyRegular },
  detail: { color: colors.inkMuted, fontSize: typography.sizes.caption, lineHeight: typography.lineHeights.caption },
  action: { minHeight: layout.minTouchTarget, justifyContent: 'center', alignSelf: 'flex-start', marginTop: spacing.xs },
  actionText: { color: colors.brand, fontSize: typography.sizes.bodyRegular, fontWeight: typography.weights.semibold },
});
