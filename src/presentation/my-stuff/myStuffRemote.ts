import { getFreeSkinProfile } from '../../services/remote/freePersonalFit.ts';
import {
  listFreeProducts, listFreeChecks, listFreeExperiences,
  setFreeProductState, deleteFreeProduct, deleteFreeEntry, saveFreeProduct,
} from '../../services/remote/freeContext.ts';
import { useAuthStore } from '../../stores/authStore.ts';
import { createMyStuffStore } from '../../stores/myStuffStore.ts';
import { currentCustomerOwner } from '../personal-decision/customerGateway.ts';
import { captureCustomerFunctionClient } from '../personal-decision/customerController.ts';
import { supabase } from '../../services/supabase.ts';
import { createCatalogRequestId } from '../../services/productCatalog.ts';
import { ProductEntryController } from './productEntry.ts';

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

// New shelf entries use the same identity-pinned transport as canonical context.
// They remain saved collection records and never write a canonical routine.
export { currentCustomerOwner as getProductEntryOwner } from '../personal-decision/customerGateway.ts';

export function createProductEntryController(): ProductEntryController {
  return new ProductEntryController({
    getOwner: currentCustomerOwner,
    getOwnerEpoch: () => myStuffStore.getState().ownerEpoch,
    createRequestId: createCatalogRequestId,
    save: async (ownerId, request) => {
      const client = await captureCustomerFunctionClient(ownerId, supabase, currentCustomerOwner,
        () => myStuffStore.getState().setOwner(currentCustomerOwner()));
      return saveFreeProduct(request, client);
    },
  });
}
