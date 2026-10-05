import { PartThreeRequestSchema, PartThreeResponseSchema, type PartThreeRequest, type PartThreeResponse } from '../contracts/PartThreeService.ts';
export interface PartThreeTransport {
    request(request: PartThreeRequest, signal?: AbortSignal): Promise<PartThreeResponse>;
}
export function createPartThreeTransport(ports: {
    enabled: () => boolean;
    invoke: (path: string, body: string, signal?: AbortSignal) => Promise<{
        data: unknown;
        error: unknown;
    }>;
}): PartThreeTransport {
    return { async request(request, signal) { if (!ports.enabled() || signal?.aborted)
            throw Error('Personal assessment unavailable'); const response = await ports.invoke('part-three', JSON.stringify(PartThreeRequestSchema.parse(request)), signal); if (response.error || signal?.aborted)
            throw Error('Personal assessment unavailable'); return PartThreeResponseSchema.parse(response.data); } };
}
