import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Linking,
  useWindowDimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { colors, typography, spacing, radii, shadows, layout } from '@/src/constants/theme';
import { useRoutineStore } from '@/src/stores/routineStore';
import { useOnboardingStore } from '@/src/stores/onboardingStore';
import { Icon } from '@/src/components/ui/Icon';
import { Button } from '@/src/components/ui/Button';
import { analytics } from '@/src/services/analytics';
import { PROTOTYPE_CATALOG, ScannableProductInput } from '@/src/services/catalog';
import { CatalogProductSearch } from '@/src/components/catalog/CatalogProductSearch';
import type { CatalogProductSummary, CatalogProductDetail } from '@/src/contracts/ProductCatalog';
import type { ProductResolutionResult, ProductResolutionCandidate, ResolveProductIdentityInput } from '@/src/contracts/ProductIdentityResolver';
import { createCatalogRequestId, getCatalogProductDetail, resolveCatalogIdentity } from '@/src/services/productCatalog';
import { describeCheckProductFit, getVerifiedFormulaForResolution, resolvedCatalogDetailId } from '@/src/commerce/checkProductPresentation';
import { publicEnvironment } from '@/src/config/environment';
import { showsProviderBetaFeatures } from '@/src/utils/membershipPresentation';
import { evaluateProduct } from '@/src/services/deriveClient';
import { ProductScanResult, ProductScanVerdict, type ProductCategory } from '@/src/types/schema';
import { resolveScanResultPresentation, resolveScanVerdictLabel } from '@/src/commerce/scanPresentation';
import { normalizeBarcode } from '@/src/utils/barcode';
import { useScanContextStore } from '@/src/stores/scanContextStore';
import { getCustomerErrorMessage } from '@/src/utils/customerErrors';
import { useShopAudience } from '@/src/commerce/useShopAudience';
import { AccountSettingsButton } from '@/src/components/account/AccountSettingsButton';
import { getPreviewCatalogDetail, searchPreviewCatalog } from '@/src/commerce/checkPreview';
import { isRemoteServiceEnabled } from '@/src/services/DeriveService';
import { resolveShellPresentation } from '@/src/utils/shellPresentation';
import { resolveCheckEntryState } from '@/src/commerce/checkEntryState';
import { RootShellHeader } from '@/src/components/shell/RootShellHeader';
import { GlassContainer } from '@/src/components/ui/GlassContainer';
import { GroupedSection } from '@/src/components/ui/GroupedSection';
import { PersonalFitSection } from '@/src/components/personalization/PersonalFitSection';
import { personalizationGateway } from '@/src/presentation/personalization/gateway';
import type { PersonalFitRefreshInput } from '@/src/presentation/personalization/result';

