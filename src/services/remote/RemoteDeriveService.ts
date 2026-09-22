/**
 * RemoteDeriveService
 * 
 * Production remote implementation of IDeriveService.
 * Owned by Sami (Platform + Intelligence + Operations).
 * 
 * Backed by Supabase Postgres, RLS, Edge Functions, and server-side intelligence.
 * Kanuj's mobile app interacts with this seamlessly via the IDeriveService contract.
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
  CheckIn,
  Routine,
  RoutineStep,
  ProductCategory,
  UserProduct,
  RoutineAction,
  RoutineStatus,
  RefillStatus,
} from '../../domain/types.ts';
import { formatRoutineStepSchedule } from '../../types/schema.ts';
import { isCheckInDueFromLatest, mapCheckInResult, mapDbCheckIn, type DbCheckInRow } from '../../domain/checkIn.ts';
import { supabase } from '../supabase.ts';
import { uploadPhotoToStorage } from '../onboardingPhotoUpload.ts';
import { createDiagnosticTraceId, diagnosticRequestHeaders, recordRemoteFailure, recordRemoteSuccess } from './diagnostics.ts';

const ROUTINE_STATUSES = new Set<RoutineStatus>([
  'draft',
  'awaiting_review',
  'approved',
  'published',
]);

const PRODUCT_CATEGORIES = new Set<ProductCategory>([
  'cleanser',
  'toner',
  'treatment',
  'serum',
  'moisturizer',
  'sunscreen',
  'oil',
  'mask',
  'deodorant',
  'body_care',
  'hair_care',
  'other',
]);

const ROUTINE_DAYS = new Set(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
const REFILL_STATUSES = new Set<RefillStatus>(['requested', 'ordered', 'shipped', 'delivered']);

export interface DbRoutineRow {
  id: string;
  user_id: string;
  version: number;
  status: string;
  summary_sentence: string;
  created_at: string;
  updated_at: string;
  published_at?: string | null;
}

export interface DbRoutineItemRow {
  id: string;
  routine_id: string;
  order_index: number;
  timing: string;
  product_id?: string | null;
  product_name: string;
  brand: string;
  category: string;
  amount: string;
  area: string;
  days?: string[] | null;
  purpose: string;
  why_chosen: string;
  watch_for?: string | null;
}

export interface DbRefillRequestRow {
  id: string;
  user_id: string;
  product_id?: string | null;
  product_name: string;
  brand: string;
  status: string;
  requested_at: string;
  shipped_at?: string | null;
  delivered_at?: string | null;
  estimated_delivery?: string | null;
  carrier?: string | null;
  tracking_number?: string | null;
  tracking_url?: string | null;
}

export class RemoteDeriveService implements IDeriveService {
  private customClient: any = null;

  constructor(client?: any) {
    if (client) {
      this.customClient = client;
    }
  }

  private getClient() {
    if (this.customClient) {
      return this.customClient;
    }
    if (!supabase) {
      throw new Error(
        'Supabase client is not configured. Set EXPO_PUBLIC_SUPABASE_URL '
          + 'and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.',
      );
    }
    return supabase;
  }

  async createMembershipCheckout(requestId = createRequestId()): Promise<HostedMembershipSession> {
    const client = this.getClient();
    const { data, error } = await client.functions.invoke('create-membership-checkout', {
      body: { requestId },
    });
    if (error) {
      throw new Error(`RemoteDeriveService.createMembershipCheckout failed: ${error.message}`);
    }
    return mapHostedMembershipSession(data, 'checkout');
  }

  async createMembershipPortal(): Promise<HostedMembershipSession> {
    const client = this.getClient();
    const { data, error } = await client.functions.invoke('create-membership-portal', {
      body: {},
    });
    if (error) {
      throw new Error(`RemoteDeriveService.createMembershipPortal failed: ${error.message}`);
    }
    return mapHostedMembershipSession(data, 'portal');
  }

  async onboard(payload: OnboardingPayload): Promise<OnboardingResult> {
    const client = this.getClient();
    const prepareTrace = await createDiagnosticTraceId();

    // 1. Prepare onboarding submission and retrieve opaque server-issued upload targets
    const { data: prepareData, error: prepareError } = await client.functions.invoke(
      'prepare-onboarding',
      { body: {}, headers: diagnosticRequestHeaders(prepareTrace) }
    );
    if (prepareError || !prepareData?.submissionId) {
      recordRemoteFailure('onboarding_prepare', prepareError ?? { code: 'INVALID_RESPONSE' }, prepareTrace);
      throw new Error(
        `RemoteDeriveService.onboard failed in prepare-onboarding: ${prepareError?.message || 'Invalid prepare response'}`
      );
    }
    recordRemoteSuccess('onboarding_prepare');

    const { submissionId, uploadTargets } = prepareData;

    // 2. Upload private skin photos directly to server-issued storage targets
    const frontUri = payload.skinPhotos?.frontUri;
    const leftUri = payload.skinPhotos?.leftUri;
    const rightUri = payload.skinPhotos?.rightUri;
    const shelfUri = payload.skinPhotos?.shelfUri;

    try {
      if (!uploadTargets?.front?.uploaded) {
        if (!frontUri) throw new Error('Missing front photo URI for onboarding');
        await uploadPhotoToStorage(uploadTargets.front.path, frontUri, client);
      }

      if (!uploadTargets?.left?.uploaded) {
        if (!leftUri) throw new Error('Missing left photo URI for onboarding');
        await uploadPhotoToStorage(uploadTargets.left.path, leftUri, client);
      }

      if (!uploadTargets?.right?.uploaded) {
        if (!rightUri) throw new Error('Missing right photo URI for onboarding');
        await uploadPhotoToStorage(uploadTargets.right.path, rightUri, client);
      }

      if (shelfUri && uploadTargets?.shelf && !uploadTargets.shelf.uploaded) {
        await uploadPhotoToStorage(uploadTargets.shelf.path, shelfUri, client);
      }
      recordRemoteSuccess('onboarding_upload');
    } catch (uploadError) {
      recordRemoteFailure('onboarding_upload', uploadError);
      throw uploadError;
    }

    // 3. Commit intake with onboard-customer (sanitizing client-local URIs)
    const { skinPhotos, ...restPayload } = payload;
    const sanitizedPayload = {
      ...restPayload,
      skinPhotos: {
        contextNote: skinPhotos?.contextNote,
      },
    };
    const commitTrace = await createDiagnosticTraceId();

    const { data, error } = await client.functions.invoke('onboard-customer', {
      body: {
        submissionId,
        payload: sanitizedPayload,
      },
      headers: diagnosticRequestHeaders(commitTrace),
    });

    if (error || !data) {
      recordRemoteFailure('onboarding_commit', error ?? { code: 'INVALID_RESPONSE' }, commitTrace);
      throw new Error(
        `RemoteDeriveService.onboard failed in onboard-customer: ${error?.message || 'Empty response'}`
      );
    }
    recordRemoteSuccess('onboarding_commit');

    return data as OnboardingResult;
  }

  async proposeRoutine(input?: RoutineProposalInput): Promise<RoutineProposalResult> {
    const client = this.getClient();
    const trace = await createDiagnosticTraceId();
    const { data, error } = await client.functions.invoke('propose-routine', {
      body: input || {},
      headers: diagnosticRequestHeaders(trace),
    });
    if (error) {
      recordRemoteFailure('routine_propose', error, trace);
      throw new Error(`RemoteDeriveService.proposeRoutine failed: ${error.message}`);
    }
    recordRemoteSuccess('routine_propose');
    return data as RoutineProposalResult;
  }

  async askDerive(request: AskRequest): Promise<AskResponse> {
    const client = this.getClient();
    const trace = await createDiagnosticTraceId();
    const { data, error } = await client.functions.invoke('ask-derive', {
      body: request,
      headers: diagnosticRequestHeaders(trace),
    });
    if (error) {
      recordRemoteFailure('ask', error, trace);
      throw new Error(`RemoteDeriveService.askDerive failed: ${error.message}`);
    }
    recordRemoteSuccess('ask');
    return data as AskResponse;
  }

  async scanProduct(input: ScanProductInput): Promise<ProductScanResult> {
    const client = this.getClient();
    const trace = await createDiagnosticTraceId();
    const { data, error } = await client.functions.invoke('scan-product', {
      body: input,
      headers: diagnosticRequestHeaders(trace),
    });
    if (error) {
      recordRemoteFailure('product_scan', error, trace);
      throw new Error(`RemoteDeriveService.scanProduct failed: ${error.message}`);
    }
    recordRemoteSuccess('product_scan');
    return data as ProductScanResult;
  }

  async submitCheckIn(input: CheckInInput): Promise<CheckInResult> {
    const client = this.getClient();
    const trace = await createDiagnosticTraceId();
    const { data, error } = await client.functions.invoke('submit-checkin', {
      body: input,
      headers: diagnosticRequestHeaders(trace),
    });
    if (error) {
      recordRemoteFailure('checkin_submit', error, trace);
      throw new Error(`RemoteDeriveService.submitCheckIn failed: ${error.message}`);
    }
    const mapped = mapCheckInResult(data);
    if (!mapped) {
      recordRemoteFailure('checkin_submit', { code: 'INVALID_RESPONSE' }, trace);
      throw new Error('RemoteDeriveService.submitCheckIn failed: invalid check-in response');
    }
    recordRemoteSuccess('checkin_submit');
    return mapped;
  }

  async getProgress(userId: string): Promise<ProgressData> {
    const client = this.getClient();
    const {
      data: { user },
      error: authError,
    } = await client.auth.getUser();
    if (authError || !user) {
      throw new Error('RemoteDeriveService.getProgress failed: unauthenticated');
    }
    if (userId && userId !== user.id) {
      throw new Error('RemoteDeriveService.getProgress failed: user mismatch');
    }

    const { data, error } = await client
      .from('check_ins')
      .select(
        'id, user_id, skin_state, irritation, notes, context_tags, context_note, adherence, primary_goal, ai_analysis_sentence, created_at'
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (error) throw new Error(`RemoteDeriveService.getProgress failed: ${error.message}`);

    const checkIns: CheckIn[] = (data || [])
      .map((row: DbCheckInRow) => mapDbCheckIn(row))
      .filter((row: CheckIn | null): row is CheckIn => row !== null);

    const { data: publishedRoutine, error: routineError } = await client
      .from('routines')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'published')
      .limit(1)
      .maybeSingle();
    if (routineError) {
      throw new Error(`RemoteDeriveService.getProgress failed: ${routineError.message}`);
    }

    return {
      checkIns,
      // B4B: no durable learned-insight table yet. Do not invent insights in Remote.
      learnedInsights: [],
      // Private check-in photos still lack a JWT-bound signer; do not leak storage paths.
      recentPhotos: [],
      routineHistorySummary: publishedRoutine
        ? 'A published managed routine is in place.'
        : 'No published routine yet.',
      isCheckInDue: isCheckInDueFromLatest(checkIns[0]?.createdAt),
    };
  }

  async requestRefill(input: RefillRequestInput): Promise<RefillRequest> {
    const client = this.getClient();
    const { data, error } = await client
      .from('refill_requests')
      .insert({
        user_id: input.userId,
        product_id: input.productId,
        product_name: input.productName,
        brand: input.brand,
        request_note: input.note,
      })
      .select(
        'id, user_id, product_id, product_name, brand, status, requested_at, shipped_at, delivered_at, estimated_delivery, carrier, tracking_number, tracking_url',
      )
      .single();
    if (error) {
      recordRemoteFailure('refill_request', error);
      throw new Error(`RemoteDeriveService.requestRefill failed: ${error.message}`);
    }
    recordRemoteSuccess('refill_request');
    return mapDbRefillRequest(data);
  }

  async getOrders(userId: string): Promise<RefillRequest[]> {
    const client = this.getClient();
    const { data, error } = await client
      .from('refill_requests')
      .select(
        'id, user_id, product_id, product_name, brand, status, requested_at, shipped_at, delivered_at, estimated_delivery, carrier, tracking_number, tracking_url',
      )
      .eq('user_id', userId)
      .order('requested_at', { ascending: false });
    if (error) throw new Error(`RemoteDeriveService.getOrders failed: ${error.message}`);
    return (data || []).map(mapDbRefillRequest);
  }

  async getResearchInsights(userId: string): Promise<ResearchInsight[]> {
    const client = this.getClient();
    const { data, error } = await client
      .from('research_insights')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new Error(`RemoteDeriveService.getResearchInsights failed: ${error.message}`);
    return (data || []) as unknown as ResearchInsight[];
  }

  async getRoutine(userId: string): Promise<RoutinePlan | null> {
    const client = this.getClient();
    const { data: routineRow, error: routineError } = await client
      .from('routines')
      .select('id, user_id, version, status, summary_sentence, created_at, updated_at, published_at')
      .eq('user_id', userId)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (routineError) {
      throw new Error(`RemoteDeriveService.getRoutine failed: ${routineError.message}`);
    }
    if (!routineRow) return null;

    const { data: itemData, error: itemError } = await client
      .from('routine_items')
      .select(
        'id, routine_id, order_index, timing, product_id, product_name, brand, category, amount, area, days, purpose, why_chosen, watch_for',
      )
      .eq('routine_id', routineRow.id)
      .order('order_index', { ascending: true });
    if (itemError) {
      throw new Error(`RemoteDeriveService.getRoutine failed querying items: ${itemError.message}`);
    }

    return mapDbRoutine(routineRow, itemData || []);
  }

  async getUserProducts(userId: string): Promise<UserProduct[]> {
    const client = this.getClient();
    const { data: rows, error } = await client
      .from('user_products')
      .select(`
        id,
        user_id,
        product_id,
        detected_brand,
        detected_name,
        action,
        action_reason,
        frequency_nights_per_week,
        is_confirmed_by_user,
        created_at,
        products (
          id,
          brand,
          name,
          category,
          key_actives,
          full_ingredients,
          retail_price_approx,
          is_catalog_standard
        )
      `)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`RemoteDeriveService.getUserProducts failed: ${error.message}`);
    }

    return (rows || []).map((row: any): UserProduct => {
      if (!row.product_id || !row.products) {
        throw new Error(
          'RemoteDeriveService.getUserProducts cannot map a shelf item without a canonical product',
        );
      }

      return {
        id: row.id,
        userId: row.user_id,
        productId: row.product_id,
        action: row.action as RoutineAction,
        actionReason: row.action_reason || '',
        frequencyNightsPerWeek: row.frequency_nights_per_week ?? undefined,
        isConfirmedByUser: row.is_confirmed_by_user === true,
        product: {
          id: row.products.id,
          isCatalogStandard: row.products.is_catalog_standard === true,
          brand: row.products.brand,
          name: row.products.name,
          category: row.products.category as ProductCategory,
          keyActives: row.products.key_actives || [],
          fullIngredients: row.products.full_ingredients || [],
          retailPriceApprox: row.products.retail_price_approx
            ? Number(row.products.retail_price_approx)
            : undefined,
        },
      };
    });
  }

  async getCustomerProfile(userId: string): Promise<CustomerProfile | null> {
    const client = this.getClient();
    const { data, error } = await client
      .from('profiles')
      .select(
        'id, email, full_name, phone, created_at, updated_at, memberships(id, user_id, tier, status, created_at, last_stripe_event_created_at)',
      )
      .eq('id', userId)
      .maybeSingle();
    if (error) throw new Error(`RemoteDeriveService.getCustomerProfile failed: ${error.message}`);
    return mapDbCustomerProfile(data);
  }

  async getCustomerBootstrapState(userId: string): Promise<CustomerBootstrapState> {
    const client = this.getClient();

    // 1. Check profile row existence under RLS
    const { data: profileData, error: profileError } = await client
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      throw new Error(`RemoteDeriveService.getCustomerBootstrapState failed querying profile: ${profileError.message}`);
    }

    if (!profileData) {
      return mapDbBootstrapState(userId, null, null, null);
    }

    // 2. Query canonical onboarding completion from skin_profiles
    const { data: skinProfileData, error: skinProfileError } = await client
      .from('skin_profiles')
      .select('onboarding_completed')
      .eq('user_id', userId)
      .maybeSingle();

    if (skinProfileError) {
      throw new Error(`RemoteDeriveService.getCustomerBootstrapState failed querying skin profile: ${skinProfileError.message}`);
    }

    // 3. Match S5's canonical ordering: latest Stripe event, then row creation.
    const { data: membershipData, error: membershipError } = await client
      .from('memberships')
      .select('status, created_at, last_stripe_event_created_at')
      .eq('user_id', userId)
      .order('last_stripe_event_created_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (membershipError) {
      throw new Error(`RemoteDeriveService.getCustomerBootstrapState failed querying membership: ${membershipError.message}`);
    }

    return mapDbBootstrapState(userId, profileData, skinProfileData, membershipData);
  }
}

/**
 * Maps a routine header plus its immutable step snapshot into the frozen
 * shared domain contract. Unrepresentable rows fail closed instead of
 * fabricating product IDs or schedule semantics.
 */
