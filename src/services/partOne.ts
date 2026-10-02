import { ScanRequestSchema, ScanResultSchema, CaptureSessionSchema, CaptureCommitRequestSchema, CaptureCommitResultSchema, PartOneIdSchema, type CaptureCommitRequest, type CaptureCommitResult, type ScanRequest, type SelectionRequest, type SaveRequest } from '../contracts/PartOne.ts';
import type { PartOneTransport } from '../presentation/part-one/resultController.ts';
import { supabase } from './supabase';
import { publicEnvironment } from '../config/environment';
import { z } from 'zod';

// Source activation is local-only. Hosted source/retention gates have not been approved.
export const PART_ONE_ENABLED = typeof __DEV__ !== 'undefined' && __DEV__ && process.env.EXPO_PUBLIC_PART_ONE_ENABLED === 'true'
  && publicEnvironment.buildFlavor === 'development' && publicEnvironment.useRemoteService
  && /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?\/?$/.test(publicEnvironment.supabaseUrl);

export class PartOneConflict extends Error { constructor(public current: unknown) { super('Result revision changed'); } }
async function call(path: string, method: 'GET' | 'POST' | 'DELETE', body?: unknown): Promise<any> {
  if (!PART_ONE_ENABLED || !supabase) throw new Error('Part 1 local service unavailable');
  const { data, error } = await supabase.functions.invoke(`part-one${path}`, { method, ...(body === undefined ? {} : { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }) });
  if (error) { if ('context' in error && error.context instanceof Response && error.context.status === 409) throw new PartOneConflict(await error.context.json()); throw new Error('Part 1 service unavailable'); }
  return data;
}
export const partOneTransport: PartOneTransport = {
  scan: async (request: ScanRequest) => ScanResultSchema.parse(await call('/scans', 'POST', ScanRequestSchema.parse(request))),
  read: async id => ScanResultSchema.parse(await call(`/scans/${id}`, 'GET')),
  subscribe: async id => ScanResultSchema.parse(await call(`/scans/${id}/subscriptions`, 'POST', {})),
  unsubscribe: async id => { await call(`/subscriptions/${id}`, 'DELETE'); },
  select: async (id: string, request: SelectionRequest) => ScanResultSchema.parse(await call(`/scans/${id}/selection`, 'POST', request)),
  save: async (request: SaveRequest) => { const result = await call('/saves', 'POST', request); return { saveId: result.saveId }; },
  capture: async (id, generation, revision) => CaptureSessionSchema.parse(await call(`/scans/${id}/captures`, 'POST', { expectedGeneration: generation, expectedResultRevision: revision })),
};

const SavedProductSchema = z.strictObject({ saveId: z.string().uuid(), snapshotAtSaveId: z.string().uuid(), createdAt: z.iso.datetime(), result: ScanResultSchema });
export type PartOneSavedProduct = z.infer<typeof SavedProductSchema>;
export async function listPartOneSaves(): Promise<PartOneSavedProduct[]> {
  return z.strictObject({ saves: z.array(SavedProductSchema) }).parse(await call('/saves', 'GET')).saves;
}
export async function readPartOneSave(id: string): Promise<PartOneSavedProduct> { return SavedProductSchema.parse(await call(`/saves/${z.string().uuid().parse(id)}`, 'GET')); }
export async function deletePartOneSave(id: string): Promise<void> { await call(`/saves/${z.string().uuid().parse(id)}`, 'DELETE'); }

/** These explicit private operations remain subject to the server retention gate.
 * They do not upload assets or turn a temporary local draft into catalog truth. */
export async function commitPartOneCapture(id: string, request: CaptureCommitRequest): Promise<CaptureCommitResult> {
  const expected=PartOneIdSchema.parse(id).toLowerCase();
  const result=CaptureCommitResultSchema.parse(await call(`/captures/${expected}/observations`, 'POST', CaptureCommitRequestSchema.parse(request)));
  if (result.capture.captureSessionId!==expected || result.capture.packageObservationId!==request.packageObservationId.toLowerCase())
    throw new Error('Private capture commit binding changed');
  return result;
}
export async function readPartOneCapture(id: string) {
  const expected=PartOneIdSchema.parse(id).toLowerCase();
  const result=CaptureSessionSchema.parse(await call(`/captures/${expected}`, 'GET'));
  if (result.captureSessionId!==expected) throw new Error('Private capture read binding changed');
  return result;
}
export async function deletePartOneCapture(id: string): Promise<void> {
  const expected = PartOneIdSchema.parse(id).toLowerCase();
  const result = z.strictObject({ deleted: z.literal(true), id: PartOneIdSchema }).parse(await call(`/captures/${expected}`, 'DELETE'));
  if (result.id !== expected) throw new Error('Private capture deletion binding changed');
}
