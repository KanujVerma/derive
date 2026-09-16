import { create } from 'zustand';
import {
  Goal,
  RoutineComplexity,
  ProductCostPreference,
  MiddayFeel,
  Product,
  ProductReaction,
  FormulaSnapshot,
  ReactionSeverity,
  BodyArea,
  ReactionSymptom,
} from '@/src/types/schema';

export interface OnboardingState {
  currentStep: number;
  primaryGoal: Goal | null;
  secondaryGoals: Goal[];
  routineComplexity: RoutineComplexity;
  costPreference: ProductCostPreference;
  middayFeel: MiddayFeel;
  postCleanseTightness: boolean;
  shelfPhotoUri: string | null;
  detectedProducts: Product[];
  frontPhotoUri: string | null;
  leftPhotoUri: string | null;
  rightPhotoUri: string | null;
  photoContextNote: string;
  knownSensitivities: string[];
  activePrescriptions: string[];
  isPregnantOrNursing: boolean;
  additionalSafetyNotes: string;
  adaptiveFollowUps: Array<{ question: string; answer?: string }>;
  isCompleted: boolean;

  // Reaction History
  hasBadReactions: boolean | null;
  productReactions: ProductReaction[];
  formulaSnapshots: FormulaSnapshot[];

  // Actions
  setStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  setPrimaryGoal: (goal: Goal) => void;
  toggleSecondaryGoal: (goal: Goal) => void;
  setRoutineComplexity: (complexity: RoutineComplexity) => void;
  setCostPreference: (pref: ProductCostPreference) => void;
  setSkinBehavior: (midday: MiddayFeel, tightness: boolean) => void;
  setShelfPhoto: (uri: string, products: Product[]) => void;
  confirmProduct: (product: Product) => void;
  removeProduct: (productId: string) => void;
  addProduct: (product: Product) => void;
  setHasBadReactions: (has: boolean) => void;
  addProductReaction: (reaction: {
    productName: string;
    brand?: string;
    symptoms: ReactionSymptom[];
    bodyArea: BodyArea;
    severity: ReactionSeverity;
    notes?: string;
    ingredients?: string[];
  }) => void;
  removeProductReaction: (id: string) => void;
  setSkinPhotos: (photos: { front?: string; left?: string; right?: string }) => void;
  setPhotoContextNote: (note: string) => void;
  setSafetyContext: (data: {
    sensitivities: string[];
    prescriptions: string[];
    pregnancy: boolean;
    notes?: string;
  }) => void;
  setAdaptiveAnswer: (index: number, answer: string) => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  currentStep: 1,
  primaryGoal: 'breakouts',
  secondaryGoals: ['texture'],
  routineComplexity: 'simple',
  costPreference: 'balanced',
  middayFeel: 'combination',
  postCleanseTightness: false,
  shelfPhotoUri: null,
  detectedProducts: [
    {
      id: 'p1',
      brand: 'CeraVe',
      name: 'Hydrating Facial Cleanser',
      category: 'cleanser',
      keyActives: ['Ceramides', 'Hyaluronic Acid'],
      fullIngredients: ['Water', 'Glycerin', 'Cetearyl Alcohol', 'Ceramides', 'Hyaluronic Acid'],
    },
    {
      id: 'p2',
      brand: 'Differin',
      name: 'Adapalene Gel 0.1%',
      category: 'treatment',
      keyActives: ['Adapalene 0.1%'],
      fullIngredients: ['Adapalene', 'Carbomer 940', 'Edetate Disodium', 'Methylparaben', 'Water'],
    },
    {
      id: 'p4',
      brand: 'La Roche-Posay',
      name: 'Toleriane Double Repair Moisturizer',
      category: 'moisturizer',
      keyActives: ['Ceramide-3', 'Niacinamide'],
      fullIngredients: ['Water', 'Glycerin', 'Dimethicone', 'Niacinamide', 'Ceramide NP'],
    },
    {
      id: 'p5',
      brand: 'Beauty of Joseon',
      name: 'Relief Sun SPF 50+',
      category: 'sunscreen',
      keyActives: ['Rice Extract', 'Probiotics'],
      fullIngredients: ['Water', 'Rice Bran Water', 'Glycerin', 'Niacinamide', 'Probiotics'],
    },
  ],
  frontPhotoUri: null,
  leftPhotoUri: null,
  rightPhotoUri: null,
  photoContextNote: '',
  knownSensitivities: [],
  activePrescriptions: ['Differin 0.1%'],
  isPregnantOrNursing: false,
  additionalSafetyNotes: '',
  adaptiveFollowUps: [
    {
      question: 'You selected Differin. How many nights per week are you currently applying it?',
      answer: 'About 3 nights per week',
    },
  ],
  isCompleted: false,

