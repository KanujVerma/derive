/**
 * Derive Client Service Coordinator & UI Hooks
 *
 * Provides the unified client-side application layer between mobile UI screens
 * and the IDeriveService boundary (MockDeriveService or RemoteDeriveService).
 *
 * Responsibilities:
 * - Directs all customer domain operations through getDeriveService().
 * - Manages asynchronous execution, loading states, and error handling.
 * - Updates local Zustand store projections with canonical service results.
 * - Guarantees UI screens do not care whether Mock or Remote is active.
 * - Supports dependency injection in automated tests via setDeriveService().
 */

import { useState, useCallback } from 'react';
import { getDeriveService, isRemoteServiceEnabled } from './DeriveService.ts';
export { getDeriveService, isRemoteServiceEnabled };
export const isRemoteMode = isRemoteServiceEnabled;
import type { IDeriveService } from '../contracts/DeriveService.ts';
import type {
  OnboardingPayload,
  OnboardingResult,
  AskResponse,
  ProductScanResult,
  ScanProductInput,
  CheckInInput,
  CheckInResult,
  RefillRequest,
  ProgressData,
  ResearchInsight,
  CustomerProfile,
  CustomerBootstrapState,
  RoutinePlan,
  UserProduct,
  RoutineProposalResult,
  SkinState,
  IrritationLevel,
  AdherenceLevel,
} from '../domain/types.ts';
import { useRoutineStore } from '../stores/routineStore.ts';
import { useUserStore } from '../stores/userStore.ts';
import { useOnboardingStore, type OnboardingState } from '../stores/onboardingStore.ts';
import { useBootstrapStore } from '../stores/bootstrapStore.ts';
import { useAuthStore } from '../stores/authStore.ts';
import { getCustomerErrorMessage } from '../utils/customerErrors.ts';

/**
 * Direct service accessor for programmatic operations
 */
export function getClientService(): IDeriveService {
  return getDeriveService();
}

/**
 * Resolves and validates active or explicitly provided user ID for client operations.
 *
 * In Remote mode, operations fail closed if no usable non-mock customer identity is available,
 * rejecting missing, empty, whitespace-only, or known mock IDs ('usr_beta_member', 'usr_beta_001').
 * In Mock mode, falls back to 'usr_beta_member' for deterministic local development.
 *
 * NOTE: This is a client-side identity presence check to prevent mock data leakage, NOT proof of
 * an authenticated session or valid Supabase JWT (which is enforced server-side via RLS in S1/I1).
 */
export function resolveUserId(userId?: string, overrideRemote?: boolean): string {
  const rawId = userId !== undefined ? userId : useUserStore.getState().userId;
  const trimmed = typeof rawId === 'string' ? rawId.trim() : '';
  const isRemote = overrideRemote !== undefined ? overrideRemote : isRemoteServiceEnabled();

  if (isRemote) {
    if (!trimmed || trimmed === 'usr_beta_member' || trimmed === 'usr_beta_001') {
      throw new Error('Valid member identity required: Remote operations require a non-mock customer identity.');
    }
    return trimmed;
  }

  return trimmed || 'usr_beta_member';
}

/**
 * Current user ID accessor with fallback for local mock session,
 * failing closed in remote mode if no usable non-mock customer identity is available.
 */
export function getActiveUserId(): string {
  return resolveUserId();
}

/**
 * Pure builder function to construct canonical OnboardingPayload from onboarding state snapshot.
 * Guarantees provenance of safety context (sensitivitiesStatus, pregnancyStatus) and enforces
 * non-mock identity check in Remote mode.
 */
