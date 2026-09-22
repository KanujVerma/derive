/** Version 1: only these event names and derived, bounded properties may leave the app. */
export const TELEMETRY_SCHEMA_VERSION = 1;

const STAGES = ['goals', 'preferences', 'your_skin', 'products', 'photos', 'review'] as const;
const DURATIONS = ['under_30s', '30_60s', '1_3min', 'over_3min'] as const;
const VERDICTS = ['great_fit', 'could_work', 'not_needed', 'better_as_replacement', 'use_with_caution', 'not_good_fit'] as const;
const RESOLUTION_STATES = ['verified_product_formula', 'identified_formula_unverified', 'ambiguous_candidates', 'formula_only', 'insufficient_evidence'] as const;

export const DIAGNOSTIC_OPERATIONS = [
  'auth', 'onboarding_prepare', 'onboarding_upload', 'onboarding_commit',
  'routine_propose', 'routine_read', 'catalog_search', 'product_resolve',
  'product_scan', 'ask', 'checkin_submit', 'refill_request',
] as const;
export type DiagnosticOperation = typeof DIAGNOSTIC_OPERATIONS[number];

export const DIAGNOSTIC_CODES = [
  'NETWORK_UNAVAILABLE', 'AUTH_REQUIRED', 'MEMBERSHIP_REQUIRED',
  'INVALID_INPUT', 'PHOTO_UPLOAD_FAILED', 'CATALOG_UNAVAILABLE',
  'RESOLUTION_UNAVAILABLE', 'MODEL_UNAVAILABLE', 'SERVER_UNAVAILABLE',
  'INVALID_RESPONSE', 'UNKNOWN',
] as const;
export type DiagnosticCode = typeof DIAGNOSTIC_CODES[number];

export interface TelemetryEvent {
  event: string;
  properties: Record<string, string | number | boolean>;
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

function choice<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? value as T : undefined;
}

function required<T extends string>(props: Record<string, unknown>, key: string, values: readonly T[]): T | null {
  return choice(props[key], values) ?? null;
}

function result(event: string, properties: Record<string, string | number | boolean> = {}): TelemetryEvent {
  return { event, properties: { schema_version: TELEMETRY_SCHEMA_VERSION, ...properties } };
}

/**
 * Runtime boundary. Deliberately ignores old caller fields such as productName,
 * productId, insightId, barcode, notes, and free-form provider error messages.
 * It is also used as the final PostHog before_send gate.
 */
