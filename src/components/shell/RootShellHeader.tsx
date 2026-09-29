import React from 'react';
import { Image, StyleSheet } from 'react-native';
import { ScreenHeader } from '../ui/ScreenHeader';
import { AccountSettingsButton } from '../account/AccountSettingsButton';

/** One functional header grammar for the scanner-first roots. */
export function RootShellHeader({ title }: { title: string }) {
  return (
    <ScreenHeader
      title={title}
      leading={(
        <Image
          source={require('@/assets/logo.png')}
          style={styles.mark}
          resizeMode="contain"
          accessible={false}
        />
      )}
      rightAccessory={<AccountSettingsButton />}
    />
  );
}

const styles = StyleSheet.create({
  mark: {
    width: 28,
    height: 28,
  },
});
