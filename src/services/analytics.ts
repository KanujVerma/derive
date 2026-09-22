/**
 * Derive privacy-safe telemetry. Customer callers keep this narrow facade.
 *
 * Strict Privacy Contract:
 * - Allowlisted typed events ONLY.
 * - ZERO transmission of health details, photos, image URIs, prescriptions,
 *   reaction notes, raw chat text, or medical data.
 * - Session Replay is OFF by default.
 */

import { useAuthStore } from '../stores/authStore.ts';
import { sanitizeTelemetryEvent, type TelemetryEvent } from './telemetry/contract.ts';
import type { TelemetrySink } from './telemetry/posthogTransport.ts';

export type OnboardingStageName =
  | 'goals'
  | 'preferences'
  | 'your_skin'
  | 'products'
  | 'photos'
  | 'review';

export interface AllowedAnalyticsEvents {
  app_opened: {
    platform: string;
  };
  onboarding_started: {
    entryPoint: 'welcome_cta' | 'founder_assist';
  };
  onboarding_stage_viewed: {
    stage: OnboardingStageName;
  };
  onboarding_stage_completed: {
    stage: OnboardingStageName;
    durationBucket?: 'under_30s' | '30_60s' | '1_3min' | 'over_3min';
  };
  onboarding_completed: {
    productCount: number;
    hasReactionHistory: boolean;
    hasPhotos: boolean;
  };
  today_viewed: {
    hasCheckInDue: boolean;
    hasRefillBanner: boolean;
    hasResearchInsight: boolean;
  };
  routine_viewed: {
    source: 'today_cta' | 'tab_navigation';
  };
  plan_tab_switched: {
    activeTab: 'routine' | 'products';
  };
  checkin_started: {
    cadenceWeek: number;
  };
  checkin_completed: {
    outcome: 'better' | 'same' | 'worse';
    irritationReported: boolean;
    adherenceReported: boolean;
  };
  refill_requested: {
    productCategory: string;
  };
  ask_message_sent: {
    hasAttachment: boolean;
    queryLengthBucket: 'short' | 'medium' | 'long';
  };
  research_insight_viewed: {
    insightId: string;
    recommendationType: 'no_change' | 'monitor' | 'consider_later' | 'action';
  };
  product_scan_started: {
    entryPoint: 'starter_pill' | 'composer_button';
  };
  product_scan_completed: {
    success: boolean;
  };
  scan_tab_opened: {
    source: 'tab_navigation' | 'ask_handoff' | 'today_shortcut';
  };
  product_scan_recognized: {
    productName: string;
  };
  scan_verdict_viewed: {
    verdict: string;
    productName: string;
  };
  scan_ask_handoff: {
    productName: string;
    verdict: string;
  };
  voice_input_started: {
    context: 'ask' | 'photo_note' | 'reaction_note' | 'checkin_note';
  };
  voice_input_completed: {
    context: 'ask' | 'photo_note' | 'reaction_note' | 'checkin_note';
    wordCountBucket: 'under_10' | '10_30' | 'over_30';
  };
  // C1 Shop events — no health/personal data included
  shop_opened: {
    source: 'tab_navigation';
  };
  shop_scan_opened: {
    source: 'shop_home' | 'shop_tab' | 'today_shortcut';
    entryPoint?: 'ask_starter_pill' | 'shop_cta';
  };
  shop_product_viewed: {
    productId: string;
    productName: string;
    source: 'shop_home' | 'plan_tab' | 'today_module';
  };
  orders_opened: {
    source: 'shop_home' | 'today_banner' | 'tab_navigation';
  };
  membership_shop_upsell_viewed: {
    audience: 'guest' | 'non_member';
  };
  product_purchase_intent: {
    productId: string;
    action: 'ADD' | 'KEEP';
  };
  external_purchase_opened: {
    productId: string;
    merchantId: string;
    entryPoint: 'product_detail';
  };
  catalog_search_completed: {
    resultCountBucket: 'zero' | 'one' | 'few' | 'many';
    durationBucket: 'under_30s' | '30_60s' | '1_3min' | 'over_3min';
  };
  product_check_resolved: {
    inputMode: 'search' | 'barcode' | 'identity_case';
    identityState: 'verified_product_formula' | 'identified_formula_unverified' | 'ambiguous_candidates' | 'formula_only' | 'insufficient_evidence';
  };
  diagnostic_operation: {
    operation: 'auth' | 'onboarding_prepare' | 'onboarding_upload' | 'onboarding_commit'
      | 'routine_propose' | 'routine_read' | 'catalog_search' | 'product_resolve'
      | 'product_scan' | 'ask' | 'checkin_submit' | 'refill_request';
    outcome: 'success' | 'failure';
    errorCode?: 'NETWORK_UNAVAILABLE' | 'AUTH_REQUIRED' | 'MEMBERSHIP_REQUIRED'
      | 'INVALID_INPUT' | 'PHOTO_UPLOAD_FAILED' | 'CATALOG_UNAVAILABLE'
      | 'RESOLUTION_UNAVAILABLE' | 'MODEL_UNAVAILABLE' | 'SERVER_UNAVAILABLE'
      | 'INVALID_RESPONSE' | 'UNKNOWN';
  };
}

