import React, { useState, useEffect, useRef, useSyncExternalStore } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  TextInput,
  ActivityIndicator,
  Linking,
  Keyboard,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { colors, typography, spacing, radii, shadows, layout } from '@/src/constants/theme';
import { useRoutineStore } from '@/src/stores/routineStore';
import { useOnboardingStore } from '@/src/stores/onboardingStore';
import { useAuthStore } from '@/src/stores/authStore';
import { useFreeAccessStore } from '@/src/stores/freeAccessStore';
import { Icon } from '@/src/components/ui/Icon';
import { Button } from '@/src/components/ui/Button';
import { analytics } from '@/src/services/analytics';
import { PROTOTYPE_CATALOG, ScannableProductInput } from '@/src/services/catalog';
import { CatalogProductSearch } from '@/src/components/catalog/CatalogProductSearch';
import type { CatalogProductSummary, CatalogProductDetail } from '@/src/contracts/ProductCatalog';
import type { ProductResolutionResult, ProductResolutionCandidate, ResolveProductIdentityInput } from '@/src/contracts/ProductIdentityResolver';
import { hasVerifiedPackageFormula } from '@/src/contracts/ProductTruthSnapshot';
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
import { RootShellHeader } from '@/src/components/shell/RootShellHeader';
import { CheckCaptureHost } from '@/src/components/check/capture/CheckCaptureHost';
import { ScanResultSheet } from '@/src/components/check/result-sheet/ScanResultSheet';
import { CheckResultPresentation } from '@/src/components/check/result-sheet/CheckResultPresentation';
import { selectCheckContentInput, selectCurrentCheckDecision, describeCheckLinkNotice } from '@/src/presentation/check/result-sheet/composition';
import { createCheckResultLifecycle, type CheckResultOperation, type CheckResultOrigin } from '@/src/presentation/check/result-sheet/lifecycle';
import { contextEditorDestination } from '@/src/presentation/personal-decision/editorEntry';
import { cameraCompanionSheet, cameraResultNeedsExistingPage } from '@/src/presentation/check/result-sheet/cameraCompanion';
import type { CheckCaptureHandoff } from '@/src/presentation/capture/checkCaptureAdapter';
import type { CaptureRole } from '@/src/presentation/capture/productEvidence';
import { personalizationGateway, resolvePersonalizationOwnerId } from '@/src/presentation/personalization/gateway';
import { ownerPinnedLegacyGateway } from '@/src/presentation/personal-decision/customerGateway';
import { selectFreeFitTarget } from '@/src/presentation/personalization/fitTarget';
import type { PersonalFitRefreshInput } from '@/src/presentation/personalization/result';
import { canPublishCheckResult, createCheckMemorySaver, selectFreeCheckOwner,
  selectSavableCheckCaseId, shouldHideCheckForOwner, validateCheckResolution } from '@/src/presentation/check/checkMemory';
import { describePersonalDecision } from '@/src/presentation/personal-decision/result';
import { customerController, currentCustomerOwner } from '@/src/presentation/personal-decision/customerGateway';
import { selectVisibleCustomerDecision, loadOptionalCustomerCatalog, canShowLegacyPersonalFit } from '@/src/presentation/personal-decision/customerController';
import { projectTrustedSnapshot } from '@/src/presentation/personal-decision/truthAdapter';
import { createCustomerCheckFlow, selectIdentityNextAction, selectVisibleCheckView } from '@/src/presentation/product-analytics/checkFlow';
import type { ProductEventSink } from '@/src/presentation/product-analytics';
import type { DecisionNextStep } from '@/src/contracts/PersonalDecision';
import { recordFreeCheck } from '@/src/services/remote/freeContext';
import { supabase } from '@/src/services/supabase';
import { resolveProductLink, ProductLinkError } from '@/src/services/productLinks';
import type { ProductLinkIntakeResult } from '@/src/contracts/ProductLinkIntake';
import { captureCustomerFunctionClient, type CustomerFunctionClient } from '@/src/presentation/personal-decision/customerController';
import { MissingProductContribution } from '@/src/components/check/contribution/MissingProductContribution';
import { selectCheckContributionRecovery } from '@/src/presentation/catalog-contribution/checkRecovery';

