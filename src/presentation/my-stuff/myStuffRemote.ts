import { getFreeSkinProfile } from '../../services/remote/freePersonalFit.ts';
import {
  listFreeProducts, listFreeChecks, listFreeExperiences,
  setFreeProductState, deleteFreeProduct, deleteFreeEntry,
} from '../../services/remote/freeContext.ts';
import { useAuthStore } from '../../stores/authStore.ts';
import { createMyStuffStore } from '../../stores/myStuffStore.ts';

/** The free-context API derives ownership from Auth. Keep its client projection equally scoped. */
export const myStuffStore = createMyStuffStore({
  getProfile: getFreeSkinProfile,
  listProducts: listFreeProducts,
  listChecks: listFreeChecks,
  listExperiences: listFreeExperiences,
  setProductState: setFreeProductState,
  deleteProduct: deleteFreeProduct,
  deleteEntry: deleteFreeEntry,
});

useAuthStore.subscribe((state) => {
  myStuffStore.getState().setOwner(state.status === 'SIGNED_IN' ? state.sessionUserId : null);
});
