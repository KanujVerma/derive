import type {
  FreeCheckEntry, FreeContextItem, FreeContextPage, FreeContextRequest, FreeExperienceEntry, FreeSavedProduct,
} from '../../contracts/FreeContext.ts';
import { supabase } from '../supabase.ts';

type FunctionClient = {
  functions: { invoke: (name: string, options: { body: object }) => Promise<{ data: unknown; error: unknown }> };
};

async function invoke(request: FreeContextRequest, client: FunctionClient = supabase as FunctionClient): Promise<Record<string, unknown>> {
  if (!client) throw new Error('Supabase client is not configured');
  const { data, error } = await client.functions.invoke('free-context', { body: request });
  if (error || !data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Free context is unavailable');
  return data as Record<string, unknown>;
}

function entry<T>(value: unknown): T {
  if (!value || typeof value !== 'object' || Array.isArray(value) || typeof (value as Record<string, unknown>).id !== 'string') {
    throw new Error('Free context is unavailable');
  }
  return value as T;
}

async function page<T extends FreeContextItem>(section: 'products' | 'checks' | 'experiences',
  limit = 20, cursor?: string, client?: FunctionClient): Promise<FreeContextPage<T>> {
  const result = await invoke({ operation: 'list', section, limit, ...(cursor ? { cursor } : {}) }, client);
  if (!Array.isArray(result.items) || result.items.some((item) => !item || typeof item.id !== 'string')
    || (result.nextCursor !== null && typeof result.nextCursor !== 'string')) {
    throw new Error('Free context is unavailable');
  }
  return result as unknown as FreeContextPage<T>;
}

export const listFreeProducts = (limit?: number, cursor?: string, client?: FunctionClient) =>
  page<FreeSavedProduct>('products', limit, cursor, client);
export const listFreeChecks = (limit?: number, cursor?: string, client?: FunctionClient) =>
  page<FreeCheckEntry>('checks', limit, cursor, client);
export const listFreeExperiences = (limit?: number, cursor?: string, client?: FunctionClient) =>
  page<FreeExperienceEntry>('experiences', limit, cursor, client);

export async function saveFreeProduct(request: Extract<FreeContextRequest, { operation: 'save_product' }>, client?: FunctionClient) {
  return entry<FreeSavedProduct>((await invoke(request, client)).product);
}
export async function setFreeProductState(id: string, state: FreeSavedProduct['state'], client?: FunctionClient) {
  return entry<FreeSavedProduct>((await invoke({ operation: 'set_product_state', id, state }, client)).product);
}
export async function deleteFreeProduct(id: string, client?: FunctionClient) {
  return invoke({ operation: 'delete_product', id }, client);
}
export async function recordFreeCheck(request: Extract<FreeContextRequest, { operation: 'record_check' }>, client?: FunctionClient) {
  return entry<FreeCheckEntry>((await invoke(request, client)).check);
}
export async function recordFreeExperience(request: Extract<FreeContextRequest, { operation: 'record_experience' }>, client?: FunctionClient) {
  return entry<FreeExperienceEntry>((await invoke(request, client)).experience);
}
export async function deleteFreeEntry(section: 'checks' | 'experiences', id: string, client?: FunctionClient) {
  return invoke({ operation: 'delete_entry', section, id }, client);
}
