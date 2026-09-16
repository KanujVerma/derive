import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { colors, typography, spacing, radii, shadows } from '@/src/constants/theme';
import { useRoutineStore } from '@/src/stores/routineStore';
import { useOnboardingStore } from '@/src/stores/onboardingStore';
import { Icon } from '@/src/components/ui/Icon';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import { CameraCapture } from '@/src/components/ui/CameraCapture';
import { analytics } from '@/src/services/analytics';
import {
  evaluateProductScan,
  PROTOTYPE_CATALOG,
  ScannableProductInput,
} from '@/src/services/ai-workflows/scan-evaluator';
import { ProductScanResult } from '@/src/types/schema';

type ScanMode = 'front' | 'barcode' | 'ingredients' | 'search';

export default function ScanScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ sim?: string }>();
  const insets = useSafeAreaInsets();
  const { routine, userProducts, checkIns } = useRoutineStore();
  const { productReactions, routineComplexity, primaryGoal, costPreference } = useOnboardingStore();

  const [mode, setMode] = useState<ScanMode>('front');
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [candidateProduct, setCandidateProduct] = useState<ScannableProductInput | null>(null);
  const [confirmedProduct, setConfirmedProduct] = useState<ScannableProductInput | null>(null);
  const [scanResult, setScanResult] = useState<ProductScanResult | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isScanning, setIsScanning] = useState(true);

  useEffect(() => {
    analytics.track('scan_tab_opened', { source: 'tab_navigation' });
    if (params?.sim) {
      const match =
        PROTOTYPE_CATALOG.find((p) =>
          p.name.toLowerCase().includes(params.sim!.toLowerCase()) ||
          p.brand.toLowerCase().includes(params.sim!.toLowerCase())
        ) || PROTOTYPE_CATALOG[0];
      setConfirmedProduct(match);
      setIsScanning(false);
      const result = evaluateProductScan(match, {
        routine,
        userProducts,
        reactions: productReactions,
        checkIns,
        routineComplexity,
        primaryGoal,
        costPreference,
      });
      setScanResult(result);
    }
  }, [params?.sim]);

  const handleCapture = (uri: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCapturedUri(uri);
    setIsScanning(false);
    // Simulate immediate OCR recognition to The Ordinary Niacinamide or first catalog match
    const detected = PROTOTYPE_CATALOG[0]; // Niacinamide 10%
    setCandidateProduct(detected);
    analytics.track('product_scan_recognized', { productName: detected.name });
  };

  const handleSelectCatalogItem = (item: ScannableProductInput) => {
    Haptics.selectionAsync();
    setCandidateProduct(item);
    setIsScanning(false);
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
      routineComplexity,
      primaryGoal,
      costPreference,
    });

    setScanResult(result);
    analytics.track('scan_verdict_viewed', {
      productName: candidateProduct.name,
      verdict: result.verdict,
    });
  };

  const handleResetScan = () => {
    Haptics.selectionAsync();
    setCapturedUri(null);
    setCandidateProduct(null);
    setConfirmedProduct(null);
    setScanResult(null);
    setSearchQuery('');
    setIsScanning(true);
  };

  const handleHandoffToAsk = () => {
    if (!scanResult) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    analytics.track('scan_ask_handoff', {
      productName: scanResult.productName,
      verdict: scanResult.verdict,
    });

    // Navigate to Ask with rich scan payload
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

  const getVerdictBadgeVariant = (verdict: string): 'keep' | 'pause' | 'replace' | 'stop' | 'add' | 'neutral' => {
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
        return 'neutral';
    }
  };

  // 1. RESULT VIEW
  if (scanResult && confirmedProduct) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.screenTitle}>Product Scan</Text>
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
          {/* VERDICT HERO CARD */}
          <View style={styles.verdictCard}>
            <View style={styles.verdictBadgeRow}>
              <Badge
                label={scanResult.verdictLabel || scanResult.verdict.toUpperCase()}
                variant={getVerdictBadgeVariant(scanResult.verdict)}
                size="medium"
              />
              <Text style={styles.categoryLabel}>{confirmedProduct.category.toUpperCase()}</Text>
            </View>

            <Text style={styles.productBrandText}>{confirmedProduct.brand.toUpperCase()}</Text>
            <Text style={styles.productNameText}>{confirmedProduct.name}</Text>

            <View style={styles.summaryBox}>
              <Text style={styles.summaryText}>{scanResult.verdictSummary}</Text>
            </View>

            {scanResult.whatItWouldChangeOrReplace && (
              <View style={styles.changeBox}>
                <Text style={styles.changeLabel}>IMPACT ON YOUR PLAN</Text>
                <Text style={styles.changeText}>{scanResult.whatItWouldChangeOrReplace}</Text>
              </View>
            )}
          </View>

          {/* WHY THIS IS SPECIFIC TO YOU */}
          <View style={styles.specificSection}>
            <Text style={styles.sectionHeader}>WHY THIS IS SPECIFIC TO YOU</Text>
            <View style={styles.factsCard}>
              {scanResult.factsUsedToDecide.map((fact, index) => (
                <View key={index} style={styles.factRow}>
                  <View style={styles.factDot} />
                  <Text style={styles.factText}>{fact}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* ACTIONS */}
          <View style={styles.actionContainer}>
            <Button
              label="Ask Derive About This"
              variant="primary"
              size="large"
              icon={<Icon name="ask" size={18} color={colors.inkInverse} />}
              onPress={handleHandoffToAsk}
            />
            <Button
              label="Scan Another Product"
              variant="outline"
              size="medium"
              onPress={handleResetScan}
            />
          </View>
        </ScrollView>
      </View>
    );
  }

  // 2. CONFIRMATION VIEW (Did we identify this correctly?)
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
              <Icon name="bottle" size={32} color={colors.brand} />
            </View>
            <Text style={styles.confirmQuestion}>Is this the right product?</Text>

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
              label="Yes, check my plan"
              variant="primary"
              size="large"
              onPress={handleConfirmProduct}
              style={{ width: '100%', marginTop: spacing.md }}
            />

            <Button
              label="Not quite — search or re-scan"
              variant="ghost"
              size="medium"
              onPress={handleResetScan}
              style={{ width: '100%', marginTop: spacing.xs }}
            />
          </View>
        </View>
      </View>
    );
  }

  // 3. IMMEDIATE SCANNER / VIEWFINDER VIEW
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Top Header with Mode Selector */}
      <View style={styles.scannerHeader}>
        <View>
          <Text style={styles.screenTitle}>Scan</Text>
          <Text style={styles.subtitle}>
            Does this product make sense for your skin right now?
          </Text>
        </View>
      </View>

      {/* Mode Switcher Tabs */}
      <View style={styles.modeTabBar}>
        <TouchableOpacity
          style={[styles.modeTab, mode === 'front' && styles.modeTabActive]}
          onPress={() => setMode('front')}
        >
          <Text style={[styles.modeTabText, mode === 'front' && styles.modeTabTextActive]}>
            Product Front
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.modeTab, mode === 'barcode' && styles.modeTabActive]}
          onPress={() => setMode('barcode')}
        >
          <Text style={[styles.modeTabText, mode === 'barcode' && styles.modeTabTextActive]}>
            Barcode
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.modeTab, mode === 'ingredients' && styles.modeTabActive]}
          onPress={() => setMode('ingredients')}
        >
          <Text style={[styles.modeTabText, mode === 'ingredients' && styles.modeTabTextActive]}>
            Ingredients
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.modeTab, mode === 'search' && styles.modeTabActive]}
          onPress={() => setMode('search')}
        >
          <Text style={[styles.modeTabText, mode === 'search' && styles.modeTabTextActive]}>
            Search
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 110 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {mode === 'search' ? (
          <View style={styles.searchContainer}>
            <View style={styles.searchBar}>
              <Icon name="search" size={18} color={colors.inkMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by brand or product name..."
                placeholderTextColor={colors.inkSubtle}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            <Text style={styles.catalogHeading}>Common Products</Text>
            <View style={styles.catalogList}>
              {PROTOTYPE_CATALOG.filter(
                (p) =>
                  !searchQuery ||
                  p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  p.brand.toLowerCase().includes(searchQuery.toLowerCase())
              ).map((item, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.catalogItemRow}
                  onPress={() => handleSelectCatalogItem(item)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.catalogItemBrand}>{item.brand}</Text>
                    <Text style={styles.catalogItemName}>{item.name}</Text>
                  </View>
                  <Icon name="forward" size={16} color={colors.brand} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.cameraFrameContainer}>
            {/* Real Camera Viewfinder / Simulation */}
            <CameraCapture
              type="shelf"
              instruction={
                mode === 'barcode'
                  ? 'Align barcode inside frame'
                  : mode === 'ingredients'
                  ? 'Hold ingredient list in clear light'
                  : 'Hold bottle front label clearly inside frame'
              }
              subtext="Automatic optical recognition"
              onCapture={handleCapture}
            />

            {/* Quick Test Barcode / Product Shortcuts for Instant Testing */}
            <View style={styles.quickShortcuts}>
              <Text style={styles.shortcutHeading}>QUICK SIMULATION SHORTCUTS</Text>
              <View style={styles.shortcutPillRow}>
                {PROTOTYPE_CATALOG.slice(0, 3).map((item, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={styles.shortcutPill}
                    onPress={() => handleSelectCatalogItem(item)}
                  >
                    <Text style={styles.shortcutPillText}>
                      {item.brand.split(' ')[0]} {item.name.split(' ')[0]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        )}
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
    borderBottomColor: colors.hairline,
  },
  scannerHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  screenTitle: {
    fontFamily: typography.fontFamilies.serif,
    fontSize: typography.sizes.screenTitle,
    lineHeight: typography.lineHeights.screenTitle,
    color: colors.ink,
  },
  subtitle: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
    marginTop: 2,
  },
  resetButton: {
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceMuted,
  },
  resetButtonText: {
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.semibold,
    color: colors.brand,
  },
  modeTabBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    gap: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  modeTab: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.xs,
    backgroundColor: colors.surfaceMuted,
  },
  modeTabActive: {
    backgroundColor: colors.brand,
  },
  modeTabText: {
    fontSize: typography.sizes.micro,
    fontWeight: typography.weights.medium,
    color: colors.inkMuted,
  },
  modeTabTextActive: {
    color: colors.inkInverse,
    fontWeight: typography.weights.bold,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.lg,
  },
  cameraFrameContainer: {
    gap: spacing.md,
  },
  quickShortcuts: {
    marginTop: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  shortcutHeading: {
    fontSize: typography.sizes.micro,
    fontWeight: typography.weights.bold,
    color: colors.inkMuted,
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
  },
  shortcutPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  shortcutPill: {
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  shortcutPillText: {
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.medium,
    color: colors.ink,
  },
  searchContainer: {
    gap: spacing.md,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    height: 48,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.sizes.bodyRegular,
    color: colors.ink,
  },
  catalogHeading: {
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.bold,
    color: colors.inkMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  catalogList: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    overflow: 'hidden',
  },
  catalogItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  catalogItemBrand: {
    fontSize: typography.sizes.micro,
    fontWeight: typography.weights.bold,
    color: colors.inkMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  catalogItemName: {
    fontSize: typography.sizes.bodyRegular,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    marginTop: 2,
  },
  confirmationContent: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  confirmCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.hairline,
    ...shadows.card,
  },
  confirmIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  confirmQuestion: {
    fontSize: typography.sizes.sectionTitle,
    fontWeight: typography.weights.bold,
    color: colors.ink,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  identifiedBox: {
    width: '100%',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    padding: spacing.md,
    alignItems: 'center',
    gap: 2,
    marginBottom: spacing.sm,
  },
  identifiedBrand: {
    fontSize: typography.sizes.micro,
    fontWeight: typography.weights.bold,
    color: colors.inkMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  identifiedName: {
    fontSize: typography.sizes.bodyLarge,
    fontWeight: typography.weights.bold,
    color: colors.ink,
    textAlign: 'center',
  },
  identifiedActives: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
    marginTop: 4,
    textAlign: 'center',
  },
  verdictCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    gap: spacing.xs,
    ...shadows.subtle,
  },
  verdictBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  categoryLabel: {
    fontSize: typography.sizes.micro,
    fontWeight: typography.weights.bold,
    color: colors.inkMuted,
    letterSpacing: 0.8,
  },
  productBrandText: {
    fontSize: typography.sizes.micro,
    fontWeight: typography.weights.bold,
    color: colors.inkMuted,
    letterSpacing: 0.8,
  },
  productNameText: {
    fontSize: typography.sizes.sectionTitle,
    fontWeight: typography.weights.bold,
    color: colors.ink,
    letterSpacing: -0.3,
  },
  summaryBox: {
    backgroundColor: colors.brandLight,
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.xs,
  },
  summaryText: {
    fontSize: typography.sizes.bodyRegular,
    color: colors.ink,
    lineHeight: 22,
    fontWeight: typography.weights.medium,
  },
  changeBox: {
    marginTop: spacing.xs,
    padding: spacing.sm,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
  },
  changeLabel: {
    fontSize: 10,
    fontWeight: typography.weights.bold,
    color: colors.inkMuted,
    letterSpacing: 0.8,
  },
  changeText: {
    fontSize: typography.sizes.caption,
    color: colors.ink,
    marginTop: 2,
  },
  specificSection: {
    gap: spacing.xs,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: typography.weights.bold,
    color: colors.inkMuted,
    letterSpacing: 0.8,
  },
  factsCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    gap: spacing.sm,
  },
  factRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  factDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.brand,
    marginTop: 8,
  },
  factText: {
    flex: 1,
    fontSize: typography.sizes.caption,
    color: colors.ink,
    lineHeight: 20,
  },
  actionContainer: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
});
