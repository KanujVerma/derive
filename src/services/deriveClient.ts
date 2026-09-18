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
import { getDeriveService } from './DeriveService.ts';
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
  RoutinePlan,
  SkinState,
  IrritationLevel,
  AdherenceLevel,
} from '../domain/types.ts';
import { useRoutineStore } from '../stores/routineStore.ts';
import { useUserStore } from '../stores/userStore.ts';
import { useOnboardingStore } from '../stores/onboardingStore.ts';

/**
 * Direct service accessor for programmatic operations
 */
export function getClientService(): IDeriveService {
  return getDeriveService();
}

/**
 * Current user ID accessor with fallback for guest/beta session
 */
export function getActiveUserId(): string {
  return useUserStore.getState().userId || 'usr_beta_member';
}

// ==========================================
// 1. COORDINATOR FUNCTIONS
// ==========================================

export async function submitOnboarding(payload: OnboardingPayload): Promise<OnboardingResult> {
  const service = getDeriveService();
  const result = await service.onboard(payload);

  // Synchronize canonical proposed routine into routine store
  useRoutineStore.setState({
    routine: result.proposedRoutine,
    userProducts: result.userProducts,
    completedStepIdsToday: [],
    checkIns: [],
    refillRequests: [],
    learnedInsights: [],
    researchInsights: [],
    isPlanUnderReview: result.proposedRoutine.status === 'awaiting_review',
    todayDominantStatus: 'Final review: Your first routine gets one final quality check before it goes live.',
    isWeeklyCheckInDue: false,
  });

  // Synchronize user store profile
  if (result.userId) {
    useUserStore.setState({
      userId: result.userId,
      membershipStatus: 'active',
    });
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
  const id = userId || getActiveUserId();
  const orders = await service.getOrders(id);

  useRoutineStore.setState({ refillRequests: orders });
  return orders;
}

export async function hydrateProgress(userId?: string): Promise<ProgressData> {
  const service = getDeriveService();
  const id = userId || getActiveUserId();
  const progress = await service.getProgress(id);

  useRoutineStore.setState({
    checkIns: progress.checkIns,
    learnedInsights: progress.learnedInsights,
    isWeeklyCheckInDue: progress.isCheckInDue,
  });

  return progress;
}

export async function hydrateRoutine(userId?: string): Promise<RoutinePlan | null> {
  const service = getDeriveService();
  const id = userId || getActiveUserId();
  const routine = await service.getRoutine(id);

  if (routine) {
    useRoutineStore.setState({
      routine,
      isPlanUnderReview: routine.status === 'awaiting_review',
    });
  }

  return routine;
}

export async function hydrateResearchInsights(userId?: string): Promise<ResearchInsight[]> {
  const service = getDeriveService();
  const id = userId || getActiveUserId();
  const insights = await service.getResearchInsights(id);

  useRoutineStore.setState({ researchInsights: insights });
  return insights;
}

export async function hydrateCustomerProfile(userId?: string): Promise<CustomerProfile | null> {
  const service = getDeriveService();
  const id = userId || getActiveUserId();
  const profile = await service.getCustomerProfile(id);

  if (profile) {
    useUserStore.setState({
      userId: profile.id,
      email: profile.email,
      fullName: profile.fullName,
      membershipStatus: profile.membershipStatus === 'active' ? 'active' : 'none',
    });
  }

  return profile;
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
      const message = err?.message || 'Failed to build your routine plan. Please try again.';
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
        const message = err?.message || 'Unable to consult skincare intelligence right now.';
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
        const message = err?.message || 'Product evaluation failed. Please try again.';
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
        const message = err?.message || 'Failed to submit check-in. Please try again.';
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
        const message = err?.message || 'Refill request failed. Please try again.';
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
