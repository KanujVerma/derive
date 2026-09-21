import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { colors, typography, spacing, radii, shadows } from '@/src/constants/theme';
import { useRoutineStore } from '@/src/stores/routineStore';
import { Icon } from '@/src/components/ui/Icon';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import { analytics } from '@/src/services/analytics';
import { publicEnvironment } from '@/src/config/environment';
import { showsProviderBetaFeatures } from '@/src/utils/membershipPresentation';
import { ResearchActionRecommendation } from '@/src/types/schema';
import { hydrateResearchInsights } from '@/src/services/deriveClient';

function getRecommendationBadge(rec: ResearchActionRecommendation): {
  label: string;
  variant: 'keep' | 'pause' | 'replace' | 'neutral';
} {
  switch (rec) {
    case 'no_change':
      return { label: 'NO ROUTINE CHANGE NEEDED', variant: 'keep' };
    case 'monitor':
      return { label: 'MONITORING FOR YOU', variant: 'pause' };
    case 'consider_later':
      return { label: 'POTENTIAL FUTURE ADJUSTMENT', variant: 'neutral' };
    case 'action':
      return { label: 'ACTION RECOMMENDED', variant: 'replace' };
  }
}

export default function ResearchInsightDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { researchInsights } = useRoutineStore();

  const insight = researchInsights.find((r) => r.id === id) || researchInsights[0];

  useEffect(() => {
    if (researchInsights.length === 0) {
      hydrateResearchInsights().catch((err) => {
        console.warn('Failed to hydrate research insights:', err);
      });
    }
  }, []);

  useEffect(() => {
    if (insight) {
      analytics.track('research_insight_viewed', {
        insightId: insight.id,
        recommendationType: insight.recommendation,
      });
    }
  }, [insight]);

  if (!insight) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 40 }]}>
        <Text style={styles.notFoundText}>Insight not found.</Text>
        <Button label="Go Back" onPress={() => router.back()} />
      </View>
    );
  }

  const recBadge = getRecommendationBadge(insight.recommendation);

  const handleAskDerive = () => {
    Haptics.selectionAsync();
    router.push({
      pathname: '/(tabs)/ask',
      params: {
        initialQuery: `What does the research on "${insight.title}" mean for my routine?`,
      },
    });
  };

  const handleOpenSource = (url?: string) => {
    if (!url) return;
    Haptics.selectionAsync();
    Linking.openURL(url).catch(() => {});
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Icon name="back" size={20} color={colors.ink} />
        </TouchableOpacity>
        <View style={styles.headerTitles}>
          <Text style={styles.headerEyebrow}>RESEARCH INTELLIGENCE</Text>
          <Text style={styles.headerDate}>{insight.date}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Insight Title */}
        <Text style={styles.title}>{insight.title}</Text>

        {/* Derive Recommendation Verdict */}
        <View style={styles.recommendationCard}>
          <View style={styles.recommendationHeader}>
            <Badge label={recBadge.label} variant={recBadge.variant} size="medium" />
            <Badge
              label={`EVIDENCE: ${insight.evidenceStrength.toUpperCase()}`}
              variant="neutral"
              size="small"
            />
          </View>
          <Text style={styles.recommendationReason}>
            {insight.recommendationReason}
          </Text>
        </View>

        {/* Section 1: What the Research Found */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Icon name="sparkle" size={16} color={colors.brand} />
            <Text style={styles.sectionTitle}>What the Research Found</Text>
          </View>
          <View style={styles.bodyCard}>
            <Text style={styles.bodyText}>{insight.summary}</Text>
          </View>
        </View>

        {/* Section 2: Why It Matters To You */}
        {insight.whyItMattersToYou && (
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Icon name="person" size={16} color={colors.brand} />
              <Text style={styles.sectionTitle}>Why It Matters to You</Text>
            </View>
            <View style={[styles.bodyCard, styles.personalizedCard]}>
              <Text style={styles.bodyText}>{insight.whyItMattersToYou}</Text>
            </View>
          </View>
        )}

        {/* Section 3: Peer-Reviewed Sources */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Icon name="checkCircle" size={16} color={colors.inkMuted} />
            <Text style={styles.sectionTitle}>Citations & Sources</Text>
          </View>

          {insight.sources && insight.sources.length > 0 ? (
            <View style={styles.sourcesList}>
              {insight.sources.map((src, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.sourceCard}
                  onPress={() => handleOpenSource(src.url)}
                  disabled={!src.url}
                  activeOpacity={src.url ? 0.7 : 1}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sourceTitle}>{src.title}</Text>
                    <Text style={styles.sourceMeta}>
                      {src.journalOrPublisher ? `${src.journalOrPublisher} · ` : ''}
                      {src.publicationDate}
                    </Text>
                  </View>
                  {src.url && (
                    <Icon name="forward" size={16} color={colors.brand} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={styles.sourceCard}>
              <Text style={styles.sourceTitle}>{insight.source}</Text>
            </View>
          )}
        </View>

        {/* Actions */}
        <View style={styles.actionContainer}>
          {showsProviderBetaFeatures(publicEnvironment.buildFlavor) ? (
          <Button
            label="Ask Derive About This"
            variant="primary"
            size="large"
            onPress={handleAskDerive}
          />
          ) : null}
          <Button
            label="Done"
            variant="ghost"
            size="medium"
            onPress={() => router.back()}
          />
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  headerTitles: {
    flex: 1,
  },
  headerEyebrow: {
    fontSize: 10,
    letterSpacing: 1,
    fontWeight: typography.weights.bold,
    color: colors.brand,
  },
  headerDate: {
    fontSize: typography.sizes.micro,
    color: colors.inkMuted,
    marginTop: 2,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.xl,
  },
  title: {
    fontSize: typography.sizes.screenTitle,
    fontWeight: typography.weights.bold,
    color: colors.ink,
    lineHeight: 32,
    letterSpacing: -0.4,
  },
  recommendationCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadows.subtle,
  },
  recommendationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  recommendationReason: {
    fontSize: typography.sizes.bodyRegular,
    color: colors.ink,
    lineHeight: typography.lineHeights.bodyRegular,
    marginTop: spacing.xs,
  },
  section: {
    gap: spacing.xs,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.bold,
    color: colors.inkMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  bodyCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.md,
  },
  personalizedCard: {
    backgroundColor: colors.brandLight,
    borderColor: colors.border,
  },
  bodyText: {
    fontSize: typography.sizes.bodyRegular,
    color: colors.ink,
    lineHeight: typography.lineHeights.bodyRegular,
  },
  sourcesList: {
    gap: spacing.sm,
  },
  sourceCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sourceTitle: {
    fontSize: typography.sizes.bodyRegular,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    lineHeight: 20,
  },
  sourceMeta: {
    fontSize: typography.sizes.micro,
    color: colors.inkMuted,
    marginTop: 4,
  },
  actionContainer: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  notFoundText: {
    fontSize: typography.sizes.bodyRegular,
    color: colors.inkMuted,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
});
