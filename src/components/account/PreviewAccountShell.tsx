import React, { useState } from 'react';
import { Linking } from 'react-native';
import { publicLegalLinks } from '../../config/environment';
import { openCustomerAccountLink } from '../../presentation/customer-journey/accountLinks';
import { AccountSettingsShell } from './AccountSettingsShell';
import { getAccountSettingsPresentation } from './accountSettingsPresentation';

/** Development preview has privacy and help, and no canonical account to act on. */
export function PreviewAccountShell() {
  const [privacyError, setPrivacyError] = useState<string | null>(null);
  const [helpError, setHelpError] = useState<string | null>(null);
  const open = async (section: 'privacy' | 'help', label: 'Privacy Policy' | 'Privacy Choices' | 'Help & feedback', url: string) => {
    if (section === 'privacy') setPrivacyError(null);
    else setHelpError(null);
    const result = await openCustomerAccountLink(label, url, Linking);
    if (section === 'privacy') setPrivacyError(result.error);
    else setHelpError(result.error);
  };
  return (
    <AccountSettingsShell
      presentation={getAccountSettingsPresentation({ kind: 'preview' })}
      privacyError={privacyError}
      helpError={helpError}
      onOpenPrivacy={() => void open('privacy', 'Privacy Policy', publicLegalLinks.privacyUrl)}
      onOpenPrivacyChoices={() => void open('privacy', 'Privacy Choices', publicLegalLinks.privacyChoicesUrl)}
      onOpenHelp={() => void open('help', 'Help & feedback', publicLegalLinks.supportUrl)}
    />
  );
}
