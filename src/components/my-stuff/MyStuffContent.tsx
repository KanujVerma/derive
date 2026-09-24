import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GroupedSection } from '@/src/components/ui/GroupedSection';
import { Icon } from '@/src/components/ui/Icon';
import { StatusBadge, type StatusBadgeVariant } from '@/src/components/ui/StatusBadge';
import { colors, layout, spacing, typography } from '@/src/constants/theme';
import {
  buildMyStuffPresentation,
  type ExperienceKind,
  type MyStuffViewModel,
  type ProductState,
} from '@/src/presentation/my-stuff/myStuffPresentation';

const productBadge: Record<ProductState, StatusBadgeVariant> = {
  using: 'keep',
  considering: 'review',
  stopped: 'info',
};
const experienceBadge: Record<ExperienceKind, StatusBadgeVariant> = {
  tolerated: 'keep',
  reacted: 'alert',
  liked: 'active',
  finished: 'info',
};

function EmptyRow({ text }: { text: string }) {
  return <Text style={[styles.row, styles.empty]}>{text}</Text>;
}

/** Pure presentation: caller supplies owner-scoped context and an optional edit action. */
export function MyStuffContent({
  model,
  onEditProfile,
}: {
  model: MyStuffViewModel;
  onEditProfile?: () => void;
}) {
  const view = buildMyStuffPresentation(model);
  const profileRow = (
    <View style={[styles.row, styles.horizontal]}>
      <View style={styles.main}>
        <Text style={styles.title}>{view.profile.summary}</Text>
        {view.profile.skinFeel ? <Text style={styles.detail}>{view.profile.skinFeel}</Text> : null}
        {view.profile.concerns.length > 0 ? (
          <Text style={styles.detail}>{view.profile.concerns.join(' · ')}</Text>
        ) : null}
      </View>
      {onEditProfile ? <Icon name="forward" size={18} color={colors.inkMuted} /> : null}
    </View>
  );

  return (
    <>
      <GroupedSection header="Skin profile">
        {onEditProfile ? (
          <Pressable
            onPress={onEditProfile}
            accessibilityRole="button"
            accessibilityLabel="Edit skin profile"
            style={({ pressed }) => pressed && styles.pressed}
          >
            {profileRow}
          </Pressable>
        ) : profileRow}
      </GroupedSection>

      <GroupedSection header="Current products">
        {view.products.length ? view.products.map((product) => (
          <View key={product.id} style={[styles.row, styles.horizontal]}>
            <View style={styles.main}>
              <Text style={styles.title}>{product.name}</Text>
              {product.brand ? <Text style={styles.detail}>{product.brand}</Text> : null}
            </View>
            <StatusBadge label={product.state} variant={productBadge[product.state]} />
          </View>
        )) : <EmptyRow text={view.productSummary} />}
      </GroupedSection>

      <GroupedSection header="Check history">
        {view.checks.length ? view.checks.map((check) => (
          <View key={check.id} style={[styles.row, styles.horizontal]}>
            <Text style={[styles.title, styles.main]}>{check.productName}</Text>
            <Text style={styles.detail}>{check.checkedAt}</Text>
          </View>
        )) : <EmptyRow text={view.checkSummary} />}
      </GroupedSection>

      <GroupedSection header="Reactions & tolerance" footer="Your own observations, separate from a medical diagnosis.">
        {view.experiences.length ? view.experiences.map((experience) => (
          <View key={experience.id} style={[styles.row, styles.horizontal]}>
            <View style={styles.main}>
              <Text style={styles.title}>{experience.productName}</Text>
              {experience.note ? <Text style={styles.detail}>{experience.note}</Text> : null}
              {experience.notedAt ? <Text style={styles.detail}>{experience.notedAt}</Text> : null}
            </View>
            <StatusBadge label={experience.kind} variant={experienceBadge[experience.kind]} />
          </View>
        )) : <EmptyRow text={view.experienceSummary} />}
      </GroupedSection>
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: layout.minTouchTarget + 12,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
  },
  horizontal: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  main: { flex: 1 },
  title: {
    color: colors.ink,
    fontSize: typography.sizes.bodyRegular,
    lineHeight: typography.lineHeights.bodyRegular,
    fontWeight: typography.weights.semibold,
  },
  detail: {
    color: colors.inkMuted,
    fontSize: typography.sizes.caption,
    lineHeight: typography.lineHeights.caption,
    marginTop: spacing.xxs,
  },
  empty: {
    color: colors.inkMuted,
    fontSize: typography.sizes.bodyRegular,
    lineHeight: typography.lineHeights.bodyRegular,
  },
  pressed: { backgroundColor: colors.brandLight },
});
