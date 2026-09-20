import { create } from 'zustand';
import { shelfProductIdentity } from '../utils/shelfProducts.ts';
import type {
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
  PregnancyStatus,
  SensitivitiesStatus,
} from '../types/schema.ts';

export interface OnboardingState {
  currentStep: number;
  primaryGoal: Goal | null;
  secondaryGoals: Goal[];
  routineComplexity: RoutineComplexity | null;
  costPreference: ProductCostPreference | null;
  middayFeel: MiddayFeel | null;
  postCleanseTightness: boolean | null;
  shelfPhotoUri: string | null;
  detectedProducts: Product[];
  /** IDs the customer added or corrected; recognition cannot replace these. */
  customerEditedProductIds: string[];
  /** Labels and IDs a customer corrected or removed during this intake. */
  suppressedRecognitionKeys: string[];
  suppressedRecognitionIds: string[];
  frontPhotoUri: string | null;
  leftPhotoUri: string | null;
  rightPhotoUri: string | null;
  photoContextNote: string;
  knownSensitivities: string[];
  sensitivitiesStatus: SensitivitiesStatus;
  activePrescriptions: string[];
  isPregnantOrNursing: boolean;
  pregnancyStatus: PregnancyStatus;
  additionalSafetyNotes: string;
  adaptiveFollowUps: Array<{ question: string; answer?: string }>;
  isCompleted: boolean;

  // Reaction History
  hasBadReactions: boolean | null;
  productReactions: ProductReaction[];
  formulaSnapshots: FormulaSnapshot[];

  // Phenotype & Skin Response Context
  pihTendencyAnswer: 'Rarely' | 'Sometimes' | 'Often' | 'Not sure' | null;

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
  confirmProduct: (product: Product, prior?: Product) => void;
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
    pregnancyStatus?: PregnancyStatus;
    sensitivitiesStatus?: SensitivitiesStatus;
    notes?: string;
  }) => void;
  setAdaptiveAnswer: (index: number, answer: string) => void;
  setPihTendencyAnswer: (answer: 'Rarely' | 'Sometimes' | 'Often' | 'Not sure' | null) => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
  loadArthurDemoState: () => void;
}

const INITIAL_EMPTY_STATE = {
  currentStep: 1,
  primaryGoal: null,
  secondaryGoals: [],
  routineComplexity: null,
  costPreference: null,
  middayFeel: null,
  postCleanseTightness: null,
  shelfPhotoUri: null,
  detectedProducts: [],
  customerEditedProductIds: [],
  suppressedRecognitionKeys: [],
  suppressedRecognitionIds: [],
  frontPhotoUri: null,
  leftPhotoUri: null,
  rightPhotoUri: null,
  photoContextNote: '',
  knownSensitivities: [],
  sensitivitiesStatus: 'unanswered' as const,
  activePrescriptions: [],
  isPregnantOrNursing: false,
  pregnancyStatus: 'unanswered' as const,
  additionalSafetyNotes: '',
  adaptiveFollowUps: [],
  isCompleted: false,
  hasBadReactions: null,
  productReactions: [],
  formulaSnapshots: [],
  pihTendencyAnswer: null,
};

