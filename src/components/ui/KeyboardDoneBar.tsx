import React from 'react';
import {
  InputAccessoryView,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, spacing, typography } from '@/src/constants/theme';

export const KEYBOARD_DONE_NATIVE_ID = 'derive-keyboard-done';

export const KeyboardDoneBar: React.FC = () => {
  if (Platform.OS !== 'ios') return null;

  return (
    <InputAccessoryView nativeID={KEYBOARD_DONE_NATIVE_ID}>
      <View style={styles.bar}>
        <Pressable
          onPress={() => Keyboard.dismiss()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Dismiss keyboard"
          style={styles.button}
        >
          <Text style={styles.label}>Done</Text>
        </Pressable>
      </View>
    </InputAccessoryView>
  );
};

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.canvas,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  button: {
    minHeight: 44,
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: colors.brand,
    fontSize: typography.sizes.bodyRegular,
    fontWeight: typography.weights.semibold,
  },
});
