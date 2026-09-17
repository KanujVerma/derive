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
  RoutinePlan,
} from '../../domain/types.ts';
import { supabase } from '../supabase.ts';

export class RemoteDeriveService implements IDeriveService {
  private getClient() {
    if (!supabase) {
      throw new Error('Supabase client is not configured. Set EXPO_PUBLIC_SUPABASE_URL and anon key.');
    }
    return supabase;
  }

  async onboard(payload: OnboardingPayload): Promise<OnboardingResult> {
    const client = this.getClient();
    const { data, error } = await client.functions.invoke('onboard-customer', {
      body: payload,
    });
    if (error) throw new Error(`RemoteDeriveService.onboard failed: ${error.message}`);
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
    return data as unknown as CustomerProfile | null;
  }
}
