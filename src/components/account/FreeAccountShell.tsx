import React, { useState } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { publicLegalLinks } from '../../config/environment';
import { deleteCurrentAccount } from '../../services/accountDeletion';
import { signOutSession } from '../../services/authClient';
import type { FreeAccessState } from '../../contracts/FreeAccess';
import { openCustomerAccountLink } from '../../presentation/customer-journey/accountLinks';
import { useAuthStore } from '../../stores/authStore';
import { AccountSettingsShell } from './AccountSettingsShell';
import { getAccountSettingsPresentation } from './accountSettingsPresentation';

/** Settings for a real anonymous or permanent free identity. */
export function FreeAccountShell({ identityKind }: { identityKind: FreeAccessState['identityKind'] }) {
  const router = useRouter();
  const email = useAuthStore((state) => state.sessionEmail);
  const presentation = getAccountSettingsPresentation({
    kind: identityKind === 'anonymous' ? 'anonymous' : 'permanent',
    email,
  });
  const [deleting, setDeleting] = useState(false);
  const [privacyError, setPrivacyError] = useState<string | null>(null);
  const [helpError, setHelpError] = useState<string | null>(null);

  const open = async (section: 'privacy' | 'help', label: 'Privacy Policy' | 'Privacy Choices' | 'Help & feedback', url: string) => {
    if (section === 'privacy') setPrivacyError(null);
    else setHelpError(null);
    const result = await openCustomerAccountLink(label, url, Linking);
    if (section === 'privacy') setPrivacyError(result.error);
    else setHelpError(result.error);
  };

  const signOut = async () => {
    const result = await signOutSession();
    if (result.success) {
      router.replace('/');
      return;
    }
    const message = result.error || 'Sign out is unavailable. Please try again.';
    if (Platform.OS === 'web') window.alert(message);
    else Alert.alert('Sign Out', message);
  };

  const deleteData = async () => {
    if (deleting) return;
    setDeleting(true);
    const result = await deleteCurrentAccount();
    if (result.success) {
      router.replace('/');
      return;
    }
    setDeleting(false);
    const message = result.error || 'Your data could not be deleted. Please try again.';
    if (Platform.OS === 'web') window.alert(message);
    else Alert.alert(presentation.deleteConfirmTitle ?? 'Delete', message);
  };

  const confirmDeletion = () => {
    const message = presentation.deleteConfirmMessage ?? 'This cannot be undone.';
    const title = presentation.deleteConfirmTitle ?? 'Delete';
    if (Platform.OS === 'web') {
      if (window.confirm(message)) void deleteData();
    } else {
      Alert.alert(title, message, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => void deleteData() },
      ]);
    }
  };

  return (
    <AccountSettingsShell
      presentation={presentation}
      deleting={deleting}
      privacyError={privacyError}
      helpError={helpError}
      onOpenPrivacy={() => void open('privacy', 'Privacy Policy', publicLegalLinks.privacyUrl)}
      onOpenPrivacyChoices={() => void open('privacy', 'Privacy Choices', publicLegalLinks.privacyChoicesUrl)}
      onOpenHelp={() => void open('help', 'Help & feedback', publicLegalLinks.supportUrl)}
      onSignOut={presentation.showSignOut ? () => void signOut() : undefined}
      onDelete={presentation.showDelete ? confirmDeletion : undefined}
    />
  );
}