const ARTHUR_DEMO_STATE = {
  currentStep: 1,
  primaryGoal: 'breakouts' as Goal,
  secondaryGoals: ['texture' as Goal],
  routineComplexity: 'simple' as RoutineComplexity,
  costPreference: 'balanced' as ProductCostPreference,
  middayFeel: 'combination' as MiddayFeel,
  postCleanseTightness: false,
  shelfPhotoUri: null,
  detectedProducts: [
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
  ],
  frontPhotoUri: null,
  leftPhotoUri: null,
  rightPhotoUri: null,
  photoContextNote: '',
  knownSensitivities: [],
  sensitivitiesStatus: 'unanswered' as const,
  activePrescriptions: ['Differin 0.1%'],
  isPregnantOrNursing: false,
  pregnancyStatus: 'unanswered' as const,
  additionalSafetyNotes: '',
  adaptiveFollowUps: [
    {
      question: 'You selected Differin. How many nights per week are you currently applying it?',
      answer: 'About 3 nights per week',
    },
  ],
  isCompleted: false,
  hasBadReactions: true,
  productReactions: [
    {
      id: 'rx_seed_1',
      userId: 'guest_user',
      productNameSnapshot: 'High Fragrance Gel Deodorant',
      brandSnapshot: 'Old Spice',
      symptoms: ['burning_stinging' as ReactionSymptom, 'redness_rash' as ReactionSymptom],
      bodyArea: 'underarms' as BodyArea,
      severity: 'severe' as ReactionSeverity,
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
  pihTendencyAnswer: 'Sometimes' as const,
};

export const useOnboardingStore = create<OnboardingState>((set) => ({
  ...INITIAL_EMPTY_STATE,

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
    set((state) => {
      const preserved = state.detectedProducts.filter((product) =>
        state.customerEditedProductIds.includes(product.id)
      );
      const merged = [...preserved];
      const seenIds = new Set(preserved.map((product) => product.id));
      const seenNames = new Set([...preserved.map(shelfProductIdentity), ...state.suppressedRecognitionKeys]);
      for (const product of products) {
        const identity = shelfProductIdentity(product);
        if (seenIds.has(product.id) || state.suppressedRecognitionIds.includes(product.id) || seenNames.has(identity)) continue;
        merged.push(product);
        seenIds.add(product.id);
        seenNames.add(identity);
      }
      return { shelfPhotoUri: uri, detectedProducts: merged };
    }),

  confirmProduct: (product, prior) =>
    set((state) => {
      const current = state.detectedProducts.find((p) => p.id === product.id);
      if (!current && (!prior || state.suppressedRecognitionIds.includes(product.id))) return state;
      const nextKey = shelfProductIdentity(product);
      if (state.detectedProducts.some((other) => other.id !== product.id && shelfProductIdentity(other) === nextKey)) return state;
      const previousProduct = current ?? prior;
      const priorKey = previousProduct && shelfProductIdentity(previousProduct);
      const suppressed = state.suppressedRecognitionKeys.filter((key) => key !== nextKey);
      if (priorKey && priorKey !== nextKey && !suppressed.includes(priorKey)) suppressed.push(priorKey);
      return {
        detectedProducts: current
          ? state.detectedProducts.map((p) => p.id === product.id ? product : p)
          : [...state.detectedProducts, product],
        customerEditedProductIds: state.customerEditedProductIds.includes(product.id)
          ? state.customerEditedProductIds
          : [...state.customerEditedProductIds, product.id],
        suppressedRecognitionKeys: suppressed,
      };
    }),

  removeProduct: (productId) =>
    set((state) => {
      const removed = state.detectedProducts.find((product) => product.id === productId);
      const key = removed && shelfProductIdentity(removed);
      return {
        detectedProducts: state.detectedProducts.filter((p) => p.id !== productId),
        customerEditedProductIds: state.customerEditedProductIds.filter((id) => id !== productId),
        suppressedRecognitionKeys: key && !state.suppressedRecognitionKeys.includes(key)
          ? [...state.suppressedRecognitionKeys, key]
          : state.suppressedRecognitionKeys,
        suppressedRecognitionIds: state.suppressedRecognitionIds.includes(productId)
          ? state.suppressedRecognitionIds
          : [...state.suppressedRecognitionIds, productId],
      };
    }),

  addProduct: (product) =>
    set((state) => {
      const duplicate = state.detectedProducts.find((existing) =>
        existing.id === product.id || shelfProductIdentity(existing) === shelfProductIdentity(product)
      );
      return {
        detectedProducts: duplicate
          ? state.detectedProducts.map((existing) => existing.id === duplicate.id ? product : existing)
          : [...state.detectedProducts, product],
        customerEditedProductIds: [...state.customerEditedProductIds.filter((id) => id !== duplicate?.id && id !== product.id), product.id],
        suppressedRecognitionKeys: state.suppressedRecognitionKeys.filter((key) => key !== shelfProductIdentity(product)),
        suppressedRecognitionIds: state.suppressedRecognitionIds.filter((id) => id !== product.id),
      };
    }),

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

  setSafetyContext: ({ sensitivities, prescriptions, pregnancy, pregnancyStatus, sensitivitiesStatus, notes }) =>
    set({
      knownSensitivities: sensitivities,
      sensitivitiesStatus: sensitivitiesStatus ?? (sensitivities.length > 0 ? 'reported' : 'unanswered'),
      activePrescriptions: prescriptions,
      isPregnantOrNursing: pregnancy,
      pregnancyStatus: pregnancyStatus ?? (pregnancy ? 'yes' : 'unanswered'),
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

  setPihTendencyAnswer: (answer) => set({ pihTendencyAnswer: answer }),

  completeOnboarding: () => set({ isCompleted: true }),

  resetOnboarding: () => set({ ...INITIAL_EMPTY_STATE }),

  loadArthurDemoState: () => set({
    ...ARTHUR_DEMO_STATE,
    customerEditedProductIds: [],
    suppressedRecognitionKeys: [],
    suppressedRecognitionIds: [],
  }),
}));
