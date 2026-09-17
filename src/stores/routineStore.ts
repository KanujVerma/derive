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

export const INITIAL_ROUTINE_STATE = {
  routine: null as Routine | null,
  userProducts: [] as UserProduct[],
  completedStepIdsToday: [] as string[],
  isPlanUnderReview: false,
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

  // Actions
  resetRoutine: () => void;
  loadArthurDemoRoutine: () => void;
  initializeDefaultRoutine: () => void;
  toggleStepCompletion: (stepId: string) => void;
  submitCheckIn: (checkIn: Omit<CheckIn, 'id' | 'createdAt'>) => void;
  requestRefill: (productId: string, productName: string, brand: string) => void;
  updateRefillStatus: (refillId: string, status: RefillStatus, trackingNumber?: string) => void;
  updateRoutineByFounder: (updatedRoutine: Routine) => void;
  setRoutineStatus: (status: Routine['status']) => void;
}

export const useRoutineStore = create<RoutineState>((set, get) => ({
  ...INITIAL_ROUTINE_STATE,

  resetRoutine: () => set({ ...INITIAL_ROUTINE_STATE }),

  loadArthurDemoRoutine: () => set(getArthurDemoRoutineState()),

  initializeDefaultRoutine: () => set(getArthurDemoRoutineState()),

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