export default function CheckProductScreen({ productEventSink }: { productEventSink?: ProductEventSink } = {}) {
  const router = useRouter();
  const params = useLocalSearchParams<{ sim?: string }>();
  const insets = useSafeAreaInsets();
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
  const sessionUserId = useAuthStore((s) => s.sessionUserId);
  const authStatus = useAuthStore((s) => s.status);
  const accessStatus = useFreeAccessStore((s) => s.status);
  const accessUserId = useFreeAccessStore((s) => s.userId);
  const accessOwnerId = useFreeAccessStore((s) => s.access?.userId ?? null);
  const liveCheckOwner = selectFreeCheckOwner({
    shell, authStatus, sessionUserId, accessStatus, accessUserId, accessOwnerId,
  });
  const ownerId = resolvePersonalizationOwnerId(sessionUserId, shell);
  const gateway = integrated ? ownerPinnedLegacyGateway : personalizationGateway;
  const [legacyPersonalFitState, setPersonalFitState] = useState<PersonalFitRefreshInput>({ kind: 'factual_only' });
  const customerState = useSyncExternalStore(customerController.subscribe, customerController.getState);
  const personalFitState: PersonalFitRefreshInput = integrated && liveCheckOwner && !canShowLegacyPersonalFit(customerState, liveCheckOwner) ? { kind: 'factual_only' } : legacyPersonalFitState;
  const resultScroll = useRef<ScrollView>(null);
  const entryScroll = useRef<ScrollView>(null);
  const entryScrollOffset = useRef(0);
  const linkInput = useRef<TextInput>(null);
  const resultLifecycle = useRef(createCheckResultLifecycle());
  const resultOperationRef = useRef<CheckResultOperation | null>(null);
  const resultOriginRef = useRef<CheckResultOrigin | null>(null);
  const [contextualResultOpen, setContextualResultOpen] = useState(false);
  const [fullResult, setFullResult] = useState(false);
  const [searchFocusKey, setSearchFocusKey] = useState(0);
  const [editingContext, setEditingContext] = useState(false);
  const liveSnapshotRef = useRef<ProductResolutionResult['truthSnapshot'] | null>(null);
  const checkFlowRef = useRef<ReturnType<typeof createCustomerCheckFlow> | null>(null);
  if (!checkFlowRef.current) checkFlowRef.current = createCustomerCheckFlow(productEventSink);
  const [isCheckFocused, setCheckFocused] = useState(false);
  useFocusEffect(React.useCallback(() => {
    setCheckFocused(true);
    setEditingContext(false);
    return () => setCheckFocused(false);
  }, []));
  const [nextStepMessage, setNextStepMessage] = useState<{ snapshotId: string; contextRevision: number; text: string } | null>(null);
  const { routine, userProducts, checkIns } = useRoutineStore();
  const { productReactions, routineComplexity, primaryGoal, costPreference } = useOnboardingStore();

  const [confirmedProduct, setConfirmedProduct] = useState<ScannableProductInput | null>(null);
  const [scanResult, setScanResult] = useState<ProductScanResult | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [productLink, setProductLink] = useState('');
  const [linkNote, setLinkNote] = useState<string | null>(null);
  const [linkIntake, setLinkIntake] = useState<Exclude<ProductLinkIntakeResult, { status: 'resolution' }> | null>(null);
  const pendingLinkRef = useRef<{ url: string; requestId: string } | null>(null);
  const [isSearching, setIsSearching] = useState(!targetShell);
  const [captureRole, setCaptureRole] = useState<CaptureRole | null>(null);
  const [cameraAwaitingResult, setCameraAwaitingResult] = useState(false);
  const [cameraScanId, setCameraScanId] = useState('');
  const [cameraSessionKey, setCameraSessionKey] = useState(0);
  const [detectionPaused, setDetectionPaused] = useState(false);
  const [captureEvidence, setCaptureEvidence] = useState<CheckCaptureHandoff | null>(null);
  const [catalogDetail, setCatalogDetail] = useState<CatalogProductDetail | null>(null);
  const [resolution, setResolution] = useState<ProductResolutionResult | null>(null);
  const liveResolutionRef = useRef<ProductResolutionResult | null>(null);
  liveResolutionRef.current = resolution;
  const personalTarget = integrated && liveCheckOwner ? resolution?.truthSnapshot ?? null : null;
  liveSnapshotRef.current = personalTarget;
  const visibleDecision = selectVisibleCustomerDecision(customerState, liveCheckOwner, personalTarget);
  const resultOperation = resultOperationRef.current;
  const showNextStep = (text: string) => { if (personalTarget && visibleDecision) setNextStepMessage({ snapshotId: personalTarget.snapshotId, contextRevision: visibleDecision.contextRevision, text }); };
  useFocusEffect(React.useCallback(() => {
    let active = true;
    const liveOwner = currentCustomerOwner();
    customerController.setOwner(liveOwner);
    customerController.setOriginSnapshot(liveOwner, personalTarget);
    setNextStepMessage(null);
    if (liveOwner) void customerController.load().then(loaded => { if (active && loaded && personalTarget) void customerController.assess(personalTarget); });
    return () => { active = false; };
  }, [liveCheckOwner, personalTarget]));
  useEffect(() => { customerController.setOwner(currentCustomerOwner()); }, [sessionUserId, authStatus, accessStatus, accessUserId, accessOwnerId]);
  const openDecisionEditor = (mode: 'profile' | 'routine' | 'history', entry?: 'new') => {
    Keyboard.dismiss();
    setEditingContext(true);
    setCaptureRole(null);
    router.push({ pathname: '/personalize', params: { p0b: '1', mode, source: 'check', snapshotId: liveSnapshotRef.current?.snapshotId, ...(entry ? { entry } : {}) } });
  };
  const handleDecisionStep = (step: DecisionNextStep) => {
    const owner = currentLiveCheckOwner();
    const snapshot = liveSnapshotRef.current ?? null;
    const current = selectCurrentCheckDecision(customerController.getState(), owner, snapshot, visibleDecision);
    if (!current || step !== current.packet.action.nextStep || !snapshot || !resultOperation || !resultLifecycle.current.canAct(resultOperation, owner, {
      snapshotId: snapshot.snapshotId, caseRevision: snapshot.caseRevision,
      formulaVersionId: current.expectedBinding.formulaVersionId, contextRevision: current.contextRevision,
    })) return;
    if (step === 'add_context') {
      const destination = contextEditorDestination(current.packet);
      if (destination) openDecisionEditor(destination.mode, destination.entry);
      return;
    }
    if (step === 'review_routine' || step === 'keep_current') { openDecisionEditor('routine'); return; }
    if (step === 'view_product_facts') { showNextStep('Review the formula details and remaining uncertainty for this same product.'); setFullResult(true); resultScroll.current?.scrollTo({ y: 0, animated: true }); return; }
    if (step === 'confirm_formula') { showNextStep('Review the formula details for this exact product. Confirm its package evidence before relying on a personal decision.'); setFullResult(true); resultScroll.current?.scrollTo({ y: 0, animated: true }); return; }
    if (step === 'ask_clinician') { showNextStep('Bring this product formula, your routine, and the relevant caution to a qualified professional. Derive cannot review or change prescriptions.'); return; }
    if (step === 'skip_product') { showNextStep('Keep this product out of your routine for now. You can check another product when ready.'); return; }
    showNextStep('Review the product facts and remaining uncertainty before deciding to use it.'); resultScroll.current?.scrollTo({ y: 0, animated: true });
  };

  useFocusEffect(React.useCallback(() => {
    let active = true;
    const status = gateway.lastSaveStatus(ownerId);
    const target = integrated ? selectFreeFitTarget(catalogDetail, resolution) : null;
    const refreshFit = () => {
      if (!catalogDetail?.productId) return;
      if (!target) { setPersonalFitState({ kind: 'insufficient' }); return; }
      setPersonalFitState({ kind: 'loading' });
      void gateway.getFit(ownerId, target.productId, target.variantId).then((fit) => {
        if (active) setPersonalFitState(fit);
      }).catch(() => { if (active) setPersonalFitState({ kind: 'unavailable' }); });
    };
    if (status?.kind === 'unavailable') {
      setPersonalFitState({ kind: 'unavailable', reason: 'answers_not_saved' });
    } else if (status?.kind === 'ready') {
      if (integrated) refreshFit();
      else setPersonalFitState({ kind: 'unavailable', reason: 'client_session_ready' });
    } else if (integrated && ownerId) {
      setPersonalFitState({ kind: 'loading' });
      void gateway.loadProfile(ownerId).then((result) => {
        if (!active) return;
        if (result.kind === 'ready') refreshFit();
        else setPersonalFitState({ kind: 'factual_only' });
      }).catch(() => { if (active) setPersonalFitState({ kind: 'unavailable' }); });
    } else {
      setPersonalFitState({ kind: 'factual_only' });
    }
    return () => { active = false; };
  }, [ownerId, catalogDetail, resolution, gateway, integrated]));
  const [candidates, setCandidates] = useState<ProductResolutionCandidate[]>([]);
  const [isCheckingProduct, setIsCheckingProduct] = useState(false);
  const showProviderFeatures = showsProviderBetaFeatures(publicEnvironment.buildFlavor);
  const [torchOn, setTorchOn] = useState(false);
  const [unknownBarcode, setUnknownBarcode] = useState<string | null>(null);
  const [evaluationError, setEvaluationError] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const isScanningLockedRef = useRef(false);
  const pendingResolutionRef = useRef<{ key: string; requestId: string } | null>(null);
  const lastResolutionRequestRef = useRef<{ evidence: Omit<ResolveProductIdentityInput, 'requestId'>; knownProductId?: string; origin?: CheckResultOrigin } | null>(null);
  const lastTypedNameRef = useRef<string | null>(null);
  const resolutionOwnerRef = useRef<string | null>(null);
  const previousCheckOwnerRef = useRef(sessionUserId);
  const resolutionSequenceRef = useRef(0);
  const checkMemorySaverRef = useRef(createCheckMemorySaver(recordFreeCheck, createCatalogRequestId));
  const [, refreshCheckMemory] = useState(0);

  const currentLiveCheckOwner = () => {
    const auth = useAuthStore.getState();
    const access = useFreeAccessStore.getState();
    return selectFreeCheckOwner({
      shell, authStatus: auth.status, sessionUserId: auth.sessionUserId,
      accessStatus: access.status, accessUserId: access.userId,
      accessOwnerId: access.access?.userId ?? null,
    });
  };

  useEffect(() => {
    let owner = currentLiveCheckOwner();
    const observeOwner = () => {
      const next = currentLiveCheckOwner();
      if (next === owner) return;
      owner = next;
      resultLifecycle.current.invalidate();
      resultOperationRef.current = null;
      resolutionSequenceRef.current += 1;
    };
    const stopAuth = useAuthStore.subscribe(observeOwner);
    const stopAccess = useFreeAccessStore.subscribe(observeOwner);
    return () => {
      stopAuth();
      stopAccess();
      resultLifecycle.current.invalidate();
      resolutionSequenceRef.current += 1;
    };
  }, [shell]);

  useEffect(() => {
    if (!resultOperation || !personalTarget || !visibleDecision) return;
    resultLifecycle.current.bind(resultOperation, liveCheckOwner, {
      snapshotId: personalTarget.snapshotId, caseRevision: personalTarget.caseRevision,
      formulaVersionId: visibleDecision.expectedBinding.formulaVersionId, contextRevision: visibleDecision.contextRevision,
    });
  }, [resultOperation, personalTarget, visibleDecision, liveCheckOwner]);

  const invalidateResult = () => {
    resultLifecycle.current.invalidate();
    resultOperationRef.current = null;
    resolutionSequenceRef.current += 1;
  };
  const beginResult = (origin: CheckResultOrigin, requestId: string) => {
    Keyboard.dismiss();
    resultOriginRef.current = origin;
    resultOperationRef.current = resultLifecycle.current.begin(currentLiveCheckOwner(), origin, requestId);
    setFullResult(false);
    if (origin.kind !== 'camera') setContextualResultOpen(true);
  };
  const closeContextualResult = () => {
    const operation = resultOperationRef.current;
    const origin = operation ? resultLifecycle.current.dismiss(operation, currentLiveCheckOwner()) : null;
    invalidateResult();
    checkFlowRef.current?.abandon();
    setContextualResultOpen(false);
    setFullResult(false);
    setLinkIntake(null);
    resolutionOwnerRef.current = null;
    setResolution(null);
    setCatalogDetail(null);
    setCandidates([]);
    setIsCheckingProduct(false);
    setEvaluationError(null);
    setUnknownBarcode(null);
    setCaptureEvidence(null);
    setConfirmedProduct(null);
    setScanResult(null);
    setNextStepMessage(null);
    // Query/list are retained inside the mounted search. Retry identity survives a transient close.
    if (origin?.kind === 'search' || origin?.kind === 'link') {
      entryScroll.current?.scrollTo({ y: origin.scrollOffset, animated: false });
      if (origin.kind === 'search') setSearchFocusKey(value => value + 1);
      else requestAnimationFrame(() => linkInput.current?.focus());
    }
    resultOriginRef.current = null;
  };

  useEffect(() => {
    if (!integrated || previousCheckOwnerRef.current === sessionUserId) return;
    checkFlowRef.current?.abandon();
    invalidateResult();
    setContextualResultOpen(false);
    setFullResult(false);
    previousCheckOwnerRef.current = sessionUserId;
    resolutionOwnerRef.current = null;
    pendingResolutionRef.current = null;
    lastResolutionRequestRef.current = null;
    lastTypedNameRef.current = null;
    checkMemorySaverRef.current = createCheckMemorySaver(recordFreeCheck, createCatalogRequestId);
    setCatalogDetail(null);
    setResolution(null);
    setCandidates([]);
    setConfirmedProduct(null);
    setScanResult(null);
    setCaptureRole(null);
    setCaptureEvidence(null);
    setUnknownBarcode(null);
    setEvaluationError(null);
    setPersonalFitState({ kind: 'factual_only' });
    setSearchQuery('');
    setProductLink('');
    setLinkNote(null);
    setLinkIntake(null);
    pendingLinkRef.current = null;
    setIsCheckingProduct(false);
    setIsSearching(false);
  }, [integrated, sessionUserId]);
  useEffect(() => {
    if (integrated && !liveCheckOwner) {
      checkFlowRef.current?.abandon();
      invalidateResult();
      setContextualResultOpen(false);
      setFullResult(false);
      setIsCheckingProduct(false);
      resolutionOwnerRef.current = null;
      pendingResolutionRef.current = null;
      lastResolutionRequestRef.current = null;
      pendingLinkRef.current = null;
      setLinkIntake(null);
      setCatalogDetail(null);
      setResolution(null);
      setCandidates([]);
      setConfirmedProduct(null);
      setScanResult(null);
      setCaptureEvidence(null);
      setCaptureRole(null);
      setCameraAwaitingResult(false);
      setUnknownBarcode(null);
      setEvaluationError(null);
      setSearchQuery('');
    }
  }, [integrated, liveCheckOwner]);

  const renderSaveCheckAction = (caseId?: string) => {
    const savableCaseId = selectSavableCheckCaseId({
      caseId: caseId ?? null, liveOwner: liveCheckOwner,
      resultOwner: resolutionOwnerRef.current, hasError: Boolean(evaluationError),
    });
    if (!liveCheckOwner || !savableCaseId) return null;
    const status = checkMemorySaverRef.current.status(liveCheckOwner, savableCaseId);
    return (
      <View style={styles.saveCheckAction}>
        <Button
          label={status === 'saved' ? 'Check saved to My Stuff'
            : status === 'failed' ? 'Try saving check again' : 'Save this check to My Stuff'}
          variant="outline"
          size="medium"
          loading={status === 'saving'}
          disabled={status === 'saved'}
          onPress={() => {
            const currentOwner = currentLiveCheckOwner();
            if (currentOwner !== liveCheckOwner || resolutionOwnerRef.current !== currentOwner
              || liveResolutionRef.current?.caseId !== caseId
              || !resultOperation || !resultLifecycle.current.canPublish(resultOperation, currentOwner)) return;
            const save = checkMemorySaverRef.current.save(currentOwner, savableCaseId);
            refreshCheckMemory((value) => value + 1);
            void save.then(() => refreshCheckMemory((value) => value + 1));
          }}
        />
        {status === 'failed' && <Text style={styles.saveCheckMessage}>Could not save this check. Try again.</Text>}
      </View>
    );
  };

  const handleSearchNamePress = () => {
    setLinkIntake(null);
    invalidateResult();
    setContextualResultOpen(false);
    setFullResult(false);
    setSearchFocusKey(value => value + 1);
    void Haptics.selectionAsync().catch(() => {});
    lastTypedNameRef.current = null;
    setCaptureRole(null);
    setCaptureEvidence(null);
    setUnknownBarcode(null);
    setCatalogDetail(null);
    setResolution(null);
    setCandidates([]);
    setConfirmedProduct(null);
    setScanResult(null);
    setEvaluationError(null);
    setIsSearching(true);
  };

  const openCapture = (role: CaptureRole) => {
    setLinkIntake(null);
    pendingLinkRef.current = null;
    invalidateResult();
    setContextualResultOpen(false);
    setFullResult(false);
    setCatalogDetail(null);
    setResolution(null);
    setCandidates([]);
    setEvaluationError(null);
    pendingResolutionRef.current = null;
    lastTypedNameRef.current = null;
    setCameraAwaitingResult(false);
    setDetectionPaused(false);
    setCaptureRole(role);
    setCaptureEvidence(null);
    setUnknownBarcode(null);
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

  const showResolution = async (
    loadResult: (client?: CustomerFunctionClient) => Promise<ProductResolutionResult | null>,
    knownProductId?: string,
    barcode?: string,
  ) => {
    if (!resultOperationRef.current) beginResult({ kind: 'camera', sessionId: cameraScanId || createCatalogRequestId() }, createCatalogRequestId());
    const operation = resultOperationRef.current!;
    const requestOwner = liveCheckOwner;
    const requestSequence = ++resolutionSequenceRef.current;
    resolutionOwnerRef.current = null;
    setIsCheckingProduct(true);
    setEvaluationError(null);
    if (!targetShell) setIsSearching(false);
    setUnknownBarcode(null);
    setCatalogDetail(null);
    setResolution(null);
    setCandidates([]);
    setConfirmedProduct(null);
    setScanResult(null);
    setLinkIntake(null);
    try {
      const client = integrated && requestOwner ? await captureCustomerFunctionClient(requestOwner, supabase, currentLiveCheckOwner, changed => {
        customerController.setOwner(changed);
        if (!resultLifecycle.current.canPublish(operation, currentLiveCheckOwner())) return;
        invalidateResult();
        setIsCheckingProduct(false);
        setEvaluationError('Could not verify this account for product lookup. Try again.');
      }) : undefined;
      if (!resultLifecycle.current.canPublish(operation, currentLiveCheckOwner())) return;
      const raw = await loadResult(client);
      if (!raw || !resultLifecycle.current.canPublish(operation, currentLiveCheckOwner())) return;
      const result = validateCheckResolution(raw, knownProductId);
      const selectedId = resolvedCatalogDetailId(result, knownProductId);
      const detail = selectedId ? await loadOptionalCustomerCatalog(integrated ? result.truthSnapshot ?? null : null, () => getCatalogProductDetail(selectedId, client)) : null;
      if (requestSequence !== resolutionSequenceRef.current
        || !resultLifecycle.current.canPublish(operation, currentLiveCheckOwner())
        || !canPublishCheckResult(integrated, requestOwner, currentLiveCheckOwner())) return;
      resolutionOwnerRef.current = requestOwner;
      setResolution(result);
      setCandidates(result.state === 'ambiguous_candidates' ? result.candidates : []);
      if (detail) {
        setCatalogDetail(detail);
        setConfirmedProduct({
          name: detail.name, brand: detail.brand,
          category: detail.category as ProductCategory, keyActives: [],
        });
      } else if (barcode && result.state === 'insufficient_evidence') {
        setUnknownBarcode(barcode);
      }
      return true;
    } catch (error) {
      if (requestSequence !== resolutionSequenceRef.current
        || !resultLifecycle.current.canPublish(operation, currentLiveCheckOwner())
        || !canPublishCheckResult(integrated, requestOwner, currentLiveCheckOwner())) return;
      resolutionOwnerRef.current = null;
      setResolution(null);
      setCandidates([]);
      setEvaluationError(error instanceof ProductLinkError ? error.message : 'We could not check this product right now. Please try again.');
      isScanningLockedRef.current = false;
      setIsLocked(false);
    } finally {
      if (requestSequence === resolutionSequenceRef.current) setIsCheckingProduct(false);
    }
  };

  const openResolution = async (
    evidence: Omit<ResolveProductIdentityInput, 'requestId'>,
    knownProductId?: string,
    origin?: CheckResultOrigin,
  ) => {
    lastResolutionRequestRef.current = { evidence, knownProductId, origin };
    lastTypedNameRef.current = evidence.productName && !evidence.brand ? evidence.productName : null;
    if (preview) {
      resolutionOwnerRef.current = null;
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
    const requestId = pendingResolutionRef.current.requestId;
    beginResult(origin ?? { kind: 'camera', sessionId: cameraScanId || requestId }, requestId);
    const published = await showResolution(client => resolveCatalogIdentity({ ...evidence, requestId }, client), knownProductId, evidence.barcode);
    if (published && pendingResolutionRef.current?.requestId === requestId) pendingResolutionRef.current = null;
  };

  const handleCaptureReady = (handoff: CheckCaptureHandoff) => {
    lastTypedNameRef.current = null;
    const keepCamera = targetShell && (Boolean(handoff.barcodeLookup) || Boolean(handoff.resolvedCase?.truthSnapshot));
    if (keepCamera) {
      setCameraAwaitingResult(true);
      setCameraScanId(createCatalogRequestId());
    } else {
      setCameraAwaitingResult(false);
      setCaptureRole(null);
    }
    if (handoff.barcodeLookup) {
      if (integrated && currentLiveCheckOwner()) checkFlowRef.current?.begin('barcode');
      setCaptureEvidence(null);
      void openResolution({ consumer: 'scan', barcode: handoff.barcodeLookup.barcode });
      return;
    }
    if (integrated && currentLiveCheckOwner() && handoff.localPhotos.length > 0) checkFlowRef.current?.begin('photo');
    setCaptureEvidence(handoff);
    if (integrated && handoff.resolvedCase) {
      const resolvedCase = handoff.resolvedCase;
      beginResult({ kind: 'camera', sessionId: cameraScanId || createCatalogRequestId() }, createCatalogRequestId());
      void showResolution(async () => resolvedCase);
    } else if (handoff.localPhotos.length > 0) {
      setCatalogDetail(null);
      setResolution(null);
      setCandidates([]);
      setConfirmedProduct(null);
      setScanResult(null);
      setEvaluationError(null);
    }
  };

  useEffect(() => {
    if (!cameraResultNeedsExistingPage({
      awaiting: cameraAwaitingResult, checking: isCheckingProduct, ownerId: liveCheckOwner,
      scanId: cameraScanId, error: evaluationError, resolution, catalogProduct: catalogDetail,
    })) return;
    setCameraAwaitingResult(false);
    setDetectionPaused(false);
    setCaptureRole(null);
  }, [cameraAwaitingResult, isCheckingProduct, liveCheckOwner, cameraScanId, evaluationError, resolution, catalogDetail]);

  const handleBarcodeScanned = (scanningResult: BarcodeScanningResult) => {
    if (isScanningLockedRef.current) return;
    isScanningLockedRef.current = true;
    setIsLocked(true);
    void openResolution({ consumer: 'scan', barcode: scanningResult.data });
  };

  const handleSelectSearchResult = (item: CatalogProductSummary, origin?: CheckResultOrigin) => {
    const selectedOrigin = origin ?? { kind: 'search' as const, query: searchQuery, scrollOffset: entryScrollOffset.current, selectedProductId: item.productId };
    if (targetShell && captureRole) setCaptureRole(null);
    void Haptics.selectionAsync().catch(() => {});
    if (preview) {
      const detail = getPreviewCatalogDetail(item.productId);
      if (!detail) return;
      beginResult(selectedOrigin, createCatalogRequestId());
      setCatalogDetail(detail);
      setLinkIntake(null);
      resolutionOwnerRef.current = null;
      setResolution(null);
      setScanResult(null);
      setUnknownBarcode(null);
      setEvaluationError(null);
      return;
    }
    if (integrated && currentLiveCheckOwner()) checkFlowRef.current?.begin('search');
    void openResolution({ consumer: 'scan', brand: item.brand, productName: item.name }, item.productId, selectedOrigin);
  };

  const handleSelectCandidate = (candidate: ProductResolutionCandidate) => {
    if (!candidate.brand || !candidate.name) return;
    if (integrated && currentLiveCheckOwner()) checkFlowRef.current?.begin('search');
    void openResolution({
      consumer: 'scan', brand: candidate.brand, productName: candidate.name,
      variantName: candidate.variantName,
    }, candidate.productId, resultOriginRef.current ?? undefined);
  };

  const handleManualNameCheck = () => {
    const name = searchQuery.trim();
    if (name.length < 2) return;
    if (integrated && currentLiveCheckOwner()) checkFlowRef.current?.begin('search');
    void openResolution({ consumer: 'scan', productName: name }, undefined, { kind: 'search', query: searchQuery, scrollOffset: entryScrollOffset.current, selectedProductId: null });
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

  const checkProductLink = () => {
    const trimmed = productLink.trim();
    let url: URL;
    try { url = new URL(trimmed); } catch { setLinkNote('Enter a full https link.'); return; }
    if (url.protocol !== 'https:') { setLinkNote('Use an https link.'); return; }
    if (!integrated) { setLinkNote('Product-link lookup is unavailable in this preview. Search by name.'); return; }
    const owner = currentLiveCheckOwner();
    if (!owner) { setLinkNote('Preparing product lookup for this account.'); return; }
    if (pendingLinkRef.current?.url !== trimmed) pendingLinkRef.current = { url: trimmed, requestId: createCatalogRequestId() };
    const requestId = pendingLinkRef.current.requestId;
    setLinkNote(null);
    lastResolutionRequestRef.current = null;
    beginResult({ kind: 'link', value: productLink, scrollOffset: entryScrollOffset.current }, requestId);
    const operation = resultOperationRef.current!;
    void showResolution(async client => {
      const intake = await resolveProductLink({ requestId, url: trimmed }, client);
      if (!resultLifecycle.current.canPublish(operation, currentLiveCheckOwner())) return null;
      if (intake.status === 'resolution') return intake.resolution;
      if (pendingLinkRef.current?.requestId === requestId) pendingLinkRef.current = null;
      setLinkIntake(intake);
      return null;
    }).then(published => {
      if (published && pendingLinkRef.current?.requestId === requestId) pendingLinkRef.current = null;
    });
  };

  const handleResetScan = () => {
    void Haptics.selectionAsync().catch(() => {});
    checkFlowRef.current?.abandon();
    invalidateResult();
    setContextualResultOpen(false);
    setFullResult(false);
    setLinkIntake(null);
    resolutionOwnerRef.current = null;
    setConfirmedProduct(null);
    setCatalogDetail(null);
    setResolution(null);
    setCandidates([]);
    setIsCheckingProduct(false);
    pendingResolutionRef.current = null;
    lastTypedNameRef.current = null;
    setScanResult(null);
    setUnknownBarcode(null);
    setCaptureRole(null);
    setCaptureEvidence(null);
    setEvaluationError(null);
    setSearchQuery('');
    setIsSearching(!targetShell);
    setTimeout(() => {
      isScanningLockedRef.current = false;
      setIsLocked(false);
    }, 1000);
  };

  const dismissCameraResult = () => {
    invalidateResult();
    setFullResult(false);
    setCameraAwaitingResult(false);
    setDetectionPaused(false);
    setResolution(null);
    setEvaluationError(null);
    setCatalogDetail(null);
    setUnknownBarcode(null);
    setCaptureEvidence(null);
    setCandidates([]);
    setConfirmedProduct(null);
    setCameraSessionKey(value => value + 1);
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
  const identityNextAction = resolution ? selectIdentityNextAction(resolution.state, resolution.nextAction) : null;
  const trustedSnapshotIdentity = personalTarget
    ? projectTrustedSnapshot({ snapshot: personalTarget }).identity.state === 'known' : false;
  const personalDecisionShown = Boolean(personalTarget && visibleDecision
    && customerState.ownerId === liveCheckOwner && customerState.status === 'ready'
    && describePersonalDecision(visibleDecision.packet, visibleDecision.expectedBinding).kind === 'ready');
  const ownerBlocked = (integrated && liveCheckOwner && (catalogDetail || resolution)
    && customerState.ownerId !== liveCheckOwner) || shouldHideCheckForOwner({
    integrated, previousOwner: previousCheckOwnerRef.current, sessionUserId,
    liveOwner: liveCheckOwner, resultOwner: resolutionOwnerRef.current,
    hasResult: Boolean(catalogDetail || resolution),
  });
  const snapshotMatchesResolution = Boolean(personalTarget && resolution?.truthSnapshot
    && personalTarget.snapshotId === resolution.truthSnapshot.snapshotId
    && personalTarget.resolutionCaseId === resolution.caseId);
  const visibleCheckView = selectVisibleCheckView({
    integrated, focused: isCheckFocused, ownerReady: Boolean(liveCheckOwner), ownerBlocked: Boolean(ownerBlocked),
    captureOpen: Boolean(captureRole), checking: isCheckingProduct,
    errorShown: invalidResult || Boolean(evaluationError && !scanResult),
    unknownShown: Boolean(unknownBarcode),
    catalogDetailVisible: Boolean(catalogDetail), snapshotVisible: Boolean(personalTarget),
    resolutionState: resolution?.state ?? null,
    catalogIdentityMatched: Boolean(catalogDetail && resolution?.product?.productId === catalogDetail.productId),
    snapshotIdentityKnown: trustedSnapshotIdentity, snapshotMatchesResolution,
    catalogFormulaFactsShown: Boolean(fullResult && !personalTarget && currentFormula),
    snapshotFormulaFactsShown: Boolean(fullResult && personalTarget && hasVerifiedPackageFormula(personalTarget)),
    identityNextActionCopyAvailable: Boolean(catalogDetail && identityNextAction),
    readyDecisionPanelShown: personalDecisionShown,
    decisionMatchesResolution: Boolean(visibleDecision && personalTarget && snapshotMatchesResolution
      && visibleDecision.expectedBinding.ownerId === liveCheckOwner
      && visibleDecision.expectedBinding.productSnapshotId === personalTarget.snapshotId),
    unresolvedPhotoVisible: Boolean(captureEvidence?.localPhotos.length && !captureEvidence.resolvedCase),
  });
  useEffect(() => {
    if (!visibleCheckView) return;
    checkFlowRef.current?.completeVisible(visibleCheckView);
    checkFlowRef.current?.observePersonalDecision(visibleCheckView);
  }, [visibleCheckView]);

  const catalogFacts = catalogDetail ? {
    brand: catalogDetail.brand, name: catalogDetail.name, categoryLabel: catalogDetail.category.replaceAll('_', ' '),
    formula: currentFormula, source: catalogDetail.sourceReference ?? null,
  } : undefined;
  const sharedResultInput = personalTarget || catalogDetail ? selectCheckContentInput({
    ownerId: liveCheckOwner, snapshot: personalTarget, catalogFacts,
    customerState, preview, legacyState: personalFitState,
  }) : null;
  const resultNextStep = visibleDecision && (visibleDecision.packet.action.nextStep !== 'add_context'
    || contextEditorDestination(visibleDecision.packet)) ? handleDecisionStep : undefined;
  const resultKey = personalTarget?.snapshotId ?? catalogDetail?.productId ?? String(resultOperation?.generation ?? 'pending');
  const recoveryReason = unknownBarcode ? 'unknown_barcode'
    : resolution && (resolution.state === 'insufficient_evidence' || resolution.state === 'formula_only') ? 'unresolved_check'
      : captureEvidence?.localPhotos.length && !captureEvidence.resolvedCase ? 'unresolved_photo' : null;
  const contextualRecovery = selectCheckContributionRecovery({ targetShell, ownerId: liveCheckOwner,
    caseId: resolution?.caseId ?? null, reason: recoveryReason, observedBarcode: unknownBarcode,
    observedName: lastTypedNameRef.current });
  const linkNotice = linkIntake ? describeCheckLinkNotice(linkIntake) : null;
  const renderResultExtras = () => <>
    {linkNotice && <View style={styles.cameraFrameContainer}>
      <Text accessibilityRole="header" style={styles.entryTitle}>{linkNotice.title}</Text>
      <Text style={styles.entryBody}>{linkNotice.detail}</Text>
      {linkNotice.source && <Pressable accessibilityRole="link" accessibilityLabel="View product link source" style={styles.sourceLink}
        onPress={() => void Linking.openURL(linkNotice.source!).catch(() => {})}><Text style={styles.sourceLinkText}>View source</Text></Pressable>}
      <Button label="Search by name" variant="outline" onPress={handleSearchNamePress} />
      <Button label="Open camera" variant="outline" onPress={() => openCapture('barcode')} />
    </View>}
    {!sharedResultInput && !isCheckingProduct && !evaluationError && (unknownBarcode || resolution || captureEvidence) &&
      <Text style={styles.entryBody}>{unknownBarcode ? 'No verified barcode match.'
        : captureEvidence?.localPhotos.length ? 'We could not identify this product from the photos yet. Personal Fit cannot be assessed from this evidence.'
          : 'Product identity is not confirmed. Personal Fit cannot be assessed from this evidence.'}</Text>}
    {identityNextAction && !visibleDecision && <Text style={styles.entryBody}>{identityNextAction}</Text>}
    {candidates.map((candidate, index) => <Pressable key={`${candidate.productId ?? 'unknown'}-${candidate.variantId ?? index}`}
      style={styles.catalogItemRow} accessibilityRole="button"
      accessibilityLabel={`Check ${candidate.brand ?? ''} ${candidate.name ?? 'possible product'}`}
      disabled={!candidate.brand || !candidate.name} onPress={() => handleSelectCandidate(candidate)}>
      <Text style={styles.catalogItemName}>{candidate.brand} {candidate.name}{candidate.variantName ? ` · ${candidate.variantName}` : ''}</Text>
    </Pressable>)}
    {nextStepMessage?.snapshotId === personalTarget?.snapshotId
      && nextStepMessage?.contextRevision === customerState.context?.revision
      && <Text accessibilityLiveRegion="polite" style={styles.entryBody}>{nextStepMessage?.text}</Text>}
    {renderSaveCheckAction(resolution?.caseId)}
    {evaluationError && resultOriginRef.current?.kind === 'link' && <Button label="Try checking link again" variant="outline" onPress={checkProductLink} />}
    {evaluationError && lastResolutionRequestRef.current && <Button label="Try checking again" variant="outline" onPress={() => {
      const last = lastResolutionRequestRef.current;
      if (last) void openResolution(last.evidence, last.knownProductId, last.origin);
    }} />}
    {contextualRecovery && <MissingProductContribution contextKey={contextualRecovery.contextKey}
      availability={contextualRecovery.availability} initial={contextualRecovery.initial} embedded
      onTryAnotherWayLabel="Search by name" onTryAnotherWay={handleSearchNamePress} />}
    {contextualRecovery && <Button label={captureEvidence?.localPhotos.length ? 'Take another photo' : 'Open camera'} variant="outline"
      onPress={() => openCapture(captureEvidence?.localPhotos[0]?.role ?? 'barcode')} />}
  </>;


  if (ownerBlocked) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, paddingHorizontal: spacing.lg }]}>
        <RootShellHeader title="Check" />
        <Text style={styles.entryBody}>Preparing Check for this account…</Text>
      </View>
    );
  }

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

  if (targetShell && captureRole) {
    const companion = cameraCompanionSheet({
      awaiting: cameraAwaitingResult, checking: isCheckingProduct, ownerId: liveCheckOwner,
      scanId: cameraScanId, error: evaluationError, resolution, catalogProduct: catalogDetail,
    });
    return (
      <View style={styles.container}>
        <CheckCaptureHost
          key={`${captureRole}:${cameraSessionKey}`}
          initialRole={captureRole}
          live={integrated}
          catalogSearch={preview ? searchPreviewCatalog : undefined}
          onCatalogSelect={handleSelectSearchResult}
          detectionPaused={detectionPaused || fullResult}
          onCaptureReady={handleCaptureReady}
          onClose={() => {
            invalidateResult();
            setFullResult(false);
            setCameraAwaitingResult(false);
            setDetectionPaused(false);
            setCatalogDetail(null);
            setResolution(null);
            setCandidates([]);
            setConfirmedProduct(null);
            setScanResult(null);
            setUnknownBarcode(null);
            setEvaluationError(null);
            setCaptureEvidence(null);
            setCaptureRole(null);
          }}
          companion={companion && (fullResult && sharedResultInput
            ? <CheckResultPresentation visible={isCheckFocused && !editingContext} inline full input={sharedResultInput} presentationKey={resultKey}
                onFullChange={setFullResult} onClose={dismissCameraResult} onNextStep={resultNextStep} onOpenSource={(url) => void Linking.openURL(url).catch(() => {})}>
                {renderResultExtras()}
              </CheckResultPresentation>
            : <ScanResultSheet
              model={companion}
              currentOwnerId={liveCheckOwner}
              currentSnapshot={resolution?.truthSnapshot ?? null}
              currentResolverResult={resolution}
              currentScanId={cameraScanId}
              contentInput={sharedResultInput ?? undefined}
              onNextStep={resultNextStep}
              onOpenSource={(url) => void Linking.openURL(url).catch(() => {})}
              onDetectionPausedChange={setDetectionPaused}
              onDismiss={dismissCameraResult}
              onOpenDetails={() => setFullResult(true)}
            />
          )}
        />
      </View>
    );
  }

  if (targetShell) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <RootShellHeader title="Check" />
        <ScrollView ref={entryScroll} onScroll={(event) => { entryScrollOffset.current = event.nativeEvent.contentOffset.y; }} scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={[styles.entryContent, { paddingTop: spacing.sm, paddingBottom: insets.bottom + spacing.xl }]}>
          <Button label="Open camera" variant="brand" onPress={() => openCapture('barcode')} style={styles.entryAction} />
          <View style={styles.entrySearch}>
            <CatalogProductSearch
              key={integrated ? liveCheckOwner ?? 'signed-out' : 'preview'}
              label="Search by name"
              actionLabel="Check"
              search={preview ? searchPreviewCatalog : undefined}
              onSelect={handleSelectSearchResult}
              keepFocusAfterSelect={false}
              preserveSelection
              focusKey={searchFocusKey}
              onQueryChange={setSearchQuery}
              errorCopy="Search is unavailable right now."
              emptyCopy="No product match yet."
            />
            {integrated && searchQuery.trim().length >= 2 && <Button label="Check name as entered" variant="ghost" onPress={handleManualNameCheck} />}
          </View>
          <View style={styles.linkCard}>
            <Text style={styles.linkLabel}>Search by product link</Text>
            <View style={styles.linkRow}>
              <TextInput
                ref={linkInput}
                value={productLink}
                onChangeText={(value) => { setProductLink(value); setLinkNote(null); }}
                placeholder="https://"
                placeholderTextColor={colors.inkSubtle}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                returnKeyType="search"
                onSubmitEditing={checkProductLink}
                accessibilityLabel="Product link"
                style={styles.linkField}
              />
              <Pressable accessibilityRole="button" accessibilityLabel="Check link" onPress={checkProductLink} style={styles.linkCheck}>
                <Text style={styles.linkCheckText}>Check</Text>
              </Pressable>
            </View>
            {linkNote && <Text style={styles.linkNote}>{linkNote}</Text>}
          </View>
        </ScrollView>
        <CheckResultPresentation visible={isCheckFocused && !editingContext && (contextualResultOpen || Boolean(catalogDetail || resolution || unknownBarcode || captureEvidence || isCheckingProduct || evaluationError))}
          input={sharedResultInput} presentationKey={resultKey} loading={isCheckingProduct} error={evaluationError}
          dismissLabel={resultOriginRef.current?.kind === 'camera' ? 'Back to Check' : 'Close result'}
          full={fullResult} onFullChange={setFullResult} onClose={closeContextualResult}
          onNextStep={resultNextStep} onOpenSource={(url) => void Linking.openURL(url).catch(() => {})}>
          {renderResultExtras()}
        </CheckResultPresentation>
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
        <ScrollView ref={resultScroll} contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 120 }]}>
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
          {renderSaveCheckAction(resolution?.caseId)}
          <Button label="Check another product" variant="outline" size="medium" onPress={handleResetScan} />
        </ScrollView>
      </View>
    );
  }


  if (resolution && !catalogDetail) {
    const fit = describeCheckProductFit(resolution.state);
    const identityMessage = resolution.state === 'insufficient_evidence' && captureEvidence?.localPhotos.length
      ? 'We could not identify this product from the photos yet.'
      : 'Product identity is not confirmed.';
    const selectedCandidate = resolution.candidates.find((_, index) =>
      `${resolution.caseId}:${index}` === captureEvidence?.review.selectedCandidateId);
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {targetShell && <RootShellHeader title="Check" />}
        <ScrollView contentContainerStyle={[styles.entryContent, { paddingBottom: insets.bottom + spacing.xl }]}>
        {!targetShell && <Text style={styles.screenTitle}>Check a Product</Text>}
        <Text style={{ color: colors.inkMuted, marginVertical: spacing.md }}>{integrated
          ? `${identityMessage} Personal Fit cannot be assessed from this evidence.`
          : fit.message}</Text>
        {selectedCandidate?.brand && selectedCandidate.name && <Text style={{ color: colors.inkMuted, marginBottom: spacing.md }}>You selected {selectedCandidate.brand} {selectedCandidate.name} as a possible match. Product and formula details still need confirmation.</Text>}
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
        {renderSaveCheckAction(resolution.caseId)}
        <Button label="Check another product" variant="secondary" size="medium" onPress={handleResetScan} />
        </ScrollView>
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


  if (isSearching) {
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
          <Button label={targetShell ? 'Open camera' : 'Use barcode camera'} variant="outline" size="medium" onPress={() => { if (targetShell) openCapture('barcode'); else { setIsSearching(false); handleRetryScan(); } }} style={{ marginTop: spacing.lg }} />
        </ScrollView>
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

  // Legacy member Scan keeps its established barcode viewfinder.
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.scannerHeader}>
        <View style={styles.headerTopRow}>
          <Text style={styles.screenTitle}>Check a Product</Text>
          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => router.push('/profile')}
            hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
            accessibilityLabel="Account and Settings"
            accessibilityRole="button"
          >
            <Icon name="person" size={18} color={colors.inkMuted} />
          </TouchableOpacity>
        </View>
        <Text style={styles.subtitle}>Align a barcode within the guide, or search by name instead.</Text>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.cameraFrameContainer}>
          {/* Live Barcode Camera Viewport */}
          <View style={styles.cameraViewport}>
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
          </View>

          {/* Name Search Fallback Button */}
          <TouchableOpacity
            style={styles.manualSearchLink}
            onPress={handleSearchNamePress}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Search beta products by name"
          >
            <Icon name="search" size={16} color={colors.brand} />
            <Text style={styles.manualSearchText}>Can't scan barcode? Search by name</Text>
          </TouchableOpacity>

          {/* Quick Shortcuts for Instant Testing (Dev only) */}
          {__DEV__ && (
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
              {`We couldn't find a formula match for barcode ${unknownBarcode} in our beta catalog yet.`}
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
  saveCheckAction: { marginBottom: spacing.md },
  saveCheckMessage: { color: colors.inkMuted, marginTop: spacing.xs },
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
  resultSectionSpacing: { marginBottom: spacing.lg },
  entryContent: {
    paddingHorizontal: layout.gutter,
    paddingTop: spacing.xxl,
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
  entrySearch: { marginTop: spacing.xl },
  linkCard: { marginTop: spacing.lg, borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, backgroundColor: colors.surface, padding: spacing.md, gap: spacing.xs },
  linkLabel: { color: colors.ink, fontSize: typography.sizes.bodyRegular, fontWeight: typography.weights.semibold },
  linkField: { flex: 1, minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, paddingHorizontal: spacing.md, color: colors.ink, backgroundColor: colors.canvas },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  linkCheck: { minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.xs },
  linkCheckText: { color: colors.brand, fontSize: typography.sizes.caption, fontWeight: typography.weights.bold },
  linkNote: { color: colors.inkMuted, fontSize: typography.sizes.caption, lineHeight: typography.lineHeights.caption },
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
