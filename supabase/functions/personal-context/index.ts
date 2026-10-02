import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { authenticate, corsHeaders, errorResponse, jsonResponse, readJsonObject, ServiceError } from '../_shared/runtime.ts';
import { parsePersonalContextRequest, PersonalContextRequestError } from './validate.ts';
import { personalContextV2RequestSchema } from '../../../src/contracts/PersonalContextV2Schema.ts';
import { projectPersonalContextV2, projectPersonalContextV1, projectExperienceV1 } from '../../../src/services/context/migrateV2.ts';
import type { PersonalContextSnapshot, PersonalContextRevision } from '../../../src/contracts/PersonalContext.ts';
import type { SetupPayloadV2 } from '../../../src/contracts/PersonalContextV2.ts';
const CONFLICTS = new Set(['IDEMPOTENCY_CONFLICT','STALE_CONTEXT','EXPERIENCE_CORRECTION_CONFLICT','CONTEXT_REQUEST_ERASED']);
function databaseError(error: { message?: string; code?: string }): never {
  if (CONFLICTS.has(error.message ?? '')) throw new ServiceError(error.message!, 'Personal context changed. Reload before saving.', 409);
  if (['CONTEXT_PRODUCT_NOT_VERIFIED','CONTEXT_VARIANT_MISMATCH','CONTEXT_FORMULA_NOT_VERIFIED','CONTEXT_NOTE_SOURCE_MISMATCH'].includes(error.message ?? '')) {
    throw new ServiceError('REFERENCE_NOT_VERIFIED', 'Product reference could not be verified', 400);
  }
  console.error('personal context database error:', error.code ?? 'unknown');
  throw new ServiceError('CONTEXT_UNAVAILABLE', 'Personal context is temporarily unavailable', 503);
}
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ code: 'METHOD_NOT_ALLOWED', error: 'POST required' }, 405);
  try {
    const { admin, userId } = await authenticate(req);
    const raw = await readJsonObject(req);
    if (['read_context_v2','save_setup','delete_context_record'].includes(String(raw.operation))) {
      const parsed = personalContextV2RequestSchema.safeParse(raw);
      if (!parsed.success) throw new ServiceError('INVALID_PAYLOAD','Invalid context fields or limits',400);
      const v2 = parsed.data;
      if (v2.operation === 'read_context_v2') {
        const {data,error}=await admin.rpc('read_personal_context_v2',{p_user_id:userId});
        if(error)databaseError(error);
        return jsonResponse(projectPersonalContextV2(data.v1 as PersonalContextSnapshot,data.setupRevision as PersonalContextRevision<SetupPayloadV2>|null));
      }
      const {data,error}=v2.operation==='save_setup'
        ? await admin.rpc('save_personal_context_setup',{p_user_id:userId,p_request_id:v2.requestId,p_base_revision:v2.baseContextRevision,p_setup:v2.setup})
        : await admin.rpc('delete_personal_context_record',{p_user_id:userId,p_request_id:v2.requestId,p_base_revision:v2.baseContextRevision,p_kind:v2.record.kind,p_record_id:v2.record.id});
      if(error)databaseError(error);return jsonResponse(data);
    }
    let request;
    try { request = parsePersonalContextRequest(raw); }
    catch (error) { if (error instanceof PersonalContextRequestError) throw new ServiceError('INVALID_PAYLOAD', error.message, 400); throw error; }
    if (request.operation === 'get_context') {
      const { data, error } = await admin.rpc('read_personal_context_v2', { p_user_id: userId });
      if (error) databaseError(error);
      return jsonResponse(projectPersonalContextV1(projectPersonalContextV2(data.v1 as PersonalContextSnapshot,data.setupRevision as PersonalContextRevision<SetupPayloadV2>|null)));
    }
    if (request.operation === 'get_revision') {
      const { data, error } = await admin.from('personal_context_revisions').select('id,user_id,revision,payload,recorded_at,provenance,supersedes_revision_id,section')
        .eq('id',request.revisionId).eq('user_id',userId).maybeSingle();
      if (error) databaseError(error);
      if (!data) throw new ServiceError('REVISION_NOT_FOUND','Personal context revision was not found',404);
      return jsonResponse({ revision: { id:data.id,ownerId:data.user_id,revision:data.revision,data:data.payload,
        recordedAt:data.recorded_at,provenance:data.provenance,supersedesRevisionId:data.supersedes_revision_id },section:data.section });
    }
    if (request.operation === 'get_experiences') {
      const { data, error } = await admin.rpc('read_personal_experience_history_v2', { p_user_id:userId,p_at_revision:request.atRevision,p_limit:request.limit ?? 50,p_cursor:request.cursor ?? null,p_product_id:request.productId ?? null });
      if (error?.message === 'HISTORY_CURSOR_NOT_FOUND') throw new ServiceError('HISTORY_CURSOR_NOT_FOUND','History cursor was not found',404);
      if (error?.message === 'INVALID_HISTORY_REVISION') throw new ServiceError('INVALID_HISTORY_REVISION','History revision is invalid',400);
      if (error) databaseError(error);
      return jsonResponse({...data,items:(data.items??[]).map((item:PersonalContextRevision<Parameters<typeof projectExperienceV1>[0]>)=>({...item,data:projectExperienceV1(item.data)}))});
    }
    if(request.operation==='append_experience' && request.supersedesRevisionId) {
      const {data,error}=await admin.rpc('read_personal_context_v2',{p_user_id:userId});if(error)databaseError(error);
      const current=projectPersonalContextV2(data.v1 as PersonalContextSnapshot,data.setupRevision as PersonalContextRevision<SetupPayloadV2>|null);
      const report=current.experiences.find(item=>item.data.id===request.experience.id);
      if(report?.id===current.setupRevision && request.supersedesRevisionId===report.id) request={...request,supersedesRevisionId:null};
    }
    const section = request.operation === 'save_profile' ? 'profile' : request.operation === 'save_routine' ? 'routine' : 'experience';
    const payload = request.operation === 'save_profile' ? request.profile : request.operation === 'save_routine' ? request.routine : request.experience;
    const { data, error } = await admin.rpc('write_personal_context', { p_user_id:userId,p_request_id:request.requestId,p_base_revision:request.baseRevision,
      p_section:section,p_payload:payload,p_supersedes_revision_id:request.operation === 'append_experience' ? request.supersedesRevisionId : null });
    if (error) databaseError(error);
    return jsonResponse(data);
  } catch (error) { return errorResponse(error); }
});
