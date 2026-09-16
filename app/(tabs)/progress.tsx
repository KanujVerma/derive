import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { colors, typography, spacing, radii, shadows } from '@/src/constants/theme';
import { useRoutineStore } from '@/src/stores/routineStore';
import { Button } from '@/src/components/ui/Button';
import { Icon } from '@/src/components/ui/Icon';
import { Badge } from '@/src/components/ui/Badge';
import { InsightBasisLabels } from '@/src/types/schema';

type AngleKey = 'front' | 'left' | 'right';

export default function ProgressScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { checkIns, learnedInsights } = useRoutineStore();
  const [selectedAngle, setSelectedAngle] = useState<AngleKey>('front');

  const timelineEvents = [
    {
      date: 'Sep 15, 2026',
      title: 'Routine Updated',
      description: 'Differin scheduled Monday, Wednesday, Friday, followed by moisturizer.',
      badge: 'Active',
    },
    {
      date: 'Sep 08, 2026',
      title: 'Weekly Check-in #1',
      description: 'Zero flaking or stinging reported. Skin tolerance confirmed.',
      badge: 'Stable',
    },
    {
      date: 'Sep 01, 2026',
      title: 'Initial Plan Established',
      description: 'Audited 4 current counter products. 3 steps morning, 3 steps evening.',
      badge: 'Baseline',
    },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.screenTitle}>Progress</Text>
        <Text style={styles.screenSubtitle}>
          What we have learned about your skin over time.
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 110 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* CHECK-IN PROMPT CARD */}
        <View style={styles.checkInCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.checkInTitle}>Weekly Check-in</Text>
            <Text style={styles.checkInSub}>
              A 30-second check on barrier comfort and plan adherence.
            </Text>
          </View>
          <Button
            label="Check In"
            variant="brand"
            size="medium"
            onPress={() => router.push('/check-in')}
          />
        </View>

        {/* 1. SIDE-BY-SIDE PHOTO COMPARISON */}
        <View style={styles.photoSection}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Photo Comparison</Text>
            {/* Angle Selector Tabs */}
            <View style={styles.angleTabs}>
              {(['front', 'left', 'right'] as AngleKey[]).map((angle) => (
                <TouchableOpacity
                  key={angle}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedAngle(angle);
                  }}
                  style={[
                    styles.angleTab,
                    selectedAngle === angle && styles.angleTabActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.angleTabText,
                      selectedAngle === angle && styles.angleTabTextActive,
                    ]}
                  >
                    {angle.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.comparisonGrid}>
            {/* Baseline Column */}
            <View style={styles.photoCol}>
              <View style={styles.photoBox}>
                <View style={styles.photoPlaceholder}>
                  <Icon name="person" size={32} color={colors.inkSubtle} />
                </View>
                <View style={styles.photoTag}>
                  <Text style={styles.photoTagText}>Baseline • Sep 01</Text>
                </View>
              </View>
            </View>

            {/* Current Column */}
            <View style={styles.photoCol}>
              <View style={styles.photoBox}>
                <View style={styles.photoPlaceholder}>
                  <Icon name="person" size={32} color={colors.brand} />
                </View>
                <View style={styles.photoTag}>
                  <Text style={styles.photoTagText}>Latest • Sep 15</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* 2. LEARNED SKIN INSIGHTS */}
        <View style={styles.insightsSection}>
          <Text style={styles.sectionTitle}>Learned Insights</Text>
          <Text style={styles.sectionSub}>
            Observations grounded in your check-ins and routine tolerance.
          </Text>

          <View style={styles.insightsList}>
            {learnedInsights.map((insight) => (
              <View key={insight.id} style={styles.insightCard}>
                <View style={styles.insightIconCircle}>
                  <Icon name="check" size={14} color={colors.brand} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.insightText}>{insight.text}</Text>
                  <View style={styles.insightMetaRow}>
                    <Text style={styles.insightBasisText}>
                      {InsightBasisLabels[insight.basis] || 'From your skin history'}
                    </Text>
                    <Text style={styles.insightDateText}>{insight.dateObserved}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* 3. LONGITUDINAL TIMELINE */}
        <View style={styles.timelineSection}>
          <Text style={styles.sectionTitle}>Timeline</Text>
          <View style={styles.timelineContainer}>
            {timelineEvents.map((event, index) => (
              <View key={index} style={styles.timelineItem}>
                <View style={styles.spineContainer}>
                  <View style={styles.dot} />
                  {index < timelineEvents.length - 1 && <View style={styles.spineLine} />}
                </View>

                <View style={styles.eventCard}>
                  <View style={styles.eventHeader}>
                    <Text style={styles.eventDate}>{event.date}</Text>
                    <View style={styles.eventBadge}>
                      <Text style={styles.eventBadgeText}>{event.badge}</Text>
                    </View>
                  </View>
                  <Text style={styles.eventTitle}>{event.title}</Text>
                  <Text style={styles.eventDesc}>{event.description}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.canvas,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  screenTitle: {
    fontFamily: typography.fontFamilies.serif,
    fontSize: typography.sizes.screenTitle,
    lineHeight: typography.lineHeights.screenTitle,
    color: colors.ink,
  },
  screenSubtitle: {
    fontSize: typography.sizes.bodyRegular,
    color: colors.inkMuted,
    marginTop: 2,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.xl,
  },
  checkInCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.brandLight,
    padding: spacing.md,
    borderRadius: radii.lg,
    gap: spacing.sm,
  },
  checkInTitle: {
    fontSize: typography.sizes.bodyRegular,
    fontWeight: typography.weights.bold,
    color: colors.ink,
    marginBottom: 2,
  },
  checkInSub: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
    lineHeight: 18,
  },
  photoSection: {
    gap: spacing.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: typography.sizes.sectionTitle,
    fontWeight: typography.weights.bold,
    color: colors.ink,
  },
  sectionSub: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
    marginTop: 2,
    marginBottom: spacing.xs,
  },
  angleTabs: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.sm,
    padding: 2,
  },
  angleTab: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.xs,
  },
  angleTabActive: {
    backgroundColor: colors.surface,
    ...shadows.subtle,
  },
  angleTabText: {
    fontSize: typography.sizes.micro,
    color: colors.inkMuted,
    fontWeight: typography.weights.medium,
  },
  angleTabTextActive: {
    color: colors.ink,
    fontWeight: typography.weights.bold,
  },
  comparisonGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  photoCol: {
    flex: 1,
  },
  photoBox: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    overflow: 'hidden',
    ...shadows.subtle,
  },
  photoPlaceholder: {
    height: 160,
    backgroundColor: colors.canvasMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoTag: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  photoTagText: {
    fontSize: typography.sizes.micro,
    fontWeight: typography.weights.semibold,
    color: colors.inkMuted,
  },
  insightsSection: {
    gap: spacing.xs,
  },
  insightsList: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  insightCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadows.subtle,
  },
  insightIconCircle: {
    width: 24,
    height: 24,
    borderRadius: radii.full,
    backgroundColor: colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  insightText: {
    fontSize: typography.sizes.bodyRegular,
    fontWeight: typography.weights.medium,
    color: colors.ink,
    lineHeight: 22,
    marginBottom: 4,
  },
  insightMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  insightBasisText: {
    fontSize: typography.sizes.micro,
    color: colors.brand,
    fontWeight: typography.weights.semibold,
    textTransform: 'uppercase',
  },
  insightDateText: {
    fontSize: typography.sizes.micro,
    color: colors.inkSubtle,
  },
  timelineSection: {
    gap: spacing.sm,
  },
  timelineContainer: {
    marginTop: spacing.xs,
  },
  timelineItem: {
    flexDirection: 'row',
  },
  spineContainer: {
    width: 24,
    alignItems: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.brand,
    marginTop: 6,
  },
  spineLine: {
    width: 2,
    flex: 1,
    backgroundColor: colors.border,
    marginVertical: 4,
  },
  eventCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
    ...shadows.subtle,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  eventDate: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
  },
  eventBadge: {
    backgroundColor: colors.brandLight,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  eventBadgeText: {
    fontSize: typography.sizes.micro,
    fontWeight: typography.weights.bold,
    color: colors.brand,
  },
  eventTitle: {
    fontSize: typography.sizes.bodyRegular,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    marginBottom: 2,
  },
  eventDesc: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
    lineHeight: 18,
  },
});
