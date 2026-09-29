import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, View, StyleSheet, Platform, type ViewStyle, type StyleProp } from 'react-native';
import type { GlassViewProps } from 'expo-glass-effect';
import { colors, radii, shadows } from '@/src/constants/theme';
import { materialSurface, nativeGlassAllowed, readReduceTransparency, type Material } from '../../presentation/ui/materialPolicy';

interface GlassContainerProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  glassEffectStyle?: 'clear' | 'regular';
  tintColor?: string;
  isFloating?: boolean;
  material?: Material;
  tone?: 'light' | 'dark';
  hasBorder?: boolean;
}
let NativeGlassView: React.ComponentType<GlassViewProps> | null = null;
let apiAvailable = false;
let liquidGlassAvailable = false;
try {
  const module: typeof import('expo-glass-effect') = require('expo-glass-effect');
  NativeGlassView = module.GlassView;
  apiAvailable = module.isGlassEffectAPIAvailable();
  liquidGlassAvailable = module.isLiquidGlassAvailable();
} catch { /* Older runtimes keep the opaque surface. */ }

export const GlassContainer: React.FC<GlassContainerProps> = ({
  children, style, glassEffectStyle = 'clear', tintColor = colors.glass.tintLight,
  isFloating = false, material = 'chrome', tone, hasBorder = true,
}) => {
  const [reduceTransparency, setReduceTransparency] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    const read = typeof AccessibilityInfo.isReduceTransparencyEnabled === 'function'
      ? () => AccessibilityInfo.isReduceTransparencyEnabled() : undefined;
    void readReduceTransparency(Platform.OS, read).then(value => {
      if (active) setReduceTransparency(value);
    }).catch(() => { if (active) setReduceTransparency(true); });
    const subscription = Platform.OS === 'ios'
      ? AccessibilityInfo.addEventListener('reduceTransparencyChanged', setReduceTransparency) : null;
    return () => { active = false; subscription?.remove(); };
  }, []);
  const resolvedTone = tone ?? (tintColor === colors.glass.tintDark ? 'dark' : 'light');
  const native = material === 'chrome' && nativeGlassAllowed({ platform: Platform.OS,
    moduleAvailable: NativeGlassView !== null, apiAvailable, liquidGlassAvailable, reduceTransparency });
  const corner = StyleSheet.flatten(style)?.borderRadius ?? radii.xl;
  return <View style={[styles.wrapper, isFloating && styles.floatingShadow, style,
    !native && { backgroundColor: materialSurface(material, resolvedTone) }]}>
    {native && NativeGlassView ? <NativeGlassView style={[StyleSheet.absoluteFill, { borderRadius: corner }]}
      glassEffectStyle={glassEffectStyle} tintColor={tintColor} colorScheme={resolvedTone} /> : null}
    {hasBorder ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.borderOverlay, { borderRadius: corner }]} /> : null}
    <View style={styles.content}>{children}</View>
  </View>;
};
const styles = StyleSheet.create({
  wrapper: { borderRadius: radii.xl, overflow: 'hidden', position: 'relative' },
  floatingShadow: { ...shadows.floating },
  borderOverlay: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  content: { position: 'relative', zIndex: 1 },
});
