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
import { useOnboardingStore } from '@/src/stores/onboardingStore';
import { Button } from '@/src/components/ui/Button';
import { Icon } from '@/src/components/ui/Icon';
import { Badge } from '@/src/components/ui/Badge';
import { StatusBadge } from '@/src/components/ui/StatusBadge';
import { SegmentedControl } from '@/src/components/ui/SegmentedControl';
import { InsightBasisLabels } from '@/src/types/schema';

type AngleKey = 'front' | 'left' | 'right';

function formatFriendlyDate(dateStr: string): string {
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = months[parseInt(parts[1], 10) - 1];
      const day = parseInt(parts[2], 10);
      if (month && !isNaN(day)) return `${month} ${day}`;
    }
  } catch {}
  return dateStr;
}

export default function ProgressScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { checkIns, learnedInsights, routine, userProducts } = useRoutineStore();
  const { frontPhotoUri, leftPhotoUri, rightPhotoUri } = useOnboardingStore();
  const [selectedAngle, setSelectedAngle] = useState<AngleKey>('front');

  // Determine baseline photo URI based on selected angle
  const baselinePhotoUri =
    selectedAngle === 'front'
      ? frontPhotoUri
      : selectedAngle === 'left'
      ? leftPhotoUri
      : rightPhotoUri;

  // Find most recent photo from check-ins if available
  const latestCheckInWithPhoto = checkIns.find((c) => c.photoUrls && c.photoUrls.length > 0);
  const latestPhotoUri = latestCheckInWithPhoto?.photoUrls?.[0] || null;

  // Build dynamic longitudinal timeline
  const timelineEvents = React.useMemo(() => {
    const events: Array<{
      date: string;
      title: string;
      description: string;
      badge: string;
    }> = [];

    // Map check-ins in reverse chronological order
    checkIns.forEach((checkIn, index) => {
      const checkInNum = checkIns.length - index;
      const dateStr = checkIn.createdAt ? formatFriendlyDate(checkIn.createdAt.split('T')[0]) : 'Recent';
      events.push({
        date: dateStr,
        title: `Weekly Check-in #${checkInNum}`,
        description:
          checkIn.aiAnalysisSentence ||
          checkIn.notes ||
          (checkIn.irritation === 'none'
            ? 'Skin tolerance confirmed with no flaking or stinging reported.'
            : 'Sensitivity noted during check-in.'),
        badge: checkIn.adjustmentProposed ? 'Adjustment' : 'Stable',
      });
    });

    // Add routine establishment baseline event
    if (routine) {
      const dateStr = routine.publishedAt || routine.createdAt
        ? formatFriendlyDate((routine.publishedAt || routine.createdAt).split('T')[0])
        : 'Baseline';
      const totalSteps = routine.amSteps.length + routine.pmSteps.length;
      events.push({
        date: dateStr,
        title: 'Initial Plan Established',
        description: `Audited routine initialized with ${totalSteps} step${totalSteps === 1 ? '' : 's'}. ${routine.amSteps.length} AM, ${routine.pmSteps.length} PM.`,
        badge: 'Baseline',
      });
    }

    return events;
  }, [checkIns, routine, userProducts]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <Text style={styles.screenTitle}>Progress</Text>
          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => router.push('/profile')}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel="Account and Settings"
            accessibilityRole="button"
          >
            <Icon name="person" size={18} color={colors.inkMuted} />
          </TouchableOpacity>
        </View>
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
          <Text style={styles.sectionTitle}>Photo Comparison</Text>
          {/* Segmented Control for Photo Angles on its own full-width row */}
          <View style={styles.angleControlRow}>
            <SegmentedControl
              options={[
                { value: 'front', label: 'FRONT' },
                { value: 'left', label: 'LEFT' },
                { value: 'right', label: 'RIGHT' },
              ]}
              value={selectedAngle}
              onChange={setSelectedAngle}
            />
          </View>

          <View style={styles.comparisonGrid}>
            {/* Baseline Column */}
            <View style={styles.photoCol}>
              <View style={styles.photoBox}>
                {baselinePhotoUri ? (
                  <Image
                    source={{ uri: baselinePhotoUri }}
                    style={styles.photoImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Icon name="person" size={32} color={colors.inkSubtle} />
                  </View>
                )}
                <View style={styles.photoTag}>
                  <Text style={styles.photoTagText}>
                    {baselinePhotoUri ? 'Baseline • Active' : 'Baseline • No photo'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Current Column */}
            <View style={styles.photoCol}>
              <View style={styles.photoBox}>
                {latestPhotoUri ? (
                  <Image
                    source={{ uri: latestPhotoUri }}
                    style={styles.photoImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Icon name="person" size={32} color={colors.brand} />
                  </View>
                )}
                <View style={styles.photoTag}>
                  <Text style={styles.photoTagText}>
                    {latestPhotoUri ? 'Latest • Verified' : 'Latest • Next check-in'}
                  </Text>
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

          {learnedInsights.length > 0 ? (
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
                      <Text style={styles.insightDateText}>{formatFriendlyDate(insight.dateObserved)}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Icon name="sparkle" size={20} color={colors.inkMuted} />
              <Text style={styles.emptyCardTitle}>No observations yet</Text>
              <Text style={styles.emptyCardText}>
                As you complete weekly check-ins and follow your plan, we will document evidence-grounded insights about your barrier tolerance here.
              </Text>
            </View>
          )}
        </View>

        {/* 3. LONGITUDINAL TIMELINE */}
        <View style={styles.timelineSection}>
          <Text style={styles.sectionTitle}>Timeline</Text>
          {timelineEvents.length > 0 ? (
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
                      <StatusBadge
                        label={event.badge}
                        variant={event.badge === 'Active' ? 'keep' : event.badge === 'Stable' ? 'active' : 'info'}
                        size="small"
                      />
                    </View>
                    <Text style={styles.eventTitle}>{event.title}</Text>
                    <Text style={styles.eventDesc}>{event.description}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Icon name="progress" size={20} color={colors.inkMuted} />
              <Text style={styles.emptyCardTitle}>No timeline events yet</Text>
              <Text style={styles.emptyCardText}>
                Your longitudinal skincare record starts once your routine is established and your first check-in is logged.
              </Text>
            </View>
          )}
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
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  angleControlRow: {
    width: '100%',
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
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
  photoImage: {
    width: '100%',
    height: 160,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  emptyCardTitle: {
    fontSize: typography.sizes.bodyRegular,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    textAlign: 'center',
  },
  emptyCardText: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
});
