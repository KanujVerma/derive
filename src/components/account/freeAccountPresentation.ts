import type { FreeAccessState } from '../../contracts/FreeAccess.ts';
import { getAccountSettingsPresentation } from './accountSettingsPresentation.ts';

/** Kept for existing free-account callers. The settings screen uses the fuller model. */
export function getFreeAccountPresentation(identityKind: FreeAccessState['identityKind']) {
  const presentation = getAccountSettingsPresentation({ kind: identityKind === 'anonymous' ? 'anonymous' : 'permanent' });
  return { intro: presentation.accountSubtitle, showSignOut: presentation.showSignOut };
}
