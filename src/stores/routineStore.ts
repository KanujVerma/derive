import { create } from 'zustand';
import type {
  Routine,
  UserProduct,
  CheckIn,
  RefillRequest,
  RefillStatus,
  LearnedInsight,
  ResearchInsight,
} from '../types/schema.ts';
import { generateRoutineProposal } from '../services/ai-workflows/routine-generator.ts';

export type PlanHydrationStatus = 'idle' | 'loading' | 'ready' | 'error';

export const INITIAL_ROUTINE_STATE = {
  routine: null as Routine | null,
  userProducts: [] as UserProduct[],
  completedStepIdsToday: [] as string[],
  isPlanUnderReview: false,
  isRoutineBeingPrepared: false,
  planHydrationStatus: 'idle' as PlanHydrationStatus,
  planHydrationAttempt: 0,
  planHydrationError: null as string | null,
  checkIns: [] as CheckIn[],
  learnedInsights: [] as LearnedInsight[],
  researchInsights: [] as ResearchInsight[],
  refillRequests: [] as RefillRequest[],
  todayDominantStatus: 'No active routine yet. Complete setup to calibrate your routine.',
  isWeeklyCheckInDue: false,
};

export const ARTHUR_DEMO_PRODUCTS = [
  {
    id: 'p1',
    isCatalogStandard: true,
    brand: 'CeraVe',
    name: 'Hydrating Facial Cleanser',
    category: 'cleanser' as const,
    keyActives: ['Ceramides', 'Hyaluronic Acid'],
    fullIngredients: ['Water', 'Glycerin', 'Cetearyl Alcohol', 'Ceramides', 'Hyaluronic Acid'],
  },
  {
    id: 'p2',
    brand: 'Differin',
    name: 'Adapalene Gel 0.1%',
    category: 'treatment' as const,
    keyActives: ['Adapalene 0.1%'],
    fullIngredients: ['Adapalene', 'Carbomer 940', 'Edetate Disodium', 'Methylparaben', 'Water'],
  },
  {
    id: 'p4',
    brand: 'La Roche-Posay',
    name: 'Toleriane Double Repair Moisturizer',
    category: 'moisturizer' as const,
    keyActives: ['Ceramide-3', 'Niacinamide'],
    fullIngredients: ['Water', 'Glycerin', 'Dimethicone', 'Niacinamide', 'Ceramide NP'],
  },
  {
    id: 'p5',
    brand: 'Beauty of Joseon',
    name: 'Relief Sun SPF 50+',
    category: 'sunscreen' as const,
    keyActives: ['Rice Extract', 'Probiotics'],
    fullIngredients: ['Water', 'Rice Bran Water', 'Glycerin', 'Niacinamide', 'Probiotics'],
  },
];

