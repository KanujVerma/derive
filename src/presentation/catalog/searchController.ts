export interface CatalogSearchState<T> {
  query: string; resultQuery: string; items: T[]; loading: boolean; error: boolean;
}
export function createCatalogSearchController<T>(search: (query: string) => Promise<T[]>,
  onChange: (state: CatalogSearchState<T>) => void = () => {}) {
  let state: CatalogSearchState<T> = { query: '', resultQuery: '', items: [], loading: false, error: false };
  let generation = 0;
  let disposed = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const cancelTimer = () => { if (timer !== null) clearTimeout(timer); timer = null; };
  const publish = (next: CatalogSearchState<T>) => { state = next; onChange({ ...state, items: [...state.items] }); };
  const submit = async () => {
    if (disposed) return;
    cancelTimer();
    const query = state.query.trim();
    const version = ++generation;
    if (query.length < 2) { publish({ ...state, resultQuery: '', items: [], loading: false, error: false }); return; }
    publish({ ...state, loading: true, error: false });
    try {
      const items = await search(query);
      if (!disposed && generation === version) publish({ ...state, resultQuery: query, items: [...items], loading: false, error: false });
    } catch {
      if (!disposed && generation === version) publish({ ...state, resultQuery: query, items: [], loading: false, error: true });
    }
  };
  return {
    snapshot: () => ({ ...state, items: [...state.items] }),
    setQuery(query: string) {
      if (disposed) return;
      cancelTimer(); generation++;
      publish({ query, resultQuery: '', items: [], loading: query.trim().length >= 2, error: false });
      if (query.trim().length >= 2) timer = setTimeout(() => { void submit(); }, 275);
    },
    submit,
    select(preserve: boolean) {
      if (disposed) return;
      cancelTimer(); generation++;
      publish(preserve ? { ...state, loading: false } : { query: '', resultQuery: '', items: [], loading: false, error: false });
    },
    dispose() { disposed = true; generation++; cancelTimer(); },
  };
}
