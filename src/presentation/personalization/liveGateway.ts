import type { FreeSkinProfile, FreeSkinProfileInput, PersonalFitResult } from '../../contracts/FreePersonalFit.ts';
import type { PersonalizationGateway, ProfileSave } from './gateway.ts';
import type { PersonalFitRefreshInput } from './result.ts';
import { fromFreeSkinProfile, toFreeSkinProfileInput } from './mapping.ts';

export type FreePersonalFitService = {
  getFreeSkinProfile(): Promise<FreeSkinProfile | null>;
  saveFreeSkinProfile(profile: FreeSkinProfileInput): Promise<FreeSkinProfile>;
  getPersonalFit(productId: string, variantId?: string): Promise<PersonalFitResult>;
};

function presentFit(fit: PersonalFitResult): PersonalFitRefreshInput {
  switch (fit.label) {
    case 'COULD_WORK':
    case 'USE_WITH_CAUTION':
      return { kind: 'supported', fit: {
        label: fit.label === 'COULD_WORK' ? 'COULD WORK' : 'USE WITH CAUTION',
        explanation: fit.explanation,
        // Server reason/evidence tokens are internal vocabulary, not customer copy.
        evidenceUsed: [], uncertainty: null,
      } };
    case 'NOT_ENOUGH_INFORMATION':
      return { kind: 'insufficient', message: fit.explanation };
  }
}

/** Owner identity scopes transient UI status; the S-FREE-2 service binds its own JWT. */
export function createLivePersonalizationGateway(service: FreePersonalFitService): PersonalizationGateway {
  let currentOwnerId: string | null = null;
  let saved: ProfileSave | null = null;
  let ownerGeneration = 0;
  const scopeTo = (ownerId: string | null) => {
    if (ownerId === currentOwnerId) return;
    currentOwnerId = ownerId;
    ownerGeneration++;
    saved = null;
  };
  return {
    async loadProfile(ownerId) {
      scopeTo(ownerId);
      if (!ownerId) return { kind: 'unavailable' };
      const profile = await service.getFreeSkinProfile();
      return profile ? { kind: 'ready', scope: 'owner_bound', profile: fromFreeSkinProfile(profile) }
        : { kind: 'empty' };
    },
    async saveProfile(ownerId, draft) {
      scopeTo(ownerId);
      if (!ownerId) return { kind: 'unavailable' };
      const generation = ownerGeneration;
      try {
        await service.saveFreeSkinProfile(toFreeSkinProfileInput(draft));
        if (generation !== ownerGeneration) return { kind: 'unavailable' };
        return (saved = { kind: 'ready', scope: 'owner_bound' });
      } catch {
        if (generation !== ownerGeneration) return { kind: 'unavailable' };
        return (saved = { kind: 'unavailable' });
      }
    },
    async getFit(ownerId, productId, variantId) {
      scopeTo(ownerId);
      if (!ownerId) return { kind: 'unavailable' };
      return presentFit(await service.getPersonalFit(productId, variantId));
    },
    lastSaveStatus(ownerId) { scopeTo(ownerId); return ownerId ? saved : null; },
  };
}
