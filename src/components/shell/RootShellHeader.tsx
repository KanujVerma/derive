import React from 'react';
import { ScreenHeader } from '../ui/ScreenHeader';
import { AccountSettingsButton } from '../account/AccountSettingsButton';

/** One functional header grammar for the scanner-first roots. */
export function RootShellHeader({ title }: { title: string }) {
  return <ScreenHeader title={title} rightAccessory={<AccountSettingsButton />} />;
}
