import { requestPersonalDecision } from '../../services/remote/personalDecision';
import { getPersonalContext, writePersonalContext, requestPersonalContext } from '../../services/remote/personalContext';
import { createCatalogRequestId } from '../../services/productCatalog';
import { useAuthStore } from '../../stores/authStore';
import { useFreeAccessStore } from '../../stores/freeAccessStore';
import { publicEnvironment } from '../../config/environment';
import { isRemoteServiceEnabled } from '../../services/DeriveService';
import { resolveShellPresentation } from '../../utils/shellPresentation';
import type { PersonalExperiencePage } from '../../contracts/PersonalContext';
import { CustomerController, type CustomerGateway } from './customerController';
/** Live authenticated local development only. Hosted/legacy access remains unchanged. */
export function currentCustomerOwner(): string | null {
  const auth = useAuthStore.getState(), access = useFreeAccessStore.getState();
  const shell = resolveShellPresentation({ buildFlavor: publicEnvironment.buildFlavor, remoteEnabled: isRemoteServiceEnabled(), supabaseUrl: publicEnvironment.supabaseUrl });
  return shell === 'local_free_integration' && auth.status === 'SIGNED_IN' && auth.sessionUserId && access.status === 'READY' && access.userId === auth.sessionUserId && access.access?.userId === auth.sessionUserId ? auth.sessionUserId : null;
}
function assertOwner(owner: string) { if (currentCustomerOwner() !== owner) throw new Error('OWNER_CHANGED'); }
export const customerGateway: CustomerGateway = {
  async load(owner) { assertOwner(owner); const result = await getPersonalContext(); assertOwner(owner); if (result.ownerId !== owner) throw new Error('OWNER_MISMATCH'); return result; },
  async write(owner, request) { assertOwner(owner); const result = await writePersonalContext(request); assertOwner(owner); return result; },
  async history(owner, request) { assertOwner(owner); const value = await requestPersonalContext(request); assertOwner(owner); if (!('items' in value) || !Array.isArray(value.items) || !('atRevision' in value) || value.atRevision !== request.atRevision || !('nextCursor' in value) || (value.nextCursor !== null && typeof value.nextCursor !== 'string')) throw new Error('INVALID_HISTORY'); const page = value as unknown as PersonalExperiencePage; if (page.items.some(item => item.ownerId !== owner)) throw new Error('OWNER_MISMATCH'); return page; },
  async evaluate(owner, request) { assertOwner(owner); const result = await requestPersonalDecision(request); assertOwner(owner); return result; },
};
export const customerController = new CustomerController(customerGateway, createCatalogRequestId);
