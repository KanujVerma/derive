/**
 * Derive Privacy-Safe Telemetry (PostHog Client)
 *
 * Strict Privacy Contract:
 * - Allowlisted typed events ONLY.
 * - ZERO transmission of health details, photos, image URIs, prescriptions,
 *   reaction notes, raw chat text, or medical data.
 * - Session Replay is OFF by default.
 */

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
}

class PrivacySafeAnalytics {
  private isSessionReplayEnabled = false; // Off by default

  /**
   * Track an allowlisted behavioral event with sanitized, primitive properties.
   */
  track<E extends keyof AllowedAnalyticsEvents>(
    event: E,
    properties: AllowedAnalyticsEvents[E]
  ): void {
    // In production, this proxies to PostHog SDK
    // Here we ensure strictly typed payloads and log in dev mode
    const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';
    if (isDev) {
      console.log(`[Analytics: ${event}]`, properties);
    }
  }


  /**
   * Session replay is strictly kept OFF during beta
   */
  isReplayActive(): boolean {
    return this.isSessionReplayEnabled;
  }
}

export const analytics = new PrivacySafeAnalytics();
