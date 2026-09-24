import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.39.8';
import type { FreeContextRequest, FreeProductReference } from '../../../src/contracts/FreeContext.ts';
import { authenticate, corsHeaders, errorResponse, jsonResponse, readJsonObject, ServiceError } from '../_shared/runtime.ts';
import { FreeContextRequestError, parseFreeContextRequest } from './validate.ts';

const TABLE = {
  products: 'free_saved_products',
  checks: 'free_check_history',
  experiences: 'free_product_experiences',
} as const;
const FIELDS = {
  products: 'id,seq,product_id,brand,name,source,state,created_at,updated_at',
  checks: 'id,seq,resolution_case_id,product_id,brand,product_name,resolution_state,checked_at',
  experiences: 'id,seq,product_id,brand,product_name,source,kind,note,noted_at',
} as const;

type Row = Record<string, unknown>;

function fail(error: { code?: string } | null, action: string): never {
  console.error(`free context ${action} failed:`, error?.code ?? 'empty');
  throw new ServiceError('CONTEXT_UNAVAILABLE', 'Saved context is temporarily unavailable', 503);
}

function project(section: keyof typeof TABLE, row: Row): Row {
  if (section === 'products') return {
    id: row.id, productId: row.product_id, brand: row.brand, name: row.name,
    source: row.source, state: row.state, createdAt: row.created_at, updatedAt: row.updated_at,
  };
  if (section === 'checks') return {
    id: row.id, productId: row.product_id, brand: row.brand, productName: row.product_name,
    resolutionState: row.resolution_state, checkedAt: row.checked_at,
  };
  return {
    id: row.id, productId: row.product_id, brand: row.brand, productName: row.product_name,
    source: row.source, kind: row.kind, note: row.note, notedAt: row.noted_at,
  };
}

async function list(admin: SupabaseClient, userId: string, request: Extract<FreeContextRequest, { operation: 'list' }>) {
  const { section, limit = 20, cursor } = request;
  let query = admin.from(TABLE[section]).select(FIELDS[section]).eq('user_id', userId)
    .order('seq', { ascending: false }).limit(limit + 1);
  if (cursor) {
    const { data: anchor, error: anchorError } = await admin.from(TABLE[section]).select('seq')
      .eq('user_id', userId).eq('id', cursor).maybeSingle();
    if (anchorError) fail(anchorError, 'cursor read');
    if (!anchor) throw new ServiceError('CURSOR_NOT_FOUND', 'History page could not be found', 404);
    query = query.lt('seq', anchor.seq);
  }
  const { data, error } = await query;
  if (error || !data) fail(error, 'list');
  const hasMore = data.length > limit;
  const page = data.slice(0, limit) as Row[];
  return { items: page.map((row) => project(section, row)),
    nextCursor: hasMore ? String(page[page.length - 1].id) : null };
}

async function catalogProduct(admin: SupabaseClient, productId: string): Promise<{ product_id: string; name: string; brand: string; source: 'catalog' }> {
  const { data, error } = await admin.from('products').select('id,name,brand,is_catalog_standard,catalog_verified_at')
    .eq('id', productId).maybeSingle();
  if (error) fail(error, 'catalog read');
  if (!data || data.is_catalog_standard !== true || !data.catalog_verified_at) {
    throw new ServiceError('PRODUCT_NOT_FOUND', 'Product was not found in the sourced catalog', 404);
  }
  return { product_id: data.id, name: data.name, brand: data.brand, source: 'catalog' };
}

async function resolvedProduct(admin: SupabaseClient, reference: FreeProductReference) {
  if (reference.productId) return catalogProduct(admin, reference.productId);
  return { product_id: null, name: reference.name, brand: reference.brand ?? null, source: 'user_reported' as const };
}

async function replay(admin: SupabaseClient, userId: string, section: keyof typeof TABLE, requestId: string): Promise<Row | null> {
  const { data, error } = await admin.from(TABLE[section]).select(FIELDS[section])
    .eq('user_id', userId).eq('request_id', requestId).maybeSingle();
  if (error) fail(error, 'replay');
  return data as Row | null;
}

async function insertOnce(admin: SupabaseClient, userId: string, section: keyof typeof TABLE,
  requestId: string, values: Row, matches: (row: Row) => boolean): Promise<Row> {
  const existing = await replay(admin, userId, section, requestId);
  if (existing) {
    if (!matches(existing)) throw new ServiceError('IDEMPOTENCY_CONFLICT', 'Request ID was used for different context', 409);
    return existing;
  }
  const { data, error } = await admin.from(TABLE[section]).insert({ user_id: userId, request_id: requestId, ...values })
    .select(FIELDS[section]).single();
  if (!error && data) return data as Row;
  if (error?.code === '23505') {
    const raced = await replay(admin, userId, section, requestId);
    if (raced && matches(raced)) return raced;
    throw new ServiceError('IDEMPOTENCY_CONFLICT', 'Request ID was used for different context', 409);
  }
  fail(error, 'insert');
}

