import { parseCatalogContribution, type CatalogContributionRequest } from '../../domain/catalog-contribution/proposal.ts';

type FunctionTransport = {
  functions: { invoke: (name: string, options: { body: object }) => Promise<{ data: unknown; error: unknown }> };
};

export interface CatalogContributionReceipt {
  id: string;
  requestId: string;
  status: 'submitted' | 'withdrawn';
  consentVersion: 1;
  consentedAt: string;
  withdrawnAt: string | null;
  createdAt: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FIELDS = ['id', 'requestId', 'status', 'consentVersion', 'consentedAt', 'withdrawnAt', 'createdAt'];

function unavailable(): never { throw new Error('Product request is unavailable'); }

function plainRecord(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return unavailable();
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return unavailable();
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.length !== keys.length || ownKeys.some((key) => typeof key !== 'string'
    || !keys.includes(key) || !Object.hasOwn(descriptors[key], 'value') || !descriptors[key].enumerable)) {
    return unavailable();
  }
  return Object.fromEntries(keys.map((key) => [key, descriptors[key]!.value]));
}

function uuid(value: unknown): string {
  if (typeof value !== 'string' || !UUID.test(value)) return unavailable();
  return value.toLowerCase();
}

function timestamp(value: unknown): string {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) return unavailable();
  return value;
}

function receipt(value: unknown, expected: { requestId?: string; id?: string }): CatalogContributionReceipt {
  const row = plainRecord(value, FIELDS);
  const id = uuid(row.id), requestId = uuid(row.requestId);
  if (expected.id && id !== expected.id || expected.requestId && requestId !== expected.requestId
    || row.consentVersion !== 1 || (row.status !== 'submitted' && row.status !== 'withdrawn')) return unavailable();
  const status = row.status;
  const withdrawnAt = row.withdrawnAt === null ? null : timestamp(row.withdrawnAt);
  if (status === 'submitted' && withdrawnAt !== null || status === 'withdrawn' && withdrawnAt === null) return unavailable();
  return { id, requestId, status, consentVersion: 1, consentedAt: timestamp(row.consentedAt),
    withdrawnAt, createdAt: timestamp(row.createdAt) };
}

/** Transport is injected; no customer screen calls this until consent copy and hosting are approved. */
export function createCatalogContributionClient(transport: FunctionTransport) {
  async function invoke(body: object): Promise<unknown> {
    try {
      const { data, error } = await transport.functions.invoke('catalog-contribution', { body });
      if (error) return unavailable();
      return plainRecord(data, ['contribution']).contribution;
    } catch { return unavailable(); }
  }
  return {
    async submit(request: CatalogContributionRequest, consent: { version: number; purpose: string; accepted: boolean }) {
      const acknowledged = plainRecord(consent, ['version', 'purpose', 'accepted']);
      if (acknowledged.version !== 1 || acknowledged.purpose !== 'catalog_review' || acknowledged.accepted !== true) {
        return unavailable();
      }
      const contribution = parseCatalogContribution(request);
      const result = await invoke({ operation: 'submit', contribution,
        consent: { version: 1, purpose: 'catalog_review', accepted: true } });
      return receipt(result, { requestId: contribution.requestId });
    },
    async status(requestId: string): Promise<CatalogContributionReceipt | null> {
      const validId = uuid(requestId);
      const result = await invoke({ operation: 'status', requestId: validId });
      return result === null ? null : receipt(result, { requestId: validId });
    },
    async withdraw(id: string): Promise<CatalogContributionReceipt> {
      const validId = uuid(id);
      const result = receipt(await invoke({ operation: 'withdraw', id: validId }), { id: validId });
      if (result.status !== 'withdrawn') return unavailable();
      return result;
    },
  };
}
