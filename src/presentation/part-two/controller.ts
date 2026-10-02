import { NormalizationRequestSchema, NormalizationResultSchema, type NormalizationRequest, type NormalizationResult } from '../../contracts/PartTwo.ts';

export type PartTwoTarget = { ownerId: string; scanId: string; captureSessionId: string | null; generation: number; evidenceRevision: number };
export type PartTwoView = { target: PartTwoTarget | null; result: NormalizationResult | null; loading: boolean; error: string | null };
export interface PartTwoTransport { normalize(request: NormalizationRequest): Promise<unknown> }
const targetKey = (target: PartTwoTarget) => JSON.stringify(target);
/** Request correlation is transport metadata; equal result revisions require identical content. */
function content(value: unknown): string {
  function canonical(v: unknown): unknown {
    if (Array.isArray(v)) return v.map(canonical);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).filter(([k]) => k !== 'requestId').sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, canonical(x)]));
    return v;
  }
  return JSON.stringify(canonical(value));
}
export function createPartTwoController(transport: PartTwoTransport, createId: () => string, changed: (view: PartTwoView) => void, now = Date.now) {
  let epoch = 0, sequence = 0;
  let view: PartTwoView = { target: null, result: null, loading: false, error: null };
  const highest = new Map<string, { revision: number; content: string }>();
  const emit = () => changed({ ...view });
  function publish(raw: unknown, target: PartTwoTarget, requestId: string, token: number, attempt: number): boolean {
    const parsed = NormalizationResultSchema.safeParse(raw);
    if (!parsed.success || epoch !== token || attempt !== sequence || !view.target || targetKey(view.target) !== targetKey(target)) return false;
    const r = parsed.data;
    if (r.requestId !== requestId || r.authenticatedOwnerId !== target.ownerId || r.scanId !== target.scanId || r.captureSessionId !== target.captureSessionId || r.generation !== target.generation || r.evidenceRevision !== target.evidenceRevision) return false;
    const key = targetKey(target), prior = highest.get(key), serialized = content(r);
    if (prior && (r.resultRevision < prior.revision || r.resultRevision === prior.revision && serialized !== prior.content)) return false;
    highest.set(key, { revision: r.resultRevision, content: serialized });
    // Bounded in-memory state only. No new device retention permission is implied.
    if (highest.size > 32) highest.delete(highest.keys().next().value!);
    const expired = Date.parse(r.expiresAt) <= now();
    view = { target, result: expired ? null : r, loading: false, error: expired ? 'Ingredient evidence unavailable' : null }; emit(); return true;
  }
  return {
    getView: () => ({ ...view }),
    bind(target: PartTwoTarget | null) {
      if (target && view.target && targetKey(target) === targetKey(view.target)) return;
      epoch++; sequence++; highest.clear(); view = { target, result: null, loading: false, error: null }; emit();
    },
    async refresh() {
      const target = view.target; if (!target) return false;
      const token = epoch, attempt = ++sequence, requestId = createId();
      const request = NormalizationRequestSchema.parse({ schemaVersion: 1, requestId, scanId: target.scanId, captureSessionId: target.captureSessionId, expectedGeneration: target.generation, expectedEvidenceRevision: target.evidenceRevision });
      view = { ...view, loading: true, error: null }; emit();
      try {
        const accepted = publish(await transport.normalize(request), target, requestId, token, attempt);
        if (!accepted && epoch === token && attempt === sequence) { view = { ...view, result: null, loading: false, error: 'Ingredient details changed. Reopen the current evidence.' }; emit(); }
        return accepted;
      } catch {
        if (epoch === token && attempt === sequence) { view = { ...view, result: null, loading: false, error: 'Ingredient details unavailable' }; emit(); }
        return false;
      }
    },
    expire() { if (view.result && Date.parse(view.result.expiresAt) <= now()) { view = { ...view, result: null, loading: false, error: 'Ingredient evidence unavailable' }; emit(); } },
    invalidate() { epoch++; sequence++; view = { ...view, result: null, loading: false, error: 'Ingredient evidence unavailable' }; emit(); },
    close() { epoch++; sequence++; highest.clear(); view = { target: null, result: null, loading: false, error: null }; emit(); },
  };
}
