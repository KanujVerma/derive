import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ViewStyle,
  TextStyle,
  StyleProp,
} from 'react-native';
import { colors, radii, typography, spacing } from '@/src/constants/theme';
import { VoiceInputButton, VoiceContext } from './VoiceInputButton';
import { VoiceListeningBar } from './VoiceListeningBar';
import { useVoiceDictation } from './useVoiceDictation';
import { KEYBOARD_DONE_NATIVE_ID } from '@/src/components/ui/KeyboardDoneBar';

interface VoiceTextAreaProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  context?: VoiceContext;
  minHeight?: number;
  hint?: string;
  maxLength?: number;
  style?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  editable?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
}

export const VoiceTextArea: React.FC<VoiceTextAreaProps> = ({
  label,
  value,
  onChangeText,
  placeholder,
  context = 'ask',
  minHeight = 100,
  hint,
  maxLength,
  style,
  inputStyle,
  editable = true,
  onFocus,
  onBlur,
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const handleVoiceTranscript = (transcript: string) => {
    if (!transcript) return;
    if (!value || value.trim().length === 0) {
      onChangeText(transcript);
    } else {
      onChangeText(`${value.trim()} ${transcript}`);
    }
  };

  const { isListening, start, stop } = useVoiceDictation({
    context,
    onTranscript: handleVoiceTranscript,
    disabled: !editable,
  });

  return (
    <View style={[styles.wrapper, style]}>
      {label && <Text style={styles.label}>{label}</Text>}

      <View
        style={[
          styles.container,
          { minHeight },
          isFocused && styles.containerFocused,
          isListening && styles.containerFocused,
          !editable && styles.containerDisabled,
        ]}
      >
        {isListening ? (
          <View style={styles.listeningSlot}>
            <VoiceListeningBar onStop={stop} />
          </View>
        ) : (
          <>
            <TextInput
              value={value}
              onChangeText={onChangeText}
              placeholder={placeholder}
              placeholderTextColor={colors.inkSubtle}
              multiline
              maxLength={maxLength}
              editable={editable}
              inputAccessoryViewID={KEYBOARD_DONE_NATIVE_ID}
              onFocus={() => {
                setIsFocused(true);
                onFocus?.();
              }}
              onBlur={() => {
                setIsFocused(false);
                onBlur?.();
              }}
              style={[styles.input, inputStyle]}
            />
            <View style={styles.footerRow}>
              {hint ? (
                <Text style={styles.hintText} numberOfLines={1}>
                  {hint}
                </Text>
              ) : (
                <View style={{ flex: 1 }} />
              )}
              <View style={styles.micWrapper}>
                <VoiceInputButton
                  size={44}
                  onPress={start}
                  disabled={!editable}
                />
              </View>
            </View>
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.sizes.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.medium,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  container: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    justifyContent: 'space-between',
  },
  containerFocused: {
    borderColor: colors.brand,
  },
  containerDisabled: {
    backgroundColor: colors.surfaceMuted,
    opacity: 0.6,
  },
  input: {
    fontSize: typography.sizes.bodyRegular,
    lineHeight: typography.lineHeights.bodyRegular,
    color: colors.ink,
    textAlignVertical: 'top',
    flex: 1,
    minHeight: 60,
  },
  listeningSlot: {
    flex: 1,
    minHeight: 72,
    justifyContent: 'center',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
  },
  hintText: {
    flex: 1,
    fontSize: typography.sizes.micro,
    lineHeight: typography.lineHeights.micro,
    color: colors.inkSubtle,
    marginRight: spacing.sm,
  },
  micWrapper: {
    alignSelf: 'flex-end',
  },
});
