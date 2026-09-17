import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ViewStyle,
  TextStyle,
  StyleProp,
  KeyboardTypeOptions,
  Keyboard,
} from 'react-native';
import { colors, radii, typography, spacing } from '@/src/constants/theme';
import { KEYBOARD_DONE_NATIVE_ID } from '@/src/components/ui/KeyboardDoneBar';

interface TextFieldProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string;
  helper?: string;
  multiline?: boolean;
  numberOfLines?: number;
  autoFocus?: boolean;
  keyboardType?: KeyboardTypeOptions;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  style?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  rightElement?: React.ReactNode;
  editable?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
}

export const TextField: React.FC<TextFieldProps> = ({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  helper,
  multiline = false,
  numberOfLines = 1,
  autoFocus = false,
  keyboardType = 'default',
  secureTextEntry = false,
  autoCapitalize = 'sentences',
  style,
  inputStyle,
  rightElement,
  editable = true,
  onFocus,
  onBlur,
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const hasError = !!error;

  return (
    <View style={[styles.wrapper, style]}>
      {label && <Text style={styles.label}>{label}</Text>}

      <View
        style={[
          styles.container,
          multiline && styles.containerMultiline,
          isFocused && styles.containerFocused,
          hasError && styles.containerError,
          !editable && styles.containerDisabled,
        ]}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.inkSubtle}
          multiline={multiline}
          numberOfLines={numberOfLines}
          autoFocus={autoFocus}
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry}
          autoCapitalize={autoCapitalize}
          editable={editable}
          returnKeyType={multiline ? 'default' : 'done'}
          blurOnSubmit={!multiline}
          inputAccessoryViewID={KEYBOARD_DONE_NATIVE_ID}
          onSubmitEditing={() => {
            if (!multiline) {
              Keyboard.dismiss();
              setIsFocused(false);
            }
          }}
          onFocus={() => {
            setIsFocused(true);
            onFocus?.();
          }}
          onBlur={() => {
            setIsFocused(false);
            onBlur?.();
          }}
          style={[
            styles.input,
            multiline && styles.inputMultiline,
            inputStyle,
          ]}
        />
        {rightElement && <View style={styles.rightElement}>{rightElement}</View>}
      </View>

      {hasError ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : helper ? (
        <Text style={styles.helperText}>{helper}</Text>
      ) : null}
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  containerMultiline: {
    minHeight: 96,
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
  },
  containerFocused: {
    borderColor: colors.brand,
  },
  containerError: {
    borderColor: colors.safetyAlert.text,
  },
  containerDisabled: {
    backgroundColor: colors.surfaceMuted,
    opacity: 0.6,
  },
  input: {
    flex: 1,
    fontSize: typography.sizes.bodyRegular,
    lineHeight: typography.lineHeights.bodyRegular,
    color: colors.ink,
    paddingVertical: spacing.sm,
  },
  inputMultiline: {
    textAlignVertical: 'top',
    height: '100%',
  },
  rightElement: {
    marginLeft: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: typography.sizes.caption,
    lineHeight: typography.lineHeights.caption,
    color: colors.safetyAlert.text,
    marginTop: 4,
  },
  helperText: {
    fontSize: typography.sizes.caption,
    lineHeight: typography.lineHeights.caption,
    color: colors.inkSubtle,
    marginTop: 4,
  },
});
