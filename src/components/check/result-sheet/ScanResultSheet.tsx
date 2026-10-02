import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ProductTruthSnapshotV1 } from '../../../contracts/ProductTruthSnapshot';
import type { ProductResolutionResult } from '../../../contracts/ProductIdentityResolver';
import { colors, layout, radii, spacing, typography } from '../../../constants/theme';
import { Icon } from '../../ui/Icon';
import { CheckResultContent, CheckResultView } from './CheckResultContent';
import { ResultSheetSurface } from './ResultSheetSurface';
import { describeCheckResultContent, resultSheetRecoveryCopy, type CheckResultContentInput } from '../../../presentation/check/result-sheet/content';
import type { DecisionNextStep } from '../../../contracts/PersonalDecision';
import type { RequestedEvidenceAction, SheetBinding, SheetImage, SheetModel } from '../../../presentation/check/result-sheet/model';
import { isCurrentRequestedEvidenceAction, isCurrentSheetBinding,
  selectCurrentSheetModel, resultSheetPresentationKey } from '../../../presentation/check/result-sheet/model';

export interface ScanResultSheetProps {
  /** Null removes the sheet. The camera host retains ownership of detection and navigation. */
  model: SheetModel | null;
  currentOwnerId: string | null;
  currentSnapshot: ProductTruthSnapshotV1 | null;
  currentResolverResult: ProductResolutionResult | null;
  currentScanId: string;
  bottomInset?: number;
  onDetectionPausedChange?: (paused: boolean) => void;
  onDismiss: () => void;
  onOpenDetails?: (binding: SheetBinding) => void;
  onAddRequestedEvidence?: (action: RequestedEvidenceAction) => void;
  contentInput?: CheckResultContentInput;
  onNextStep?: (step: DecisionNextStep) => void;
  onPersonalize?: () => void;
  onOpenSource?: (url: string) => void;
  dismissLabel?: string;
  compactActions?: React.ReactNode;
  replacement?: React.ReactNode;
  searchOnly?: boolean;
  searchEmpty?: boolean;
  children?: React.ReactNode;
}

function ProductThumbnail({ image }: { image: SheetImage }) {
  return (
    <View style={styles.thumbnail} accessible accessibilityLabel={image.kind === 'catalog' ? image.label
      : image.kind === 'customer_unverified' ? image.label : 'No product image available'}>
      {image.kind === 'placeholder'
        ? <Icon name="bottle" size={25} color={colors.brand} />
        : <Image source={{ uri: image.uri }} style={styles.thumbnailImage} resizeMode="contain" />}
    </View>
  );
}

