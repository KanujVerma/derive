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
} from '../../domain/types.ts';
import { supabase } from '../supabase.ts';
import { uploadPhotoToStorage } from '../onboardingPhotoUpload.ts';

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
      throw new Error('Supabase client is not configured. Set EXPO_PUBLIC_SUPABASE_URL and anon key.');
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
    const { data, error } = await client.functions.invoke('request-refill', {
      body: input,
    });
    if (error) throw new Error(`RemoteDeriveService.requestRefill failed: ${error.message}`);
    return data as RefillRequest;
  }

  async getOrders(userId: string): Promise<RefillRequest[]> {
    const client = this.getClient();
    const { data, error } = await client
      .from('refill_requests')
      .select('id, user_id, product_name, brand, status, tracking_number, requested_at, shipped_at')
      .eq('user_id', userId)
      .order('requested_at', { ascending: false });
    if (error) throw new Error(`RemoteDeriveService.getOrders failed: ${error.message}`);
    return (data || []) as unknown as RefillRequest[];
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
    const { data, error } = await client
      .from('routines')
      .select('id, user_id, version, status, summary_sentence, created_at, published_at')
      .eq('user_id', userId)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`RemoteDeriveService.getRoutine failed: ${error.message}`);
    return data as unknown as RoutinePlan | null;
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
