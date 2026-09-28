import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, LayoutAnimation, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ProductTruthSnapshotV1 } from '../../../contracts/ProductTruthSnapshot';
import type { ProductResolutionResult } from '../../../contracts/ProductIdentityResolver';
import { colors, layout, radii, spacing, typography } from '../../../constants/theme';
import { GlassContainer } from '../../ui/GlassContainer';
import { Icon } from '../../ui/Icon';
import type { RequestedEvidenceAction, SheetBinding, SheetImage, SheetModel } from '../../../presentation/check/result-sheet/model';
import { isCurrentRequestedEvidenceAction, isCurrentSheetBinding, selectCurrentSheetModel } from '../../../presentation/check/result-sheet/model';

export interface ScanResultSheetProps {
  /** Null removes the sheet. The camera host retains ownership of detection and navigation. */
  model: SheetModel | null;
  currentOwnerId: string | null;
  currentSnapshot: ProductTruthSnapshotV1 | null;
  currentResolverResult: ProductResolutionResult | null;
  bottomInset?: number;
  onDetectionPausedChange: (paused: boolean) => void;
  onDismiss: () => void;
  onOpenDetails?: (binding: SheetBinding) => void;
  onAddRequestedEvidence?: (action: RequestedEvidenceAction) => void;
}

function ProductThumbnail({ image }: { image: SheetImage }) {
  return (
    <View style={styles.thumbnail} accessible accessibilityLabel={image.kind === 'catalog' ? 'Catalog product image'
      : image.kind === 'customer_unverified' ? image.label : 'No product image available'}>
      {image.kind === 'placeholder'
        ? <Icon name="bottle" size={25} color={colors.brand} />
        : <Image source={{ uri: image.uri }} style={styles.thumbnailImage} resizeMode="contain" />}
    </View>
  );
}

