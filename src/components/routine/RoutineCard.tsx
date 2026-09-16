import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { RoutineStep } from '@/src/types/schema';
import { colors, radii, typography, spacing } from '@/src/constants/theme';
import { Badge } from '@/src/components/ui/Badge';
import { Icon } from '@/src/components/ui/Icon';
import { Button } from '@/src/components/ui/Button';

interface RoutineCardProps {
  step: RoutineStep;
  onRequestRefill?: () => void;
}

export const RoutineCard: React.FC<RoutineCardProps> = ({
  step,
  onRequestRefill,
}) => {
  const [expanded, setExpanded] = useState(false);

  const isAlternatingDays = step.days && step.days.length > 0;
  const scheduleLabel = step.scheduleText || (isAlternatingDays
    ? step.days.map((d) => d.toUpperCase()).join(' / ')
    : 'DAILY');

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
        style={styles.rowContent}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={`${step.order}. ${step.brand} ${step.productName}. Tap to ${expanded ? 'collapse' : 'expand'} details.`}
      >
        {/* Step Index Circle */}
        <View style={styles.stepCircle}>
          <Text style={styles.stepNumber}>{step.order}</Text>
        </View>

        {/* Product Info */}
        <View style={styles.detailsContainer}>
          <View style={styles.titleRow}>
            <Text style={styles.brand}>{step.brand}</Text>
            {isAlternatingDays && (
              <Badge label={scheduleLabel} variant="pause" size="small" />
            )}
          </View>
          <Text style={styles.productName}>{step.productName}</Text>
          <Text style={styles.quickSpecs}>
            {step.amount} · {step.area}
          </Text>
        </View>

        {/* Expand Chevron */}
        <View style={styles.expandIconContainer}>
          <Icon
            name={expanded ? 'close' : 'forward'}
            size={14}
            color={colors.inkMuted}
          />
        </View>
      </TouchableOpacity>

      {/* Progressive Disclosure: Expanded Reasoning */}
      {expanded && (
        <View style={styles.expandedContent}>
          <View style={styles.divider} />

          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>Why this is in your plan</Text>
            <Text style={styles.infoText}>{step.whyChosen}</Text>
          </View>

          <View style={styles.metaRow}>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>AMOUNT</Text>
              <Text style={styles.metaVal}>{step.amount}</Text>
            </View>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>SCHEDULE</Text>
              <Text style={styles.metaVal}>{step.scheduleText || (isAlternatingDays ? '3 nights/week' : 'Daily')}</Text>
            </View>
          </View>

          {step.watchFor && (
            <View style={styles.cautionBlock}>
              <Text style={styles.cautionLabel}>What to watch for</Text>
              <Text style={styles.cautionText}>{step.watchFor}</Text>
            </View>
          )}

          {onRequestRefill && (
            <Button
              label={`Running low on ${step.productName.split(' ')[0]}?`}
              variant="ghost"
              size="small"
              onPress={onRequestRefill}
              style={{ marginTop: spacing.xs, alignSelf: 'flex-start' }}
            />
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    marginBottom: spacing.xs,
    padding: spacing.md,
  },
  rowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: radii.full,
    borderWidth: 1.5,
    borderColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  stepNumber: {
    color: colors.brand,
    fontSize: typography.sizes.bodyRegular,
    fontWeight: typography.weights.semibold,
  },
  detailsContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  brand: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
    fontWeight: typography.weights.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  productName: {
    fontSize: typography.sizes.bodyRegular,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    marginBottom: 2,
  },
  quickSpecs: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
  },
  expandIconContainer: {
    padding: spacing.xxs,
  },
  expandedContent: {
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: colors.hairline,
    marginBottom: spacing.sm,
  },
  infoBlock: {
    marginBottom: spacing.sm,
  },
  infoLabel: {
    fontSize: typography.sizes.micro,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.5,
    color: colors.inkMuted,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  infoText: {
    fontSize: typography.sizes.bodyRegular,
    color: colors.ink,
    lineHeight: 22,
  },
  metaRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs,
  },
  metaCol: {
    flex: 1,
  },
  metaLabel: {
    fontSize: typography.sizes.micro,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.5,
    color: colors.inkSubtle,
    marginBottom: 2,
  },
  metaVal: {
    fontSize: typography.sizes.caption,
    color: colors.ink,
    fontWeight: typography.weights.medium,
  },
  cautionBlock: {
    backgroundColor: colors.actionPause.bg,
    borderColor: colors.actionPause.border,
    borderWidth: 1,
    borderRadius: radii.sm,
    padding: spacing.sm,
    marginTop: spacing.xxs,
    marginBottom: spacing.xs,
  },
  cautionLabel: {
    fontSize: typography.sizes.micro,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.5,
    color: colors.actionPause.text,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  cautionText: {
    fontSize: typography.sizes.caption,
    color: colors.actionPause.text,
    lineHeight: 18,
  },
});