export function buildOnboardingPayload(
  onboardingState: Partial<OnboardingState>,
  userId?: string,
  overrideRemote?: boolean
): OnboardingPayload {
  const resolvedUserId = resolveUserId(userId, overrideRemote);

  return {
    userId: resolvedUserId,
    primaryGoal: onboardingState.primaryGoal || 'breakouts',
    secondaryGoals: onboardingState.secondaryGoals || [],
    routineComplexity: onboardingState.routineComplexity || 'simple',
    costPreference: onboardingState.costPreference || 'balanced',
    middayFeel: onboardingState.middayFeel || 'combination',
    postCleanseTightness: onboardingState.postCleanseTightness ?? false,
    confirmedProducts: onboardingState.detectedProducts || [],
    productReactions: onboardingState.productReactions || [],
    formulaSnapshots: onboardingState.formulaSnapshots || [],
    adaptiveFollowUps: onboardingState.adaptiveFollowUps || [],
    pihTendencyAnswer: onboardingState.pihTendencyAnswer ?? null,
    hasBadReactions: onboardingState.hasBadReactions ?? null,
    skinPhotos: {
      frontUri: onboardingState.frontPhotoUri || undefined,
      leftUri: onboardingState.leftPhotoUri || undefined,
      rightUri: onboardingState.rightPhotoUri || undefined,
      shelfUri: onboardingState.shelfPhotoUri || undefined,
      contextNote: onboardingState.photoContextNote || undefined,
    },
    safetyContext: {
      knownSensitivities: onboardingState.knownSensitivities || [],
      sensitivitiesStatus: onboardingState.sensitivitiesStatus || 'unanswered',
      activePrescriptions: onboardingState.activePrescriptions || [],
      isPregnantOrNursing: onboardingState.isPregnantOrNursing ?? false,
      pregnancyStatus: onboardingState.pregnancyStatus || 'unanswered',
      additionalNotes: onboardingState.additionalSafetyNotes || undefined,
    },
  };
}

// ==========================================
// 1. COORDINATOR FUNCTIONS
// ==========================================

export async function submitOnboarding(payload: OnboardingPayload): Promise<OnboardingResult> {
  const service = getDeriveService();
  const result = await service.onboard(payload);

  const isAwaitingReview = Boolean(
    result.proposedRoutine &&
    (result.initialRoutineState === 'awaiting_review' || result.proposedRoutine.status === 'awaiting_review')
  );

  const isPendingGeneration =
    result.initialRoutineState === 'pending_generation' || (!result.proposedRoutine && !isAwaitingReview);

  // Synchronize canonical proposed routine into routine store
  useRoutineStore.setState({
    routine: result.proposedRoutine || null,
    userProducts: result.userProducts || [],
    completedStepIdsToday: [],
    checkIns: [],
    refillRequests: [],
    learnedInsights: [],
    researchInsights: [],
    isPlanUnderReview: isAwaitingReview,
    isRoutineBeingPrepared: isPendingGeneration,
    planHydrationStatus: 'ready',
    planHydrationError: null,
    todayDominantStatus: isPendingGeneration
      ? 'Your routine is being prepared.'
      : isAwaitingReview
      ? 'Final review: Your first routine gets one final quality check before it goes live.'
      : 'Everything looks on track. No changes today.',
    isWeeklyCheckInDue: false,
  });

  // Synchronize user store profile without overriding remote membership status
  if (result.userId) {
    useUserStore.setState((state) => ({
      userId: result.userId,
      membershipStatus: isRemoteMode() ? state.membershipStatus : 'active',
    }));
  }

  // Mark local onboarding flow complete
  useOnboardingStore.getState().completeOnboarding();

  return result;
}

export async function askQuestion(
  question: string,
  activeContext?: {
    scannedProduct?: ProductScanResult;
    currentStepId?: string;
    photoAttachmentUri?: string;
  }
): Promise<AskResponse> {
  const service = getDeriveService();
  const userId = getActiveUserId();

  return service.askDerive({
    userId,
    question,
    activeContext,
  });
}

export async function evaluateProduct(
  input: ScanProductInput
): Promise<ProductScanResult> {
  const service = getDeriveService();
  return service.scanProduct(input);
}

export async function submitWeeklyCheckIn(
  input: Omit<CheckInInput, 'userId'>
): Promise<CheckInResult> {
  const service = getDeriveService();
  const userId = getActiveUserId();
  const primaryGoal = useOnboardingStore.getState().primaryGoal || 'breakouts';

  const result = await service.submitCheckIn({
    ...input,
    userId,
    primaryGoal: input.primaryGoal || primaryGoal,
  });

  // Project newly created check-in into store cache
  const state = useRoutineStore.getState();
  useRoutineStore.setState({
    checkIns: [result.checkIn, ...state.checkIns],
    isWeeklyCheckInDue: false,
    todayDominantStatus: result.aiAnalysisSentence || 'Check-in recorded.',
  });

  return result;
}