export function getArthurDemoRoutineState() {
  const { routine, userProducts } = generateRoutineProposal(
    { primaryGoal: 'breakouts', routineComplexity: 'simple' },
    ARTHUR_DEMO_PRODUCTS
  );

  return {
    routine: {
      ...routine,
      status: 'published' as const,
    },
    userProducts,
    completedStepIdsToday: [] as string[],
    isPlanUnderReview: false,
    checkIns: [
      {
        id: 'ci_1',
        userId: 'guest_user',
        primaryGoal: 'breakouts' as const,
        goalOutcome: 'better' as const,
        skinState: 'better' as const,
        irritation: 'none' as const,
        adherence: 'yes' as const,
        notes: 'Skin felt comfortable. No redness from Differin.',
        contextTags: [],
        aiAnalysisSentence: 'Good adherence. Differin on Monday, Wednesday, and Friday is performing well.',
        adjustmentProposed: false,
        createdAt: '2026-09-08T10:00:00Z',
      },
    ],
    learnedInsights: [
      {
        id: 'li_1',
        text: 'No flaking or stinging reported across the last two weeks.',
        basis: 'user_reported' as const,
        dateObserved: '2026-09-08',
      },
      {
        id: 'li_2',
        text: 'Differin tolerated 3 nights/week without reported barrier irritation.',
        basis: 'routine_history' as const,
        dateObserved: '2026-09-08',
        relatedIngredient: 'Adapalene 0.1%',
      },
      {
        id: 'li_3',
        text: 'Breakouts reported as reduced during consecutive check-ins.',
        basis: 'user_reported' as const,
        dateObserved: '2026-09-08',
      },
    ],
    researchInsights: [
      {
        id: 'res_1',
        title: 'Niacinamide + Retinoid Synergy in Acne-Prone Skin',
        summary:
          'New research supports your current routine. Relevant to your Differin + niacinamide combination.',
        whyItMattersToYou:
          'Your current plan pairs Toleriane Double Repair (which includes niacinamide) with Differin. This clinical evaluation confirms that 2–4% niacinamide preserves barrier lipids and minimizes flaking without weakening adapalene efficacy.',
        recommendation: 'no_change' as const,
        recommendationReason:
          'No changes needed. Your current plan already pairs these products.',
        source: 'Journal of Cosmetic Dermatology, 2026',
        evidenceStrength: 'high' as const,
        date: 'Sep 2026',
        sources: [
          {
            title: 'Clinical Evaluation of Topical Adapalene and Niacinamide Combination in Acne-Prone Skin',
            publicationDate: 'March 2026',
            journalOrPublisher: 'Journal of Cosmetic Dermatology',
            url: 'https://pubmed.ncbi.nlm.nih.gov/38291044/',
          },
        ],
      },
    ],
    refillRequests: [
      {
        id: 'rf_1',
        userId: 'guest_user',
        productId: 'p4',
        productName: 'Toleriane Double Repair Moisturizer',
        brand: 'La Roche-Posay',
        status: 'shipped' as const,
        requestedAt: '2026-09-12T14:30:00Z',
        shippedAt: '2026-09-14T09:00:00Z',
        estimatedDelivery: 'Thursday',
        carrier: 'USPS Ground Advantage',
        trackingNumber: '9400111899223190442155',
        trackingUrl: 'https://tools.usps.com',
      },
    ],
    todayDominantStatus: 'Everything looks on track. No changes today.',
    isWeeklyCheckInDue: false,
    isRoutineBeingPrepared: false,
    planHydrationStatus: 'ready' as PlanHydrationStatus,
    planHydrationAttempt: 0,
    planHydrationError: null,
  };
}

export interface RoutineState {
  routine: Routine | null;
  userProducts: UserProduct[];
  completedStepIdsToday: string[];
  checkIns: CheckIn[];
  refillRequests: RefillRequest[];
  learnedInsights: LearnedInsight[];
  researchInsights: ResearchInsight[];
  todayDominantStatus: string;
  isWeeklyCheckInDue: boolean;
  isPlanUnderReview: boolean;
  isRoutineBeingPrepared: boolean;
  planHydrationStatus: PlanHydrationStatus;
  planHydrationAttempt: number;
  planHydrationError: string | null;

  // Actions
  resetRoutine: () => void;
  loadArthurDemoRoutine: () => void;
  toggleStepCompletion: (stepId: string) => void;
  submitCheckIn: (checkIn: Omit<CheckIn, 'id' | 'createdAt'>) => void;
  requestRefill: (productId: string, productName: string, brand: string) => void;
  updateRefillStatus: (refillId: string, status: RefillStatus, trackingNumber?: string) => void;
  updateRoutineByFounder: (updatedRoutine: Routine) => void;
  setRoutineStatus: (status: Routine['status']) => void;
  startPlanHydration: () => number;
  setPlanHydrating: (attempt: number) => void;
  setPlanHydrated: (
    routine: Routine | null,
    userProducts: UserProduct[],
    isBeingPrepared: boolean,
    attempt?: number
  ) => boolean;
  setPlanHydrationError: (errorMessage: string, attempt?: number) => boolean;
}