function approvedConfiguration(): { projectKey: string; host: string } | null {
  const dev = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';
  if (dev || process.env.EXPO_PUBLIC_USE_REMOTE_SERVICE !== 'true') return null;
  if (process.env.EXPO_PUBLIC_ANALYTICS_ENABLED !== 'true') return null;
  const flavor = process.env.EXPO_PUBLIC_BUILD_FLAVOR;
  if (flavor !== 'remote-staging' && flavor !== 'production') return null;
  const projectKey = process.env.EXPO_PUBLIC_POSTHOG_PROJECT_KEY?.trim() ?? '';
  const host = process.env.EXPO_PUBLIC_POSTHOG_HOST?.trim() ?? '';
  if (!/^phc_[A-Za-z0-9]+$/.test(projectKey)) return null;
  if (host !== 'https://us.i.posthog.com' && host !== 'https://eu.i.posthog.com') return null;
  return { projectKey, host };
}

export class PrivacySafeAnalytics {
  private readonly config: { projectKey: string; host: string } | null;
  private sink: TelemetrySink | null = null;
  private pending: TelemetryEvent[] = [];
  // A build switch does not equal customer consent. The app must call optIn()
  // after its approved privacy choice, on every launch and account transition.
  private disabledLocally = true;
  private requestedOptIn = false;
  private loading = false;

  constructor(config = approvedConfiguration()) {
    this.config = config;
    // Anonymous SDK identity is rotated at every confirmed Auth identity transition.
    // The Auth UUID, email and name are never sent to PostHog.
    useAuthStore.subscribe((state, previous) => {
      if (state.sessionUserId !== previous.sessionUserId) {
        this.pending = [];
        this.disabledLocally = true;
        this.requestedOptIn = false;
        try { this.sink?.reset(); } catch { /* Telemetry cannot affect Auth. */ }
      }
    });
  }

  private start(): void {
    if (!this.config || this.loading || this.sink || this.disabledLocally) return;
    this.loading = true;
    void import('./telemetry/posthogTransport.ts').then(async ({ createPostHogSink }) => {
      this.sink = createPostHogSink(this.config!.projectKey, this.config!.host);
      // Never revive a prior launch/account's persisted anonymous ID or offline queue.
      this.sink.reset();
      if (this.disabledLocally) {
        this.pending = [];
        await this.sink.optOut();
      } else {
        if (this.requestedOptIn) await this.sink.optIn();
        if (!this.disabledLocally && !this.sink.isOptedOut()) {
          for (const event of this.pending) this.sink.capture(event);
        }
        this.pending = [];
      }
    }).catch(() => { this.pending = []; }).finally(() => { this.loading = false; });
  }

  /**
   * Invalid events are dropped. Transport failures never block customer actions.
   */
  track<E extends keyof AllowedAnalyticsEvents>(
    event: E,
    properties: AllowedAnalyticsEvents[E]
  ): void {
    const safe = sanitizeTelemetryEvent(event, properties);
    if (!safe || this.disabledLocally) return;
    if (!this.sink) {
      if (!this.config) return;
      if (this.pending.length < 20) this.pending.push(safe);
      this.start();
      return;
    }
    try {
      if (!this.sink.isOptedOut()) this.sink.capture(safe);
    } catch { /* Analytics is optional. */ }
  }

  /** Customer privacy choice. Persisted opt-out is owned by the SDK. */
  optOut(): void {
    this.disabledLocally = true;
    this.requestedOptIn = false;
    this.pending = [];
    try { void Promise.resolve(this.sink?.optOut()).catch(() => {}); }
    catch { /* Local disable still applies. */ }
  }

  optIn(): void {
    this.disabledLocally = false;
    this.requestedOptIn = true;
    try { void Promise.resolve(this.sink?.optIn()).catch(() => {}); }
    catch { /* No impact on app functionality. */ }
    this.start();
  }

  /** Test injection keeps transport tests independent of the native SDK. */
  setSinkForTesting(sink: TelemetrySink | null): void {
    this.sink = sink;
    this.pending = [];
  }

  isReplayActive(): boolean {
    return false;
  }
}

export const analytics = new PrivacySafeAnalytics();
