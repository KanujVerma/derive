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
  experienceLabels,
  type CanonicalExperienceView,
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
  tolerated: 'info',
  reacted: 'alert',
  liked: 'active',
  finished: 'info',
  no_reaction_reported: 'info',
  ineffective: 'info',
};

function EmptyRow({ text }: { text: string }) {
  return <Text style={[styles.row, styles.empty]}>{text}</Text>;
}

/** Pure presentation: caller supplies owner-scoped context and an optional edit action. */
export function MyStuffContent({
  model,
  liveFree = false,
  onEditProfile,
  profileContent, experienceHeader, experienceEmptyText,
  onChangeProductState,
  onRemoveProduct,
  onRemoveEntry,
  onLoadMore,
  hasMore,
  loadingMore,
  busyId,
  onAddProduct, onAddExperience, onCorrectExperience, onAddProductExperience,
  canonicalExperiences, experienceStatus = 'ready', experienceError, onRetryExperiences,
  hasMoreCanonicalExperiences, onLoadMoreCanonicalExperiences,
  memoryStatus = 'ready', onEditRoutine,
}: {
  model: MyStuffViewModel;
  liveFree?: boolean;
  profileContent?: React.ReactNode;
  experienceHeader?: string;
  experienceEmptyText?: string;
  onEditProfile?: () => void;
  onChangeProductState?: (id: string, state: ProductState) => void;
  onRemoveProduct?: (id: string) => void;
  onRemoveEntry?: (section: 'checks' | 'experiences', id: string) => void;
  onLoadMore?: (section: 'products' | 'checks' | 'experiences') => void;
  hasMore?: Partial<Record<'products' | 'checks' | 'experiences', boolean>>;
  loadingMore?: Partial<Record<'products' | 'checks' | 'experiences', boolean>>;
  busyId?: string | null;
  onAddProduct?: () => void;
  onAddExperience?: () => void;
  onCorrectExperience?: (stableExperienceId: string) => void;
  onAddProductExperience?: (product: MyStuffViewModel['products'][number]) => void;
  canonicalExperiences?: readonly CanonicalExperienceView[];
  experienceStatus?: 'loading' | 'ready' | 'error';
  experienceError?: string | null;
  onRetryExperiences?: () => void;
  hasMoreCanonicalExperiences?: boolean;
  onLoadMoreCanonicalExperiences?: () => void;
  memoryStatus?: 'loading' | 'ready' | 'error';
  onEditRoutine?: () => void;
}) {
  const view = buildMyStuffPresentation(model, canonicalExperiences);
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
        <Text style={styles.title}>{model.profile ? view.profile.summary : 'Set up skin profile'}</Text>
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
      {profileContent ?? (
      <GroupedSection header="Skin profile">
        {onEditProfile ? (
          <Pressable
            onPress={onEditProfile}
            accessibilityRole="button"
            accessibilityLabel={model.profile ? "Edit skin profile" : "Set up skin profile"}
            style={({ pressed }) => pressed && styles.pressed}
          >
            {profileRow}
          </Pressable>
        ) : profileRow}
      </GroupedSection>
      )}

      <GroupedSection header={copy.productHeader} headerAction={onAddProduct ? { label: '+ Add', accessibilityLabel: 'Add product', onPress: onAddProduct, disabled: !!busyId } : undefined}>
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
            {onAddProductExperience ? <Action label="Add experience" accessibilityLabel={`Add experience for ${product.name}`} disabled={!!busyId} onPress={() => onAddProductExperience(product)} /> : null}
            {editingProduct === product.id ? <View style={styles.actions}>
              {(['using', 'considering', 'stopped'] as const).filter((state) => state !== product.state).map((state) => (
                <Action key={state} label={state} disabled={busyId === product.id} onPress={() => {
                  setEditingProduct(null);
                  onChangeProductState?.(product.id, state);
                }} />
              ))}
            </View> : null}
          </View>
        )) : <EmptyRow text={memoryStatus === 'loading' ? 'Loading your products...' : memoryStatus === 'error' ? 'Unavailable' : view.productSummary} />}
        {onEditRoutine ? <Action label="Review products I use" onPress={onEditRoutine} disabled={!!busyId} /> : null}
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
        )) : <EmptyRow text={memoryStatus === 'loading' ? 'Loading your checks...' : memoryStatus === 'error' ? 'Unavailable' : view.checkSummary} />}
        {moreControl('checks')}
      </GroupedSection>

      <GroupedSection header={canonicalExperiences ? copy.experienceHeader : experienceHeader ?? copy.experienceHeader}
        headerAction={onAddExperience ? { label: '+ Add', accessibilityLabel: 'Add experience', onPress: onAddExperience, disabled: !!busyId || experienceStatus === 'loading' } : undefined}
        footer={copy.experienceFooter}>
        {experienceStatus === 'loading' ? <EmptyRow text="Loading your experiences..." /> : null}
        {experienceStatus === 'error' ? <View style={styles.row}>
          <Text style={styles.detail} accessibilityRole="alert">{experienceError ?? 'Your experiences could not be loaded.'}</Text>
          {onRetryExperiences ? <Action label="Try again" onPress={onRetryExperiences} /> : null}
        </View> : null}
        {view.experienceRows.length ? view.experienceRows.map((experience) => (
          <View key={experience.key} style={styles.row}>
            <View style={styles.horizontal}>
              <View style={styles.main}>
                <Text style={styles.title}>{experience.productName}</Text>
                <Text style={styles.detail}>{experience.origin === 'personal_context' ? 'Your report' : 'Saved report'}</Text>
                {experience.formulaContext === 'manual' ? <Text style={styles.detail}>Added by you · formula unverified</Text>
                  : experience.formulaContext === 'unconfirmed' ? <Text style={styles.detail}>Formula at the time of use is unconfirmed</Text> : null}
                {experience.note ? <Text style={styles.detail}>{experience.note}</Text> : null}
                {experience.occurred?.start ? <Text style={styles.detail}>{experience.occurred.start}{experience.occurred.end && experience.occurred.end !== experience.occurred.start ? ` to ${experience.occurred.end}` : ''}</Text>
                  : experience.occurred?.end ? <Text style={styles.detail}>Until {experience.occurred.end}</Text> : null}
                {experience.notedAt ? <Text style={styles.detail}>Saved {formatMyStuffDate(experience.notedAt, liveFree)}</Text> : null}
              </View>
              <StatusBadge label={experienceLabels[experience.kind]} variant={experienceBadge[experience.kind]} />
            </View>
            {experience.origin === 'personal_context' && onCorrectExperience ? <Action label="Correct experience" accessibilityLabel={`Correct experience for ${experience.productName}`} disabled={!!busyId || experienceStatus === 'loading'} onPress={() => onCorrectExperience(experience.id)} /> : null}
            {experience.origin === 'legacy_free_context' && onRemoveEntry ? removeControl('experiences', experience.id) : null}
          </View>
        )) : experienceStatus === 'ready' ? <EmptyRow text={canonicalExperiences ? view.experienceSummary : experienceEmptyText ?? view.experienceSummary} /> : null}
        {hasMoreCanonicalExperiences && onLoadMoreCanonicalExperiences ? <Action label={experienceStatus === 'loading' ? 'Loading more...' : 'Load more experiences'} disabled={experienceStatus === 'loading'} onPress={onLoadMoreCanonicalExperiences} /> : null}
        {moreControl('experiences')}
      </GroupedSection>
    </>
  );
}

function Action({ label, accessibilityLabel, onPress, disabled }: { label: string; accessibilityLabel?: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress}
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
  horizontal: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
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
