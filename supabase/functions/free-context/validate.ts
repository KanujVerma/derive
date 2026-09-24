import type { FreeContextRequest, FreeProductReference } from '../../../src/contracts/FreeContext.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATES = new Set(['using', 'considering', 'stopped']);
const KINDS = new Set(['tolerated', 'reacted', 'liked', 'finished']);
const SECTIONS = new Set(['products', 'checks', 'experiences']);

export class FreeContextRequestError extends Error {}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new FreeContextRequestError('A JSON object is required');
  return value as Record<string, unknown>;
}

function fields(value: Record<string, unknown>, required: string[], optional: string[] = []): void {
  if (required.some((key) => !(key in value))
    || Object.keys(value).some((key) => !required.includes(key) && !optional.includes(key))) {
    throw new FreeContextRequestError('Unexpected or missing context fields');
  }
}

function uuid(value: unknown, label: string): string {
  if (typeof value !== 'string' || !UUID.test(value)) throw new FreeContextRequestError(`${label} must be a UUID`);
  return value;
}

function choice(value: unknown, values: Set<string>, label: string): string {
  if (typeof value !== 'string' || !values.has(value)) throw new FreeContextRequestError(`${label} is invalid`);
  return value;
}

function text(value: unknown, label: string, max: number): string {
  if (typeof value !== 'string' || /[\x00-\x1f\x7f]/.test(value)
    || value.trim().length < 1 || value.trim().length > max) {
    throw new FreeContextRequestError(`${label} is invalid`);
  }
  return value.trim().replace(/\s+/g, ' ');
}

function product(value: unknown): FreeProductReference {
  const row = object(value);
  if ('productId' in row) {
    fields(row, ['productId']);
    return { productId: uuid(row.productId, 'productId') };
  }
  fields(row, ['name'], ['brand']);
  return {
    name: text(row.name, 'name', 180),
    ...(row.brand === undefined ? {} : { brand: text(row.brand, 'brand', 120) }),
  };
}

export function parseFreeContextRequest(value: unknown): FreeContextRequest {
  const row = object(value);
  switch (row.operation) {
    case 'list': {
      fields(row, ['operation', 'section'], ['limit', 'cursor']);
      const section = choice(row.section, SECTIONS, 'section') as 'products' | 'checks' | 'experiences';
      if (row.limit !== undefined && (!Number.isInteger(row.limit) || Number(row.limit) < 1 || Number(row.limit) > 50)) {
        throw new FreeContextRequestError('limit must be between 1 and 50');
      }
      const cursor = row.cursor === undefined ? undefined : uuid(row.cursor, 'cursor');
      return { operation: 'list', section, limit: Number(row.limit ?? 20), ...(cursor ? { cursor } : {}) };
    }
    case 'save_product':
      fields(row, ['operation', 'requestId', 'product', 'state']);
      return { operation: 'save_product', requestId: uuid(row.requestId, 'requestId'), product: product(row.product),
        state: choice(row.state, STATES, 'state') as 'using' | 'considering' | 'stopped' };
    case 'set_product_state':
      fields(row, ['operation', 'id', 'state']);
      return { operation: 'set_product_state', id: uuid(row.id, 'id'),
        state: choice(row.state, STATES, 'state') as 'using' | 'considering' | 'stopped' };
    case 'delete_product':
      fields(row, ['operation', 'id']);
      return { operation: 'delete_product', id: uuid(row.id, 'id') };
    case 'record_check':
      fields(row, ['operation', 'requestId'], ['productId', 'caseId']);
      if (('productId' in row) === ('caseId' in row)) throw new FreeContextRequestError('Exactly one check reference is required');
      return 'productId' in row
        ? { operation: 'record_check', requestId: uuid(row.requestId, 'requestId'), productId: uuid(row.productId, 'productId') }
        : { operation: 'record_check', requestId: uuid(row.requestId, 'requestId'), caseId: uuid(row.caseId, 'caseId') };
    case 'record_experience': {
      fields(row, ['operation', 'requestId', 'product', 'kind'], ['note']);
      const note = row.note === undefined ? undefined : text(row.note, 'note', 500);
      return { operation: 'record_experience', requestId: uuid(row.requestId, 'requestId'), product: product(row.product),
        kind: choice(row.kind, KINDS, 'kind') as 'tolerated' | 'reacted' | 'liked' | 'finished',
        ...(note ? { note } : {}) };
    }
    case 'delete_entry': {
      fields(row, ['operation', 'section', 'id']);
      if (row.section !== 'checks' && row.section !== 'experiences') throw new FreeContextRequestError('section is invalid');
      return { operation: 'delete_entry', section: row.section, id: uuid(row.id, 'id') };
    }
    default:
      throw new FreeContextRequestError('Context operation is invalid');
  }
}
