import { createOwnerPinnedLegacyGateway } from './legacyCustomerGateway';
import { getFreeSkinProfile, saveFreeSkinProfile, getPersonalFit } from '../../services/remote/freePersonalFit';
import { catalogReferenceKey } from '../p0b-personalization/storageAdapter';
import { supabase } from '../../services/supabase';
import { captureCustomerFunctionClient } from './customerController';
import { requestPersonalDecision } from '../../services/remote/personalDecision';
import { getPersonalContext, writePersonalContext, requestPersonalContext } from '../../services/remote/personalContext';
import { createCatalogRequestId, getCatalogProductDetail } from '../../services/productCatalog';
import { useAuthStore } from '../../stores/authStore';
import { useFreeAccessStore } from '../../stores/freeAccessStore';
import { publicEnvironment } from '../../config/environment';
import { isRemoteServiceEnabled } from '../../services/DeriveService';
import { isFreeIntegrationShell, resolveShellPresentation } from '../../utils/shellPresentation';
import type { PersonalExperiencePage } from '../../contracts/PersonalContext';
import { CustomerController, type CustomerGateway } from './customerController';
/** Live authenticated free path; access and context stay pinned to the verified owner. */
export function currentCustomerOwner(): string | null {
  const auth = useAuthStore.getState(), access = useFreeAccessStore.getState();
  const shell = resolveShellPresentation({ buildFlavor: publicEnvironment.buildFlavor, remoteEnabled: isRemoteServiceEnabled(), supabaseUrl: publicEnvironment.supabaseUrl });
  return isFreeIntegrationShell(shell) && auth.status === 'SIGNED_IN' && auth.sessionUserId && access.status === 'READY' && access.userId === auth.sessionUserId && access.access?.userId === auth.sessionUserId ? auth.sessionUserId : null;
}
function assertOwner(owner: string) { const current = currentCustomerOwner(); if (current !== owner) { customerController.setOwner(current); throw new Error('OWNER_CHANGED'); } }
const captureClient = (owner: string) => captureCustomerFunctionClient(owner, supabase, currentCustomerOwner, changed => customerController.setOwner(changed));
export const customerGateway: CustomerGateway = {
  async labels(owner, references) {
    assertOwner(owner); const ids = [...new Set(references.map(reference => reference.productId))].slice(0, 50);
    const details = await Promise.allSettled(ids.map(id => getCatalogProductDetail(id))); assertOwner(owner);
    const products = new Map(details.flatMap((result, index) => result.status === 'fulfilled' && result.value?.productId === ids[index] ? [[ids[index], result.value] as const] : []));
    const labels: Record<string, string> = {};
    for (const reference of references) { const product = products.get(reference.productId); if (!product) continue; const variant = reference.variantId ? product.variants.find(item => item.variantId === reference.variantId) : null; labels[catalogReferenceKey(reference)] = 'Current name: ' + [product.brand, product.name, variant?.name, variant?.packageSize].filter(Boolean).join(' '); }
    return labels;
  },
  async load(owner) { assertOwner(owner); const result = await getPersonalContext(await captureClient(owner)); assertOwner(owner); if (result.ownerId !== owner) throw new Error('OWNER_MISMATCH'); return result; },
  async write(owner, request) { assertOwner(owner); const result = await writePersonalContext(request, await captureClient(owner)); assertOwner(owner); return result; },
  async history(owner, request) { assertOwner(owner); const value = await requestPersonalContext(request, await captureClient(owner)); assertOwner(owner); if (!('items' in value) || !Array.isArray(value.items) || !('atRevision' in value) || value.atRevision !== request.atRevision || !('nextCursor' in value) || (value.nextCursor !== null && typeof value.nextCursor !== 'string')) throw new Error('INVALID_HISTORY'); const page = value as unknown as PersonalExperiencePage; if (page.items.some(item => item.ownerId !== owner)) throw new Error('OWNER_MISMATCH'); return page; },
  async evaluate(owner, request) { assertOwner(owner); const result = await requestPersonalDecision(request, await captureClient(owner)); assertOwner(owner); return result; },
};
export const customerController = new CustomerController(customerGateway, createCatalogRequestId);

export const ownerPinnedLegacyGateway = createOwnerPinnedLegacyGateway({ getFreeSkinProfile, saveFreeSkinProfile, getPersonalFit }, captureClient, currentCustomerOwner);
