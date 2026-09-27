import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/src/components/ui/Button';
import { TextField } from '@/src/components/ui/TextField';
import { colors, spacing, typography } from '@/src/constants/theme';
import type { CatalogContributionRequest } from '@/src/domain/catalog-contribution/proposal';
import {
  createContributionDraft, prepareContributionReview, type ContributionDraft,
  type ContributionDraftErrors, type ContributionReviewAttempt,
} from '@/src/presentation/catalog-contribution/draft';
import { describeContributionExperience } from '@/src/presentation/catalog-contribution/experience';

type ContributionAvailability =
  | { kind: 'unavailable' }
  | {
      kind: 'available';
      /** The caller owns the later consent and submission step. This callback only opens review. */
      onReviewRequest: (request: CatalogContributionRequest) => void;
      createRequestId: () => string;
    };

export interface MissingProductContributionProps {
  /** Changes for each owner or Check case so private draft state never crosses sessions. */
  contextKey: string;
  availability: ContributionAvailability;
  initial?: Partial<ContributionDraft>;
  onTryAnotherWay: () => void;
}

/** Recovery and draft collection only. This component never submits or saves catalog truth. */
export function MissingProductContribution({ contextKey, ...props }: MissingProductContributionProps) {
  return <ContributionBody key={contextKey} {...props} />;
}

function ContributionBody({ availability, initial, onTryAnotherWay }:
  Omit<MissingProductContributionProps, 'contextKey'>) {
  const [draft, setDraft] = useState(() => createContributionDraft(initial));
  const [editing, setEditing] = useState(false);
  const [showMore, setShowMore] = useState(() => Boolean(initial?.gtin || initial?.variant || initial?.packageSize || initial?.region));
  const [includePrivateEvidence, setIncludePrivateEvidence] = useState(false);
  const [errors, setErrors] = useState<ContributionDraftErrors>({});
  const reviewAttempt = useRef<ContributionReviewAttempt | null>(null);
  const view = describeContributionExperience(availability.kind);

  const update = (key: Exclude<keyof ContributionDraft, 'evidence'>, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined, requestId: undefined }));
  };
  const review = () => {
    if (availability.kind !== 'available') return;
    const result = prepareContributionReview(draft, reviewAttempt.current,
      availability.createRequestId, { includePrivateEvidence });
    if (result.kind === 'invalid') {
      setErrors(result.errors);
      if (result.errors.gtin || result.errors.variant || result.errors.packageSize || result.errors.region) setShowMore(true);
      return;
    }
    reviewAttempt.current = result.attempt;
    availability.onReviewRequest(result.request);
  };

  if (!editing || !view.canPrepareRequest) return (
    <View style={styles.container}>
      <Text style={styles.heading}>We couldn’t find this product.</Text>
      <Text style={styles.body}>{view.explanation}</Text>
      {view.primaryAction === 'help_add_product' ? (
        <Button label="Help add product" variant="brand" onPress={() => setEditing(true)} style={styles.action} />
      ) : null}
      <Button label="Try another way" variant={view.primaryAction === 'help_add_product' ? 'outline' : 'brand'}
        onPress={onTryAnotherWay} style={styles.action} />
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Help add this product</Text>
      <Text style={styles.body}>{view.explanation}</Text>
      <TextField label="Brand" value={draft.brand} onChangeText={(value) => update('brand', value)} error={errors.brand} />
      <TextField label="Product name" value={draft.name} onChangeText={(value) => update('name', value)} error={errors.name} />
      <Pressable accessibilityRole="button" accessibilityLabel={showMore ? 'Hide more details' : 'Add more details'}
        onPress={() => setShowMore((current) => !current)} style={styles.moreAction}>
        <Text style={styles.moreText}>{showMore ? 'Hide more details' : 'Add more details (optional)'}</Text>
      </Pressable>
      {showMore ? <>
        <TextField label="Barcode number (optional)" value={draft.gtin} onChangeText={(value) => update('gtin', value)}
          keyboardType="number-pad" error={errors.gtin} />
        <TextField label="Variant (optional)" value={draft.variant} onChangeText={(value) => update('variant', value)} error={errors.variant} />
        <TextField label="Package size (optional)" value={draft.packageSize} onChangeText={(value) => update('packageSize', value)} error={errors.packageSize} />
        <TextField label="Country code (optional)" value={draft.region} onChangeText={(value) => update('region', value)}
          autoCapitalize="characters" error={errors.region} />
      </> : null}
      {draft.evidence.length > 0 ? (
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: includePrivateEvidence }}
          onPress={() => setIncludePrivateEvidence((current) => !current)} style={styles.photoChoice}>
          <Text style={styles.body}>{includePrivateEvidence ? '☑' : '☐'} Include the private package photos I already took</Text>
        </Pressable>
      ) : null}
      {errors.evidence ? <Text style={styles.error}>{errors.evidence}</Text> : null}
      {errors.requestId ? <Text style={styles.error}>{errors.requestId}</Text> : null}
      <Text style={styles.note}>Next, review what you entered before choosing whether to send a request. This does not add a product to Derive.</Text>
      <Button label={view.reviewActionLabel} variant="brand" onPress={review} style={styles.action} />
      <Button label="Back" variant="outline" onPress={() => setEditing(false)} style={styles.action} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, backgroundColor: colors.canvas },
  heading: { color: colors.ink, fontSize: typography.sizes.sectionTitle,
    lineHeight: typography.lineHeights.sectionTitle, fontWeight: typography.weights.semibold,
    marginBottom: spacing.sm },
  body: { color: colors.inkMuted, fontSize: typography.sizes.bodyRegular,
    lineHeight: typography.lineHeights.bodyRegular, marginBottom: spacing.md },
  action: { marginTop: spacing.sm },
  moreAction: { minHeight: 48, justifyContent: 'center', marginBottom: spacing.sm },
  moreText: { color: colors.brand, fontSize: typography.sizes.bodyRegular, fontWeight: typography.weights.semibold },
  photoChoice: { minHeight: 48, justifyContent: 'center' },
  note: { color: colors.inkMuted, fontSize: typography.sizes.caption,
    lineHeight: typography.lineHeights.caption, marginTop: spacing.md },
  error: { color: colors.safetyAlert.text, fontSize: typography.sizes.caption,
    lineHeight: typography.lineHeights.caption, marginBottom: spacing.sm },
});
