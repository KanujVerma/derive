/**
 * MockDeriveService
 * 
 * Standalone mock implementation of IDeriveService.
 * Allows building, testing, and verifying the complete customer mobile experience
 * (Today, Plan, Scan, Ask, Progress, Refills, Onboarding) with clean default state
 * and swappable remote readiness.
 *
 * Invariants (K6):
 * - Clean state by default (no Arthur demo contamination, zero fake check-ins, zero fake orders, zero default routine).
 * - Explicit demo fixtures via seedArthurDemoData().
 * - Reset support via reset() for isolated test runs.
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
  CustomerBootstrapState,
  HostedMembershipSession,
  RoutinePlan,
  SkinProfile,
  UserProduct,
  Product,
  CheckIn,
  LearnedInsight,
  PhotoContextEntry,
  ProductCategory,
  Routine,
} from '../../domain/types.ts';
import { generateRoutineProposal } from '../ai-workflows/routine-generator.ts';
import { evaluateProductScan } from '../ai-workflows/scan-evaluator.ts';
import {
  findProductByBarcode,
  PROTOTYPE_CATALOG,
  type ScannableProductInput,
} from '../catalog.ts';
import { checkSkincareSafety } from '../ai-workflows/safety-classifier.ts';
import { askDeriveAdvisor } from '../ai-workflows/chat-advisor.ts';
import { authorCheckInAnalysis, isCheckInDueFromLatest } from '../../domain/checkIn.ts';

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
  private checkIns: CheckIn[] = [];
  private refillRequests: RefillRequest[] = [];
  private learnedInsights: LearnedInsight[] = [];
  private researchInsights: ResearchInsight[] = [];
  private recentPhotos: PhotoContextEntry[] = [];
  private customerProfile: CustomerProfile | null = null;
  private skinProfile: SkinProfile | null = null;
  private bootstrapOverride: Partial<CustomerBootstrapState> | null = null;

  async createMembershipCheckout(_requestId?: string): Promise<HostedMembershipSession> {
    throw new Error('Membership billing is available only when RemoteDeriveService is enabled.');
  }

  async createMembershipPortal(): Promise<HostedMembershipSession> {
    throw new Error('Membership billing is available only when RemoteDeriveService is enabled.');
  }

  /**
   * Resets all internal state back to clean initial state.
   */
  reset(): void {
    this.activeRoutine = null;
    this.userProducts = [];
    this.checkIns = [];
    this.refillRequests = [];
    this.learnedInsights = [];
    this.researchInsights = [];
    this.recentPhotos = [];
    this.customerProfile = null;
    this.skinProfile = null;
    this.bootstrapOverride = null;
  }

  /**
   * Explicitly seeds Arthur Pendelton demo fixture for development testing.
   * Never called automatically in production customer paths.
   */
  seedArthurDemoData(): void {
    const demoProposal = generateRoutineProposal(
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
        {
          id: 'p4',
          brand: 'Beauty of Joseon',
          name: 'Relief Sun SPF 50+',
          category: 'sunscreen',
          keyActives: ['Rice Extract', 'Probiotics'],
        },
      ]
    );

    this.activeRoutine = {
      ...demoProposal.routine,
      status: 'published',
    };
    this.userProducts = demoProposal.userProducts;

    this.checkIns = [
      {
        id: 'ci_mock_1',
        userId: 'mock_user_1',
        primaryGoal: 'breakouts',
        goalOutcome: 'better',
        skinState: 'better',
        irritation: 'none',
        adherence: 'yes',
        notes: 'Skin felt comfortable. No redness from Differin.',
        contextTags: [],
        aiAnalysisSentence: 'Good adherence. Differin on Monday, Wednesday, and Friday is performing well.',
        adjustmentProposed: false,
        createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
      },
    ];

    this.refillRequests = [
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

    this.learnedInsights = [
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

    this.researchInsights = [
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

    this.customerProfile = {
      id: 'usr_arthur_1',
      email: 'arthur@example.com',
      fullName: 'Arthur Pendelton',
      tier: 'founding_beta',
      membershipStatus: 'active',
      createdAt: '2026-09-01T00:00:00Z',
      updatedAt: new Date().toISOString(),
    };
  }

  async onboard(payload: OnboardingPayload): Promise<OnboardingResult> {
    const userId = payload.userId || 'usr_beta_member';
    const skinProfile: SkinProfile = {
      id: `sp_${Date.now()}`,
      userId,
      primaryGoal: payload.primaryGoal,
      secondaryGoals: payload.secondaryGoals,
      routineComplexity: payload.routineComplexity,
      costPreference: payload.costPreference,
      middayFeel: payload.middayFeel,
      postCleanseTightness: payload.postCleanseTightness,
      knownSensitivities: payload.safetyContext?.knownSensitivities || [],
      sensitivitiesStatus: payload.safetyContext?.sensitivitiesStatus || 'unanswered',
      activePrescriptions: payload.safetyContext?.activePrescriptions || [],
      isPregnantOrNursing: payload.safetyContext?.isPregnantOrNursing ?? false,
      pregnancyStatus: payload.safetyContext?.pregnancyStatus || 'unanswered',
      additionalNotes: payload.safetyContext?.additionalNotes,
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
        activePrescriptions: payload.safetyContext?.activePrescriptions,
      },
      payload.confirmedProducts
    );

    // Initial proposed routine is in draft/review mode
    const pendingRoutine: Routine = {
      ...proposal.routine,
      status: 'awaiting_review',
    };

    this.skinProfile = skinProfile;
    this.activeRoutine = pendingRoutine;
    this.userProducts = proposal.userProducts;

    // Baseline skin photos stored in memory for progress
    if (payload.skinPhotos) {
      const photos: PhotoContextEntry[] = [];
      if (payload.skinPhotos.frontUri) {
        photos.push({
          id: `ph_front_${Date.now()}`,
          angle: 'front',
          uri: payload.skinPhotos.frontUri,
          capturedAt: new Date().toISOString(),
          userNote: payload.skinPhotos.contextNote,
        });
      }
      if (payload.skinPhotos.leftUri) {
        photos.push({
          id: `ph_left_${Date.now()}`,
          angle: 'left',
          uri: payload.skinPhotos.leftUri,
          capturedAt: new Date().toISOString(),
        });
      }
      if (payload.skinPhotos.rightUri) {
        photos.push({
          id: `ph_right_${Date.now()}`,
          angle: 'right',
          uri: payload.skinPhotos.rightUri,
          capturedAt: new Date().toISOString(),
        });
      }
      this.recentPhotos = photos;
    }

    this.customerProfile = {
      id: userId,
      email: 'member@derive.skin',
      fullName: 'Beta Member',
      tier: 'founding_beta',
      membershipStatus: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return {
      userId,
      skinProfile,
      proposedRoutine: pendingRoutine,
      userProducts: proposal.userProducts,
      initialRoutineState: 'awaiting_review',
    };
  }

  async proposeRoutine(input?: RoutineProposalInput): Promise<RoutineProposalResult> {
    if (input) {
      const proposal = generateRoutineProposal(
        input.profile,
        input.shelfProducts
      );
      this.activeRoutine = proposal.routine;
      this.userProducts = proposal.userProducts;
      return proposal;
    }

    if (!this.skinProfile) {
      throw new Error('MockDeriveService.proposeRoutine requires profile state or explicit input.');
    }

    const shelfProducts: Product[] = this.userProducts.map((up) => up.product);
    const proposal = generateRoutineProposal(
      {
        primaryGoal: this.skinProfile.primaryGoal,
        secondaryGoals: this.skinProfile.secondaryGoals,
        routineComplexity: this.skinProfile.routineComplexity,
        costPreference: this.skinProfile.costPreference,
        middayFeel: this.skinProfile.middayFeel,
        postCleanseTightness: this.skinProfile.postCleanseTightness,
        activePrescriptions: this.skinProfile.activePrescriptions,
      },
      shelfProducts
    );
    proposal.routine.userId = this.skinProfile.userId;
    this.activeRoutine = proposal.routine;
    this.userProducts = proposal.userProducts;
    return proposal;
  }

  async getUserProducts(userId: string): Promise<UserProduct[]> {
    return [...this.userProducts];
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
      currentRoutineProducts: input.userRoutineContext?.currentRoutineProducts || (this.activeRoutine ? ['Differin Gel 0.1%'] : []),
      recentReactions: input.userRoutineContext?.recentReactions?.map((r) => r.productNameSnapshot) || [],
    };

    // Resilient catalog lookup matching prototype items
    let scannableItem = PROTOTYPE_CATALOG.find(
      (p) => p.name.toLowerCase() === input.productName.toLowerCase()
    );
    if (!scannableItem && input.barcode) {
      scannableItem = findProductByBarcode(input.barcode, PROTOTYPE_CATALOG) || undefined;
    }

    const productToEvaluate: ScannableProductInput = scannableItem || {
      name: input.productName,
      brand: input.brand || 'Audited Brand',
      category: inferProductCategory(input.productName),
    };

    return evaluateProductScan(productToEvaluate, context);
  }

  async submitCheckIn(input: CheckInInput): Promise<CheckInResult> {
    const contextTags = input.contextTags ?? [];
    const analysis = authorCheckInAnalysis({
      skinState: input.skinState,
      irritation: input.irritation,
      hasContext: contextTags.length > 0 || Boolean(input.contextNote?.trim()),
    });

    const newCheckIn: CheckIn = {
      id: `ci_${Date.now()}`,
      userId: input.userId,
      primaryGoal: input.primaryGoal || 'breakouts',
      skinState: input.skinState,
      irritation: input.irritation,
      adherence: input.adherence || 'yes',
      notes: input.notes,
      contextTags,
      contextNote: input.contextNote,
      photoUrls: input.photoUris,
      irritationDetails: input.irritationDetails,
      aiAnalysisSentence: analysis.sentence,
      adjustmentProposed: analysis.adjustmentProposed,
      createdAt: new Date().toISOString(),
    };

    this.checkIns.unshift(newCheckIn);

    return {
      checkIn: newCheckIn,
      aiAnalysisSentence: analysis.sentence,
      adjustmentProposed: analysis.adjustmentProposed,
      proposedAdjustmentSummary: analysis.adjustmentProposed
        ? 'Consider pausing active exfoliation for 48 hours to allow barrier recovery.'
        : undefined,
    };
  }

  async getProgress(userId: string): Promise<ProgressData> {
    return {
      checkIns: this.checkIns,
      learnedInsights: this.learnedInsights,
      recentPhotos: this.recentPhotos,
      routineHistorySummary: this.activeRoutine
        ? 'Active managed routine.'
        : 'No active routine yet. Complete setup to calibrate your routine.',
      isCheckInDue: isCheckInDueFromLatest(this.checkIns[0]?.createdAt),
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
    return this.activeRoutine;
  }

  async getCustomerProfile(userId: string): Promise<CustomerProfile | null> {
    return this.customerProfile;
  }

  /**
   * Optional test override for simulating specific edge cases (e.g. profileExists: false).
   */
  setMockBootstrapState(override: Partial<CustomerBootstrapState> | null): void {
    this.bootstrapOverride = override;
  }

  async getCustomerBootstrapState(userId: string): Promise<CustomerBootstrapState> {
    if (this.bootstrapOverride) {
      return {
        userId,
        profileExists: this.bootstrapOverride.profileExists ?? true,
        onboardingCompleted: this.bootstrapOverride.onboardingCompleted ?? false,
        membershipStatus: this.bootstrapOverride.membershipStatus ?? 'none',
        ...this.bootstrapOverride,
      };
    }

    const isOnboarded =
      this.skinProfile?.onboardingCompleted === true ||
      this.activeRoutine !== null ||
      this.customerProfile !== null;

    return {
      userId,
      profileExists: true,
      onboardingCompleted: isOnboarded,
      membershipStatus: this.customerProfile?.membershipStatus ?? 'none',
    };
  }
}
