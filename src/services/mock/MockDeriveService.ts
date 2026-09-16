/**
 * MockDeriveService
 * 
 * Standalone mock implementation of IDeriveService.
 * Allows Kanuj to build, test, and polish the complete customer mobile experience
 * (Today, Plan, Scan, Ask, Progress, Refills, Onboarding) without waiting for
 * Supabase backend or network connectivity.
 */

import type { IDeriveService } from '../../contracts/DeriveService.ts';
import type {
  OnboardingPayload,
  OnboardingResult,
  RoutineProposalInput,
  RoutineProposalResult,
  AskRequest,
  AskResponse,
  ScanProductInput,
  ProductScanResult,
  CheckInInput,
  CheckInResult,
  ProgressData,
  RefillRequestInput,
  RefillRequest,
  ResearchInsight,
  CustomerProfile,
  RoutinePlan,
  SkinProfile,
  UserProduct,
  CheckIn,
  LearnedInsight,
  PhotoContextEntry,
  ProductCategory,
} from '../../domain/types.ts';
import { generateRoutineProposal } from '../ai-workflows/routine-generator.ts';
import { evaluateProductScan } from '../ai-workflows/scan-evaluator.ts';
import { checkSkincareSafety } from '../ai-workflows/safety-classifier.ts';
import { askDeriveAdvisor } from '../ai-workflows/chat-advisor.ts';

function inferProductCategory(name: string): ProductCategory {
  const lower = name.toLowerCase();
  if (lower.includes('cleanser') || lower.includes('wash')) return 'cleanser';
  if (lower.includes('sunscreen') || lower.includes('spf')) return 'sunscreen';
  if (lower.includes('moisturizer') || lower.includes('cream') || lower.includes('lotion')) return 'moisturizer';
  if (lower.includes('serum')) return 'serum';
  if (lower.includes('toner')) return 'toner';
  if (lower.includes('oil')) return 'oil';
  if (lower.includes('mask')) return 'mask';
  if (lower.includes('scrub')) return 'other';
  return 'treatment';
}

