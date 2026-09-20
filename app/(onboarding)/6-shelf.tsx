import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { colors, typography, spacing, radii, shadows } from '@/src/constants/theme';
import { useOnboardingStore } from '@/src/stores/onboardingStore';
import type { Product, ProductCategory } from '@/src/types/schema';
import { recognizeShelfProducts } from '@/src/services/catalog';
import { buildCustomerShelfProduct } from '@/src/utils/shelfProducts';
import { CameraCapture } from '@/src/components/ui/CameraCapture';
import { ShelfProductEditor } from '@/src/components/onboarding/ShelfProductEditor';
import { Button } from '@/src/components/ui/Button';
import { Icon } from '@/src/components/ui/Icon';
import { Badge } from '@/src/components/ui/Badge';

export default function ShelfScreen() {
  const router = useRouter();
  const {
    detectedProducts,
    shelfPhotoUri,
    setShelfPhoto,
    removeProduct,
    addProduct,
    confirmProduct,
    hasBadReactions,
    setHasBadReactions,
    productReactions,
    removeProductReaction,
  } = useOnboardingStore();

  const [isScanning, setIsScanning] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [editor, setEditor] = useState<{ kind: 'add' } | { kind: 'edit'; product: Product } | null>(null);

  const handleCapture = async (uri: string) => {
    setShowCamera(false);
    setIsScanning(true);

    try {
      const result = await recognizeShelfProducts(uri);
      setShelfPhoto(uri, result.products);
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
    } catch (e) {
      console.warn('Recognition failed:', e);
      setShelfPhoto(uri, []);
    } finally {
      setIsScanning(false);
    }
  };

  const handleAddMissing = () => {
    setEditor({ kind: 'add' });
    void Haptics.selectionAsync().catch(() => {});
  };

  const handleSaveProduct = (details: { brand: string; name: string; category: ProductCategory }) => {
    if (!editor) return;
    const id = editor.kind === 'edit'
      ? editor.product.id
      : `manual_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const product = buildCustomerShelfProduct(id, details);
    if (editor.kind === 'edit') confirmProduct(product);
    else addProduct(product);
    setEditor(null);
  };

  const handleContinue = () => {
    router.push('/(onboarding)/8-safety');
  };

  if (showCamera) {
    return (
      <CameraCapture
        type="shelf"
        instruction="Hold phone parallel to your bathroom counter or shelf."
        onCapture={handleCapture}
        onCancel={() => setShowCamera(false)}
      />

    );
  }

  return (
    <View style={styles.container}>
      {editor && (
        <ShelfProductEditor
          key={editor.kind === 'edit' ? editor.product.id : 'new'}
          product={editor.kind === 'edit' ? editor.product : undefined}
          onSave={handleSaveProduct}
          onCancel={() => setEditor(null)}
        />
      )}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.questionTitle}>Products</Text>
        <Text style={styles.questionSubtitle}>
          We start with what is already on your counter so we can keep what works.
        </Text>

        {/* SCAN ACTION SECTION */}
        <View style={styles.actionCard}>
          <Text style={styles.actionTitle}>Snap your current products</Text>
          <Text style={styles.actionDesc}>
            Take a photo of your products. Derive will try to identify what it can. Review the list and add or correct anything missing.
          </Text>

          <TouchableOpacity
            style={styles.cameraButton}
            onPress={() => setShowCamera(true)}
            activeOpacity={0.8}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={shelfPhotoUri ? 'Retake shelf photo' : 'Take a photo of your shelf'}
          >
            <Icon name="camera" size={20} color={colors.inkInverse} />
            <Text style={styles.cameraButtonText}>{shelfPhotoUri ? 'Retake Shelf Photo' : 'Take Shelf Photo'}</Text>
          </TouchableOpacity>
        </View>

        {shelfPhotoUri && (
          <Text style={styles.photoNote}>Photo saved. Please review the products below and add anything we could not identify.</Text>
        )}

        {isScanning && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.brand} />
            <Text style={styles.loadingText}>Checking photo for products...</Text>
          </View>
        )}

        {/* DETECTED PRODUCTS LIST */}
        <View style={styles.shelfHeaderRow}>
          <Text style={styles.shelfSectionTitle}>
            Current Products ({detectedProducts.length})
          </Text>
          <TouchableOpacity onPress={handleAddMissing} accessibilityRole="button" accessibilityLabel="Add a product manually">
            <Text style={styles.addManualText}>+ Add product</Text>
          </TouchableOpacity>
        </View>

        {detectedProducts.length === 0 ? (
          <View style={styles.emptyShelfCard}>
            <Icon name="info" size={20} color={colors.inkMuted} />
            <Text style={styles.emptyShelfTitle}>
              {shelfPhotoUri ? 'No bottles recognized automatically' : 'No current products added'}
            </Text>
            <Text style={styles.emptyShelfDesc}>
              {shelfPhotoUri
                ? "We couldn't automatically read bottle labels from this photo. You can add your products manually using '+ Add product' above, or continue."
                : "Snap your counter above or add what you use manually so we don't duplicate active ingredients."}
            </Text>
          </View>
        ) : (
          <View style={styles.productsList}>
            {detectedProducts.map((p) => (
              <View key={p.id} style={styles.productRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.productBrand}>{p.brand}</Text>
                  <Text style={styles.productName}>{p.name}</Text>
                  <Text style={styles.productCategory}>
                    {p.category.charAt(0).toUpperCase() + p.category.slice(1)}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setEditor({ kind: 'edit', product: p })}
                  style={styles.editButton}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${p.name}`}
                >
                  <Text style={styles.editText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => removeProduct(p.id)}
                  style={styles.removeButton}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${p.name}`}
                >
                  <Icon name="close" size={16} color={colors.inkMuted} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* CONDITIONAL PRODUCT REACTION SECTION */}
        <View style={styles.reactionSection}>
          <Text style={styles.reactionHeading}>Product Reactions</Text>
          <Text style={styles.reactionPrompt}>
            Has a skincare, hair, deodorant, or body product ever irritated your skin or caused a bad reaction?
          </Text>

          <View style={styles.reactionChoiceRow}>
            <TouchableOpacity
              onPress={() => {
                Haptics.selectionAsync();
                setHasBadReactions(false);
              }}
              style={[
                styles.choiceChip,
                hasBadReactions === false && styles.choiceChipActive,
              ]}
              accessible={true}
              accessibilityRole="radio"
              accessibilityState={{ checked: hasBadReactions === false }}
            >
              <Text
                style={[
                  styles.choiceText,
                  hasBadReactions === false && styles.choiceTextActive,
                ]}
              >
                No, not that I recall
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                Haptics.selectionAsync();
                setHasBadReactions(true);
              }}
              style={[
                styles.choiceChip,
                hasBadReactions === true && styles.choiceChipActive,
              ]}
              accessible={true}
              accessibilityRole="radio"
              accessibilityState={{ checked: hasBadReactions === true }}
            >
              <Text
                style={[
                  styles.choiceText,
                  hasBadReactions === true && styles.choiceTextActive,
                ]}
              >
                Yes, I've had an issue
              </Text>
            </TouchableOpacity>
          </View>

          {/* If YES: show reaction list & button */}
          {hasBadReactions === true && (
            <View style={styles.reactionCardContainer}>
              {productReactions.length > 0 && (
                <View style={styles.reactionList}>
                  {productReactions.map((rx) => (
                    <View key={rx.id} style={styles.reactionItem}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.reactionProductText}>
                          {rx.productNameSnapshot}
                        </Text>
                        <Text style={styles.reactionAreaText}>
                          Area: {rx.bodyArea} • Severity: {rx.severity}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => removeProductReaction(rx.id)}
                        style={styles.removeButton}
                      >
                        <Icon name="close" size={14} color={colors.inkMuted} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              <TouchableOpacity
                style={styles.addReactionButton}
                onPress={() => router.push('/(onboarding)/reaction-history')}
                activeOpacity={0.8}
              >
                <Icon name="plus" size={16} color={colors.brand} />
                <Text style={styles.addReactionButtonText}>
                  {productReactions.length === 0
                    ? 'Add What Happened'
                    : 'Add Another Reaction'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <Button
          label="Continue"
          variant="primary"
          size="large"
          onPress={handleContinue}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl + 80,
  },
  questionTitle: {
    fontFamily: typography.fontFamilies.serif,
    fontSize: typography.sizes.screenTitle,
    lineHeight: typography.lineHeights.screenTitle,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  questionSubtitle: {
    fontSize: typography.sizes.bodyRegular,
    color: colors.inkMuted,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  actionCard: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...shadows.subtle,
  },
  actionTitle: {
    fontSize: typography.sizes.bodyLarge,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    marginBottom: 4,
  },
  actionDesc: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  photoNote: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
    lineHeight: 19,
    marginBottom: spacing.lg,
  },
  cameraButton: {
    backgroundColor: colors.brand,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    gap: spacing.xs,
  },
  cameraButtonText: {
    color: colors.inkInverse,
    fontSize: typography.sizes.bodyRegular,
    fontWeight: typography.weights.semibold,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  loadingText: {
    fontSize: typography.sizes.caption,
    color: colors.brand,
    fontWeight: typography.weights.medium,
  },
  shelfHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  shelfSectionTitle: {
    fontSize: typography.sizes.bodyLarge,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
  },
  addManualText: {
    fontSize: typography.sizes.caption,
    color: colors.brand,
    fontWeight: typography.weights.semibold,
  },
  emptyShelfCard: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xl,
  },
  emptyShelfTitle: {
    fontSize: typography.sizes.bodyRegular,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  emptyShelfDesc: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 300,
  },
  productsList: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: spacing.xl,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  productBrand: {
    fontSize: typography.sizes.micro,
    color: colors.brand,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  productName: {
    fontSize: typography.sizes.bodyRegular,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
  },
  productCategory: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
    marginTop: 2,
  },
  removeButton: {
    padding: spacing.xs,
  },
  editButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  editText: {
    fontSize: typography.sizes.caption,
    color: colors.brand,
    fontWeight: typography.weights.semibold,
  },
  reactionSection: {
    marginTop: spacing.md,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  reactionHeading: {
    fontSize: typography.sizes.bodyLarge,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    marginBottom: 4,
  },
  reactionPrompt: {
    fontSize: typography.sizes.bodyRegular,
    color: colors.inkMuted,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  reactionChoiceRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  choiceChip: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  choiceChipActive: {
    backgroundColor: colors.brandLight,
    borderColor: colors.brand,
  },
  choiceText: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
    fontWeight: typography.weights.medium,
    textAlign: 'center',
  },
  choiceTextActive: {
    color: colors.brand,
    fontWeight: typography.weights.semibold,
  },
  reactionCardContainer: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  reactionList: {
    gap: spacing.xs,
  },
  reactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  reactionProductText: {
    fontSize: typography.sizes.bodyRegular,
    fontWeight: typography.weights.medium,
    color: colors.ink,
  },
  reactionAreaText: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
  },
  addReactionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  addReactionButtonText: {
    fontSize: typography.sizes.caption,
    color: colors.brand,
    fontWeight: typography.weights.semibold,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.canvas,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
});
