import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { contributionCandidateKey, parseCatalogContribution, type CatalogContributionRequest } from
  '../../../src/domain/catalog-contribution/proposal.ts';
import { authenticate, corsHeaders, errorResponse, jsonResponse, readJsonObject, ServiceError } from
  '../_shared/runtime.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function exactKeys(row: Record<string, unknown>, required: string[]): boolean {
  return Object.keys(row).length === required.length && required.every((key) => Object.hasOwn(row, key));
}

function project(row: Record<string, unknown>) {
  return { id: row.id, requestId: row.request_id, status: row.status,
    consentVersion: row.consent_version, consentedAt: row.consented_at,
    withdrawnAt: row.withdrawn_at, createdAt: row.created_at };
}

function databaseError(error: { message?: string; code?: string } | null): never {
  const message = error?.message ?? '';
  if (message.includes('CATALOG_CONTRIBUTION_REQUEST_CONFLICT')) {
    throw new ServiceError('REQUEST_CONFLICT', 'This request ID belongs to different product details', 409);
  }
  if (message.includes('CATALOG_CONTRIBUTION_DAILY_LIMIT')) {
    throw new ServiceError('DAILY_LIMIT', 'Please try contributing another product later', 429);
  }
  if (message.includes('CATALOG_CONTRIBUTION_EVIDENCE_UNAVAILABLE')) {
    throw new ServiceError('EVIDENCE_UNAVAILABLE', 'A private product photo is no longer available', 409);
  }
  if (message.includes('CATALOG_CONTRIBUTION_NOT_FOUND')) {
    throw new ServiceError('NOT_FOUND', 'Contribution was not found', 404);
  }
  if (message.includes('CATALOG_CONTRIBUTION_OWNER_UNAVAILABLE')) {
    throw new ServiceError('ACCOUNT_UNAVAILABLE', 'This account is unavailable', 409);
  }
  if (message.includes('INVALID_CATALOG_CONTRIBUTION')) {
    throw new ServiceError('INVALID_PAYLOAD', 'Contribution details are invalid', 400);
  }
  console.error('catalog contribution database operation failed:', error?.code ?? 'empty');
  throw new ServiceError('CONTRIBUTION_UNAVAILABLE', 'Product contribution is temporarily unavailable', 503);
}

function parseSubmit(body: Record<string, unknown>): CatalogContributionRequest {
  if (!exactKeys(body, ['operation', 'contribution', 'consent']) || body.operation !== 'submit') {
    throw new ServiceError('INVALID_PAYLOAD', 'A contribution and explicit consent are required', 400);
  }
  const consent = body.consent;
  if (!consent || typeof consent !== 'object' || Array.isArray(consent)
    || !exactKeys(consent as Record<string, unknown>, ['version', 'purpose', 'accepted'])
    || (consent as Record<string, unknown>).version !== 1
    || (consent as Record<string, unknown>).purpose !== 'catalog_review'
    || (consent as Record<string, unknown>).accepted !== true) {
    throw new ServiceError('CONSENT_REQUIRED', 'Choose whether to share product details for private catalog review', 400);
  }
  try { return parseCatalogContribution(body.contribution); }
  catch { throw new ServiceError('INVALID_PAYLOAD', 'Contribution details are invalid', 400); }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ code: 'METHOD_NOT_ALLOWED', error: 'POST required' }, 405);
  try {
    const { admin, userId } = await authenticate(req);
    const body = await readJsonObject(req);
    if (body.operation === 'submit') {
      const contribution = parseSubmit(body);
      const canonical = JSON.stringify([contribution.product, contribution.evidence ?? []]);
      const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
      const fingerprint = Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
      const { data, error } = await admin.rpc('submit_catalog_contribution', {
        p_user_id: userId, p_request_id: contribution.requestId,
        p_payload: contribution, p_candidate_key: contributionCandidateKey(contribution),
        p_request_fingerprint: fingerprint, p_consent_version: 1,
      });
      if (error || !data) databaseError(error);
      return jsonResponse({ contribution: project(data as Record<string, unknown>) });
    }
    if (body.operation === 'withdraw') {
      if (!exactKeys(body, ['operation', 'id']) || typeof body.id !== 'string' || !UUID.test(body.id)) {
        throw new ServiceError('INVALID_PAYLOAD', 'A contribution ID is required', 400);
      }
      const { data, error } = await admin.rpc('withdraw_catalog_contribution', {
        p_user_id: userId, p_contribution_id: body.id,
      });
      if (error || !data) databaseError(error);
      return jsonResponse({ contribution: project(data as Record<string, unknown>) });
    }
    if (body.operation === 'status') {
      if (!exactKeys(body, ['operation', 'requestId'])
        || typeof body.requestId !== 'string' || !UUID.test(body.requestId)) {
        throw new ServiceError('INVALID_PAYLOAD', 'A request ID is required', 400);
      }
      const { data, error } = await admin.from('catalog_contributions')
        .select('id,request_id,status,consent_version,consented_at,withdrawn_at,created_at')
        .eq('user_id', userId).eq('request_id', body.requestId).maybeSingle();
      if (error) databaseError(error);
      return jsonResponse({ contribution: data ? project(data as Record<string, unknown>) : null });
    }
    throw new ServiceError('INVALID_PAYLOAD', 'Unknown contribution operation', 400);
  } catch (error) { return errorResponse(error); }
});
