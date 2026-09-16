import React from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  ViewStyle,
  StyleProp,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, layout, spacing } from '@/src/constants/theme';

interface ScreenProps {
  children: React.ReactNode;
  scrollable?: boolean;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  keyboardOffset?: number;
  paddingBottomExtra?: number;
  showsVerticalScrollIndicator?: boolean;
}

export const Screen: React.FC<ScreenProps> = ({
  children,
  scrollable = false,
  style,
  contentContainerStyle,
  keyboardOffset = 0,
  paddingBottomExtra = 0,
  showsVerticalScrollIndicator = false,
}) => {
  const insets = useSafeAreaInsets();

  const containerStyle: ViewStyle = {
    flex: 1,
    backgroundColor: colors.canvas,
  };

  if (scrollable) {
    return (
      <KeyboardAvoidingView
        style={containerStyle}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={keyboardOffset}
      >
        <ScrollView
          style={[styles.scrollView, style]}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + layout.gutter + paddingBottomExtra },
            contentContainerStyle,
          ]}
          showsVerticalScrollIndicator={showsVerticalScrollIndicator}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={containerStyle}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={keyboardOffset}
    >
      <View
        style={[
          styles.fixedContent,
          { paddingBottom: insets.bottom + paddingBottomExtra },
          style,
        ]}
      >
        {children}
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: layout.gutter,
    paddingTop: spacing.md,
  },
  fixedContent: {
    flex: 1,
    paddingHorizontal: layout.gutter,
  },
});