async function saveProduct(admin: SupabaseClient, userId: string,
  request: Extract<FreeContextRequest, { operation: 'save_product' }>) {
  const product = await resolvedProduct(admin, request.product);
  const row = await insertOnce(admin, userId, 'products', request.requestId,
    { ...product, state: request.state },
    (existing) => existing.product_id === product.product_id && existing.name === product.name
      && existing.brand === product.brand && existing.source === product.source);
  return project('products', row);
}

async function setProductState(admin: SupabaseClient, userId: string,
  request: Extract<FreeContextRequest, { operation: 'set_product_state' }>) {
  const { data, error } = await admin.from(TABLE.products).update({ state: request.state })
    .eq('user_id', userId).eq('id', request.id).select(FIELDS.products).maybeSingle();
  if (error) fail(error, 'state update');
  if (!data) throw new ServiceError('NOT_FOUND', 'Saved product was not found', 404);
  return project('products', data as Row);
}

async function recordCheck(admin: SupabaseClient, userId: string,
  request: Extract<FreeContextRequest, { operation: 'record_check' }>) {
  let product: Awaited<ReturnType<typeof catalogProduct>> | null = null;
  let caseId: string | null = null;
  let resolutionState = 'catalog_product';
  if (request.caseId) {
    const { data: found, error } = await admin.from('product_resolution_cases')
      .select('id,consumer,resolution_state,product_id').eq('id', request.caseId).eq('user_id', userId).maybeSingle();
    if (error) fail(error, 'case read');
    if (!found || found.consumer !== 'scan') throw new ServiceError('CASE_NOT_FOUND', 'Your Check was not found', 404);
    caseId = found.id;
    resolutionState = found.resolution_state;
    if (found.product_id) product = await catalogProduct(admin, found.product_id);
  } else {
    product = await catalogProduct(admin, request.productId!);
  }
  const values = {
    resolution_case_id: caseId, product_id: product?.product_id ?? null,
    brand: product?.brand ?? null, product_name: product?.name ?? 'Product not identified',
    resolution_state: resolutionState,
  };
  const row = await insertOnce(admin, userId, 'checks', request.requestId, values,
    (existing) => existing.resolution_case_id === caseId && existing.product_id === values.product_id
      && existing.resolution_state === resolutionState);
  return project('checks', row);
}

async function recordExperience(admin: SupabaseClient, userId: string,
  request: Extract<FreeContextRequest, { operation: 'record_experience' }>) {
  const product = await resolvedProduct(admin, request.product);
  const values = { product_id: product.product_id, product_name: product.name, brand: product.brand,
    source: product.source, kind: request.kind, note: request.note ?? null };
  const row = await insertOnce(admin, userId, 'experiences', request.requestId, values,
    (existing) => existing.product_id === values.product_id && existing.product_name === values.product_name
      && existing.brand === values.brand && existing.kind === values.kind && existing.note === values.note);
  return project('experiences', row);
}

async function deleteOwned(admin: SupabaseClient, userId: string, section: keyof typeof TABLE, id: string) {
  const { data, error } = await admin.from(TABLE[section]).delete().eq('user_id', userId).eq('id', id)
    .select('id').maybeSingle();
  if (error) fail(error, 'delete');
  if (!data) throw new ServiceError('NOT_FOUND', 'Saved entry was not found', 404);
  return { deleted: true, id };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ code: 'METHOD_NOT_ALLOWED', error: 'POST required' }, 405);
  try {
    const { admin, userId } = await authenticate(req);
    let request: FreeContextRequest;
    try { request = parseFreeContextRequest(await readJsonObject(req)); }
    catch (error) {
      if (error instanceof FreeContextRequestError) throw new ServiceError('INVALID_PAYLOAD', error.message, 400);
      throw error;
    }
    switch (request.operation) {
      case 'list': return jsonResponse(await list(admin, userId, request));
      case 'save_product': return jsonResponse({ product: await saveProduct(admin, userId, request) });
      case 'set_product_state': return jsonResponse({ product: await setProductState(admin, userId, request) });
      case 'delete_product': return jsonResponse(await deleteOwned(admin, userId, 'products', request.id));
      case 'record_check': return jsonResponse({ check: await recordCheck(admin, userId, request) });
      case 'record_experience': return jsonResponse({ experience: await recordExperience(admin, userId, request) });
      case 'delete_entry': return jsonResponse(await deleteOwned(admin, userId, request.section, request.id));
    }
  } catch (error) { return errorResponse(error); }
});
