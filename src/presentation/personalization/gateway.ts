import { createPersonalizationDraft, type PersonalizationDraft } from './draft.ts';
import type { PersonalFitRefreshInput } from './result.ts';

export type ProfileLoad =
  | { kind: 'unavailable' }
  | { kind: 'ready'; scope: 'client_session'; profile: PersonalizationDraft };
export type ProfileSave =
  | { kind: 'unavailable' }
  | { kind: 'ready'; scope: 'client_session' };
export type PersonalizationGateway = {
  loadProfile(ownerId: string | null): Promise<ProfileLoad>;
  saveProfile(ownerId: string | null, profile: PersonalizationDraft): Promise<ProfileSave>;
  getFit(ownerId: string | null, productId: string): Promise<PersonalFitRefreshInput>;
  lastSaveStatus(ownerId: string | null): ProfileSave | null;
};

/** Client presentation seam. Real-main has no S-FREE-2 adapter yet, so it fails closed. */
export function createPersonalizationGateway(mode: 'unavailable' | 'session_demo' = 'unavailable'): PersonalizationGateway {
  let currentOwnerId: string | null = null;
  let profile: PersonalizationDraft | null = null;
  let saved: ProfileSave | null = null;
  const scopeTo = (ownerId: string | null) => {
    if (ownerId === currentOwnerId) return;
    currentOwnerId = ownerId;
    profile = null;
    saved = null;
  };
  return {
    async loadProfile(ownerId) {
      scopeTo(ownerId);
      return ownerId && mode === 'session_demo' && profile
        ? { kind: 'ready', scope: 'client_session', profile: createPersonalizationDraft(profile) }
        : { kind: 'unavailable' };
    },
    async saveProfile(ownerId, draft) {
      scopeTo(ownerId);
      if (!ownerId) return { kind: 'unavailable' };
      if (mode !== 'session_demo') return (saved = { kind: 'unavailable' });
      profile = createPersonalizationDraft(draft);
      return (saved = { kind: 'ready', scope: 'client_session' });
    },
    async getFit(ownerId, _productId) {
      scopeTo(ownerId);
      // No product fit is derived from answers alone. A future owner-bound adapter must supply evidence.
      return { kind: 'unavailable' };
    },
    lastSaveStatus(ownerId) { scopeTo(ownerId); return ownerId ? saved : null; },
  };
}

/** Real-main composition stays unavailable until an owner-bound adapter lands. */
export const personalizationGateway = createPersonalizationGateway();
