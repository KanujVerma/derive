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
  RoutinePlan,
  RoutineStep,
  ProductCategory,
  UserProduct,
  RoutineAction,
  RoutineStatus,
  RefillStatus,
} from '../../domain/types.ts';
import { formatRoutineStepSchedule } from '../../types/schema.ts';
import { supabase } from '../supabase.ts';
import { uploadPhotoToStorage } from '../onboardingPhotoUpload.ts';

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

  async onboard(payload: OnboardingPayload): Promise<OnboardingResult> {
    const client = this.getClient();

    // 1. Prepare onboarding submission and retrieve opaque server-issued upload targets
    const { data: prepareData, error: prepareError } = await client.functions.invoke(
      'prepare-onboarding',
      { body: {} }
    );
    if (prepareError || !prepareData?.submissionId) {
      throw new Error(
        `RemoteDeriveService.onboard failed in prepare-onboarding: ${prepareError?.message || 'Invalid prepare response'}`
      );
    }

    const { submissionId, uploadTargets } = prepareData;

    // 2. Upload private skin photos directly to server-issued storage targets
    const frontUri = payload.skinPhotos?.frontUri;
    const leftUri = payload.skinPhotos?.leftUri;
    const rightUri = payload.skinPhotos?.rightUri;
    const shelfUri = payload.skinPhotos?.shelfUri;

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

    // 3. Commit intake with onboard-customer (sanitizing client-local URIs)
    const { skinPhotos, ...restPayload } = payload;
    const sanitizedPayload = {
      ...restPayload,
      skinPhotos: {
        contextNote: skinPhotos?.contextNote,
      },
    };

    const { data, error } = await client.functions.invoke('onboard-customer', {
      body: {
        submissionId,
        payload: sanitizedPayload,
      },
    });

    if (error || !data) {
      throw new Error(
        `RemoteDeriveService.onboard failed in onboard-customer: ${error?.message || 'Empty response'}`
      );
    }

    return data as OnboardingResult;
  }

  async proposeRoutine(input: RoutineProposalInput): Promise<RoutineProposalResult> {
    const client = this.getClient();
    const { data, error } = await client.functions.invoke('propose-routine', {
      body: input,
    });
    if (error) throw new Error(`RemoteDeriveService.proposeRoutine failed: ${error.message}`);
    return data as RoutineProposalResult;
  }

  async askDerive(request: AskRequest): Promise<AskResponse> {
    const client = this.getClient();
    const { data, error } = await client.functions.invoke('ask-derive', {
      body: request,
    });
    if (error) throw new Error(`RemoteDeriveService.askDerive failed: ${error.message}`);
    return data as AskResponse;
  }

  async scanProduct(input: ScanProductInput): Promise<ProductScanResult> {
    const client = this.getClient();
    const { data, error } = await client.functions.invoke('scan-product', {
      body: input,
    });
    if (error) throw new Error(`RemoteDeriveService.scanProduct failed: ${error.message}`);
    return data as ProductScanResult;
  }

  async submitCheckIn(input: CheckInInput): Promise<CheckInResult> {
    const client = this.getClient();
    const { data, error } = await client.functions.invoke('submit-checkin', {
      body: input,
    });
    if (error) throw new Error(`RemoteDeriveService.submitCheckIn failed: ${error.message}`);
    return data as CheckInResult;
  }

  async getProgress(userId: string): Promise<ProgressData> {
    const client = this.getClient();
    const { data, error } = await client.functions.invoke('get-progress', {
      body: { userId },
    });
    if (error) throw new Error(`RemoteDeriveService.getProgress failed: ${error.message}`);
    return data as ProgressData;
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
    if (error) throw new Error(`RemoteDeriveService.requestRefill failed: ${error.message}`);
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
        'id, email, full_name, phone, created_at, updated_at, memberships(id, user_id, tier, status, created_at)',
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

    // 3. Query current membership status deterministically (latest by created_at)
    const { data: membershipData, error: membershipError } = await client
      .from('memberships')
      .select('status, created_at')
      .eq('user_id', userId)
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

/**
 * Pure mapping helper: maps raw database rows to canonical CustomerBootstrapState.
 */
export function mapDbBootstrapState(
  userId: string,
  profileRow: { id: string } | null,
  skinProfileRow: { onboarding_completed?: boolean | null } | null,
  membershipRows: Array<{ status?: string | null; created_at?: string | null }> | { status?: string | null; created_at?: string | null } | null
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
        ? [...membershipRows].sort((a, b) => {
            const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
            const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
            return timeB - timeA;
          })
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
  memberships?: Array<{ id: string; user_id: string; tier?: string | null; status?: string | null; created_at: string }> | { id: string; user_id: string; tier?: string | null; status?: string | null; created_at: string } | null;
} | null): CustomerProfile | null {
  if (!data) return null;

  const rawMemberships = Array.isArray(data.memberships)
    ? [...data.memberships].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    : (data.memberships ? [data.memberships] : []);

  const latest = rawMemberships[0];

  // If there is no membership or the tier is not representable under the frozen contract,
  // we return null rather than fabricating an arbitrary tier.
  if (!latest || latest.tier !== 'founding_beta_129') {
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
    tier: 'founding_beta_129',
    membershipStatus: status,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}
