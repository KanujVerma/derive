export interface CatalogSearchState<T> {
  query: string; resultQuery: string; items: T[]; loading: boolean; error: boolean;
}
export function createCatalogSearchController<T>(search: (query: string, signal?: AbortSignal) => Promise<T[]>,
  onChange: (state: CatalogSearchState<T>) => void = () => {}, options: { automatic?: boolean; onInvalidate?: () => void; debounceMs?: number; automaticQuery?: (query: string) => boolean; cacheTtlMs?: number; now?: () => number } = {}) {
  const empty = (): CatalogSearchState<T> => ({ query: '', resultQuery: '', items: [], loading: false, error: false });
  let state = empty();
  let generation = 0;
  let disposed = false;
  let selectionLocked = false;
  let activeQuery: string | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let abort: AbortController | null = null;
  const cache = new Map<string, { items: T[]; expires: number }>();
  const now = options.now ?? Date.now;
  const automatic = (query: string) => options.automatic !== false && query.trim().length >= 2 && (options.automaticQuery?.(query.trim()) ?? true);
  const listeners = new Set<() => void>();
  const cancelTimer = () => { if (timer !== null) clearTimeout(timer); timer = null; };
  const invalidate = () => { cancelTimer(); generation++; activeQuery = null; abort?.abort(); abort = null; options.onInvalidate?.(); };
  const publish = (next: CatalogSearchState<T>) => {
    state = next;
    onChange({ ...state, items: [...state.items] });
    for (const listener of listeners) listener();
  };
  const submit = async () => {
    if (disposed || selectionLocked) return;
    cancelTimer();
    const query = state.query.trim();
    if (activeQuery === query) return;
    const version = ++generation;
    if (query.length < 2) { publish({ ...state, resultQuery: '', items: [], loading: false, error: false }); return; }
    const cached = cache.get(query.toLowerCase());
    if (cached && cached.expires > now()) { publish({ ...state, resultQuery: query, items: [...cached.items], loading: false, error: false }); return; }
    abort?.abort(); const requestAbort = new AbortController(); abort = requestAbort;
    activeQuery = query;
    publish({ ...state, loading: true, error: false });
    try {
      const items = await search(query, requestAbort.signal);
      if (!disposed && generation === version && !requestAbort.signal.aborted && options.cacheTtlMs) {
        cache.delete(query.toLowerCase()); cache.set(query.toLowerCase(), { items: [...items], expires: now() + options.cacheTtlMs });
        while (cache.size > 8) cache.delete(cache.keys().next().value!);
      }
      if (!disposed && generation === version) publish({ ...state, resultQuery: query, items: [...items], loading: false, error: false });
    } catch {
      if (!disposed && generation === version) publish({ ...state, resultQuery: query, items: [], loading: false, error: true });
    } finally {
      if (generation === version) activeQuery = null;
    }
  };
  return {
    snapshot: () => ({ ...state, items: [...state.items] }),
    getState: () => state,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    setQuery(query: string) {
      if (disposed) return;
      invalidate(); selectionLocked = false;
      publish({ query, resultQuery: '', items: [], loading: automatic(query), error: false });
      if (automatic(query)) timer = setTimeout(() => { void submit(); }, options.debounceMs ?? 275);
    },
    submit,
    select(preserve: boolean): boolean {
      if (disposed || selectionLocked) return false;
      invalidate(); selectionLocked = true;
      publish(preserve ? { ...state, loading: false } : empty());
      return true;
    },
    releaseSelection() { selectionLocked = false; },
    cancel() {
      if (disposed) return;
      invalidate();
      publish({ ...state, loading: false, error: false });
    },
    reset() {
      if (disposed) return;
      invalidate(); cache.clear(); selectionLocked = false;
      publish(empty());
    },
    dispose() { disposed = true; invalidate(); cache.clear(); listeners.clear(); },
  };
}
export type CatalogSearchController<T> = ReturnType<typeof createCatalogSearchController<T>>;
