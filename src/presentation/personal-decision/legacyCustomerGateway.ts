import { createLivePersonalizationGateway } from '../personalization/liveGateway.ts';
import type { PersonalizationGateway } from '../personalization/gateway.ts';
import type { FreeSkinProfile, FreeSkinProfileInput, PersonalFitResult } from '../../contracts/FreePersonalFit.ts';
import type { CustomerFunctionClient } from './customerController.ts';
interface LegacyApi {
  getFreeSkinProfile(client: CustomerFunctionClient): Promise<FreeSkinProfile | null>;
  saveFreeSkinProfile(profile: FreeSkinProfileInput, client: CustomerFunctionClient): Promise<FreeSkinProfile>;
  getPersonalFit(productId: string, variantId: string | undefined, client: CustomerFunctionClient): Promise<PersonalFitResult>;
}
/** Retain S2 formats/status semantics while pinning every request to its intended owner. */
export function createOwnerPinnedLegacyGateway(api: LegacyApi, capture: (owner: string) => Promise<CustomerFunctionClient>, getOwner: () => string | null): PersonalizationGateway & { clear: () => void } {
  let activeOwner: string | null = null, active: PersonalizationGateway | null = null, generation = 0;
  const reset = () => { generation++; activeOwner = null; active = null; };
  const scoped = (owner: string) => {
    if (activeOwner !== owner || !active) {
      reset(); activeOwner = owner;
      active = createLivePersonalizationGateway({
        getFreeSkinProfile: async () => api.getFreeSkinProfile(await capture(owner)),
        saveFreeSkinProfile: async profile => api.saveFreeSkinProfile(profile, await capture(owner)),
        getPersonalFit: async (productId, variantId) => api.getPersonalFit(productId, variantId, await capture(owner)),
      });
    }
    return active;
  };
  const run = async <T>(owner: string | null, action: (gateway: PersonalizationGateway, owner: string) => Promise<T>): Promise<T | { kind: 'unavailable' }> => {
    if (!owner || getOwner() !== owner) { reset(); return { kind: 'unavailable' }; }
    const gateway = scoped(owner), started = generation;
    try { const result = await action(gateway, owner); if (started !== generation) return { kind: 'unavailable' }; if (getOwner() !== owner) { reset(); return { kind: 'unavailable' }; } return result; }
    catch (error) { if (started !== generation) return { kind: 'unavailable' }; if (getOwner() !== owner || (error as { code?: string }).code === 'OWNER_CHANGED') { reset(); return { kind: 'unavailable' }; } throw error; }
  };
  return {
    clear: reset,
    loadProfile: owner => run(owner, (gateway, id) => gateway.loadProfile(id)),
    saveProfile: (owner, draft) => run(owner, (gateway, id) => gateway.saveProfile(id, draft)),
    getFit: (owner, productId, variantId) => run(owner, (gateway, id) => gateway.getFit(id, productId, variantId)),
    lastSaveStatus(owner) { if (!owner || getOwner() !== owner) { reset(); return null; } return scoped(owner).lastSaveStatus(owner); },
  };
}
