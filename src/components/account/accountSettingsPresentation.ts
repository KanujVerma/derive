export type AccountSettingsKind = 'preview' | 'anonymous' | 'permanent';

export interface AccountSettingsPresentation {
  kind: AccountSettingsKind;
  accountTitle: string;
  accountSubtitle: string;
  accountFooter: string | null;
  showSignOut: boolean;
  showDelete: boolean;
  deleteLabel: string | null;
  deleteSubtitle: string | null;
  deleteConfirmTitle: string | null;
  deleteConfirmMessage: string | null;
}

export function deriveVersionLabel(version: string | null | undefined): string {
  const trimmed = version?.trim();
  return trimmed ? `Derive ${trimmed}` : 'Derive';
}

/** Customer Account & Settings copy. Managed accounts stay on the legacy screen. */
export function getAccountSettingsPresentation(input: {
  kind: AccountSettingsKind;
  email?: string | null;
}): AccountSettingsPresentation {
  if (input.kind === 'preview') {
    return {
      kind: 'preview',
      accountTitle: 'No account connected',
      accountSubtitle: 'This development preview isn\'t using a real account.',
      accountFooter: null,
      showSignOut: false,
      showDelete: false,
      deleteLabel: null,
      deleteSubtitle: null,
      deleteConfirmTitle: null,
      deleteConfirmMessage: null,
    };
  }
  if (input.kind === 'anonymous') {
    return {
      kind: 'anonymous',
      accountTitle: 'Using Derive without an account',
      accountSubtitle: 'Your profile and saved checks are stored privately in Derive, without an email or password.',
      accountFooter: 'This phone remembers your guest session. Clearing app data or losing the session can make your saved data inaccessible. It is not recoverable on another phone yet.',
      showSignOut: false,
      showDelete: true,
      deleteLabel: 'Delete Derive data',
      deleteSubtitle: 'Permanently delete data tied to this Derive session',
      deleteConfirmTitle: 'Delete Derive data',
      deleteConfirmMessage: 'Delete the data associated with this Derive session? This cannot be undone.',
    };
  }
  const email = input.email?.trim() || null;
  return {
    kind: 'permanent',
    accountTitle: email ?? 'Signed in',
    accountSubtitle: email ? 'Signed in' : '',
    accountFooter: null,
    showSignOut: true,
    showDelete: true,
    deleteLabel: 'Delete account',
    deleteSubtitle: 'Permanently delete your Derive account and data',
    deleteConfirmTitle: 'Delete account',
    deleteConfirmMessage: 'Delete your Derive account and the data tied to it? This cannot be undone.',
  };
}