  // Reaction History defaults
  hasBadReactions: null,
  productReactions: [
    {
      id: 'rx_seed_1',
      userId: 'guest_user',
      productNameSnapshot: 'High Fragrance Gel Deodorant',
      brandSnapshot: 'Old Spice',
      symptoms: ['burning_stinging', 'redness_rash'],
      bodyArea: 'underarms',
      severity: 'severe',
      notes: 'Severe burning sensation within 10 minutes of application.',
    },
  ],
  formulaSnapshots: [
    {
      id: 'snap_seed_1',
      productName: 'High Fragrance Gel Deodorant',
      brand: 'Old Spice',
      ingredients: ['Dipropylene Glycol', 'Water', 'Propylene Glycol', 'Fragrance', 'Sodium Stearate'],
      capturedAt: '2026-09-01T00:00:00Z',
    },
  ],

  setStep: (step) => set({ currentStep: step }),
  nextStep: () => set((state) => ({ currentStep: Math.min(state.currentStep + 1, 10) })),
  prevStep: () => set((state) => ({ currentStep: Math.max(state.currentStep - 1, 1) })),

  setPrimaryGoal: (goal) => set({ primaryGoal: goal }),

  toggleSecondaryGoal: (goal) =>
    set((state) => {
      const exists = state.secondaryGoals.includes(goal);
      return {
        secondaryGoals: exists
          ? state.secondaryGoals.filter((g) => g !== goal)
          : [...state.secondaryGoals, goal],
      };
    }),

  setRoutineComplexity: (complexity) => set({ routineComplexity: complexity }),
  setCostPreference: (pref) => set({ costPreference: pref }),
  setSkinBehavior: (midday, tightness) =>
    set({ middayFeel: midday, postCleanseTightness: tightness }),

  setShelfPhoto: (uri, products) =>
    set({ shelfPhotoUri: uri, detectedProducts: products }),

  confirmProduct: (product) =>
    set((state) => ({
      detectedProducts: state.detectedProducts.map((p) =>
        p.id === product.id ? product : p
      ),
    })),

  removeProduct: (productId) =>
    set((state) => ({
      detectedProducts: state.detectedProducts.filter((p) => p.id !== productId),
    })),

  addProduct: (product) =>
    set((state) => ({
      detectedProducts: [...state.detectedProducts, product],
    })),

  setHasBadReactions: (has) => set({ hasBadReactions: has }),

  addProductReaction: (data) =>
    set((state) => {
      const rxId = `rx_${Date.now()}`;
      const snapId = `snap_${Date.now()}`;

      const newSnap: FormulaSnapshot = {
        id: snapId,
        productName: data.productName,
        brand: data.brand,
        ingredients: data.ingredients || [],
        capturedAt: new Date().toISOString(),
      };

      const newRx: ProductReaction = {
        id: rxId,
        userId: 'guest_user',
        productNameSnapshot: data.productName,
        brandSnapshot: data.brand,
        formulaSnapshotId: snapId,
        symptoms: data.symptoms,
        bodyArea: data.bodyArea,
        severity: data.severity,
        notes: data.notes,
        approximateDate: new Date().toISOString(),
      };

      return {
        productReactions: [...state.productReactions, newRx],
        formulaSnapshots: [...state.formulaSnapshots, newSnap],
      };
    }),

  removeProductReaction: (id) =>
    set((state) => ({
      productReactions: state.productReactions.filter((r) => r.id !== id),
    })),

  setSkinPhotos: (photos) =>
    set((state) => ({
      frontPhotoUri: photos.front ?? state.frontPhotoUri,
      leftPhotoUri: photos.left ?? state.leftPhotoUri,
      rightPhotoUri: photos.right ?? state.rightPhotoUri,
    })),

  setPhotoContextNote: (note) => set({ photoContextNote: note }),

  setSafetyContext: ({ sensitivities, prescriptions, pregnancy, notes }) =>
    set({
      knownSensitivities: sensitivities,
      activePrescriptions: prescriptions,
      isPregnantOrNursing: pregnancy,
      additionalSafetyNotes: notes || '',
    }),

  setAdaptiveAnswer: (index, answer) =>
    set((state) => {
      const updated = [...state.adaptiveFollowUps];
      if (updated[index]) {
        updated[index].answer = answer;
      }
      return { adaptiveFollowUps: updated };
    }),

  completeOnboarding: () => set({ isCompleted: true }),

  resetOnboarding: () =>
    set({
      currentStep: 1,
      primaryGoal: 'breakouts',
      secondaryGoals: [],
      routineComplexity: 'simple',
      costPreference: 'balanced',
      middayFeel: 'combination',
      postCleanseTightness: false,
      shelfPhotoUri: null,
      frontPhotoUri: null,
      leftPhotoUri: null,
      rightPhotoUri: null,
      photoContextNote: '',
      isCompleted: false,
      hasBadReactions: null,
      productReactions: [],
    }),
}));
