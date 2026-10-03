export interface CatalogSearchState<T> {
  query: string; resultQuery: string; items: T[]; loading: boolean; error: boolean;
}
export function createCatalogSearchController<T>(search: (query: string) => Promise<T[]>,
  onChange: (state: CatalogSearchState<T>) => void = () => {}, options: { automatic?: boolean; onInvalidate?: () => void } = {}) {
  const empty = (): CatalogSearchState<T> => ({ query: '', resultQuery: '', items: [], loading: false, error: false });
  let state = empty();
  let generation = 0;
  let disposed = false;
  let selectionLocked = false;
  let activeQuery: string | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const listeners = new Set<() => void>();
  const cancelTimer = () => { if (timer !== null) clearTimeout(timer); timer = null; };
  const invalidate = () => { cancelTimer(); generation++; activeQuery = null; options.onInvalidate?.(); };
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
    activeQuery = query;
    publish({ ...state, loading: true, error: false });
    try {
      const items = await search(query);
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
      publish({ query, resultQuery: '', items: [], loading: options.automatic !== false && query.trim().length >= 2, error: false });
      if (options.automatic !== false && query.trim().length >= 2) timer = setTimeout(() => { void submit(); }, 275);
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
      invalidate(); selectionLocked = false;
      publish(empty());
    },
    dispose() { disposed = true; invalidate(); listeners.clear(); },
  };
}
export type CatalogSearchController<T> = ReturnType<typeof createCatalogSearchController<T>>;
