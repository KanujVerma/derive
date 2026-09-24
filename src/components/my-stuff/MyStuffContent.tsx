import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GroupedSection } from '@/src/components/ui/GroupedSection';
import { Icon } from '@/src/components/ui/Icon';
import { StatusBadge, type StatusBadgeVariant } from '@/src/components/ui/StatusBadge';
import { colors, layout, spacing, typography } from '@/src/constants/theme';
import {
  buildMyStuffPresentation,
  myStuffCopy,
  formatMyStuffDate,
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
  liveFree = false,
  onEditProfile,
  onChangeProductState,
  onRemoveProduct,
  onRemoveEntry,
  onLoadMore,
  hasMore,
  loadingMore,
  busyId,
}: {
  model: MyStuffViewModel;
  liveFree?: boolean;
  onEditProfile?: () => void;
  onChangeProductState?: (id: string, state: ProductState) => void;
  onRemoveProduct?: (id: string) => void;
  onRemoveEntry?: (section: 'checks' | 'experiences', id: string) => void;
  onLoadMore?: (section: 'products' | 'checks' | 'experiences') => void;
  hasMore?: Partial<Record<'products' | 'checks' | 'experiences', boolean>>;
  loadingMore?: Partial<Record<'products' | 'checks' | 'experiences', boolean>>;
  busyId?: string | null;
}) {
  const view = buildMyStuffPresentation(model);
  const copy = myStuffCopy(liveFree);
  const [editingProduct, setEditingProduct] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const removeControl = (section: 'products' | 'checks' | 'experiences', id: string) => {
    const key = `${section}:${id}`;
    return pendingDelete === key ? (
      <View style={styles.actions}>
        <Action label="Confirm remove" disabled={busyId === id} onPress={() => {
          setPendingDelete(null);
          if (section === 'products') onRemoveProduct?.(id);
          else onRemoveEntry?.(section, id);
        }} />
        <Action label="Cancel" onPress={() => setPendingDelete(null)} />
      </View>
    ) : <Action label="Remove" disabled={busyId === id} onPress={() => setPendingDelete(key)} />;
  };
  const moreControl = (section: 'products' | 'checks' | 'experiences') => hasMore?.[section] ? (
    <Action label={loadingMore?.[section] ? 'Loading more…' : 'Load more'}
      disabled={loadingMore?.[section]} onPress={() => onLoadMore?.(section)} />
  ) : null;
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

      <GroupedSection header={copy.productHeader}>
        {view.products.length ? view.products.map((product) => (
          <View key={product.id} style={styles.row}>
            <View style={styles.horizontal}>
              <View style={styles.main}>
                <Text style={styles.title}>{product.name}</Text>
                {product.brand ? <Text style={styles.detail}>{product.brand}</Text> : null}
                {product.source === 'user_reported' ? <Text style={styles.detail}>Added by you · formula unverified</Text> : null}
              </View>
              <StatusBadge label={product.state} variant={productBadge[product.state]} />
            </View>
            {onChangeProductState || onRemoveProduct ? <View style={styles.actions}>
              {onChangeProductState ? <Action label="Change state" disabled={busyId === product.id}
                onPress={() => setEditingProduct(editingProduct === product.id ? null : product.id)} /> : null}
              {onRemoveProduct ? removeControl('products', product.id) : null}
            </View> : null}
            {editingProduct === product.id ? <View style={styles.actions}>
              {(['using', 'considering', 'stopped'] as const).filter((state) => state !== product.state).map((state) => (
                <Action key={state} label={state} disabled={busyId === product.id} onPress={() => {
                  setEditingProduct(null);
                  onChangeProductState?.(product.id, state);
                }} />
              ))}
            </View> : null}
          </View>
        )) : <EmptyRow text={view.productSummary} />}
        {moreControl('products')}
      </GroupedSection>

      <GroupedSection header="Check history">
        {view.checks.length ? view.checks.map((check) => (
          <View key={check.id} style={styles.row}>
            <View style={styles.horizontal}>
              <Text style={[styles.title, styles.main]}>{check.productName}</Text>
              <Text style={styles.detail}>{formatMyStuffDate(check.checkedAt, liveFree)}</Text>
            </View>
            {onRemoveEntry ? removeControl('checks', check.id) : null}
          </View>
        )) : <EmptyRow text={view.checkSummary} />}
        {moreControl('checks')}
      </GroupedSection>

      <GroupedSection header={copy.experienceHeader} footer={copy.experienceFooter}>
        {view.experiences.length ? view.experiences.map((experience) => (
          <View key={experience.id} style={styles.row}>
            <View style={styles.horizontal}>
              <View style={styles.main}>
                <Text style={styles.title}>{experience.productName}</Text>
                {experience.source === 'user_reported' ? <Text style={styles.detail}>Added by you</Text> : null}
                {experience.note ? <Text style={styles.detail}>{experience.note}</Text> : null}
                {experience.notedAt ? <Text style={styles.detail}>{formatMyStuffDate(experience.notedAt, liveFree)}</Text> : null}
              </View>
              <StatusBadge label={experience.kind} variant={experienceBadge[experience.kind]} />
            </View>
            {onRemoveEntry ? removeControl('experiences', experience.id) : null}
          </View>
        )) : <EmptyRow text={view.experienceSummary} />}
        {moreControl('experiences')}
      </GroupedSection>
    </>
  );
}

function Action({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
    <Text style={styles.actionText}>{label}</Text>
  </Pressable>;
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
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  action: { minHeight: layout.minTouchTarget, justifyContent: 'center', paddingHorizontal: spacing.sm },
  actionText: { color: colors.brand, fontSize: typography.sizes.caption, fontWeight: typography.weights.semibold },
  pressed: { backgroundColor: colors.brandLight },
});
