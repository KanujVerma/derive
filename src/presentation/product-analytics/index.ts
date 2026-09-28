/** Client-side product measurement contract. No transport is installed here. */
const EVENT_SCHEMA = {
  app_opened: { platform: ['ios', 'android', 'web', 'unknown'] },
  acquisition_touch: { channel: ['direct', 'organic', 'friend', 'creator', 'club', 'paid', 'unknown'] },
  referral_opened: { channel: ['friend', 'creator', 'club', 'unknown'] },
  referral_shared: { channel: ['friend', 'creator', 'club', 'unknown'] },
  check_started: { inputMethod: ['barcode', 'search', 'photo', 'unknown'] },
  check_completed: {
    inputMethod: ['barcode', 'search', 'photo', 'unknown'],
    outcome: ['useful', 'unknown_product', 'insufficient_evidence', 'failed'],
    personalized: 'boolean',
  },
  my_stuff_viewed: {},
  check_saved: {},
  plus_trigger_reached: { trigger: ['quota', 'compare', 'shelf_analysis', 'history', 'research', 'other'] },
  paywall_viewed: { source: ['quota', 'compare', 'shelf_analysis', 'history', 'research', 'other'] },
  plus_plan_selected: { plan: ['monthly', 'annual'] },
  plus_purchase_started: { plan: ['monthly', 'annual'] },
  managed_viewed: { source: ['check', 'plan', 'account', 'other'] },
  managed_learn_more: { source: ['check', 'plan', 'account', 'other'] },
  managed_interest: { source: ['check', 'plan', 'account', 'other'] },
  experiment_exposed: {
    experiment: ['plus_offer_v1', 'managed_early_access_v1'],
    variant: ['control', 'treatment'],
  },
} as const;

type EventSchema = typeof EVENT_SCHEMA;
export type ProductEventName = keyof EventSchema;
type GeneralEventName = Exclude<ProductEventName, 'check_started' | 'check_completed'>;
type SchemaValue<T> = T extends 'boolean' ? boolean : T extends readonly (infer V)[] ? V : never;
export type ProductEventProperties<E extends ProductEventName> = {
  [K in keyof EventSchema[E]]: SchemaValue<EventSchema[E][K]>;
};
export type ProductEventEnvelope<E extends ProductEventName = ProductEventName> = {
  schemaVersion: 1;
  event: E;
  properties: ProductEventProperties<E>;
};
export type ProductEventSink = (event: ProductEventEnvelope) => void;
export type CheckInputMethod = ProductEventProperties<'check_started'>['inputMethod'];
export type CheckOutcome = ProductEventProperties<'check_completed'>['outcome'];

function snapshotProperties<E extends ProductEventName>(
  event: E,
  properties: unknown
): ProductEventProperties<E> | null {
  try {
    if (properties === null || typeof properties !== 'object' || Array.isArray(properties) ||
        Object.getPrototypeOf(properties) !== Object.prototype) return null;
    const rules: Record<string, readonly string[] | 'boolean'> = EVENT_SCHEMA[event];
    const descriptors = Object.getOwnPropertyDescriptors(properties);
    const fields = Reflect.ownKeys(descriptors);
    if (fields.length !== Object.keys(rules).length) return null;
    const snapshot: Record<string, string | boolean> = {};
    for (const field of fields) {
      if (typeof field !== 'string' || !Object.prototype.hasOwnProperty.call(rules, field)) return null;
      const descriptor = descriptors[field];
      if (!descriptor?.enumerable || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) return null;
      const value: unknown = descriptor.value;
      const rule = rules[field];
      if (rule === 'boolean' ? typeof value !== 'boolean' : !rule.includes(value as string)) return null;
      snapshot[field] = value as string | boolean;
    }
    if (event === 'check_completed' && snapshot.outcome !== 'useful' && snapshot.personalized !== false) {
      return null;
    }
    return snapshot as ProductEventProperties<E>;
  } catch {
    // A Proxy may throw while exposing its prototype, keys, or descriptors.
    return null;
  }
}

/** A caller-owned sink can be installed only after transport and privacy review. */
export function createProductAnalytics(sink?: ProductEventSink) {
  function emit<E extends ProductEventName>(event: E, properties: ProductEventProperties<E>): boolean {
    if (typeof event !== 'string' || !Object.prototype.hasOwnProperty.call(EVENT_SCHEMA, event)) return false;
    const snapshot = snapshotProperties(event, properties);
    if (snapshot === null) return false;
    if (!sink) return false;
    try {
      sink({ schemaVersion: 1, event, properties: snapshot });
      return true;
    } catch {
      // Measurement must never interrupt a customer action.
      return false;
    }
  }

  function track<E extends GeneralEventName>(event: E, properties: ProductEventProperties<E>): boolean {
    if ((event as string) === 'check_started' || (event as string) === 'check_completed') return false;
    return emit(event, properties);
  }

  function beginCheck(inputMethod: CheckInputMethod) {
    const validInput = snapshotProperties('check_started', { inputMethod }) !== null;
    if (validInput) emit('check_started', { inputMethod });
    let completed = false;
    return {
      complete(outcome: CheckOutcome, personalized: boolean): boolean {
        if (completed || !validInput) return false;
        completed = true;
        return emit('check_completed', { inputMethod, outcome, personalized });
      },
    };
  }

  return { track, beginCheck };
}
