/** Pure proposal preparation only. No customer evidence becomes catalog truth here. */
export interface CatalogContributionRequest {
  version: 1;
  intent: 'help_add_product';
  requestId: string;
  product: {
    brand: string;
    name: string;
    gtin?: string;
    variant?: string;
    packageSize?: string;
    region?: string;
  };
  /** Opaque references only. A future service must verify owner, purpose and object existence. */
  evidence?: ReadonlyArray<{ evidenceId: string; role: 'front_label' | 'ingredients' | 'packaging' }>;
}

export class CatalogContributionError extends Error {
  readonly code: 'INVALID_PROPOSAL' | 'IDEMPOTENCY_CONFLICT' | 'BATCH_TOO_LARGE';
  constructor(code: CatalogContributionError['code'] = 'INVALID_PROPOSAL') {
    super(code);
    this.name = 'CatalogContributionError';
    this.code = code;
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ROLES = new Set(['front_label', 'ingredients', 'packaging']);
const MAX_BATCH = 5000;
function fail(): never { throw new CatalogContributionError(); }

/** Reject inherited fields, accessors and non-JSON shapes without invoking getters. */
function record(raw: unknown, required: string[], optional: string[] = []): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fail();
  const prototype = Object.getPrototypeOf(raw);
  if (prototype !== Object.prototype && prototype !== null) return fail();
  const descriptors = Object.getOwnPropertyDescriptors(raw);
  const keys = Reflect.ownKeys(raw);
  if (required.some((key) => !Object.hasOwn(descriptors, key))
    || keys.some((key) => typeof key !== 'string' || ![...required, ...optional].includes(key)
      || !Object.hasOwn(descriptors[key]!, 'value') || !descriptors[key]!.enumerable)) return fail();
  return Object.fromEntries(keys.map((key) => [key, descriptors[key as string]!.value]));
}
function uuid(raw: unknown): string {
  if (typeof raw !== 'string' || !UUID.test(raw)) return fail();
  return raw.toLowerCase();
}
function text(raw: unknown, max: number): string {
  if (typeof raw !== 'string' || raw.length > max || /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/u.test(raw)) return fail();
  const result = raw.normalize('NFKC').trim().replace(/\s+/gu, ' ');
  if (!result || result.length > max) return fail();
  return result;
}
function optionalText(raw: unknown, max: number): string | undefined {
  return raw === undefined ? undefined : text(raw, max);
}

/** Exact digits; unlike barcode extraction, this boundary never strips arbitrary characters. */
export function validateContributionGtin(raw: unknown): string {
  if (typeof raw !== 'string' || !/^(?:[0-9]{8}|[0-9]{12}|[0-9]{13}|[0-9]{14})$/.test(raw)
    || /^0+$/.test(raw)) return fail();
  let sum = 0;
  for (let index = raw.length - 2, multiplier = 3; index >= 0; index--, multiplier = multiplier === 3 ? 1 : 3) {
    sum += Number(raw[index]) * multiplier;
  }
  if (Number(raw.at(-1)) !== (10 - sum % 10) % 10) return fail();
  return raw;
}

export function parseCatalogContribution(raw: unknown): CatalogContributionRequest {
  const row = record(raw, ['version', 'intent', 'requestId', 'product'], ['evidence']);
  if (row.version !== 1 || row.intent !== 'help_add_product') return fail();
  const item = record(row.product, ['brand', 'name'], ['gtin', 'variant', 'packageSize', 'region']);
  const product: CatalogContributionRequest['product'] = { brand: text(item.brand, 120), name: text(item.name, 180) };
  if (item.gtin !== undefined) product.gtin = validateContributionGtin(item.gtin);
  for (const [key, max] of [['variant', 180], ['packageSize', 80], ['region', 12]] as const) {
    const value = optionalText(item[key], max);
    if (value !== undefined) product[key] = value;
  }
  if (product.region !== undefined) {
    product.region = product.region.toUpperCase();
    if (!/^[A-Z]{2}(?:-[A-Z0-9]{1,8})?$/.test(product.region)) return fail();
  }
  let evidence: CatalogContributionRequest['evidence'];
  if (row.evidence !== undefined) {
    if (!Array.isArray(row.evidence) || row.evidence.length > 3) return fail();
    const values = row.evidence;
    const descriptors = Object.getOwnPropertyDescriptors(values);
    if (Reflect.ownKeys(values).some((key) => key !== 'length'
      && (typeof key !== 'string' || !/^(0|1|2)$/.test(key)
        || !Object.hasOwn(descriptors[key]!, 'value') || !descriptors[key]!.enumerable))) return fail();
    const ids = new Set<string>();
    const roles = new Set<string>();
    evidence = Array.from({ length: values.length }, (_, index) => {
      if (!Object.hasOwn(descriptors, String(index))) return fail();
      const entry = record(descriptors[String(index)]!.value, ['evidenceId', 'role']);
      const evidenceId = uuid(entry.evidenceId);
      if (typeof entry.role !== 'string' || !ROLES.has(entry.role) || ids.has(evidenceId) || roles.has(entry.role)) return fail();
      ids.add(evidenceId); roles.add(entry.role);
      return Object.freeze({ evidenceId, role: entry.role as 'front_label' | 'ingredients' | 'packaging' });
    });
  }
  return Object.freeze({ version: 1, intent: 'help_add_product', requestId: uuid(row.requestId),
    product: Object.freeze(product), ...(evidence === undefined ? {} : { evidence: Object.freeze(evidence) }) });
}

const normalized = (value: string | undefined): string | null => value === undefined ? null : value.toLowerCase();

/** Candidate grouping only: absence is not a wildcard; punctuation and units are not guessed. */
export function contributionCandidateKey(request: CatalogContributionRequest): string {
  const checked = parseCatalogContribution(request);
  const item = checked.product;
  return JSON.stringify(['catalog-proposal-v1', item.gtin ? ['gtin', item.gtin.padStart(14, '0')]
    : ['label', normalized(item.brand), normalized(item.name)], normalized(item.region),
  normalized(item.variant), normalized(item.packageSize)]);
}

export interface CatalogContributionDemand {
  candidateKey: string;
  uniqueContributors: number;
  /** Differing observed names under one GTIN require review, not a majority-vote identity. */
  conflictingObservedLabels: boolean;
  reviewRequired: true;
}

/** Trusted service input, NOT an Auth boundary. Anonymous accounts are not distinct humans. */
export function prioritizeContributionDemand(
  inputs: ReadonlyArray<{ authenticatedOwnerId: string; request: unknown }>,
): ReadonlyArray<CatalogContributionDemand> {
  if (!Array.isArray(inputs) || inputs.length > MAX_BATCH) throw new CatalogContributionError('BATCH_TOO_LARGE');
  const requests = new Map<string, string>();
  const groups = new Map<string, { owners: Set<string>; labels: Set<string> }>();
  for (const input of inputs) {
    const envelope = record(input, ['authenticatedOwnerId', 'request']);
    const ownerId = uuid(envelope.authenticatedOwnerId);
    const request = parseCatalogContribution(envelope.request);
    const replayKey = `${ownerId}:${request.requestId}`;
    const fingerprint = JSON.stringify([request.product, request.evidence ?? []]);
    const prior = requests.get(replayKey);
    if (prior !== undefined && prior !== fingerprint) throw new CatalogContributionError('IDEMPOTENCY_CONFLICT');
    requests.set(replayKey, fingerprint);
    const candidateKey = contributionCandidateKey(request);
    const group = groups.get(candidateKey) ?? { owners: new Set<string>(), labels: new Set<string>() };
    group.owners.add(ownerId);
    group.labels.add(JSON.stringify([normalized(request.product.brand), normalized(request.product.name)]));
    groups.set(candidateKey, group);
  }
  return Object.freeze([...groups.entries()].map(([candidateKey, group]) => Object.freeze({ candidateKey,
    uniqueContributors: group.owners.size, conflictingObservedLabels: group.labels.size > 1, reviewRequired: true as const }))
    .sort((left, right) => right.uniqueContributors - left.uniqueContributors
      || (left.candidateKey < right.candidateKey ? -1 : left.candidateKey > right.candidateKey ? 1 : 0)));
}
