import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Icon } from '../ui/Icon';
import { colors } from '../../constants/theme';

export function AccountSettingsButton() {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push('/profile')}
      style={styles.button}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Account and Settings"
    >
      <Icon name="person" size={18} color={colors.inkMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