export default function CheckProductScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ sim?: string }>();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const audience = useShopAudience();
  const shell = resolveShellPresentation({
    buildFlavor: publicEnvironment.buildFlavor,
    remoteEnabled: isRemoteServiceEnabled(),
    supabaseUrl: publicEnvironment.supabaseUrl,
  });
  const preview = shell === 'scanner_first_preview';
  const integrated = shell === 'local_free_integration';
  const targetShell = preview || integrated;
  const [permission, requestPermission] = useCameraPermissions();
  const [personalFitState, setPersonalFitState] = useState<PersonalFitRefreshInput>({ kind: 'factual_only' });
  const [profileSaveStatus, setProfileSaveStatus] = useState(personalizationGateway.lastSaveStatus());
  const openPersonalization = () => router.push('/personalize');
  const { routine, userProducts, checkIns } = useRoutineStore();
  const { productReactions, routineComplexity, primaryGoal, costPreference } = useOnboardingStore();

  const [confirmedProduct, setConfirmedProduct] = useState<ScannableProductInput | null>(null);
  const [scanResult, setScanResult] = useState<ProductScanResult | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(!targetShell);
  const [catalogDetail, setCatalogDetail] = useState<CatalogProductDetail | null>(null);
  useFocusEffect(React.useCallback(() => {
    let active = true;
    const status = personalizationGateway.lastSaveStatus();
    setProfileSaveStatus(status);
    if (status) {
      setPersonalFitState({ kind: 'unavailable' });
      if (status.kind === 'ready' && catalogDetail?.productId) {
        void personalizationGateway.getFit(catalogDetail.productId).then((fit) => {
          if (active) setPersonalFitState(fit);
        }).catch(() => { if (active) setPersonalFitState({ kind: 'unavailable' }); });
      }
    }
    return () => { active = false; };
  }, [catalogDetail?.productId]));
  const [resolution, setResolution] = useState<ProductResolutionResult | null>(null);
  const [candidates, setCandidates] = useState<ProductResolutionCandidate[]>([]);
  const [isCheckingProduct, setIsCheckingProduct] = useState(false);
  const showProviderFeatures = showsProviderBetaFeatures(publicEnvironment.buildFlavor);
  const [torchOn, setTorchOn] = useState(false);
  const [unknownBarcode, setUnknownBarcode] = useState<string | null>(null);
  const [evaluationError, setEvaluationError] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const isScanningLockedRef = useRef(false);
  const pendingResolutionRef = useRef<{ key: string; requestId: string } | null>(null);
  const permissionState = permission?.granted ? 'granted'
    : permission?.status === 'denied' ? 'denied'
    : permission?.status === 'undetermined' ? 'undetermined' : 'unknown';
  const entryState = resolveCheckEntryState({ preview: targetShell, searching: isSearching, permission: permissionState });

  const handleSearchNamePress = () => {
    void Haptics.selectionAsync().catch(() => {});
    setUnknownBarcode(null);
    setIsSearching(true);
  };

  const handleScanBarcodePress = async () => {
    // The existing Button supplies one light impact haptic for this action.
    if (permission?.granted) {
      isScanningLockedRef.current = false;
      setIsLocked(false);
      setUnknownBarcode(null);
      setIsSearching(false);
      return;
    }
    if (permission?.status === 'denied' && !permission.canAskAgain) {
      setIsSearching(false);
      return;
    }
    try {
      await requestPermission();
    } catch {
      // The state resolver retains the search/permission fallback.
    }
    setIsSearching(false);
  };

  const performEvaluation = async (item: ScannableProductInput, barcode?: string) => {
    if (audience !== 'member') throw new Error('Membership required for personalized Scan');
    setEvaluationError(null);
    try {
      const isDifferinActive = routine?.pmSteps.some((s) =>
        s.productName.toLowerCase().includes('differin')
      );
      const result = await evaluateProduct({
        productName: item.name,
        brand: item.brand,
        barcode: barcode || item.barcode,
        userRoutineContext: {
          activeDifferinSchedule: isDifferinActive,
          currentRoutineProducts: userProducts.map((p) => p.product.name),
          recentReactions: productReactions,
        },
      });
      if (!resolveScanVerdictLabel(result.verdict)) {
        throw new Error('Unrecognized Scan verdict');
      }
      setScanResult(result);
      return result;
    } catch (err: any) {
      console.warn('performEvaluation error:', err);
      isScanningLockedRef.current = false;
      setIsLocked(false);
      setEvaluationError(getCustomerErrorMessage('scan'));
      throw err;
    }
  };

  useEffect(() => {
    if (audience !== 'member' || !showProviderFeatures) return;
    analytics.track('shop_scan_opened', { source: 'shop_tab' });
    if (__DEV__ && params?.sim) {
      const search = params.sim.toLowerCase();
      const match = PROTOTYPE_CATALOG.find(
        (p) =>
          p.name.toLowerCase().includes(search) ||
          p.brand.toLowerCase().includes(search)
      );
      if (match) {
        setConfirmedProduct(match);
        setIsSearching(false);
        performEvaluation(match).catch((err) => {
          console.warn('[DEV] Evaluation failed for simulated product:', err);
        });
      } else {
        console.warn(`[DEV] Unknown simulated product "${params.sim}". Failing closed without fallback.`);
        setUnknownBarcode(params.sim);
      }
    }
  }, [audience, params?.sim, showProviderFeatures]);

  const openResolution = async (
    evidence: Omit<ResolveProductIdentityInput, 'requestId'>,
    knownProductId?: string,
  ) => {
    if (preview) {
      setIsSearching(false);
      setCatalogDetail(null);
      setResolution(null);
      setCandidates([]);
      setConfirmedProduct(null);
      setScanResult(null);
      setUnknownBarcode(evidence.barcode ?? null);
      setEvaluationError(evidence.barcode ? null : 'This local preview can check only the sourced sample product.');
      return;
    }
    const key = JSON.stringify(evidence);
    if (pendingResolutionRef.current?.key !== key) {
      pendingResolutionRef.current = { key, requestId: createCatalogRequestId() };
    }
    setIsCheckingProduct(true);
    setEvaluationError(null);
    setIsSearching(false);
    setUnknownBarcode(null);
    setCatalogDetail(null);
    setResolution(null);
    setCandidates([]);
    setConfirmedProduct(null);
    setScanResult(null);
    try {
      const result = await resolveCatalogIdentity({
        ...evidence,
        requestId: pendingResolutionRef.current.requestId,
      });
      pendingResolutionRef.current = null;
      setResolution(result);
      setCandidates(result.state === 'ambiguous_candidates' ? result.candidates : []);
      if (knownProductId && result.product && result.product.productId !== knownProductId) {
        throw new Error('Catalog and resolver identities disagree');
      }
      const selectedId = resolvedCatalogDetailId(result, knownProductId);
      if (selectedId) {
        const detail = await getCatalogProductDetail(selectedId);
        setCatalogDetail(detail);
        setConfirmedProduct({
          name: detail.name, brand: detail.brand,
          category: detail.category as ProductCategory, keyActives: [],
        });
      } else if (evidence.barcode && result.state === 'insufficient_evidence') {
        setUnknownBarcode(evidence.barcode);
      }
    } catch {
      setEvaluationError('We could not check this product right now. Please try again.');
      isScanningLockedRef.current = false;
      setIsLocked(false);
    } finally {
      setIsCheckingProduct(false);
    }
  };

  const handleBarcodeScanned = (scanningResult: BarcodeScanningResult) => {
    if (isScanningLockedRef.current) return;
    isScanningLockedRef.current = true;
    setIsLocked(true);
    void openResolution({ consumer: 'scan', barcode: scanningResult.data });
  };

  const handleSelectSearchResult = (item: CatalogProductSummary) => {
    void Haptics.selectionAsync().catch(() => {});
    if (preview) {
      const detail = getPreviewCatalogDetail(item.productId);
      if (!detail) return;
      setCatalogDetail(detail);
      setResolution(null);
      setScanResult(null);
      setUnknownBarcode(null);
      setEvaluationError(null);
      setIsSearching(false);
      return;
    }
    void openResolution({ consumer: 'scan', brand: item.brand, productName: item.name }, item.productId);
  };

  const handleSelectCandidate = (candidate: ProductResolutionCandidate) => {
    if (!candidate.brand || !candidate.name) return;
    void openResolution({
      consumer: 'scan', brand: candidate.brand, productName: candidate.name,
      variantName: candidate.variantName,
    }, candidate.productId);
  };

  const handleManualNameCheck = () => {
    const name = searchQuery.trim();
    if (name.length < 2) return;
    void openResolution({ consumer: 'scan', productName: name });
  };

  const handleSelectCatalogItem = (item: ScannableProductInput) => {
    Haptics.selectionAsync();
    setConfirmedProduct(item);
    setIsSearching(false);
    setUnknownBarcode(null);
    performEvaluation(item)
      .then((result) => {
        analytics.track('product_scan_recognized', {
          productName: item.name,
        });
        analytics.track('scan_verdict_viewed', {
          productName: item.name,
          verdict: result.verdict,
        });
      })
      .catch((err) => {
        console.warn('Catalog item evaluation failed:', err);
        isScanningLockedRef.current = false;
        setIsLocked(false);
        setEvaluationError(getCustomerErrorMessage('scan'));
      });
  };

  const handleResetScan = () => {
    void Haptics.selectionAsync().catch(() => {});
    setConfirmedProduct(null);
    setCatalogDetail(null);
    setResolution(null);
    setCandidates([]);
    setIsCheckingProduct(false);
    pendingResolutionRef.current = null;
    setScanResult(null);
    setUnknownBarcode(null);
    setEvaluationError(null);
    setSearchQuery('');
    setIsSearching(!targetShell);
    setTimeout(() => {
      isScanningLockedRef.current = false;
      setIsLocked(false);
    }, 1000);
  };

  const handleRetryScan = () => {
    Haptics.selectionAsync();
    setUnknownBarcode(null);
    setEvaluationError(null);
    setTimeout(() => {
      isScanningLockedRef.current = false;
      setIsLocked(false);
    }, 1000);
  };

  const handleHandoffToAsk = () => {
    if (!scanResult) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    analytics.track('scan_ask_handoff', {
      productName: scanResult.productName,
      verdict: scanResult.verdict,
    });

    // Store full typed ProductScanResult in transient client store for Ask context
    useScanContextStore.getState().setActiveScannedProduct(scanResult);

    // Navigate to Ask with canonical route params and legacy fallback params
    router.push({
      pathname: '/(tabs)/ask',
      params: {
        initialQuery: `What does the scan verdict for ${scanResult.brand} ${scanResult.productName} (${scanResult.verdictLabel}) mean for my routine?`,
        productName: scanResult.productName,
        brand: scanResult.brand,
        verdict: scanResult.verdict,
        reason: scanResult.verdictSummary,
        scannedProductName: scanResult.productName,
        scannedBrand: scanResult.brand,
        scannedVerdict: scanResult.verdict,
        scannedReason: scanResult.verdictSummary,
      },
    });
  };

  const getVerdictTone = (verdict: ProductScanVerdict) => {
    switch (verdict) {
      case 'great_fit':
      case 'fits_plan':
        return colors.actionKeep;
      case 'could_work':
        return colors.actionAdd;
      case 'not_needed':
        return colors.actionPause;
      case 'better_replacement':
        return colors.actionReplace;
      case 'use_with_caution':
        return colors.actionPause;
      case 'not_good_fit':
        return colors.actionStop;
      default:
        return { text: colors.inkMuted, bg: colors.surfaceMuted, border: colors.border };
    }
  };

  const resultPresentation = resolveScanResultPresentation(scanResult);
  const invalidResult = Boolean(scanResult && confirmedProduct && resultPresentation.kind === 'invalid');
  const currentFormula = getVerifiedFormulaForResolution(catalogDetail, resolution);
  const cameraHeight = Math.max(360, Math.min(560, windowHeight - insets.top - insets.bottom - layout.gutter * 5));

  if (!targetShell && !showProviderFeatures) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, paddingHorizontal: spacing.lg }]}>
        <Text style={styles.screenTitle}>Check a Product</Text>
        <Text style={{ color: colors.inkMuted, marginVertical: spacing.lg }}>
          Product checking is being prepared for a later beta release.
        </Text>
        <Button label="Return to Shop" variant="secondary" size="medium" onPress={() => router.replace('/(tabs)/shop')} />
      </View>
    );
  }

  if (!targetShell && audience !== 'member') {
    return (
      <View style={[styles.container, { paddingTop: insets.top, paddingHorizontal: spacing.lg }]}>
        <Text style={styles.screenTitle}>Personalized Scan</Text>
        <Text style={{ color: colors.inkMuted, marginVertical: spacing.lg }}>
          Product checking requires Derive membership in supported releases.
        </Text>
        <Button label="Return to Shop" variant="secondary" size="medium" onPress={() => router.replace('/(tabs)/shop')} />
      </View>
    );
  }

  if (isCheckingProduct) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, paddingHorizontal: spacing.lg, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.brand} />
        <Text style={{ color: colors.inkMuted, marginTop: spacing.md }}>Checking product identity...</Text>
      </View>
    );
  }

  if (invalidResult || (evaluationError && !scanResult)) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.screenTitle}>Scan Result</Text>
        </View>
        <View style={styles.permissionContainer}>
          <View style={styles.permissionCard}>
            <View style={styles.permissionIconCircle}>
              <Icon name="info" size={30} color={colors.brand} />
            </View>
            <Text style={styles.permissionTitle}>We couldn't verify this product result</Text>
            <Text style={styles.permissionSubtitle}>
              {evaluationError || 'Please scan it again.'}
            </Text>
            <Button
              label="Scan Again"
              variant="brand"
              size="large"
              onPress={handleResetScan}
              style={{ width: '100%', marginTop: spacing.lg }}
            />
          </View>
        </View>
      </View>
    );
  }

  // 1. RESULT VIEW: Formula Details stays separate from member-specific fit.
  if (scanResult && confirmedProduct && resultPresentation.kind === 'ready') {
    const verdictTone = getVerdictTone(scanResult.verdict);
    const verdictLabel = resultPresentation.label;
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.screenTitle}>Scan Result</Text>
          <TouchableOpacity
            onPress={handleResetScan}
            style={styles.resetButton}
            accessibilityRole="button"
            accessibilityLabel="Scan another product"
          >
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
          {/* Identity, immediate fit, then explanation. */}
          <View style={styles.verdictCard}>
            <Text style={styles.productBrandText}>{confirmedProduct.brand.toUpperCase()}</Text>
            <Text style={styles.productNameText}>{confirmedProduct.name}</Text>

            <Text style={styles.sectionCategoryTag}>FIT FOR YOU RIGHT NOW</Text>
            <View style={[styles.verdictHighlight, { backgroundColor: verdictTone.bg, borderColor: verdictTone.border }]}>
              <Text
                style={[styles.verdictHeadline, { color: verdictTone.text }]}
                accessibilityLabel={`Derive fit: ${verdictLabel}`}
              >
                {verdictLabel.toUpperCase()}
              </Text>
            </View>

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

          {/* Formula facts stay separate from this member-specific fit. */}
          <View style={styles.formulaCard}>
            <Text style={styles.sectionCategoryTag}>FORMULA / PRODUCT FACTS</Text>
            <Text style={styles.formulaTitle}>Catalog details</Text>

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

  if (catalogDetail) {
    const fit = describeCheckProductFit(resolution?.state ?? 'identified_formula_unverified');
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {targetShell ? <RootShellHeader title="Check" /> : (
          <View style={styles.header}>
            <Text style={styles.screenTitle}>Check a Product</Text>
            <AccountSettingsButton />
          </View>
        )}
        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 120 }]}>
          {targetShell ? (
            <>
              <View style={styles.previewProductHeading}>
                <Text style={styles.productBrandText}>{catalogDetail.brand.toUpperCase()}</Text>
                <Text style={styles.productNameText}>{catalogDetail.name}</Text>
              </View>
              <GroupedSection header="Formula Details">
                <View style={styles.previewFactRow}>
                  <Text style={styles.previewFactType}>{catalogDetail.category.replace('_', ' ')}</Text>
                  {currentFormula ? <>
                    <Text style={styles.previewFactText}>Verified ingredients for this exact package: {currentFormula.ingredients.join(', ')}</Text>
                    <Text style={styles.previewFactText}>Provenance: {currentFormula.provenanceType.replace('_', ' ')}</Text>
                  </> : <Text style={styles.previewFactText}>Exact package formula not verified.</Text>}
                  {catalogDetail.sourceReference && (
                    <TouchableOpacity
                      onPress={() => void Linking.openURL(catalogDetail.sourceReference!).catch(() => {})}
                      style={styles.sourceLink}
                      accessibilityRole="link"
                      accessibilityLabel={`View ${catalogDetail.brand} product source`}
                    >
                      <Text style={styles.sourceLinkText}>Source: {catalogDetail.brand}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </GroupedSection>
              {integrated ? <>
                {profileSaveStatus?.kind === 'ready' ? <Text style={styles.previewFactText}>Personalization ready for this client session. Personal Fit is unavailable without product evidence.</Text> : null}
                {profileSaveStatus?.kind === 'unavailable' ? <Text style={styles.previewFactText}>Personalization unavailable. Your answers were not saved.</Text> : null}
                {personalFitState.kind === 'factual_only' ? <Text style={styles.previewFactText}>Not personalized yet.</Text> : null}
                <PersonalFitSection state={personalFitState} onPersonalize={openPersonalization} />
              </> : <GroupedSection header="Personal Fit"><Text style={styles.previewFactText}>Not available yet.</Text></GroupedSection>}
            </>
          ) : (
          <>
          <View style={styles.verdictCard}>
            <Text style={styles.productBrandText}>{catalogDetail.brand.toUpperCase()}</Text>
            <Text style={styles.productNameText}>{catalogDetail.name}</Text>
            <Text style={styles.sectionCategoryTag}>PERSONAL FIT</Text>
            <View style={styles.summaryBox}><Text style={styles.summaryText}>{fit.message}</Text></View>
            {resolution?.requiresFounderReview && (
              <Text style={styles.factText}>A founder review is pending for this identity evidence.</Text>
            )}
          </View>
          {candidates.length > 0 && (
            <View style={styles.formulaCard}>
              <Text style={styles.sectionCategoryTag}>POSSIBLE MATCHES</Text>
              {candidates.map((candidate, index) => (
                <TouchableOpacity
                  key={`${candidate.productId ?? 'unknown'}-${candidate.variantId ?? index}`}
                  style={styles.catalogItemRow}
                  onPress={() => handleSelectCandidate(candidate)}
                  disabled={!candidate.brand || !candidate.name}
                  accessibilityRole="button"
                >
                  <Text style={styles.catalogItemName}>{candidate.brand} {candidate.name}{candidate.variantName ? ` · ${candidate.variantName}` : ''}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <View style={styles.formulaCard}>
            <Text style={styles.sectionCategoryTag}>FORMULA DETAILS</Text>
            <Text style={styles.formulaTitle}>{catalogDetail.category.replace('_', ' ')}</Text>
            {catalogDetail.variants.map((variant) => (
              <View key={variant.variantId} style={styles.formulaRow}>
                <Text style={styles.formulaLabel}>Variant</Text>
                <Text style={styles.formulaValue}>
                  {[variant.name, variant.regionCode, variant.packageSize].filter(Boolean).join(' · ')}
                </Text>
              </View>
            ))}
            {currentFormula ? (
              <>
                <Text style={styles.formulaLabel}>Verified ingredients for this exact package</Text>
                <Text style={styles.formulaValue}>{currentFormula.ingredients.join(', ')}</Text>
                <Text style={styles.formulaLabel}>Provenance</Text>
                <Text style={styles.formulaValue}>{currentFormula.provenanceType.replace('_', ' ')} · Observed {new Date(currentFormula.observedAt).toLocaleDateString()}</Text>
                {currentFormula.sourceReference && <Text style={styles.formulaValue}>Source: {currentFormula.sourceReference}</Text>}
              </>
            ) : (
              <Text style={styles.formulaValue}>The formula in your exact package is not verified yet.</Text>
            )}
            {catalogDetail.sourceReference && <Text style={styles.formulaValue}>Product source: {catalogDetail.sourceReference}</Text>}
          </View>
          </>
          )}
          <Button label="Check another product" variant="outline" size="medium" onPress={handleResetScan} />
        </ScrollView>
      </View>
    );
  }

  if (resolution && !catalogDetail) {
    const fit = describeCheckProductFit(resolution.state);
    return (
      <View style={[styles.container, { paddingTop: insets.top, paddingHorizontal: spacing.lg }]}>
        <Text style={styles.screenTitle}>Check a Product</Text>
        <Text style={{ color: colors.inkMuted, marginVertical: spacing.md }}>{integrated ? 'Product identity is not confirmed. Personal Fit: Not personalized yet.' : fit.message}</Text>
        {!integrated && resolution.requiresFounderReview && <Text style={{ color: colors.inkMuted, marginBottom: spacing.md }}>This check is saved for founder review.</Text>}
        {candidates.map((candidate, index) => (
          <TouchableOpacity
            key={`${candidate.productId ?? 'unknown'}-${candidate.variantId ?? index}`}
            onPress={() => handleSelectCandidate(candidate)}
            disabled={!candidate.brand || !candidate.name}
            style={styles.catalogItemRow}
            accessibilityRole="button"
          >
            <Text style={styles.catalogItemName}>{candidate.brand} {candidate.name}{candidate.variantName ? ` · ${candidate.variantName}` : ''}</Text>
          </TouchableOpacity>
        ))}
        <Button label="Check another product" variant="secondary" size="medium" onPress={handleResetScan} />
      </View>
    );
  }

  if (confirmedProduct && !evaluationError) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.screenTitle}>Evaluating Product</Text>
        </View>
        <View style={styles.evaluatingContent}>
          <ActivityIndicator color={colors.brand} size="large" />
          <Text style={styles.productBrandText}>{confirmedProduct.brand.toUpperCase()}</Text>
          <Text style={styles.productNameText}>{confirmedProduct.name}</Text>
          <Text style={styles.evaluatingText}>Checking how this fits your routine.</Text>
        </View>
      </View>
    );
  }


  if (entryState === 'search') {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {targetShell ? <RootShellHeader title="Check" /> : (
          <View style={styles.header}>
            <Text style={styles.screenTitle}>Check a Product</Text>
            <AccountSettingsButton />
          </View>
        )}
        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]} keyboardShouldPersistTaps="handled">
          {!targetShell && <Text style={styles.subtitle}>Search by product name. A barcode is optional.</Text>}
          <CatalogProductSearch
            label={targetShell ? 'Search by name' : 'Search products'}
            actionLabel="Check"
            search={preview ? searchPreviewCatalog : undefined}
            onSelect={handleSelectSearchResult}
            onQueryChange={setSearchQuery}
            keepFocusAfterSelect={false}
            errorCopy={targetShell ? 'Search is unavailable right now.' : 'Search is unavailable right now. You can still request founder review.'}
            emptyCopy={targetShell ? 'No product match yet.' : 'No catalog match yet. Try another name or request founder review.'}
          />
          {integrated && searchQuery.trim().length >= 2 && (
            <Button label="Check name as entered" variant="ghost" size="medium" onPress={handleManualNameCheck} style={{ marginTop: spacing.md }} />
          )}
          <Button label={targetShell ? 'Scan barcode' : 'Use barcode camera'} variant="outline" size="medium" onPress={() => { if (targetShell) void handleScanBarcodePress(); else { setIsSearching(false); handleRetryScan(); } }} style={{ marginTop: spacing.lg }} />
        </ScrollView>
      </View>
    );
  }

  if (targetShell && entryState === 'landing') {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <RootShellHeader title="Check" />
        <View style={styles.entryContent}>
          <View style={styles.entryIcon}><Icon name="scan" size={28} color={colors.brand} /></View>
          <Text style={styles.entryTitle}>Scan a barcode</Text>
          <Text style={styles.entryBody}>Use the barcode on the product package.</Text>
          <Button label="Scan barcode" variant="brand" onPress={() => void handleScanBarcodePress()} style={styles.entryAction} />
          <TouchableOpacity onPress={handleSearchNamePress} style={styles.modeSwitch} accessibilityRole="button" accessibilityLabel="Search by name" activeOpacity={0.7}>
            <Text style={styles.modeSwitchText}>Search by name</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (targetShell && entryState === 'denied') {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <RootShellHeader title="Check" />
        <View style={styles.entryContent}>
          <View style={styles.entryIcon}><Icon name="camera" size={28} color={colors.brand} /></View>
          <Text style={styles.entryTitle}>Camera access is off</Text>
          <Text style={styles.entryBody}>You can still check a product by name.</Text>
          <TouchableOpacity onPress={handleSearchNamePress} style={[styles.entryAction, styles.primaryModeSwitch]} accessibilityRole="button" accessibilityLabel="Search by name" activeOpacity={0.8}>
            <Text style={styles.primaryModeSwitchText}>Search by name</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // 3. PERMISSION SCREEN (If camera permission is denied)
  if (permission && !permission.granted) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.scannerHeader}>
          <View style={styles.headerTopRow}>
            <Text style={styles.screenTitle}>Check a Product</Text>
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
        </View>

        <View style={styles.permissionContainer}>
          <View style={styles.permissionCard}>
            <View style={styles.permissionIconCircle}>
              <Icon name="camera" size={32} color={colors.brand} />
            </View>
            <Text style={styles.permissionTitle}>Camera Access Required</Text>
            <Text style={styles.permissionSubtitle}>
              Camera access reads barcodes for product identity. Personal fit is shown only when verified and available.
            </Text>
            <Button
              label="Allow Camera Access"
              variant="brand"
              size="large"
              onPress={requestPermission}
              style={{ width: '100%', marginTop: spacing.lg }}
            />
            <Button
              label="Search Products by Name"
              variant="ghost"
              size="medium"
              onPress={() => setIsSearching(true)}
              style={{ width: '100%', marginTop: spacing.sm }}
            />
          </View>
        </View>
      </View>
    );
  }

  // 4. One barcode viewfinder for the target root and legacy route.
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {targetShell ? <RootShellHeader title="Check" /> : (
        <View style={styles.scannerHeader}>
          <View style={styles.headerTopRow}>
            <Text style={styles.screenTitle}>Check a Product</Text>
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
          <Text style={styles.subtitle}>Align a barcode within the guide, or search by name instead.</Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.cameraFrameContainer}>
          {/* Live Barcode Camera Viewport */}
          <View style={[styles.cameraViewport, targetShell && { height: cameraHeight }]}>
            <CameraView
              facing="back"
              enableTorch={torchOn}
              barcodeScannerSettings={{
                barcodeTypes: ['upc_a', 'upc_e', 'ean13', 'ean8'],
              }}
              onBarcodeScanned={isLocked ? undefined : handleBarcodeScanned}
              style={StyleSheet.absoluteFill}
            />

            {/* Torch Toggle Button */}
            <TouchableOpacity
              style={[styles.torchButton, torchOn && styles.torchButtonActive]}
              onPress={() => {
                Haptics.selectionAsync();
                setTorchOn((prev) => !prev);
              }}
              accessibilityRole="button"
              accessibilityLabel={torchOn ? 'Turn off flash' : 'Turn on flash'}
            >
              <Icon name="flashlight" size={20} color={torchOn ? colors.brand : '#FFFFFF'} />
            </TouchableOpacity>

            {/* Barcode Reticle Overlay */}
            <View style={styles.reticleOverlay} pointerEvents="none">
              <View style={styles.reticleBox}>
                <View style={[styles.corner, styles.cornerTL]} />
                <View style={[styles.corner, styles.cornerTR]} />
                <View style={[styles.corner, styles.cornerBL]} />
                <View style={[styles.corner, styles.cornerBR]} />
                <View style={styles.laserGuide} />
              </View>
              <Text style={styles.reticleGuideText}>Center barcode in box</Text>
            </View>
            {targetShell && (
              <GlassContainer isFloating style={styles.searchGlass} glassEffectStyle="regular" tintColor={colors.glass.tintDark}>
                <TouchableOpacity onPress={handleSearchNamePress} style={styles.glassSearchControl} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel="Search by name">
                  <Icon name="search" size={18} color={colors.inkInverse} />
                  <Text style={styles.glassSearchText}>Search by name</Text>
                </TouchableOpacity>
              </GlassContainer>
            )}
          </View>

          {/* Name Search Fallback Button */}
          {!targetShell && <TouchableOpacity
            style={styles.manualSearchLink}
            onPress={handleSearchNamePress}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Search beta products by name"
          >
            <Icon name="search" size={16} color={colors.brand} />
            <Text style={styles.manualSearchText}>Can't scan barcode? Search by name</Text>
          </TouchableOpacity>}

          {/* Quick Shortcuts for Instant Testing (Dev only) */}
          {__DEV__ && !targetShell && (
            <View style={styles.quickShortcuts}>
              <Text style={styles.shortcutHeading}>TEST PRESETS</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shortcutPillRow}>
                {PROTOTYPE_CATALOG.map((item, idx) => (
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
              </ScrollView>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Unknown Barcode Modal Sheet */}
      {unknownBarcode && (
        <View
          style={[
            styles.unknownOverlay,
            { paddingBottom: 88 + insets.bottom },
          ]}
        >
          <View style={styles.unknownCard}>
            <View style={styles.unknownIconCircle}>
              <Icon name="warning" size={24} color={colors.actionPause.text} />
            </View>
            <Text style={styles.unknownTitle}>Barcode Not Recognized</Text>
            <Text style={styles.unknownText}>
              {targetShell
                ? 'No verified barcode match. Search by name.'
                : `We couldn't find a formula match for barcode ${unknownBarcode} in our beta catalog yet.`}
            </Text>
            <View style={styles.unknownButtons}>
              <Button
                label="Search by Product Name"
                variant="brand"
                size="medium"
                onPress={() => {
                  setUnknownBarcode(null);
                  setIsSearching(true);
                }}
              />
              <Button
                label="Scan Another"
                variant="outline"
                size="medium"
                onPress={handleRetryScan}
              />
            </View>
          </View>
        </View>
      )}

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
    minHeight: 44,
    justifyContent: 'center',
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
  entryContent: {
    paddingHorizontal: layout.gutter,
    paddingTop: spacing.xxl,
  },
  entryIcon: {
    width: 56,
    height: 56,
    borderRadius: radii.full,
    backgroundColor: colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  entryTitle: {
    color: colors.ink,
    fontSize: typography.sizes.sectionTitle,
    lineHeight: typography.lineHeights.sectionTitle,
    fontWeight: typography.weights.semibold,
  },
  entryBody: {
    color: colors.inkMuted,
    fontSize: typography.sizes.bodyRegular,
    lineHeight: typography.lineHeights.bodyRegular,
    marginTop: spacing.xs,
  },
  entryAction: { marginTop: spacing.xl },
  modeSwitch: { minHeight: layout.minTouchTarget, justifyContent: 'center', alignSelf: 'flex-start', marginTop: spacing.sm },
  modeSwitchText: { color: colors.brand, fontSize: typography.sizes.bodyRegular, fontWeight: typography.weights.semibold },
  primaryModeSwitch: { minHeight: layout.ctaHeight, width: '100%', alignItems: 'center', backgroundColor: colors.brand, borderRadius: radii.full },
  primaryModeSwitchText: { color: colors.inkInverse, fontSize: typography.sizes.bodyRegular, fontWeight: typography.weights.bold },
  cameraFrameContainer: {
    gap: spacing.md,
  },
  manualSearchLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    minHeight: 44,
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
  verdictHighlight: {
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  verdictHeadline: {
    fontSize: typography.sizes.sectionTitle,
    fontWeight: typography.weights.bold,
    lineHeight: typography.lineHeights.sectionTitle,
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
  evaluatingContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  evaluatingText: {
    fontSize: typography.sizes.bodyRegular,
    color: colors.inkMuted,
    textAlign: 'center',
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
  searchEmpty: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  searchEmptyTitle: {
    fontSize: typography.sizes.bodyRegular,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
  },
  searchEmptyText: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
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
  cameraViewport: {
    height: 380,
    borderRadius: radii.xl,
    overflow: 'hidden',
    backgroundColor: '#000000',
    position: 'relative',
  },
  searchGlass: { position: 'absolute', bottom: spacing.md, alignSelf: 'center' },
  glassSearchControl: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingHorizontal: spacing.lg },
  glassSearchText: { color: colors.inkInverse, fontSize: typography.sizes.bodyRegular, fontWeight: typography.weights.semibold },
  previewProductHeading: { marginBottom: spacing.lg },
  previewFactRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.xs },
  previewFactType: { color: colors.ink, fontSize: typography.sizes.bodyRegular, fontWeight: typography.weights.semibold, textTransform: 'capitalize' },
  previewFactText: { color: colors.inkMuted, fontSize: typography.sizes.bodyRegular, lineHeight: typography.lineHeights.bodyRegular },
  sourceLink: { minHeight: layout.minTouchTarget, alignSelf: 'flex-start', justifyContent: 'center', marginTop: spacing.xs },
  sourceLinkText: { color: colors.brand, fontSize: typography.sizes.bodyRegular, fontWeight: typography.weights.semibold },
  torchButton: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  torchButtonActive: {
    backgroundColor: colors.surface,
  },
  reticleOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  reticleBox: {
    width: 280,
    height: 140,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#FFFFFF',
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: radii.md,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: radii.md,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: radii.md,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: radii.md,
  },
  laserGuide: {
    width: '90%',
    height: 2,
    backgroundColor: colors.brand,
    opacity: 0.85,
  },
  reticleGuideText: {
    color: '#FFFFFF',
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.medium,
    marginTop: spacing.md,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  permissionCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.xl,
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    ...shadows.subtle,
  },
  permissionIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  permissionTitle: {
    fontSize: typography.sizes.sectionTitle,
    fontFamily: typography.fontFamilies.serif,
    color: colors.ink,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  permissionSubtitle: {
    fontSize: typography.sizes.bodyRegular,
    color: colors.inkMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  unknownOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(23, 26, 24, 0.5)',
    paddingHorizontal: spacing.lg,
    justifyContent: 'flex-end',
  },
  unknownCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    ...shadows.floating,
  },
  unknownIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.canvasMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  unknownTitle: {
    fontSize: typography.sizes.bodyLarge,
    fontWeight: typography.weights.bold,
    color: colors.ink,
    marginBottom: 4,
  },
  unknownText: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  unknownButtons: {
    flexDirection: 'column',
    gap: spacing.sm,
    width: '100%',
  },
});
