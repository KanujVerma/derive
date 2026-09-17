import React from 'react';
import {
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { colors } from '@/src/constants/theme';
import { Icon } from '@/src/components/ui/Icon';

export type VoiceContext = 'ask' | 'photo_note' | 'reaction_note' | 'checkin_note';

interface VoiceInputButtonProps {
  onPress: () => void;
  size?: number;
  disabled?: boolean;
}

export function VoiceInputButton({
  onPress,
  size = 38,
  disabled = false,
}: VoiceInputButtonProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel="Dictate with voice"
      accessibilityRole="button"
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
        disabled && styles.containerDisabled,
      ]}
    >
      <Icon
        name="mic"
        size={Math.round(size * 0.52)}
        color={colors.inkMuted}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(23, 26, 24, 0.04)',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  containerDisabled: {
    opacity: 0.4,
  },
});
