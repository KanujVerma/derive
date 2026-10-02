import {
  ScanRequestSchema, ScanResultSchema, SelectionRequestSchema, SaveRequestSchema,
  CaptureSessionSchema, CaptureCommitRequestSchema, CaptureCommitResultSchema, PartOneIdSchema,
} from '../../../src/contracts/PartOne.ts';
import { normalizeBarcode } from '../../../src/domain/part-one/barcode.ts';

/** RPC executes with the verified user's JWT, never a client-supplied owner or
 * a service-role shortcut. The consumer has a separate service-only RPC. */
export interface PartOneHttpPorts {
  authorize(request: Request): Promise<void>;
  operation(action: string, payload: Record<string, unknown>, request: Request): Promise<unknown>;
}
export class PartOneHttpError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status: number) { super(code); this.code=code; this.status=status; }
}
const headers = {
  'Content-Type': 'application/json', 'Cache-Control': 'private, no-store, max-age=0',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
};
function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers });
}
/** Postgres timestamptz JSON uses an offset; public contract is UTC ISO Z. */
export function normalizeDatabaseDates(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeDatabaseDates);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, v]) => [key,
    typeof v === 'string' && ['observedAt','expiresAt','sourceUpdatedAt','nextCheckAfter','createdAt'].includes(key)
      && Number.isFinite(Date.parse(v)) ? new Date(v).toISOString() : normalizeDatabaseDates(v)]));
  return value;
}
async function boundedJson(request: Request): Promise<Record<string, unknown>> {
  // Read streams with an actual byte limit: Content-Length is not trusted.
  const reader = request.body?.getReader();
  if (!reader) throw new PartOneHttpError('invalid_payload',400);
  const chunks: Uint8Array[] = []; let bytes = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > 64 * 1024) { await reader.cancel(); throw new PartOneHttpError('payload_too_large',413); }
    chunks.push(value);
  }
  const data = new Uint8Array(bytes); let offset = 0;
  for (const chunk of chunks) { data.set(chunk,offset); offset += chunk.byteLength; }
  let parsed: unknown;
  try { parsed = JSON.parse(new TextDecoder().decode(data)); } catch { throw new PartOneHttpError('invalid_payload',400); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new PartOneHttpError('invalid_payload',400);
  return parsed as Record<string, unknown>;
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new PartOneHttpError('invalid_server_projection',500);
  return value as Record<string, unknown>;
}
function checkedResult(value: unknown): unknown {
  const data = object(normalizeDatabaseDates(value));
  if (data.capture) return CaptureCommitResultSchema.parse(data);
  if (data.conflict === true) return { ...data, result: ScanResultSchema.parse(data.result) };
  if (Array.isArray(data.saves)) return { ...data, saves:data.saves.map(s => checkedResult(s)) };
  if (data.result) return { ...data, result: ScanResultSchema.parse(data.result) };
  if (data.scanId && data.identity) return ScanResultSchema.parse(data);
  if (data.captureSessionId) return CaptureSessionSchema.parse(data);
  return data;
}
export async function handlePartOneRequest(request: Request, ports: PartOneHttpPorts): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null,{status:204,headers});
  try {
    await ports.authorize(request);
    const pathname = new URL(request.url).pathname;
    const marker = pathname.indexOf('/part-one');
    if (marker < 0) throw new PartOneHttpError('not_found',404);
    const parts = pathname.slice(marker + '/part-one'.length).split('/').filter(Boolean);
    const [resource,rawId,child] = parts;
    const id=rawId?.toLowerCase();
    if (parts.length>3 || id && !PartOneIdSchema.safeParse(id).success) throw new PartOneHttpError('invalid_path',400);
    let action: string; let payload: Record<string, unknown>;
    if (resource==='scans' && !id && request.method==='POST') {
      const scan = ScanRequestSchema.parse(await boundedJson(request));
      const code = normalizeBarcode(scan.code);
      action = 'scans/create';
      payload = { request:scan, idempotencyKey:scan.idempotencyKey,
        canonicalKey:code.supported ? code.canonicalGtin14 ? `gtin:${code.canonicalGtin14}` : code.canonicalCode : null,
        normalizationVersion:code.normalizationVersion, reasonCodes:code.reason ? [code.reason] : [] };
    } else if (resource==='scans' && id && !child && request.method==='GET') {
      action='scans/read'; payload={scanId:id};
    } else if (resource==='scans' && id && child==='subscriptions' && request.method==='POST') {
      action='subscriptions/create'; payload={scanId:id};
    } else if (resource==='scans' && id && child==='selection' && request.method==='POST') {
      action='selection'; payload={scanId:id,...SelectionRequestSchema.parse(await boundedJson(request))};
    } else if (resource==='scans' && id && child==='captures' && request.method==='POST') {
      const body=await boundedJson(request);
      const validKeys=['expectedGeneration','expectedResultRevision'];
      if (Object.keys(body).some(k=>!validKeys.includes(k)) || validKeys.some(k=>!Number.isInteger(body[k]) || Number(body[k])<0)) throw new PartOneHttpError('invalid_payload',400);
      action='captures/create'; payload={scanId:id,...body};
    } else if (resource==='captures' && id && child==='observations' && request.method==='POST') {
      action='captures/observations'; payload={captureSessionId:id,...CaptureCommitRequestSchema.parse(await boundedJson(request))};
    } else if (resource==='captures' && id && !child && request.method==='GET') {
      action='captures/read'; payload={id};
    } else if (resource==='captures' && id && !child && request.method==='DELETE') {
      action='captures/delete'; payload={id};
    } else if (resource==='saves' && !id && request.method==='GET') {
      action='saves/list'; payload={};
    } else if (resource==='saves' && !id && request.method==='POST') {
      action='saves/create'; payload=SaveRequestSchema.parse(await boundedJson(request));
    } else if ((resource==='saves' || resource==='subscriptions') && id && !child && request.method==='DELETE') {
      action=`${resource}/delete`; payload={id};
    } else if (resource==='saves' && id && !child && request.method==='GET') {
      action='saves/read'; payload={id};
    } else throw new PartOneHttpError('not_found',404);
    const raw=await ports.operation(action,payload,request);
    let result: Record<string, unknown>;
    try {
      const normalized=object(normalizeDatabaseDates(raw));
      if (action==='captures/observations' && normalized.conflict!==true) {
        const committed=CaptureCommitResultSchema.parse(normalized);
        if (committed.capture.captureSessionId!==id || committed.capture.packageObservationId!==String(payload.packageObservationId).toLowerCase())
          throw new Error('private_commit_binding');
        result=object(committed);
      } else if (action==='captures/read') {
        const capture=CaptureSessionSchema.parse(normalized);
        if (capture.captureSessionId!==id) throw new Error('private_capture_binding');
        result=object(capture);
      } else result=object(checkedResult(normalized));
    } catch { throw new PartOneHttpError('invalid_server_projection',500); }
    if (result.conflict===true) return response(result,409);
    const work=typeof result.work==='string' ? result.work : undefined;
    return response(result,work && ['queued','running','retry_wait','deferred_budget'].includes(work) ? 202 : 200);
  } catch(error) {
    if (error instanceof PartOneHttpError) return response({code:error.code},error.status);
    if (error && typeof error==='object' && 'name' in error && error.name==='ZodError') return response({code:'invalid_payload'},400);
    // Never log request bodies, provider raw text, JWTs or private asset URLs.
    return response({code:'part_one_unavailable'},503);
  }
}
export function rpcErrorToHttp(code: string | undefined, message: string): PartOneHttpError {
  if (code==='42501') return new PartOneHttpError('forbidden',403);
  if (message.includes('PRIVATE_RETENTION_DISABLED')) return new PartOneHttpError('private_retention_disabled',423);
  if (message.includes('DELETED') || message.includes('IDEMPOTENCY_CONFLICT')) return new PartOneHttpError('operation_conflict',409);
  if (message.includes('INVALID') || message.includes('UNSUPPORTED')) return new PartOneHttpError('invalid_payload',400);
  return new PartOneHttpError('part_one_unavailable',503);
}
