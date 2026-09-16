import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { colors, typography, spacing, radii, shadows } from '@/src/constants/theme';
import { useRoutineStore } from '@/src/stores/routineStore';
import { useOnboardingStore } from '@/src/stores/onboardingStore';
import { Icon } from '@/src/components/ui/Icon';
import { StatusBadge, StatusBadgeVariant } from '@/src/components/ui/StatusBadge';
import { Button } from '@/src/components/ui/Button';
import { CameraCapture } from '@/src/components/ui/CameraCapture';
import { analytics } from '@/src/services/analytics';
import {
  evaluateProductScan,
  PROTOTYPE_CATALOG,
  ScannableProductInput,
} from '@/src/services/ai-workflows/scan-evaluator';
import { ProductScanResult, ProductScanVerdict } from '@/src/types/schema';

export default function ScanScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ sim?: string }>();
  const insets = useSafeAreaInsets();
  const { routine, userProducts, checkIns } = useRoutineStore();
  const { productReactions, routineComplexity, primaryGoal, costPreference } = useOnboardingStore();

  const [candidateProduct, setCandidateProduct] = useState<ScannableProductInput | null>(null);
  const [confirmedProduct, setConfirmedProduct] = useState<ScannableProductInput | null>(null);
  const [scanResult, setScanResult] = useState<ProductScanResult | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    analytics.track('scan_tab_opened', { source: 'tab_navigation' });
    if (params?.sim) {
      const match =
        PROTOTYPE_CATALOG.find((p) =>
          p.name.toLowerCase().includes(params.sim!.toLowerCase()) ||
          p.brand.toLowerCase().includes(params.sim!.toLowerCase())
        ) || PROTOTYPE_CATALOG[0];
      setConfirmedProduct(match);
      setIsSearching(false);
      const result = evaluateProductScan(match, {
        routine,
        userProducts,
        reactions: productReactions,
        checkIns,
        routineComplexity: routineComplexity || undefined,
        primaryGoal: primaryGoal || undefined,
        costPreference: costPreference || undefined,
      });
      setScanResult(result);
    }
  }, [params?.sim]);

  const handleCapture = (uri: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Simulate automatic optical recognition
    const detected = PROTOTYPE_CATALOG[0]; // The Ordinary Niacinamide 10% + Zinc 1%
    setCandidateProduct(detected);
    analytics.track('product_scan_recognized', { productName: detected.name });
  };

  const handleSelectCatalogItem = (item: ScannableProductInput) => {
    Haptics.selectionAsync();
    setCandidateProduct(item);
    setIsSearching(false);
  };

  const handleConfirmProduct = () => {
    if (!candidateProduct) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setConfirmedProduct(candidateProduct);

    // Evaluate personalized verdict
    const result = evaluateProductScan(candidateProduct, {
      routine,
      userProducts,
      reactions: productReactions,
      checkIns,
      routineComplexity: routineComplexity || undefined,
      primaryGoal: primaryGoal || undefined,
      costPreference: costPreference || undefined,
    });

    setScanResult(result);
    analytics.track('scan_verdict_viewed', {
      productName: candidateProduct.name,
      verdict: result.verdict,
    });
  };

  const handleResetScan = () => {
    Haptics.selectionAsync();
    setCandidateProduct(null);
    setConfirmedProduct(null);
    setScanResult(null);
    setSearchQuery('');
    setIsSearching(false);
  };

  const handleHandoffToAsk = () => {
    if (!scanResult) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    analytics.track('scan_ask_handoff', {
      productName: scanResult.productName,
      verdict: scanResult.verdict,
    });

    // Navigate to Ask with rich scan context
    router.push({
      pathname: '/(tabs)/ask',
      params: {
        initialQuery: `What does the scan verdict for ${scanResult.brand} ${scanResult.productName} (${scanResult.verdictLabel}) mean for my routine?`,
        scannedProductName: scanResult.productName,
        scannedBrand: scanResult.brand,
        scannedVerdict: scanResult.verdict,
        scannedReason: scanResult.verdictSummary,
      },
    });
  };

  const getVerdictBadgeVariant = (verdict: ProductScanVerdict): StatusBadgeVariant => {
    switch (verdict) {
      case 'great_fit':
      case 'fits_plan':
        return 'keep';
      case 'could_work':
        return 'add';
      case 'not_needed':
        return 'pause';
      case 'better_replacement':
        return 'replace';
      case 'use_with_caution':
        return 'pause';
      case 'not_good_fit':
        return 'stop';
      default:
        return 'info';
    }
  };

  // 1. RESULT VIEW: Split FORMULA QUALITY vs FIT FOR YOU RIGHT NOW
  if (scanResult && confirmedProduct) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.screenTitle}>Product Evaluation</Text>
          <TouchableOpacity onPress={handleResetScan} style={styles.resetButton}>
            <Text style={styles.resetButtonText}>Scan Another</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 140 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* SECTION 1: FIT FOR YOU RIGHT NOW */}
          <View style={styles.verdictCard}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionCategoryTag}>FIT FOR YOU RIGHT NOW</Text>
              <StatusBadge
                label={scanResult.verdictLabel || scanResult.verdict.toUpperCase()}
                variant={getVerdictBadgeVariant(scanResult.verdict)}
                size="medium"
              />
            </View>

            <Text style={styles.productBrandText}>{confirmedProduct.brand.toUpperCase()}</Text>
            <Text style={styles.productNameText}>{confirmedProduct.name}</Text>

            <View style={styles.summaryBox}>
              <Text style={styles.summaryText}>{scanResult.verdictSummary}</Text>
            </View>

            {scanResult.whatItWouldChangeOrReplace && (
              <View style={styles.changeBox}>
                <Text style={styles.changeLabel}>ROUTINE IMPACT</Text>
                <Text style={styles.changeText}>{scanResult.whatItWouldChangeOrReplace}</Text>
              </View>
            )}

            {scanResult.factsUsedToDecide.length > 0 && (
              <View style={styles.factsContainer}>
                <Text style={styles.factsHeader}>WHY THIS IS SPECIFIC TO YOU</Text>
                {scanResult.factsUsedToDecide.map((fact, index) => (
                  <View key={index} style={styles.factRow}>
                    <View style={styles.factDot} />
                    <Text style={styles.factText}>{fact}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* SECTION 2: FORMULA / GENERAL QUALITY */}
          <View style={styles.formulaCard}>
            <Text style={styles.sectionCategoryTag}>FORMULA QUALITY</Text>
            <Text style={styles.formulaTitle}>Category & Ingredient Profile</Text>

            <View style={styles.formulaRow}>
              <Text style={styles.formulaLabel}>Product Type</Text>
              <Text style={styles.formulaValue}>
                {confirmedProduct.category.charAt(0).toUpperCase() + confirmedProduct.category.slice(1)}
              </Text>
            </View>

            {confirmedProduct.keyActives && confirmedProduct.keyActives.length > 0 && (
              <View style={styles.formulaRow}>
                <Text style={styles.formulaLabel}>Key Actives</Text>
                <Text style={styles.formulaValue}>
                  {confirmedProduct.keyActives.join(', ')}
                </Text>
              </View>
            )}

            <View style={styles.formulaRow}>
              <Text style={styles.formulaLabel}>Formulation Standard</Text>
              <Text style={styles.formulaValue}>Verified manufacturer formulation snapshot</Text>
            </View>
          </View>

          {/* ACTIONS */}
          <View style={styles.actionContainer}>
            <Button
              label="Ask Derive About This"
              variant="brand"
              size="large"
              icon={<Icon name="ask" size={18} color={colors.inkInverse} />}
              onPress={handleHandoffToAsk}
            />
            <Button
              label="Scan Another Bottle"
              variant="outline"
              size="medium"
              onPress={handleResetScan}
            />
          </View>
        </ScrollView>
      </View>
    );
  }

  // 2. CONFIRMATION VIEW (Identified bottle confirmation)
  if (candidateProduct && !confirmedProduct) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.screenTitle}>Confirm Product</Text>
          <TouchableOpacity onPress={handleResetScan} style={styles.resetButton}>
            <Text style={styles.resetButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.confirmationContent}>
          <View style={styles.confirmCard}>
            <View style={styles.confirmIconCircle}>
              <Icon name="bottle" size={30} color={colors.brand} />
            </View>
            <Text style={styles.confirmQuestion}>Is this the bottle on your shelf?</Text>

            <View style={styles.identifiedBox}>
              <Text style={styles.identifiedBrand}>{candidateProduct.brand}</Text>
              <Text style={styles.identifiedName}>{candidateProduct.name}</Text>
              {candidateProduct.keyActives && (
                <Text style={styles.identifiedActives}>
                  Actives: {candidateProduct.keyActives.join(', ')}
                </Text>
              )}
            </View>

            <Button
              label="Yes, evaluate for my skin"
              variant="brand"
              size="large"
              onPress={handleConfirmProduct}
              style={{ width: '100%', marginTop: spacing.md }}
            />

            <Button
              label="Not quite — search by name"
              variant="ghost"
              size="medium"
              onPress={() => {
                setCandidateProduct(null);
                setIsSearching(true);
              }}
              style={{ width: '100%', marginTop: spacing.xs }}
            />
          </View>
        </View>
      </View>
    );
  }

  // 3. MANUAL SEARCH FALLBACK VIEW
  if (isSearching) {
    const filtered = PROTOTYPE_CATALOG.filter(
      (p) =>
        !searchQuery ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.brand.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => setIsSearching(false)}
            style={styles.backButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon name="back" size={20} color={colors.ink} />
          </TouchableOpacity>
          <Text style={styles.screenTitle}>Search Product</Text>
          <View style={{ width: 32 }} />
        </View>

        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Icon name="search" size={18} color={colors.inkMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search brand or product name..."
              placeholderTextColor={colors.inkSubtle}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
          </View>

          <ScrollView
            contentContainerStyle={{ paddingBottom: insets.bottom + 60 }}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.catalogHeading}>Common Products</Text>
            <View style={styles.catalogList}>
              {filtered.map((item, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.catalogItemRow}
                  onPress={() => handleSelectCatalogItem(item)}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.catalogItemBrand}>{item.brand}</Text>
                    <Text style={styles.catalogItemName}>{item.name}</Text>
                  </View>
                  <Icon name="forward" size={14} color={colors.brand} />
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      </View>
    );
  }

  // 4. CANONICAL CAMERA-FIRST VIEW (Pure Viewfinder)
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.scannerHeader}>
        <View style={styles.headerTopRow}>
          <Text style={styles.screenTitle}>Scan</Text>
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
        <Text style={styles.subtitle}>
          Point your camera at any skincare bottle.
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.cameraFrameContainer}>
          <CameraCapture
            type="shelf"
            instruction="Point your camera at the bottle"
            subtext="Automatic optical recognition"
            onCapture={handleCapture}
          />

          <TouchableOpacity
            style={styles.manualSearchLink}
            onPress={() => setIsSearching(true)}
            activeOpacity={0.7}
          >
            <Icon name="search" size={16} color={colors.brand} />
            <Text style={styles.manualSearchText}>Can't scan? Search by name</Text>
          </TouchableOpacity>

          {/* Quick Shortcuts for Instant Simulator Testing (Dev Only) */}
          {__DEV__ && (
            <View style={styles.quickShortcuts}>
              <Text style={styles.shortcutHeading}>QUICK TEST PRESETS</Text>
              <View style={styles.shortcutPillRow}>
                {PROTOTYPE_CATALOG.slice(0, 3).map((item, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={styles.shortcutPill}
                    onPress={() => handleSelectCatalogItem(item)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.shortcutPillText}>
                      {item.brand.split(' ')[0]} {item.name.split(' ')[0]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle,
  },
  scannerHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
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
  subtitle: {
    fontSize: typography.sizes.bodyRegular,
    color: colors.inkMuted,
    marginTop: 2,
  },
  resetButton: {
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
  },
  resetButtonText: {
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.semibold,
    color: colors.brand,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  cameraFrameContainer: {
    gap: spacing.md,
  },
  manualSearchLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  manualSearchText: {
    fontSize: typography.sizes.bodyRegular,
    fontWeight: typography.weights.semibold,
    color: colors.brand,
  },
  quickShortcuts: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  shortcutHeading: {
    fontSize: typography.sizes.micro,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.8,
    color: colors.inkSubtle,
    marginBottom: spacing.xs,
  },
  shortcutPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  shortcutPill: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 36,
    justifyContent: 'center',
  },
  shortcutPillText: {
    fontSize: typography.sizes.caption,
    color: colors.ink,
    fontWeight: typography.weights.medium,
  },
  verdictCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
    marginBottom: spacing.md,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionCategoryTag: {
    fontSize: typography.sizes.micro,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.8,
    color: colors.inkMuted,
  },
  productBrandText: {
    fontSize: typography.sizes.micro,
    fontWeight: typography.weights.bold,
    letterSpacing: 1,
    color: colors.brand,
    marginTop: spacing.xs,
  },
  productNameText: {
    fontSize: typography.sizes.sectionTitle,
    fontWeight: typography.weights.bold,
    color: colors.ink,
    marginBottom: spacing.md,
  },
  summaryBox: {
    backgroundColor: colors.canvas,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  summaryText: {
    fontSize: typography.sizes.bodyRegular,
    lineHeight: typography.lineHeights.bodyRegular,
    color: colors.ink,
  },
  changeBox: {
    paddingTop: spacing.xs,
    marginBottom: spacing.md,
  },
  changeLabel: {
    fontSize: typography.sizes.micro,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.8,
    color: colors.inkMuted,
    marginBottom: 2,
  },
  changeText: {
    fontSize: typography.sizes.caption,
    lineHeight: typography.lineHeights.caption,
    color: colors.ink,
  },
  factsContainer: {
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    paddingTop: spacing.md,
  },
  factsHeader: {
    fontSize: typography.sizes.micro,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.8,
    color: colors.inkMuted,
    marginBottom: spacing.xs,
  },
  factRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    marginTop: 6,
  },
  factDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.brand,
    marginTop: 7,
  },
  factText: {
    flex: 1,
    fontSize: typography.sizes.caption,
    lineHeight: typography.lineHeights.caption,
    color: colors.inkMuted,
  },
  formulaCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.subtle,
    marginBottom: spacing.lg,
  },
  formulaTitle: {
    fontSize: typography.sizes.bodyLarge,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    marginTop: 4,
    marginBottom: spacing.md,
  },
  formulaRow: {
    paddingVertical: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSubtle,
  },
  formulaLabel: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
    marginBottom: 2,
  },
  formulaValue: {
    fontSize: typography.sizes.bodyRegular,
    fontWeight: typography.weights.medium,
    color: colors.ink,
  },
  actionContainer: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  confirmationContent: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    alignItems: 'center',
  },
  confirmCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  confirmIconCircle: {
    width: 60,
    height: 60,
    borderRadius: radii.full,
    backgroundColor: colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  confirmQuestion: {
    fontSize: typography.sizes.bodyLarge,
    fontWeight: typography.weights.bold,
    color: colors.ink,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  identifiedBox: {
    width: '100%',
    backgroundColor: colors.canvas,
    borderRadius: radii.md,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  identifiedBrand: {
    fontSize: typography.sizes.caption,
    color: colors.brand,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.5,
  },
  identifiedName: {
    fontSize: typography.sizes.bodyRegular,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    textAlign: 'center',
    marginTop: 2,
  },
  identifiedActives: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
    marginTop: 4,
    textAlign: 'center',
  },
  searchContainer: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    height: 48,
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.sizes.bodyRegular,
    color: colors.ink,
  },
  catalogHeading: {
    fontSize: typography.sizes.micro,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.8,
    color: colors.inkMuted,
    marginBottom: spacing.xs,
  },
  catalogList: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  catalogItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle,
    minHeight: 56,
  },
  catalogItemBrand: {
    fontSize: typography.sizes.micro,
    color: colors.brand,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.5,
  },
  catalogItemName: {
    fontSize: typography.sizes.bodyRegular,
    fontWeight: typography.weights.medium,
    color: colors.ink,
    marginTop: 1,
  },
});