export function mapDbRoutine(
  routineRow: DbRoutineRow,
  itemRows: DbRoutineItemRow[],
): RoutinePlan {
  if (!routineRow?.id || !routineRow.user_id || !Number.isInteger(routineRow.version)) {
    throw new Error('RemoteDeriveService.getRoutine received an invalid routine header');
  }
  if (!ROUTINE_STATUSES.has(routineRow.status as RoutineStatus)) {
    throw new Error('RemoteDeriveService.getRoutine received an unsupported routine status');
  }
  if (!routineRow.created_at || !routineRow.updated_at) {
    throw new Error('RemoteDeriveService.getRoutine received incomplete routine timestamps');
  }

  const steps = itemRows.map((row): RoutineStep => {
    if (row.routine_id !== routineRow.id) {
      throw new Error('RemoteDeriveService.getRoutine received a step for another routine');
    }
    if (!row.product_id) {
      throw new Error('RemoteDeriveService.getRoutine cannot map a step without a canonical product');
    }
    if (row.timing !== 'am' && row.timing !== 'pm') {
      throw new Error('RemoteDeriveService.getRoutine received an unsupported step timing');
    }
    if (!PRODUCT_CATEGORIES.has(row.category as ProductCategory)) {
      throw new Error('RemoteDeriveService.getRoutine received an unsupported product category');
    }

    const days = row.days || [];
    if (days.some((day) => !ROUTINE_DAYS.has(day))) {
      throw new Error('RemoteDeriveService.getRoutine received an unsupported schedule day');
    }

    const step: RoutineStep = {
      id: row.id,
      order: row.order_index,
      productId: row.product_id,
      productName: row.product_name,
      brand: row.brand,
      category: row.category as ProductCategory,
      amount: row.amount,
      area: row.area,
      timing: row.timing,
      days: days as RoutineStep['days'],
      purpose: row.purpose,
      whyChosen: row.why_chosen,
      watchFor: row.watch_for || undefined,
    };

    return {
      ...step,
      scheduleText: formatRoutineStepSchedule(step),
    };
  });

  const byOrder = (a: RoutineStep, b: RoutineStep) => a.order - b.order;

  return {
    id: routineRow.id,
    userId: routineRow.user_id,
    version: routineRow.version,
    status: routineRow.status as RoutineStatus,
    summarySentence: routineRow.summary_sentence,
    amSteps: steps.filter((step) => step.timing === 'am').sort(byOrder),
    pmSteps: steps.filter((step) => step.timing === 'pm').sort(byOrder),
    createdAt: routineRow.created_at,
    updatedAt: routineRow.updated_at,
    publishedAt: routineRow.published_at || undefined,
  };
}

