import { useEffect, useSyncExternalStore } from 'react';
import type { PersonalContextSnapshot } from '@/src/contracts/PersonalContext';
import type { ProductIngredientQuery } from '@/src/contracts/ProductIngredientLookup';
import { reactionProducts, type ReactionIngredientRecord } from '@/src/presentation/personal-decision/reactionIngredientComparison';
import { webProductIngredientKey } from '@/src/presentation/external-products/webProductIngredients';
import { currentCustomerOwner } from '@/src/presentation/personal-decision/customerGateway';
import { useAuthStore } from '@/src/stores/authStore';
import { reactionResearch } from '@/src/services/reactionIngredientResearch';

/** Saved public facts are reusable. Personal interpretations still use the current owner/context/product. */
export function useReactionIngredientComparison(ownerId: string, context: PersonalContextSnapshot | null,
  query: ProductIngredientQuery | undefined, enabled: boolean): ReactionIngredientRecord[] {
  useSyncExternalStore(reactionResearch.subscribe, reactionResearch.getSnapshot);
  const products = query ? reactionProducts(context, query) : [];
  const current = enabled && context?.ownerId === ownerId && currentCustomerOwner() === ownerId
    && useAuthStore.getState().sessionUserId === ownerId;
  const scope = current && query ? JSON.stringify([ownerId, context.revision, webProductIngredientKey(query), products]) : '';
  useEffect(() => {
    if (!scope) return;
    for (const product of products) void reactionResearch.research(ownerId, product);
  }, [scope]);
  return current ? products.map(product => reactionResearch.record(ownerId, product) ?? { product, status: 'loading' }) : [];
}
