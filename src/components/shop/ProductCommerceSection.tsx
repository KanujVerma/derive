/** C1 presentation seam. Physical offers remain deferred to C1.5. */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { colors, radii, spacing, typography } from '../../constants/theme';
import { resolveActionCommerceSemantics } from '../../commerce/types';
import type { Routine, RoutineAction } from '../../types/schema';

interface Props {
  action?: RoutineAction;
  routineStatus: Routine['status'] | null;
  onRefill: () => void;
}

export function ProductCommerceSection({ action, routineStatus, onRefill }: Props) {
  if (!action) return null;

  const semantics = resolveActionCommerceSemantics(action, routineStatus);
  const published = routineStatus === 'published';
  const title = action === 'ADD'
    ? semantics.acquisitionEligible ? 'Purchase through Derive coming soon' : 'Recommendation under review'
    : action === 'KEEP' ? 'In your plan'
    : action === 'PAUSE' ? 'Product paused'
    : action === 'STOP' ? 'Discontinued product'
    : 'Replacement recommended';
  const body = action === 'ADD'
    ? published
      ? 'This product is recommended for your active plan. Ordering through Derive is not available yet.'
      : 'Your plan is still being finalized. There is no product to order here yet.'
    : action === 'KEEP'
    ? published
      ? 'You already have this product in your routine. Request a managed refill if needed.'
      : 'Managed refills become available after your routine is published.'
    : action === 'PAUSE'
    ? 'This product is on hold for now. No purchase is needed.'
    : action === 'STOP'
    ? 'Derive recommends discontinuing this product. No purchase is needed.'
    : 'Do not purchase more of this formula. Check your Plan for the recommended next step.';

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Icon
          name={action === 'ADD' ? 'bottle' : action === 'KEEP' ? 'checkCircle' : action === 'STOP' ? 'close' : 'info'}
          size={18}
          color={action === 'STOP' ? colors.actionStop.text : action === 'PAUSE' ? colors.actionPause.text : colors.brand}
        />
        <Text style={styles.title}>{title}</Text>
      </View>
      <Text style={styles.body}>{body}</Text>
      {action === 'KEEP' && published && (
        <Button
          label="Request Refill"
          variant="secondary"
          size="small"
          onPress={onRefill}
          style={styles.refill}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.brandLight,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  title: {
    flex: 1,
    fontSize: typography.sizes.bodyRegular,
    fontWeight: typography.weights.bold,
    color: colors.ink,
  },
  body: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
    lineHeight: 20,
  },
  refill: {
    marginTop: spacing.xs,
    alignSelf: 'flex-start',
  },
});