/** Maps persisted refill rows from snake_case without unsafe casting. */
export function mapDbRefillRequest(row: DbRefillRequestRow): RefillRequest {
  if (!row?.id || !row.user_id || !row.product_id || !row.requested_at) {
    throw new Error('RemoteDeriveService received an incomplete refill record');
  }
  if (!REFILL_STATUSES.has(row.status as RefillStatus)) {
    throw new Error('RemoteDeriveService received an unsupported refill status');
  }

  return {
    id: row.id,
    userId: row.user_id,
    productId: row.product_id,
    productName: row.product_name,
    brand: row.brand,
    status: row.status as RefillStatus,
    requestedAt: row.requested_at,
    shippedAt: row.shipped_at || undefined,
    deliveredAt: row.delivered_at || undefined,
    estimatedDelivery: row.estimated_delivery || undefined,
    carrier: row.carrier || undefined,
    trackingNumber: row.tracking_number || undefined,
    trackingUrl: row.tracking_url || undefined,
  };
}

interface MembershipOrderRow {
  created_at?: string | null;
  last_stripe_event_created_at?: string | null;
}

function compareCurrentMembership(a: MembershipOrderRow, b: MembershipOrderRow): number {
  const instant = (value?: string | null) => value ? Date.parse(value) : Number.NEGATIVE_INFINITY;
  const eventA = instant(a.last_stripe_event_created_at);
  const eventB = instant(b.last_stripe_event_created_at);
  if (eventA !== eventB) return eventA > eventB ? -1 : 1;
  const createdA = instant(a.created_at);
  const createdB = instant(b.created_at);
  return createdA === createdB ? 0 : createdA > createdB ? -1 : 1;
}