/** Floating camera companion. The host must stop barcode detection while model is non-null. */
export function ScanResultSheet({ model, currentOwnerId, currentSnapshot, currentResolverResult, bottomInset = 0,
  onDetectionPausedChange, onDismiss, onOpenDetails, onAddRequestedEvidence }: ScanResultSheetProps) {
  const [expanded, setExpanded] = useState(false);
  const onPauseRef = useRef(onDetectionPausedChange);
  onPauseRef.current = onDetectionPausedChange;
  const visibleModel = selectCurrentSheetModel(model, currentOwnerId, currentSnapshot);
  const open = visibleModel !== null;
  const sheetKey = visibleModel?.kind === 'result'
    ? `${visibleModel.binding.caseId}:${visibleModel.binding.snapshotId}:${visibleModel.binding.caseRevision}` : visibleModel?.kind ?? 'closed';

  useEffect(() => {
    onPauseRef.current(open);
    return () => { if (open) onPauseRef.current(false); };
  }, [open]);
  useEffect(() => { setExpanded(false); }, [sheetKey]);

  const move = (next: boolean) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(next);
  };
  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dy) > 14,
    onPanResponderRelease: (_event, gesture) => {
      if (gesture.dy < -28) move(true);
      if (gesture.dy > 28) move(false);
    },
  }), []);

  if (!visibleModel) return null;

  const openDetails = () => {
    if (visibleModel.kind !== 'result' || !currentSnapshot || !onOpenDetails) return;
    if (isCurrentSheetBinding(visibleModel.binding, currentOwnerId, currentSnapshot)) onOpenDetails(visibleModel.binding);
  };
  const addRequestedEvidence = () => {
    if (visibleModel.kind !== 'result' || !visibleModel.requestedEvidence || !currentSnapshot || !onAddRequestedEvidence) return;
    if (isCurrentRequestedEvidenceAction(visibleModel.requestedEvidence, currentOwnerId, currentSnapshot, currentResolverResult)) {
      onAddRequestedEvidence(visibleModel.requestedEvidence);
    }
  };
  const canAddRequestedEvidence = visibleModel.kind === 'result' && Boolean(visibleModel.requestedEvidence
    && currentSnapshot && onAddRequestedEvidence
    && isCurrentRequestedEvidenceAction(visibleModel.requestedEvidence, currentOwnerId, currentSnapshot, currentResolverResult));

  return (
    <View style={[styles.position, { bottom: Math.max(bottomInset, spacing.md) }]}>
      <GlassContainer tintColor={colors.glass.tintLight} isFloating style={styles.sheet}>
        <View {...pan.panHandlers} style={styles.dragRegion}>
          <Pressable
            style={styles.dragTarget}
            onPress={() => move(!expanded)}
            accessibilityRole="button"
            accessibilityLabel={expanded ? 'Collapse result' : 'Expand result'}
            accessibilityState={{ expanded }}
          >
            <View style={styles.handle} />
          </Pressable>
        </View>
        <View style={styles.content}>
          <View style={styles.summary}>
            {visibleModel.kind === 'result'
              ? <ProductThumbnail image={visibleModel.image} />
              : <View style={styles.thumbnail}><Icon name="scan" size={25} color={colors.brand} /></View>}
            <View style={styles.summaryCopy}>
              {visibleModel.kind === 'loading' && <ActivityIndicator size="small" color={colors.brand} style={styles.loading} />}
              {visibleModel.kind === 'result' && visibleModel.brand && <Text style={styles.brand} numberOfLines={1}>{visibleModel.brand}</Text>}
              <Text style={styles.title} numberOfLines={2}>{visibleModel.title}</Text>
              {visibleModel.kind === 'result' && <Text style={styles.status} numberOfLines={1}>{visibleModel.status}</Text>}
            </View>
            <Pressable onPress={onDismiss} style={styles.close} accessibilityRole="button"
              accessibilityLabel="Close result and scan another product" hitSlop={8}>
              <Icon name="close" size={19} color={colors.inkMuted} />
            </Pressable>
          </View>
          {visibleModel.kind === 'result' && visibleModel.image.kind === 'customer_unverified'
            && <Text style={styles.photoLabel}>{visibleModel.image.label}</Text>}
          {expanded && (
            <View style={styles.details}>
              <Text style={styles.detail}>{visibleModel.detail}</Text>
              {visibleModel.kind === 'result' && !canAddRequestedEvidence
                && <Text style={styles.nextAction}>{visibleModel.nextAction}</Text>}
              {canAddRequestedEvidence && (
                <Pressable onPress={addRequestedEvidence} style={styles.evidenceAction} accessibilityRole="button"
                  accessibilityLabel="Add ingredient photo" accessibilityHint="Adds evidence to this product check">
                  <Icon name="camera" size={17} color={colors.brand} />
                  <Text style={styles.evidenceActionText}>Add ingredient photo</Text>
                </Pressable>
              )}
              {visibleModel.kind === 'result' && onOpenDetails && (
                <Pressable onPress={openDetails} style={styles.detailsAction} accessibilityRole="button"
                  accessibilityLabel="View full result" accessibilityHint="Opens the complete result for this product">
                  <Text style={styles.detailsActionText}>View full result</Text>
                  <Icon name="forward" size={17} color={colors.inkInverse} />
                </Pressable>
              )}
            </View>
          )}
        </View>
      </GlassContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  position: { position: 'absolute', left: spacing.md, right: spacing.md, zIndex: 20 },
  sheet: { borderRadius: radii.xl },
  dragRegion: { minHeight: layout.minTouchTarget, alignItems: 'center', justifyContent: 'center' },
  dragTarget: { minWidth: 80, minHeight: layout.minTouchTarget, alignItems: 'center', justifyContent: 'center' },
  handle: { width: 36, height: 5, borderRadius: radii.full, backgroundColor: colors.borderStrong },
  content: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  summary: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  thumbnail: { width: 56, height: 56, borderRadius: radii.md, backgroundColor: colors.brandLight,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  thumbnailImage: { width: 56, height: 56 },
  summaryCopy: { flex: 1, minWidth: 0 },
  brand: { color: colors.inkMuted, fontSize: typography.sizes.caption, fontWeight: typography.weights.medium },
  title: { color: colors.ink, fontSize: typography.sizes.bodyLarge, fontWeight: typography.weights.semibold, lineHeight: typography.lineHeights.bodyLarge },
  status: { color: colors.brand, fontSize: typography.sizes.caption, fontWeight: typography.weights.semibold },
  loading: { alignSelf: 'flex-start', marginBottom: spacing.xxs },
  close: { width: layout.minTouchTarget, height: layout.minTouchTarget, borderRadius: radii.full,
    alignItems: 'center', justifyContent: 'center' },
  photoLabel: { color: colors.inkMuted, fontSize: typography.sizes.micro, marginTop: spacing.xxs },
  details: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: spacing.md, paddingTop: spacing.md, gap: spacing.sm },
  detail: { color: colors.ink, fontSize: typography.sizes.bodyRegular, lineHeight: typography.lineHeights.bodyRegular },
  nextAction: { color: colors.inkMuted, fontSize: typography.sizes.caption, lineHeight: typography.lineHeights.caption },
  evidenceAction: { minHeight: layout.minTouchTarget, alignSelf: 'flex-start', flexDirection: 'row',
    alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radii.full,
    backgroundColor: colors.brandLight },
  evidenceActionText: { color: colors.brand, fontSize: typography.sizes.caption, fontWeight: typography.weights.semibold },
  detailsAction: { minHeight: layout.minTouchTarget, alignSelf: 'flex-start', flexDirection: 'row',
    alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radii.full,
    backgroundColor: colors.brand },
  detailsActionText: { color: colors.inkInverse, fontSize: typography.sizes.caption, fontWeight: typography.weights.semibold },
});
