import AsyncStorage from '@react-native-async-storage/async-storage';
import { ReactionResearchStore } from '../presentation/personal-decision/reactionResearchStore';
import { reactionProducts } from '../presentation/personal-decision/reactionIngredientComparison';
import { requestWebProductIngredients, webProductIngredientKey } from '../presentation/external-products/webProductIngredients';
import { customerController, currentCustomerOwner } from '../presentation/personal-decision/customerGateway';
import { useAuthStore } from '../stores/authStore';
import { useFreeAccessStore } from '../stores/freeAccessStore';
import { supabase } from './supabase';

export const reactionResearch = new ReactionResearchStore(AsyncStorage, async (product, owner, current) => {
  if (!supabase || !current() || currentCustomerOwner() !== owner) return { status: 'unavailable' };
  const query = { barcode: '', name: product.name, brand: product.brand, size: null };
  const scope = owner + ':' + webProductIngredientKey(query);
  return requestWebProductIngredients(query, owner, () => current() && currentCustomerOwner() === owner ? scope : '', supabase);
}, () => new Promise(resolve => setTimeout(resolve, 11000)));

/** Research only saved, current reports. No typing-time requests and no symptoms/notes in search queries. */
export function bindReactionResearchLifecycle(): () => void {
  const sync = () => {
    const owner = currentCustomerOwner(); reactionResearch.setOwner(owner);
    const state = customerController.getState();
    if (!owner || state.ownerId !== owner || state.status !== 'ready' || state.context?.ownerId !== owner) return;
    for (const product of reactionProducts(state.context, { barcode: '', name: null, brand: null, size: null }, 20)) {
      void reactionResearch.research(owner, product);
    }
  };
  const auth = useAuthStore.subscribe(sync), access = useFreeAccessStore.subscribe(sync), context = customerController.subscribe(sync);
  sync();
  // Component teardown is not sign-out. Preserve public facts for the same authenticated device session.
  return () => { auth(); access(); context(); };
}