export const useRoutineStore = create<RoutineState>((set, get) => ({
  ...INITIAL_ROUTINE_STATE,

  resetRoutine: () =>
    set((state) => ({
      ...INITIAL_ROUTINE_STATE,
      planHydrationAttempt: state.planHydrationAttempt + 1,
    })),

  loadArthurDemoRoutine: () => set(getArthurDemoRoutineState()),

  startPlanHydration: () => {
    let nextAttempt = 1;
    set((state) => {
      nextAttempt = state.planHydrationAttempt + 1;
      return {
        planHydrationStatus: 'loading',
        planHydrationAttempt: nextAttempt,
        planHydrationError: null,
      };
    });
    return nextAttempt;
  },

  setPlanHydrating: (attempt) =>
    set({
      planHydrationStatus: 'loading',
      planHydrationAttempt: attempt,
      planHydrationError: null,
    }),

  setPlanHydrated: (routine, userProducts, isBeingPrepared, attempt) => {
    const current = get();
    if (attempt !== undefined && attempt !== current.planHydrationAttempt) {
      return false;
    }
    const isAwaitingReview = Boolean(routine && routine.status === 'awaiting_review');
    let todayDominantStatus = current.todayDominantStatus;
    if (isBeingPrepared) {
      todayDominantStatus = 'Your routine is being prepared.';
    } else if (isAwaitingReview) {
      todayDominantStatus =
        'Final review: Your first routine gets one final quality check before it goes live.';
    } else if (routine) {
      todayDominantStatus = 'Everything looks on track. No changes today.';
    } else {
      todayDominantStatus =
        'No active routine yet. Complete setup to calibrate your routine.';
    }

    set({
      routine,
      userProducts,
      isPlanUnderReview: isAwaitingReview,
      isRoutineBeingPrepared: isBeingPrepared,
      planHydrationStatus: 'ready',
      planHydrationError: null,
      todayDominantStatus,
    });
    return true;
  },

  setPlanHydrationError: (errorMessage, attempt) => {
    const current = get();
    if (attempt !== undefined && attempt !== current.planHydrationAttempt) {
      return false;
    }
    set({
      planHydrationStatus: 'error',
      planHydrationError: errorMessage,
    });
    return true;
  },

  toggleStepCompletion: (stepId) =>
    set((state) => {
      const exists = state.completedStepIdsToday.includes(stepId);
      return {
        completedStepIdsToday: exists
          ? state.completedStepIdsToday.filter((id) => id !== stepId)
          : [...state.completedStepIdsToday, stepId],
      };
    }),

  submitCheckIn: (data) =>
    set((state) => {
      const newCheckIn: CheckIn = {
        ...data,
        contextTags: data.contextTags ?? [],
        id: `ci_${Date.now()}`,
        createdAt: new Date().toISOString(),
      };
      return {
        checkIns: [newCheckIn, ...state.checkIns],
        isWeeklyCheckInDue: false,
        todayDominantStatus:
          data.irritation === 'lot'
            ? 'Irritation noted. Skip active treatments tonight.'
            : 'Check-in recorded. Everything looks on track.',
      };
    }),

  requestRefill: (productId, productName, brand) =>
    set((state) => {
      const newRefill: RefillRequest = {
        id: `rf_${Date.now()}`,
        userId: 'guest_user',
        productId,
        productName,
        brand,
        status: 'requested',
        requestedAt: new Date().toISOString(),
      };
      return {
        refillRequests: [newRefill, ...state.refillRequests],
      };
    }),

  updateRefillStatus: (refillId, status, trackingNumber) =>
    set((state) => ({
      refillRequests: state.refillRequests.map((r) =>
        r.id === refillId
          ? {
              ...r,
              status,
              trackingNumber,
              shippedAt: status === 'shipped' ? new Date().toISOString() : r.shippedAt,
            }
          : r
      ),
    })),

  updateRoutineByFounder: (updatedRoutine) =>
    set({
      routine: updatedRoutine,
      isPlanUnderReview: updatedRoutine.status === 'awaiting_review',
      todayDominantStatus: 'Routine updated by your concierge.',
    }),

  setRoutineStatus: (status) =>
    set((state) => {
      if (!state.routine) return state;
      return {
        routine: { ...state.routine, status },
        isPlanUnderReview: status === 'awaiting_review',
      };
    }),
}));