export async function requestProductRefill(input: {
  productId: string;
  productName: string;
  brand: string;
  note?: string;
}): Promise<RefillRequest> {
  const service = getDeriveService();
  const userId = getActiveUserId();

  const refill = await service.requestRefill({
    ...input,
    userId,
  });

  const state = useRoutineStore.getState();
  useRoutineStore.setState({
    refillRequests: [refill, ...state.refillRequests],
  });

  return refill;
}

export async function hydrateOrders(userId?: string): Promise<RefillRequest[]> {
  const service = getDeriveService();
  const id = resolveUserId(userId);
  const orders = await service.getOrders(id);

  useRoutineStore.setState({ refillRequests: orders });
  return orders;
}

export async function hydrateProgress(userId?: string): Promise<ProgressData> {
  const service = getDeriveService();
  const id = resolveUserId(userId);
  const progress = await service.getProgress(id);

  useRoutineStore.setState({
    checkIns: progress.checkIns,
    learnedInsights: progress.learnedInsights,
    isWeeklyCheckInDue: progress.isCheckInDue,
  });

  return progress;
}

/**
 * @deprecated Compatibility wrapper over hydratePlanState.
 *
 * Routine and UserProduct state must always be hydrated atomically.
 * Do not call this to perform independent routine-only reads; use hydratePlanState() directly.
 * Kept for backward compatibility with existing non-critical call sites.
 */
export async function hydrateRoutine(userId?: string): Promise<RoutinePlan | null> {
  const result = await hydratePlanState(userId);
  return result?.routine ?? null;
}


const inFlightHydrations = new Map<
  string,
  Promise<{
    routine: RoutinePlan | null;
    userProducts: UserProduct[];
    isRoutineBeingPrepared: boolean;
  } | null>
>();
const inFlightHydrationTokens = new Map<string, object>();

const inFlightProposals = new Map<string, Promise<RoutineProposalResult | null>>();
const inFlightProposalTokens = new Map<string, object>();

export function clearInFlightHydrations(): void {
  inFlightHydrations.clear();
  inFlightHydrationTokens.clear();
}

export function clearInFlightProposals(): void {
  inFlightProposals.clear();
  inFlightProposalTokens.clear();
}

/**
 * Hydrates canonical plan state (Routine + UserProducts) from the service boundary.
 *
 * Enforces:
 * - Concurrent in-flight request deduplication per user.
 * - Identity freshness check against active session in Remote mode.
 * - Monotonic attempt checking to prevent stale commit races.
 * - Derivation of isRoutineBeingPrepared when onboarding is completed and routine is null.
 */