/** Floating camera companion. The host must stop barcode detection while model is non-null. */
export function ScanResultSheet({ model, currentOwnerId, currentSnapshot, currentResolverResult, currentScanId, bottomInset = 0,
  onDetectionPausedChange, onDismiss, onAddRequestedEvidence, contentInput, onNextStep,
  onPersonalize, onOpenSource, compactActions, replacement, searchOnly = false, searchEmpty = true, children, dismissLabel = 'Close result and scan another product' }: ScanResultSheetProps) {
  const onPauseRef = useRef(onDetectionPausedChange);
  onPauseRef.current = onDetectionPausedChange;
  const visibleModel = selectCurrentSheetModel(model, currentOwnerId, currentSnapshot, currentScanId);
  const open = visibleModel !== null;
  const sheetKey = resultSheetPresentationKey(visibleModel);

  useEffect(() => {
    onPauseRef.current?.(open);
    return () => { if (open) onPauseRef.current?.(false); };
  }, [open]);
  if (!visibleModel) return null;

  const addRequestedEvidence = () => {
    if (visibleModel.kind !== 'result' || !visibleModel.requestedEvidence || !currentSnapshot || !onAddRequestedEvidence) return;
    if (isCurrentRequestedEvidenceAction(visibleModel.requestedEvidence, currentOwnerId, currentSnapshot, currentResolverResult)) {
      onAddRequestedEvidence(visibleModel.requestedEvidence);
    }
  };
  const canAddRequestedEvidence = visibleModel.kind === 'result' && Boolean(visibleModel.requestedEvidence
    && currentSnapshot && onAddRequestedEvidence
    && isCurrentRequestedEvidenceAction(visibleModel.requestedEvidence, currentOwnerId, currentSnapshot, currentResolverResult));
  const currentContent = visibleModel.kind === 'result' && contentInput?.snapshot
    && contentInput.ownerId === currentOwnerId
    && isCurrentSheetBinding(visibleModel.binding, currentOwnerId, contentInput.snapshot) ? contentInput : null;
  const contentModel = currentContent ? describeCheckResultContent(currentContent) : null;
  const hasContentAction = contentModel?.fit.kind === 'canonical'
    && Boolean(onNextStep || contentModel.canPersonalize && onPersonalize);
  const nextAction = visibleModel.kind === 'result'
    ? resultSheetRecoveryCopy(visibleModel, canAddRequestedEvidence, contentModel, hasContentAction) : null;

  const summary = <View style={{ gap: spacing.md }}>
          <View style={styles.summary}>
            {visibleModel.kind === 'result'
              ? <ProductThumbnail image={visibleModel.image} />
              : <View style={styles.thumbnail}><Icon name="scan" size={25} color={colors.brand} /></View>}
            <View style={styles.summaryCopy}>
              {visibleModel.kind === 'loading' && <ActivityIndicator size="small" color={colors.brand} style={styles.loading} />}
              {visibleModel.kind === 'result' && visibleModel.brand && <Text style={styles.brand}>{visibleModel.brand}</Text>}
              <Text style={styles.title} accessibilityRole="header">{visibleModel.title}</Text>
            </View>
          </View>
          {visibleModel.kind === 'result' && visibleModel.image.kind !== 'placeholder'
            && <Text style={styles.photoLabel}>{visibleModel.image.label}</Text>}
    {currentContent ? <CheckResultContent input={currentContent} section="summary" showIdentity={false} />
      : visibleModel.kind === 'result' || visibleModel.kind === 'unknown' ? <CheckResultView showIdentity={false} section="summary"
        facts={{ brand: visibleModel.kind === 'result' ? visibleModel.brand ?? '' : '', name: visibleModel.title, categoryLabel: '', formula: null, source: null }}
        verdict={{ state: 'unknown', label: 'Not enough information', reason: visibleModel.detail, findings: [] }} />
      : <Text style={styles.detail}>{visibleModel.detail}</Text>}
  </View>;
  return (
    <ResultSheetSurface inline presentationKey={sheetKey} onClose={onDismiss} dismissLabel={dismissLabel}
      contentSized={searchOnly} contentSizeResetKey={searchOnly ? (searchEmpty ? 'empty' : 'query') : undefined} summary={searchOnly ? null : summary} bottomInset={bottomInset} replacement={replacement}
      compactActions={searchOnly ? compactActions : <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
        {canAddRequestedEvidence && <Pressable onPress={addRequestedEvidence} style={styles.evidenceAction} accessibilityRole="button"
          accessibilityLabel="Photograph ingredients" accessibilityHint="Adds evidence to this same product check">
          <Icon name="camera" size={17} color={colors.brand} /><Text style={styles.evidenceActionText}>Photograph ingredients</Text>
        </Pressable>}
        {compactActions}
      </View>}>
            {!searchOnly && (currentContent || nextAction && nextAction !== 'View formula details') && <View style={[styles.details, styles.detailsContent]}>
              {currentContent ? <CheckResultContent input={currentContent} section="findings" showIdentity={false}
                onNextStep={onNextStep} onPersonalize={onPersonalize} onOpenSource={onOpenSource} />
                : null}
              {nextAction && nextAction !== 'View formula details' && <Text style={styles.nextAction}>{nextAction}</Text>}

            </View>}
        {!searchOnly && children}
    </ResultSheetSurface>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  thumbnail: { width: 56, height: 56, borderRadius: radii.md, backgroundColor: colors.brandLight,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  thumbnailImage: { width: 56, height: 56 },
  summaryCopy: { flex: 1, minWidth: 0 },
  brand: { color: colors.inkMuted, fontSize: typography.sizes.caption, fontWeight: typography.weights.medium },
  title: { color: colors.ink, fontSize: typography.sizes.bodyLarge, fontWeight: typography.weights.semibold, lineHeight: typography.lineHeights.bodyLarge },
  status: { color: colors.inkMuted, fontSize: typography.sizes.caption, fontWeight: typography.weights.medium },
  loading: { alignSelf: 'flex-start', marginBottom: spacing.xxs },
  photoLabel: { color: colors.inkMuted, fontSize: typography.sizes.micro, marginTop: spacing.xxs },
  details: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: spacing.md },
  detailsContent: { paddingTop: spacing.md, gap: spacing.sm },
  detail: { color: colors.ink, fontSize: typography.sizes.bodyRegular, lineHeight: typography.lineHeights.bodyRegular },
  nextAction: { color: colors.inkMuted, fontSize: typography.sizes.caption, lineHeight: typography.lineHeights.caption },
  evidenceAction: { minHeight: layout.minTouchTarget, alignSelf: 'flex-start', flexDirection: 'row',
    alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radii.full,
    backgroundColor: colors.brandLight },
  evidenceActionText: { color: colors.brand, fontSize: typography.sizes.caption, fontWeight: typography.weights.semibold },
});
