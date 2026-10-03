import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.39.8';
import { parseProductTruthSnapshot } from '../../../src/contracts/productTruthValidation.ts';
import { evaluateProductCheckFacts, type AcceptedCategory, type StoredProductEvidence } from '../../../src/domain/product-check-facts/evaluate.ts';
import type { ProductCheckFactsV1 } from '../../../src/contracts/ProductCheckFacts.ts';
import { authenticate, corsHeaders, errorResponse, jsonResponse, readJsonObject, ServiceError } from '../_shared/runtime.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CATEGORIES = new Set(['cleanser','toner','treatment','serum','moisturizer','sunscreen','oil','mask','deodorant','body_care','hair_care','other']);

function parseRequest(body: Record<string, unknown>): { caseId: string; snapshotId: string } {
  if (Object.keys(body).some((key) => key !== 'caseId' && key !== 'snapshotId')
    || typeof body.caseId !== 'string' || !UUID.test(body.caseId)
    || typeof body.snapshotId !== 'string' || !UUID.test(body.snapshotId)) {
    throw new ServiceError('INVALID_PAYLOAD', 'Case and snapshot IDs are required', 400);
  }
  return { caseId: body.caseId, snapshotId: body.snapshotId };
}

async function categoryForSnapshot(admin: SupabaseClient, productId: string | null): Promise<AcceptedCategory | null> {
  if (!productId) return null;
  const { data, error } = await admin.from('products')
    .select('id,category,is_catalog_standard,catalog_verified_at,catalog_source_reference')
    .eq('id', productId).maybeSingle();
  if (error) throw new ServiceError('PRODUCT_FACTS_UNAVAILABLE', 'Product facts are temporarily unavailable', 503);
  // A private/provisional product can never supply shared accepted category facts.
  if (!data || data.is_catalog_standard !== true || !data.catalog_verified_at
    || !data.catalog_source_reference || !CATEGORIES.has(data.category)) return null;
  const revisionInput = JSON.stringify([data.id,data.category,data.catalog_verified_at,data.catalog_source_reference]);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(revisionInput));
  const sourceRevision = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2,'0')).join('');
  return { productId: data.id, category: data.category as AcceptedCategory['category'], sourceRevision };
}

async function loadFacts(admin: SupabaseClient, userId: string, caseId: string, snapshotId: string): Promise<ProductCheckFactsV1> {
  const { data: ownedCase, error: caseError } = await admin.from('product_resolution_cases')
    .select('id,consumer').eq('id',caseId).eq('user_id',userId).maybeSingle();
  if (caseError) throw new ServiceError('PRODUCT_FACTS_UNAVAILABLE','Product facts are temporarily unavailable',503);
  if (!ownedCase || ownedCase.consumer !== 'scan') throw new ServiceError('CASE_NOT_FOUND','Check was not found',404);
  const { data: saved, error: savedError } = await admin.from('product_check_fact_assessments')
    .select('packet').eq('user_id',userId).eq('case_id',caseId).eq('snapshot_id',snapshotId).maybeSingle();
  if (savedError) throw new ServiceError('PRODUCT_FACTS_UNAVAILABLE','Product facts are temporarily unavailable',503);
  if (saved) return saved.packet as ProductCheckFactsV1;

  const { data: stored, error: snapshotError } = await admin.from('product_truth_snapshots')
    .select('id,case_id,case_revision,snapshot').eq('id',snapshotId).eq('case_id',caseId)
    .eq('user_id',userId).maybeSingle();
  if (snapshotError) throw new ServiceError('PRODUCT_FACTS_UNAVAILABLE','Product facts are temporarily unavailable',503);
  if (!stored) throw new ServiceError('SNAPSHOT_NOT_FOUND','Check snapshot was not found',404);
  let snapshot;
  try { snapshot = parseProductTruthSnapshot(stored.snapshot); }
  catch { throw new ServiceError('PRODUCT_FACTS_UNAVAILABLE','Product facts are temporarily unavailable',503); }
  if (snapshot.snapshotId !== stored.id || snapshot.resolutionCaseId !== stored.case_id
    || snapshot.caseRevision !== stored.case_revision) {
    throw new ServiceError('PRODUCT_FACTS_UNAVAILABLE','Product facts are temporarily unavailable',503);
  }
  const [category, evidenceResult] = await Promise.all([
    categoryForSnapshot(admin, snapshot.catalogReferences.productId),
    admin.from('product_resolution_evidence').select('id,evidence_type,source_type,extracted_text')
      .eq('case_id',caseId).eq('user_id',userId).order('created_at').order('id').limit(101),
  ]);
  if (evidenceResult.error || !evidenceResult.data || evidenceResult.data.length > 100) {
    throw new ServiceError('PRODUCT_FACTS_UNAVAILABLE','Product facts are temporarily unavailable',503);
  }
  const packet = evaluateProductCheckFacts({ snapshot, acceptedCategory: category,
    evidence: evidenceResult.data as StoredProductEvidence[], createdAt: new Date().toISOString() });
  const { data: persisted, error: persistError } = await admin.rpc('persist_product_check_facts', {
    p_user_id:userId,p_case_id:caseId,p_snapshot_id:snapshotId,p_packet:packet,
  });
  if (persistError || !persisted) {
    console.error('product facts persistence failed:', persistError?.code ?? 'empty');
    throw new ServiceError('PRODUCT_FACTS_UNAVAILABLE','Product facts could not be saved',503);
  }
  return persisted as ProductCheckFactsV1;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ code:'METHOD_NOT_ALLOWED', error:'POST required' },405);
  try {
    const { userId, admin } = await authenticate(req);
    const { caseId, snapshotId } = parseRequest(await readJsonObject(req));
    return jsonResponse({ facts: await loadFacts(admin,userId,caseId,snapshotId) });
  } catch (error) { return errorResponse(error); }
});