export class MockDeriveService implements IDeriveService {
  private activeRoutine: RoutinePlan | null = null;
  private userProducts: UserProduct[] = [];
  private checkIns: CheckIn[] = [
    {
      id: 'ci_mock_1',
      userId: 'mock_user_1',
      primaryGoal: 'breakouts',
      goalOutcome: 'better',
      skinState: 'better',
      irritation: 'none',
      adherence: 'yes',
      notes: 'Skin felt comfortable. No redness from Differin.',
      aiAnalysisSentence: 'Good adherence. Differin on Monday, Wednesday, and Friday is performing well.',
      adjustmentProposed: false,
      createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    },
  ];
  private refillRequests: RefillRequest[] = [
    {
      id: 'rf_mock_1',
      userId: 'mock_user_1',
      productId: 'p3',
      productName: 'Toleriane Double Repair Face Moisturizer',
      brand: 'La Roche-Posay',
      status: 'shipped',
      requestedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
      shippedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
      estimatedDelivery: 'Thursday',
      carrier: 'USPS Ground Advantage',
      trackingNumber: '9400111899223190442155',
      trackingUrl: 'https://tools.usps.com',
    },
  ];
  private learnedInsights: LearnedInsight[] = [
    {
      id: 'li_mock_1',
      text: 'No flaking or stinging reported across the last two weeks.',
      basis: 'user_reported',
      dateObserved: '2026-09-08',
    },
    {
      id: 'li_mock_2',
      text: 'Differin tolerated 3 nights/week without reported barrier irritation.',
      basis: 'routine_history',
      dateObserved: '2026-09-08',
      relatedIngredient: 'Adapalene 0.1%',
    },
    {
      id: 'li_mock_3',
      text: 'Breakouts reported as reduced during consecutive check-ins.',
      basis: 'user_reported',
      dateObserved: '2026-09-08',
    },
  ];
  private researchInsights: ResearchInsight[] = [
    {
      id: 'res_mock_1',
      title: 'Niacinamide + Retinoid Synergy in Acne-Prone Skin',
      summary: 'New research supports your current routine. Relevant to your Differin + niacinamide combination.',
      whyItMattersToYou:
        'Your current plan pairs Toleriane Double Repair (which includes niacinamide) with Differin. This clinical evaluation confirms that 2–4% niacinamide preserves barrier lipids and minimizes flaking without weakening adapalene efficacy.',
      recommendation: 'no_change',
      recommendationReason: 'No changes needed. Your current plan already pairs these products.',
      source: 'Journal of Cosmetic Dermatology, 2026',
      evidenceStrength: 'high',
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
  ];

  async onboard(payload: OnboardingPayload): Promise<OnboardingResult> {
    const userId = payload.userId || 'mock_user_1';
    const skinProfile: SkinProfile = {
      id: `sp_${Date.now()}`,
      userId,
      primaryGoal: payload.primaryGoal,
      secondaryGoals: payload.secondaryGoals,
      routineComplexity: payload.routineComplexity,
      costPreference: payload.costPreference,
      middayFeel: payload.middayFeel,
      postCleanseTightness: payload.postCleanseTightness,
      knownSensitivities: payload.safetyContext.knownSensitivities,
      activePrescriptions: payload.safetyContext.activePrescriptions,
      isPregnantOrNursing: payload.safetyContext.isPregnantOrNursing,
      additionalNotes: payload.safetyContext.additionalNotes,
      onboardingCompleted: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const proposal = generateRoutineProposal(
      {
        primaryGoal: payload.primaryGoal,
        secondaryGoals: payload.secondaryGoals,
        routineComplexity: payload.routineComplexity,
        costPreference: payload.costPreference,
        middayFeel: payload.middayFeel,
        postCleanseTightness: payload.postCleanseTightness,
        activePrescriptions: payload.safetyContext.activePrescriptions,
      },
      payload.confirmedProducts
    );

    this.activeRoutine = proposal.routine;
    this.userProducts = proposal.userProducts;

    return {
      userId,
      skinProfile,
      proposedRoutine: proposal.routine,
      userProducts: proposal.userProducts,
    };
  }

  async proposeRoutine(input: RoutineProposalInput): Promise<RoutineProposalResult> {
    const proposal = generateRoutineProposal(
      input.profile,
      input.shelfProducts
    );
    this.activeRoutine = proposal.routine;
    this.userProducts = proposal.userProducts;
    return proposal;
  }

  async askDerive(request: AskRequest): Promise<AskResponse> {
    const safetyCheck = checkSkincareSafety(request.question);
    if (safetyCheck.isMedicalEmergency) {
      return {
        answer: 'Please seek immediate medical evaluation.',
        directAnswer: 'Please seek immediate medical evaluation.',
        whyExplanation:
          safetyCheck.message ||
          'The symptoms you described require clinical in-person medical evaluation and fall outside cosmetic skincare.',
        recommendedAction: 'Stop all active skincare and seek medical attention immediately.',
        safety: {
          isMedicalEmergency: true,
          severity: 'emergency',
          message: safetyCheck.message,
          recommendedAction: 'immediate_medical_care',
        },
      };
    }

    const advisor = await askDeriveAdvisor(
      request.question,
      this.activeRoutine,
      request.activeContext?.photoAttachmentUri
    );

    return {
      answer: `${advisor.directAnswer} ${advisor.whyExplanation}`,
      directAnswer: advisor.directAnswer,
      whyExplanation: advisor.whyExplanation,
      recommendedAction: advisor.recommendedAction,
      safety: {
        isMedicalEmergency: false,
        severity: safetyCheck.severity,
        message: safetyCheck.message,
        recommendedAction: safetyCheck.severity === 'warning' ? 'caution_barrier' : 'continue',
      },
      suggestedFollowUps: [
        'How should I apply this with Differin?',
        'What should I watch out for?',
        'Can I use this in the morning?',
      ],
      referencedProducts: advisor.productScan ? [advisor.productScan.productName] : undefined,
    };
  }

  async scanProduct(input: ScanProductInput): Promise<ProductScanResult> {
    const context = {
      routine: this.activeRoutine,
      userProducts: this.userProducts,
      activeDifferinSchedule: input.userRoutineContext?.activeDifferinSchedule ? 'Mon, Wed, Fri' : undefined,
      currentRoutineProducts: input.userRoutineContext?.currentRoutineProducts || ['Differin Gel 0.1%'],
      recentReactions: input.userRoutineContext?.recentReactions?.map((r) => r.productNameSnapshot) || [],
    };

    const category = inferProductCategory(input.productName);

    return evaluateProductScan(
      {
        name: input.productName,
        brand: input.brand || 'Audited Brand',
        category,
      },
      context
    );
  }

  async submitCheckIn(input: CheckInInput): Promise<CheckInResult> {
    const isIrritated = input.irritation === 'lot' || input.irritation === 'little';
    const analysisSentence = isIrritated
      ? 'Mild sensitivity noted. Maintain barrier hydration and pause any optional exfoliating treatments.'
      : 'Skin responding steadily. Continue the current schedule.';

    const newCheckIn: CheckIn = {
      id: `ci_${Date.now()}`,
      userId: input.userId,
      primaryGoal: input.primaryGoal,
      skinState: input.skinState,
      irritation: input.irritation,
      adherence: input.adherence,
      notes: input.notes,
      photoUrls: input.photoUris,
      irritationDetails: input.irritationDetails,
      aiAnalysisSentence: analysisSentence,
      adjustmentProposed: isIrritated,
      createdAt: new Date().toISOString(),
    };

    this.checkIns.unshift(newCheckIn);

    return {
      checkIn: newCheckIn,
      aiAnalysisSentence: analysisSentence,
      adjustmentProposed: isIrritated,
      proposedAdjustmentSummary: isIrritated
        ? 'Consider pausing active exfoliation for 48 hours to allow barrier recovery.'
        : undefined,
    };
  }

  async getProgress(userId: string): Promise<ProgressData> {
    const recentPhotos: PhotoContextEntry[] = [
      {
        id: 'photo_base_1',
        angle: 'front',
        uri: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800&auto=format&fit=crop&q=80',
        capturedAt: '2026-08-25T14:30:00Z',
        userNote: 'Baseline capture before starting Differin.',
      },
      {
        id: 'photo_base_2',
        angle: 'left',
        uri: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80',
        capturedAt: '2026-08-25T14:31:00Z',
      },
      {
        id: 'photo_base_3',
        angle: 'right',
        uri: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&auto=format&fit=crop&q=80',
        capturedAt: '2026-08-25T14:32:00Z',
      },
    ];

    return {
      checkIns: this.checkIns.filter((c) => c.userId === userId || userId === 'mock_user_1' || userId === 'guest_user'),
      learnedInsights: this.learnedInsights,
      recentPhotos,
      routineHistorySummary: '3-step minimal routine active for 3 weeks.',
      isCheckInDue: false,
    };
  }

  async requestRefill(input: RefillRequestInput): Promise<RefillRequest> {
    const newRefill: RefillRequest = {
      id: `rf_${Date.now()}`,
      userId: input.userId,
      productId: input.productId,
      productName: input.productName,
      brand: input.brand,
      status: 'requested',
      requestedAt: new Date().toISOString(),
      estimatedDelivery: '3-5 business days',
    };
    this.refillRequests.unshift(newRefill);
    return newRefill;
  }

  async getOrders(userId: string): Promise<RefillRequest[]> {
    return this.refillRequests;
  }

  async getResearchInsights(userId: string): Promise<ResearchInsight[]> {
    return this.researchInsights;
  }

  async getRoutine(userId: string): Promise<RoutinePlan | null> {
    if (this.activeRoutine) return this.activeRoutine;
    // Default fallback routine
    const defaultProposal = generateRoutineProposal(
      { primaryGoal: 'breakouts', routineComplexity: 'simple' },
      [
        {
          id: 'p1',
          brand: 'CeraVe',
          name: 'Hydrating Facial Cleanser',
          category: 'cleanser',
          keyActives: ['Ceramides', 'Hyaluronic Acid'],
        },
        {
          id: 'p2',
          brand: 'Differin',
          name: 'Adapalene Gel 0.1%',
          category: 'treatment',
          keyActives: ['Adapalene 0.1%'],
        },
        {
          id: 'p3',
          brand: 'La Roche-Posay',
          name: 'Toleriane Double Repair Face Moisturizer',
          category: 'moisturizer',
          keyActives: ['Ceramide-3', 'Niacinamide 4%'],
        },
      ]
    );
    this.activeRoutine = defaultProposal.routine;
    this.userProducts = defaultProposal.userProducts;
    return this.activeRoutine;
  }

  async getCustomerProfile(userId: string): Promise<CustomerProfile | null> {
    return {
      id: userId,
      email: 'arthur.pendelton@example.com',
      fullName: 'Arthur Pendelton',
      tier: 'founding_beta_129',
      membershipStatus: 'active',
      createdAt: '2026-08-25T10:00:00Z',
      updatedAt: new Date().toISOString(),
    };
  }
}
