import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, layout, radii, spacing, typography } from '../../../constants/theme';
import { deriveManagedPlanView, type ManagedPlanSnapshot, type ProductDecision } from '../../../presentation/managed-plan/managedPlan';
import { GroupedSection } from '../../ui/GroupedSection';
import { StatusBadge, type StatusBadgeVariant } from '../../ui/StatusBadge';

const decisionVariant: Record<ProductDecision, StatusBadgeVariant> = { keep: 'keep', add: 'add', remove: 'stop', change: 'replace' };

interface Props { snapshot: ManagedPlanSnapshot; onRetry?: () => void; onCheckIn?: () => void }

/** Read-only Plan presentation. Supplied actions are navigation hooks, never service calls. */
export function ManagedPlanPresentation({ snapshot, onRetry, onCheckIn }: Props) {
  const view = deriveManagedPlanView(snapshot);
  return <ScrollView contentContainerStyle={styles.content}>
    {view.illustrative && <Text style={styles.preview}>ILLUSTRATIVE PREVIEW</Text>}
    <Text style={styles.title}>{view.title}</Text>
    <Text style={styles.body}>{view.message || view.detail}</Text>
    {view.showRetry && <Pressable accessibilityRole="button" accessibilityState={{ disabled: !onRetry }} disabled={!onRetry} style={styles.action} onPress={onRetry}><Text style={styles.actionText}>Try again</Text></Pressable>}
    {view.showCheckIn && <Pressable accessibilityRole="button" accessibilityState={{ disabled: !onCheckIn }} disabled={!onCheckIn} style={styles.action} onPress={onCheckIn}><Text style={styles.actionText}>Start check-in</Text></Pressable>}
    {view.showRoutine && <>
      <GroupedSection header="Current routine" footer="Use only your published instructions. Products are purchased separately.">
        {view.products.length ? view.products.map((product) => <View key={product.id} style={styles.row}>
          <View style={styles.productHead}><Text style={styles.productName}>{product.name}</Text><StatusBadge label={product.decision} variant={decisionVariant[product.decision]} /></View>
          {product.timing && <Text style={styles.meta}>{product.timing === 'both' ? 'Morning and evening' : product.timing === 'morning' ? 'Morning' : 'Evening'}</Text>}
          {product.instruction && <Text style={styles.body}>{product.instruction}</Text>}
          {product.reason && <Text style={styles.meta}>{product.reason}</Text>}
        </View>) : <View style={styles.row}><Text style={styles.body}>No published products yet.</Text></View>}
      </GroupedSection>
      <GroupedSection header="What changed">
        <View style={styles.row}>{view.changes.length ? view.changes.map((change, index) => <Text key={index} style={styles.body}>{change}</Text>) : <Text style={styles.meta}>No changes to show yet.</Text>}</View>
      </GroupedSection>
      <GroupedSection header="Check-ins and progress"><View style={styles.row}>
        <Text style={styles.body}>{view.progress || 'Your check-ins and progress will appear here.'}</Text>
        {view.nextCheckIn && <Text style={styles.meta}>{view.nextCheckIn}</Text>}
      </View></GroupedSection>
    </>}
  </ScrollView>;
}

const styles = StyleSheet.create({
  content: { padding: layout.gutter, paddingBottom: spacing.xxxl, gap: spacing.sm },
  preview: { color: colors.brand, fontSize: typography.sizes.micro, fontWeight: typography.weights.bold, letterSpacing: 1 },
  title: { color: colors.ink, fontSize: typography.sizes.screenTitle, lineHeight: typography.lineHeights.screenTitle, fontWeight: typography.weights.semibold },
  body: { color: colors.ink, fontSize: typography.sizes.bodyRegular, lineHeight: typography.lineHeights.bodyRegular },
  meta: { color: colors.inkMuted, fontSize: typography.sizes.caption, lineHeight: typography.lineHeights.caption },
  row: { padding: spacing.lg, gap: spacing.xs },
  productHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  productName: { color: colors.ink, fontSize: typography.sizes.bodyRegular, fontWeight: typography.weights.semibold, flex: 1 },
  action: { minHeight: layout.ctaHeight, paddingHorizontal: spacing.lg, borderRadius: radii.sm, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', marginVertical: spacing.md },
  actionText: { color: colors.inkInverse, fontSize: typography.sizes.bodyRegular, fontWeight: typography.weights.semibold },
});