/** Pure mapping helper: maps raw database rows to canonical CustomerBootstrapState. */
export function mapDbBootstrapState(
  userId: string,
  profileRow: { id: string } | null,
  skinProfileRow: { onboarding_completed?: boolean | null } | null,
  membershipRows: Array<MembershipOrderRow & { status?: string | null }> | (MembershipOrderRow & { status?: string | null }) | null
): CustomerBootstrapState {
  if (!profileRow) {
    return {
      userId,
      profileExists: false,
      onboardingCompleted: false,
      membershipStatus: 'none',
    };
  }

  const onboardingCompleted = skinProfileRow?.onboarding_completed === true;

  const rawMemberships = Array.isArray(membershipRows)
    ? (membershipRows.length > 1
        ? [...membershipRows].sort(compareCurrentMembership)
        : membershipRows)
    : (membershipRows ? [membershipRows] : []);

  const latestMembership = rawMemberships[0];
  let membershipStatus: 'active' | 'paused' | 'cancelled' | 'none' = 'none';
  if (
    latestMembership?.status === 'active' ||
    latestMembership?.status === 'paused' ||
    latestMembership?.status === 'cancelled'
  ) {
    membershipStatus = latestMembership.status;
  }

  return {
    userId,
    profileExists: true,
    onboardingCompleted,
    membershipStatus,
  };
}

