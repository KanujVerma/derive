/**
 * Untrusted product-event payload boundary. This module does not authenticate,
 * persist, count Checks, award referrals, enforce quotas, or export telemetry.
 * The Edge ingress handles Auth and abuse; customer activation still requires
 * approved privacy choice, retention, and disclosure.
 */
export const MAX_PRODUCT_MEASUREMENT_BYTES = 1024;

type FieldRule = readonly string[] | "boolean";

// Intentionally independent of the client runtime allowlist: an untrusted
// client cannot widen what the server accepts. The parity tests catch drift
// when either side changes its V1 contract. Keep this Edge module self-contained.
const EVENT_FIELDS = {
  app_opened: { platform: ["ios", "android", "web", "unknown"] },
  acquisition_touch: { channel: ["direct", "organic", "friend", "creator", "club", "paid", "unknown"] },
  referral_opened: { channel: ["friend", "creator", "club", "unknown"] },
  referral_shared: { channel: ["friend", "creator", "club", "unknown"] },
  check_started: { inputMethod: ["barcode", "search", "photo", "unknown"] },
  check_completed: {
    inputMethod: ["barcode", "search", "photo", "unknown"],
    outcome: ["useful", "unknown_product", "insufficient_evidence", "failed"],
    personalized: "boolean",
  },
  personal_decision_viewed: {},
  my_stuff_viewed: {},
  check_saved: {},
  plus_trigger_reached: { trigger: ["quota", "compare", "shelf_analysis", "history", "research", "other"] },
  paywall_viewed: { source: ["quota", "compare", "shelf_analysis", "history", "research", "other"] },
  plus_plan_selected: { plan: ["monthly", "annual"] },
  plus_purchase_started: { plan: ["monthly", "annual"] },
  managed_viewed: { source: ["check", "plan", "account", "other"] },
  managed_learn_more: { source: ["check", "plan", "account", "other"] },
  managed_interest: { source: ["check", "plan", "account", "other"] },
  experiment_exposed: {
    experiment: ["plus_offer_v1", "managed_early_access_v1"],
    variant: ["control", "treatment"],
  },
} as const satisfies Record<string, Record<string, FieldRule>>;

type ProductEventName = keyof typeof EVENT_FIELDS;
type ProductEventEnvelope = {
  schemaVersion: 1;
  event: ProductEventName;
  properties: Record<string, string | boolean>;
};

function plainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype;
}

function exactFields(value: Record<string, unknown>, names: readonly string[]): boolean {
  const fields = Object.keys(value);
  return fields.length === names.length && fields.every((field) => names.includes(field));
}

/** Parse and copy only the approved V1 fields; never forward the raw JSON. */
export function parseProductMeasurementJson(body: string): ProductEventEnvelope | null {
  if (typeof body !== "string" || body.length > MAX_PRODUCT_MEASUREMENT_BYTES ||
      new TextEncoder().encode(body).byteLength > MAX_PRODUCT_MEASUREMENT_BYTES) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }
  if (!plainRecord(parsed) || !exactFields(parsed, ["schemaVersion", "event", "properties"]) ||
      parsed.schemaVersion !== 1 || typeof parsed.event !== "string" ||
      !Object.prototype.hasOwnProperty.call(EVENT_FIELDS, parsed.event) ||
      !plainRecord(parsed.properties)) return null;

  const event = parsed.event as ProductEventName;
  const rules: Record<string, FieldRule> = EVENT_FIELDS[event];
  if (!exactFields(parsed.properties, Object.keys(rules))) return null;
  const properties: Record<string, string | boolean> = {};
  for (const [field, rule] of Object.entries(rules)) {
    const value = parsed.properties[field];
    if (rule === "boolean" ? typeof value !== "boolean" :
        typeof value !== "string" || !rule.includes(value)) return null;
    properties[field] = value as string | boolean;
  }
  if (event === "check_completed" && properties.outcome !== "useful" &&
      properties.personalized !== false) return null;
  return { schemaVersion: 1, event, properties };
}
