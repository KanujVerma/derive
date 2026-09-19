/**
 * DeriveService Shared Service Contract
 * 
 * This interface is the intentional integration boundary between:
 * - Kanuj: Customer Experience + Mobile (consumes this interface via MockDeriveService / RemoteDeriveService)
 * - Sami: Platform + Intelligence + Operations (implements RemoteDeriveService via Supabase / Edge Functions)
 * 
 * Rule: Changes to this file require mutual founder review.
 */

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
  RoutinePlan,
  UserProduct,
} from '../domain/types.ts';

export interface IDeriveService {
  /**
   * Submit completed onboarding questionnaire, skin photos, and initial shelf products.
   * Generates initial customer skin profile and initial proposed routine.
   */
  onboard(payload: OnboardingPayload): Promise<OnboardingResult>;

  /**
   * Generate or recalculate an evidence-based routine proposal based on profile & shelf.
   * In Remote mode, input is optional/non-authoritative; authoritative context is derived server-side.
   */
  proposeRoutine(input?: RoutineProposalInput): Promise<RoutineProposalResult>;

  /**
   * Retrieve all member shelf and recommendation products.
   */
  getUserProducts(userId: string): Promise<UserProduct[]>;

  /**
   * Ask Derive a question with contextual awareness (active routine, scanned product, safety check).
   */
  askDerive(request: AskRequest): Promise<AskResponse>;

  /**
   * Scan or evaluate a product label for fit with the user's specific skin profile & active routine.
   */
  scanProduct(input: ScanProductInput): Promise<ProductScanResult>;

  /**
   * Submit weekly skin observation check-in.
   */
  submitCheckIn(input: CheckInInput): Promise<CheckInResult>;

  /**
   * Retrieve historical check-ins, learned insights, and progress photo records.
   */
  getProgress(userId: string): Promise<ProgressData>;

  /**
   * Request a 1-tap product refill replenishment.
   */
  requestRefill(input: RefillRequestInput): Promise<RefillRequest>;

  /**
   * Retrieve active and historical refill shipment orders.
   */
  getOrders(userId: string): Promise<RefillRequest[]>;

  /**
   * Retrieve curated research intelligence papers relevant to the member's routine.
   */
  getResearchInsights(userId: string): Promise<ResearchInsight[]>;

  /**
   * Retrieve canonical active routine plan.
   */
  getRoutine(userId: string): Promise<RoutinePlan | null>;

  /**
   * Retrieve customer profile & membership status.
   */
  getCustomerProfile(userId: string): Promise<CustomerProfile | null>;

  /**
   * Retrieve canonical post-auth customer bootstrap state (profile existence, onboarding completion, membership status).
   */
  getCustomerBootstrapState(userId: string): Promise<CustomerBootstrapState>;
}