export function hydratePlanState(userId?: string): Promise<{
  routine: RoutinePlan | null;
  userProducts: UserProduct[];
  isRoutineBeingPrepared: boolean;
} | null> {
  const service = getDeriveService();
  const id = resolveUserId(userId);

  const inFlight = inFlightHydrations.get(id);
  if (inFlight) {
    return inFlight;
  }

  const requestToken = {};
  const hydrationPromise = (async () => {
    const attempt = useRoutineStore.getState().startPlanHydration();
    try {
      const [routine, userProducts] = await Promise.all([
        service.getRoutine(id),
        service.getUserProducts(id),
      ]);

      // Freshness check: in Remote mode, ensure active identity still matches
      if (isRemoteServiceEnabled()) {
        const activeSessionUser = useAuthStore.getState().sessionUserId;
        if (!activeSessionUser || activeSessionUser !== id) {
          return null;
        }
      }

      const currentAttempt = useRoutineStore.getState().planHydrationAttempt;
      if (attempt !== currentAttempt) {
        return null;
      }

      const bootstrap = useBootstrapStore.getState();
      const isRemote = isRemoteServiceEnabled();
      const isOnboarded = isRemote
        ? bootstrap.status === 'READY' && bootstrap.bootstrapState?.onboardingCompleted === true
        : useOnboardingStore.getState().isCompleted;

      const isBeingPrepared = routine === null && Boolean(isOnboarded);

      const committed = useRoutineStore.getState().setPlanHydrated(
        routine,
        userProducts,
        isBeingPrepared,
        attempt
      );

      if (!committed) return null;

      return { routine, userProducts, isRoutineBeingPrepared: isBeingPrepared };
    } catch (err: any) {
      console.warn('hydratePlanState error:', err);
      const currentAttempt = useRoutineStore.getState().planHydrationAttempt;
      if (attempt === currentAttempt) {
        const commitError = (preserveBeingPrepared: boolean) => {
          useRoutineStore.getState().setPlanHydrationError(
            getCustomerErrorMessage('routine'),
            attempt
          );
          // B3.1 Defect A: If member is canonically onboarded but we got a transient read error,
          // preserve pending-generation semantics so Today/Plan show calm preparation + retry
          // rather than un-onboarded "Start Routine Setup" empty-state.
          if (preserveBeingPrepared) {
            useRoutineStore.setState({
              routine: null,
              isRoutineBeingPrepared: true,
              isPlanUnderReview: false,
            });
          }
        };

        if (isRemoteServiceEnabled()) {
          const activeSessionUser = useAuthStore.getState().sessionUserId;
          if (activeSessionUser && activeSessionUser === id) {
            // Check if member is onboarded — do NOT generate a proposal; just preserve truth
            const bootstrap = useBootstrapStore.getState();
            const isOnboarded =
              bootstrap.status === 'READY' &&
              bootstrap.bootstrapState?.onboardingCompleted === true;
            commitError(Boolean(isOnboarded));
          }
        } else {
          const isOnboarded = useOnboardingStore.getState().isCompleted;
          commitError(Boolean(isOnboarded));
        }
      }
      return null;
    } finally {
      // B3.1 Defect B: only clear this user's in-flight slot if THIS request still owns it.
      // Logout → re-login of the same user may store a newer request under the same key.
      if (inFlightHydrationTokens.get(id) === requestToken) {
        inFlightHydrationTokens.delete(id);
        inFlightHydrations.delete(id);
      }
    }
  })();

  inFlightHydrations.set(id, hydrationPromise);
  inFlightHydrationTokens.set(id, requestToken);
  return hydrationPromise;


}

/**
 * Ensures initial routine proposal is generated and loaded for onboarded members.
 *
 * Guarantees:
 * - If a routine is already loaded or available from server hydration, returns early without calling proposeRoutine.
 * - Deduplicates concurrent proposal calls across screens (Today & Plan mounting simultaneously).
 * - Identifies pending_generation state and transitions to draft awaiting_review upon completion.
 * - In case of generation failure, sets customer-facing error while preserving pending state for retry.
 * - If canonical plan hydration itself fails (transient error), does NOT call proposeRoutine — the member
 *   must retry hydration first before a proposal is attempted, preventing model invocation on read failures.
 */
