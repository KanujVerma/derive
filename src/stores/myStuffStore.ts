import { createStore } from 'zustand/vanilla';
import type { FreeSkinProfile } from '../contracts/FreePersonalFit.ts';
import type { FreeContextPage, FreeSavedProduct, FreeCheckEntry, FreeExperienceEntry, FreeProductState } from '../contracts/FreeContext.ts';
import { mapFreeMyStuff } from '../presentation/my-stuff/liveMyStuff.ts';
import type { MyStuffViewModel } from '../presentation/my-stuff/myStuffPresentation.ts';

type Section = 'products' | 'checks' | 'experiences';
type CursorState = Record<Section, string | null>;
type BusyState = Record<Section, boolean>;
const emptyModel: MyStuffViewModel = { profile: null, products: [], checks: [], experiences: [] };
const emptyCursors = (): CursorState => ({ products: null, checks: null, experiences: null });
const emptyBusy = (): BusyState => ({ products: false, checks: false, experiences: false });

export interface MyStuffApi {
  getProfile: () => Promise<FreeSkinProfile | null>;
  listProducts: (limit?: number, cursor?: string) => Promise<FreeContextPage<FreeSavedProduct>>;
  listChecks: (limit?: number, cursor?: string) => Promise<FreeContextPage<FreeCheckEntry>>;
  listExperiences: (limit?: number, cursor?: string) => Promise<FreeContextPage<FreeExperienceEntry>>;
  setProductState: (id: string, state: FreeProductState) => Promise<FreeSavedProduct>;
  deleteProduct: (id: string) => Promise<unknown>;
  deleteEntry: (section: 'checks' | 'experiences', id: string) => Promise<unknown>;
}

export interface MyStuffState {
  ownerId: string | null;
  ownerEpoch: number;
  generation: number;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  model: MyStuffViewModel;
  cursors: CursorState;
  loadingMore: BusyState;
  setOwner: (ownerId: string | null) => void;
  load: () => Promise<void>;
  loadMore: (section: Section) => Promise<void>;
  changeProductState: (id: string, state: FreeProductState) => Promise<void>;
  removeProduct: (id: string) => Promise<void>;
  removeEntry: (section: 'checks' | 'experiences', id: string) => Promise<void>;
}

export function createMyStuffStore(api: MyStuffApi) {
  return createStore<MyStuffState>((set, get) => ({
    ownerId: null, ownerEpoch: 0, generation: 0, status: 'idle', error: null,
    model: emptyModel, cursors: emptyCursors(), loadingMore: emptyBusy(),
    setOwner: (ownerId) => {
      if (get().ownerId === ownerId) return;
      set((state) => ({ ownerId, ownerEpoch: state.ownerEpoch + 1, generation: state.generation + 1, status: 'idle', error: null,
        model: emptyModel, cursors: emptyCursors(), loadingMore: emptyBusy() }));
    },
    load: async () => {
      const { ownerId } = get();
      if (!ownerId) return;
      const generation = get().generation + 1;
      set({ generation, status: 'loading', error: null, loadingMore: emptyBusy() });
      try {
        const [profile, products, checks, experiences] = await Promise.all([
          api.getProfile(), api.listProducts(20), api.listChecks(20), api.listExperiences(20),
        ]);
        if (get().ownerId !== ownerId || get().generation !== generation) return;
        set({ status: 'ready', model: mapFreeMyStuff(profile, products.items, checks.items, experiences.items),
          cursors: { products: products.nextCursor, checks: checks.nextCursor, experiences: experiences.nextCursor } });
      } catch {
        if (get().ownerId === ownerId && get().generation === generation) {
          set({ status: 'error', error: 'My Stuff could not be loaded. Try again.' });
        }
      }
    },
    loadMore: async (section) => {
      const { ownerId, generation, cursors, loadingMore } = get();
      const cursor = cursors[section];
      if (!ownerId || !cursor || loadingMore[section]) return;
      set({ loadingMore: { ...loadingMore, [section]: true }, error: null });
      try {
        const page = section === 'products' ? await api.listProducts(20, cursor)
          : section === 'checks' ? await api.listChecks(20, cursor)
            : await api.listExperiences(20, cursor);
        if (get().ownerId !== ownerId || get().generation !== generation) return;
        const current = get();
        const existing = current.model[section];
        const added = mapFreeMyStuff(null,
          section === 'products' ? page.items as FreeSavedProduct[] : [],
          section === 'checks' ? page.items as FreeCheckEntry[] : [],
          section === 'experiences' ? page.items as FreeExperienceEntry[] : [],
        )[section];
        const seen = new Set(existing.map((item) => item.id));
        set({ model: { ...current.model, [section]: [...existing, ...added.filter((item) => !seen.has(item.id))] },
          cursors: { ...current.cursors, [section]: page.nextCursor } });
      } catch {
        if (get().ownerId === ownerId && get().generation === generation) set({ error: 'More history could not be loaded. Try again.' });
      } finally {
        if (get().ownerId === ownerId && get().generation === generation) {
          set((state) => ({ loadingMore: { ...state.loadingMore, [section]: false } }));
        }
      }
    },
    changeProductState: async (id, state) => {
      const { ownerId, ownerEpoch } = get();
      if (!ownerId || !get().model.products.some((item) => item.id === id)) return;
      const updated = await api.setProductState(id, state);
      if (get().ownerId !== ownerId || get().ownerEpoch !== ownerEpoch) return;
      set((current) => ({ model: { ...current.model, products: current.model.products.map((item) => item.id === id
        ? { ...item, state: updated.state } : item) } }));
    },
    removeProduct: async (id) => {
      const { ownerId, ownerEpoch } = get();
      if (!ownerId || !get().model.products.some((item) => item.id === id)) return;
      await api.deleteProduct(id);
      if (get().ownerId !== ownerId || get().ownerEpoch !== ownerEpoch) return;
      set((current) => ({ model: { ...current.model, products: current.model.products.filter((item) => item.id !== id) } }));
    },
    removeEntry: async (section, id) => {
      const { ownerId, ownerEpoch } = get();
      if (!ownerId || !get().model[section].some((item) => item.id === id)) return;
      await api.deleteEntry(section, id);
      if (get().ownerId !== ownerId || get().ownerEpoch !== ownerEpoch) return;
      set((current) => ({ model: { ...current.model, [section]: current.model[section].filter((item) => item.id !== id) } }));
    },
  }));
}
