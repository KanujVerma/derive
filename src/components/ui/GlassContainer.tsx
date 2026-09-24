import React from 'react';
import { View, StyleSheet, Platform, ViewStyle, StyleProp } from 'react-native';
import { colors, radii, shadows } from '@/src/constants/theme';

interface GlassContainerProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  glassEffectStyle?: 'clear' | 'regular';
  tintColor?: string;
  isFloating?: boolean;
}

let NativeGlassView: any = null;
try {
  const GlassEffectModule = require('expo-glass-effect');
  NativeGlassView = GlassEffectModule.GlassView;
} catch (e) {
  NativeGlassView = null;
}

export const GlassContainer: React.FC<GlassContainerProps> = ({
  children,
  style,
  glassEffectStyle = 'clear',
  tintColor = colors.glass.tintLight,
  isFloating = false,
}) => {
  const isIOS = Platform.OS === 'ios';
  const darkTint = tintColor === colors.glass.tintDark;

  // On iOS with native glass effect support
  if (isIOS && NativeGlassView) {
    return (
      <View style={[styles.wrapper, isFloating && styles.floatingShadow, style]}>
        <NativeGlassView
          style={StyleSheet.absoluteFill}
          glassEffectStyle={glassEffectStyle}
          tintColor={tintColor}
        />
        <View style={styles.borderOverlay} pointerEvents="none" />
        <View style={styles.content}>{children}</View>
      </View>
    );
  }

  // Graceful fallback for Android or iOS versions without native glass:
  // Uses elevated soft mineral surface with crisp hairline border
  return (
    <View
      style={[
        styles.wrapper,
        styles.fallbackSurface,
        darkTint && styles.fallbackDarkSurface,
        Platform.OS === 'web' && ({ backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' } as any),
        isFloating && styles.floatingShadow,
        style,
      ]}
    >
      <View style={styles.borderOverlay} pointerEvents="none" />
      <View style={styles.content}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: radii.xl,
    overflow: 'hidden',
    position: 'relative',
  },
  floatingShadow: {
    ...shadows.floating,
  },
  fallbackSurface: {
    backgroundColor: 'rgba(255, 254, 251, 0.92)',
  },
  fallbackDarkSurface: {
    backgroundColor: 'rgba(23, 26, 24, 0.92)',
  },
  borderOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: 'rgba(234, 229, 220, 0.8)',
  },
  content: {
    position: 'relative',
    zIndex: 1,
  },
});
