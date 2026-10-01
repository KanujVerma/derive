import type { PrivateUpcLookup } from '../../contracts/PrivateUpcLookup.ts';
import { validPrivateBarcode } from './privateLookup.ts';

export type PrivateCheckState =
  | { kind: 'idle' | 'loading'; ownerId: string; barcode: string }
  | { kind: 'result'; ownerId: string; barcode: string; result: PrivateUpcLookup }
  | { kind: 'error'; ownerId: string; barcode: string; code: string };

export function privateCheckEnabled(development: boolean, flavor: string, flag: string | undefined): boolean {
  return development && flavor === 'development' && flag === 'true';
}

/** Reuse an effect-replay's promise, not a second paid/quota-consuming request. No persistent cache. */
export function createPrivateCheckRequestMemo() {
  let previous: { key: string; promise: Promise<PrivateUpcLookup> } | null = null;
  return (key: string, request: () => Promise<PrivateUpcLookup>, manual = false) => {
    if (!previous || previous.key !== key || manual) previous = { key, promise: request() };
    return previous.promise;
  };
}

/** One automatic attempt; only an explicit retry can consume another provider request. */
export function createPrivateCheckFallback(input: {
  ownerId: string; barcode: string; getOwner: () => string | null;
  request: (manual: boolean) => Promise<PrivateUpcLookup>; publish: (state: PrivateCheckState) => void;
}) {
  let automaticStarted = false, pending = false, disposed = false, sequence = 0;
  const live = () => !disposed && input.getOwner() === input.ownerId;
  const run = async (manual: boolean) => {
    if (!live() || pending || !input.ownerId || !validPrivateBarcode(input.barcode)) return;
    pending = true;
    const attempt = ++sequence;
    const identity = { ownerId: input.ownerId, barcode: input.barcode };
    input.publish({ kind: 'loading', ...identity });
    try {
      const result = await input.request(manual);
      if (live() && sequence === attempt) input.publish({ kind: 'result', ...identity, result });
    } catch (error) {
      if (live() && sequence === attempt) input.publish({ kind: 'error', ...identity,
        code: error instanceof Error ? error.message : 'UPC_UNAVAILABLE' });
    } finally {
      if (sequence === attempt) pending = false;
    }
  };
  return {
    start: () => { if (automaticStarted) return Promise.resolve(); automaticStarted = true; return run(false); },
    retry: () => run(true),
    dispose: () => { disposed = true; sequence++; },
  };
}

/** A render occurring before effects run must never show a previous owner's/product's response. */
export function visiblePrivateCheckState(state: PrivateCheckState | null, ownerId: string | null,
  barcode: string): PrivateCheckState | null {
  return state && state.ownerId === ownerId && state.barcode === barcode ? state : null;
}
