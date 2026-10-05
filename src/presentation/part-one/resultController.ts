import { ScanResultSchema, type ScanRequest, type ScanResult, type SaveRequest, type SelectionRequest, type CaptureSession } from '../../contracts/PartOne.ts';
import type { PartTwoSaveGuard } from '../../services/partTwoClient.ts';

export interface PartOneTransport {
  scan(request: ScanRequest): Promise<ScanResult>;
  read(scanId: string): Promise<ScanResult>;
  subscribe(scanId: string): Promise<ScanResult>;
  unsubscribe(id: string): Promise<void>;
  select(scanId: string, request: SelectionRequest): Promise<ScanResult>;
  save(request: SaveRequest, details?: PartTwoSaveGuard): Promise<{ saveId: string }>;
  capture(scanId: string, generation: number, revision: number): Promise<CaptureSession>;
}
export type PartOneView = { owner: string | null; result: ScanResult | null; loading: boolean; error: string | null; saved: boolean; scrollOffset: number };

/** Observe active worker results promptly without advancing a server retry deadline. */
export function partOneResultPollDelay(result: Pick<ScanResult, 'work' | 'nextCheckAfter'>, now = Date.now()): number {
  const active = result.work === 'queued' || result.work === 'running';
  if (result.nextCheckAfter) return Math.max(active ? 1000 : 2000, Date.parse(result.nextCheckAfter) - now);
  return active ? 1000 : result.work === 'retry_wait' ? 4000 : 10000;
}

/** Owns view interest, never provider work. Reopen reads/rejoins the same durable scan. */
export function createPartOneResultController(transport: PartOneTransport, changed: (view: PartOneView) => void) {
  let epoch = 0;
  let lastScan: { owner: string; request: ScanRequest } | null = null;
  let view: PartOneView = { owner: null, result: null, loading: false, error: null, saved: false, scrollOffset: 0 };
  const emit = () => changed({ ...view });
  const release = () => { const id = view.result?.subscriptionId; if (id) void transport.unsubscribe(id).catch(() => {}); };
  const publish = (result: ScanResult, token: number, owner: string) => {
    result = ScanResultSchema.parse(result);
    if (token !== epoch || view.owner !== owner) return false;
    if (view.result && result.scanId === view.result.scanId && result.generation === view.result.generation
      && result.resultRevision === view.result.resultRevision && view.error?.startsWith('Product lookup is unavailable.')) {
      view = { ...view, loading: false, error: null }; emit(); return true;
    }
    if (view.result && (result.scanId !== view.result.scanId || result.generation < view.result.generation
      || result.generation === view.result.generation && result.resultRevision <= view.result.resultRevision)) return false;
    view = { ...view, result, loading: false, error: null, saved: false }; emit(); return true;
  };
  const run = async (owner: string, task: () => Promise<ScanResult>, newBinding: boolean) => {
    if (newBinding) { release(); epoch++; view = { owner, result: null, loading: true, error: null, saved: false, scrollOffset: 0 }; }
    const token = epoch; emit();
    try { return publish(await task(), token, owner); }
    catch { if (token === epoch && view.owner === owner) { view = { ...view, loading: false, error: 'Product lookup is unavailable. Your existing evidence is retained.' }; emit(); } return false; }
  };
  return {
    getView: () => ({ ...view }),
    begin(owner: string, request: ScanRequest) { lastScan = { owner, request }; return run(owner, () => transport.scan(request), true); },
    retry(owner: string) { return view.result ? this.refresh(owner) : lastScan?.owner === owner ? this.begin(owner, lastScan.request) : Promise.resolve(false); },
    reopen(owner: string, scanId: string) {
      const same = view.owner === owner && view.result?.scanId === scanId;
      return run(owner, async () => { await transport.read(scanId); return transport.subscribe(scanId); }, !same);
    },
    refresh(owner: string) { const id = view.result?.scanId; return id && owner === view.owner ? run(owner, () => transport.read(id), false) : Promise.resolve(false); },
    select(owner: string, candidateId: string) {
      const r = view.result; if (!r || owner !== view.owner || !r.candidateIds.includes(candidateId)) return Promise.resolve(false);
      return run(owner, () => transport.select(r.scanId, { candidateId, expectedGeneration: r.generation, expectedResultRevision: r.resultRevision }), false);
    },
    async save(owner: string, idempotencyKey: string, details?: PartTwoSaveGuard) {
      const r = view.result; const token = epoch;
      if (!r?.snapshotId || owner !== view.owner || !r.allowedActions.some(x => x === 'save' || x === 'save_partial')) return false;
      try {
        await transport.save({ idempotencyKey, scanId: r.scanId, expectedGeneration: r.generation, expectedResultRevision: r.resultRevision, selectedSnapshotId: r.snapshotId, selectedDeclarationId: r.declarationId }, details);
        if (token !== epoch || owner !== view.owner || view.result?.resultRevision !== r.resultRevision) return false;
        view = { ...view, saved: true, error: null }; emit(); return true;
      } catch { if (token === epoch && owner === view.owner) { view = { ...view, error: details ? 'Details changed. Review and save again.' : 'This result changed or could not be saved. Review the current evidence and try again.' }; emit(); await this.refresh(owner); } return false; }
    },
    capture(owner: string) { const r = view.result; if (!r || owner !== view.owner) throw new Error('Capture binding unavailable'); return transport.capture(r.scanId, r.generation, r.resultRevision); },
    setScroll(offset: number) { view = { ...view, scrollOffset: Math.max(0, offset) }; },
    publish(result: ScanResult, owner: string) { return publish(result, epoch, owner); },
    close() { lastScan = null; release(); epoch++; view = { owner: null, result: null, loading: false, error: null, saved: false, scrollOffset: 0 }; emit(); },
    setOwner(owner: string | null) { if (view.owner !== owner) this.close(); },
  };
}