export { mapDbCheckIn, mapCheckInResult } from '../../domain/checkIn.ts';

function createRequestId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  // Idempotency correlation only; authorization is provided by the member JWT.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export function mapHostedMembershipSession(
  data: unknown,
  kind: 'checkout' | 'portal',
): HostedMembershipSession {
  if (!data || typeof data !== 'object' || typeof (data as { url?: unknown }).url !== 'string') {
    throw new Error(`RemoteDeriveService received an invalid ${kind} response`);
  }

  let url: URL;
  try {
    url = new URL((data as { url: string }).url);
  } catch {
    throw new Error(`RemoteDeriveService received an invalid ${kind} URL`);
  }
  if (url.protocol !== 'https:') {
    throw new Error(`RemoteDeriveService received an insecure ${kind} URL`);
  }
  return { url: url.toString() };
}

/**
 * Pure mapping helper: maps raw database profile + membership rows to canonical CustomerProfile.
 * Returns null if profile is absent, or if membership is missing / unrepresentable under frozen contract.
 */
export function mapDbCustomerProfile(data: {
  id: string;
  email: string;
  full_name?: string | null;
  phone?: string | null;
  created_at: string;
  updated_at: string;
  memberships?: Array<MembershipOrderRow & { id: string; user_id: string; tier?: string | null; status?: string | null }> | (MembershipOrderRow & { id: string; user_id: string; tier?: string | null; status?: string | null }) | null;
} | null): CustomerProfile | null {
  if (!data) return null;

  const rawMemberships = Array.isArray(data.memberships)
    ? [...data.memberships].sort(compareCurrentMembership)
    : (data.memberships ? [data.memberships] : []);

  const latest = rawMemberships[0];

  // If there is no membership or the tier is not the canonical price-neutral identity,
  // fail closed rather than fabricating an arbitrary tier.
  if (!latest || latest.tier !== 'founding_beta') {
    return null;
  }

  const status = latest.status;
  if (status !== 'active' && status !== 'paused' && status !== 'cancelled') {
    return null;
  }

  return {
    id: data.id,
    email: data.email,
    fullName: data.full_name || '',
    phone: data.phone || undefined,
    tier: 'founding_beta',
    membershipStatus: status,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}