export function sanitizeTelemetryEvent(event: unknown, input: unknown): TelemetryEvent | null {
  if (typeof event !== 'string') return null;
  const props = object(input);
  switch (event) {
    case 'app_opened': {
      const platform = required(props, 'platform', ['ios', 'android', 'web']);
      return platform ? result(event, { platform }) : null;
    }
    case 'onboarding_started': {
      const entryPoint = choice(props.entryPoint ?? props.entry_point, ['welcome_cta', 'founder_assist']);
      return entryPoint ? result(event, { entry_point: entryPoint }) : null;
    }
    case 'onboarding_stage_viewed':
    case 'onboarding_stage_completed': {
      const stage = required(props, 'stage', STAGES);
      if (!stage) return null;
      const duration = choice(props.durationBucket ?? props.duration_bucket, DURATIONS);
      return result(event, duration && event === 'onboarding_stage_completed'
        ? { stage, duration_bucket: duration } : { stage });
    }
    case 'onboarding_completed': {
      const n = props.productCount;
      const productCountBucket = choice(props.product_count_bucket, ['0', '1', '2_3', '4_plus', 'unknown']) ?? (typeof n === 'number' && Number.isInteger(n) && n >= 0
        ? n === 0 ? '0' : n === 1 ? '1' : n <= 3 ? '2_3' : '4_plus'
        : 'unknown');
      return result(event, { product_count_bucket: productCountBucket });
    }
    case 'routine_viewed': {
      const source = required(props, 'source', ['today_cta', 'tab_navigation']);
      return source ? result(event, { source }) : null;
    }
    case 'plan_tab_switched': {
      const tab = choice(props.activeTab ?? props.active_tab, ['routine', 'products']);
      return tab ? result(event, { active_tab: tab }) : null;
    }
    case 'product_scan_started': {
      const entryPoint = choice(props.entryPoint ?? props.entry_point, ['starter_pill', 'composer_button']);
      return entryPoint ? result(event, { entry_point: entryPoint }) : null;
    }
    case 'product_scan_completed':
      return typeof props.success === 'boolean' ? result(event, { success: props.success }) : null;
    case 'scan_tab_opened': {
      const source = required(props, 'source', ['tab_navigation', 'ask_handoff', 'today_shortcut']);
      return source ? result(event, { source }) : null;
    }
    case 'scan_verdict_viewed':
    case 'scan_ask_handoff': {
      const verdict = choice(props.verdict, VERDICTS);
      return result(event, verdict ? { verdict } : {});
    }
    case 'shop_opened':
      return props.source === 'tab_navigation' ? result(event, { source: 'tab_navigation' }) : null;
    case 'shop_scan_opened': {
      const source = required(props, 'source', ['shop_home', 'shop_tab', 'today_shortcut']);
      if (!source) return null;
      const entryPoint = choice(props.entryPoint ?? props.entry_point, ['ask_starter_pill', 'shop_cta']);
      return result(event, entryPoint ? { source, entry_point: entryPoint } : { source });
    }
    case 'shop_product_viewed': {
      const source = required(props, 'source', ['shop_home', 'plan_tab', 'today_module']);
      return source ? result(event, { source }) : null;
    }
    case 'orders_opened': {
      const source = required(props, 'source', ['shop_home', 'today_banner', 'tab_navigation']);
      return source ? result(event, { source }) : null;
    }
    case 'membership_shop_upsell_viewed': {
      const audience = required(props, 'audience', ['guest', 'non_member']);
      return audience ? result(event, { audience }) : null;
    }
    case 'product_purchase_intent': {
      const action = required(props, 'action', ['ADD', 'KEEP']);
      return action ? result(event, { action }) : null;
    }
    case 'external_purchase_opened':
      return props.entryPoint === 'product_detail' || props.entry_point === 'product_detail'
        ? result(event, { entry_point: 'product_detail' }) : null;
    case 'catalog_search_completed': {
      const count = choice(props.resultCountBucket ?? props.result_count_bucket, ['zero', 'one', 'few', 'many']);
      const duration = choice(props.durationBucket ?? props.duration_bucket, DURATIONS);
      return count && duration ? result(event, { result_count_bucket: count, duration_bucket: duration }) : null;
    }
    case 'product_check_resolved': {
      const mode = choice(props.inputMode ?? props.input_mode, ['search', 'barcode', 'identity_case']);
      const state = choice(props.identityState ?? props.identity_state, RESOLUTION_STATES);
      return mode && state ? result(event, { input_mode: mode, identity_state: state }) : null;
    }
    case 'diagnostic_operation': {
      const operation = required(props, 'operation', DIAGNOSTIC_OPERATIONS);
      const outcome = required(props, 'outcome', ['success', 'failure']);
      const code = choice(props.errorCode ?? props.error_code, DIAGNOSTIC_CODES);
      if (!operation || !outcome || (outcome === 'failure' && !code)) return null;
      return result(event, outcome === 'failure' ? { operation, outcome, error_code: code! } : { operation, outcome });
    }
    case 'today_viewed':
    case 'checkin_started':
    case 'checkin_completed':
    case 'refill_requested':
    case 'ask_message_sent':
    case 'research_insight_viewed':
    case 'product_scan_recognized':
    case 'voice_input_started':
    case 'voice_input_completed':
      return result(event);
    default:
      return null;
  }
}
