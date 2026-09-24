import { createPersonalizationDraft, type PersonalizationDraft } from './draft.ts';
import type { PersonalFitRefreshInput } from './result.ts';

export type ProfileLoad =
  | { kind: 'unavailable' }
  | { kind: 'ready'; scope: 'client_session'; profile: PersonalizationDraft };
export type ProfileSave =
  | { kind: 'unavailable' }
  | { kind: 'ready'; scope: 'client_session' };
export type PersonalizationGateway = {
  loadProfile(): Promise<ProfileLoad>;
  saveProfile(profile: PersonalizationDraft): Promise<ProfileSave>;
  getFit(productId: string): Promise<PersonalFitRefreshInput>;
  lastSaveStatus(): ProfileSave | null;
};

/** Client presentation seam. Real-main has no S-FREE-2 adapter yet, so it fails closed. */
export function createPersonalizationGateway(mode: 'unavailable' | 'session_demo' = 'unavailable'): PersonalizationGateway {
  let profile: PersonalizationDraft | null = null;
  let saved: ProfileSave | null = null;
  return {
    async loadProfile() {
      return mode === 'session_demo' && profile
        ? { kind: 'ready', scope: 'client_session', profile: createPersonalizationDraft(profile) }
        : { kind: 'unavailable' };
    },
    async saveProfile(draft) {
      if (mode !== 'session_demo') return (saved = { kind: 'unavailable' });
      profile = createPersonalizationDraft(draft);
      return (saved = { kind: 'ready', scope: 'client_session' });
    },
    async getFit(_productId) {
      // No product fit is derived from answers alone. A future owner-bound adapter must supply evidence.
      return { kind: 'unavailable' };
    },
    lastSaveStatus() { return saved; },
  };
}

/** Real-main composition stays unavailable until an owner-bound adapter lands. */
export const personalizationGateway = createPersonalizationGateway();