export async function ensureInitialRoutineProposal(
  userId?: string
): Promise<RoutineProposalResult | null> {
  const id = resolveUserId(userId);

  const store = useRoutineStore.getState();
  if (store.routine !== null) {
    return null;
  }

  const existingProposal = inFlightProposals.get(id);
  if (existingProposal) {
    return existingProposal;
  }

  // If not currently marked as being prepared, or if a prior attempt errored,
  // hydrate first to inspect canonical server state.
  // On retry: isRoutineBeingPrepared may already be true (Defect A preservation) but
  // planHydrationStatus is 'error', so re-run hydration rather than skipping it.
  const needsHydration = !store.isRoutineBeingPrepared || store.planHydrationStatus === 'error';
  if (needsHydration) {
    await hydratePlanState(id);
  }

  const stateAfterHydration = useRoutineStore.getState();
  if (stateAfterHydration.routine !== null) {
    return null;
  }

  if (!stateAfterHydration.isRoutineBeingPrepared) {
    return null;
  }

  // B3.1 Defect A: If canonical plan hydration itself failed (transient network/backend error),
  // do NOT treat the failure as evidence that no routine exists and do NOT call proposeRoutine.
  // The retry sequence is: retry hydration → if routine null + isOnboarded → then proposal.
  // This prevents triggering a model/provider because a read endpoint temporarily failed.
  if (stateAfterHydration.planHydrationStatus === 'error') {
    return null;
  }

  const existingAfterHydration = inFlightProposals.get(id);
  if (existingAfterHydration) {
    return existingAfterHydration;
  }

  const requestToken = {};
  const proposalPromise = (async (): Promise<RoutineProposalResult | null> => {
    const attempt = useRoutineStore.getState().startPlanHydration();
    try {
      const service = getDeriveService();
      const result = await service.proposeRoutine();

      if (isRemoteServiceEnabled()) {
        const activeSessionUser = useAuthStore.getState().sessionUserId;
        if (!activeSessionUser || activeSessionUser !== id) {
          return null;
        }
      }

      const currentAttempt = useRoutineStore.getState().planHydrationAttempt;
      if (attempt !== currentAttempt) {
        return null;
      }

      useRoutineStore.getState().setPlanHydrated(
        result.routine,
        result.userProducts,
        false,
        attempt
      );

      return result;
    } catch (err: any) {
      console.warn('ensureInitialRoutineProposal error:', err);
      const currentAttempt = useRoutineStore.getState().planHydrationAttempt;
      if (attempt === currentAttempt) {
        if (isRemoteServiceEnabled()) {
          const activeSessionUser = useAuthStore.getState().sessionUserId;
          if (activeSessionUser && activeSessionUser === id) {
            useRoutineStore.getState().setPlanHydrationError(
              getCustomerErrorMessage('routine'),
              attempt
            );
          }
        } else {
          useRoutineStore.getState().setPlanHydrationError(
            getCustomerErrorMessage('routine'),
            attempt
          );
        }
      }
      return null;
    } finally {
      // B3.1 Defect B: only clear this user's proposal slot if THIS request still owns it.
      if (inFlightProposalTokens.get(id) === requestToken) {
        inFlightProposalTokens.delete(id);
        inFlightProposals.delete(id);
      }
    }
  })();

  inFlightProposals.set(id, proposalPromise);
  inFlightProposalTokens.set(id, requestToken);
  return proposalPromise;
}


export async function hydrateResearchInsights(userId?: string): Promise<ResearchInsight[]> {
  const service = getDeriveService();
  const id = resolveUserId(userId);
  const insights = await service.getResearchInsights(id);

  useRoutineStore.setState({ researchInsights: insights });
  return insights;
}

export async function hydrateCustomerProfile(userId?: string): Promise<CustomerProfile | null> {
  const service = getDeriveService();
  const id = resolveUserId(userId);
  const profile = await service.getCustomerProfile(id);

  if (profile) {
    // Freshness guard: in Remote mode, confirm the profile still belongs to the active authenticated session user
    if (isRemoteServiceEnabled()) {
      const activeSessionUser = useAuthStore.getState().sessionUserId;
      if (!activeSessionUser || activeSessionUser !== profile.id) {
        return null;
      }
    }
    useUserStore.getState().setRemoteCustomerProfile(profile);
  }

  return profile;
}

/**
 * Resolves post-auth customer bootstrap state (profile existence, onboarding completion, membership status).
 * Updates useBootstrapStore and projects canonical membership status into useUserStore.
 *
 * Guaranteed fail-closed:
 * - If userId is invalid or empty, fails closed with ERROR.
 * - If profile row is absent (profileExists: false), fails closed with ERROR.
 * - If service query throws/fails, shields technical details and fails closed with ERROR.
 * - Guarded against race conditions: stale results from prior requests or switched identities are discarded.
 */
