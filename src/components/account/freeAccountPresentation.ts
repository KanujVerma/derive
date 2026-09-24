import type { FreeAccessState } from '../../contracts/FreeAccess.ts';

export function getFreeAccountPresentation(identityKind: FreeAccessState['identityKind']) {
  return identityKind === 'anonymous'
    ? { intro: 'Check products without entering an email.', showSignOut: false }
    : { intro: 'Signed in for product checks.', showSignOut: true };
}
