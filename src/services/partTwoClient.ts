import { NormalizationRequestSchema, NormalizationResultSchema } from '../contracts/PartTwo.ts';
import type { PartTwoTransport } from '../presentation/part-two/controller.ts';
import { z } from 'zod';
import { SaveRequestSchema, PartOneIdSchema, type SaveRequest } from '../contracts/PartOne.ts';
export type PartTwoInvoke = (path: string, body: string, signal?: AbortSignal) => Promise<{ data: unknown; error: unknown }>;
export const CaptureInterpretationRequestSchema = z.strictObject({ captureSessionId: PartOneIdSchema, bindingKey: z.string().min(1).max(200), expectedPartTwoRevision: z.number().int().nonnegative() });
export async function savePartTwoCaptureInterpretation(captureSessionId: string, guard: PartTwoSaveGuard, invoke: PartTwoInvoke) {
  const response = await invoke('part-two/capture-interpretations', JSON.stringify(CaptureInterpretationRequestSchema.parse({ captureSessionId, ...guard })));
  if (response.error) throw new Error('Details changed. Review and save again.');
  return z.strictObject({ state: z.literal('saved'), interpretationId: PartOneIdSchema, bindingKey: z.string(), resultRevision: z.number().int().nonnegative() }).parse(response.data);
}
export async function readPartTwoCapturedDetails(captureSessionId: string, interpretationId: string | null, requestId: string, invoke: PartTwoInvoke) {
  const response = await invoke('part-two/captured-details', JSON.stringify({ captureSessionId: PartOneIdSchema.parse(captureSessionId), interpretationId: interpretationId === null ? null : PartOneIdSchema.parse(interpretationId), requestId }));
  if (response.error) throw new Error('Ingredient evidence unavailable');
  return z.strictObject({ result: NormalizationResultSchema.nullable(), withdrawn: z.boolean(), interpretationId: PartOneIdSchema.nullable() }).parse(response.data);
}

export type PartTwoSaveGuard = { bindingKey: string; expectedPartTwoRevision: number };
export const PartTwoSaveRequestSchema = z.strictObject({ save: SaveRequestSchema, bindingKey: z.string().min(1).max(200), expectedPartTwoRevision: z.number().int().nonnegative() });
export async function savePartTwoInterpretation(save: SaveRequest, guard: PartTwoSaveGuard, invoke: (path: string, body: string) => Promise<{ data: unknown; error: unknown }>): Promise<{ saveId: string }> {
  const response = await invoke('part-two/saves', JSON.stringify(PartTwoSaveRequestSchema.parse({ save, ...guard })));
  if (response.error) throw new Error('Details changed. Review and save again.');
  return z.object({ saveId: PartOneIdSchema }).parse(response.data);
}
export function createPartTwoSavedTransport(saveId: string, ports: { enabled: () => boolean; invoke: PartTwoInvoke }): PartTwoTransport {
  return { async normalize(request, signal) {
    if (!ports.enabled()) throw new Error('Ingredient details unavailable');
    const response = await ports.invoke('part-two/saved-details', JSON.stringify({ saveId: PartOneIdSchema.parse(saveId), requestId: request.requestId }), signal);
    if (response.error) throw new Error('Ingredient details unavailable');
    const value = z.strictObject({ result: NormalizationResultSchema.nullable(), withdrawn: z.boolean() }).parse(response.data);
    if (value.withdrawn || !value.result) throw new Error('Ingredient evidence unavailable');
    return value.result;
  } };
}

export function createPartTwoTransport(ports: { enabled: () => boolean; invoke: PartTwoInvoke }): PartTwoTransport {
  return { async normalize(request, signal) {
    if (!ports.enabled()) throw new Error('Ingredient details unavailable');
    const body = JSON.stringify(NormalizationRequestSchema.parse(request));
    const response = await ports.invoke('part-two/normalize', body, signal);
    if (response.error) throw new Error('Ingredient details unavailable');
    return NormalizationResultSchema.parse(response.data);
  } };
}