export async function resolveCustomerBootstrap(userId: string): Promise<CustomerBootstrapState | null> {
  const bootstrapStore = useBootstrapStore.getState();
  const trimmed = typeof userId === 'string' ? userId.trim() : '';

  if (!trimmed) {
    bootstrapStore.setError(getCustomerErrorMessage('bootstrap'));
    return null;
  }

  const attempt = bootstrapStore.setResolving(trimmed);

  try {
    const service = getDeriveService();
    const state = await service.getCustomerBootstrapState(trimmed);

    // Freshness check: verify that this request attempt is still current and identity hasn't changed
    const currentAttempt = useBootstrapStore.getState().resolutionAttempt;
    if (attempt !== currentAttempt) {
      return null;
    }

    if (isRemoteServiceEnabled()) {
      const activeSessionUser = useAuthStore.getState().sessionUserId;
      if (!activeSessionUser || activeSessionUser !== state.userId) {
        return null;
      }
    }

    if (!state.profileExists) {
      bootstrapStore.setError(getCustomerErrorMessage('bootstrap'), attempt);
      return state;
    }

    const committed = bootstrapStore.setResolved(state, attempt);
    if (!committed) {
      return null;
    }

    // Project canonical membership status into user store
    useUserStore.getState().setRemoteBootstrapMembership(state.membershipStatus);

    // If onboarding is completed, attempt profile hydration (non-blocking)
    if (state.onboardingCompleted) {
      try {
        await hydrateCustomerProfile(trimmed);
      } catch (profileErr) {
        console.warn('Non-blocking profile hydration warning:', profileErr);
      }
    }

    return state;
  } catch (err: any) {
    console.warn('resolveCustomerBootstrap failed:', err);

    // Freshness check: verify attempt and identity before committing ERROR
    const currentAttempt = useBootstrapStore.getState().resolutionAttempt;
    if (attempt === currentAttempt) {
      if (isRemoteServiceEnabled()) {
        const activeSessionUser = useAuthStore.getState().sessionUserId;
        if (activeSessionUser && activeSessionUser === trimmed) {
          bootstrapStore.setError(getCustomerErrorMessage('bootstrap'), attempt);
        }
      } else {
        bootstrapStore.setError(getCustomerErrorMessage('bootstrap'), attempt);
      }
    }

    return null;
  }
}

// ==========================================
// 2. REACT HOOKS WITH ASYNC / ERROR STATES
// ==========================================

export function useOnboardingSubmission() {
  const [isBuilding, setIsBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async (payload: OnboardingPayload): Promise<OnboardingResult | null> => {
    setIsBuilding(true);
    setError(null);
    try {
      const result = await submitOnboarding(payload);
      return result;
    } catch (err: any) {
      console.warn('submitOnboarding error:', err);
      const message = getCustomerErrorMessage('onboarding');
      setError(message);
      return null;
    } finally {
      setIsBuilding(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { submit, isBuilding, error, clearError };
}

export function useAskDeriveQuery() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ask = useCallback(
    async (
      question: string,
      activeContext?: {
        scannedProduct?: ProductScanResult;
        currentStepId?: string;
        photoAttachmentUri?: string;
      }
    ): Promise<AskResponse | null> => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await askQuestion(question, activeContext);
        return response;
      } catch (err: any) {
        console.warn('askQuestion error:', err);
        const message = getCustomerErrorMessage('ask');
        setError(message);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const clearError = useCallback(() => setError(null), []);

  return { ask, isLoading, error, clearError };
}

export function useScanProductEvaluation() {
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const evaluate = useCallback(
    async (input: ScanProductInput): Promise<ProductScanResult | null> => {
      setIsEvaluating(true);
      setError(null);
      try {
        const result = await evaluateProduct(input);
        return result;
      } catch (err: any) {
        console.warn('evaluateProduct error:', err);
        const message = getCustomerErrorMessage('scan');
        setError(message);
        return null;
      } finally {
        setIsEvaluating(false);
      }
    },
    []
  );

  const clearError = useCallback(() => setError(null), []);

  return { evaluate, isEvaluating, error, clearError };
}

export function useCheckInMutation() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(
    async (input: Omit<CheckInInput, 'userId'>): Promise<CheckInResult | null> => {
      setIsSubmitting(true);
      setError(null);
      try {
        const result = await submitWeeklyCheckIn(input);
        return result;
      } catch (err: any) {
        console.warn('submitWeeklyCheckIn error:', err);
        const message = getCustomerErrorMessage('checkin');
        setError(message);
        return null;
      } finally {
        setIsSubmitting(false);
      }
    },
    []
  );

  const clearError = useCallback(() => setError(null), []);

  return { submit, isSubmitting, error, clearError };
}

export function useRefillMutation() {
  const [isRequesting, setIsRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const request = useCallback(
    async (input: {
      productId: string;
      productName: string;
      brand: string;
      note?: string;
    }): Promise<RefillRequest | null> => {
      setIsRequesting(true);
      setError(null);
      try {
        const result = await requestProductRefill(input);
        return result;
      } catch (err: any) {
        console.warn('requestProductRefill error:', err);
        const message = getCustomerErrorMessage('refill');
        setError(message);
        return null;
      } finally {
        setIsRequesting(false);
      }
    },
    []
  );

  const clearError = useCallback(() => setError(null), []);

  return { request, isRequesting, error, clearError };
}
